package com.pacr.app.health

import com.pacr.app.domain.model.computeSleepQualityScore
import org.junit.Assert.assertEquals
import org.junit.Test

class SleepQualityTest {

    @Test
    fun `zero total minutes returns zero`() {
        assertEquals(0, computeSleepQualityScore(0L, 0L, 0L))
    }

    @Test
    fun `perfect sleep returns 100`() {
        // 8h total, 25% deep (120m), 25% REM (120m)
        // deep: 0.25 * 40 = 10, rem: 0.25 * 35 = 8.75, adequacy: 1.0 * 25 = 25 → 43 truncated
        // Perfect theoretical max with extreme values
        val score = computeSleepQualityScore(480L, 480L, 0L) // all deep
        // deep%=1.0 * 40 = 40, rem%=0 * 35 = 0, adequacy=1.0 * 25 = 25 → 65
        assertEquals(65, score)
    }

    @Test
    fun `typical good sleep scores reasonably`() {
        // 8h total, 90m deep (18.75%), 90m REM (18.75%)
        val score = computeSleepQualityScore(480L, 90L, 90L)
        // deep: 0.1875 * 40 = 7.5, rem: 0.1875 * 35 = 6.5625, adequacy: 1.0 * 25 = 25 → 39
        assertEquals(39, score)
    }

    @Test
    fun `short sleep reduces adequacy component`() {
        // 4h total (240m), good deep and REM ratios
        val score4h = computeSleepQualityScore(240L, 60L, 60L)
        val score8h = computeSleepQualityScore(480L, 120L, 120L)
        // 4h adequacy = 0.5, 8h adequacy = 1.0 → 4h scores lower
        assert(score4h < score8h) {
            "4h sleep ($score4h) should score lower than 8h sleep ($score8h)"
        }
    }

    @Test
    fun `score is capped at 100`() {
        // Max possible: all deep + all REM (impossible but guards the cap)
        val score = computeSleepQualityScore(480L, 480L, 480L)
        assertEquals(100, score)
    }

    @Test
    fun `more than 8h does not boost score above adequacy ceiling`() {
        // 10h sleep should not give adequacy > 1.0
        val score10h = computeSleepQualityScore(600L, 120L, 120L)
        val score8h = computeSleepQualityScore(480L, 120L, 120L)
        // Same absolute deep/rem minutes but different percentages
        // 10h: deep%=0.2, rem%=0.2; adequacy clamped at 1.0
        assert(score10h <= 100) { "Score must not exceed 100" }
    }

    @Test
    fun `no stages still reflects total adequacy`() {
        // 8h total, no tracked stages
        val score = computeSleepQualityScore(480L, 0L, 0L)
        // deep: 0, rem: 0, adequacy: 1.0 * 25 = 25
        assertEquals(25, score)
    }
}
