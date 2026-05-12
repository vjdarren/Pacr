package com.pacr.app.sync

import com.pacr.app.data.api.HealthIngestionApiClient
import com.pacr.app.data.api.model.SyncRequest
import com.pacr.app.data.health.HealthConnectRepository
import com.pacr.app.data.sync.ForegroundSyncManager
import com.pacr.app.domain.model.HrvReading
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant
import java.time.LocalDate

class ForegroundSyncManagerTest {

    private lateinit var repository: HealthConnectRepository
    private lateinit var apiClient: HealthIngestionApiClient
    private lateinit var syncManager: ForegroundSyncManager

    @Before
    fun setUp() {
        repository = mockk(relaxed = true)
        apiClient = mockk(relaxed = true)
        syncManager = ForegroundSyncManager(repository, apiClient)

        // Default: all reads return empty
        coEvery { repository.getHRV(any(), any()) } returns emptyList()
        coEvery { repository.getRestingHeartRate(any()) } returns null
        coEvery { repository.getSleepData(any()) } returns null
        coEvery { repository.getSpO2(any(), any()) } returns emptyList()
        coEvery { repository.getVO2Max() } returns null
        coEvery { apiClient.sync(any(), any()) } returns true
    }

    @Test
    fun `sync does not call api when no metrics available`() = runTest {
        syncManager.sync("test-token")
        coVerify(exactly = 0) { apiClient.sync(any(), any()) }
    }

    @Test
    fun `sync sends HRV metrics to api`() = runTest {
        val hrv = HrvReading(rmssdMs = 45.2, recordedAt = Instant.parse("2024-01-15T06:00:00Z"))
        coEvery { repository.getHRV(any(), any()) } returns listOf(hrv)

        val requestSlot = slot<SyncRequest>()
        coEvery { apiClient.sync(any(), capture(requestSlot)) } returns true

        syncManager.sync("test-token")

        coVerify(exactly = 1) { apiClient.sync("test-token", any()) }
        assertEquals(1, requestSlot.captured.metrics.size)
        assertEquals("hrv_rmssd", requestSlot.captured.metrics[0].metricType)
        assertEquals(45.2, requestSlot.captured.metrics[0].value, 0.001)
    }

    @Test
    fun `sync includes resting HR when available`() = runTest {
        coEvery { repository.getRestingHeartRate(any()) } returns 58L

        val requestSlot = slot<SyncRequest>()
        coEvery { apiClient.sync(any(), capture(requestSlot)) } returns true

        syncManager.sync("test-token")

        val rhrPayload = requestSlot.captured.metrics.find { it.metricType == "resting_hr" }
        assertTrue("Expected resting_hr metric", rhrPayload != null)
        assertEquals(58.0, rhrPayload!!.value, 0.001)
    }

    @Test
    fun `sync includes vo2max when available`() = runTest {
        coEvery { repository.getVO2Max() } returns 52.3

        val requestSlot = slot<SyncRequest>()
        coEvery { apiClient.sync(any(), capture(requestSlot)) } returns true

        syncManager.sync("test-token")

        val vo2Payload = requestSlot.captured.metrics.find { it.metricType == "vo2max" }
        assertTrue("Expected vo2max metric", vo2Payload != null)
    }

    @Test
    fun `sync sends bearer token`() = runTest {
        coEvery { repository.getVO2Max() } returns 50.0

        syncManager.sync("my-access-token")

        coVerify { apiClient.sync("my-access-token", any()) }
    }

    @Test
    fun `sync completes without throwing when api returns false`() = runTest {
        coEvery { repository.getVO2Max() } returns 50.0
        coEvery { apiClient.sync(any(), any()) } returns false

        // Should not throw
        syncManager.sync("test-token")
    }
}
