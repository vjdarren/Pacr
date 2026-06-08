package com.pacr.app.ui.coach

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pacr.app.data.api.CoachApiClient
import com.pacr.app.data.api.model.CoachHistoryItem
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ChatMessage(val role: String, val content: String)

data class CoachUiState(
    val messages: List<ChatMessage> = emptyList(),
    val isLoading: Boolean = false,
    val remainingMessages: Int? = null,
    val limitReached: Boolean = false,
)

@HiltViewModel
class CoachViewModel @Inject constructor(
    private val coachApiClient: CoachApiClient,
) : ViewModel() {

    private val _uiState = MutableStateFlow(CoachUiState())
    val uiState: StateFlow<CoachUiState> = _uiState

    init {
        loadHistory()
    }

    private fun loadHistory() {
        viewModelScope.launch {
            val history = coachApiClient.getHistory()
            _uiState.value = _uiState.value.copy(
                messages = history.map { ChatMessage(it.role, it.content) }
            )
        }
    }

    fun send(text: String) {
        if (text.isBlank()) return

        val userMsg = ChatMessage("user", text)
        _uiState.value = _uiState.value.copy(
            messages = _uiState.value.messages + userMsg,
            isLoading = true,
            limitReached = false,
        )

        viewModelScope.launch {
            val result = coachApiClient.sendMessage(text)
            if (result == null) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    limitReached = true,
                )
            } else {
                val coachMsg = ChatMessage("model", result.reply)
                _uiState.value = _uiState.value.copy(
                    messages = _uiState.value.messages + coachMsg,
                    isLoading = false,
                    remainingMessages = result.remainingMessages,
                )
            }
        }
    }
}
