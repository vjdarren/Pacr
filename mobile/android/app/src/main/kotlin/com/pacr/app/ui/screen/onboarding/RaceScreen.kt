package com.pacr.app.ui.screen.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pacr.app.ui.components.OnboardingScaffold
import com.pacr.app.ui.components.SelectionCard
import com.pacr.app.ui.onboarding.OnboardingViewModel
import com.pacr.app.ui.theme.PacrColors

@Composable
fun RaceScreen(
    viewModel: OnboardingViewModel,
    onContinue: () -> Unit,
) {
    val state by viewModel.state.collectAsState()
    var isFocused by remember { mutableStateOf(false) }
    val raceName = state.data.raceName

    OnboardingScaffold(
        step = 2,
        title = "Which race are\nyou targeting?",
        subtitle = "Optional — helps us name your plan and track race-day goals.",
        ctaLabel = if (raceName.isBlank()) "Skip for now" else "Continue",
        ctaEnabled = true,
        onCta = onContinue,
    ) {
        Column {
            // Race name text field
            val borderColor = if (isFocused) PacrColors.Coral else PacrColors.HairlineStrong
            BasicTextField(
                value = raceName,
                onValueChange = { viewModel.setRaceName(it) },
                textStyle = TextStyle(
                    color = PacrColors.Ink,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Medium,
                ),
                cursorBrush = SolidColor(PacrColors.Coral),
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(PacrColors.Surface)
                    .border(1.5.dp, borderColor, RoundedCornerShape(12.dp))
                    .padding(horizontal = 18.dp, vertical = 18.dp)
                    .onFocusChanged { isFocused = it.isFocused },
                decorationBox = { inner ->
                    if (raceName.isEmpty()) {
                        Text("e.g. London Marathon, Boston…", color = PacrColors.InkMute, fontSize = 18.sp)
                    }
                    inner()
                },
            )

            Spacer(Modifier.height(20.dp))
            Text(
                "Popular events",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = PacrColors.InkMute,
                letterSpacing = 1.sp,
            )
            Spacer(Modifier.height(10.dp))

            // Quick-pick popular races
            listOf("London Marathon", "New York City Marathon", "Berlin Marathon", "Great North Run").forEach { race ->
                SelectionCard(selected = raceName == race, onClick = { viewModel.setRaceName(race) }) {
                    Text(race, fontSize = 15.sp, fontWeight = FontWeight.Medium, color = PacrColors.Ink)
                }
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}
