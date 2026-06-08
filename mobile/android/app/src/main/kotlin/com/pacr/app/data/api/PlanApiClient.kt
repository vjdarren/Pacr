package com.pacr.app.data.api

import android.util.Log
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.pacr.app.BuildConfig
import com.pacr.app.data.api.model.PlanGenerateRequest
import com.pacr.app.data.api.model.RunnerProfilePayload
import com.pacr.app.ui.onboarding.OnboardingData
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

private const val TAG = "PlanApiClient"

@Singleton
class PlanApiClient @Inject constructor(
    @Named("authenticated") okHttpClient: OkHttpClient,
    json: Json,
) {

    private val api: PlanApi = Retrofit.Builder()
        .baseUrl(BuildConfig.PLAN_SERVICE_BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(PlanApi::class.java)

    suspend fun generatePlan(data: OnboardingData): Boolean {
        val targetDate = data.targetMonth?.atEndOfMonth()?.format(DateTimeFormatter.ISO_LOCAL_DATE)
            ?: return false

        val request = PlanGenerateRequest(
            runnerProfile = RunnerProfilePayload(
                goal = data.goalDistance?.apiKey ?: return false,
                raceName = data.raceName.ifBlank { null },
                targetDate = targetDate,
                weeklyDays = data.weeklyDays,
                maxSessionMinutes = data.maxSessionMinutes,
                fitnessLevel = data.fitnessLevel?.apiKey ?: return false,
            )
        )
        return runCatching {
            val response = api.generatePlan(request)
            if (!response.isSuccessful) Log.w(TAG, "Plan generation HTTP ${response.code()}")
            response.isSuccessful
        }.getOrElse { e ->
            Log.e(TAG, "Plan generation error", e)
            false
        }
    }
}
