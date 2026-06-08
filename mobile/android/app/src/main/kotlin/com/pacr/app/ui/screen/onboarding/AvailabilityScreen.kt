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

private data class AvailabilityOption(
    val days: Int,
    val label: String,
    val description: String,
)

private val availabilityOptions = listOf(
    AvailabilityOption(3, "3 days", "Moderate — great for beginners"),
    AvailabilityOption(4, "4 days", "Balanced — the sweet spot for most"),
    AvailabilityOption(5, "5 days", "Committed — solid training block"),
    AvailabilityOption(6, "6 days", "High volume — one full rest day"),
    AvailabilityOption(7, "7 days", "Elite — active recovery on easy days"),
)

@Composable
fun AvailabilityScreen(
    viewModel: OnboardingViewModel,
    onContinue: () -> Unit,
) {
    val state by viewModel.state.collectAsState()
    val selectedDays = state.data.weeklyDays

    OnboardingScaffold(
        step = 4,
        title = "How many days\ncan you train?",
        subtitle = "Per week. We'll always schedule at least one rest day and one easy day.",
        ctaEnabled = true,
        onCta = onContinue,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            availabilityOptions.forEach { option ->
                val isSelected = selectedDays == option.days
                SelectionCard(selected = isSelected, onClick = { viewModel.setWeeklyDays(option.days) }) {
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
                                option.description,
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
