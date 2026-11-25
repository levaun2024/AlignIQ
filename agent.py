import json
import os
import urllib.request
from datetime import datetime, timezone, timedelta
from collections import defaultdict

HISTORY_FILE = "history.json"
REPORT_FILE = "agent_report.json"
TARGET_WIN_RATE = 95.0

MIN_GLOBAL_SAMPLE = 500
MIN_LEAGUE_SAMPLE = 100
MIN_ODDS_SAMPLE_FOR_ROI = 50

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

ESPN_PATHS = {
    "NBA": "basketball/nba",
    "NFL": "football/nfl",
    "NHL": "hockey/nhl",
    "MLB": "baseball/mlb",
    "NCAAF": "football/college-football",
    "NCAAB": "basketball/mens-college-basketball",
    "NCAAW": "basketball/womens-college-basketball",
    "WNBA": "basketball/wnba",
    "UFC": "mma/ufc",
    "EPL": "soccer/eng.1",
    "MLS": "soccer/usa.1",
    "UCL": "soccer/uefa.champions",
}


def as_dict(val):
    return val if isinstance(val, dict) else {}


def first_dict(val):
    if isinstance(val, list) and val and isinstance(val[0], dict):
        return val[0]
    return {}


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


def fetch_json(url, timeout=8):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "AlignIQ-Agent/4.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


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
    val = safe_optional_float(ml)
    if val is None or val == 0:
        return None
    return (1.0 + val / 100.0) if val > 0 else (1.0 + 100.0 / abs(val))


def normalize_h2h(raw_h2h):
    return clamp(((safe_float(raw_h2h, 50.0) - 36.0) / 32.0) * 100.0)


def scale_gematria(raw_gem):
    return clamp(safe_float(raw_gem, 0.0) * 0.85)


def get_league_weights(league, league_weights_map=None, fallback_weights=None):
    lg = str(league or "").upper().strip()
    if isinstance(league_weights_map, dict) and isinstance(league_weights_map.get(lg), dict):
        return dict(league_weights_map[lg])
    if lg in LEAGUE_DEFAULT_WEIGHTS:
        return dict(LEAGUE_DEFAULT_WEIGHTS[lg])
    return dict(fallback_weights or DEFAULT_WEIGHTS)


def score_matchup(
    home, away, weights=None, league=None, rest_days=None,
    splits=None, open_h2h=None, close_h2h=None, starter_flag=None
):
    w = weights if isinstance(weights, dict) else get_league_weights(league)
    home = as_dict(home)
    away = as_dict(away)

    h_gem = scale_gematria(home.get("gem", 0))
    a_gem = scale_gematria(away.get("gem", 0))
    h_h2h = normalize_h2h(home.get("h2h", 50))
    a_h2h = normalize_h2h(away.get("h2h", 50))
    h_ros = clamp(safe_float(home.get("ros", 50), 50.0))
    a_ros = clamp(safe_float(away.get("ros", 50), 50.0))

    if isinstance(rest_days, dict):
        h_rest = safe_optional_float(rest_days.get("home"))
        a_rest = safe_optional_float(rest_days.get("away"))
        if h_rest == 0 and (a_rest is None or a_rest >= 1):
            h_ros = clamp(h_ros - 6.0)
        if a_rest == 0 and (h_rest is None or h_rest >= 1):
            a_ros = clamp(a_ros - 6.0)

    if isinstance(splits, dict):
        h_sp = safe_optional_float(splits.get("home_at_home_pct"))
        a_sp = safe_optional_float(splits.get("away_on_road_pct"))
        if h_sp is not None and a_sp is not None:
            split_adj = max(-6.0, min(6.0, (h_sp - a_sp) * 10.0))
            h_ros = clamp(h_ros + split_adj)
            a_ros = clamp(a_ros - split_adj)

    if isinstance(starter_flag, dict):
        if str(starter_flag.get("home", "")).lower() in ("backup_goalie", "star_out"):
            h_ros = clamp(h_ros - 6.0)
        if str(starter_flag.get("away", "")).lower() in ("backup_goalie", "star_out"):
            a_ros = clamp(a_ros - 6.0)

    h_move, a_move = 0.0, 0.0
    if isinstance(open_h2h, dict) and isinstance(close_h2h, dict):
        h_move = safe_float(close_h2h.get("home", home.get("h2h", 50)), 50.0) - safe_float(open_h2h.get("home", home.get("h2h", 50)), 50.0)
        a_move = safe_float(close_h2h.get("away", away.get("h2h", 50)), 50.0) - safe_float(open_h2h.get("away", away.get("h2h", 50)), 50.0)
        if h_move >= 3.0:
            h_h2h = clamp(h_h2h + 3.0)
        if a_move >= 3.0:
            a_h2h = clamp(a_h2h + 3.0)

    total_w = max(1, w.get("gem", 10) + w.get("h2h", 60) + w.get("ros", 30))
    home_score = round((h_gem * w.get("gem", 10) + h_h2h * w.get("h2h", 60) + h_ros * w.get("ros", 30)) / total_w, 2)
    away_score = round((a_gem * w.get("gem", 10) + a_h2h * w.get("h2h", 60) + a_ros * w.get("ros", 30)) / total_w, 2)

    pick = "home" if home_score >= away_score else "away"
    raw_h_h2h = safe_float(home.get("h2h", 50), 50.0)
    raw_a_h2h = safe_float(away.get("h2h", 50), 50.0)
    market_dog = None if raw_h_h2h == raw_a_h2h else ("home" if raw_h_h2h < raw_a_h2h else "away")

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

        if not (dog_h2h >= 44.0 and ((dog_ros > fav_ros and dog_gem > fav_gem) or (dog_ros - fav_ros) >= 22.0 or dog_move >= 3.0)):
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


def build_postgame_autopsy(g, scored, won):
    """Generates per-game determining factors & learning takeaway."""
    pick = scored["pick"]
    opp = "away" if pick == "home" else "home"
    p_team = as_dict(g.get(pick))
    o_team = as_dict(g.get(opp))

    factors = []
    if safe_float(p_team.get("h2h", 50)) > safe_float(o_team.get("h2h", 50)):
        factors.append(f"Market Fair Odds favored pick ({p_team.get('h2h', 50)}% vs {o_team.get('h2h', 50)}%)")
    if safe_float(p_team.get("ros", 50)) > safe_float(o_team.get("ros", 50)):
        factors.append(f"Form/Health edge ({p_team.get('ros', 50)} vs {o_team.get('ros', 50)})")
    if safe_float(p_team.get("gem", 0)) >= 42:
        factors.append(f"Pattern Signal convergence ({p_team.get('gem', 0)})")
    if scored.get("dog_gate_triggered"):
        factors.append("Underdog Gate blocked low-conviction upset flip")
    if scored.get("is_underdog_pick"):
        factors.append("Live Underdog cleared multi-pillar Agreement Gate")
    if scored.get("line_move", 0) >= 3:
        factors.append(f"Sharp line steam (+{scored['line_move']}%)")

    if won:
        if scored.get("is_underdog_pick"):
            lesson = "Underdog Agreement Gate validated — multi-signal dog spot cashed."
        elif scored["confidence"] >= 70:
            lesson = "High-confidence pillar alignment held; reinforces current league weight profile."
        else:
            lesson = "Market-anchored baseline delivered a clean win in a tighter spread spot."
    else:
        if scored.get("is_underdog_pick"):
            lesson = "Underdog spot missed — monitor close-market threshold (44%+) for this league."
        elif scored["confidence"] >= 70:
            lesson = "High-confidence upset loss — review in-game turnovers, foul trouble, or late starter scratches."
        else:
            lesson = "Coin-flip variance loss — consider tightening sub-60% confidence filters."

    return {
        "determining_factors": factors or ["Baseline multi-pillar composite"],
        "lesson_learned": lesson,
        "in_game_stats": g.get("in_game_stats", []),
    }


def sync_and_enrich_espn_history(history, now, active_version, active_weights):
    """
    Backfills completed games for the last 3 days and replaces raw numeric IDs
    with real team/fighter names, logos, final scores, and in-game stat leaders.
    """
    dates = history.setdefault("dates", {})
    for offset in (3, 2, 1):
        target_dt = now - timedelta(days=offset)
        d_str = target_dt.strftime("%Y-%m-%d")
        ymd = target_dt.strftime("%Y%m%d")
        entry = dates.setdefault(d_str, {
            "algo_version": active_version,
            "weights_used": dict(active_weights),
            "locked": True,
            "games": [],
        })
        if not isinstance(entry.get("games"), list):
            entry["games"] = []
        existing_by_id = {str(g.get("id")): g for g in entry["games"] if isinstance(g, dict)}

        for lg, path in ESPN_PATHS.items():
            data = fetch_json(f"https://site.api.espn.com/apis/site/v2/sports/{path}/scoreboard?dates={ymd}")
            if not isinstance(data, dict) or not isinstance(data.get("events"), list):
                continue

            for ev in data["events"]:
                if not isinstance(ev, dict):
                    continue
                comp = first_dict(ev.get("competitions"))
                status_type = as_dict(as_dict(comp.get("status")).get("type"))
                if status_type.get("state") != "post":
                    continue

                comps = [c for c in (comp.get("competitors") or []) if isinstance(c, dict)]
                if len(comps) < 2:
                    continue
                home_c = next((c for c in comps if c.get("homeAway") == "home"), comps[0])
                away_c = next((c for c in comps if c.get("homeAway") == "away"), comps[1])
                h_score = int(safe_float(home_c.get("score"), 0))
                a_score = int(safe_float(away_c.get("score"), 0))
                if h_score == a_score:
                    continue

                ev_id = str(ev.get("id") or "")
                if not ev_id:
                    continue

                h_team = as_dict(home_c.get("team"))
                a_team = as_dict(away_c.get("team"))
                h_ath = as_dict(home_c.get("athlete"))
                a_ath = as_dict(away_c.get("athlete"))

                h_name = h_team.get("shortDisplayName") or h_ath.get("displayName") or "Home"
                a_name = a_team.get("shortDisplayName") or a_ath.get("displayName") or "Away"
                h_logo = h_team.get("logo", "")
                a_logo = a_team.get("logo", "")
                actual_winner = "home" if h_score > a_score else "away"

                odds_obj = first_dict(comp.get("odds"))
                h_odds = as_dict(odds_obj.get("homeTeamOdds"))
                a_odds = as_dict(odds_obj.get("awayTeamOdds"))
                h_ml = h_odds.get("moneyLine")
                a_ml = a_odds.get("moneyLine")

                in_game_stats = []
                for side_c, lbl in ((away_c, a_name), (home_c, h_name)):
                    for ld in (side_c.get("leaders") or [])[:2]:
                        if not isinstance(ld, dict):
                            continue
                        top = first_dict(ld.get("leaders"))
                        ath = as_dict(top.get("athlete")).get("shortName")
                        val = top.get("displayValue")
                        cat = ld.get("shortDisplayName") or ld.get("name")
                        if ath and val and cat:
                            in_game_stats.append(f"{lbl} {cat}: {ath} ({val})")

                if ev_id in existing_by_id:
                    g = existing_by_id[ev_id]
                    g["matchup"] = f"{a_name} @ {h_name}"
                    g["final_score"] = f"{a_score}-{h_score}"
                    g["home_logo"] = h_logo
                    g["away_logo"] = a_logo
                    if isinstance(g.get("home"), dict):
                        g["home"]["name"] = h_name
                    if isinstance(g.get("away"), dict):
                        g["away"]["name"] = a_name
                    if h_ml is not None and g.get("home_ml") is None:
                        g["home_ml"] = h_ml
                    if a_ml is not None and g.get("away_ml") is None:
                        g["away_ml"] = a_ml
                    if in_game_stats:
                        g["in_game_stats"] = in_game_stats
                else:
                    h_prob = 55 if h_odds.get("favorite") else (45 if a_odds.get("favorite") else 50)
                    a_prob = 100 - h_prob
                    new_g = {
                        "id": ev_id,
                        "league": lg,
                        "matchup": f"{a_name} @ {h_name}",
                        "final_score": f"{a_score}-{h_score}",
                        "home_logo": h_logo,
                        "away_logo": a_logo,
                        "home_ml": h_ml,
                        "away_ml": a_ml,
                        "actual_winner": actual_winner,
                        "home": {"name": h_name, "gem": 0, "h2h": h_prob, "ros": 52},
                        "away": {"name": a_name, "gem": 0, "h2h": a_prob, "ros": 48},
                        "in_game_stats": in_game_stats,
                        "algo_version": active_version,
                        "weights_used": dict(get_league_weights(lg, None, active_weights)),
                    }
                    entry["games"].append(new_g)
                    existing_by_id[ev_id] = new_g
    return history


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
    return {"dates": {}}


def extract_graded_games(history, league_weights_map=None):
    graded = []
    for date_str, entry in sorted(history.get("dates", {}).items()):
        if not isinstance(entry, dict):
            continue
        for g in entry.get("games", []):
            if not isinstance(g, dict):
                continue
            league = g.get("league", "OTHER")
            weights_used = get_league_weights(league, league_weights_map, g.get("weights_used") or entry.get("weights_used"))
            factors = dict(g.get("factors", {})) if isinstance(g.get("factors"), dict) else {}

            actual_winner = str(g.get("actual_winner") or "").lower().strip()
            if actual_winner in ("home", "away") and isinstance(g.get("home"), dict) and isinstance(g.get("away"), dict):
                scored = score_matchup(
                    g["home"], g["away"], weights=weights_used, league=league,
                    rest_days=g.get("rest_days"), splits=g.get("splits"),
                    open_h2h=g.get("open_h2h"), close_h2h=g.get("close_h2h"),
                    starter_flag=g.get("starter_flag"),
                )
                pick_side = scored["pick"]
                won = pick_side == actual_winner
                g["pick"] = pick_side
                g["confidence"] = scored["confidence"]
                g["result"] = "W" if won else "L"
                g["autopsy"] = build_postgame_autopsy(g, scored, won)

                picked_ml = g.get(f"{pick_side}_ml")
                dec_odds = american_to_decimal(picked_ml)
                unit_pnl = round((dec_odds - 1.0) if won else -1.0, 4) if dec_odds else None

                graded.append({
                    "date": date_str, "league": league, "matchup": g.get("matchup", g.get("id", "Game")),
                    "pick": pick_side, "confidence": scored["confidence"], "win": won,
                    "is_underdog_pick": scored["is_underdog_pick"], "picked_ml": picked_ml,
                    "unit_pnl": unit_pnl, "line_move": scored["line_move"],
                    "final_score": g.get("final_score", ""), "weights_used": weights_used,
                    "factors": factors, "raw_game": g,
                })
    return graded


def analyze_factors(games):
    buckets = {
        "gematria": {"label": "Pattern Signals (2+ Hits)", "w": 0, "n": 0, "units": 0.0, "odds_n": 0},
        "odds": {"label": "Fair Odds / +EV Edge", "w": 0, "n": 0, "units": 0.0, "odds_n": 0},
        "form_health": {"label": "Form, Rest & Health", "w": 0, "n": 0, "units": 0.0, "odds_n": 0},
        "high_conf": {"label": "70%+ High Confidence", "w": 0, "n": 0, "units": 0.0, "odds_n": 0},
        "underdogs": {"label": "Underdog Gate Picks", "w": 0, "n": 0, "units": 0.0, "odds_n": 0},
    }
    by_league = defaultdict(lambda: {"w": 0, "n": 0, "units": 0.0, "odds_n": 0})
    daily_trend = defaultdict(lambda: {"w": 0, "n": 0})
    total_units, total_odds_n = 0.0, 0

    for g in games:
        f = g["factors"]
        win = 1 if g["win"] else 0
        pnl = g.get("unit_pnl")
        has_odds = pnl is not None
        if has_odds:
            total_units += pnl
            total_odds_n += 1

        def add_b(key):
            buckets[key]["n"] += 1
            buckets[key]["w"] += win
            if has_odds:
                buckets[key]["units"] += pnl
                buckets[key]["odds_n"] += 1

        if safe_float(f.get("gematria_hits", 0), 0) >= 2 or safe_float(f.get("gematria_score", 0), 0) >= 42:
            add_b("gematria")
        if safe_float(f.get("odds_edge", 0), 0) > 0:
            add_b("odds")
        if safe_float(f.get("form_health_score", 0), 0) >= 60:
            add_b("form_health")
        if g["confidence"] >= 70:
            add_b("high_conf")
        if g.get("is_underdog_pick"):
            add_b("underdogs")

        by_league[g["league"]]["n"] += 1
        by_league[g["league"]]["w"] += win
        if has_odds:
            by_league[g["league"]]["units"] += pnl
            by_league[g["league"]]["odds_n"] += 1

        daily_trend[g["date"]]["n"] += 1
        daily_trend[g["date"]]["w"] += win

    total_n = len(games)
    total_w = sum(1 for g in games if g["win"])
    overall_rate = round((total_w / total_n) * 100, 1) if total_n else 0.0
    overall_roi = round((total_units / total_odds_n) * 100, 1) if total_odds_n else None

    factor_metrics = {
        k: {
            "label": v["label"], "wins": v["w"], "losses": v["n"] - v["w"], "total": v["n"],
            "win_rate": round((v["w"] / v["n"]) * 100, 1) if v["n"] else 0.0,
            "lift_vs_avg": round((v["w"] / v["n"]) * 100 - overall_rate, 1) if v["n"] else 0.0,
            "net_units": round(v["units"], 2) if v["odds_n"] else None,
            "roi_pct": round((v["units"] / v["odds_n"]) * 100, 1) if v["odds_n"] else None,
        }
        for k, v in buckets.items()
    }

    league_metrics = {
        lg: {
            "wins": v["w"], "losses": v["n"] - v["w"], "total": v["n"],
            "win_rate": round((v["w"] / v["n"]) * 100, 1) if v["n"] else 0.0,
            "net_units": round(v["units"], 2) if v["odds_n"] else None,
            "roi_pct": round((v["units"] / v["odds_n"]) * 100, 1) if v["odds_n"] else None,
        }
        for lg, v in sorted(by_league.items())
    }

    trend_series = [
        {"date": d, "wins": v["w"], "total": v["n"], "win_rate": round((v["w"] / v["n"]) * 100, 1) if v["n"] else 0.0}
        for d, v in sorted(daily_trend.items())[-30:]
    ]

    return {
        "wins": total_w, "losses": total_n - total_w, "total": total_n, "win_rate": overall_rate,
        "graded_with_odds": total_odds_n, "net_units": round(total_units, 2) if total_odds_n else None,
        "roi_pct": overall_roi, "gap_to_target": round(max(0.0, TARGET_WIN_RATE - overall_rate), 1),
        "underdogs": factor_metrics["underdogs"], "factors": factor_metrics,
        "leagues": league_metrics, "daily_trend": trend_series,
    }


def main():
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    month_tag = now.strftime("%Y-%m")

    report = load_json(REPORT_FILE, {})
    if not isinstance(report, dict):
        report = {}

    active_weights = dict(DEFAULT_WEIGHTS)
    league_weights = {k: dict(v) for k, v in LEAGUE_DEFAULT_WEIGHTS.items()}
    active_version = f"{month_tag}-phase4"

    history = normalize_history(load_json(HISTORY_FILE, {"dates": {}}), today_str)
    history = sync_and_enrich_espn_history(history, now, active_version, active_weights)

    all_graded = extract_graded_games(history, league_weights)
    cutoff_60 = (now - timedelta(days=60)).strftime("%Y-%m-%d")
    cutoff_14 = (now - timedelta(days=14)).strftime("%Y-%m-%d")

    stats_60 = analyze_factors([g for g in all_graded if g["date"] >= cutoff_60])
    stats_14 = analyze_factors([g for g in all_graded if g["date"] >= cutoff_14])

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
        "whats_working": [
            f"60-day model win rate is {stats_60['win_rate']}% ({stats_60['wins']}-{stats_60['losses']}).",
            "ESPN post-game enrichment & per-game autopsy learning active."
        ],
        "whats_not_working": [
            f"Sample guardrail active ({stats_60['total']}/{MIN_GLOBAL_SAMPLE} games) before auto-tuning unlocks."
        ],
        "last_rebalance_note": f"Phase 4 active (10/60/30 + League Profiles + Post-Game Autopsy). Guardrail: {stats_60['total']}/{MIN_GLOBAL_SAMPLE} games."
    })

    save_json(HISTORY_FILE, history)
    save_json(REPORT_FILE, report)
    print(f"AlignIQ Learning Agent complete | {stats_60['win_rate']}% ({stats_60['wins']}-{stats_60['losses']})")


if __name__ == "__main__":
    main()