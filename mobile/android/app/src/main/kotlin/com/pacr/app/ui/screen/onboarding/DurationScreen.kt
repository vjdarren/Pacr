package com.pacr.app.ui.screen.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pacr.app.ui.components.OnboardingScaffold
import com.pacr.app.ui.components.RadioDot
import com.pacr.app.ui.components.SelectionCard
import com.pacr.app.ui.onboarding.OnboardingViewModel
import com.pacr.app.ui.theme.PacrColors

private data class DurationOption(val minutes: Int, val label: String, val note: String)

private val durationOptions = listOf(
    DurationOption(30,  "30 min",   "Short & sharp — lunchtime sessions"),
    DurationOption(45,  "45 min",   "Standard — fits most schedules"),
    DurationOption(60,  "60 min",   "One hour — solid training window"),
    DurationOption(90,  "90 min",   "Long — includes warm-up & cool-down"),
    DurationOption(120, "120 min+", "Unrestricted — weekend long runs"),
)

@Composable
fun DurationScreen(
    viewModel: OnboardingViewModel,
    onContinue: () -> Unit,
) {
    val state by viewModel.state.collectAsState()
    val selectedMinutes = state.data.maxSessionMinutes

    OnboardingScaffold(
        step = 5,
        title = "Longest session\nyou can fit?",
        subtitle = "This caps your key sessions. Long runs on weekends may be longer if you allow it.",
        ctaEnabled = true,
        onCta = onContinue,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            durationOptions.forEach { option ->
                val isSelected = selectedMinutes == option.minutes
                SelectionCard(selected = isSelected, onClick = { viewModel.setMaxSession(option.minutes) }) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column {
                            Text(
                                option.label,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = PacrColors.Ink,
                            )
                            Text(
                                option.note,
                                fontSize = 13.sp,
                                color = PacrColors.InkMute,
                                modifier = Modifier.padding(top = 2.dp),
                            )
                        }
                        RadioDot(isSelected)
                    }
                }
            }
        }
    }
}
