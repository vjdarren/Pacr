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

private const val TAG = "HistoricalSyncManager"
private const val BATCH_SIZE = 500
private const val HISTORICAL_DAYS = 30

@Singleton
class HistoricalSyncManager @Inject constructor(
    private val repository: HealthConnectRepository,
    private val apiClient: HealthIngestionApiClient,
) {
    suspend fun syncOnce() {
        val now = Instant.now()
        val start = now.minus(HISTORICAL_DAYS.toLong(), ChronoUnit.DAYS)

        val metrics = buildList {
            // HRV for full 30-day window
            repository.getHRV(start, now).forEach { hrv ->
                add(HealthMetric(MetricType.HRV_RMSSD, hrv.rmssdMs, hrv.recordedAt))
            }

            // SpO2 for full 30-day window
            repository.getSpO2(start, now).forEach { (time, pct) ->
                add(HealthMetric(MetricType.SPO2, pct, time))
            }

            // Daily metrics per day
            var date = LocalDate.now(ZoneOffset.UTC).minusDays(HISTORICAL_DAYS.toLong())
            val today = LocalDate.now(ZoneOffset.UTC)
            while (!date.isAfter(today)) {
                repository.getRestingHeartRate(date)?.let { rhr ->
                    add(HealthMetric(MetricType.RESTING_HR, rhr.toDouble(), date.atStartOfDay(ZoneOffset.UTC).toInstant()))
                }
                repository.getSleepData(date)?.let { sleep ->
                    add(HealthMetric(MetricType.SLEEP_QUALITY, sleep.qualityScore.toDouble(), sleep.date))
                    add(HealthMetric(MetricType.SLEEP_DURATION_MIN, sleep.totalDurationMinutes.toDouble(), sleep.date))
                    add(HealthMetric(MetricType.DEEP_SLEEP_MIN, sleep.deepSleepMinutes.toDouble(), sleep.date))
                    add(HealthMetric(MetricType.REM_SLEEP_MIN, sleep.remSleepMinutes.toDouble(), sleep.date))
                }
                date = date.plusDays(1)
            }

            // VO2Max — just the latest
            repository.getVO2Max()?.let { vo2 ->
                add(HealthMetric(MetricType.VO2MAX, vo2, now))
            }
        }

        Log.d(TAG, "Historical sync: ${metrics.size} total metrics, batching at $BATCH_SIZE")

        metrics.chunked(BATCH_SIZE).forEachIndexed { index, batch ->
            val payload = SyncRequest(batch.map(MetricMapper::toPayload))
            val success = apiClient.syncHistorical(payload)
            Log.d(TAG, "Batch $index: ${batch.size} records, success=$success")
        }
    }
}
