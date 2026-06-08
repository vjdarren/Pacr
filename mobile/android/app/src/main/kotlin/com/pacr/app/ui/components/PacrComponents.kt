package com.pacr.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pacr.app.ui.theme.PacrColors

// Step progress bar — 6 segments filled left-to-right up to (and including) currentStep
@Composable
fun StepIndicator(currentStep: Int, totalSteps: Int = 6, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        repeat(totalSteps) { i ->
            Box(
                Modifier
                    .weight(1f)
                    .height(3.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(if (i < currentStep) PacrColors.Coral else PacrColors.Raised)
            )
        }
    }
}

// Shared onboarding screen wrapper
@Composable
fun OnboardingScaffold(
    step: Int,
    title: String,
    subtitle: String,
    ctaLabel: String = "Continue",
    ctaEnabled: Boolean = true,
    onBack: (() -> Unit)? = null,
    onCta: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(PacrColors.Bg)
            .statusBarsPadding()
            .padding(horizontal = 24.dp)
    ) {
        Spacer(Modifier.height(8.dp))
        StepIndicator(currentStep = step)
        Spacer(Modifier.height(20.dp))

        // Step label
        Text(
            text = "Step ${step.toString().padStart(2, '0')} of 06",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PacrColors.Coral,
            letterSpacing = 1.5.sp,
        )
        // Title
        Text(
            text = title,
            fontSize = 32.sp,
            fontWeight = FontWeight.ExtraBold,
            color = PacrColors.Ink,
            letterSpacing = (-1).sp,
            lineHeight = 36.sp,
            modifier = Modifier.padding(top = 10.dp),
        )
        // Subtitle
        Text(
            text = subtitle,
            fontSize = 14.sp,
            color = PacrColors.InkMute,
            lineHeight = 21.sp,
            modifier = Modifier.padding(top = 8.dp),
        )
        Spacer(Modifier.height(24.dp))

        // Content slot
        Column(Modifier.weight(1f)) { content() }

        // CTA
        PacrCTA(label = ctaLabel, enabled = ctaEnabled, onClick = onCta)
        Spacer(Modifier.height(24.dp).navigationBarsPadding())
    }
}

// Coral primary button
@Composable
fun PacrCTA(
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = PacrColors.Coral,
            contentColor = Color.White,
            disabledContainerColor = PacrColors.Raised,
            disabledContentColor = PacrColors.InkMute,
        ),
        modifier = modifier
            .fillMaxWidth()
            .height(52.dp)
            .then(
                if (enabled) Modifier.shadow(
                    elevation = 12.dp,
                    shape = RoundedCornerShape(12.dp),
                    ambientColor = PacrColors.Coral.copy(alpha = 0.4f),
                    spotColor = PacrColors.Coral.copy(alpha = 0.4f),
                ) else Modifier
            ),
    ) {
        Text(label, fontSize = 16.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.2.sp)
    }
}

// Selection card (goal/fitness/duration/availability options)
@Composable
fun SelectionCard(
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val bgColor = if (selected) PacrColors.CoralSoft else PacrColors.Surface
    val borderColor = if (selected) PacrColors.Coral else PacrColors.Hairline
    val borderWidth = if (selected) 1.5.dp else 1.dp

    Box(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(bgColor)
            .border(borderWidth, borderColor, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(16.dp)
    ) {
        content()
    }
}

// Radio dot shown on selection cards
@Composable
fun RadioDot(selected: Boolean) {
    Box(
        Modifier
            .size(22.dp)
            .border(
                width = if (selected) 0.dp else 2.dp,
                color = if (selected) Color.Transparent else PacrColors.HairlineStrong,
                shape = CircleShape,
            )
            .background(
                color = if (selected) PacrColors.Coral else Color.Transparent,
                shape = CircleShape,
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (selected) {
            Box(
                Modifier
                    .size(8.dp)
                    .background(Color.White, CircleShape)
            )
        }
    }
}

// Pill label
@Composable
fun PacrPill(text: String, color: Color = PacrColors.Coral) {
    Box(
        Modifier
            .clip(RoundedCornerShape(100.dp))
            .background(color.copy(alpha = 0.15f))
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(
            text = text.uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.4.sp,
            color = color,
        )
    }
}
