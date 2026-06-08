"""asyncpg pool and query helpers for coach-service."""
from __future__ import annotations

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
    # Ensure coaching_history schema + table exist (idempotent)
    async with _pool.acquire() as conn:
        await conn.execute("CREATE SCHEMA IF NOT EXISTS coaching_history")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS coaching_history.messages (
                id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role       TEXT        NOT NULL CHECK (role IN ('user', 'model')),
                content    TEXT        NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_coaching_messages_user_time
            ON coaching_history.messages (user_id, created_at DESC)
        """)
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


async def get_today_session_for_user(user_id: str) -> dict | None:
    row = await get_pool().fetchrow(
        """
        SELECT ts.session_type, ts.target_distance_km, ts.target_duration_min,
               ts.target_pace_zone, ts.rpe_target
        FROM training_sessions ts
        JOIN training_plans tp ON ts.plan_id = tp.id
        WHERE tp.user_id = $1
          AND ts.scheduled_date = CURRENT_DATE
          AND ts.status = 'planned'
          AND tp.status = 'active'
        ORDER BY ts.created_at
        LIMIT 1
        """,
        user_id,
    )
    return dict(row) if row else None


async def get_last_run(user_id: str) -> dict | None:
    row = await get_pool().fetchrow(
        """
        SELECT distance_km, duration_sec, avg_pace_sec_km, avg_hr_bpm, started_at
        FROM run_records
        WHERE user_id = $1
        ORDER BY started_at DESC
        LIMIT 1
        """,
        user_id,
    )
    return dict(row) if row else None


async def get_readiness_score(user_id: str) -> float | None:
    row = await get_pool().fetchrow(
        "SELECT score FROM readiness_scores WHERE user_id = $1 AND score_date = CURRENT_DATE",
        user_id,
    )
    return float(row["score"]) if row else None


async def insert_message(user_id: str, role: str, content: str) -> None:
    await get_pool().execute(
        "INSERT INTO coaching_history.messages (user_id, role, content) VALUES ($1, $2, $3)",
        user_id,
        role,
        content,
    )


async def get_recent_history(user_id: str, limit: int = 10) -> list[dict]:
    rows = await get_pool().fetch(
        """
        SELECT role, content, created_at
        FROM coaching_history.messages
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        user_id,
        limit,
    )
    # Return in chronological order (oldest first)
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]
