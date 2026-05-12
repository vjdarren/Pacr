package com.pacr.app.domain.model

import java.time.Instant

data class ExerciseData(
    val id: String,
    val startTime: Instant,
    val endTime: Instant,
    val title: String?,
    val exerciseType: Int,
    val distanceMeters: Double?,
    val heartRateSamples: List<HeartRateSample>,
)

data class HeartRateSample(
    val bpm: Long,
    val time: Instant,
)

data class RunRecord(
    val startTime: Instant,
    val endTime: Instant,
    val title: String? = null,
)
