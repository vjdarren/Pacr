package com.pacr.app.data.sync

import com.pacr.app.data.api.model.MetricPayload
import com.pacr.app.domain.model.HealthMetric
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

object MetricMapper {
    private val formatter = DateTimeFormatter.ISO_INSTANT.withZone(ZoneOffset.UTC)

    fun toPayload(metric: HealthMetric): MetricPayload = MetricPayload(
        metricType = metric.metricType.apiKey,
        value = metric.value,
        recordedAt = formatter.format(metric.recordedAt),
        source = metric.source,
    )
}
