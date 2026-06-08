package com.pacr.app.ui.onboarding

import java.time.YearMonth

enum class GoalDistance(val displayLabel: String, val subtitle: String, val duration: String, val apiKey: String) {
    FIVE_K("5K", "Park-run pace", "4–8 wks", "5k"),
    TEN_K("10K", "Build endurance", "6–10 wks", "10k"),
    HALF_MARATHON("Half Marathon", "Long-run focus", "10–14 wks", "half_marathon"),
    MARATHON("Marathon", "Periodised plan", "12–16 wks", "marathon"),
}

enum class FitnessLevel(val displayLabel: String, val subtitle: String, val apiKey: String) {
    BEGINNER("Beginner", "New to structured training", "beginner"),
    INTERMEDIATE("Intermediate", "Some racing experience", "intermediate"),
    ADVANCED("Advanced", "Regular racing & high volume", "advanced"),
}

data class OnboardingData(
    val goalDistance: GoalDistance? = null,
    val raceName: String = "",
    val targetMonth: YearMonth? = null,
    val weeklyDays: Int = 4,
    val maxSessionMinutes: Int = 60,
    val fitnessLevel: FitnessLevel? = null,
)

data class OnboardingUiState(
    val data: OnboardingData = OnboardingData(),
    val isLoading: Boolean = false,
)

sealed class OnboardingNavEvent {
    object GoToHealthConnect : OnboardingNavEvent()
}
