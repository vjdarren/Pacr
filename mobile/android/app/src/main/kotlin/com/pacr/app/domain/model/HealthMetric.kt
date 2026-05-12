package com.pacr.app.domain.model

import java.time.Instant

data class HealthMetric(
    val metricType: MetricType,
    val value: Double,
    val recordedAt: Instant,
    val source: String = "health_connect",
)
