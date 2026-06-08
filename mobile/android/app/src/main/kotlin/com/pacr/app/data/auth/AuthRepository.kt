package com.pacr.app.data.auth

import android.util.Log
import com.pacr.app.data.auth.model.LoginRequest
import com.pacr.app.data.auth.model.LogoutRequest
import com.pacr.app.data.auth.model.RegisterRequest
import com.pacr.app.data.datastore.TokenDataStore
import javax.inject.Inject
import javax.inject.Singleton

private const val TAG = "AuthRepository"

sealed class AuthResult {
    data object Success : AuthResult()
    data class Error(val message: String) : AuthResult()
}

@Singleton
class AuthRepository @Inject constructor(
    private val apiClient: AuthApiClient,
    private val tokenDataStore: TokenDataStore,
) {

    suspend fun login(email: String, password: String): AuthResult {
        return runCatching {
            val response = apiClient.api.login(LoginRequest(email, password))
            if (response.isSuccessful) {
                val data = response.body()?.data ?: return AuthResult.Error("Empty response")
                tokenDataStore.saveTokens(
                    accessToken = data.accessToken,
                    refreshToken = data.refreshToken,
                    userId = data.user.id,
                )
                AuthResult.Success
            } else {
                val code = response.code()
                val msg = when (code) {
                    401 -> "Invalid email or password"
                    429 -> "Too many attempts. Please wait and try again."
                    else -> "Login failed ($code)"
                }
                AuthResult.Error(msg)
            }
        }.getOrElse { e ->
            Log.e(TAG, "Login error", e)
            AuthResult.Error("Network error. Please check your connection.")
        }
    }

    suspend fun register(email: String, password: String, displayName: String): AuthResult {
        return runCatching {
            val response = apiClient.api.register(RegisterRequest(email, password, displayName))
            if (response.isSuccessful) {
                val data = response.body()?.data ?: return AuthResult.Error("Empty response")
                tokenDataStore.saveTokens(
                    accessToken = data.accessToken,
                    refreshToken = data.refreshToken,
                    userId = data.user.id,
                )
                AuthResult.Success
            } else {
                val code = response.code()
                val msg = when (code) {
                    409 -> "An account with this email already exists"
                    400 -> "Please check your details and try again"
                    else -> "Registration failed ($code)"
                }
                AuthResult.Error(msg)
            }
        }.getOrElse { e ->
            Log.e(TAG, "Register error", e)
            AuthResult.Error("Network error. Please check your connection.")
        }
    }

    suspend fun logout() {
        runCatching {
            val token = tokenDataStore.getAccessToken() ?: return
            val refreshToken = tokenDataStore.getRefreshToken() ?: return
            apiClient.api.logout("Bearer $token", LogoutRequest(refreshToken))
        }
        tokenDataStore.clearTokens()
    }
}
