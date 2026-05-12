"""Plan service API routes."""
from __future__ import annotations

import json
import logging
from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, HTTPException

import database
import kafka_client
from models.schemas import (
    AdaptPlanRequest,
    AdaptPlanResponse,
    AdaptReason,
    GeneratePlanRequest,
    SessionType,
    TrainingPlanOut,
    TrainingSessionOut,
)
from planner.plan_adapter import adapt_sessions
from planner.plan_generator import generate_plan

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/plans", tags=["plans"])


def _success(data: object) -> dict:
    return {
        "success": True,
        "data": data,
        "metadata": {
            "timestamp": datetime.utcnow().isoformat(),
        },
    }


# ---------------------------------------------------------------------------
# POST /api/v1/plans/generate
# ---------------------------------------------------------------------------

@router.post("/generate", status_code=201)
async def generate_plan_endpoint(req: GeneratePlanRequest) -> dict:
    plan = generate_plan(
        profile=req.runner_profile,
        readiness_score=req.readiness_score,
        start_date=req.start_date,
    )

    user_id = str(req.runner_profile.user_id)

    try:
        plan_id = await database.insert_plan(
            user_id=user_id,
            goal_type=plan.goal_type.value,
            start_date=plan.start_date,
            race_date=plan.race_date,
            total_weeks=plan.total_weeks,
            current_phase=plan.current_phase.value,
            vdot_at_gen=plan.vdot_at_gen,
            meta={"adaptations": []},
        )

        sessions_payload = [
            {
                "scheduled_date": s.scheduled_date,
                "session_type": s.session_type.value,
                "target_distance_km": s.target_distance_km,
                "target_duration_min": s.target_duration_min,
                "target_pace_zone": s.target_pace_zone.value if s.target_pace_zone else None,
                "target_hr_zone": s.target_hr_zone.value if s.target_hr_zone else None,
                "rpe_target": s.rpe_target,
                "structure": s.structure,
            }
            for s in plan.sessions
        ]
        await database.insert_sessions_batch(plan_id, sessions_payload)

        plan = plan.model_copy(update={"id": UUID(plan_id)})
        await kafka_client.publish_plan_generated(user_id, plan_id)

    except Exception as exc:
        log.warning("DB/Kafka unavailable, returning plan without persistence: %s", exc)

    return _success(plan.model_dump(mode="json"))


# ---------------------------------------------------------------------------
# GET /api/v1/plans/:plan_id
# ---------------------------------------------------------------------------

@router.get("/{plan_id}")
async def get_plan_endpoint(plan_id: str) -> dict:
    row = await database.get_plan(plan_id)
    if not row:
        raise HTTPException(status_code=404, detail="Plan not found")

    sessions = await database.get_sessions_for_plan(plan_id)
    return _success(_row_to_plan(row, sessions))


# ---------------------------------------------------------------------------
# PATCH /api/v1/plans/:plan_id/adapt
# ---------------------------------------------------------------------------

@router.patch("/{plan_id}/adapt")
async def adapt_plan_endpoint(plan_id: str, req: AdaptPlanRequest) -> dict:
    plan_row = await database.get_plan(plan_id)
    if not plan_row:
        raise HTTPException(status_code=404, detail="Plan not found")

    today = date.today()
    raw_sessions = await database.get_remaining_sessions(plan_id, today)
    session_objs = [_record_to_session(r) for r in raw_sessions]

    adapted, n_modified = adapt_sessions(session_objs, req.reason, today, req.details)

    # Persist changes
    for s in adapted:
        if s.id:
            updates: dict = {}
            if s.session_type != SessionType.rest:
                updates["session_type"] = s.session_type.value
            if s.target_distance_km is not None:
                updates["target_distance_km"] = s.target_distance_km
            if s.target_pace_zone:
                updates["target_pace_zone"] = s.target_pace_zone.value
            if s.target_hr_zone:
                updates["target_hr_zone"] = s.target_hr_zone.value
            if s.rpe_target:
                updates["rpe_target"] = s.rpe_target
            if s.structure:
                updates["structure"] = json.dumps(s.structure)
            if updates:
                try:
                    await database.update_session(str(s.id), updates)
                except Exception:
                    pass

    # Append to adaptations log
    try:
        existing_row = await database.get_plan(plan_id)
        existing_adaptations = (
            json.loads(existing_row["adaptations"])
            if existing_row and existing_row["adaptations"]
            else []
        )
        existing_adaptations.append(
            {
                "reason": req.reason.value,
                "applied_at": datetime.utcnow().isoformat(),
                "sessions_modified": n_modified,
                "details": req.details,
            }
        )
        await database.update_plan_adaptations(plan_id, existing_adaptations)
    except Exception:
        pass

    user_id = str(plan_row["user_id"])
    await kafka_client.publish_plan_adapted(user_id, plan_id, req.reason.value)

    return _success(
        AdaptPlanResponse(
            plan_id=UUID(plan_id),
            reason=req.reason,
            sessions_modified=n_modified,
            message=_adapt_message(req.reason, n_modified),
        ).model_dump(mode="json")
    )


# ---------------------------------------------------------------------------
# GET /api/v1/plans/:plan_id/sessions/today
# ---------------------------------------------------------------------------

@router.get("/{plan_id}/sessions/today")
async def today_session_endpoint(plan_id: str) -> dict:
    plan_row = await database.get_plan(plan_id)
    if not plan_row:
        raise HTTPException(status_code=404, detail="Plan not found")

    session = await database.get_today_session(plan_id, date.today())
    if not session:
        raise HTTPException(status_code=404, detail="No session scheduled for today")

    return _success(_record_to_session(session).model_dump(mode="json"))


# ---------------------------------------------------------------------------
# Internal: trigger adapt from Kafka consumer
# ---------------------------------------------------------------------------

async def trigger_adapt_for_user(user_id: str, reason: str) -> None:
    plan_row = await database.get_active_plan_for_user(user_id)
    if not plan_row:
        return
    plan_id = str(plan_row["id"])
    req = AdaptPlanRequest(reason=AdaptReason(reason))
    try:
        await adapt_plan_endpoint(plan_id, req)
    except Exception:
        log.exception("Auto-adapt failed for user %s plan %s", user_id, plan_id)


# ---------------------------------------------------------------------------
# Row mappers
# ---------------------------------------------------------------------------

def _record_to_session(r: object) -> TrainingSessionOut:
    from models.schemas import HRZoneEnum, PaceZone

    structure = r["structure"]
    if isinstance(structure, str):
        structure = json.loads(structure)
    elif structure is None:
        structure = {}

    return TrainingSessionOut(
        id=r["id"],
        plan_id=r["plan_id"],
        scheduled_date=r["scheduled_date"],
        session_type=SessionType(r["session_type"]),
        target_distance_km=r["target_distance_km"],
        target_duration_min=r["target_duration_min"],
        target_pace_zone=PaceZone(r["target_pace_zone"]) if r["target_pace_zone"] else None,
        target_hr_zone=HRZoneEnum(r["target_hr_zone"]) if r["target_hr_zone"] else None,
        rpe_target=r["rpe_target"],
        structure=structure,
        status=r["status"],
    )


def _row_to_plan(row: object, sessions: list) -> dict:
    return {
        "id": str(row["id"]),
        "user_id": str(row["user_id"]),
        "goal_type": row["goal_type"],
        "start_date": row["start_date"].isoformat(),
        "race_date": row["race_date"].isoformat() if row["race_date"] else None,
        "total_weeks": row["total_weeks"],
        "current_week": row["current_week"],
        "current_phase": row["current_phase"],
        "vdot_at_gen": row["vdot_at_gen"],
        "status": row["status"],
        "sessions": [_record_to_session(s).model_dump(mode="json") for s in sessions],
    }


def _adapt_message(reason: AdaptReason, n: int) -> str:
    if reason == AdaptReason.low_readiness:
        return (
            f"Overtraining guardrail applied: {n} quality session(s) replaced "
            "with easy runs and volume reduced by 15 %."
        )
    if reason == AdaptReason.missed_sessions:
        return f"{n} missed session(s) logged; remaining plan unchanged."
    return f"Plan adjusted: {n} session(s) modified with 10 % volume reduction."
