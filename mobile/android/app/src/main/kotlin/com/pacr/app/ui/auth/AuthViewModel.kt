package com.pacr.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pacr.app.data.auth.AuthRepository
import com.pacr.app.data.auth.AuthResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
)

sealed class AuthNavEvent {
    data object NavigateToOnboarding : AuthNavEvent()
    data object NavigateToToday : AuthNavEvent()
}

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    private val _navEvents = MutableSharedFlow<AuthNavEvent>()
    val navEvents: SharedFlow<AuthNavEvent> = _navEvents.asSharedFlow()

    fun login(email: String, password: String, isOnboardingComplete: Boolean) {
        _state.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            when (val result = authRepository.login(email.trim(), password)) {
                is AuthResult.Success -> {
                    _navEvents.emit(
                        if (isOnboardingComplete) AuthNavEvent.NavigateToToday
                        else AuthNavEvent.NavigateToOnboarding
                    )
                }
                is AuthResult.Error -> _state.update { it.copy(isLoading = false, error = result.message) }
            }
        }
    }

    fun register(email: String, password: String, displayName: String) {
        _state.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch {
            when (val result = authRepository.register(email.trim(), password, displayName.trim())) {
                is AuthResult.Success -> _navEvents.emit(AuthNavEvent.NavigateToOnboarding)
                is AuthResult.Error -> _state.update { it.copy(isLoading = false, error = result.message) }
            }
        }
    }

    fun clearError() = _state.update { it.copy(error = null) }
}
