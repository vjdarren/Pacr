package com.pacr.app.ui.screen

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.pacr.app.ui.theme.PacrColors

// Stub — Today screen will be implemented in the next session
@Composable
fun TodayStubScreen() {
    Column(
        Modifier.fillMaxSize().background(PacrColors.Bg),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("Today", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = PacrColors.Ink)
        Text("Your training plan is ready.", fontSize = 15.sp, color = PacrColors.InkMute)
    }
}
