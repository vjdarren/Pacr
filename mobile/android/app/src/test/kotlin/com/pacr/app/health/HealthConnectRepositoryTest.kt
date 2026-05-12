package com.pacr.app.health

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.Vo2MaxRecord
import androidx.health.connect.client.response.ReadRecordsResponse
import androidx.health.connect.client.units.Percentage
import com.pacr.app.data.health.HealthConnectManager
import com.pacr.app.data.health.HealthConnectRepository
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

class HealthConnectRepositoryTest {

    private lateinit var manager: HealthConnectManager
    private lateinit var client: HealthConnectClient
    private lateinit var permissionController: PermissionController
    private lateinit var repository: HealthConnectRepository

    private val allPermissions = HealthConnectManager.PERMISSIONS

    @Before
    fun setUp() {
        client = mockk(relaxed = true)
        permissionController = mockk()
        manager = mockk()
        every { manager.getClient() } returns client
        every { client.permissionController } returns permissionController
        coEvery { manager.getGrantedPermissions() } returns allPermissions
        repository = HealthConnectRepository(manager)
    }

    // ---- HRV ----

    @Test
    fun `getHRV returns mapped readings`() = runTest {
        val record = mockk<HeartRateVariabilityRmssdRecord> {
            every { heartRateVariabilityMillis } returns 42.5
            every { time } returns Instant.parse("2024-01-15T06:00:00Z")
        }
        coEvery { client.readRecords(any<androidx.health.connect.client.request.ReadRecordsRequest<HeartRateVariabilityRmssdRecord>>()) } returns
            ReadRecordsResponse(listOf(record), pageToken = null)

        val result = repository.getHRV(
            Instant.parse("2024-01-15T00:00:00Z"),
            Instant.parse("2024-01-15T23:59:59Z"),
        )

        assertEquals(1, result.size)
        assertEquals(42.5, result[0].rmssdMs, 0.001)
    }

    @Test
    fun `getHRV returns empty list when permission denied`() = runTest {
        coEvery { manager.getGrantedPermissions() } returns emptySet()

        val result = repository.getHRV(Instant.now(), Instant.now())
        assertTrue(result.isEmpty())
    }

    @Test
    fun `getHRV returns empty list when no data`() = runTest {
        coEvery { client.readRecords(any<androidx.health.connect.client.request.ReadRecordsRequest<HeartRateVariabilityRmssdRecord>>()) } returns
            ReadRecordsResponse(emptyList(), pageToken = null)

        val result = repository.getHRV(Instant.now(), Instant.now())
        assertTrue(result.isEmpty())
    }

    // ---- Resting HR ----

    @Test
    fun `getRestingHeartRate returns value for date`() = runTest {
        val record = mockk<RestingHeartRateRecord> {
            every { beatsPerMinute } returns 58L
        }
        coEvery { client.readRecords(any<androidx.health.connect.client.request.ReadRecordsRequest<RestingHeartRateRecord>>()) } returns
            ReadRecordsResponse(listOf(record), pageToken = null)

        val result = repository.getRestingHeartRate(LocalDate.of(2024, 1, 15))
        assertEquals(58L, result)
    }

    @Test
    fun `getRestingHeartRate returns null when permission denied`() = runTest {
        coEvery { manager.getGrantedPermissions() } returns emptySet()

        assertNull(repository.getRestingHeartRate(LocalDate.now()))
    }

    @Test
    fun `getRestingHeartRate returns null when no data`() = runTest {
        coEvery { client.readRecords(any<androidx.health.connect.client.request.ReadRecordsRequest<RestingHeartRateRecord>>()) } returns
            ReadRecordsResponse(emptyList(), pageToken = null)

        assertNull(repository.getRestingHeartRate(LocalDate.now()))
    }

    // ---- SpO2 ----

    @Test
    fun `getSpO2 returns mapped readings`() = runTest {
        val fixedTime = Instant.parse("2024-01-15T08:00:00Z")
        val record = mockk<OxygenSaturationRecord> {
            every { percentage } returns Percentage(97.5)
            every { time } returns fixedTime
        }
        coEvery { client.readRecords(any<androidx.health.connect.client.request.ReadRecordsRequest<OxygenSaturationRecord>>()) } returns
            ReadRecordsResponse(listOf(record), pageToken = null)

        val result = repository.getSpO2(Instant.now(), Instant.now())
        assertEquals(1, result.size)
        assertEquals(97.5, result[0].second, 0.001)
    }

    @Test
    fun `getSpO2 returns empty list when permission denied`() = runTest {
        coEvery { manager.getGrantedPermissions() } returns emptySet()

        assertTrue(repository.getSpO2(Instant.now(), Instant.now()).isEmpty())
    }

    // ---- VO2Max ----

    @Test
    fun `getVO2Max returns latest value`() = runTest {
        val record = mockk<Vo2MaxRecord> {
            every { vo2MillilitersPerMinuteKilogram } returns 52.3
        }
        coEvery { client.readRecords(any<androidx.health.connect.client.request.ReadRecordsRequest<Vo2MaxRecord>>()) } returns
            ReadRecordsResponse(listOf(record), pageToken = null)

        val result = repository.getVO2Max()
        assertEquals(52.3, result!!, 0.001)
    }

    @Test
    fun `getVO2Max returns null when no records`() = runTest {
        coEvery { client.readRecords(any<androidx.health.connect.client.request.ReadRecordsRequest<Vo2MaxRecord>>()) } returns
            ReadRecordsResponse(emptyList(), pageToken = null)

        assertNull(repository.getVO2Max())
    }

    // ---- Sleep ----

    @Test
    fun `getSleepData returns null when permission denied`() = runTest {
        coEvery { manager.getGrantedPermissions() } returns emptySet()

        assertNull(repository.getSleepData(LocalDate.now()))
    }

    @Test
    fun `getSleepData returns null when no sessions`() = runTest {
        coEvery { client.readRecords(any<androidx.health.connect.client.request.ReadRecordsRequest<SleepSessionRecord>>()) } returns
            ReadRecordsResponse(emptyList(), pageToken = null)

        assertNull(repository.getSleepData(LocalDate.now()))
    }
}
