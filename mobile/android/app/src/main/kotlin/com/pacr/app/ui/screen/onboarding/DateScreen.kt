package com.pacr.app.ui.screen.onboarding

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

@Composable
fun DateScreen(
    viewModel: OnboardingViewModel,
    onContinue: () -> Unit,
) {
    val state by viewModel.state.collectAsState()
    val selected = state.data.targetMonth
    val now = YearMonth.now()
    // Show next 18 months
    val months = (2..19).map { now.plusMonths(it.toLong()) }

    OnboardingScaffold(
        step = 3,
        title = "When's your\nrace?",
        subtitle = "Pick the month your target race is in. We'll count back from there.",
        ctaEnabled = selected != null,
        onCta = onContinue,
    ) {
        Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            months.forEach { month ->
                val isSelected = selected == month
                SelectionCard(selected = isSelected, onClick = { viewModel.setTargetMonth(month) }) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column {
                            Text(
                                month.month.getDisplayName(TextStyle.FULL, Locale.getDefault()),
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = PacrColors.Ink,
                            )
                            Text(
                                month.year.toString(),
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
