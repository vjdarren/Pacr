package com.pacr.app.data.api.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class SyncRequest(
    val metrics: List<MetricPayload>,
)

@Serializable
data class MetricPayload(
    @SerialName("metric_type") val metricType: String,
    val value: Double,
    @SerialName("recorded_at") val recordedAt: String,
    val source: String = "health_connect",
)

@Serializable
data class SyncResponse(
    val success: Boolean,
    val data: SyncResponseData? = null,
)

@Serializable
data class SyncResponseData(
    val accepted: Int = 0,
)
