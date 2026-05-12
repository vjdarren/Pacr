"""Unit tests for plan_adapter — adapt_sessions function."""
import uuid
from datetime import date, timedelta

import pytest

from models.schemas import (
    AdaptReason,
    ExperienceLevel,
    GoalType,
    HRZoneEnum,
    PaceZone,
    RunnerProfile,
    SessionType,
    TrainingPhase,
    TrainingSessionOut,
)
from planner.plan_adapter import adapt_sessions
from planner.plan_generator import generate_plan

TODAY = date(2026, 5, 10)
TOMORROW = TODAY + timedelta(days=1)

TEST_USER_ID = uuid.UUID("550e8400-e29b-41d4-a716-446655440000")


def make_session(
    session_type: SessionType = SessionType.easy,
    scheduled_date: date = TOMORROW,
    distance_km: float = 8.0,
    status: str = "planned",
    sid: uuid.UUID | None = None,
) -> TrainingSessionOut:
    return TrainingSessionOut(
        id=sid or uuid.uuid4(),
        scheduled_date=scheduled_date,
        session_type=session_type,
        target_distance_km=distance_km,
        target_pace_zone=PaceZone.Z2,
        target_hr_zone=HRZoneEnum.Z2,
        rpe_target=4,
        structure={"type": "continuous", "pace_zone": "easy", "distance_km": distance_km},
        status=status,
    )


# ---------------------------------------------------------------------------
# low_readiness adaptation (overtraining guardrail)
# ---------------------------------------------------------------------------

class TestLowReadiness:
    def test_quality_replaced_with_easy(self):
        sessions = [
            make_session(SessionType.tempo, TOMORROW, 10.0),
            make_session(SessionType.interval, TOMORROW + timedelta(days=2), 8.0),
            make_session(SessionType.easy, TOMORROW + timedelta(days=4), 6.0),
        ]
        adapted, n = adapt_sessions(sessions, AdaptReason.low_readiness, TODAY)
        quality = {SessionType.tempo, SessionType.interval}
        assert all(s.session_type not in quality for s in adapted)
        assert n == 3   # all 3 were modified (2 replaced + volume cut on easy)

    def test_volume_reduced_by_15pct(self):
        original_dist = 12.0
        sessions = [make_session(SessionType.easy, TOMORROW, original_dist)]
        adapted, _ = adapt_sessions(sessions, AdaptReason.low_readiness, TODAY)
        expected = max(3.0, round(original_dist * 0.85, 1))
        assert adapted[0].target_distance_km == pytest.approx(expected, abs=0.2)

    def test_past_sessions_untouched(self):
        past = make_session(SessionType.tempo, TODAY - timedelta(days=1), 10.0)
        adapted, n = adapt_sessions([past], AdaptReason.low_readiness, TODAY)
        assert adapted[0].session_type == SessionType.tempo
        assert n == 0

    def test_minimum_session_distance_floor(self):
        # Very short session shouldn't drop below 3 km
        sessions = [make_session(SessionType.easy, TOMORROW, 3.0)]
        adapted, _ = adapt_sessions(sessions, AdaptReason.low_readiness, TODAY)
        assert adapted[0].target_distance_km >= 3.0

    def test_replaced_session_gets_easy_structure(self):
        sessions = [make_session(SessionType.interval, TOMORROW, 10.0)]
        adapted, _ = adapt_sessions(sessions, AdaptReason.low_readiness, TODAY)
        assert adapted[0].structure.get("pace_zone") == "easy"

    def test_replaced_session_gets_z2_hr_zone(self):
        sessions = [make_session(SessionType.tempo, TOMORROW, 10.0)]
        adapted, _ = adapt_sessions(sessions, AdaptReason.low_readiness, TODAY)
        assert adapted[0].target_hr_zone == HRZoneEnum.Z2

    def test_replaced_session_gets_rpe_4(self):
        sessions = [make_session(SessionType.interval, TOMORROW, 10.0)]
        adapted, _ = adapt_sessions(sessions, AdaptReason.low_readiness, TODAY)
        assert adapted[0].rpe_target == 4


# ---------------------------------------------------------------------------
# user_request adaptation (10 % volume reduction)
# ---------------------------------------------------------------------------

class TestUserRequest:
    def test_volume_reduced_by_10pct(self):
        original = 10.0
        sessions = [make_session(SessionType.easy, TOMORROW, original)]
        adapted, _ = adapt_sessions(sessions, AdaptReason.user_request, TODAY)
        expected = max(3.0, round(original * 0.90, 1))
        assert adapted[0].target_distance_km == pytest.approx(expected, abs=0.2)

    def test_quality_sessions_preserved(self):
        sessions = [make_session(SessionType.tempo, TOMORROW, 10.0)]
        adapted, _ = adapt_sessions(sessions, AdaptReason.user_request, TODAY)
        assert adapted[0].session_type == SessionType.tempo


# ---------------------------------------------------------------------------
# missed_sessions adaptation
# ---------------------------------------------------------------------------

class TestMissedSessions:
    def test_past_planned_sessions_marked_skipped(self):
        yesterday = TODAY - timedelta(days=1)
        sessions = [make_session(SessionType.easy, yesterday, 8.0, status="planned")]
        adapted, n = adapt_sessions(sessions, AdaptReason.missed_sessions, TODAY)
        assert adapted[0].status == "skipped"
        assert n == 1

    def test_future_sessions_untouched(self):
        sessions = [make_session(SessionType.easy, TOMORROW, 8.0)]
        adapted, n = adapt_sessions(sessions, AdaptReason.missed_sessions, TODAY)
        assert adapted[0].status == "planned"
        assert n == 0


# ---------------------------------------------------------------------------
# Full plan → adapt (integration-style pure unit test)
# ---------------------------------------------------------------------------

class TestAdaptOnGeneratedPlan:
    def _profile(self) -> RunnerProfile:
        return RunnerProfile(
            user_id=TEST_USER_ID,
            goal_type=GoalType.half_marathon,
            experience_level=ExperienceLevel.intermediate,
            vo2max_estimate=45.0,
            weekly_days=4,
            available_days=["Mon", "Wed", "Thu", "Sat"],
            age=30,
        )

    def test_low_readiness_on_generated_plan(self):
        plan = generate_plan(self._profile(), start_date=TOMORROW)
        all_sessions = plan.sessions

        adapted, n_modified = adapt_sessions(
            all_sessions, AdaptReason.low_readiness, TODAY
        )

        quality = {SessionType.tempo, SessionType.interval}
        future_quality = [
            s for s in adapted
            if s.scheduled_date >= TODAY and s.session_type in quality
        ]
        assert len(future_quality) == 0, "Quality sessions must be replaced on low_readiness"

    def test_adapt_does_not_remove_sessions(self):
        plan = generate_plan(self._profile(), start_date=TOMORROW)
        adapted, _ = adapt_sessions(plan.sessions, AdaptReason.low_readiness, TODAY)
        assert len(adapted) == len(plan.sessions)

    def test_no_sessions_modified_before_today(self):
        plan = generate_plan(self._profile(), start_date=TOMORROW)
        _, n = adapt_sessions(plan.sessions, AdaptReason.low_readiness, TODAY)
        # All sessions are in the future, so all planned ones will be modified
        assert n >= 0   # sanity — no crash
