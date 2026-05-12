"""Plan adaptation logic for low_readiness, missed_sessions, and user_request."""
from __future__ import annotations

from datetime import date
from typing import Any

from models.schemas import AdaptReason, SessionType, TrainingSessionOut

# Volume reduction factors per reason
_VOLUME_REDUCTION: dict[AdaptReason, float] = {
    AdaptReason.low_readiness:   0.85,  # 15 % reduction
    AdaptReason.missed_sessions: 1.00,  # no volume cut; just note missed work
    AdaptReason.user_request:    0.90,  # 10 % reduction
}

# Session types treated as "quality" (candidate for replacement with easy)
_QUALITY_TYPES = {SessionType.tempo, SessionType.interval, SessionType.race}


def adapt_sessions(
    sessions: list[TrainingSessionOut],
    reason: AdaptReason,
    reference_date: date | None = None,
    details: dict[str, Any] | None = None,
) -> tuple[list[TrainingSessionOut], int]:
    """Return (adapted_sessions, n_modified).

    Only sessions on or after *reference_date* (today by default) are touched.
    """
    today = reference_date or date.today()
    volume_factor = _VOLUME_REDUCTION[reason]
    adapted: list[TrainingSessionOut] = []
    n_modified = 0

    for s in sessions:
        is_past = s.scheduled_date < today
        is_planned = s.status == "planned"

        # missed_sessions is the only reason we act on past planned sessions
        if is_past and reason != AdaptReason.missed_sessions:
            adapted.append(s)
            continue
        if not is_planned:
            adapted.append(s)
            continue

        modified = False

        if reason == AdaptReason.low_readiness:
            # Replace any quality session with an easy run — guardrail for overtraining
            if s.session_type in _QUALITY_TYPES:
                s = _replace_with_easy(s)
                modified = True
            # Scale down distance for all sessions
            if s.target_distance_km is not None:
                new_dist = round(s.target_distance_km * volume_factor, 1)
                s = s.model_copy(
                    update={
                        "target_distance_km": max(3.0, new_dist),
                        "structure": _rebuild_easy_structure(new_dist),
                    }
                )
                modified = True

        elif reason == AdaptReason.user_request:
            if s.target_distance_km is not None:
                new_dist = round(s.target_distance_km * volume_factor, 1)
                s = s.model_copy(update={"target_distance_km": max(3.0, new_dist)})
                modified = True

        elif reason == AdaptReason.missed_sessions:
            # Tag missed planned sessions so downstream services can handle them
            if s.status == "planned" and s.scheduled_date < today:
                s = s.model_copy(update={"status": "skipped"})
                modified = True

        if modified:
            n_modified += 1
        adapted.append(s)

    return adapted, n_modified


def _replace_with_easy(session: TrainingSessionOut) -> TrainingSessionOut:
    from models.schemas import HRZoneEnum, PaceZone

    dist = session.target_distance_km or 8.0
    return session.model_copy(
        update={
            "session_type": SessionType.easy,
            "target_pace_zone": PaceZone.Z2,
            "target_hr_zone": HRZoneEnum.Z2,
            "rpe_target": 4,
            "structure": _rebuild_easy_structure(dist),
        }
    )


def _rebuild_easy_structure(distance_km: float) -> dict:
    return {
        "type": "continuous",
        "pace_zone": "easy",
        "distance_km": round(max(3.0, distance_km), 1),
    }
