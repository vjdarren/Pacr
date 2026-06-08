package com.pacr.app.ui.run

data class RunUiState(
    val isActive: Boolean = false,
    val elapsedSec: Int = 0,
    val distanceKm: Double = 0.0,
    val currentPaceSecKm: Double = 0.0,
    val avgPaceSecKm: Double = 0.0,
    val hrBpm: Int? = null,
    val error: String? = null,
)
