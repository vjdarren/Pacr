package com.pacr.app.data.api

import com.pacr.app.data.api.model.CoachHistoryResponse
import com.pacr.app.data.api.model.CoachMessageRequest
import com.pacr.app.data.api.model.CoachMessageResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

interface CoachApi {
    @POST("api/v1/coach/message")
    suspend fun sendMessage(
        @Header("Authorization") bearerToken: String,
        @Body request: CoachMessageRequest,
    ): Response<CoachMessageResponse>

    @GET("api/v1/coach/history")
    suspend fun getHistory(
        @Header("Authorization") bearerToken: String,
    ): Response<CoachHistoryResponse>
}
