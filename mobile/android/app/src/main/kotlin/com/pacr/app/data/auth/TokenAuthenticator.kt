package com.pacr.app.data.auth

import com.pacr.app.data.auth.model.RefreshRequest
import com.pacr.app.data.datastore.TokenDataStore
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TokenAuthenticator @Inject constructor(
    private val tokenDataStore: TokenDataStore,
    private val authApiClient: AuthApiClient,
) : Authenticator {

    private val mutex = Mutex()

    override fun authenticate(route: Route?, response: Response): Request? {
        if (response.priorResponse?.code == 401) return null

        return runBlocking {
            mutex.withLock {
                val refreshToken = tokenDataStore.getRefreshToken() ?: return@runBlocking null
                val refreshResponse = try {
                    authApiClient.api.refresh(RefreshRequest(refreshToken))
                } catch (e: Exception) {
                    null
                }

                val body = refreshResponse?.body()
                if (refreshResponse?.isSuccessful == true && body != null && body.data != null) {
                    tokenDataStore.saveTokens(
                        accessToken = body.data.accessToken,
                        refreshToken = body.data.refreshToken,
                        userId = body.data.user.id,
                    )
                    response.request.newBuilder()
                        .header("Authorization", "Bearer ${body.data.accessToken}")
                        .build()
                } else {
                    tokenDataStore.clearTokens()
                    null
                }
            }
        }
    }
}
