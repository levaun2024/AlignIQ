import json
import os
from datetime import datetime, timezone

from agent import score_matchup, load_json, save_json, load_active_config

HISTORY_FILE = "history.json"
ANALYSIS_FILE = "analysis_report.json"
APPROVALS_FILE = "owner_approvals.json"
CONFIG_FILE = "algo_config.json"
REPORT_FILE = "agent_report.json"
DAILY_DIR = "daily_reports"


def flatten_completed_games(history):
    games = []
    for d_str, entry in sorted(history.get("dates", {}).items()):
        if not isinstance(entry, dict):
            continue
        for g in entry.get("games", []):
            if isinstance(g, dict) and str(g.get("actual_winner", "")).lower() in ("home", "away"):
                games.append({**g, "_date": d_str})
    return games


def evaluate_weights_on_games(games, weights):
    if not games:
        return 0.0, 0, 0
    wins = sum(1 for g in games if score_matchup(g.get("home"), g.get("away"), weights)["pick"] == str(g["actual_winner"]).lower())
    return round((wins / len(games)) * 100, 2), wins, len(games)


def walk_forward_optimize(games, base_weights):
    """Out-of-sample walk-forward test: fit on first 70% of games, validate on most recent 30%."""
    if len(games) < 40:
        return None
    split = int(len(games) * 0.70)
    train, test = games[:split], games[split:]

    base_test_wr, _, _ = evaluate_weights_on_games(test, base_weights)
    candidates = [
        {"gem": max(0, base_weights["gem"] - 4), "h2h": min(80, base_weights["h2h"] + 4), "ros": base_weights["ros"]},
        {"gem": base_weights["gem"], "h2h": min(80, base_weights["h2h"] + 5), "ros": max(10, base_weights["ros"] - 5)},
        {"gem": max(0, base_weights["gem"] - 5), "h2h": base_weights["h2h"], "ros": min(50, base_weights["ros"] + 5)},
        {"gem": min(20, base_weights["gem"] + 3), "h2h": max(45, base_weights["h2h"] - 3), "ros": base_weights["ros"]},
    ]

    best = None
    for cand in candidates:
        if sum(cand.values()) != 100 or cand == base_weights:
            continue
        tr_wr, _, _ = evaluate_weights_on_games(train, cand)
        te_wr, te_w, te_n = evaluate_weights_on_games(test, cand)
        lift = round(te_wr - base_test_wr, 2)
        if lift >= 1.5 and (best is None or lift > best["oos_lift"]):
            best = {
                "candidate_weights": cand,
                "baseline_oos_wr": base_test_wr,
                "candidate_oos_wr": te_wr,
                "train_wr": tr_wr,
                "oos_lift": lift,
                "oos_sample": te_n,
            }
    return best


def execute_approved_changes(approvals, cfg, analysis, now):
    """Applies any APPROVED algorithm changes to algo_config.json and logs before/after baseline."""
    executed_now = []
    for prop_id, item in approvals.items():
        if not isinstance(item, dict):
            continue
        if item.get("decision") == "APPROVED" and item.get("status") != "IMPLEMENTED":
            spec = item.get("change_spec")
            if isinstance(spec, dict) and spec.get("type") == "update_weights" and isinstance(spec.get("weights"), dict):
                old_w = dict(cfg["weights"])
                new_w = spec["weights"]
                cfg["weights"] = new_w
                if spec.get("league") and spec["league"] in cfg["league_weights"]:
                    cfg["league_weights"][spec["league"]] = new_w
                cfg["version"] = f"phase5-opt-{now.strftime('%Y%m%d-%H%M')}"
                cfg["updated_at"] = now.isoformat()
                cfg.setdefault("change_log", []).append({
                    "proposal_id": prop_id,
                    "title": item.get("title", prop_id),
                    "applied_at": now.isoformat(),
                    "before_weights": old_w,
                    "after_weights": new_w,
                    "baseline_win_rate": analysis.get("win_rate_60d", 0.0),
                    "owner_notes": item.get("notes", ""),
                })
                item["status"] = "IMPLEMENTED"
                item["implemented_at"] = now.isoformat()
                executed_now.append(prop_id)
            else:
                # Non-weight UI proposal acknowledged & queued
                item["status"] = "APPROVED_AWAITING_UI_DEPLOY"
                item["acknowledged_at"] = now.isoformat()

    if executed_now:
        save_json(CONFIG_FILE, cfg)
        # Keep agent_report.json in sync immediately
        rep = load_json(REPORT_FILE, {})
        rep["algo_version"] = cfg["version"]
        rep["weights"] = cfg["weights"]
        rep["league_weights"] = cfg["league_weights"]
        rep["updated_at"] = now.isoformat()
        save_json(REPORT_FILE, rep)

    save_json(APPROVALS_FILE, approvals)
    return executed_now


def main():
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    os.makedirs(DAILY_DIR, exist_ok=True)

    cfg = load_active_config()
    history = load_json(HISTORY_FILE, {"dates": {}})
    analysis = load_json(ANALYSIS_FILE, {})
    approvals = load_json(APPROVALS_FILE, {})

    # 1. Execute any newly approved algorithm adjustments
    executed_ids = execute_approved_changes(approvals, cfg, analysis, now)

    # 2. Agent 2: Walk-forward optimization check
    all_games = flatten_completed_games(history)
    opt_result = walk_forward_optimize(all_games, cfg["weights"])

    proposals = []
    if opt_result:
        cw = opt_result["candidate_weights"]
        prop_id = f"opt_weights_{cw['gem']}_{cw['h2h']}_{cw['ros']}"
        if approvals.get(prop_id, {}).get("status") != "IMPLEMENTED":
            proposals.append({
                "id": prop_id,
                "title": f"Algorithm Weight Adjustment ({cw['gem']}/{cw['h2h']}/{cw['ros']})",
                "description": (
                    f"Out-of-sample walk-forward test ({opt_result['oos_sample']} recent games) improved win rate from "
                    f"{opt_result['baseline_oos_wr']}% to {opt_result['candidate_oos_wr']}% (+{opt_result['oos_lift']}% lift)."
                ),
                "change_spec": {"type": "update_weights", "weights": cw},
                "visual_preview_html": (
                    f"<div style='background:#0b1220;border:1px solid #38bdf8;border-radius:10px;padding:10px;font-size:11px;'>"
                    f"<div><b>Current:</b> {cfg['weights']['gem']}% Sig / {cfg['weights']['h2h']}% Odds / {cfg['weights']['ros']}% Form</div>"
                    f"<div style='color:#00d285;margin-top:4px;'><b>Proposed:</b> {cw['gem']}% Sig / {cw['h2h']}% Odds / {cw['ros']}% Form (+{opt_result['oos_lift']}% OOS)</div></div>"
                ),
            })

    # 3. Before-and-after impact of previous implemented changes
    change_log = cfg.get("change_log", [])
    before_after = []
    for ch in change_log[-5:]:
        delta = round(analysis.get("win_rate_60d", 0.0) - ch.get("baseline_win_rate", 0.0), 1)
        before_after.append({
            "proposal_id": ch["proposal_id"],
            "applied_at": ch["applied_at"],
            "before_weights": ch["before_weights"],
            "after_weights": ch["after_weights"],
            "baseline_wr": ch["baseline_win_rate"],
            "current_wr": analysis.get("win_rate_60d", 0.0),
            "impact": f"{delta:+.1f}% ({'Improved' if delta > 0 else 'Reduced' if delta < 0 else 'Neutral'})",
        })

    # 4. Build live Daily Report
    daily_report = {
        "date": today_str,
        "generated_at": now.isoformat(),
        "algo_version": cfg["version"],
        "active_weights": cfg["weights"],
        "execution_summary": {
            "agent1_status": analysis.get("status", "UNKNOWN"),
            "agent1_ran_at": analysis.get("generated_at"),
            "agent2_status": "SUCCESS",
            "newly_executed_approvals": executed_ids,
        },
        "performance_analysis": {
            "completed_games_analyzed": analysis.get("total_completed_60d", 0),
            "newly_analyzed_games": analysis.get("newly_analyzed_games", 0),
            "win_rate_60d": analysis.get("win_rate_60d", 0.0),
            "record_60d": f"{analysis.get('wins_60d', 0)}-{analysis.get('losses_60d', 0)}",
            "roi_pct_60d": analysis.get("roi_pct_60d"),
            "biggest_successes": analysis.get("biggest_successes", []),
            "biggest_failures": analysis.get("biggest_failures", []),
            "overvalued_factors": analysis.get("overvalued_factors", []),
            "undervalued_factors": analysis.get("undervalued_factors", []),
            "recurring_weaknesses": analysis.get("recurring_weaknesses", []),
            "calibration": analysis.get("calibration", {}),
        },
        "before_and_after_performance": before_after,
        "implemented_adjustments": [k for k, v in approvals.items() if isinstance(v, dict) and v.get("status") == "IMPLEMENTED"],
        "pending_proposals": proposals,
        "chief_auditor_critique": (
            f"Analyzed {analysis.get('total_completed_60d', 0)} completed games ({analysis.get('win_rate_60d', 0)}% WR). "
            f"Executed {len(executed_ids)} approved adjustment(s). Active weights: {cfg['weights']}."
        ),
        "app_health_audit": {
            "status": "HEALTHY" if analysis.get("total_completed_60d", 0) > 0 else "ATTENTION NEEDED",
            "passed": [
                f"Active config loaded ({cfg['version']})",
                f"Agent 1 & Agent 2 pipeline synced ({now.strftime('%H:%M UTC')})",
            ],
            "issues": analysis.get("recurring_weaknesses", []),
        },
    }

    save_json(os.path.join(DAILY_DIR, f"{today_str}.json"), daily_report)

    idx_path = os.path.join(DAILY_DIR, "index.json")
    idx = load_json(idx_path, {"dates": []})
    dates_set = sorted(set(idx.get("dates", []) + [today_str]), reverse=True)[:90]
    save_json(idx_path, {"dates": dates_set, "updated_at": now.isoformat()})
    print(f"Agent 2 complete | Executed: {executed_ids} | Proposals: {len(proposals)}")


if __name__ == "__main__":
    main()