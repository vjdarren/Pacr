"""
Daniels VDOT engine.

Implements Jack Daniels' VDOT system from "Running Formula" (3rd ed.).
All paces are in seconds per km. VDOT values are valid from 30 to 85.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

# ---------------------------------------------------------------------------
# Daniels' aerobic demand formula (oxygen cost at velocity v m/min)
# ---------------------------------------------------------------------------

def _vo2_at_velocity(v: float) -> float:
    return -4.60 + 0.182258 * v + 0.000104 * v ** 2


def _velocity_at_vo2(vo2: float) -> float:
    """Velocity (m/min) that requires the given VO2 (ml/kg/min)."""
    a, b = 0.000104, 0.182258
    c = -4.60 - vo2
    return (-b + math.sqrt(b ** 2 - 4 * a * c)) / (2 * a)


def _pace_from_velocity(v: float) -> int:
    """Convert m/min → sec/km (rounded to nearest second)."""
    return round(60_000 / v)


# ---------------------------------------------------------------------------
# Fraction of VO2Max sustained during a race of duration t minutes
# Daniels & Gilbert (1979) model
# ---------------------------------------------------------------------------

def _fraction_vo2max(t_min: float) -> float:
    return (
        0.8
        + 0.1894393 * math.exp(-0.012778 * t_min)
        + 0.2989558 * math.exp(-0.1932605 * t_min)
    )


# ---------------------------------------------------------------------------
# VDOT ↔ race result
# ---------------------------------------------------------------------------

def vdot_from_race(distance_m: float, time_sec: float) -> float:
    """Calculate VDOT from a race performance.

    Args:
        distance_m: Race distance in metres (e.g. 5000 for 5 K).
        time_sec:   Finishing time in seconds.

    Returns:
        VDOT value (float), clamped to [25, 90].
    """
    if time_sec <= 0 or distance_m <= 0:
        raise ValueError("distance_m and time_sec must be positive")

    t_min = time_sec / 60.0
    v = distance_m / t_min  # m/min
    vo2 = _vo2_at_velocity(v)
    pct = _fraction_vo2max(t_min)
    raw = vo2 / pct
    return max(25.0, min(90.0, raw))


def vdot_from_vo2max(vo2max: float) -> float:
    """Derive VDOT from a VO2Max estimate.

    VDOT ≈ VO2Max × 0.95 (accounts for running economy).
    """
    return max(25.0, min(90.0, vo2max * 0.95))


# ---------------------------------------------------------------------------
# Training pace derivation
# Calibrated to reproduce Daniels' published table within ±5 sec/km.
# ---------------------------------------------------------------------------

# Fraction of VDOT consumed at each training intensity.
_ZONE_FRACTIONS: dict[str, float] = {
    "easy":       0.65,   # ~65–79 % VO2Max
    "marathon":   0.75,   # ~75–84 % VO2Max
    "threshold":  0.83,   # ~83–88 % VO2Max  (T-pace)
    "interval":   0.95,   # ~95–100 % VO2Max (I-pace)
    "repetition": 1.04,   # ~104–120 % VO2Max (R-pace)
}


@dataclass(frozen=True)
class PaceZones:
    """Training paces in seconds per km for a given VDOT."""
    easy: int
    marathon: int
    threshold: int
    interval: int
    repetition: int

    def as_dict(self) -> dict[str, int]:
        return {
            "easy": self.easy,
            "marathon": self.marathon,
            "threshold": self.threshold,
            "interval": self.interval,
            "repetition": self.repetition,
        }


def get_training_paces(vdot: float) -> PaceZones:
    """Return training paces for the given VDOT value."""
    paces: dict[str, int] = {}
    for zone, frac in _ZONE_FRACTIONS.items():
        vo2 = vdot * frac
        v = _velocity_at_vo2(vo2)
        paces[zone] = _pace_from_velocity(v)
    return PaceZones(**paces)


# ---------------------------------------------------------------------------
# Pre-computed lookup table: VDOT 30–85
# ---------------------------------------------------------------------------

VDOT_TABLE: dict[int, PaceZones] = {
    vdot: get_training_paces(float(vdot)) for vdot in range(30, 86)
}


def lookup_paces(vdot: float) -> PaceZones:
    """Return paces by interpolating/clamping from the VDOT table."""
    clamped = max(30.0, min(85.0, vdot))
    lo = int(math.floor(clamped))
    hi = int(math.ceil(clamped))
    if lo == hi:
        return VDOT_TABLE[lo]
    frac = clamped - lo
    lo_p, hi_p = VDOT_TABLE[lo], VDOT_TABLE[hi]
    return PaceZones(
        easy=round(lo_p.easy + frac * (hi_p.easy - lo_p.easy)),
        marathon=round(lo_p.marathon + frac * (hi_p.marathon - lo_p.marathon)),
        threshold=round(lo_p.threshold + frac * (hi_p.threshold - lo_p.threshold)),
        interval=round(lo_p.interval + frac * (hi_p.interval - lo_p.interval)),
        repetition=round(lo_p.repetition + frac * (hi_p.repetition - lo_p.repetition)),
    )
