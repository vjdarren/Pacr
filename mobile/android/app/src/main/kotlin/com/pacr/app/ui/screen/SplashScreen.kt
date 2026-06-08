package com.pacr.app.ui.screen

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pacr.app.ui.theme.PacrColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun SplashScreen(onSplashComplete: () -> Unit) {
    val alpha = remember { Animatable(0f) }
    val scale = remember { Animatable(0.88f) }

    val glowTransition = rememberInfiniteTransition(label = "glow")
    val glowAlpha by glowTransition.animateFloat(
        initialValue = 0.25f,
        targetValue = 0.55f,
        animationSpec = infiniteRepeatable(tween(1400), RepeatMode.Reverse),
        label = "glowAlpha",
    )

    LaunchedEffect(Unit) {
        launch { alpha.animateTo(1f, tween(600, easing = FastOutSlowInEasing)) }
        launch { scale.animateTo(1f, tween(700, easing = FastOutSlowInEasing)) }
        delay(2600)
        onSplashComplete()
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(PacrColors.Bg),
        contentAlignment = Alignment.Center,
    ) {
        // Ambient glow behind the logo
        Box(
            Modifier
                .size(220.dp)
                .scale(1.4f)
                .background(PacrColors.Coral.copy(alpha = glowAlpha * 0.18f), CircleShape)
        )

        Column(
            Modifier.graphicsLayer(alpha = alpha.value, scaleX = scale.value, scaleY = scale.value),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            // Pacr wordmark
            Text(
                text = buildAnnotatedString {
                    append("Pacr")
                    withStyle(SpanStyle(color = PacrColors.Coral)) { append(".") }
                },
                fontSize = 58.sp,
                fontWeight = FontWeight.ExtraBold,
                color = PacrColors.Ink,
                letterSpacing = (-2).sp,
            )

            Spacer(Modifier.height(12.dp))

            // Tagline
            Text(
                text = "Your AI Running Coach",
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = PacrColors.InkMute,
                letterSpacing = 0.4.sp,
            )
        }
    }
}
