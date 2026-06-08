package com.pacr.app.data.api

import com.pacr.app.data.api.model.CompleteSessionRequest
import com.pacr.app.data.api.model.SessionActionResponse
import com.pacr.app.data.api.model.TodaySessionResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.Path

interface SessionApi {
    @GET("api/v1/sessions/today")
    suspend fun getTodaySession(): Response<TodaySessionResponse>

    @PATCH("api/v1/sessions/{id}/complete")
    suspend fun completeSession(
        @Path("id") sessionId: String,
        @Body request: CompleteSessionRequest,
    ): Response<SessionActionResponse>

    @PATCH("api/v1/sessions/{id}/skip")
    suspend fun skipSession(
        @Path("id") sessionId: String,
    ): Response<SessionActionResponse>
}
