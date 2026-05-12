package com.pacr.app.data.health

import android.util.Log
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.Vo2MaxRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.pacr.app.domain.model.ExerciseData
import com.pacr.app.domain.model.HeartRateSample
import com.pacr.app.domain.model.HrvReading
import com.pacr.app.domain.model.RunRecord
import com.pacr.app.domain.model.SleepData
import com.pacr.app.domain.model.computeSleepQualityScore
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit
import javax.inject.Inject
import javax.inject.Singleton

private const val TAG = "HealthConnectRepository"

@Singleton
class HealthConnectRepository @Inject constructor(
    private val manager: HealthConnectManager,
) {
    private val client get() = manager.getClient()

    // ---- HRV ----

    suspend fun getHRV(startTime: Instant, endTime: Instant): List<HrvReading> {
        if (!hasPermission(HeartRateVariabilityRmssdRecord::class)) return emptyList()
        return runCatching {
            withRetry {
                client.readRecords(
                    ReadRecordsRequest(
                        recordType = HeartRateVariabilityRmssdRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                    )
                ).records.map { record ->
                    HrvReading(
                        rmssdMs = record.heartRateVariabilityMillis,
                        recordedAt = record.time,
                    )
                }
            }
        }.getOrElse { e ->
            Log.e(TAG, "Failed to read HRV", e)
            emptyList()
        }
    }

    // ---- Sleep ----

    suspend fun getSleepData(date: LocalDate): SleepData? {
        if (!hasPermission(SleepSessionRecord::class)) return null
        val startOfDay = date.atStartOfDay(ZoneOffset.UTC).toInstant()
        val endOfDay = date.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant()

        return runCatching {
            withRetry {
                val records = client.readRecords(
                    ReadRecordsRequest(
                        recordType = SleepSessionRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(startOfDay, endOfDay),
                    )
                ).records

                if (records.isEmpty()) return@withRetry null

                // Take the longest session if multiple exist
                val session = records.maxByOrNull {
                    ChronoUnit.MINUTES.between(it.startTime, it.endTime)
                }!!

                val totalMinutes = ChronoUnit.MINUTES.between(session.startTime, session.endTime)
                var deepMinutes = 0L
                var remMinutes = 0L

                session.stages.forEach { stage ->
                    val stageMins = ChronoUnit.MINUTES.between(stage.startTime, stage.endTime)
                    when (stage.stage) {
                        SleepSessionRecord.STAGE_TYPE_DEEP -> deepMinutes += stageMins
                        SleepSessionRecord.STAGE_TYPE_REM -> remMinutes += stageMins
                    }
                }

                SleepData(
                    date = session.startTime,
                    totalDurationMinutes = totalMinutes,
                    deepSleepMinutes = deepMinutes,
                    remSleepMinutes = remMinutes,
                    qualityScore = computeSleepQualityScore(totalMinutes, deepMinutes, remMinutes),
                )
            }
        }.getOrElse { e ->
            Log.e(TAG, "Failed to read sleep data", e)
            null
        }
    }

    // ---- Resting Heart Rate ----

    suspend fun getRestingHeartRate(date: LocalDate): Long? {
        if (!hasPermission(RestingHeartRateRecord::class)) return null
        val startOfDay = date.atStartOfDay(ZoneOffset.UTC).toInstant()
        val endOfDay = date.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant()

        return runCatching {
            withRetry {
                client.readRecords(
                    ReadRecordsRequest(
                        recordType = RestingHeartRateRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(startOfDay, endOfDay),
                    )
                ).records.lastOrNull()?.beatsPerMinute
            }
        }.getOrElse { e ->
            Log.e(TAG, "Failed to read resting HR", e)
            null
        }
    }

    // ---- VO2 Max ----

    suspend fun getVO2Max(): Double? {
        if (!hasPermission(Vo2MaxRecord::class)) return null
        val now = Instant.now()
        val ninetyDaysAgo = now.minus(90, ChronoUnit.DAYS)

        return runCatching {
            withRetry {
                client.readRecords(
                    ReadRecordsRequest(
                        recordType = Vo2MaxRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(ninetyDaysAgo, now),
                    )
                ).records.lastOrNull()?.vo2MillilitersPerMinuteKilogram
            }
        }.getOrElse { e ->
            Log.e(TAG, "Failed to read VO2Max", e)
            null
        }
    }

    // ---- SpO2 ----

    suspend fun getSpO2(startTime: Instant, endTime: Instant): List<Pair<Instant, Double>> {
        if (!hasPermission(OxygenSaturationRecord::class)) return emptyList()
        return runCatching {
            withRetry {
                client.readRecords(
                    ReadRecordsRequest(
                        recordType = OxygenSaturationRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                    )
                ).records.map { it.time to it.percentage.value }
            }
        }.getOrElse { e ->
            Log.e(TAG, "Failed to read SpO2", e)
            emptyList()
        }
    }

    // ---- Heart Rate Samples ----

    suspend fun getHeartRateSamples(startTime: Instant, endTime: Instant): List<HeartRateSample> {
        if (!hasPermission(HeartRateRecord::class)) return emptyList()
        return runCatching {
            withRetry {
                client.readRecords(
                    ReadRecordsRequest(
                        recordType = HeartRateRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                    )
                ).records.flatMap { record ->
                    record.samples.map { sample ->
                        HeartRateSample(bpm = sample.beatsPerMinute, time = sample.time)
                    }
                }
            }
        }.getOrElse { e ->
            Log.e(TAG, "Failed to read HR samples", e)
            emptyList()
        }
    }

    // ---- Recent Exercises ----

    suspend fun getRecentExercises(days: Int): List<ExerciseData> {
        if (!hasPermission(ExerciseSessionRecord::class)) return emptyList()
        val endTime = Instant.now()
        val startTime = endTime.minus(days.toLong(), ChronoUnit.DAYS)

        return runCatching {
            withRetry {
                val sessions = client.readRecords(
                    ReadRecordsRequest(
                        recordType = ExerciseSessionRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(startTime, endTime),
                    )
                ).records

                sessions.map { session ->
                    val hrSamples = if (hasPermission(HeartRateRecord::class)) {
                        client.readRecords(
                            ReadRecordsRequest(
                                recordType = HeartRateRecord::class,
                                timeRangeFilter = TimeRangeFilter.between(
                                    session.startTime, session.endTime
                                ),
                            )
                        ).records.flatMap { hr ->
                            hr.samples.map { HeartRateSample(bpm = it.beatsPerMinute, time = it.time) }
                        }
                    } else emptyList()

                    val distanceMeters = if (hasPermission(DistanceRecord::class)) {
                        client.readRecords(
                            ReadRecordsRequest(
                                recordType = DistanceRecord::class,
                                timeRangeFilter = TimeRangeFilter.between(
                                    session.startTime, session.endTime
                                ),
                            )
                        ).records.sumOf { it.distance.inMeters }
                    } else null

                    ExerciseData(
                        id = session.metadata.id,
                        startTime = session.startTime,
                        endTime = session.endTime,
                        title = session.title,
                        exerciseType = session.exerciseType,
                        distanceMeters = distanceMeters,
                        heartRateSamples = hrSamples,
                    )
                }
            }
        }.getOrElse { e ->
            Log.e(TAG, "Failed to read exercises", e)
            emptyList()
        }
    }

    // ---- Write Exercise ----

    suspend fun writeExercise(runRecord: RunRecord) {
        val record = ExerciseSessionRecord(
            startTime = runRecord.startTime,
            startZoneOffset = ZoneOffset.UTC,
            endTime = runRecord.endTime,
            endZoneOffset = ZoneOffset.UTC,
            exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_RUNNING,
            title = runRecord.title,
        )
        runCatching {
            client.insertRecords(listOf(record))
        }.onFailure { e ->
            Log.e(TAG, "Failed to write exercise", e)
        }
    }

    // ---- Helpers ----

    private suspend fun hasPermission(recordType: kotlin.reflect.KClass<*>): Boolean {
        val permission = HealthPermission.getReadPermission(recordType)
        val granted = manager.getGrantedPermissions()
        return if (permission in granted) true else {
            Log.w(TAG, "Permission not granted: $permission — metric excluded from sync")
            false
        }
    }

    private suspend fun <T> withRetry(block: suspend () -> T): T {
        return try {
            block()
        } catch (e: Exception) {
            delay(2000L)
            block()
        }
    }
}
