package com.pacr.app.ui.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pacr.app.data.api.ReadinessApiClient
import com.pacr.app.data.api.SessionApiClient
import com.pacr.app.data.datastore.TokenDataStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class TodayViewModel @Inject constructor(
    private val sessionApiClient: SessionApiClient,
    private val readinessApiClient: ReadinessApiClient,
    private val tokenDataStore: TokenDataStore,
) : ViewModel() {

    private val _uiState = MutableStateFlow<TodayUiState>(TodayUiState.Loading)
    val uiState: StateFlow<TodayUiState> = _uiState

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.value = TodayUiState.Loading
            val userId = tokenDataStore.getUserId() ?: ""

            val sessionDeferred = async { sessionApiClient.getTodaySession() }
            val readinessDeferred = async { readinessApiClient.getTodayReadiness(userId) }

            val session = sessionDeferred.await()
            val readiness = readinessDeferred.await()

            val score = readiness?.score ?: session?.readinessScore ?: 0.0

            _uiState.value = when {
                session == null -> TodayUiState.Error("Could not load today's session")
                session.sessionType == "rest" -> TodayUiState.RestDay(score)
                else -> TodayUiState.TrainingDay(session, score)
            }
        }
    }

    fun completeSession(sessionId: String, onDone: () -> Unit) {
        viewModelScope.launch {
            sessionApiClient.completeSession(sessionId, runId = null)
            onDone()
            load()
        }
    }

    fun skipSession(sessionId: String) {
        viewModelScope.launch {
            sessionApiClient.skipSession(sessionId)
            load()
        }
    }
}
