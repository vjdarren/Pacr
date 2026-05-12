"""asyncpg connection pool and query helpers."""
from __future__ import annotations

import json
import uuid
from datetime import date
from typing import Any

import asyncpg

from config import settings

_pool: asyncpg.Pool | None = None


async def init_pool() -> asyncpg.Pool:
    global _pool
    _pool = await asyncpg.create_pool(
        settings.database_url,
        min_size=2,
        max_size=10,
        command_timeout=30,
    )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialised")
    return _pool


# ---------------------------------------------------------------------------
# Training plans
# ---------------------------------------------------------------------------

async def insert_plan(
    user_id: str,
    goal_type: str,
    start_date: date,
    race_date: date | None,
    total_weeks: int,
    current_phase: str,
    vdot_at_gen: float,
    meta: dict[str, Any],
) -> str:
    plan_id = str(uuid.uuid4())
    await get_pool().execute(
        """
        INSERT INTO training_plans
            (id, user_id, goal_type, start_date, race_date, total_weeks,
             current_week, current_phase, vdot_at_gen, status, generation_ver, adaptations)
        VALUES ($1, $2, $3::goal_type_enum, $4, $5, $6, 1, $7::training_phase_enum,
                $8, 'active'::plan_status_enum, $9, $10::jsonb)
        """,
        plan_id,
        user_id,
        goal_type,
        start_date,
        race_date,
        total_weeks,
        current_phase,
        vdot_at_gen,
        "v2.0",
        json.dumps(meta.get("adaptations", [])),
    )
    return plan_id


async def get_plan(plan_id: str) -> asyncpg.Record | None:
    return await get_pool().fetchrow(
        "SELECT * FROM training_plans WHERE id = $1 AND status != 'abandoned'",
        plan_id,
    )


async def get_active_plan_for_user(user_id: str) -> asyncpg.Record | None:
    return await get_pool().fetchrow(
        """
        SELECT * FROM training_plans
        WHERE user_id = $1 AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        user_id,
    )


async def update_plan_adaptations(plan_id: str, adaptations: list[dict]) -> None:
    await get_pool().execute(
        "UPDATE training_plans SET adaptations = $1::jsonb WHERE id = $2",
        json.dumps(adaptations),
        plan_id,
    )


# ---------------------------------------------------------------------------
# Training sessions
# ---------------------------------------------------------------------------

async def insert_sessions_batch(plan_id: str, sessions: list[dict]) -> None:
    """Bulk-insert sessions using executemany."""
    rows = [
        (
            str(uuid.uuid4()),
            plan_id,
            s["scheduled_date"],
            s["session_type"],
            s.get("target_distance_km"),
            s.get("target_duration_min"),
            s.get("target_pace_zone"),
            s.get("target_hr_zone"),
            s.get("rpe_target"),
            json.dumps(s.get("structure", {})),
        )
        for s in sessions
    ]
    await get_pool().executemany(
        """
        INSERT INTO training_sessions
            (id, plan_id, scheduled_date, session_type, target_distance_km,
             target_duration_min, target_pace_zone, target_hr_zone,
             rpe_target, structure, status)
        VALUES ($1, $2, $3, $4::session_type_enum, $5, $6,
                $7::pace_zone_enum, $8::hr_zone_enum, $9, $10::jsonb,
                'planned'::session_status_enum)
        """,
        rows,
    )


async def get_sessions_for_plan(plan_id: str) -> list[asyncpg.Record]:
    return await get_pool().fetch(
        """
        SELECT * FROM training_sessions
        WHERE plan_id = $1
        ORDER BY scheduled_date
        """,
        plan_id,
    )


async def get_today_session(plan_id: str, today: date) -> asyncpg.Record | None:
    return await get_pool().fetchrow(
        """
        SELECT * FROM training_sessions
        WHERE plan_id = $1 AND scheduled_date = $2 AND status = 'planned'
        ORDER BY id LIMIT 1
        """,
        plan_id,
        today,
    )


async def get_remaining_sessions(plan_id: str, from_date: date) -> list[asyncpg.Record]:
    return await get_pool().fetch(
        """
        SELECT * FROM training_sessions
        WHERE plan_id = $1 AND scheduled_date >= $2 AND status = 'planned'
        ORDER BY scheduled_date
        """,
        plan_id,
        from_date,
    )


async def update_session(session_id: str, updates: dict[str, Any]) -> None:
    fields = []
    values: list[Any] = []
    i = 1
    for col, val in updates.items():
        fields.append(f"{col} = ${i}")
        values.append(val)
        i += 1
    values.append(session_id)
    await get_pool().execute(
        f"UPDATE training_sessions SET {', '.join(fields)} WHERE id = ${i}",
        *values,
    )
