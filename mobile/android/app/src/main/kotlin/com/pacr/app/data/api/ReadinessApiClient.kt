package com.pacr.app.data.api

import android.util.Log
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.pacr.app.BuildConfig
import com.pacr.app.data.api.model.ReadinessData
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

private const val TAG = "ReadinessApiClient"

@Singleton
class ReadinessApiClient @Inject constructor(
    @Named("authenticated") okHttpClient: OkHttpClient,
) {

    private val json = Json { ignoreUnknownKeys = true }

    private val api: ReadinessApi = Retrofit.Builder()
        .baseUrl(BuildConfig.READINESS_SERVICE_BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(ReadinessApi::class.java)

    suspend fun getTodayReadiness(token: String, userId: String): ReadinessData? {
        return runCatching {
            val response = api.getTodayReadiness("Bearer $token", userId)
            if (response.isSuccessful) response.body()?.data
            else { Log.w(TAG, "getTodayReadiness HTTP ${response.code()}"); null }
        }.getOrElse { e -> Log.e(TAG, "getTodayReadiness error", e); null }
    }
}
