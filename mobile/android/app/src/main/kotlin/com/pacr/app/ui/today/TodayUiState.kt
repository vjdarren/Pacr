package com.pacr.app.ui.today

import com.pacr.app.data.api.model.TodaySessionData

sealed class TodayUiState {
    object Loading : TodayUiState()
    data class RestDay(val readinessScore: Double) : TodayUiState()
    data class TrainingDay(
        val session: TodaySessionData,
        val readinessScore: Double,
    ) : TodayUiState()
    data class Error(val message: String) : TodayUiState()
}
