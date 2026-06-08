package com.pacr.app.data.api.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class TodaySessionResponse(
    val success: Boolean,
    val data: TodaySessionData? = null,
)

@Serializable
data class TodaySessionData(
    val id: String? = null,
    @SerialName("session_type") val sessionType: String,
    @SerialName("target_distance_km") val targetDistanceKm: Double? = null,
    @SerialName("target_duration_min") val targetDurationMin: Int? = null,
    @SerialName("target_pace_zone") val targetPaceZone: String? = null,
    @SerialName("target_hr_zone") val targetHrZone: String? = null,
    @SerialName("rpe_target") val rpeTarget: Int? = null,
    @SerialName("guardrail_applied") val guardrailApplied: Boolean? = null,
    @SerialName("readiness_score") val readinessScore: Double? = null,
    val message: String? = null,
)

@Serializable
data class ReadinessResponse(
    val success: Boolean,
    val data: ReadinessData? = null,
)

@Serializable
data class ReadinessData(
    val score: Double,
    @SerialName("overtraining_flag") val overtrainingFlag: Boolean = false,
    val explanation: String? = null,
)

@Serializable
data class CompleteSessionRequest(
    @SerialName("run_id") val runId: String? = null,
)

@Serializable
data class SessionActionResponse(
    val success: Boolean,
)
