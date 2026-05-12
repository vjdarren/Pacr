package com.pacr.app.health

import com.pacr.app.data.sync.MetricMapper
import com.pacr.app.domain.model.HealthMetric
import com.pacr.app.domain.model.MetricType
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

class MetricMappingTest {

    private val fixedTime = Instant.parse("2024-01-15T08:00:00Z")

    @Test
    fun `HRV_RMSSD maps to correct api key`() {
        val metric = HealthMetric(MetricType.HRV_RMSSD, 45.2, fixedTime)
        val payload = MetricMapper.toPayload(metric)
        assertEquals("hrv_rmssd", payload.metricType)
        assertEquals(45.2, payload.value, 0.001)
        assertEquals("health_connect", payload.source)
    }

    @Test
    fun `RESTING_HR maps to correct api key`() {
        val metric = HealthMetric(MetricType.RESTING_HR, 58.0, fixedTime)
        val payload = MetricMapper.toPayload(metric)
        assertEquals("resting_hr", payload.metricType)
    }

    @Test
    fun `SLEEP_QUALITY maps to correct api key`() {
        val metric = HealthMetric(MetricType.SLEEP_QUALITY, 72.0, fixedTime)
        val payload = MetricMapper.toPayload(metric)
        assertEquals("sleep_quality", payload.metricType)
    }

    @Test
    fun `SLEEP_DURATION_MIN maps to correct api key`() {
        val metric = HealthMetric(MetricType.SLEEP_DURATION_MIN, 450.0, fixedTime)
        val payload = MetricMapper.toPayload(metric)
        assertEquals("sleep_duration_min", payload.metricType)
    }

    @Test
    fun `DEEP_SLEEP_MIN maps to correct api key`() {
        val metric = HealthMetric(MetricType.DEEP_SLEEP_MIN, 90.0, fixedTime)
        val payload = MetricMapper.toPayload(metric)
        assertEquals("deep_sleep_min", payload.metricType)
    }

    @Test
    fun `REM_SLEEP_MIN maps to correct api key`() {
        val metric = HealthMetric(MetricType.REM_SLEEP_MIN, 85.0, fixedTime)
        val payload = MetricMapper.toPayload(metric)
        assertEquals("rem_sleep_min", payload.metricType)
    }

    @Test
    fun `SPO2 maps to correct api key`() {
        val metric = HealthMetric(MetricType.SPO2, 97.5, fixedTime)
        val payload = MetricMapper.toPayload(metric)
        assertEquals("spo2", payload.metricType)
    }

    @Test
    fun `VO2MAX maps to correct api key`() {
        val metric = HealthMetric(MetricType.VO2MAX, 52.3, fixedTime)
        val payload = MetricMapper.toPayload(metric)
        assertEquals("vo2max", payload.metricType)
    }

    @Test
    fun `recorded_at is formatted as ISO 8601`() {
        val metric = HealthMetric(MetricType.HRV_RMSSD, 40.0, fixedTime)
        val payload = MetricMapper.toPayload(metric)
        assertEquals("2024-01-15T08:00:00Z", payload.recordedAt)
    }

    @Test
    fun `all metric types have unique api keys`() {
        val keys = MetricType.entries.map { it.apiKey }
        assertEquals("Duplicate apiKey detected", keys.size, keys.toSet().size)
    }
}
