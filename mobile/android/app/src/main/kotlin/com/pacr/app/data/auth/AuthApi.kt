package com.pacr.app.data.auth

import com.pacr.app.data.auth.model.AuthResponse
import com.pacr.app.data.auth.model.LoginRequest
import com.pacr.app.data.auth.model.LogoutRequest
import com.pacr.app.data.auth.model.RefreshRequest
import com.pacr.app.data.auth.model.RegisterRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

interface AuthApi {
    @POST("api/v1/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("api/v1/auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>

    @POST("api/v1/auth/refresh")
    suspend fun refresh(@Body request: RefreshRequest): Response<AuthResponse>

    @POST("api/v1/auth/logout")
    suspend fun logout(
        @Header("Authorization") bearerToken: String,
        @Body request: LogoutRequest,
    ): Response<Unit>
}
