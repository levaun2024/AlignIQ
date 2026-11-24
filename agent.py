import json
import os
from datetime import datetime, timezone, timedelta
from collections import defaultdict

HISTORY_FILE = "history.json"
REPORT_FILE = "agent_report.json"
TARGET_WIN_RATE = 95.0

# Phase 4 Guardrails
MIN_GLOBAL_SAMPLE = 500
MIN_LEAGUE_SAMPLE = 100
MIN_ODDS_SAMPLE_FOR_ROI = 50

# Default & League-Specific Weight Profiles (gem / h2h / ros)
DEFAULT_WEIGHTS = {"gem": 10, "h2h": 60, "ros": 30}

LEAGUE_DEFAULT_WEIGHTS = {
    "NBA": {"gem": 10, "h2h": 60, "ros": 30},
    "NFL": {"gem": 10, "h2h": 60, "ros": 30},
    "MLB": {"gem": 10, "h2h": 60, "ros": 30},
    "WNBA": {"gem": 10, "h2h": 60, "ros": 30},
    "UFC": {"gem": 10, "h2h": 60, "ros": 30},
    "NHL": {"gem": 10, "h2h": 55, "ros": 35},
    "EPL": {"gem": 10, "h2h": 55, "ros": 35},
    "MLS": {"gem": 10, "h2h": 55, "ros": 35},
    "UCL": {"gem": 10, "h2h": 55, "ros": 35},
    "NCAAF": {"gem": 8, "h2h": 68, "ros": 24},
    "NCAAB": {"gem": 8, "h2h": 68, "ros": 24},
    "NCAAW": {"gem": 8, "h2h": 68, "ros": 24},
}


def load_json(path, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def safe_float(val, default=50.0):
    try:
        return float(str(val).replace("%", "").strip())
    except Exception:
        return default


def safe_optional_float(val):
    if val is None or val == "":
        return None
    try:
        return float(str(val).replace("%", "").strip())
    except Exception:
        return None


def clamp(val, low=0.0, high=100.0):
    return max(low, min(high, float(val)))


def american_to_decimal(ml):
    """Converts American moneyline (-145, +125) to decimal odds."""
    val = safe_optional_float(ml)
    if val is None or val == 0:
        return None
    if val > 0:
        return 1.0 + (val / 100.0)
    return 1.0 + (100.0 / abs(val))


def normalize_h2h(raw_h2h):
    """Stretch compressed h2h (36-68) onto a full 0-100 scale."""
    return clamp(((safe_float(raw_h2h, 50.0) - 36.0) / 32.0) * 100.0)


def scale_gematria(raw_gem):
    """Soft-scale Gematria so a single hit cannot hijack heavy favorites."""
    return clamp(safe_float(raw_gem, 0.0) * 0.85)


def normalize_weights(w):
    total = max(1, w["gem"] + w["h2h"] + w["ros"])
    gem = round((w["gem"] / total) * 100)
    h2h = round((w["h2h"] / total) * 100)
    ros = 100 - gem - h2h
    return {"gem": max(5, gem), "h2h": max(20, h2h), "ros": max(10, ros)}


def get_league_weights(league, league_weights_map=None, fallback_weights=None):
    lg = str(league or "").upper().strip()
    if isinstance(league_weights_map, dict) and isinstance(league_weights_map.get(lg), dict):
        return dict(league_weights_map[lg])
    if lg in LEAGUE_DEFAULT_WEIGHTS:
        return dict(LEAGUE_DEFAULT_WEIGHTS[lg])
    return dict(fallback_weights or DEFAULT_WEIGHTS)


def score_matchup(
    home,
    away,
    weights=None,
    league=None,
    rest_days=None,
    splits=None,
    open_h2h=None,
    close_h2h=None,
    starter_flag=None,
):
    """Normalized scoring + Rest/Splits/Line Move + Underdog Agreement Gate."""
    w = weights if isinstance(weights, dict) else get_league_weights(league)

    h_gem = scale_gematria(home.get("gem", 0))
    a_gem = scale_gematria(away.get("gem", 0))
    h_h2h = normalize_h2h(home.get("h2h", 50))
    a_h2h = normalize_h2h(away.get("h2h", 50))
    h_ros = clamp(safe_float(home.get("ros", 50), 50.0))
    a_ros = clamp(safe_float(away.get("ros", 50), 50.0))

    # 1. Rest / Back-to-Back Fatigue (-6 pts on B2B vs rested opponent)
    if isinstance(rest_days, dict):
        h_rest = safe_optional_float(rest_days.get("home"))
        a_rest = safe_optional_float(rest_days.get("away"))
        if h_rest == 0 and (a_rest is None or a_rest >= 1):
            h_ros = clamp(h_ros - 6.0)
        if a_rest == 0 and (h_rest is None or h_rest >= 1):
            a_ros = clamp(a_ros - 6.0)

    # 2. Home vs. Road Splits adjustment
    if isinstance(splits, dict):
        h_sp = safe_optional_float(splits.get("home_at_home_pct"))
        a_sp = safe_optional_float(splits.get("away_on_road_pct"))
        if h_sp is not None and a_sp is not None:
            split_adj = max(-6.0, min(6.0, (h_sp - a_sp) * 10.0))
            h_ros = clamp(h_ros + split_adj)
            a_ros = clamp(a_ros - split_adj)

    # 3. Confirmed Starter / Backup Goalie penalty
    if isinstance(starter_flag, dict):
        if str(starter_flag.get("home", "")).lower() in ("backup_goalie", "star_out"):
            h_ros = clamp(h_ros - 6.0)
        if str(starter_flag.get("away", "")).lower() in ("backup_goalie", "star_out"):
            a_ros = clamp(a_ros - 6.0)

    # 4. Line Movement (Sharp Action)
    h_move, a_move = 0.0, 0.0
    if isinstance(open_h2h, dict) and isinstance(close_h2h, dict):
        h_move = safe_float(close_h2h.get("home", home.get("h2h", 50)), 50.0) - safe_float(
            open_h2h.get("home", home.get("h2h", 50)), 50.0
        )
        a_move = safe_float(close_h2h.get("away", away.get("h2h", 50)), 50.0) - safe_float(
            open_h2h.get("away", away.get("h2h", 50)), 50.0
        )
        if h_move >= 3.0:
            h_h2h = clamp(h_h2h + 3.0)
        if a_move >= 3.0:
            a_h2h = clamp(a_h2h + 3.0)

    total_w = max(1, w["gem"] + w["h2h"] + w["ros"])
    home_score = round((h_gem * w["gem"] + h_h2h * w["h2h"] + h_ros * w["ros"]) / total_w, 2)
    away_score = round((a_gem * w["gem"] + a_h2h * w["h2h"] + a_ros * w["ros"]) / total_w, 2)

    pick = "home" if home_score >= away_score else "away"

    raw_h_h2h = safe_float(home.get("h2h", 50), 50.0)
    raw_a_h2h = safe_float(away.get("h2h", 50), 50.0)
    market_dog = None if raw_h_h2h == raw_a_h2h else ("home" if raw_h_h2h < raw_a_h2h else "away")

    # Underdog Agreement Gate
    dog_gate_triggered = False
    if market_dog and pick == market_dog:
        dog = home if pick == "home" else away
        fav = away if pick == "home" else home

        dog_h2h = safe_float(dog.get("h2h", 50), 50.0)
        dog_ros = h_ros if pick == "home" else a_ros
        fav_ros = a_ros if pick == "home" else h_ros
        dog_gem = safe_float(dog.get("gem", 0), 0.0)
        fav_gem = safe_float(fav.get("gem", 0), 0.0)
        dog_move = h_move if pick == "home" else a_move

        close_market = dog_h2h >= 44.0
        both_agree = (dog_ros > fav_ros) and (dog_gem > fav_gem)
        strong_form_edge = (dog_ros - fav_ros) >= 22.0
        sharp_move = dog_move >= 3.0

        if not (close_market and (both_agree or strong_form_edge or sharp_move)):
            pick = "away" if pick == "home" else "home"
            dog_gate_triggered = True

    diff = abs(home_score - away_score)
    confidence = round(clamp(50.0 + (diff * 0.5), 50.0, 99.0), 1)

    return {
        "pick": pick,
        "home_score": home_score,
        "away_score": away_score,
        "confidence": confidence,
        "is_underdog_pick": bool(market_dog and pick == market_dog),
        "dog_gate_triggered": dog_gate_triggered,
        "line_move": round(h_move if pick == "home" else a_move, 2),
        "weights_used": w,
    }


def normalize_history(raw, fallback_date):
    if isinstance(raw, dict) and isinstance(raw.get("dates"), dict):
        dates = {}
        for d_key, val in raw["dates"].items():
            if isinstance(val, list):
                dates[str(d_key)[:10]] = {"games": val}
            elif isinstance(val, dict):
                val.setdefault("games", [])
                dates[str(d_key)[:10]] = val
        return {"dates": dates}

    dates = {}
    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            d_raw = item.get("date") or item.get("game_date") or item.get("day") or fallback_date
            d_str = str(d_raw)[:10]
            if isinstance(item.get("games"), list):
                entry = dates.setdefault(d_str, {"games": []})
                entry["games"].extend(item["games"])
                for k in ("algo_version", "weights_used", "locked"):
                    if k in item:
                        entry[k] = item[k]
            else:
                dates.setdefault(d_str, {"games": []})["games"].append(item)
        return {"dates": dates}

    if isinstance(raw, dict):
        for k, v in raw.items():
            d_str = str(k)[:10]
            if isinstance(v, list):
                dates[d_str] = {"games": v}
            elif isinstance(v, dict):
                v.setdefault("games", [])
                dates[d_str] = v
        return {"dates": dates}

    return {"dates": {}}


def ensure_frozen_snapshots(history, active_version, active_weights):
    dates = history.setdefault("dates", {})
    for date_str, entry in dates.items():
        if isinstance(entry, list):
            entry = {"games": entry}
            dates[date_str] = entry
        if not entry.get("locked"):
            entry["algo_version"] = entry.get("algo_version", active_version)
            entry["weights_used"] = entry.get("weights_used", dict(active_weights))
            entry["locked"] = True
        for g in entry.get("games", []):
            if not isinstance(g, dict):
                continue
            g.setdefault("algo_version", entry["algo_version"])
            g.setdefault("weights_used", entry["weights_used"])
            g.setdefault("factors", {
                "gematria_score": 0,
                "gematria_hits": 0,
                "odds_edge": 0,
                "form_health_score": 0,
                "references": []
            })
            g.setdefault("home_ml", None)
            g.setdefault("away_ml", None)
            h_h2h = g.get("home", {}).get("h2h", 50) if isinstance(g.get("home"), dict) else 50
            a_h2h = g.get("away", {}).get("h2h", 50) if isinstance(g.get("away"), dict) else 50
            g.setdefault("open_h2h", {"home": h_h2h, "away": a_h2h})
            g.setdefault("close_h2h", {"home": h_h2h, "away": a_h2h})
            g.setdefault("rest_days", {"home": None, "away": None})
            g.setdefault("splits", {"home_at_home_pct": None, "away_on_road_pct": None})
            g.setdefault("starter_flag", {"home": "unknown", "away": "unknown"})
    return history


def extract_graded_games(history, league_weights_map=None):
    graded = []
    for date_str, entry in sorted(history.get("dates", {}).items()):
        for g in entry.get("games", []):
            if not isinstance(g, dict):
                continue

            league = g.get("league", "OTHER")
            weights_used = get_league_weights(league, league_weights_map, g.get("weights_used") or entry.get("weights_used"))
            factors = dict(g.get("factors", {})) if isinstance(g.get("factors"), dict) else {}

            actual_winner = str(g.get("actual_winner") or "").lower().strip()
            if actual_winner in ("home", "away") and isinstance(g.get("home"), dict) and isinstance(g.get("away"), dict):
                scored = score_matchup(
                    g["home"],
                    g["away"],
                    weights=weights_used,
                    league=league,
                    rest_days=g.get("rest_days"),
                    splits=g.get("splits"),
                    open_h2h=g.get("open_h2h"),
                    close_h2h=g.get("close_h2h"),
                    starter_flag=g.get("starter_flag"),
                )
                pick_side = scored["pick"]
                picked_team = g[pick_side]
                opp_team = g["away" if pick_side == "home" else "home"]
                won = pick_side == actual_winner

                if safe_float(factors.get("gematria_score", 0), 0) == 0:
                    factors["gematria_score"] = safe_float(picked_team.get("gem", 0), 0)
                if safe_float(factors.get("odds_edge", 0), 0) == 0:
                    factors["odds_edge"] = safe_float(picked_team.get("h2h", 50), 50) - safe_float(opp_team.get("h2h", 50), 50)
                if safe_float(factors.get("form_health_score", 0), 0) == 0:
                    factors["form_health_score"] = safe_float(picked_team.get("ros", 50), 50)

                picked_ml = g.get(f"{pick_side}_ml")
                dec_odds = american_to_decimal(picked_ml)
                unit_pnl = round((dec_odds - 1.0) if won else -1.0, 4) if dec_odds else None

                graded.append({
                    "date": date_str,
                    "league": league,
                    "matchup": g.get("matchup", g.get("id", "Game")),
                    "pick": pick_side,
                    "confidence": scored["confidence"],
                    "win": won,
                    "is_underdog_pick": scored["is_underdog_pick"],
                    "picked_ml": picked_ml,
                    "unit_pnl": unit_pnl,
                    "line_move": scored["line_move"],
                    "final_score": g.get("final_score", ""),
                    "algo_version": g.get("algo_version", entry.get("algo_version", "v1")),
                    "weights_used": weights_used,
                    "factors": factors,
                    "raw_game": g,
                })
                continue

            res = str(g.get("result") or g.get("outcome") or g.get("grade") or "").upper().strip()
            if res in ("W", "L", "WIN", "LOSS"):
                won = res in ("W", "WIN")
                pick_side = str(g.get("pick", "")).lower().strip()
                picked_ml = g.get(f"{pick_side}_ml") if pick_side in ("home", "away") else None
                dec_odds = american_to_decimal(picked_ml)
                unit_pnl = round((dec_odds - 1.0) if won else -1.0, 4) if dec_odds else None

                graded.append({
                    "date": date_str,
                    "league": league,
                    "matchup": g.get("matchup", f"{g.get('away','Away')} @ {g.get('home','Home')}"),
                    "pick": g.get("pick", ""),
                    "confidence": safe_float(g.get("confidence", 50)),
                    "win": won,
                    "is_underdog_pick": bool(g.get("is_underdog_pick", False)),
                    "picked_ml": picked_ml,
                    "unit_pnl": unit_pnl,
                    "line_move": 0.0,
                    "final_score": g.get("final_score", ""),
                    "algo_version": g.get("algo_version", entry.get("algo_version", "v1")),
                    "weights_used": weights_used,
                    "factors": factors,
                    "raw_game": None,
                })
    return graded


def analyze_factors(games):
    buckets = {
        "gematria": {"label": "Gematria Convergence (2+ Hits)", "w": 0, "n": 0, "units": 0.0, "odds_n": 0},
        "odds": {"label": "Fair Odds / +EV Edge", "w": 0, "n": 0, "units": 0.0, "odds_n": 0},
        "form_health": {"label": "L5/L10 Form, Health & Weight Cut", "w": 0, "n": 0, "units": 0.0, "odds_n": 0},
        "high_conf": {"label": "70%+ High Confidence Picks", "w": 0, "n": 0, "units": 0.0, "odds_n": 0},
        "underdogs": {"label": "Market Underdog Picks", "w": 0, "n": 0, "units": 0.0, "odds_n": 0},
    }
    by_league = defaultdict(lambda: {"w": 0, "n": 0, "units": 0.0, "odds_n": 0})
    calibration = {"50-59%": {"w": 0, "n": 0}, "60-69%": {"w": 0, "n": 0}, "70-79%": {"w": 0, "n": 0}, "80%+": {"w": 0, "n": 0}}
    daily_trend = defaultdict(lambda: {"w": 0, "n": 0})

    total_units = 0.0
    total_odds_n = 0

    for g in games:
        f = g["factors"]
        win = 1 if g["win"] else 0
        pnl = g.get("unit_pnl")
        has_odds = pnl is not None

        if has_odds:
            total_units += pnl
            total_odds_n += 1

        def add_bucket(key):
            buckets[key]["n"] += 1
            buckets[key]["w"] += win
            if has_odds:
                buckets[key]["units"] += pnl
                buckets[key]["odds_n"] += 1

        if safe_float(f.get("gematria_hits", 0), 0) >= 2 or safe_float(f.get("gematria_score", 0), 0) >= 42:
            add_bucket("gematria")
        if safe_float(f.get("odds_edge", 0), 0) > 0:
            add_bucket("odds")
        if safe_float(f.get("form_health_score", 0), 0) >= 60:
            add_bucket("form_health")
        if g["confidence"] >= 70:
            add_bucket("high_conf")
        if g.get("is_underdog_pick"):
            add_bucket("underdogs")

        by_league[g["league"]]["n"] += 1
        by_league[g["league"]]["w"] += win
        if has_odds:
            by_league[g["league"]]["units"] += pnl
            by_league[g["league"]]["odds_n"] += 1

        c = g["confidence"]
        cal_key = "80%+" if c >= 80 else ("70-79%" if c >= 70 else ("60-69%" if c >= 60 else "50-59%"))
        calibration[cal_key]["n"] += 1
        calibration[cal_key]["w"] += win

        daily_trend[g["date"]]["n"] += 1
        daily_trend[g["date"]]["w"] += win

    total_n = len(games)
    total_w = sum(1 for g in games if g["win"])
    overall_rate = round((total_w / total_n) * 100, 1) if total_n else 0.0
    overall_roi = round((total_units / total_odds_n) * 100, 1) if total_odds_n else None

    factor_metrics = {}
    for k, v in buckets.items():
        rate = round((v["w"] / v["n"]) * 100, 1) if v["n"] else 0.0
        roi = round((v["units"] / v["odds_n"]) * 100, 1) if v["odds_n"] else None
        factor_metrics[k] = {
            "label": v["label"],
            "wins": v["w"],
            "losses": v["n"] - v["w"],
            "total": v["n"],
            "win_rate": rate,
            "lift_vs_avg": round(rate - overall_rate, 1) if v["n"] else 0.0,
            "net_units": round(v["units"], 2) if v["odds_n"] else None,
            "roi_pct": roi,
        }

    league_metrics = {
        lg: {
            "wins": v["w"],
            "losses": v["n"] - v["w"],
            "total": v["n"],
            "win_rate": round((v["w"] / v["n"]) * 100, 1) if v["n"] else 0.0,
            "net_units": round(v["units"], 2) if v["odds_n"] else None,
            "roi_pct": round((v["units"] / v["odds_n"]) * 100, 1) if v["odds_n"] else None,
        }
        for lg, v in sorted(by_league.items())
    }

    cal_metrics = {
        k: {"wins": v["w"], "total": v["n"], "actual_rate": round((v["w"] / v["n"]) * 100, 1) if v["n"] else 0.0}
        for k, v in calibration.items()
    }

    trend_series = [
        {"date": d, "wins": v["w"], "total": v["n"], "win_rate": round((v["w"] / v["n"]) * 100, 1) if v["n"] else 0.0}
        for d, v in sorted(daily_trend.items())[-30:]
    ]

    return {
        "wins": total_w,
        "losses": total_n - total_w,
        "total": total_n,
        "win_rate": overall_rate,
        "graded_with_odds": total_odds_n,
        "net_units": round(total_units, 2) if total_odds_n else None,
        "roi_pct": overall_roi,
        "gap_to_target": round(max(0.0, TARGET_WIN_RATE - overall_rate), 1),
        "underdogs": factor_metrics["underdogs"],
        "factors": factor_metrics,
        "leagues": league_metrics,
        "calibration": cal_metrics,
        "daily_trend": trend_series
    }


def evaluate_candidate_weights(games, candidate_w):
    """Evaluates a candidate weight split on graded games, returning (use_roi, metric_val, win_pct)."""
    wins = 0
    total = 0
    units = 0.0
    odds_n = 0

    for item in games:
        g = item.get("raw_game")
        if not g:
            continue
        actual = str(g.get("actual_winner") or "").lower().strip()
        if actual not in ("home", "away"):
            continue
        res = score_matchup(
            g["home"],
            g["away"],
            weights=candidate_w,
            league=g.get("league"),
            rest_days=g.get("rest_days"),
            splits=g.get("splits"),
            open_h2h=g.get("open_h2h"),
            close_h2h=g.get("close_h2h"),
            starter_flag=g.get("starter_flag"),
        )
        won = res["pick"] == actual
        total += 1
        if won:
            wins += 1
        dec = american_to_decimal(g.get(f"{res['pick']}_ml"))
        if dec:
            odds_n += 1
            units += (dec - 1.0) if won else -1.0

    win_pct = (wins / total) * 100.0 if total else 0.0
    if odds_n >= MIN_ODDS_SAMPLE_FOR_ROI:
        roi_pct = (units / odds_n) * 100.0
        return True, roi_pct, win_pct
    return False, win_pct, win_pct


def optimize_weights_roi(current_weights, games, min_sample, label="Global"):
    """Phase 4: ROI-based bounded grid search (±6% max shift) with sample-size guardrail."""
    struct_games = [g for g in games if g.get("raw_game")]
    if len(struct_games) < min_sample:
        return dict(current_weights), f"{label} held ({len(struct_games)}/{min_sample} graded games required)."

    use_roi, base_metric, base_win = evaluate_candidate_weights(struct_games, current_weights)
    best_w = dict(current_weights)
    best_metric = base_metric

    # Bounded grid search: max ±6% shift per pillar in 2% steps
    for d_gem in (-6, -4, -2, 0, 2, 4, 6):
        for d_h2h in (-6, -4, -2, 0, 2, 4, 6):
            cand_gem = current_weights["gem"] + d_gem
            cand_h2h = current_weights["h2h"] + d_h2h
            cand_ros = 100 - cand_gem - cand_h2h
            if not (5 <= cand_gem <= 25 and 35 <= cand_h2h <= 75 and 15 <= cand_ros <= 50):
                continue
            if abs(cand_ros - current_weights["ros"]) > 6:
                continue
            cand = {"gem": cand_gem, "h2h": cand_h2h, "ros": cand_ros}
            _, metric, _ = evaluate_candidate_weights(struct_games, cand)
            # Require at least +0.25% improvement to avoid churning weights on noise
            if metric > best_metric + 0.25:
                best_metric = metric
                best_w = cand

    mode = "ROI" if use_roi else "Win%"
    if best_w == current_weights:
        return best_w, f"{label} weights optimal ({mode}: {base_metric:.1f}% across {len(struct_games)} games)."
    return best_w, (
        f"{label} tuned by {mode}: {base_metric:.1f}% -> {best_metric:.1f}% "
        f"({best_w['gem']}/{best_w['h2h']}/{best_w['ros']} on {len(struct_games)} games)."
    )


def build_suggestions(stats, current_weights):
    working, not_working, suggestions = [], [], []
    for k in ("gematria", "odds", "form_health"):
        m = stats["factors"][k]
        if m["total"] == 0:
            continue
        if m["lift_vs_avg"] >= 2.0:
            working.append(f"{m['label']} is outperforming at {m['win_rate']}% (+{m['lift_vs_avg']}% lift over baseline).")
        elif m["lift_vs_avg"] <= -2.0:
            not_working.append(f"{m['label']} is lagging at {m['win_rate']}% ({m['lift_vs_avg']}% vs baseline).")

    dog = stats.get("underdogs", {})
    if dog.get("total", 0) > 0:
        roi_txt = f" ({dog['roi_pct']:+.1f}% ROI)" if dog.get("roi_pct") is not None else ""
        if dog["win_rate"] >= 45.0:
            working.append(f"Underdog Gate picks are cashing at {dog['win_rate']}% ({dog['wins']}-{dog['losses']}){roi_txt}.")
        else:
            not_working.append(f"Underdog picks are at {dog['win_rate']}% ({dog['wins']}-{dog['losses']}){roi_txt}.")

    for lg, lm in stats["leagues"].items():
        if lm["total"] >= 5 and lm["win_rate"] >= 70.0:
            working.append(f"{lg} is strong at {lm['win_rate']}% ({lm['wins']}-{lm['losses']}).")
        elif lm["total"] >= 5 and lm["win_rate"] < 52.0:
            not_working.append(f"{lg} is underperforming at {lm['win_rate']}% ({lm['wins']}-{lm['losses']}).")

    if stats["total"] < MIN_GLOBAL_SAMPLE:
        suggestions.append(
            f"Sample guardrail active: {stats['total']}/{MIN_GLOBAL_SAMPLE} total games logged before global auto-tuning unlocks."
        )
    if stats.get("graded_with_odds", 0) < MIN_ODDS_SAMPLE_FOR_ROI:
        suggestions.append(
            f"Log home_ml/away_ml on upcoming slates ({stats.get('graded_with_odds', 0)}/{MIN_ODDS_SAMPLE_FOR_ROI}) to activate ROI-first tuning."
        )
    if not working:
        working.append("Baseline multi-pillar balance is holding steady; gathering more graded samples.")
    if not not_working:
        not_working.append("No major pillar breakdowns detected in the current sample.")
    return working, not_working, suggestions


def main():
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    month_tag = now.strftime("%Y-%m")
    force_rebalance = os.getenv("FORCE_REBALANCE", "false").lower() == "true"

    default_report = {
        "algo_version": f"{month_tag}-phase4",
        "rebalance_cadence": "monthly",
        "target_win_rate": TARGET_WIN_RATE,
        "weights": dict(DEFAULT_WEIGHTS),
        "league_weights": {k: dict(v) for k, v in LEAGUE_DEFAULT_WEIGHTS.items()},
        "last_rebalance_month": "",
        "weight_history": [],
        "biweekly_reports": []
    }
    report = load_json(REPORT_FILE, default_report)
    if not isinstance(report, dict):
        report = default_report

    active_weights = report.get("weights") if isinstance(report.get("weights"), dict) else dict(DEFAULT_WEIGHTS)
    league_weights = {k: dict(v) for k, v in LEAGUE_DEFAULT_WEIGHTS.items()}
    if isinstance(report.get("league_weights"), dict):
        for lg, lw in report["league_weights"].items():
            if isinstance(lw, dict):
                league_weights[lg] = lw
    active_version = f"{month_tag}-phase4"

    raw_history = load_json(HISTORY_FILE, {"dates": {}})
    history = normalize_history(raw_history, today_str)
    history = ensure_frozen_snapshots(history, active_version, active_weights)

    all_graded = extract_graded_games(history, league_weights)
    cutoff_60 = (now - timedelta(days=60)).strftime("%Y-%m-%d")
    cutoff_14 = (now - timedelta(days=14)).strftime("%Y-%m-%d")

    recent_60 = [g for g in all_graded if g["date"] >= cutoff_60]
    recent_14 = [g for g in all_graded if g["date"] >= cutoff_14]

    stats_60 = analyze_factors(recent_60)
    stats_14 = analyze_factors(recent_14)
    working, not_working, suggestions = build_suggestions(stats_60, active_weights)

    # Phase 4: Monthly ROI-Based Rebalance with 500-Global / 100-League Guardrails
    rebalance_note = (
        f"Phase 4 active (ROI Tuner + {MIN_GLOBAL_SAMPLE}g/{MIN_LEAGUE_SAMPLE}g guardrails). "
        f"Next rebalance: 1st of next month."
    )
    if (now.day == 1 and report.get("last_rebalance_month") != month_tag) or force_rebalance:
        prev_weights = dict(active_weights)
        notes = []

        new_global, g_note = optimize_weights_roi(active_weights, all_graded, MIN_GLOBAL_SAMPLE, "Global")
        active_weights = new_global
        notes.append(g_note)

        # Tune each league independently once it hits 100+ graded games
        by_lg = defaultdict(list)
        for g in all_graded:
            by_lg[g["league"]].append(g)
        for lg, lg_games in sorted(by_lg.items()):
            if len(lg_games) >= MIN_LEAGUE_SAMPLE:
                cur_lw = get_league_weights(lg, league_weights, active_weights)
                new_lw, l_note = optimize_weights_roi(cur_lw, lg_games, MIN_LEAGUE_SAMPLE, lg)
                league_weights[lg] = new_lw
                notes.append(l_note)

        rebalance_note = " | ".join(notes)
        report["last_rebalance_month"] = month_tag
        report.setdefault("weight_history", []).append({
            "date": today_str,
            "algo_version": active_version,
            "previous": prev_weights,
            "updated": active_weights,
            "win_rate_at_rebalance": stats_60["win_rate"],
            "roi_at_rebalance": stats_60["roi_pct"],
            "note": rebalance_note
        })
        report["weight_history"] = report["weight_history"][-24:]

    biweekly_list = report.setdefault("biweekly_reports", [])
    already_logged = any(r.get("period_end") == today_str for r in biweekly_list)
    if (now.day in (1, 15) or not biweekly_list) and not already_logged:
        bw_working, bw_not_working, bw_suggestions = build_suggestions(stats_14 if recent_14 else stats_60, active_weights)
        biweekly_list.insert(0, {
            "period_start": cutoff_14,
            "period_end": today_str,
            "algo_version": active_version,
            "weights_active": active_weights,
            "games_graded": stats_14["total"],
            "record": f"{stats_14['wins']}-{stats_14['losses']}",
            "win_rate": stats_14["win_rate"],
            "roi_pct": stats_14["roi_pct"],
            "underdog_record": f"{stats_14['underdogs']['wins']}-{stats_14['underdogs']['losses']}",
            "what_changed": rebalance_note,
            "whats_working": bw_working,
            "whats_not_working": bw_not_working,
            "suggestions": bw_suggestions
        })
        report["biweekly_reports"] = biweekly_list[:26]

    report.update({
        "algo_version": active_version,
        "updated_at": now.isoformat(),
        "rebalance_cadence": "monthly",
        "target_win_rate": TARGET_WIN_RATE,
        "guardrails": {
            "min_global_games": MIN_GLOBAL_SAMPLE,
            "min_league_games": MIN_LEAGUE_SAMPLE,
            "min_odds_for_roi": MIN_ODDS_SAMPLE_FOR_ROI,
        },
        "weights": active_weights,
        "league_weights": league_weights,
        "summary_60d": stats_60,
        "summary_14d": stats_14,
        "whats_working": working,
        "whats_not_working": not_working,
        "suggestions": suggestions,
        "last_rebalance_note": rebalance_note
    })

    save_json(HISTORY_FILE, history)
    save_json(REPORT_FILE, report)
    roi_label = f"{stats_60['roi_pct']:+.1f}% ROI" if stats_60["roi_pct"] is not None else "ROI pending ML data"
    print(
        f"AlignIQ Agent complete | Algo {active_version} | "
        f"60d: {stats_60['win_rate']}% ({stats_60['wins']}-{stats_60['losses']}) | "
        f"{roi_label} | Dogs: {stats_60['underdogs']['wins']}-{stats_60['underdogs']['losses']}"
    )


if __name__ == "__main__":
    main()
