package com.pacr.app.data.api.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class StartRunRequest(
    @SerialName("session_id") val sessionId: String? = null,
)

@Serializable
data class StartRunResponse(
    val success: Boolean,
    val data: StartRunData? = null,
)

@Serializable
data class StartRunData(
    @SerialName("run_id") val runId: String,
    @SerialName("started_at") val startedAt: String,
)

@Serializable
data class GpsSample(
    val lat: Double,
    val lng: Double,
    @SerialName("altitude_m") val altitudeM: Double? = null,
    @SerialName("hr_bpm") val hrBpm: Int? = null,
    @SerialName("pace_sec_km") val paceSecKm: Double? = null,
    val timestamp: String,
)

@Serializable
data class LocationBatchRequest(
    val samples: List<GpsSample>,
)

@Serializable
data class CompleteRunRequest(
    @SerialName("distance_km") val distanceKm: Double,
    @SerialName("duration_sec") val durationSec: Int,
    @SerialName("avg_pace_sec_km") val avgPaceSecKm: Double,
    @SerialName("avg_hr_bpm") val avgHrBpm: Int? = null,
    @SerialName("max_hr_bpm") val maxHrBpm: Int? = null,
    @SerialName("elevation_gain_m") val elevationGainM: Double? = null,
)

@Serializable
data class RunRecordResponse(
    val success: Boolean,
    val data: RunRecord? = null,
)

@Serializable
data class RunRecord(
    val id: String,
    @SerialName("user_id") val userId: String,
    @SerialName("session_id") val sessionId: String? = null,
    @SerialName("started_at") val startedAt: String,
    @SerialName("ended_at") val endedAt: String? = null,
    @SerialName("distance_km") val distanceKm: Double? = null,
    @SerialName("duration_sec") val durationSec: Int? = null,
    @SerialName("avg_pace_sec_km") val avgPaceSecKm: Double? = null,
    @SerialName("avg_hr_bpm") val avgHrBpm: Int? = null,
    @SerialName("max_hr_bpm") val maxHrBpm: Int? = null,
    @SerialName("elevation_gain_m") val elevationGainM: Double? = null,
    @SerialName("ai_debrief") val aiDebrief: String? = null,
)
