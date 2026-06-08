package com.pacr.app.ui.today

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.pacr.app.data.api.model.TodaySessionData
import com.pacr.app.ui.components.PacrCTA
import com.pacr.app.ui.components.PacrPill
import com.pacr.app.ui.theme.PacrColors

@Composable
fun TodayScreen(
    onStartRun: (sessionId: String?) -> Unit,
    onOpenCoach: () -> Unit,
    vm: TodayViewModel = hiltViewModel(),
) {
    val state by vm.uiState.collectAsState()

    Scaffold(
        containerColor = PacrColors.Bg,
        floatingActionButton = {
            FloatingActionButton(
                onClick = onOpenCoach,
                containerColor = PacrColors.Coral,
                contentColor = Color.White,
            ) {
                Icon(Icons.Filled.Chat, contentDescription = "Ask coach")
            }
        },
    ) { innerPadding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .statusBarsPadding()
                .padding(horizontal = 24.dp),
        ) {
            Spacer(Modifier.height(24.dp))
            Text(
                text = "Today",
                fontSize = 28.sp,
                fontWeight = FontWeight.ExtraBold,
                color = PacrColors.Ink,
                letterSpacing = (-0.5).sp,
            )
            Spacer(Modifier.height(24.dp))

            when (val s = state) {
                is TodayUiState.Loading -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = PacrColors.Coral)
                    }
                }
                is TodayUiState.Error -> {
                    Text(s.message, color = PacrColors.Red)
                    Spacer(Modifier.height(16.dp))
                    TextButton(onClick = { vm.load() }) {
                        Text("Retry", color = PacrColors.Coral)
                    }
                }
                is TodayUiState.RestDay -> {
                    ReadinessRing(score = s.readinessScore)
                    Spacer(Modifier.height(32.dp))
                    RestDayCard()
                }
                is TodayUiState.TrainingDay -> {
                    ReadinessRing(score = s.readinessScore)
                    Spacer(Modifier.height(32.dp))
                    SessionCard(
                        session = s.session,
                        onStartRun = { onStartRun(s.session.id) },
                        onLogManually = {
                            val id = s.session.id ?: return@SessionCard
                            vm.completeSession(id) {}
                        },
                    )
                }
            }

            Spacer(Modifier.navigationBarsPadding())
        }
    }
}

@Composable
private fun ReadinessRing(score: Double) {
    val ringColor = when {
        score < 30 -> PacrColors.Red
        score < 60 -> PacrColors.Amber
        else -> PacrColors.Mint
    }
    val trackColor = PacrColors.Raised
    val sweepAngle = (score / 100.0 * 300f).toFloat()

    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(20.dp)) {
        Box(contentAlignment = Alignment.Center, modifier = Modifier.size(96.dp)) {
            Canvas(Modifier.fillMaxSize()) {
                drawArc(
                    color = trackColor,
                    startAngle = 120f,
                    sweepAngle = 300f,
                    useCenter = false,
                    style = Stroke(width = 10.dp.toPx(), cap = StrokeCap.Round),
                )
                drawArc(
                    color = ringColor,
                    startAngle = 120f,
                    sweepAngle = sweepAngle,
                    useCenter = false,
                    style = Stroke(width = 10.dp.toPx(), cap = StrokeCap.Round),
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = score.toInt().toString(),
                    fontSize = 24.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = PacrColors.Ink,
                )
                Text(
                    text = "/100",
                    fontSize = 11.sp,
                    color = PacrColors.InkMute,
                )
            }
        }
        Column {
            Text("Readiness", fontSize = 13.sp, color = PacrColors.InkMute)
            Text(
                text = when {
                    score < 30 -> "Rest today"
                    score < 60 -> "Take it easy"
                    else -> "Ready to train"
                },
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = PacrColors.Ink,
            )
        }
    }
}

@Composable
private fun RestDayCard() {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(PacrColors.Surface)
            .padding(20.dp),
    ) {
        Column {
            PacrPill("Rest Day", PacrColors.Mint)
            Spacer(Modifier.height(12.dp))
            Text(
                "Your body needs recovery. No run today.",
                fontSize = 15.sp,
                color = PacrColors.InkSoft,
                lineHeight = 22.sp,
            )
        }
    }
}

@Composable
private fun SessionCard(
    session: TodaySessionData,
    onStartRun: () -> Unit,
    onLogManually: () -> Unit,
) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(PacrColors.Surface)
            .padding(20.dp),
    ) {
        Column {
            PacrPill(session.sessionType.uppercase().replace('_', ' '))
            Spacer(Modifier.height(12.dp))

            session.targetDistanceKm?.let {
                StatRow("Distance", "%.1f km".format(it))
            }
            session.targetDurationMin?.let {
                StatRow("Duration", "$it min")
            }
            session.targetPaceZone?.let {
                StatRow("Pace zone", it)
            }
            session.rpeTarget?.let {
                StatRow("Effort (RPE)", "$it / 10")
            }
            session.message?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, fontSize = 13.sp, color = PacrColors.InkMute, lineHeight = 19.sp)
            }

            Spacer(Modifier.height(20.dp))
            PacrCTA("Start Run", onClick = onStartRun)
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = onLogManually, modifier = Modifier.fillMaxWidth()) {
                Text("Log manually (no GPS)", color = PacrColors.InkMute, fontSize = 14.sp)
            }
        }
    }
}

@Composable
private fun StatRow(label: String, value: String) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, fontSize = 14.sp, color = PacrColors.InkMute)
        Text(value, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PacrColors.Ink)
    }
}
