"""aioredis helpers for conversation history cache and daily rate limit."""
from __future__ import annotations

import json
from datetime import date

import redis.asyncio as aioredis

from config import settings

_redis: aioredis.Redis | None = None


async def init_redis() -> aioredis.Redis:
    global _redis
    _redis = await aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def close_redis() -> None:
    if _redis:
        await _redis.close()


def get_redis() -> aioredis.Redis:
    if _redis is None:
        raise RuntimeError("Redis not initialised")
    return _redis


def _history_key(user_id: str) -> str:
    return f"coach:history:{user_id}"


def _count_key(user_id: str) -> str:
    return f"coach:count:{user_id}:{date.today().isoformat()}"


async def get_history_cache(user_id: str) -> list[dict] | None:
    raw = await get_redis().get(_history_key(user_id))
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


async def set_history_cache(user_id: str, messages: list[dict]) -> None:
    await get_redis().setex(
        _history_key(user_id),
        settings.history_ttl_seconds,
        json.dumps(messages),
    )


async def get_daily_count(user_id: str) -> int:
    val = await get_redis().get(_count_key(user_id))
    return int(val) if val else 0


async def incr_daily_count(user_id: str) -> int:
    key = _count_key(user_id)
    count = await get_redis().incr(key)
    if count == 1:
        # First message of the day — set TTL to expire at midnight UTC
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        ttl = int((midnight - now).total_seconds())
        await get_redis().expire(key, ttl)
    return count
