"""Coach chat routes."""
from __future__ import annotations

import asyncio
import logging

import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException, status

import database
import kafka_client
import redis_client
from auth import get_current_user
from config import settings
from models.schemas import HistoryItem, HistoryResponse, MessageRequest, MessageResponse

log = logging.getLogger(__name__)
router = APIRouter()


def _format_session(session: dict | None) -> str:
    if not session:
        return "Rest day"
    parts = [session["session_type"].replace("_", " ").title()]
    if session.get("target_distance_km"):
        parts.append(f"{session['target_distance_km']} km")
    if session.get("target_pace_zone"):
        parts.append(f"pace zone {session['target_pace_zone']}")
    if session.get("target_duration_min"):
        parts.append(f"~{session['target_duration_min']} min")
    return ", ".join(parts)


def _format_run(run: dict | None) -> str:
    if not run:
        return "No recent run"
    mins = (run["duration_sec"] or 0) // 60
    pace = run["avg_pace_sec_km"] or 0
    pace_str = f"{pace // 60}:{pace % 60:02d}/km" if pace else "unknown pace"
    return f"{run['distance_km'] or 0:.1f} km in {mins} min at {pace_str}"


def _build_system_prompt(session: dict | None, run: dict | None, readiness: float | None) -> str:
    return f"""You are Pacr, a professional AI running coach. You are evidence-based, encouraging, and safety-first.

SAFETY RULES — never violate these:
- Never diagnose injuries. If the athlete mentions pain, always say: "I'd recommend seeing a physiotherapist for that."
- Never suggest training increases of more than 10% weekly mileage.
- If readiness score is below 30, always recommend rest as the first priority.

TODAY'S CONTEXT:
- Readiness score: {f"{readiness:.0f}/100" if readiness is not None else "unknown"}
- Today's session: {_format_session(session)}
- Last run: {_format_run(run)}

Keep responses concise (2-4 sentences) unless the athlete explicitly asks for more detail.
Always refer to the athlete in second person ("you", "your")."""


@router.post("/api/v1/coach/message", response_model=MessageResponse)
async def send_message(
    req: MessageRequest,
    user_id: str = Depends(get_current_user),
) -> MessageResponse:
    # 1. Rate limit check
    count = await redis_client.get_daily_count(user_id)
    if count >= settings.daily_message_limit_free:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Daily message limit reached. Upgrade to Pro for unlimited coaching.",
        )

    # 2. Build context (run in parallel)
    session, run, readiness = await asyncio.gather(
        database.get_today_session_for_user(user_id),
        database.get_last_run(user_id),
        database.get_readiness_score(user_id),
        return_exceptions=False,
    )

    # 3. Get conversation history from Redis, fall back to DB
    history = await redis_client.get_history_cache(user_id)
    if history is None:
        history = await database.get_recent_history(user_id, limit=settings.max_history_messages)

    # 4. Call Gemini 2.5 Flash
    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(
        model_name=settings.gemini_model,
        system_instruction=_build_system_prompt(session, run, readiness),
        generation_config=genai.GenerationConfig(max_output_tokens=settings.gemini_max_tokens),
    )

    # Convert stored history to Gemini's Content format
    gemini_history = [
        {"role": msg["role"], "parts": [msg["content"]]}
        for msg in history
    ]

    chat = model.start_chat(history=gemini_history)

    try:
        response = await asyncio.to_thread(chat.send_message, req.message)
        reply_text = response.text
    except Exception as exc:
        log.error("Gemini API error: %s", exc)
        raise HTTPException(status_code=503, detail="Coach is temporarily unavailable")

    # 5. Persist both messages to DB
    await asyncio.gather(
        database.insert_message(user_id, "user", req.message),
        database.insert_message(user_id, "model", reply_text),
    )

    # 6. Update Redis cache (keep last max_history_messages)
    updated_history = history + [
        {"role": "user", "content": req.message},
        {"role": "model", "content": reply_text},
    ]
    await redis_client.set_history_cache(
        user_id, updated_history[-settings.max_history_messages:]
    )

    # 7. Increment daily counter
    await redis_client.incr_daily_count(user_id)

    # 8. Publish Kafka event (fire and forget)
    asyncio.create_task(
        kafka_client.publish_coaching_message(user_id, req.message, reply_text)
    )

    return MessageResponse(
        reply=reply_text,
        remaining_messages=max(0, settings.daily_message_limit_free - count - 1),
    )


@router.get("/api/v1/coach/history", response_model=HistoryResponse)
async def get_history(
    user_id: str = Depends(get_current_user),
) -> HistoryResponse:
    history = await redis_client.get_history_cache(user_id)
    if history is None:
        history = await database.get_recent_history(user_id, limit=settings.max_history_messages)

    return HistoryResponse(
        messages=[HistoryItem(role=m["role"], content=m["content"]) for m in history]
    )
