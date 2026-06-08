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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import com.pacr.app.data.api.RunTrackerApiClient
import com.pacr.app.data.api.model.RunRecord
import com.pacr.app.ui.components.PacrCTA
import com.pacr.app.ui.components.PacrPill
import com.pacr.app.ui.theme.PacrColors
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class PostRunViewModel @Inject constructor(
    val runTrackerApiClient: RunTrackerApiClient,
) : ViewModel()

@Composable
fun PostRunSummaryScreen(
    runId: String,
    onDone: () -> Unit,
    vm: PostRunViewModel = hiltViewModel(),
) {
    var runRecord by remember { mutableStateOf<RunRecord?>(null) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(runId) {
        runRecord = vm.runTrackerApiClient.getRun(runId)
        isLoading = false
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(PacrColors.Bg)
            .statusBarsPadding()
            .padding(horizontal = 24.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(32.dp))

        PacrPill("Run Complete", PacrColors.Mint)
        Spacer(Modifier.height(24.dp))

        Text("Great work!", fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, color = PacrColors.Ink)

        Spacer(Modifier.height(32.dp))

        if (isLoading) {
            CircularProgressIndicator(color = PacrColors.Coral)
        } else {
            runRecord?.let { run ->
                StatsGrid(run)
                run.aiDebrief?.let { debrief ->
                    Spacer(Modifier.height(24.dp))
                    DebriefCard(debrief)
                }
            }
        }

        Spacer(Modifier.height(32.dp))
        PacrCTA("Done", onClick = onDone)
        Spacer(Modifier.height(24.dp).navigationBarsPadding())
    }
}

@Composable
private fun StatsGrid(run: RunRecord) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            SummaryTile("Distance", run.distanceKm?.let { "%.2f km".format(it) } ?: "–", Modifier.weight(1f))
            SummaryTile("Duration", run.durationSec?.let { formatDuration(it) } ?: "–", Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            SummaryTile("Avg pace", run.avgPaceSecKm?.let { formatPace(it) } ?: "–", Modifier.weight(1f))
            SummaryTile("Avg HR", run.avgHrBpm?.let { "$it bpm" } ?: "–", Modifier.weight(1f))
        }
        run.elevationGainM?.let {
            SummaryTile("Elevation gain", "%.0f m".format(it), Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun SummaryTile(label: String, value: String, modifier: Modifier = Modifier) {
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
            Text(value, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PacrColors.Ink)
        }
    }
}

@Composable
private fun DebriefCard(debrief: String) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(PacrColors.CoralSoft)
            .padding(20.dp),
    ) {
        Column {
            Text("Coach debrief", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = PacrColors.Coral)
            Spacer(Modifier.height(8.dp))
            Text(debrief, fontSize = 14.sp, color = PacrColors.InkSoft, lineHeight = 21.sp)
        }
    }
}

private fun formatDuration(sec: Int): String {
    val h = sec / 3600
    val m = (sec % 3600) / 60
    val s = sec % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}

private fun formatPace(secPerKm: Double): String {
    val m = secPerKm.toInt() / 60
    val s = secPerKm.toInt() % 60
    return "%d:%02d /km".format(m, s)
}
