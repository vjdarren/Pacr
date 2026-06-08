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
import com.pacr.app.ui.onboarding.GoalDistance
import com.pacr.app.ui.onboarding.OnboardingViewModel
import com.pacr.app.ui.theme.PacrColors

@Composable
fun GoalScreen(
    viewModel: OnboardingViewModel,
    onContinue: () -> Unit,
) {
    val state by viewModel.state.collectAsState()
    val selected = state.data.goalDistance

    OnboardingScaffold(
        step = 1,
        title = "What are you\ntraining for?",
        subtitle = "We'll build a periodised plan around your goal. Change it any time.",
        ctaEnabled = selected != null,
        onCta = {
            viewModel.setGoal(selected!!)
            onContinue()
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            GoalDistance.entries.forEach { goal ->
                val isSelected = selected == goal
                SelectionCard(selected = isSelected, onClick = { viewModel.setGoal(goal) }) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column {
                            Text(
                                goal.displayLabel,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold,
                                color = PacrColors.Ink,
                                letterSpacing = (-0.3).sp,
                            )
                            Text(
                                "${goal.subtitle} · ${goal.duration}",
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
