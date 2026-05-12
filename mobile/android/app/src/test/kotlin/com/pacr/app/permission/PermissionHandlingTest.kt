package com.pacr.app.permission

import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.Vo2MaxRecord
import androidx.health.connect.client.response.ReadRecordsResponse
import com.pacr.app.data.health.HealthConnectManager
import com.pacr.app.data.health.HealthConnectRepository
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant
import java.time.LocalDate

class PermissionHandlingTest {

    private lateinit var manager: HealthConnectManager
    private lateinit var client: androidx.health.connect.client.HealthConnectClient
    private lateinit var repository: HealthConnectRepository

    @Before
    fun setUp() {
        client = mockk(relaxed = true)
        manager = mockk()
        every { manager.getClient() } returns client
        every { client.permissionController } returns mockk {
            coEvery { getGrantedPermissions() } returns emptySet()
        }
        coEvery { manager.getGrantedPermissions() } returns emptySet()
        repository = HealthConnectRepository(manager)
    }

    @Test
    fun `HRV read skipped when READ_HEART_RATE_VARIABILITY denied`() = runTest {
        coEvery { manager.getGrantedPermissions() } returns emptySet()

        val result = repository.getHRV(Instant.now(), Instant.now())

        assertTrue(result.isEmpty())
        coVerify(exactly = 0) { client.readRecords(any<androidx.health.connect.client.request.ReadRecordsRequest<HeartRateVariabilityRmssdRecord>>()) }
    }

    @Test
    fun `sleep read skipped when READ_SLEEP denied`() = runTest {
        coEvery { manager.getGrantedPermissions() } returns emptySet()

        val result = repository.getSleepData(LocalDate.now())

        assertNull(result)
        coVerify(exactly = 0) { client.readRecords(any<androidx.health.connect.client.request.ReadRecordsRequest<SleepSessionRecord>>()) }
    }

    @Test
    fun `resting HR read skipped when READ_RESTING_HEART_RATE denied`() = runTest {
        coEvery { manager.getGrantedPermissions() } returns emptySet()

        val result = repository.getRestingHeartRate(LocalDate.now())

        assertNull(result)
        coVerify(exactly = 0) { client.readRecords(any<androidx.health.connect.client.request.ReadRecordsRequest<RestingHeartRateRecord>>()) }
    }

    @Test
    fun `SpO2 read skipped when READ_OXYGEN_SATURATION denied`() = runTest {
        coEvery { manager.getGrantedPermissions() } returns emptySet()

        val result = repository.getSpO2(Instant.now(), Instant.now())

        assertTrue(result.isEmpty())
        coVerify(exactly = 0) { client.readRecords(any<androidx.health.connect.client.request.ReadRecordsRequest<OxygenSaturationRecord>>()) }
    }

    @Test
    fun `VO2Max read skipped when READ_VO2_MAX denied`() = runTest {
        coEvery { manager.getGrantedPermissions() } returns emptySet()

        val result = repository.getVO2Max()

        assertNull(result)
        coVerify(exactly = 0) { client.readRecords(any<androidx.health.connect.client.request.ReadRecordsRequest<Vo2MaxRecord>>()) }
    }

    @Test
    fun `HR samples read skipped when READ_HEART_RATE denied`() = runTest {
        coEvery { manager.getGrantedPermissions() } returns emptySet()

        val result = repository.getHeartRateSamples(Instant.now(), Instant.now())

        assertTrue(result.isEmpty())
        coVerify(exactly = 0) { client.readRecords(any<androidx.health.connect.client.request.ReadRecordsRequest<HeartRateRecord>>()) }
    }

    @Test
    fun `partial grant — HRV works but SpO2 excluded`() = runTest {
        val partialGrant = setOf(
            HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
        )
        coEvery { manager.getGrantedPermissions() } returns partialGrant

        coEvery { client.readRecords(any<androidx.health.connect.client.request.ReadRecordsRequest<HeartRateVariabilityRmssdRecord>>()) } returns
            ReadRecordsResponse(emptyList(), pageToken = null)

        repository.getHRV(Instant.now(), Instant.now()) // Should attempt read
        val spo2 = repository.getSpO2(Instant.now(), Instant.now()) // Should skip

        coVerify(exactly = 1) { client.readRecords(any<androidx.health.connect.client.request.ReadRecordsRequest<HeartRateVariabilityRmssdRecord>>()) }
        coVerify(exactly = 0) { client.readRecords(any<androidx.health.connect.client.request.ReadRecordsRequest<OxygenSaturationRecord>>()) }
        assertTrue(spo2.isEmpty())
    }
}
