package com.pacr.app.domain.model

import java.time.Instant

data class HrvReading(
    val rmssdMs: Double,
    val recordedAt: Instant,
)
