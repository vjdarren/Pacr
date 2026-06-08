package com.pacr.app.ui.screen.onboarding

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pacr.app.data.sync.HistoricalSyncManager
import com.pacr.app.ui.theme.PacrColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val syncMessages = listOf(
    "Reading 30 days of health data…",
    "Analysing your HRV trends…",
    "Calculating readiness baseline…",
    "Mapping your fitness profile…",
    "Setting up your training plan…",
    "Almost there…",
)

@Composable
fun HistoricalSyncScreen(
    historicalSyncManager: HistoricalSyncManager,
    onSyncComplete: () -> Unit,
) {
    var messageIndex by remember { mutableIntStateOf(0) }
    var isDone by remember { mutableStateOf(false) }

    val infiniteTransition = rememberInfiniteTransition(label = "spin")
    val rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(1200, easing = LinearEasing), RepeatMode.Restart),
        label = "rotation",
    )
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "pulse",
    )

    LaunchedEffect(Unit) {
        // Cycle through status messages every 1.8s
        val messageJob = launch {
            while (!isDone) {
                delay(1800)
                messageIndex = (messageIndex + 1).coerceAtMost(syncMessages.lastIndex)
            }
        }
        runCatching { historicalSyncManager.syncOnce() }
        isDone = true
        messageJob.cancel()
        delay(600) // brief pause so the last message reads
        onSyncComplete()
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(PacrColors.Bg)
            .statusBarsPadding(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            // Spinning arc
            Box(Modifier.size(120.dp), contentAlignment = Alignment.Center) {
                // Outer track
                Canvas(Modifier.size(120.dp)) {
                    drawArc(
                        color = PacrColors.Raised,
                        startAngle = 0f,
                        sweepAngle = 360f,
                        useCenter = false,
                        style = Stroke(width = 8.dp.toPx(), cap = StrokeCap.Round),
                    )
                }
                // Spinning arc
                Canvas(Modifier.size(120.dp).rotate(rotation)) {
                    drawArc(
                        color = PacrColors.Coral,
                        startAngle = -90f,
                        sweepAngle = 260f,
                        useCenter = false,
                        style = Stroke(width = 8.dp.toPx(), cap = StrokeCap.Round),
                    )
                }
                // Coral "P" centre
                Text(
                    "P",
                    fontSize = 32.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = PacrColors.Coral.copy(alpha = pulseAlpha),
                    letterSpacing = (-1).sp,
                )
            }

            Spacer(Modifier.height(36.dp))

            Text(
                syncMessages[messageIndex],
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
                color = PacrColors.Ink,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 40.dp),
            )

            Spacer(Modifier.height(12.dp))

            Text(
                "Analysing your health history",
                fontSize = 13.sp,
                color = PacrColors.InkMute,
                textAlign = TextAlign.Center,
            )
        }
    }
}
