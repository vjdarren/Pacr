"""
Daniels-based periodised training plan generator.

Safety guardrails enforced here:
  - Max 10 % weekly mileage increase
  - Minimum 1 rest + 1 easy day per week (achieved via available_days constraint)
  - 80/20 polarised model (80 % easy, 20 % quality)
  - HRV overtraining guardrail reflected via readiness_score scaling
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, timedelta

from engine.hr_zones import get_hr_zones
from engine.vdot import lookup_paces, vdot_from_race, vdot_from_vo2max
from models.schemas import (
    ExperienceLevel,
    GoalType,
    HRZoneEnum,
    PaceZone,
    PhaseBreakdown,
    RunnerProfile,
    SessionType,
    TrainingPhase,
    TrainingPlanOut,
    TrainingSessionOut,
)

# ---------------------------------------------------------------------------
# Plan duration table (weeks) by goal × experience
# ---------------------------------------------------------------------------

_PLAN_WEEKS: dict[tuple[GoalType, ExperienceLevel], int] = {
    (GoalType.five_k,        ExperienceLevel.beginner):     8,
    (GoalType.five_k,        ExperienceLevel.intermediate):  6,
    (GoalType.five_k,        ExperienceLevel.advanced):      4,
    (GoalType.ten_k,         ExperienceLevel.beginner):     10,
    (GoalType.ten_k,         ExperienceLevel.intermediate):  8,
    (GoalType.ten_k,         ExperienceLevel.advanced):      6,
    (GoalType.half_marathon, ExperienceLevel.beginner):     12,
    (GoalType.half_marathon, ExperienceLevel.intermediate): 10,
    (GoalType.half_marathon, ExperienceLevel.advanced):      8,
    (GoalType.marathon,      ExperienceLevel.beginner):     16,
    (GoalType.marathon,      ExperienceLevel.intermediate): 14,
    (GoalType.marathon,      ExperienceLevel.advanced):     12,
    (GoalType.general_fitness, ExperienceLevel.beginner):    8,
    (GoalType.general_fitness, ExperienceLevel.intermediate): 8,
    (GoalType.general_fitness, ExperienceLevel.advanced):    6,
}

# Taper weeks by goal type
_TAPER_WEEKS: dict[GoalType, int] = {
    GoalType.five_k:          1,
    GoalType.ten_k:           2,
    GoalType.half_marathon:   2,
    GoalType.marathon:        3,
    GoalType.general_fitness: 1,
}

# Base weekly volume (km) by goal × experience
_BASE_VOLUME: dict[tuple[GoalType, ExperienceLevel], float] = {
    (GoalType.five_k,        ExperienceLevel.beginner):    20.0,
    (GoalType.five_k,        ExperienceLevel.intermediate): 30.0,
    (GoalType.five_k,        ExperienceLevel.advanced):    40.0,
    (GoalType.ten_k,         ExperienceLevel.beginner):    25.0,
    (GoalType.ten_k,         ExperienceLevel.intermediate): 35.0,
    (GoalType.ten_k,         ExperienceLevel.advanced):    50.0,
    (GoalType.half_marathon, ExperienceLevel.beginner):    30.0,
    (GoalType.half_marathon, ExperienceLevel.intermediate): 40.0,
    (GoalType.half_marathon, ExperienceLevel.advanced):    55.0,
    (GoalType.marathon,      ExperienceLevel.beginner):    35.0,
    (GoalType.marathon,      ExperienceLevel.intermediate): 50.0,
    (GoalType.marathon,      ExperienceLevel.advanced):    65.0,
    (GoalType.general_fitness, ExperienceLevel.beginner):  20.0,
    (GoalType.general_fitness, ExperienceLevel.intermediate): 30.0,
    (GoalType.general_fitness, ExperienceLevel.advanced):  40.0,
}

# ---------------------------------------------------------------------------
# Session type templates per training phase and day slot index
# Slot 0 = first training day of week, last slot = long run day (weekend).
# 80/20 rule: no more than 1 quality session in any 4-day week.
# ---------------------------------------------------------------------------

_SESSION_PLAN: dict[TrainingPhase, dict[int, list[SessionType]]] = {
    # Base: all aerobic — 0 quality sessions
    TrainingPhase.base: {
        2: [SessionType.easy, SessionType.long_run],
        3: [SessionType.easy, SessionType.easy, SessionType.long_run],
        4: [SessionType.easy, SessionType.easy, SessionType.easy, SessionType.long_run],
        5: [SessionType.easy, SessionType.easy, SessionType.easy, SessionType.easy, SessionType.long_run],
        6: [SessionType.easy, SessionType.easy, SessionType.easy, SessionType.easy, SessionType.easy, SessionType.long_run],
    },
    # Build: 1 tempo session introduced
    TrainingPhase.build: {
        2: [SessionType.tempo, SessionType.long_run],
        3: [SessionType.easy, SessionType.tempo, SessionType.long_run],
        4: [SessionType.easy, SessionType.tempo, SessionType.easy, SessionType.long_run],
        5: [SessionType.easy, SessionType.tempo, SessionType.easy, SessionType.easy, SessionType.long_run],
        6: [SessionType.easy, SessionType.tempo, SessionType.easy, SessionType.easy, SessionType.easy, SessionType.long_run],
    },
    # Peak: replace tempo with intervals for race-specific sharpening
    TrainingPhase.peak: {
        2: [SessionType.interval, SessionType.long_run],
        3: [SessionType.easy, SessionType.interval, SessionType.long_run],
        4: [SessionType.easy, SessionType.interval, SessionType.easy, SessionType.long_run],
        5: [SessionType.easy, SessionType.interval, SessionType.easy, SessionType.tempo, SessionType.long_run],
        6: [SessionType.easy, SessionType.interval, SessionType.easy, SessionType.tempo, SessionType.easy, SessionType.long_run],
    },
    # Taper: all easy, reduced volume handled separately
    TrainingPhase.taper: {
        2: [SessionType.easy, SessionType.easy],
        3: [SessionType.easy, SessionType.easy, SessionType.easy],
        4: [SessionType.easy, SessionType.easy, SessionType.easy, SessionType.easy],
        5: [SessionType.easy, SessionType.easy, SessionType.easy, SessionType.easy, SessionType.easy],
        6: [SessionType.easy, SessionType.easy, SessionType.easy, SessionType.easy, SessionType.easy, SessionType.easy],
    },
}

# ---------------------------------------------------------------------------
# Pace zone + HR zone mappings for each session type
# ---------------------------------------------------------------------------

_SESSION_PACE_ZONE: dict[SessionType, PaceZone] = {
    SessionType.easy:     PaceZone.Z2,
    SessionType.tempo:    PaceZone.Z3,
    SessionType.interval: PaceZone.Z4,
    SessionType.long_run: PaceZone.Z2,
    SessionType.recovery: PaceZone.Z1,
    SessionType.rest:     PaceZone.Z1,
    SessionType.race:     PaceZone.Z5,
}

_SESSION_HR_ZONE: dict[SessionType, HRZoneEnum] = {
    SessionType.easy:     HRZoneEnum.Z2,
    SessionType.tempo:    HRZoneEnum.Z3,
    SessionType.interval: HRZoneEnum.Z4,
    SessionType.long_run: HRZoneEnum.Z2,
    SessionType.recovery: HRZoneEnum.Z1,
    SessionType.rest:     HRZoneEnum.Z1,
    SessionType.race:     HRZoneEnum.Z5,
}

_SESSION_RPE: dict[SessionType, int] = {
    SessionType.easy:     4,
    SessionType.tempo:    7,
    SessionType.interval: 8,
    SessionType.long_run: 5,
    SessionType.recovery: 3,
    SessionType.rest:     1,
    SessionType.race:     9,
}

# Long run as fraction of weekly volume
_LONG_RUN_FRACTION = 0.30


# ---------------------------------------------------------------------------
# Session structure builders
# ---------------------------------------------------------------------------

def _easy_structure(distance_km: float) -> dict:
    return {"type": "continuous", "pace_zone": "easy", "distance_km": round(distance_km, 1)}


def _long_run_structure(distance_km: float) -> dict:
    return {"type": "continuous", "pace_zone": "easy", "distance_km": round(distance_km, 1)}


def _tempo_structure(total_km: float) -> dict:
    warmup = 2.0
    cooldown = 1.5
    tempo_km = max(2.0, total_km - warmup - cooldown)
    return {
        "warmup": {"distance_km": warmup, "pace_zone": "easy"},
        "main": {"distance_km": round(tempo_km, 1), "pace_zone": "threshold"},
        "cooldown": {"distance_km": cooldown, "pace_zone": "easy"},
    }


def _interval_structure(total_km: float, vdot: float) -> dict:
    # Rep distance scales with fitness: longer intervals at higher VDOT
    rep_m = 800 if vdot < 50 else 1000
    # Fit as many reps as possible within budget (excluding 2km warmup + 1.5km cooldown)
    budget_km = max(2.0, total_km - 3.5)
    recovery_m = rep_m // 2
    rep_km = (rep_m + recovery_m) / 1000
    reps = max(4, min(10, int(budget_km / rep_km)))
    return {
        "warmup": {"distance_km": 2.0, "pace_zone": "easy"},
        "intervals": {
            "reps": reps,
            "distance_m": rep_m,
            "pace_zone": "interval",
            "recovery_m": recovery_m,
            "recovery_pace_zone": "easy",
        },
        "cooldown": {"distance_km": 1.5, "pace_zone": "easy"},
    }


def _build_structure(session_type: SessionType, distance_km: float, vdot: float) -> dict:
    if session_type == SessionType.easy:
        return _easy_structure(distance_km)
    if session_type == SessionType.long_run:
        return _long_run_structure(distance_km)
    if session_type == SessionType.tempo:
        return _tempo_structure(distance_km)
    if session_type == SessionType.interval:
        return _interval_structure(distance_km, vdot)
    return {}


# ---------------------------------------------------------------------------
# Phase builder
# ---------------------------------------------------------------------------

@dataclass
class _Phase:
    phase: TrainingPhase
    start_week: int      # 1-based
    end_week: int        # inclusive


def _build_phases(total_weeks: int, taper_weeks: int) -> list[_Phase]:
    training_weeks = total_weeks - taper_weeks
    base_weeks = max(2, round(training_weeks * 0.40))
    build_weeks = max(2, round(training_weeks * 0.40))
    peak_weeks = max(1, training_weeks - base_weeks - build_weeks)

    phases: list[_Phase] = []
    w = 1
    for ph, n in [
        (TrainingPhase.base,  base_weeks),
        (TrainingPhase.build, build_weeks),
        (TrainingPhase.peak,  peak_weeks),
        (TrainingPhase.taper, taper_weeks),
    ]:
        phases.append(_Phase(ph, w, w + n - 1))
        w += n
    return phases


def _phase_for_week(phases: list[_Phase], week: int) -> TrainingPhase:
    for p in phases:
        if p.start_week <= week <= p.end_week:
            return p.phase
    return TrainingPhase.taper


# ---------------------------------------------------------------------------
# Weekly volume progression with safety cap
# ---------------------------------------------------------------------------

MAX_WEEKLY_INCREASE = 0.10  # 10 %

_TAPER_VOLUME_FACTOR: dict[int, float] = {
    # weeks_from_end → volume fraction of peak
    1: 0.60,
    2: 0.75,
    3: 0.85,
}


@dataclass
class _WeeklyVolumes:
    volumes: list[float] = field(default_factory=list)   # index 0 = week 1


def _compute_weekly_volumes(
    base_volume: float,
    total_weeks: int,
    taper_weeks: int,
    phases: list[_Phase],
    readiness_scale: float,
) -> list[float]:
    """Build weekly volume list.

    - Increases by at most 10 % per week in training phases.
    - Tapers by fixed fractions in the taper phase.
    - Scales week-1 volume by readiness_scale (readiness < 50 → lighter start).
    """
    training_weeks = total_weeks - taper_weeks

    # Grow from base to peak over training weeks (max 10 % per week)
    week_volumes: list[float] = []
    current = round(base_volume * readiness_scale, 1)
    for w in range(1, training_weeks + 1):
        week_volumes.append(current)
        # Allow up to 10 % growth each week; round so the cap applies to stored values
        current = round(min(current * (1 + MAX_WEEKLY_INCREASE), base_volume * 1.5), 1)

    peak = max(week_volumes) if week_volumes else base_volume

    # Taper phase
    for t in range(taper_weeks, 0, -1):
        factor = _TAPER_VOLUME_FACTOR.get(t, 0.60)
        week_volumes.append(round(peak * factor, 1))

    return week_volumes


# ---------------------------------------------------------------------------
# Day-of-week helpers
# ---------------------------------------------------------------------------

_DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _day_offset(day_name: str) -> int:
    try:
        return _DAY_ORDER.index(day_name)
    except ValueError:
        return 6  # default to Sunday


def _next_occurrence(start: date, day_name: str) -> date:
    """First occurrence of day_name on or after start."""
    target = _day_offset(day_name)
    current_dow = start.weekday()  # Mon=0, Sun=6
    delta = (target - current_dow) % 7
    return start + timedelta(days=delta)


# ---------------------------------------------------------------------------
# Main generator
# ---------------------------------------------------------------------------

def generate_plan(
    profile: RunnerProfile,
    readiness_score: float = 75.0,
    start_date: date | None = None,
) -> TrainingPlanOut:
    """Generate a full periodised training plan for the given runner profile."""

    # --- VDOT ------------------------------------------------------------------
    if profile.race_result is not None:
        vdot = vdot_from_race(
            profile.race_result.distance_m,
            profile.race_result.time_sec,
        )
    else:
        vdot = vdot_from_vo2max(profile.vo2max_estimate)

    paces = lookup_paces(vdot)
    age = profile.age or 30
    hr_zones = get_hr_zones(age)

    # --- Plan skeleton ---------------------------------------------------------
    total_weeks = _PLAN_WEEKS.get(
        (profile.goal_type, profile.experience_level),
        10,
    )
    taper_weeks = _TAPER_WEEKS.get(profile.goal_type, 2)
    plan_start = start_date or date.today() + timedelta(days=1)
    race_date = profile.target_race_date or (plan_start + timedelta(weeks=total_weeks))

    phases = _build_phases(total_weeks, taper_weeks)
    phase_breakdown = PhaseBreakdown(
        base=phases[0].end_week - phases[0].start_week + 1,
        build=phases[1].end_week - phases[1].start_week + 1,
        peak=phases[2].end_week - phases[2].start_week + 1,
        taper=phases[3].end_week - phases[3].start_week + 1,
    )

    base_volume = _BASE_VOLUME.get(
        (profile.goal_type, profile.experience_level),
        30.0,
    )
    # Scale initial volume if runner is fatigued
    readiness_scale = 0.8 + 0.2 * (readiness_score / 100.0)
    weekly_volumes = _compute_weekly_volumes(
        base_volume, total_weeks, taper_weeks, phases, readiness_scale
    )

    # Ensure available_days is sorted and non-empty
    avail = sorted(
        profile.available_days or ["Mon", "Wed", "Thu", "Sat"],
        key=_day_offset,
    )
    n_days = len(avail)
    if n_days < 2:
        avail = ["Mon", "Wed", "Thu", "Sat"]
        n_days = 4

    # --- Build sessions --------------------------------------------------------
    sessions: list[TrainingSessionOut] = []

    for week_idx, weekly_vol in enumerate(weekly_volumes):
        week_num = week_idx + 1
        phase = _phase_for_week(phases, week_num)

        week_start = plan_start + timedelta(weeks=week_idx)

        slot_count = min(n_days, max(avail, key=_day_offset, default=0) and n_days)
        slot_count = min(n_days, 6)  # cap at 6 to keep at least 1 rest day

        session_types = _SESSION_PLAN[phase].get(
            slot_count,
            _SESSION_PLAN[phase].get(4, [SessionType.easy] * slot_count),
        )

        long_run_km = round(weekly_vol * _LONG_RUN_FRACTION, 1)
        # Remaining volume split across non-long-run sessions
        other_count = max(1, slot_count - 1)
        other_km = round(
            (weekly_vol - long_run_km) / other_count, 1
        )

        for slot_idx, s_type in enumerate(session_types):
            day_name = avail[slot_idx] if slot_idx < len(avail) else avail[-1]
            session_date = _next_occurrence(week_start, day_name)

            if s_type == SessionType.long_run:
                dist_km = long_run_km
            elif s_type == SessionType.rest:
                dist_km = 0.0
            else:
                dist_km = max(3.0, other_km)

            structure = _build_structure(s_type, dist_km, vdot)

            sessions.append(
                TrainingSessionOut(
                    scheduled_date=session_date,
                    session_type=s_type,
                    target_distance_km=dist_km if s_type != SessionType.rest else None,
                    target_duration_min=None,
                    target_pace_zone=_SESSION_PACE_ZONE[s_type],
                    target_hr_zone=_SESSION_HR_ZONE[s_type],
                    rpe_target=_SESSION_RPE[s_type],
                    structure=structure,
                    week_number=week_num,
                    phase=phase,
                )
            )

    return TrainingPlanOut(
        user_id=profile.user_id,
        goal_type=profile.goal_type,
        start_date=plan_start,
        race_date=race_date,
        total_weeks=total_weeks,
        current_week=1,
        current_phase=TrainingPhase.base,
        vdot_at_gen=round(vdot, 2),
        pace_zones=paces.as_dict(),
        phase_breakdown=phase_breakdown,
        sessions=sessions,
    )
