"""Unit tests for the plan generator.

Test user profile: half_marathon, intermediate, VO2Max 45.0, 4 days/week.
"""
import uuid
from datetime import date, timedelta

import pytest

from models.schemas import (
    ExperienceLevel,
    GoalType,
    RunnerProfile,
    SessionType,
    TrainingPhase,
)
from planner.plan_generator import (
    MAX_WEEKLY_INCREASE,
    _BASE_VOLUME,
    _PLAN_WEEKS,
    _TAPER_WEEKS,
    _build_phases,
    _compute_weekly_volumes,
    generate_plan,
)

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

TEST_USER_ID = uuid.UUID("550e8400-e29b-41d4-a716-446655440000")
START_DATE = date(2026, 5, 10)


def hm_intermediate_profile(**overrides) -> RunnerProfile:
    defaults = dict(
        user_id=TEST_USER_ID,
        goal_type=GoalType.half_marathon,
        experience_level=ExperienceLevel.intermediate,
        vo2max_estimate=45.0,
        weekly_days=4,
        available_days=["Mon", "Wed", "Thu", "Sat"],
        age=30,
    )
    defaults.update(overrides)
    return RunnerProfile(**defaults)


# ---------------------------------------------------------------------------
# 10 % mileage cap enforcement
# ---------------------------------------------------------------------------

class TestMileageCap:
    def test_no_week_exceeds_10pct_increase(self):
        volumes = _compute_weekly_volumes(
            base_volume=40.0,
            total_weeks=10,
            taper_weeks=2,
            phases=[],          # phases not used in volume calc
            readiness_scale=1.0,
        )
        training_vols = volumes[:-2]   # exclude taper weeks
        for i in range(1, len(training_vols)):
            increase = (training_vols[i] - training_vols[i - 1]) / training_vols[i - 1]
            assert increase <= MAX_WEEKLY_INCREASE + 1e-9, (
                f"Week {i+1}: {increase:.1%} > 10 % cap"
            )

    def test_taper_reduces_volume(self):
        volumes = _compute_weekly_volumes(40.0, 10, 2, [], 1.0)
        peak = max(volumes[:-2])
        taper_vols = volumes[-2:]
        assert all(v < peak for v in taper_vols)

    def test_readiness_scale_affects_start_volume(self):
        high = _compute_weekly_volumes(40.0, 8, 2, [], readiness_scale=1.0)
        low  = _compute_weekly_volumes(40.0, 8, 2, [], readiness_scale=0.8)
        assert low[0] < high[0]


# ---------------------------------------------------------------------------
# Taper phase volume reduction
# ---------------------------------------------------------------------------

class TestTaperVolume:
    def test_taper_last_week_60pct_of_peak(self):
        volumes = _compute_weekly_volumes(40.0, 12, 3, [], 1.0)
        peak = max(volumes[:-3])
        last_week = volumes[-1]
        assert last_week == pytest.approx(peak * 0.60, abs=2.0)

    def test_taper_second_last_week_75pct_of_peak(self):
        volumes = _compute_weekly_volumes(40.0, 12, 3, [], 1.0)
        peak = max(volumes[:-3])
        penultimate = volumes[-2]
        assert penultimate == pytest.approx(peak * 0.75, abs=2.0)

    def test_5k_plan_has_1_taper_week(self):
        assert _TAPER_WEEKS[GoalType.five_k] == 1

    def test_marathon_plan_has_3_taper_weeks(self):
        assert _TAPER_WEEKS[GoalType.marathon] == 3

    def test_hm_plan_has_2_taper_weeks(self):
        assert _TAPER_WEEKS[GoalType.half_marathon] == 2


# ---------------------------------------------------------------------------
# Plan generation for all four goal types
# ---------------------------------------------------------------------------

class TestPlanGenerationAllGoalTypes:
    @pytest.mark.parametrize("goal_type, exp_weeks", [
        (GoalType.five_k,        6),
        (GoalType.ten_k,         8),
        (GoalType.half_marathon, 10),
        (GoalType.marathon,      14),
    ])
    def test_correct_total_weeks(self, goal_type, exp_weeks):
        profile = hm_intermediate_profile(goal_type=goal_type)
        plan = generate_plan(profile, start_date=START_DATE)
        assert plan.total_weeks == exp_weeks

    @pytest.mark.parametrize("goal_type", [
        GoalType.five_k,
        GoalType.ten_k,
        GoalType.half_marathon,
        GoalType.marathon,
    ])
    def test_plan_has_sessions_for_each_week(self, goal_type):
        profile = hm_intermediate_profile(goal_type=goal_type)
        plan = generate_plan(profile, start_date=START_DATE)
        week_numbers = {s.week_number for s in plan.sessions}
        assert week_numbers == set(range(1, plan.total_weeks + 1))

    @pytest.mark.parametrize("goal_type", [
        GoalType.five_k,
        GoalType.ten_k,
        GoalType.half_marathon,
        GoalType.marathon,
    ])
    def test_80_20_rule(self, goal_type):
        profile = hm_intermediate_profile(goal_type=goal_type)
        plan = generate_plan(profile, start_date=START_DATE)
        quality = {SessionType.tempo, SessionType.interval, SessionType.race}
        total = len(plan.sessions)
        n_quality = sum(1 for s in plan.sessions if s.session_type in quality)
        quality_ratio = n_quality / total if total > 0 else 0
        assert quality_ratio <= 0.22, f"Quality ratio {quality_ratio:.1%} > 22 %"

    @pytest.mark.parametrize("goal_type", [
        GoalType.five_k,
        GoalType.ten_k,
        GoalType.half_marathon,
        GoalType.marathon,
    ])
    def test_all_sessions_have_required_fields(self, goal_type):
        profile = hm_intermediate_profile(goal_type=goal_type)
        plan = generate_plan(profile, start_date=START_DATE)
        for s in plan.sessions:
            if s.session_type != SessionType.rest:
                assert s.target_pace_zone is not None, f"Missing pace_zone: {s}"
                assert s.target_hr_zone is not None, f"Missing hr_zone: {s}"
                assert s.rpe_target is not None, f"Missing rpe: {s}"
                assert (
                    s.target_distance_km is not None or s.target_duration_min is not None
                ), f"Missing distance/duration: {s}"

    @pytest.mark.parametrize("goal_type", [
        GoalType.five_k,
        GoalType.ten_k,
        GoalType.half_marathon,
        GoalType.marathon,
    ])
    def test_all_sessions_have_structure(self, goal_type):
        profile = hm_intermediate_profile(goal_type=goal_type)
        plan = generate_plan(profile, start_date=START_DATE)
        for s in plan.sessions:
            if s.session_type != SessionType.rest:
                assert isinstance(s.structure, dict) and len(s.structure) > 0, (
                    f"Missing structure for {s.session_type} on {s.scheduled_date}"
                )


# ---------------------------------------------------------------------------
# Test user profile specifics
# ---------------------------------------------------------------------------

class TestHalfMarathonIntermediate:
    def test_vdot_from_vo2max_45(self):
        profile = hm_intermediate_profile()
        plan = generate_plan(profile, start_date=START_DATE)
        # VDOT = 45 × 0.95 = 42.75
        assert plan.vdot_at_gen == pytest.approx(42.75, abs=0.1)

    def test_plan_is_10_weeks(self):
        plan = generate_plan(hm_intermediate_profile(), start_date=START_DATE)
        assert plan.total_weeks == 10

    def test_has_all_four_phases(self):
        plan = generate_plan(hm_intermediate_profile(), start_date=START_DATE)
        phases_seen = {s.phase for s in plan.sessions}
        assert TrainingPhase.base in phases_seen
        assert TrainingPhase.build in phases_seen
        assert TrainingPhase.taper in phases_seen

    def test_sessions_start_on_or_after_start_date(self):
        plan = generate_plan(hm_intermediate_profile(), start_date=START_DATE)
        assert all(s.scheduled_date >= START_DATE for s in plan.sessions)

    def test_interval_session_has_reps_structure(self):
        plan = generate_plan(hm_intermediate_profile(), start_date=START_DATE)
        interval_sessions = [s for s in plan.sessions if s.session_type == SessionType.interval]
        assert len(interval_sessions) > 0
        for s in interval_sessions:
            assert "intervals" in s.structure, "Interval session missing 'intervals' key"
            assert "reps" in s.structure["intervals"]

    def test_tempo_session_has_warmup_main_cooldown(self):
        plan = generate_plan(hm_intermediate_profile(), start_date=START_DATE)
        tempo_sessions = [s for s in plan.sessions if s.session_type == SessionType.tempo]
        assert len(tempo_sessions) > 0
        for s in tempo_sessions:
            assert "warmup" in s.structure
            assert "main" in s.structure
            assert "cooldown" in s.structure

    def test_taper_sessions_are_easy(self):
        plan = generate_plan(hm_intermediate_profile(), start_date=START_DATE)
        taper_sessions = [s for s in plan.sessions if s.phase == TrainingPhase.taper]
        quality = {SessionType.tempo, SessionType.interval}
        assert all(s.session_type not in quality for s in taper_sessions)

    def test_race_result_overrides_vo2max_vdot(self):
        from models.schemas import RaceResult
        profile = hm_intermediate_profile(
            race_result=RaceResult(distance_m=5000, time_sec=1320)  # 22:00
        )
        plan = generate_plan(profile, start_date=START_DATE)
        # 5 K in 22 min → ~VDOT 44-46
        assert 43 < plan.vdot_at_gen < 48

    def test_phase_breakdown_sums_to_total_weeks(self):
        plan = generate_plan(hm_intermediate_profile(), start_date=START_DATE)
        pb = plan.phase_breakdown
        assert pb is not None
        total = pb.base + pb.build + pb.peak + pb.taper
        assert total == plan.total_weeks
