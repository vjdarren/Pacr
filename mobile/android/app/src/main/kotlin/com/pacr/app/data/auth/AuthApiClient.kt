package com.pacr.app.data.auth

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.pacr.app.BuildConfig
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

@Singleton
class AuthApiClient @Inject constructor(
    @Named("auth") okHttpClient: OkHttpClient,
) {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    val api: AuthApi = Retrofit.Builder()
        .baseUrl(BuildConfig.AUTH_SERVICE_BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(AuthApi::class.java)
}
