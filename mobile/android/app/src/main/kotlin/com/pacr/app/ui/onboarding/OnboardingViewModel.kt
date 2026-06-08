package com.pacr.app.ui.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pacr.app.data.api.PlanApiClient
import com.pacr.app.data.datastore.OnboardingDataStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.YearMonth
import javax.inject.Inject

@HiltViewModel
class OnboardingViewModel @Inject constructor(
    private val dataStore: OnboardingDataStore,
    private val planApiClient: PlanApiClient,
) : ViewModel() {

    private val _state = MutableStateFlow(OnboardingUiState())
    val state: StateFlow<OnboardingUiState> = _state.asStateFlow()

    private val _navEvents = MutableSharedFlow<OnboardingNavEvent>()
    val navEvents: SharedFlow<OnboardingNavEvent> = _navEvents.asSharedFlow()

    init {
        viewModelScope.launch {
            val saved = dataStore.readOnce()
            _state.update { it.copy(data = saved) }
        }
    }

    fun setGoal(goal: GoalDistance) = updateData { copy(goalDistance = goal) }
    fun setRaceName(name: String)    = updateData { copy(raceName = name) }
    fun setTargetMonth(month: YearMonth) = updateData { copy(targetMonth = month) }
    fun setWeeklyDays(days: Int)     = updateData { copy(weeklyDays = days) }
    fun setMaxSession(minutes: Int)  = updateData { copy(maxSessionMinutes = minutes) }
    fun setFitnessLevel(level: FitnessLevel) = updateData { copy(fitnessLevel = level) }

    fun submitProfile() {
        val data = _state.value.data
        _state.update { it.copy(isLoading = true) }
        viewModelScope.launch {
            dataStore.save(data)
            dataStore.markComplete()
            // Best-effort plan generation — proceed even if the API call fails,
            // the plan can be generated later from Kafka readiness events.
            runCatching { planApiClient.generatePlan(data) }
            _state.update { it.copy(isLoading = false) }
            _navEvents.emit(OnboardingNavEvent.GoToHealthConnect)
        }
    }

    private fun updateData(transform: OnboardingData.() -> OnboardingData) {
        _state.update { it.copy(data = it.data.transform()) }
        viewModelScope.launch { dataStore.save(_state.value.data) }
    }
}
