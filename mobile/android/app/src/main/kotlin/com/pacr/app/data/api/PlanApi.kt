package com.pacr.app.data.api

import com.pacr.app.data.api.model.PlanGenerateRequest
import com.pacr.app.data.api.model.PlanGenerateResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

interface PlanApi {
    @POST("api/v1/plans/generate")
    suspend fun generatePlan(
        @Header("Authorization") bearerToken: String,
        @Body request: PlanGenerateRequest,
    ): Response<PlanGenerateResponse>
}
