import json
import os
from datetime import datetime, timezone, timedelta
from collections import defaultdict

HISTORY_FILE = "history.json"
REPORT_FILE = "agent_report.json"
TARGET_WIN_RATE = 95.0

DEFAULT_WEIGHTS = {"gem": 42, "h2h": 21, "ros": 37}


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


def normalize_weights(w):
    total = max(1, w["gem"] + w["h2h"] + w["ros"])
    gem = round((w["gem"] / total) * 100)
    h2h = round((w["h2h"] / total) * 100)
    ros = 100 - gem - h2h
    return {"gem": max(5, gem), "h2h": max(5, h2h), "ros": max(5, ros)}


def ensure_frozen_snapshots(history, active_version, active_weights):
    """
    Locks every date's algorithm snapshot the first time it is archived.
    NEVER overwrites existing locked confidence %, predictions, or weights on old dates.
    """
    dates = history.setdefault("dates", {})
    for date_str, entry in dates.items():
        if not entry.get("locked"):
            entry["algo_version"] = entry.get("algo_version", active_version)
            entry["weights_used"] = entry.get("weights_used", dict(active_weights))
            entry["locked"] = True
        for g in entry.get("games", []):
            g.setdefault("algo_version", entry["algo_version"])
            g.setdefault("weights_used", entry["weights_used"])
            g.setdefault("factors", {
                "gematria_score": 0,
                "gematria_hits": 0,
                "odds_edge": 0,
                "form_health_score": 0,
                "references": []
            })
    return history


def extract_graded_games(history):
    graded = []
    for date_str, entry in sorted(history.get("dates", {}).items()):
        for g in entry.get("games", []):
            res = str(g.get("result", "")).upper()
            if res in ("W", "L", "WIN", "LOSS"):
                graded.append({
                    "date": date_str,
                    "league": g.get("league", "OTHER"),
                    "matchup": g.get("matchup", f"{g.get('away','Away')} @ {g.get('home','Home')}"),
                    "pick": g.get("pick", ""),
                    "confidence": float(g.get("confidence", 50)),
                    "win": res in ("W", "WIN"),
                    "final_score": g.get("final_score", ""),
                    "algo_version": g.get("algo_version", entry.get("algo_version", "v1")),
                    "weights_used": g.get("weights_used", entry.get("weights_used", DEFAULT_WEIGHTS)),
                    "factors": g.get("factors", {})
                })
    return graded


def analyze_factors(games):
    """Measures how each determining factor correlates with real Win/Loss outcomes."""
    buckets = {
        "gematria": {"label": "Gematria Convergence (2+ Hits)", "w": 0, "n": 0},
        "odds": {"label": "Fair Odds / +EV Edge", "w": 0, "n": 0},
        "form_health": {"label": "L5/L10 Form, Health & Weight Cut", "w": 0, "n": 0},
        "high_conf": {"label": "70%+ High Confidence Picks", "w": 0, "n": 0},
    }
    by_league = defaultdict(lambda: {"w": 0, "n": 0})
    calibration = {
        "50-59%": {"w": 0, "n": 0},
        "60-69%": {"w": 0, "n": 0},
        "70-79%": {"w": 0, "n": 0},
        "80%+": {"w": 0, "n": 0},
    }
    daily_trend = defaultdict(lambda: {"w": 0, "n": 0})

    for g in games:
        f = g["factors"]
        win = 1 if g["win"] else 0

        if f.get("gematria_hits", 0) >= 2 or f.get("gematria_score", 0) >= 60:
            buckets["gematria"]["n"] += 1
            buckets["gematria"]["w"] += win
        if f.get("odds_edge", 0) > 0:
            buckets["odds"]["n"] += 1
            buckets["odds"]["w"] += win
        if f.get("form_health_score", 0) >= 60:
            buckets["form_health"]["n"] += 1
            buckets["form_health"]["w"] += win
        if g["confidence"] >= 70:
            buckets["high_conf"]["n"] += 1
            buckets["high_conf"]["w"] += win

        by_league[g["league"]]["n"] += 1
        by_league[g["league"]]["w"] += win

        c = g["confidence"]
        if c >= 80:
            cal_key = "80%+"
        elif c >= 70:
            cal_key = "70-79%"
        elif c >= 60:
            cal_key = "60-69%"
        else:
            cal_key = "50-59%"
        calibration[cal_key]["n"] += 1
        calibration[cal_key]["w"] += win

        daily_trend[g["date"]]["n"] += 1
        daily_trend[g["date"]]["w"] += win

    total_n = len(games)
    total_w = sum(1 for g in games if g["win"])
    overall_rate = round((total_w / total_n) * 100, 1) if total_n else 0.0

    factor_metrics = {}
    for k, v in buckets.items():
        rate = round((v["w"] / v["n"]) * 100, 1) if v["n"] else overall_rate
        factor_metrics[k] = {
            "label": v["label"],
            "wins": v["w"],
            "total": v["n"],
            "win_rate": rate,
            "lift_vs_avg": round(rate - overall_rate, 1)
        }

    league_metrics = {
        lg: {
            "wins": v["w"],
            "losses": v["n"] - v["w"],
            "total": v["n"],
            "win_rate": round((v["w"] / v["n"]) * 100, 1) if v["n"] else 0.0
        }
        for lg, v in sorted(by_league.items())
    }

    cal_metrics = {
        k: {
            "wins": v["w"],
            "total": v["n"],
            "actual_rate": round((v["w"] / v["n"]) * 100, 1) if v["n"] else 0.0
        }
        for k, v in calibration.items()
    }

    trend_series = [
        {
            "date": d,
            "wins": v["w"],
            "total": v["n"],
            "win_rate": round((v["w"] / v["n"]) * 100, 1) if v["n"] else 0.0
        }
        for d, v in sorted(daily_trend.items())[-30:]
    ]

    return {
        "wins": total_w,
        "losses": total_n - total_w,
        "total": total_n,
        "win_rate": overall_rate,
        "gap_to_target": round(max(0.0, TARGET_WIN_RATE - overall_rate), 1),
        "factors": factor_metrics,
        "leagues": league_metrics,
        "calibration": cal_metrics,
        "daily_trend": trend_series
    }


def build_suggestions(stats, current_weights):
    working, not_working, suggestions = [], [], []
    for k in ("gematria", "odds", "form_health"):
        m = stats["factors"][k]
        if m["total"] == 0:
            continue
        if m["lift_vs_avg"] >= 2.0:
            working.append(f"{m['label']} is outperforming at {m['win_rate']}% (+{m['lift_vs_avg']}% lift over baseline).")
            suggestions.append(f"Increase weight on {m['label']} on next monthly rebalance.")
        elif m["lift_vs_avg"] <= -2.0:
            not_working.append(f"{m['label']} is lagging at {m['win_rate']}% ({m['lift_vs_avg']}% vs baseline).")
            suggestions.append(f"Trim weight on {m['label']} and require stricter signal confirmation.")

    for lg, lm in stats["leagues"].items():
        if lm["total"] >= 5 and lm["win_rate"] >= 70.0:
            working.append(f"{lg} is strong at {lm['win_rate']}% ({lm['wins']}-{lm['losses']}).")
        elif lm["total"] >= 5 and lm["win_rate"] < 52.0:
            not_working.append(f"{lg} is underperforming at {lm['win_rate']}% ({lm['wins']}-{lm['losses']}).")
            suggestions.append(f"Tighten confidence threshold for {lg} picks until league variance stabilizes.")

    if not working:
        working.append("Baseline multi-pillar balance is holding steady; gathering more graded samples.")
    if not not_working:
        not_working.append("No major pillar breakdowns detected in the current sample.")
    if stats["win_rate"] < TARGET_WIN_RATE:
        suggestions.append(
            f"Current win rate is {stats['win_rate']}% ({stats['gap_to_target']}% below {TARGET_WIN_RATE}% target). "
            f"Prioritize 2+ pillar convergence and filter out sub-60% edge spots."
        )
    return working, not_working, suggestions


def compute_monthly_weights(current_weights, stats):
    """Shifts weights conservatively (max ±6% per pillar per month) based on factor lift."""
    if stats["total"] < 10:
        return dict(current_weights), "Insufficient graded games (<10) for monthly rebalance."

    new_w = dict(current_weights)
    deltas = []
    map_keys = [("gem", "gematria"), ("h2h", "odds"), ("ros", "form_health")]
    for w_key, f_key in map_keys:
        lift = stats["factors"][f_key]["lift_vs_avg"]
        shift = max(-6, min(6, round(lift * 0.45)))
        new_w[w_key] = max(10, min(70, new_w[w_key] + shift))
        if shift != 0:
            deltas.append(f"{w_key.upper()} {'+' if shift > 0 else ''}{shift}%")

    normalized = normalize_weights(new_w)
    note = "Monthly factor-attribution adjustment: " + (", ".join(deltas) if deltas else "Weights held steady.")
    return normalized, note


def main():
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    month_tag = now.strftime("%Y-%m")
    force_rebalance = os.getenv("FORCE_REBALANCE", "false").lower() == "true"

    report = load_json(REPORT_FILE, {
        "algo_version": month_tag,
        "rebalance_cadence": "monthly",
        "target_win_rate": TARGET_WIN_RATE,
        "weights": dict(DEFAULT_WEIGHTS),
        "last_rebalance_month": "",
        "weight_history": [],
        "biweekly_reports": []
    })

    active_weights = report.get("weights", dict(DEFAULT_WEIGHTS))
    active_version = report.get("algo_version", month_tag)

    history = load_json(HISTORY_FILE, {"dates": {}})
    history = ensure_frozen_snapshots(history, active_version, active_weights)

    all_graded = extract_graded_games(history)
    cutoff_60 = (now - timedelta(days=60)).strftime("%Y-%m-%d")
    cutoff_14 = (now - timedelta(days=14)).strftime("%Y-%m-%d")

    recent_60 = [g for g in all_graded if g["date"] >= cutoff_60]
    recent_14 = [g for g in all_graded if g["date"] >= cutoff_14]

    stats_60 = analyze_factors(recent_60)
    stats_14 = analyze_factors(recent_14)
    working, not_working, suggestions = build_suggestions(stats_60, active_weights)

    # 1. MONTHLY REBALANCE GATE (Runs only on the 1st of the month or manual force)
    rebalance_note = "Next scheduled weight adjustment: 1st of next month."
    if (now.day == 1 and report.get("last_rebalance_month") != month_tag) or force_rebalance:
        prev_weights = dict(active_weights)
        new_weights, rebalance_note = compute_monthly_weights(active_weights, stats_60)
        active_weights = new_weights
        active_version = month_tag
        report["algo_version"] = active_version
        report["weights"] = active_weights
        report["last_rebalance_month"] = month_tag
        report.setdefault("weight_history", []).append({
            "date": today_str,
            "algo_version": active_version,
            "previous": prev_weights,
            "updated": active_weights,
            "win_rate_at_rebalance": stats_60["win_rate"],
            "note": rebalance_note
        })
        report["weight_history"] = report["weight_history"][-24:]

    # 2. BIWEEKLY EXECUTIVE SUMMARY REPORT (Generated on 1st & 15th, or if none exists yet)
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
            "what_changed": rebalance_note,
            "whats_working": bw_working,
            "whats_not_working": bw_not_working,
            "suggestions": bw_suggestions
        })
        report["biweekly_reports"] = biweekly_list[:26]

    report.update({
        "updated_at": now.isoformat(),
        "rebalance_cadence": "monthly",
        "target_win_rate": TARGET_WIN_RATE,
        "summary_60d": stats_60,
        "summary_14d": stats_14,
        "whats_working": working,
        "whats_not_working": not_working,
        "suggestions": suggestions,
        "last_rebalance_note": rebalance_note
    })

    save_json(HISTORY_FILE, history)
    save_json(REPORT_FILE, report)
    print(f"AlignIQ Agent complete | Algo {active_version} | 60d: {stats_60['win_rate']}% ({stats_60['wins']}-{stats_60['losses']})")


if __name__ == "__main__":
    main()
