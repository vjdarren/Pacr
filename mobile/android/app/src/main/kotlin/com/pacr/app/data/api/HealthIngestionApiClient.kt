package com.pacr.app.data.api

import android.util.Log
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.pacr.app.BuildConfig
import com.pacr.app.data.api.model.SyncRequest
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

private const val TAG = "HealthIngestionApiClient"

@Singleton
class HealthIngestionApiClient @Inject constructor(
    @Named("authenticated") okHttpClient: OkHttpClient,
) {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val api: HealthIngestionApi = Retrofit.Builder()
        .baseUrl(BuildConfig.HEALTH_INGESTION_BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(HealthIngestionApi::class.java)

    suspend fun sync(token: String, request: SyncRequest): Boolean {
        return runCatching {
            val response = api.syncMetrics("Bearer $token", request)
            if (!response.isSuccessful) {
                Log.w(TAG, "Sync failed: HTTP ${response.code()}")
            }
            response.isSuccessful
        }.getOrElse { e ->
            Log.e(TAG, "Sync error", e)
            false
        }
    }

    suspend fun syncHistorical(token: String, request: SyncRequest): Boolean {
        return runCatching {
            val response = api.syncHistorical("Bearer $token", request)
            if (!response.isSuccessful) {
                Log.w(TAG, "Historical sync failed: HTTP ${response.code()}")
            }
            response.isSuccessful
        }.getOrElse { e ->
            Log.e(TAG, "Historical sync error", e)
            false
        }
    }
}
