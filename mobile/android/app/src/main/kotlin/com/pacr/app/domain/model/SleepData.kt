package com.pacr.app.domain.model

import java.time.Instant

data class SleepData(
    val date: Instant,
    val totalDurationMinutes: Long,
    val deepSleepMinutes: Long,
    val remSleepMinutes: Long,
    val qualityScore: Int,
)

fun computeSleepQualityScore(
    totalMinutes: Long,
    deepMinutes: Long,
    remMinutes: Long,
): Int {
    if (totalMinutes == 0L) return 0
    val deepPct = deepMinutes.toDouble() / totalMinutes
    val remPct = remMinutes.toDouble() / totalMinutes
    // 480 minutes = 8 hours reference for full adequacy
    val adequacy = minOf(totalMinutes.toDouble() / 480.0, 1.0)
    val score = (deepPct * 40 + remPct * 35 + adequacy * 25).toInt()
    return minOf(score, 100)
}
