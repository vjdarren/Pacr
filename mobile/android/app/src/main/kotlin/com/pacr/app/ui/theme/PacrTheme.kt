package com.pacr.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val PacrDarkColorScheme = darkColorScheme(
    primary          = PacrColors.Coral,
    onPrimary        = Color.White,
    primaryContainer = PacrColors.CoralSoft,
    secondary        = PacrColors.Mint,
    onSecondary      = Color.White,
    background       = PacrColors.Bg,
    onBackground     = PacrColors.Ink,
    surface          = PacrColors.Surface,
    onSurface        = PacrColors.Ink,
    surfaceVariant   = PacrColors.Raised,
    onSurfaceVariant = PacrColors.InkMute,
    outline          = PacrColors.Hairline,
    error            = PacrColors.Red,
)

@Composable
fun PacrTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = PacrDarkColorScheme,
        content = content,
    )
}
