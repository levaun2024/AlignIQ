# scoring_engine.py — AlignIQ Phase 1 Normalized & Gated Scoring Engine
from typing import Dict, Optional, Any

DEFAULT_WEIGHTS: Dict[str, int] = {
    "gem": 10,
    "h2h": 60,
    "ros": 30,
}


def clamp(val: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, val))


def normalize_h2h(raw_h2h: float) -> float:
    """Stretch compressed h2h (36-68) onto a full 0-100 scale."""
    return clamp(((float(raw_h2h) - 36.0) / 32.0) * 100.0)


def scale_gematria(raw_gem: float) -> float:
    """Soft-scale Gematria so a single hit cannot hijack heavy favorites."""
    return clamp(float(raw_gem) * 0.85)


def score_matchup(
    home: Dict[str, Any],
    away: Dict[str, Any],
    weights: Optional[Dict[str, int]] = None,
) -> Dict[str, Any]:
    w = {**DEFAULT_WEIGHTS, **(weights or {})}

    h_gem = scale_gematria(home.get("gem", 0))
    a_gem = scale_gematria(away.get("gem", 0))
    h_h2h = normalize_h2h(home.get("h2h", 50))
    a_h2h = normalize_h2h(away.get("h2h", 50))
    h_ros = clamp(float(home.get("ros", 50)))
    a_ros = clamp(float(away.get("ros", 50)))

    home_score = round((h_gem * w["gem"] + h_h2h * w["h2h"] + h_ros * w["ros"]) / 100.0, 2)
    away_score = round((a_gem * w["gem"] + a_h2h * w["h2h"] + a_ros * w["ros"]) / 100.0, 2)

    pick = "home" if home_score >= away_score else "away"

    raw_h_h2h = float(home.get("h2h", 50))
    raw_a_h2h = float(away.get("h2h", 50))
    market_dog = None if raw_h_h2h == raw_a_h2h else ("home" if raw_h_h2h < raw_a_h2h else "away")

    # Underdog Agreement Gate
    dog_gate_triggered = False
    if market_dog and pick == market_dog:
        dog = home if pick == "home" else away
        fav = away if pick == "home" else home

        dog_h2h = float(dog.get("h2h", 50))
        dog_ros = float(dog.get("ros", 50))
        fav_ros = float(fav.get("ros", 50))
        dog_gem = float(dog.get("gem", 0))
        fav_gem = float(fav.get("gem", 0))

        close_market = dog_h2h >= 44.0
        both_agree = (dog_ros > fav_ros) and (dog_gem > fav_gem)
        strong_form_edge = (dog_ros - fav_ros) >= 22.0

        if not (close_market and (both_agree or strong_form_edge)):
            pick = "away" if pick == "home" else "home"
            dog_gate_triggered = True

    return {
        "pick": pick,
        "home_score": home_score,
        "away_score": away_score,
        "confidence_diff": round(abs(home_score - away_score), 2),
        "is_underdog_pick": bool(market_dog and pick == market_dog),
        "dog_gate_triggered": dog_gate_triggered,
        "weights_used": w,
    }
