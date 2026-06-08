package com.pacr.app.data.api

import com.pacr.app.data.api.model.ReadinessResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Path

interface ReadinessApi {
    @GET("api/v1/readiness/today/{userId}")
    suspend fun getTodayReadiness(
        @Header("Authorization") bearerToken: String,
        @Path("userId") userId: String,
    ): Response<ReadinessResponse>
}
