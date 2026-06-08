package com.pacr.app.data.auth.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
)

@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
    @SerialName("display_name") val displayName: String,
)

@Serializable
data class RefreshRequest(
    @SerialName("refresh_token") val refreshToken: String,
)

@Serializable
data class LogoutRequest(
    @SerialName("refresh_token") val refreshToken: String,
)

@Serializable
data class AuthResponse(
    val success: Boolean,
    val data: AuthData? = null,
    val error: AuthError? = null,
)

@Serializable
data class AuthData(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    val user: AuthUser,
)

@Serializable
data class AuthUser(
    val id: String,
    val email: String,
    @SerialName("display_name") val displayName: String? = null,
)

@Serializable
data class AuthError(
    val code: String,
    val message: String,
)
