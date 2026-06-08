package com.pacr.app.data.sync

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.pacr.app.data.api.HealthIngestionApiClient
import com.pacr.app.data.api.model.SyncRequest
import com.pacr.app.data.health.HealthConnectRepository
import com.pacr.app.domain.model.HealthMetric
import com.pacr.app.domain.model.MetricType
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.time.Instant
import java.time.temporal.ChronoUnit

private const val TAG = "BackgroundSyncWorker"

@HiltWorker
class BackgroundSyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted params: WorkerParameters,
    private val repository: HealthConnectRepository,
    private val apiClient: HealthIngestionApiClient,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val now = Instant.now()
        val since = now.minus(2, ChronoUnit.HOURS)

        val metrics = buildList {
            repository.getHRV(since, now).forEach { hrv ->
                add(HealthMetric(MetricType.HRV_RMSSD, hrv.rmssdMs, hrv.recordedAt))
            }
            repository.getSpO2(since, now).forEach { (time, pct) ->
                add(HealthMetric(MetricType.SPO2, pct, time))
            }
            repository.getHeartRateSamples(since, now)
        }

        if (metrics.isEmpty()) {
            Log.d(TAG, "No metrics in 2-hour window")
            return Result.success()
        }

        val payload = SyncRequest(metrics.map(MetricMapper::toPayload))
        val success = apiClient.sync(payload)
        Log.d(TAG, "Background sync: ${metrics.size} metrics, success=$success")
        return if (success) Result.success() else Result.retry()
    }

}
