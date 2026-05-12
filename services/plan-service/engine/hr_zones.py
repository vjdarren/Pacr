"""HR zone derivation using standard percentages of max HR (220 - age)."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class HRZone:
    zone: str          # "Z1" … "Z5"
    min_pct: float
    max_pct: float
    min_bpm: int
    max_bpm: int


# Standard Karvonen-adjacent zone percentages of max HR
_ZONE_BOUNDS: list[tuple[str, float, float]] = [
    ("Z1", 0.00, 0.60),
    ("Z2", 0.60, 0.70),
    ("Z3", 0.70, 0.80),
    ("Z4", 0.80, 0.90),
    ("Z5", 0.90, 1.00),
]


def max_hr(age: int) -> int:
    """220 − age formula."""
    return 220 - max(1, age)


def get_hr_zones(age: int) -> dict[str, HRZone]:
    """Return HR zones Z1–Z5 for the given age."""
    hr_max = max_hr(age)
    return {
        zone: HRZone(
            zone=zone,
            min_pct=lo,
            max_pct=hi,
            min_bpm=round(hr_max * lo),
            max_bpm=round(hr_max * hi),
        )
        for zone, lo, hi in _ZONE_BOUNDS
    }
