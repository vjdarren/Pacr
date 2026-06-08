package com.pacr.app.data.api

import com.pacr.app.data.api.model.CompleteRunRequest
import com.pacr.app.data.api.model.LocationBatchRequest
import com.pacr.app.data.api.model.RunRecordResponse
import com.pacr.app.data.api.model.StartRunRequest
import com.pacr.app.data.api.model.StartRunResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

interface RunTrackerApi {
    @POST("api/v1/runs/start")
    suspend fun startRun(
        @Body request: StartRunRequest,
    ): Response<StartRunResponse>

    @POST("api/v1/runs/{id}/location-batch")
    suspend fun sendLocationBatch(
        @Path("id") runId: String,
        @Body request: LocationBatchRequest,
    ): Response<Unit>

    @PATCH("api/v1/runs/{id}/complete")
    suspend fun completeRun(
        @Path("id") runId: String,
        @Body request: CompleteRunRequest,
    ): Response<RunRecordResponse>

    @GET("api/v1/runs/{id}")
    suspend fun getRun(
        @Path("id") runId: String,
    ): Response<RunRecordResponse>
}
