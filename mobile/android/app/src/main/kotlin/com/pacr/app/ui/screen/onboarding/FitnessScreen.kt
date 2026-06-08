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
import com.pacr.app.ui.onboarding.FitnessLevel
import com.pacr.app.ui.onboarding.OnboardingViewModel
import com.pacr.app.ui.theme.PacrColors

@Composable
fun FitnessScreen(
    viewModel: OnboardingViewModel,
    onContinue: () -> Unit,
) {
    val state by viewModel.state.collectAsState()
    val selected = state.data.fitnessLevel
    val isLoading = state.isLoading

    OnboardingScaffold(
        step = 6,
        title = "How would you\ndescribe yourself?",
        subtitle = "We'll calibrate your starting mileage, intensity, and pacing zones accordingly.",
        ctaLabel = if (isLoading) "Building your plan…" else "Create my plan",
        ctaEnabled = selected != null && !isLoading,
        onCta = {
            viewModel.setFitnessLevel(selected!!)
            viewModel.submitProfile()
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            FitnessLevel.entries.forEach { level ->
                val isSelected = selected == level
                SelectionCard(selected = isSelected, onClick = { viewModel.setFitnessLevel(level) }) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column {
                            Text(
                                level.displayLabel,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold,
                                color = PacrColors.Ink,
                                letterSpacing = (-0.3).sp,
                            )
                            Text(
                                level.subtitle,
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
