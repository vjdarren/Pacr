package com.pacr.app.data.api.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class CoachMessageRequest(
    val message: String,
)

@Serializable
data class CoachMessageResponse(
    val success: Boolean? = null,
    val reply: String? = null,
    @SerialName("remaining_messages") val remainingMessages: Int? = null,
)

@Serializable
data class CoachHistoryResponse(
    val messages: List<CoachHistoryItem> = emptyList(),
)

@Serializable
data class CoachHistoryItem(
    val role: String,
    val content: String,
)
