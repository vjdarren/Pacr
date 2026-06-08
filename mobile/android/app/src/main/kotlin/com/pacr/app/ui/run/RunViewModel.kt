package com.pacr.app.ui.run

import android.content.Context
import android.content.Intent
import android.location.Location
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pacr.app.data.api.RunTrackerApiClient
import com.pacr.app.data.api.model.GpsSample
import com.pacr.app.data.health.HealthConnectRepository
import com.pacr.app.data.location.LocationRepository
import com.pacr.app.data.location.RunForegroundService
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

@HiltViewModel
class RunViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val locationRepository: LocationRepository,
    private val runTrackerApiClient: RunTrackerApiClient,
    private val healthConnectRepository: HealthConnectRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(RunUiState())
    val uiState: StateFlow<RunUiState> = _uiState

    private var runId: String? = null
    private var sessionId: String? = null
    private var timerJob: Job? = null
    private var locationJob: Job? = null
    private var batchJob: Job? = null
    private var hrJob: Job? = null

    private val pendingSamples = mutableListOf<GpsSample>()
    private var lastLocation: Location? = null
    private var elapsedSec = 0
    private var totalDistanceM = 0.0

    fun startRun(sessionId: String?) {
        this.sessionId = sessionId
        viewModelScope.launch {
            val startData = runTrackerApiClient.startRun(sessionId) ?: run {
                _uiState.value = _uiState.value.copy(error = "Failed to start run")
                return@launch
            }
            runId = startData.runId
            _uiState.value = _uiState.value.copy(isActive = true)
            startForegroundService()
            startTimer()
            startLocationUpdates()
            startBatchSender()
            startHrPolling()
        }
    }

    fun finishRun(onFinished: (runId: String) -> Unit) {
        viewModelScope.launch {
            stopJobs()
            stopForegroundService()

            val id = runId ?: return@launch

            // flush any remaining samples
            if (pendingSamples.isNotEmpty()) {
                runTrackerApiClient.sendBatch(id, pendingSamples.toList())
                pendingSamples.clear()
            }

            val state = _uiState.value
            val completed = runTrackerApiClient.completeRun(
                runId = id,
                distanceKm = state.distanceKm,
                durationSec = state.elapsedSec,
                avgPaceSecKm = state.avgPaceSecKm,
                avgHrBpm = state.hrBpm,
            )

            _uiState.value = _uiState.value.copy(isActive = false)
            if (completed != null) onFinished(id)
        }
    }

    private fun startTimer() {
        timerJob = viewModelScope.launch {
            while (isActive) {
                delay(1_000)
                elapsedSec++
                _uiState.value = _uiState.value.copy(elapsedSec = elapsedSec)
                updateForegroundNotification()
            }
        }
    }

    private fun startLocationUpdates() {
        locationJob = viewModelScope.launch {
            locationRepository.locationFlow().collect { location ->
                val prev = lastLocation
                if (prev != null) {
                    val delta = prev.distanceTo(location).toDouble()
                    totalDistanceM += delta
                    val distKm = totalDistanceM / 1000.0
                    val currentPace = if (location.speed > 0.5f)
                        1000.0 / location.speed.toDouble()
                    else 0.0
                    val avgPace = if (distKm > 0 && elapsedSec > 0)
                        elapsedSec / distKm
                    else 0.0
                    _uiState.value = _uiState.value.copy(
                        distanceKm = distKm,
                        currentPaceSecKm = currentPace,
                        avgPaceSecKm = avgPace,
                    )
                }
                lastLocation = location

                synchronized(pendingSamples) {
                    pendingSamples.add(
                        GpsSample(
                            lat = location.latitude,
                            lng = location.longitude,
                            altitudeM = if (location.hasAltitude()) location.altitude else null,
                            hrBpm = _uiState.value.hrBpm,
                            paceSecKm = if (location.speed > 0.5f) 1000.0 / location.speed else null,
                            timestamp = Instant.ofEpochMilli(location.time).toString(),
                        )
                    )
                }
            }
        }
    }

    private fun startBatchSender() {
        batchJob = viewModelScope.launch {
            while (isActive) {
                delay(5_000)
                val id = runId ?: continue
                val batch = synchronized(pendingSamples) {
                    val copy = pendingSamples.toList()
                    pendingSamples.clear()
                    copy
                }
                if (batch.isNotEmpty()) {
                    runTrackerApiClient.sendBatch(id, batch)
                }
            }
        }
    }

    private fun startHrPolling() {
        hrJob = viewModelScope.launch {
            while (isActive) {
                delay(10_000)
                val hr = healthConnectRepository.getRealtimeHeartRate()
                if (hr != null) _uiState.value = _uiState.value.copy(hrBpm = hr)
            }
        }
    }

    private fun startForegroundService() {
        context.startForegroundService(
            Intent(context, RunForegroundService::class.java).apply {
                putExtra(RunForegroundService.EXTRA_ELAPSED_SEC, 0)
                putExtra(RunForegroundService.EXTRA_DISTANCE_KM, 0.0)
            }
        )
    }

    private fun updateForegroundNotification() {
        context.startService(
            Intent(context, RunForegroundService::class.java).apply {
                putExtra(RunForegroundService.EXTRA_ELAPSED_SEC, elapsedSec)
                putExtra(RunForegroundService.EXTRA_DISTANCE_KM, totalDistanceM / 1000.0)
            }
        )
    }

    private fun stopForegroundService() {
        context.stopService(Intent(context, RunForegroundService::class.java))
    }

    private fun stopJobs() {
        timerJob?.cancel()
        locationJob?.cancel()
        batchJob?.cancel()
        hrJob?.cancel()
    }

    override fun onCleared() {
        super.onCleared()
        stopJobs()
        stopForegroundService()
    }
}
