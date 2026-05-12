from __future__ import annotations

from datetime import date
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums matching the database enums
# ---------------------------------------------------------------------------

class GoalType(str, Enum):
    five_k = "5k"
    ten_k = "10k"
    half_marathon = "half_marathon"
    marathon = "marathon"
    general_fitness = "general_fitness"


class ExperienceLevel(str, Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class SessionType(str, Enum):
    easy = "easy"
    tempo = "tempo"
    interval = "interval"
    long_run = "long_run"
    recovery = "recovery"
    rest = "rest"
    race = "race"


class PaceZone(str, Enum):
    Z1 = "Z1"
    Z2 = "Z2"
    Z3 = "Z3"
    Z4 = "Z4"
    Z5 = "Z5"


class HRZoneEnum(str, Enum):
    Z1 = "Z1"
    Z2 = "Z2"
    Z3 = "Z3"
    Z4 = "Z4"
    Z5 = "Z5"


class PlanStatus(str, Enum):
    active = "active"
    completed = "completed"
    abandoned = "abandoned"


class TrainingPhase(str, Enum):
    base = "base"
    build = "build"
    peak = "peak"
    taper = "taper"


class AdaptReason(str, Enum):
    low_readiness = "low_readiness"
    missed_sessions = "missed_sessions"
    user_request = "user_request"


# ---------------------------------------------------------------------------
# Shared sub-models
# ---------------------------------------------------------------------------

class RaceResult(BaseModel):
    distance_m: float = Field(..., gt=0, description="Race distance in metres")
    time_sec: float = Field(..., gt=0, description="Finishing time in seconds")


class RunnerProfile(BaseModel):
    user_id: UUID
    goal_type: GoalType
    experience_level: ExperienceLevel
    vo2max_estimate: float = Field(..., gt=0, le=100)
    weekly_days: int = Field(..., ge=2, le=7)
    available_days: list[str] = Field(default_factory=list)
    age: int | None = Field(None, ge=10, le=100)
    race_result: RaceResult | None = None
    target_race_date: date | None = None


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class GeneratePlanRequest(BaseModel):
    runner_profile: RunnerProfile
    readiness_score: float = Field(default=75.0, ge=0, le=100)
    start_date: date | None = None


class SessionStructure(BaseModel):
    """Flexible JSONB structure for session details."""
    model_config = {"extra": "allow"}


class TrainingSessionOut(BaseModel):
    id: UUID | None = None
    plan_id: UUID | None = None
    scheduled_date: date
    session_type: SessionType
    target_distance_km: float | None = None
    target_duration_min: float | None = None
    target_pace_zone: PaceZone | None = None
    target_hr_zone: HRZoneEnum | None = None
    rpe_target: int | None = None
    structure: dict[str, Any] = Field(default_factory=dict)
    status: str = "planned"
    week_number: int | None = None
    phase: TrainingPhase | None = None


class PhaseBreakdown(BaseModel):
    base: int
    build: int
    peak: int
    taper: int


class TrainingPlanOut(BaseModel):
    id: UUID | None = None
    user_id: UUID
    goal_type: GoalType
    start_date: date
    race_date: date | None = None
    total_weeks: int
    current_week: int = 1
    current_phase: TrainingPhase
    vdot_at_gen: float
    status: PlanStatus = PlanStatus.active
    pace_zones: dict[str, int] = Field(default_factory=dict)
    phase_breakdown: PhaseBreakdown | None = None
    sessions: list[TrainingSessionOut] = Field(default_factory=list)


class AdaptPlanRequest(BaseModel):
    reason: AdaptReason
    details: dict[str, Any] = Field(default_factory=dict)


class AdaptPlanResponse(BaseModel):
    plan_id: UUID
    reason: AdaptReason
    sessions_modified: int
    message: str
