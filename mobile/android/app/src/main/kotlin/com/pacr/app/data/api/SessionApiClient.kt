package com.pacr.app.data.api

import android.util.Log
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.pacr.app.BuildConfig
import com.pacr.app.data.api.model.CompleteSessionRequest
import com.pacr.app.data.api.model.TodaySessionData
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

private const val TAG = "SessionApiClient"

@Singleton
class SessionApiClient @Inject constructor(
    @Named("authenticated") okHttpClient: OkHttpClient,
    json: Json,
) {

    private val api: SessionApi = Retrofit.Builder()
        .baseUrl(BuildConfig.SESSION_SERVICE_BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(SessionApi::class.java)

    suspend fun getTodaySession(): TodaySessionData? {
        return runCatching {
            val response = api.getTodaySession()
            if (response.isSuccessful) response.body()?.data
            else { Log.w(TAG, "getTodaySession HTTP ${response.code()}"); null }
        }.getOrElse { e -> Log.e(TAG, "getTodaySession error", e); null }
    }

    suspend fun completeSession(sessionId: String, runId: String? = null): Boolean {
        return runCatching {
            val response = api.completeSession(sessionId, CompleteSessionRequest(runId))
            response.isSuccessful
        }.getOrElse { e -> Log.e(TAG, "completeSession error", e); false }
    }

    suspend fun skipSession(sessionId: String): Boolean {
        return runCatching {
            val response = api.skipSession(sessionId)
            response.isSuccessful
        }.getOrElse { e -> Log.e(TAG, "skipSession error", e); false }
    }
}
