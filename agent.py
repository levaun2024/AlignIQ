import json
import os
import urllib.request
from datetime import datetime, timezone, timedelta
from collections import defaultdict

HISTORY_FILE = "history.json"
REPORT_FILE = "agent_report.json"
CONFIG_FILE = "algo_config.json"
ANALYSIS_FILE = "analysis_report.json"
TARGET_WIN_RATE = 95.0

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
    "NBA": "basketball/nba", "NFL": "football/nfl", "NHL": "hockey/nhl",
    "MLB": "baseball/mlb", "NCAAF": "football/college-football",
    "NCAAB": "basketball/mens-college-basketball", "NCAAW": "basketball/womens-college-basketball",
    "WNBA": "basketball/wnba", "UFC": "mma/ufc",
    "EPL": "soccer/eng.1", "MLS": "soccer/usa.1", "UCL": "soccer/uefa.champions",
}


def as_dict(val):
    return val if isinstance(val, dict) else {}


def first_dict(val):
    return val[0] if (isinstance(val, list) and val and isinstance(val[0], dict)) else {}


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
        req = urllib.request.Request(url, headers={"User-Agent": "AlignIQ-Agent/5.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


def safe_float(val, default=50.0):
    try:
        return float(str(val).replace("%", "").strip())
    except Exception:
        return default


def clamp(val, low=0.0, high=100.0):
    return max(low, min(high, float(val)))


def american_to_decimal(ml):
    try:
        v = float(ml)
        if v == 0:
            return None
        return (1.0 + v / 100.0) if v > 0 else (1.0 + 100.0 / abs(v))
    except Exception:
        return None


def load_active_config():
    cfg = load_json(CONFIG_FILE, {})
    if not isinstance(cfg, dict) or not cfg.get("weights"):
        cfg = {
            "version": "phase5-baseline",
            "weights": dict(DEFAULT_WEIGHTS),
            "league_weights": {k: dict(v) for k, v in LEAGUE_DEFAULT_WEIGHTS.items()},
            "change_log": [],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        save_json(CONFIG_FILE, cfg)
    return cfg


def get_league_weights(league, cfg):
    lg = str(league or "").upper().strip()
    lw = as_dict(cfg.get("league_weights"))
    if isinstance(lw.get(lg), dict):
        return dict(lw[lg])
    return dict(cfg.get("weights") or DEFAULT_WEIGHTS)


def score_matchup(home, away, weights):
    home, away = as_dict(home), as_dict(away)
    h_gem = clamp(safe_float(home.get("gem", 0), 0.0) * 0.85)
    a_gem = clamp(safe_float(away.get("gem", 0), 0.0) * 0.85)
    h_h2h = clamp(((safe_float(home.get("h2h", 50), 50.0) - 36.0) / 32.0) * 100.0)
    a_h2h = clamp(((safe_float(away.get("h2h", 50), 50.0) - 36.0) / 32.0) * 100.0)
    h_ros = clamp(safe_float(home.get("ros", 50), 50.0))
    a_ros = clamp(safe_float(away.get("ros", 50), 50.0))

    total_w = max(1, weights.get("gem", 10) + weights.get("h2h", 60) + weights.get("ros", 30))
    h_score = round((h_gem * weights.get("gem", 10) + h_h2h * weights.get("h2h", 60) + h_ros * weights.get("ros", 30)) / total_w, 2)
    a_score = round((a_gem * weights.get("gem", 10) + a_h2h * weights.get("h2h", 60) + a_ros * weights.get("ros", 30)) / total_w, 2)

    pick = "home" if h_score >= a_score else "away"
    raw_h, raw_a = safe_float(home.get("h2h", 50)), safe_float(away.get("h2h", 50))
    market_dog = None if raw_h == raw_a else ("home" if raw_h < raw_a else "away")
    dog_gate = False

    if market_dog and pick == market_dog:
        dog_h2h = raw_h if pick == "home" else raw_a
        dog_ros, fav_ros = (h_ros, a_ros) if pick == "home" else (a_ros, h_ros)
        dog_gem, fav_gem = (h_gem, a_gem) if pick == "home" else (a_gem, h_gem)
        if not (dog_h2h >= 44.0 and ((dog_ros > fav_ros and dog_gem > fav_gem) or (dog_ros - fav_ros) >= 22.0)):
            pick = "away" if pick == "home" else "home"
            dog_gate = True

    conf = round(clamp(50.0 + abs(h_score - a_score) * 0.5, 50.0, 99.0), 1)
    return {
        "pick": pick, "confidence": conf,
        "home_score": h_score, "away_score": a_score,
        "is_underdog": bool(market_dog and pick == market_dog),
        "dog_gate_triggered": dog_gate,
        "factor_deltas": {
            "gem": round((h_gem - a_gem) if pick == "home" else (a_gem - h_gem), 1),
            "h2h": round((h_h2h - a_h2h) if pick == "home" else (a_h2h - h_h2h), 1),
            "ros": round((h_ros - a_ros) if pick == "home" else (a_ros - h_ros), 1),
        },
    }


def sync_espn_history(history, now, cfg):
    dates = history.setdefault("dates", {})
    for offset in (3, 2, 1):
        dt = now - timedelta(days=offset)
        d_str, ymd = dt.strftime("%Y-%m-%d"), dt.strftime("%Y%m%d")
        entry = dates.setdefault(d_str, {"algo_version": cfg["version"], "weights_used": dict(cfg["weights"]), "games": []})
        if not isinstance(entry.get("games"), list):
            entry["games"] = []
        existing = {str(g.get("id")): g for g in entry["games"] if isinstance(g, dict)}

        for lg, path in ESPN_PATHS.items():
            data = fetch_json(f"https://site.api.espn.com/apis/site/v2/sports/{path}/scoreboard?dates={ymd}")
            if not isinstance(data, dict) or not isinstance(data.get("events"), list):
                continue
            for ev in data["events"]:
                if not isinstance(ev, dict):
                    continue
                comp = first_dict(ev.get("competitions"))
                if as_dict(as_dict(comp.get("status")).get("type")).get("state") != "post":
                    continue
                comps = [c for c in (comp.get("competitors") or []) if isinstance(c, dict)]
                if len(comps) < 2:
                    continue
                home_c = next((c for c in comps if c.get("homeAway") == "home"), comps[0])
                away_c = next((c for c in comps if c.get("homeAway") == "away"), comps[1])
                hs, as_ = int(safe_float(home_c.get("score"), 0)), int(safe_float(away_c.get("score"), 0))
                if hs == as_:
                    continue
                ev_id = str(ev.get("id") or "")
                if not ev_id:
                    continue

                h_team, a_team = as_dict(home_c.get("team")), as_dict(away_c.get("team"))
                h_name = h_team.get("shortDisplayName") or as_dict(home_c.get("athlete")).get("displayName") or "Home"
                a_name = a_team.get("shortDisplayName") or as_dict(away_c.get("athlete")).get("displayName") or "Away"
                odds_obj = first_dict(comp.get("odds"))
                h_odds, a_odds = as_dict(odds_obj.get("homeTeamOdds")), as_dict(odds_obj.get("awayTeamOdds"))

                if ev_id in existing:
                    g = existing[ev_id]
                    g["matchup"] = f"{a_name} @ {h_name}"
                    g["final_score"] = f"{as_}-{hs}"
                    g["actual_winner"] = "home" if hs > as_ else "away"
                    if h_odds.get("moneyLine") is not None and g.get("home_ml") is None:
                        g["home_ml"] = h_odds.get("moneyLine")
                    if a_odds.get("moneyLine") is not None and g.get("away_ml") is None:
                        g["away_ml"] = a_odds.get("moneyLine")
                else:
                    h_prob = 55 if h_odds.get("favorite") else (45 if a_odds.get("favorite") else 50)
                    new_g = {
                        "id": ev_id, "league": lg, "matchup": f"{a_name} @ {h_name}",
                        "final_score": f"{as_}-{hs}", "actual_winner": "home" if hs > as_ else "away",
                        "home_ml": h_odds.get("moneyLine"), "away_ml": a_odds.get("moneyLine"),
                        "home": {"name": h_name, "gem": 0, "h2h": h_prob, "ros": 52},
                        "away": {"name": a_name, "gem": 0, "h2h": 100 - h_prob, "ros": 48},
                        "weights_used": get_league_weights(lg, cfg),
                    }
                    entry["games"].append(new_g)
                    existing[ev_id] = new_g
    return history


def run_historical_analysis(history, cfg, now):
    """Agent 1: Evaluates all completed games, preserves original predictions, and identifies factor bias."""
    cutoff_60 = (now - timedelta(days=60)).strftime("%Y-%m-%d")
    factor_perf = {
        "gem": {"label": "Pattern Signals", "agree_w": 0, "agree_n": 0, "misled_losses": 0},
        "h2h": {"label": "Market Fair Odds", "agree_w": 0, "agree_n": 0, "misled_losses": 0},
        "ros": {"label": "Form, Rest & Health", "agree_w": 0, "agree_n": 0, "misled_losses": 0},
    }
    calibration = defaultdict(lambda: {"w": 0, "n": 0})
    by_league = defaultdict(lambda: {"w": 0, "n": 0, "units": 0.0, "odds_n": 0})
    daily_trend = defaultdict(lambda: {"w": 0, "n": 0})
    underdogs = {"w": 0, "n": 0}
    biggest_hits, biggest_misses = [], []
    newly_processed = 0
    total_w, total_n, total_units, total_odds_n = 0, 0, 0.0, 0

    for d_str, entry in sorted(history.get("dates", {}).items()):
        if not isinstance(entry, dict) or d_str < cutoff_60:
            continue
        for g in entry.get("games", []):
            if not isinstance(g, dict):
                continue
            actual = str(g.get("actual_winner") or "").lower().strip()
            if actual not in ("home", "away"):
                continue

            w_used = g.get("weights_used") or get_league_weights(g.get("league"), cfg)
            scored = score_matchup(g.get("home"), g.get("away"), w_used)

            # Lock original prediction once (never overwrite historical predictions)
            if not g.get("original_pick"):
                g["original_pick"] = scored["pick"]
                g["original_confidence"] = scored["confidence"]
                g["original_weights"] = dict(w_used)

            pick = g["original_pick"]
            conf = safe_float(g.get("original_confidence"), scored["confidence"])
            won = pick == actual
            g["pick"] = pick
            g["confidence"] = conf
            g["result"] = "W" if won else "L"

            if not g.get("autopsy_processed"):
                deltas = scored["factor_deltas"]
                primary_driver = max(deltas, key=lambda k: abs(deltas[k]))
                g["autopsy"] = {
                    "determining_factors": [
                        f"Primary driver: {factor_perf[primary_driver]['label']} ({deltas[primary_driver]:+.1f} edge)",
                        f"Original Conf: {conf}% | Actual: {actual.upper()} ({g.get('final_score', '')})",
                    ],
                    "lesson_learned": (
                        f"{factor_perf[primary_driver]['label']} accurately predicted outcome."
                        if won else
                        f"Algorithm overvalued {factor_perf[primary_driver]['label']} ({deltas[primary_driver]:+.1f}) on a {conf}% pick."
                    ),
                    "processed_at": now.isoformat(),
                }
                g["autopsy_processed"] = True
                newly_processed += 1

            # Aggregate 60-day analytics
            total_n += 1
            total_w += 1 if won else 0
            lg = g.get("league", "OTHER")
            by_league[lg]["n"] += 1
            by_league[lg]["w"] += 1 if won else 0
            daily_trend[d_str]["n"] += 1
            daily_trend[d_str]["w"] += 1 if won else 0

            if scored["is_underdog"]:
                underdogs["n"] += 1
                underdogs["w"] += 1 if won else 0

            dec = american_to_decimal(g.get(f"{pick}_ml"))
            if dec:
                pnl = (dec - 1.0) if won else -1.0
                total_units += pnl
                total_odds_n += 1
                by_league[lg]["units"] += pnl
                by_league[lg]["odds_n"] += 1

            # Confidence calibration bucket
            bucket = "70%+" if conf >= 70 else ("60-69%" if conf >= 60 else "50-59%")
            calibration[bucket]["n"] += 1
            calibration[bucket]["w"] += 1 if won else 0

            # Factor attribution (which factors drove wins vs misled losses)
            for fk, delta in scored["factor_deltas"].items():
                if delta > 2.0:
                    factor_perf[fk]["agree_n"] += 1
                    if won:
                        factor_perf[fk]["agree_w"] += 1
                    else:
                        factor_perf[fk]["misled_losses"] += 1

            rec = {"date": d_str, "league": lg, "matchup": g.get("matchup", g.get("id")), "pick": pick, "confidence": conf, "score": g.get("final_score", "")}
            if won:
                biggest_hits.append(rec)
            else:
                biggest_misses.append(rec)

    overall_wr = round((total_w / total_n) * 100, 1) if total_n else 0.0
    factor_summary = {}
    overvalued, undervalued = [], []
    for fk, fp in factor_perf.items():
        wr = round((fp["agree_w"] / fp["agree_n"]) * 100, 1) if fp["agree_n"] else 0.0
        lift = round(wr - overall_wr, 1) if fp["agree_n"] else 0.0
        factor_summary[fk] = {**fp, "win_rate": wr, "lift_vs_avg": lift}
        if fp["agree_n"] >= 15 and lift <= -3.0:
            overvalued.append(f"{fp['label']} ({wr}% WR, {lift:+.1f}% vs avg)")
        elif fp["agree_n"] >= 15 and lift >= 3.0:
            undervalued.append(f"{fp['label']} ({wr}% WR, {lift:+.1f}% vs avg)")

    weaknesses = []
    for lg, m in by_league.items():
        lwr = round((m["w"] / m["n"]) * 100, 1) if m["n"] else 0.0
        if m["n"] >= 15 and lwr < 52.0:
            weaknesses.append(f"{lg} underperforming at {lwr}% ({m['w']}-{m['n'] - m['w']})")
    if underdogs["n"] >= 10 and (underdogs["w"] / underdogs["n"]) < 0.35:
        weaknesses.append(f"Underdog picks hitting {round((underdogs['w']/underdogs['n'])*100, 1)}% ({underdogs['w']}-{underdogs['n']-underdogs['w']})")

    analysis = {
        "generated_at": now.isoformat(),
        "agent": "Agent 1: Historical Game Analysis",
        "status": "SUCCESS",
        "newly_analyzed_games": newly_processed,
        "total_completed_60d": total_n,
        "wins_60d": total_w,
        "losses_60d": total_n - total_w,
        "win_rate_60d": overall_wr,
        "roi_pct_60d": round((total_units / total_odds_n) * 100, 1) if total_odds_n else None,
        "net_units_60d": round(total_units, 2) if total_odds_n else None,
        "underdogs": {**underdogs, "losses": underdogs["n"] - underdogs["w"], "win_rate": round((underdogs["w"] / underdogs["n"]) * 100, 1) if underdogs["n"] else 0.0},
        "factor_attribution": factor_summary,
        "overvalued_factors": overvalued,
        "undervalued_factors": undervalued,
        "recurring_weaknesses": weaknesses,
        "calibration": {k: {"wins": v["w"], "total": v["n"], "win_rate": round((v["w"] / v["n"]) * 100, 1)} for k, v in calibration.items()},
        "biggest_successes": sorted(biggest_hits, key=lambda x: x["confidence"], reverse=True)[:5],
        "biggest_failures": sorted(biggest_misses, key=lambda x: x["confidence"], reverse=True)[:5],
        "leagues": {k: {"wins": v["w"], "losses": v["n"] - v["w"], "total": v["n"], "win_rate": round((v["w"] / v["n"]) * 100, 1)} for k, v in sorted(by_league.items())},
        "daily_trend": [{"date": d, "wins": v["w"], "total": v["n"], "win_rate": round((v["w"] / v["n"]) * 100, 1)} for d, v in sorted(daily_trend.items())[-30:]],
    }
    return history, analysis


def main():
    now = datetime.now(timezone.utc)
    cfg = load_active_config()
    history = load_json(HISTORY_FILE, {"dates": {}})
    if not isinstance(history, dict) or not isinstance(history.get("dates"), dict):
        history = {"dates": {}}

    history = sync_espn_history(history, now, cfg)
    history, analysis = run_historical_analysis(history, cfg, now)

    report = {
        "algo_version": cfg["version"],
        "updated_at": now.isoformat(),
        "weights": cfg["weights"],
        "league_weights": cfg["league_weights"],
        "guardrails": {"min_global_games": 500, "min_league_games": 100, "min_odds_for_roi": 50},
        "summary_60d": {
            "wins": analysis["wins_60d"], "losses": analysis["losses_60d"], "total": analysis["total_completed_60d"],
            "win_rate": analysis["win_rate_60d"], "roi_pct": analysis["roi_pct_60d"], "net_units": analysis["net_units_60d"],
            "underdogs": analysis["underdogs"], "leagues": analysis["leagues"], "daily_trend": analysis["daily_trend"],
        },
        "last_rebalance_note": f"Active Config: {cfg['version']} | {analysis['newly_analyzed_games']} new games analyzed.",
    }

    save_json(HISTORY_FILE, history)
    save_json(ANALYSIS_FILE, analysis)
    save_json(REPORT_FILE, report)
    print(f"Agent 1 complete | 60d: {analysis['win_rate_60d']}% ({analysis['wins_60d']}-{analysis['losses_60d']}) | New: {analysis['newly_analyzed_games']}")


if __name__ == "__main__":
    main()