package com.pacr.app.data.datastore

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.pacr.app.ui.onboarding.FitnessLevel
import com.pacr.app.ui.onboarding.GoalDistance
import com.pacr.app.ui.onboarding.OnboardingData
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.time.YearMonth
import javax.inject.Inject
import javax.inject.Singleton

private val Context.onboardingStore by preferencesDataStore(name = "onboarding")

@Singleton
class OnboardingDataStore @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val store get() = context.onboardingStore

    private val keyComplete      = booleanPreferencesKey("complete")
    private val keyGoal          = stringPreferencesKey("goal")
    private val keyRaceName      = stringPreferencesKey("race_name")
    private val keyTargetMonth   = stringPreferencesKey("target_month") // yyyy-MM
    private val keyWeeklyDays    = intPreferencesKey("weekly_days")
    private val keyMaxMinutes    = intPreferencesKey("max_session_minutes")
    private val keyFitnessLevel  = stringPreferencesKey("fitness_level")

    val isComplete: Flow<Boolean> = store.data.map { it[keyComplete] == true }

    val savedData: Flow<OnboardingData> = store.data.map { prefs ->
        OnboardingData(
            goalDistance    = prefs[keyGoal]?.let { key -> GoalDistance.entries.find { it.apiKey == key } },
            raceName        = prefs[keyRaceName] ?: "",
            targetMonth     = prefs[keyTargetMonth]?.let { runCatching { YearMonth.parse(it) }.getOrNull() },
            weeklyDays      = prefs[keyWeeklyDays] ?: 4,
            maxSessionMinutes = prefs[keyMaxMinutes] ?: 60,
            fitnessLevel    = prefs[keyFitnessLevel]?.let { key -> FitnessLevel.entries.find { it.apiKey == key } },
        )
    }

    suspend fun save(data: OnboardingData) {
        store.edit { prefs ->
            data.goalDistance?.let   { prefs[keyGoal]       = it.apiKey }
            prefs[keyRaceName]       = data.raceName
            data.targetMonth?.let    { prefs[keyTargetMonth] = it.toString() }
            prefs[keyWeeklyDays]     = data.weeklyDays
            prefs[keyMaxMinutes]     = data.maxSessionMinutes
            data.fitnessLevel?.let   { prefs[keyFitnessLevel] = it.apiKey }
        }
    }

    suspend fun markComplete() {
        store.edit { it[keyComplete] = true }
    }

    suspend fun readOnce(): OnboardingData = savedData.first()
}
