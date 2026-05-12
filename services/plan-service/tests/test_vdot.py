"""Unit tests for the VDOT engine."""
import pytest

from engine.vdot import (
    VDOT_TABLE,
    get_training_paces,
    lookup_paces,
    vdot_from_race,
    vdot_from_vo2max,
)


# ---------------------------------------------------------------------------
# VDOT from race result
# ---------------------------------------------------------------------------

class TestVdotFromRace:
    def test_5k_gives_known_vdot(self):
        # 5 K in 20:00 ≈ VDOT 48 (well-established Daniels reference)
        vdot = vdot_from_race(5000, 20 * 60)
        assert 46 < vdot < 50

    def test_10k_gives_reasonable_vdot(self):
        # 10 K in 40:00 → similar vdot to 5 K in ~19:30
        vdot = vdot_from_race(10_000, 40 * 60)
        assert 47 < vdot < 52

    def test_marathon_gives_reasonable_vdot(self):
        # Marathon in 3:30:00 → ~46 VDOT
        vdot = vdot_from_race(42_195, 3.5 * 3600)
        assert 42 < vdot < 50

    def test_faster_race_gives_higher_vdot(self):
        slow = vdot_from_race(5000, 25 * 60)
        fast = vdot_from_race(5000, 18 * 60)
        assert fast > slow

    def test_longer_distance_same_effort_gives_similar_vdot(self):
        vdot_5k  = vdot_from_race(5000,   20 * 60)
        vdot_10k = vdot_from_race(10_000, 41 * 60)   # ~same fitness level
        assert abs(vdot_5k - vdot_10k) < 3

    def test_clamps_to_upper_bound(self):
        # Impossibly fast race — should clamp to 90
        vdot = vdot_from_race(5000, 60)   # 1-minute 5 K
        assert vdot == 90.0

    def test_clamps_to_lower_bound(self):
        vdot = vdot_from_race(5000, 200 * 60)   # very slow
        assert vdot == 25.0

    def test_raises_on_invalid_input(self):
        with pytest.raises(ValueError):
            vdot_from_race(0, 1200)
        with pytest.raises(ValueError):
            vdot_from_race(5000, 0)


# ---------------------------------------------------------------------------
# VDOT from VO2Max
# ---------------------------------------------------------------------------

class TestVdotFromVo2max:
    def test_standard_formula(self):
        # VO2Max 45 → VDOT = 45 × 0.95 = 42.75
        assert vdot_from_vo2max(45.0) == pytest.approx(42.75, abs=0.01)

    def test_vo2max_60(self):
        assert vdot_from_vo2max(60.0) == pytest.approx(57.0, abs=0.01)

    def test_lower_vo2max(self):
        assert vdot_from_vo2max(35.0) == pytest.approx(33.25, abs=0.01)

    def test_clamps_high(self):
        assert vdot_from_vo2max(100.0) == 90.0

    def test_clamps_low(self):
        assert vdot_from_vo2max(10.0) == 25.0


# ---------------------------------------------------------------------------
# Pace zone derivation
# ---------------------------------------------------------------------------

class TestPaceZoneDerivation:
    def test_pace_zones_ordered(self):
        """Easy pace must be slowest; repetition must be fastest."""
        paces = get_training_paces(45.0)
        assert paces.easy > paces.marathon > paces.threshold > paces.interval > paces.repetition

    def test_vdot45_easy_pace_approx(self):
        # Daniels table: VDOT 45 easy ≈ 5:50–6:00/km (350–360 sec/km)
        paces = get_training_paces(45.0)
        assert 330 < paces.easy < 380

    def test_vdot45_threshold_pace_approx(self):
        # Daniels table: VDOT 45 T-pace ≈ 4:48–4:55/km (288–295 sec/km)
        paces = get_training_paces(45.0)
        assert 270 < paces.threshold < 310

    def test_vdot45_interval_pace_approx(self):
        # Daniels table: VDOT 45 I-pace ≈ 4:20–4:25/km (260–265 sec/km)
        paces = get_training_paces(45.0)
        assert 245 < paces.interval < 280

    def test_higher_vdot_gives_faster_paces(self):
        p45 = get_training_paces(45.0)
        p60 = get_training_paces(60.0)
        assert p60.easy < p45.easy
        assert p60.threshold < p45.threshold
        assert p60.interval < p45.interval

    def test_lookup_table_covers_30_to_85(self):
        for vdot in range(30, 86):
            assert vdot in VDOT_TABLE

    def test_lookup_interpolates_fractional_vdot(self):
        p42 = lookup_paces(42.0)
        p43 = lookup_paces(43.0)
        p42_5 = lookup_paces(42.5)
        # Interpolated value should fall between the two integer values
        assert min(p42.easy, p43.easy) <= p42_5.easy <= max(p42.easy, p43.easy)

    def test_all_table_paces_are_positive(self):
        for vdot, paces in VDOT_TABLE.items():
            assert paces.easy > 0, f"easy pace non-positive at VDOT {vdot}"
            assert paces.repetition > 0, f"rep pace non-positive at VDOT {vdot}"
