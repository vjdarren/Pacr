package com.pacr.app.data.api

import android.util.Log
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.pacr.app.BuildConfig
import com.pacr.app.data.api.model.CoachHistoryItem
import com.pacr.app.data.api.model.CoachMessageRequest
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

private const val TAG = "CoachApiClient"

@Singleton
class CoachApiClient @Inject constructor(
    @Named("authenticated") okHttpClient: OkHttpClient,
) {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    private val api: CoachApi = Retrofit.Builder()
        .baseUrl(BuildConfig.COACH_SERVICE_BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(CoachApi::class.java)

    data class SendResult(val reply: String, val remainingMessages: Int?)

    suspend fun sendMessage(token: String, message: String): SendResult? {
        return runCatching {
            val response = api.sendMessage("Bearer $token", CoachMessageRequest(message))
            if (response.isSuccessful) {
                val body = response.body() ?: return@runCatching null
                val reply = body.reply ?: return@runCatching null
                SendResult(reply, body.remainingMessages)
            } else {
                Log.w(TAG, "sendMessage HTTP ${response.code()}")
                null
            }
        }.getOrElse { e -> Log.e(TAG, "sendMessage error", e); null }
    }

    suspend fun getHistory(token: String): List<CoachHistoryItem> {
        return runCatching {
            val response = api.getHistory("Bearer $token")
            if (response.isSuccessful) response.body()?.messages ?: emptyList()
            else { Log.w(TAG, "getHistory HTTP ${response.code()}"); emptyList() }
        }.getOrElse { e -> Log.e(TAG, "getHistory error", e); emptyList() }
    }
}
