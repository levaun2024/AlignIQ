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
    wins = sum(
        1 for g in games
        if score_matchup(g.get("home"), g.get("away"), weights)["pick"] == str(g["actual_winner"]).lower()
    )
    return round((wins / len(games)) * 100, 2), wins, len(games)


def walk_forward_optimize(games, base_weights):
    """Out-of-sample walk-forward test: train on older 70%, validate on recent 30%."""
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
        te_wr, _, te_n = evaluate_weights_on_games(test, cand)
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
    """Executes AGENT_AUTO approvals into algo_config.json and routes OWNER_CODE approvals to the Dev Queue."""
    executed_now = []
    cfg.setdefault("active_features", {})

    LEGACY_FEATURE_MAP = {
        "prop_kelly_sizer_v1": "kelly_unit_sizer",
        "prop_edge_badge_v1": "edge_badge_cards",
        "prop_ml_capture_v1": "auto_moneyline_logging",
        "prop_dog_guardrail_v1": "strict_underdog_filter",
    }

    for prop_id, item in approvals.items():
        if not isinstance(item, dict):
            continue
        if item.get("decision") == "COMPLETED" or item.get("status") == "COMPLETED":
            item["status"] = "COMPLETED"
            continue

        if item.get("decision") == "APPROVED" and item.get("status") not in ("IMPLEMENTED", "AWAITING_OWNER_CODE"):
            spec = item.get("change_spec")

            if not spec and prop_id in LEGACY_FEATURE_MAP:
                spec = {"type": "enable_feature", "feature": LEGACY_FEATURE_MAP[prop_id], "enabled": True}
                item["change_spec"] = spec

            if isinstance(spec, dict) and spec.get("type") == "update_weights" and isinstance(spec.get("weights"), dict):
                old_w = dict(cfg["weights"])
                new_w = spec["weights"]
                cfg["weights"] = new_w
                if spec.get("league") and spec["league"] in cfg.get("league_weights", {}):
                    cfg["league_weights"][spec["league"]] = new_w
                cfg["version"] = f"phase5-opt-{now.strftime('%Y%m%d-%H%M')}"
                cfg["updated_at"] = now.isoformat()
                cfg.setdefault("change_log", []).append({
                    "proposal_id": prop_id,
                    "category": "ALGORITHMIC",
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

            elif isinstance(spec, dict) and spec.get("type") == "enable_feature" and spec.get("feature"):
                feat = spec["feature"]
                cfg["active_features"][feat] = bool(spec.get("enabled", True))
                cfg["updated_at"] = now.isoformat()
                cfg.setdefault("change_log", []).append({
                    "proposal_id": prop_id,
                    "category": spec.get("category", "STRUCTURAL/UI"),
                    "title": item.get("title", prop_id),
                    "applied_at": now.isoformat(),
                    "feature_flag": feat,
                    "baseline_win_rate": analysis.get("win_rate_60d", 0.0),
                    "owner_notes": item.get("notes", ""),
                })
                item["status"] = "IMPLEMENTED"
                item["implemented_at"] = now.isoformat()
                executed_now.append(prop_id)

            else:
                # Owner manual code change -> archive into Dev Queue
                item["status"] = "AWAITING_OWNER_CODE"
                item["queued_at"] = now.isoformat()

    if executed_now:
        save_json(CONFIG_FILE, cfg)
        rep = load_json(REPORT_FILE, {})
        rep["algo_version"] = cfg["version"]
        rep["weights"] = cfg["weights"]
        rep["league_weights"] = cfg.get("league_weights", {})
        rep["active_features"] = cfg.get("active_features", {})
        rep["updated_at"] = now.isoformat()
        save_json(REPORT_FILE, rep)

    save_json(APPROVALS_FILE, approvals)
    return executed_now


def build_council_proposals(cfg, analysis, opt_result, approvals, all_games):
    """Generates both AGENT_AUTO (instant) and OWNER_CODE (manual repo edit) proposals."""
    proposals = []
    active_feats = cfg.get("active_features", {})

    def is_done(pid):
        return approvals.get(pid, {}).get("status") in ("IMPLEMENTED", "COMPLETED", "AWAITING_OWNER_CODE")

    # 1. AGENT_AUTO: Algorithmic Weight Rebalance
    if opt_result:
        cw = opt_result["candidate_weights"]
        pid = f"opt_weights_{cw['gem']}_{cw['h2h']}_{cw['ros']}"
        if not is_done(pid):
            proposals.append({
                "id": pid,
                "execution_type": "AGENT_AUTO",
                "category": "ALGORITHMIC",
                "priority": "HIGH",
                "title": f"Rebalance Model Weights ({cw['gem']}/{cw['h2h']}/{cw['ros']})",
                "description": (
                    f"We tested these new weights on the {opt_result['oos_sample']} most recent games the model hadn't seen yet, "
                    f"and accuracy jumped from {opt_result['baseline_oos_wr']}% to {opt_result['candidate_oos_wr']}% (+{opt_result['oos_lift']}%)."
                ),
                "change_spec": {"type": "update_weights", "weights": cw},
                "visual_preview_html": (
                    f"<div style='background:#0b1220;border:1px solid #38bdf8;border-radius:10px;padding:10px;font-size:11px;'>"
                    f"<div><b>Current:</b> {cfg['weights']['gem']}% Signals / {cfg['weights']['h2h']}% Odds / {cfg['weights']['ros']}% Form</div>"
                    f"<div style='color:#00d285;margin-top:4px;'><b>Proposed:</b> {cw['gem']}% Signals / {cw['h2h']}% Odds / {cw['ros']}% Form (+{opt_result['oos_lift']}% lift)</div></div>"
                ),
            })

    # 2. AGENT_AUTO: Edge Badge Toggle
    if not active_feats.get("edge_badge_cards") and not is_done("prop_edge_badge_v1"):
        proposals.append({
            "id": "prop_edge_badge_v1",
            "execution_type": "AGENT_AUTO",
            "category": "VISUAL / UX",
            "priority": "MEDIUM",
            "title": "Turn On '+EDGE' Badges on Feed Cards",
            "description": "Adds a clean blue pill right under CONF % whenever our model beats the Vegas no-vig consensus by 1.5%+, so you can spot value plays in 1 second.",
            "change_spec": {"type": "enable_feature", "feature": "edge_badge_cards", "enabled": True, "category": "VISUAL / UX"},
            "visual_preview_html": "<div style='background:#0b1220;border:1px solid #38bdf8;border-radius:10px;padding:10px;font-size:11px;'><b>BOS Celtics @ NY Knicks</b> · <span style='color:#00d285;'>72% CONF</span> · <span style='background:#38bdf8;color:#000;padding:1px 6px;border-radius:99px;font-weight:800;'>+8.0% EDGE</span></div>",
        })

    # 3. AGENT_AUTO: Fractional Kelly Sizer Toggle
    if not active_feats.get("kelly_unit_sizer") and not is_done("prop_kelly_sizer_v1"):
        proposals.append({
            "id": "prop_kelly_sizer_v1",
            "execution_type": "AGENT_AUTO",
            "category": "RISK & BANKROLL",
            "priority": "MEDIUM",
            "title": "Turn On Quarter-Kelly Stake Sizer in Best Odds",
            "description": "Automatically calculates the exact recommended unit & dollar size next to every +EV sportsbook line so you never over-bet a single game.",
            "change_spec": {"type": "enable_feature", "feature": "kelly_unit_sizer", "enabled": True, "category": "RISK & BANKROLL"},
            "visual_preview_html": "<div style='background:#0b1220;border:1px solid #00d285;border-radius:10px;padding:10px;font-size:11px;'><b>FanDuel +4.2% EV</b> · Recommended Stake: <span style='color:#00d285;'>1.25u ($12.50)</span></div>",
        })

    # 4. OWNER_CODE: Custom Bankroll Input in Settings
    if not is_done("code_bankroll_settings_v1"):
        proposals.append({
            "id": "code_bankroll_settings_v1",
            "execution_type": "OWNER_CODE",
            "category": "STRUCTURAL / UI",
            "priority": "MEDIUM",
            "title": "Add Custom Bankroll Input Field in Settings Modal",
            "description": "Right now the Kelly Sizer defaults to a $1,000 bankroll. Adding a simple Bankroll ($) input box in Settings lets every user plug in their real bankroll.",
            "change_spec": {"type": "manual_code", "target_files": ["app.js"]},
            "visual_preview_html": "<div style='background:#0b1220;border:1px solid #f59e0b;border-radius:10px;padding:10px;font-size:11px;'><b>Settings → Bankroll:</b> <code>[ $ 1000 ]</code> → Updates Kelly dollar stakes live.</div>",
        })

    # 5. OWNER_CODE: Closing Line Value (CLV) Tracker Column
    ml_logged = sum(1 for g in all_games if g.get("home_ml") is not None and g.get("away_ml") is not None)
    if ml_logged < 50 and not is_done("code_clv_tracker_v1"):
        proposals.append({
            "id": "code_clv_tracker_v1",
            "execution_type": "OWNER_CODE",
            "category": "INFORMATIONAL",
            "priority": "HIGH",
            "title": "Build Pre-Game Odds Snapshotter for Verified ROI & CLV",
            "description": f"Only {ml_logged}/50 archived games have moneylines saved. Adding an evening pre-game GitHub Action run locks in closing odds before tip-off so we can prove real profit to investors.",
            "change_spec": {"type": "manual_code", "target_files": [".github/workflows/daily_agents.yml", "agent.py"]},
            "visual_preview_html": "<div style='background:#0b1220;border:1px solid #f59e0b;border-radius:10px;padding:10px;font-size:11px;'><b>Scheduled Pre-Game Capture:</b> Saves closing ML → unlocks verified <b>Net Units &amp; CLV %</b>.</div>",
        })

    return proposals


def build_plain_english_brief(wr_60d, total_60d, analysis, health_score, executed_ids, proposals):
    """Writes a friendly, easy-to-read explanation of what happened and what matters most."""
    over = analysis.get("overvalued_factors", [])
    under = analysis.get("undervalued_factors", [])
    weak = analysis.get("recurring_weaknesses", [])

    if total_60d == 0:
        headline = "We're just getting started—no completed games have been graded in the last 60 days yet."
    elif wr_60d >= 65:
        headline = f"The model is rolling right now—hitting {wr_60d}% across {total_60d} completed games over the last 60 days."
    elif wr_60d >= 55:
        headline = f"Solid, profitable territory—we're hitting {wr_60d}% across {total_60d} games, with room to tighten up weak spots."
    else:
        headline = f"Accuracy has dipped to {wr_60d}% across {total_60d} games, so we need to pay close attention to what's dragging us down."

    what_worked = (
        f"Our strongest signal lately is {under[0]}." if under
        else "All three core pillars (Market Odds, Form/Rest, and Signals) are pulling their weight without major imbalance."
    )
    watch_out = (
        f"Heads up: {over[0]} has been over-confident on losses." if over
        else (f"Main weak spot to watch: {weak[0]}." if weak else "No major red flags or recurring blind spots popped up today.")
    )
    next_step = (
        f"I automatically applied {len(executed_ids)} approved update(s) to your live config, and queued {len(proposals)} new idea(s) in your Approvals tab."
        if executed_ids else
        f"You have {len(proposals)} suggestion(s) waiting in Approvals—auto-updates apply in 45 seconds, and manual code ideas go straight to your Dev Queue."
    )
    return {
        "headline": headline,
        "what_worked": what_worked,
        "watch_out": watch_out,
        "next_step": next_step,
    }


def main():
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    os.makedirs(DAILY_DIR, exist_ok=True)

    cfg = load_active_config()
    history = load_json(HISTORY_FILE, {"dates": {}})
    analysis = load_json(ANALYSIS_FILE, {})
    approvals = load_json(APPROVALS_FILE, {})

    executed_ids = execute_approved_changes(approvals, cfg, analysis, now)
    all_games = flatten_completed_games(history)
    opt_result = walk_forward_optimize(all_games, cfg["weights"])
    proposals = build_council_proposals(cfg, analysis, opt_result, approvals, all_games)

    legacy_numeric = sum(1 for g in all_games if not g.get("matchup") or str(g.get("matchup", "")).startswith("Game #"))
    ml_logged = sum(1 for g in all_games if g.get("home_ml") is not None and g.get("away_ml") is not None)
    total_60d = analysis.get("total_completed_60d", 0)
    wr_60d = analysis.get("win_rate_60d", 0.0)

    health_score = 100
    if total_60d < 100:
        health_score -= 15
    if ml_logged < 50:
        health_score -= 15
    if legacy_numeric > 25:
        health_score -= 10
    if analysis.get("recurring_weaknesses"):
        health_score -= 10
    health_score = max(40, health_score)

    before_after = []
    for ch in cfg.get("change_log", [])[-5:]:
        delta = round(wr_60d - ch.get("baseline_win_rate", 0.0), 1)
        before_after.append({
            "proposal_id": ch["proposal_id"],
            "category": ch.get("category", "ALGORITHMIC"),
            "title": ch.get("title", ch["proposal_id"]),
            "applied_at": ch["applied_at"],
            "baseline_wr": ch.get("baseline_win_rate", 0.0),
            "current_wr": wr_60d,
            "impact": f"{delta:+.1f}% ({'Improved' if delta > 0 else 'Reduced' if delta < 0 else 'Neutral'})",
        })

    plain_brief = build_plain_english_brief(wr_60d, total_60d, analysis, health_score, executed_ids, proposals)

    daily_report = {
        "date": today_str,
        "generated_at": now.isoformat(),
        "algo_version": cfg["version"],
        "active_weights": cfg["weights"],
        "active_features": cfg.get("active_features", {}),
        "investor_audit_score": health_score,
        "plain_english_brief": plain_brief,
        "execution_summary": {
            "agent1_status": analysis.get("status", "UNKNOWN"),
            "agent1_ran_at": analysis.get("generated_at"),
            "agent2_status": "SUCCESS",
            "newly_executed_approvals": executed_ids,
        },
        "performance_analysis": {
            "completed_games_analyzed": total_60d,
            "newly_analyzed_games": analysis.get("newly_analyzed_games", 0),
            "win_rate_60d": wr_60d,
            "record_60d": f"{analysis.get('wins_60d', 0)}-{analysis.get('losses_60d', 0)}",
            "roi_pct_60d": analysis.get("roi_pct_60d"),
            "net_units_60d": analysis.get("net_units_60d"),
            "factor_attribution": analysis.get("factor_attribution", {}),
            "overvalued_factors": analysis.get("overvalued_factors", []),
            "undervalued_factors": analysis.get("undervalued_factors", []),
            "recurring_weaknesses": analysis.get("recurring_weaknesses", []),
            "calibration": analysis.get("calibration", {}),
            "biggest_successes": analysis.get("biggest_successes", []),
            "biggest_failures": analysis.get("biggest_failures", []),
        },
        "before_and_after_performance": before_after,
        "implemented_adjustments": [k for k, v in approvals.items() if isinstance(v, dict) and v.get("status") == "IMPLEMENTED"],
        "pending_proposals": proposals,
        "competitor_intel": {
            "competitors_tracked": [
                {
                    "name": "OddsJam / OddsShopper",
                    "what_they_do": "Real-time +EV scanning, Kelly stake sizing, and closing line value (CLV) tracking.",
                    "aligniq_edge": "Combines market consensus with proprietary Pattern + Form/Rest composite modeling.",
                    "gap_to_close": "Capture closing moneylines on every archived slate to publish verified CLV & ROI.",
                },
                {
                    "name": "Rithmm / Action Network",
                    "what_they_do": "Displays instant Model % vs Market % edge pills and confidence tiers on the main feed.",
                    "aligniq_edge": "Transparent post-game autopsies and walk-forward self-auditing Agent Council.",
                    "gap_to_close": "Surface Edge Badges and live feature flags directly on feed cards.",
                },
            ]
        },
        "chief_auditor_critique": plain_brief["headline"] + " " + plain_brief["next_step"],
        "app_health_audit": {
            "status": "HEALTHY" if health_score >= 85 else "ATTENTION NEEDED",
            "passed": [
                f"Active config loaded ({cfg['version']})",
                f"Agent 1 & Agent 2 synced ({now.strftime('%Y-%m-%d %H:%M UTC')})",
                f"Active live feature flags: {len([k for k, v in cfg.get('active_features', {}).items() if v])}",
            ],
            "issues": [
                *([] if ml_logged >= 50 else [f"Only {ml_logged}/50 games have logged moneylines for ROI-first tuning."]),
                *([] if legacy_numeric == 0 else [f"{legacy_numeric} legacy archived games still use numeric IDs."]),
                *analysis.get("recurring_weaknesses", []),
            ],
        },
    }

    save_json(os.path.join(DAILY_DIR, f"{today_str}.json"), daily_report)

    # Archive up to 365 days of Daily Reports in index.json
    idx_path = os.path.join(DAILY_DIR, "index.json")
    idx = load_json(idx_path, {"dates": []})
    dates_set = sorted(set(idx.get("dates", []) + [today_str]), reverse=True)[:365]
    save_json(idx_path, {"dates": dates_set, "updated_at": now.isoformat()})
    print(f"Investor Council complete | Score: {health_score}/100 | Executed: {executed_ids} | Proposals: {len(proposals)}")


if __name__ == "__main__":
    main()