package com.pacr.app.domain.model

enum class MetricType(val apiKey: String) {
    HRV_RMSSD("hrv_rmssd"),
    RESTING_HR("resting_hr"),
    SLEEP_QUALITY("sleep_quality"),
    SLEEP_DURATION_MIN("sleep_duration_min"),
    DEEP_SLEEP_MIN("deep_sleep_min"),
    REM_SLEEP_MIN("rem_sleep_min"),
    SPO2("spo2"),
    VO2MAX("vo2max"),
}
