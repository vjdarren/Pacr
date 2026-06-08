package com.pacr.app.data.api

import android.util.Log
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.pacr.app.BuildConfig
import com.pacr.app.data.api.model.CompleteRunRequest
import com.pacr.app.data.api.model.GpsSample
import com.pacr.app.data.api.model.LocationBatchRequest
import com.pacr.app.data.api.model.RunRecord
import com.pacr.app.data.api.model.StartRunData
import com.pacr.app.data.api.model.StartRunRequest
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

private const val TAG = "RunTrackerApiClient"

@Singleton
class RunTrackerApiClient @Inject constructor(
    @Named("authenticated") okHttpClient: OkHttpClient,
) {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    private val api: RunTrackerApi = Retrofit.Builder()
        .baseUrl(BuildConfig.RUN_TRACKER_BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(RunTrackerApi::class.java)

    suspend fun startRun(token: String, sessionId: String?): StartRunData? {
        return runCatching {
            val response = api.startRun("Bearer $token", StartRunRequest(sessionId))
            if (response.isSuccessful) response.body()?.data
            else { Log.w(TAG, "startRun HTTP ${response.code()}"); null }
        }.getOrElse { e -> Log.e(TAG, "startRun error", e); null }
    }

    suspend fun sendBatch(token: String, runId: String, samples: List<GpsSample>): Boolean {
        if (samples.isEmpty()) return true
        return runCatching {
            val response = api.sendLocationBatch("Bearer $token", runId, LocationBatchRequest(samples))
            response.isSuccessful
        }.getOrElse { e -> Log.e(TAG, "sendBatch error", e); false }
    }

    suspend fun completeRun(
        token: String,
        runId: String,
        distanceKm: Double,
        durationSec: Int,
        avgPaceSecKm: Double,
        avgHrBpm: Int? = null,
        maxHrBpm: Int? = null,
        elevationGainM: Double? = null,
    ): RunRecord? {
        return runCatching {
            val response = api.completeRun(
                "Bearer $token", runId,
                CompleteRunRequest(distanceKm, durationSec, avgPaceSecKm, avgHrBpm, maxHrBpm, elevationGainM)
            )
            if (response.isSuccessful) response.body()?.data
            else { Log.w(TAG, "completeRun HTTP ${response.code()}"); null }
        }.getOrElse { e -> Log.e(TAG, "completeRun error", e); null }
    }

    suspend fun getRun(token: String, runId: String): RunRecord? {
        return runCatching {
            val response = api.getRun("Bearer $token", runId)
            if (response.isSuccessful) response.body()?.data
            else { Log.w(TAG, "getRun HTTP ${response.code()}"); null }
        }.getOrElse { e -> Log.e(TAG, "getRun error", e); null }
    }
}
