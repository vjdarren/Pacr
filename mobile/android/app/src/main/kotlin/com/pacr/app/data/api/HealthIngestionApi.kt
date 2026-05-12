package com.pacr.app.data.api

import com.pacr.app.data.api.model.SyncRequest
import com.pacr.app.data.api.model.SyncResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

interface HealthIngestionApi {
    @POST("api/v1/health/sync")
    suspend fun syncMetrics(
        @Header("Authorization") bearerToken: String,
        @Body request: SyncRequest,
    ): Response<SyncResponse>

    @POST("api/v1/health/sync/historical")
    suspend fun syncHistorical(
        @Header("Authorization") bearerToken: String,
        @Body request: SyncRequest,
    ): Response<SyncResponse>
}
