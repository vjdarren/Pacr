package com.pacr.app.data.api.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class PlanGenerateRequest(
    @SerialName("runner_profile") val runnerProfile: RunnerProfilePayload,
)

@Serializable
data class RunnerProfilePayload(
    val goal: String,
    @SerialName("race_name") val raceName: String?,
    @SerialName("target_date") val targetDate: String,
    @SerialName("weekly_days") val weeklyDays: Int,
    @SerialName("max_session_minutes") val maxSessionMinutes: Int,
    @SerialName("fitness_level") val fitnessLevel: String,
)

@Serializable
data class PlanGenerateResponse(
    val success: Boolean,
    val data: PlanResponseData? = null,
)

@Serializable
data class PlanResponseData(
    @SerialName("plan_id") val planId: String? = null,
)
