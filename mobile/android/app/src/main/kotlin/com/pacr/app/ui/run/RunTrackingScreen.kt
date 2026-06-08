package com.pacr.app.ui.run

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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.pacr.app.ui.components.PacrCTA
import com.pacr.app.ui.theme.PacrColors

@Composable
fun RunTrackingScreen(
    sessionId: String?,
    onRunFinished: (runId: String) -> Unit,
    onBack: () -> Unit,
    vm: RunViewModel = hiltViewModel(),
) {
    val state by vm.uiState.collectAsState()
    var showStopDialog by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        vm.startRun(sessionId)
    }

    if (showStopDialog) {
        AlertDialog(
            onDismissRequest = { showStopDialog = false },
            title = { Text("End run?", color = PacrColors.Ink) },
            text = { Text("Do you want to save and finish this run?", color = PacrColors.InkSoft) },
            confirmButton = {
                TextButton(onClick = {
                    showStopDialog = false
                    vm.finishRun(onRunFinished)
                }) { Text("Finish", color = PacrColors.Coral) }
            },
            dismissButton = {
                TextButton(onClick = { showStopDialog = false }) {
                    Text("Keep going", color = PacrColors.InkMute)
                }
            },
            containerColor = PacrColors.Surface,
        )
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(PacrColors.Bg)
            .statusBarsPadding()
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back", tint = PacrColors.InkMute)
            }
            Text(
                "Live Run",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = PacrColors.Ink,
                modifier = Modifier.weight(1f),
                textAlign = TextAlign.Center,
            )
            // balance spacer
            Spacer(Modifier.padding(24.dp))
        }

        Spacer(Modifier.height(32.dp))

        // Elapsed time
        Text(
            text = formatElapsed(state.elapsedSec),
            fontSize = 72.sp,
            fontWeight = FontWeight.ExtraBold,
            color = PacrColors.Ink,
            letterSpacing = (-2).sp,
        )
        Text("elapsed", fontSize = 13.sp, color = PacrColors.InkMute)

        Spacer(Modifier.height(32.dp))

        // Stats grid
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StatTile("Distance", "%.2f km".format(state.distanceKm), Modifier.weight(1f))
            StatTile("Avg pace", formatPace(state.avgPaceSecKm), Modifier.weight(1f))
        }
        Spacer(Modifier.height(12.dp))
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StatTile("Current pace", formatPace(state.currentPaceSecKm), Modifier.weight(1f))
            StatTile("Heart rate", state.hrBpm?.let { "$it bpm" } ?: "–", Modifier.weight(1f))
        }

        state.error?.let {
            Spacer(Modifier.height(16.dp))
            Text(it, color = PacrColors.Red, fontSize = 14.sp)
        }

        Spacer(Modifier.weight(1f))

        PacrCTA(
            label = "Finish Run",
            onClick = { showStopDialog = true },
        )
        Spacer(Modifier.height(24.dp).navigationBarsPadding())
    }
}

@Composable
private fun StatTile(label: String, value: String, modifier: Modifier = Modifier) {
    Box(
        modifier
            .clip(RoundedCornerShape(12.dp))
            .background(PacrColors.Surface)
            .padding(16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(label, fontSize = 12.sp, color = PacrColors.InkMute)
            Spacer(Modifier.height(4.dp))
            Text(value, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = PacrColors.Ink)
        }
    }
}

private fun formatElapsed(sec: Int): String {
    val h = sec / 3600
    val m = (sec % 3600) / 60
    val s = sec % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

private fun formatPace(secPerKm: Double): String {
    if (secPerKm <= 0) return "–"
    val m = secPerKm.toInt() / 60
    val s = secPerKm.toInt() % 60
    return "%d:%02d /km".format(m, s)
}
