package com.pacr.app.data.sync

import android.util.Log
import com.pacr.app.data.api.HealthIngestionApiClient
import com.pacr.app.data.api.model.SyncRequest
import com.pacr.app.data.health.HealthConnectRepository
import com.pacr.app.domain.model.HealthMetric
import com.pacr.app.domain.model.MetricType
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit
import javax.inject.Inject
import javax.inject.Singleton

private const val TAG = "ForegroundSyncManager"

@Singleton
class ForegroundSyncManager @Inject constructor(
    private val repository: HealthConnectRepository,
    private val apiClient: HealthIngestionApiClient,
) {
    suspend fun sync(token: String) {
        val now = Instant.now()
        val since = now.minus(24, ChronoUnit.HOURS)
        val today = LocalDate.now(ZoneOffset.UTC)

        val metrics = buildList {
            repository.getHRV(since, now).forEach { hrv ->
                add(HealthMetric(MetricType.HRV_RMSSD, hrv.rmssdMs, hrv.recordedAt))
            }

            repository.getRestingHeartRate(today)?.let { rhr ->
                add(HealthMetric(MetricType.RESTING_HR, rhr.toDouble(), now))
            }

            repository.getSleepData(today.minusDays(1))?.let { sleep ->
                add(HealthMetric(MetricType.SLEEP_QUALITY, sleep.qualityScore.toDouble(), sleep.date))
                add(HealthMetric(MetricType.SLEEP_DURATION_MIN, sleep.totalDurationMinutes.toDouble(), sleep.date))
                add(HealthMetric(MetricType.DEEP_SLEEP_MIN, sleep.deepSleepMinutes.toDouble(), sleep.date))
                add(HealthMetric(MetricType.REM_SLEEP_MIN, sleep.remSleepMinutes.toDouble(), sleep.date))
            }

            repository.getSpO2(since, now).forEach { (time, pct) ->
                add(HealthMetric(MetricType.SPO2, pct, time))
            }

            repository.getVO2Max()?.let { vo2 ->
                add(HealthMetric(MetricType.VO2MAX, vo2, now))
            }
        }

        if (metrics.isEmpty()) {
            Log.d(TAG, "No metrics to sync")
            return
        }

        val payload = SyncRequest(metrics.map(MetricMapper::toPayload))
        val success = apiClient.sync(token, payload)
        Log.d(TAG, "Foreground sync complete: ${metrics.size} metrics, success=$success")
    }
}
