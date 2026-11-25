import json
import os
from datetime import datetime, timezone, timedelta

HISTORY_FILE = "history.json"
REPORT_FILE = "agent_report.json"
DAILY_DIR = "daily_reports"
INDEX_FILE = os.path.join(DAILY_DIR, "index.json")


def load_json(path, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save_json(path, data):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def run_app_health_auditor(history, report, now):
    """Agent 1: Audits data integrity, missing dates, unnamed games, and model health."""
    issues = []
    passed = []
    dates = history.get("dates", {}) if isinstance(history, dict) else {}

    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    if yesterday in dates and len(dates[yesterday].get("games", [])) > 0:
        passed.append(f"Yesterday's slate ({yesterday}) is archived ({len(dates[yesterday]['games'])} games).")
    else:
        issues.append(f"Missing or empty archive for {yesterday} — verify ESPN sync in agent.py.")

    unnamed_count = 0
    for d_key, entry in dates.items():
        for g in entry.get("games", []):
            if not g.get("matchup") or str(g.get("matchup", "")).startswith("Game #"):
                unnamed_count += 1
    if unnamed_count == 0:
        passed.append("All archived games have full team/fighter names.")
    else:
        issues.append(f"{unnamed_count} legacy archived games still use numeric IDs instead of team names.")

    s60 = report.get("summary_60d", {})
    if s60.get("graded_with_odds", 0) < 50:
        issues.append(f"Only {s60.get('graded_with_odds', 0)}/50 games have logged moneylines for ROI-first tuning.")
    else:
        passed.append(f"ROI-first tuning data threshold met ({s60.get('graded_with_odds')} games with odds).")

    return {
        "agent": "App Health & QA Auditor",
        "status": "HEALTHY" if not issues else "ATTENTION NEEDED",
        "passed": passed,
        "issues": issues,
    }


def run_competitor_intel_agent():
    """Agent 2: Tracks 2026 sports analytics competitors & identifies high-value gaps."""
    return {
        "agent": "Competitor Intelligence Agent",
        "competitors_tracked": [
            {
                "name": "Rithmm",
                "what_they_do": "Shows model win probability directly next to sportsbook implied price + 'Scout' AI Q&A analyst + alt-line Prop Explorer.",
                "aligniq_edge": "AlignIQ adds Fight IQ Weight Cut Gauges, Body Maps, and Gematria convergence.",
                "gap_to_close": "Display a side-by-side 'Model % vs Market % = Edge' badge directly on the main feed cards."
            },
            {
                "name": "Oddible & OddsShopper",
                "what_they_do": "Unified line shopping across traditional sportsbooks AND prediction markets (Kalshi, Novig, ProphetX) with de-vigged true prices.",
                "aligniq_edge": "AlignIQ already converts odds to Kalshi cents and scans +EV/Arb.",
                "gap_to_close": "Add a dedicated '+EV & Arb Board' filter tab sorted strictly by highest Edge %."
            },
            {
                "name": "Pikkit & Juice",
                "what_they_do": "Automatic Closing Line Value (CLV) tracking and screenshot-to-betslip AI analysis with Kelly Criterion bet sizing.",
                "aligniq_edge": "AlignIQ tracks line movement and underdog ROI.",
                "gap_to_close": "Add a 1-tap Kelly Unit Sizer inside every Game Detail modal."
            }
        ]
    }


def run_chief_auditor_proposals(health_audit, report):
    """Agent 3: Cross-audits findings and builds Owner Approval Proposals with visual mockups."""
    proposals = [
        {
            "id": "prop_edge_pill_v1",
            "title": "Add 'Model % vs Market %' Edge Badge on Feed Cards",
            "category": "UI & Competitor Edge",
            "priority": "HIGH",
            "files_affected": ["app.js", "styles.css"],
            "description": "Inspired by Rithmm & OddsShopper: displays a compact green Edge pill (e.g., '+8.4% EDGE') right below the CONF % pill whenever AlignIQ's projection beats the no-vig market consensus. Helps users spot profitable plays in 1 second without opening every game.",
            "expected_impact": "Faster slate scanning and clearer distinction between high-confidence chalk and true +EV value.",
            "visual_preview_html": """
              <div style="background:#0e131f;border:1px solid rgba(0,210,133,0.45);border-radius:14px;padding:12px;font-family:sans-serif;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <div style="font-size:10px;color:#8b95a5;font-weight:700;">NBA · 7:30 PM EST</div>
                    <div style="font-size:13px;font-weight:800;color:#f8fafc;margin-top:3px;">BOS Celtics @ NY Knicks</div>
                    <div style="font-size:11px;color:#00d285;margin-top:2px;">Pick: BOS Win · Market 64% → Model 72%</div>
                  </div>
                  <div style="text-align:center;">
                    <div style="padding:4px 12px;border-radius:999px;border:1.5px solid #00d285;background:rgba(0,210,133,0.1);color:#00d285;font-weight:800;font-size:13px;">72%</div>
                    <div style="margin-top:4px;font-size:9.5px;font-weight:800;background:#38bdf8;color:#04130d;padding:2px 7px;border-radius:999px;">+8.0% EDGE</div>
                  </div>
                </div>
              </div>
            """
        },
        {
            "id": "prop_kelly_sizer_v1",
            "title": "Add Fractional Kelly Unit Sizer in Best Odds Tab",
            "category": "Bankroll & Pro Tools",
            "priority": "MEDIUM",
            "files_affected": ["app.js"],
            "description": "Adds an automatic Quarter-Kelly recommended unit size (e.g., '1.25u') next to every +EV sportsbook line based on the user's bankroll setting. Matches pro tools like Juice and OddsJam.",
            "expected_impact": "Protects user bankrolls from over-betting underdogs and maximizes long-term ROI.",
            "visual_preview_html": """
              <div style="background:#151c2c;border:1px solid rgba(56,189,248,0.4);border-radius:12px;padding:10px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="font-size:12px;font-weight:800;color:#f8fafc;">FanDuel <span style="background:rgba(56,189,248,0.18);color:#38bdf8;padding:2px 6px;border-radius:6px;font-size:9.5px;">+4.2% EV</span></div>
                  <div style="font-size:10.5px;color:#8b95a5;margin-top:2px;">Recommended Stake: <strong style="color:#00d285;">1.25 Units ($62.50)</strong></div>
                </div>
                <div style="font-size:15px;font-weight:800;color:#00d285;">+115</div>
              </div>
            """
        }
    ]

    cross_critique = (
        f"Chief Auditor verified App Health ({health_audit['status']}) against 60-day performance "
        f"({report.get('summary_60d', {}).get('win_rate', 0)}%). "
        f"{len(proposals)} visual update proposals queued for Owner approval. Zero live changes were pushed automatically."
    )
    return proposals, cross_critique


def main():
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")

    history = load_json(HISTORY_FILE, {"dates": {}})
    report = load_json(REPORT_FILE, {})

    health = run_app_health_auditor(history, report, now)
    comp = run_competitor_intel_agent()
    proposals, critique = run_chief_auditor_proposals(health, report)

    daily_payload = {
        "date": today_str,
        "generated_at": now.isoformat(),
        "win_rate_60d": report.get("summary_60d", {}).get("win_rate", 0),
        "record_60d": f"{report.get('summary_60d', {}).get('wins', 0)}-{report.get('summary_60d', {}).get('losses', 0)}",
        "app_health_audit": health,
        "competitor_intel": comp,
        "chief_auditor_critique": critique,
        "pending_proposals": proposals,
    }

    save_json(os.path.join(DAILY_DIR, f"{today_str}.json"), daily_payload)

    index = load_json(INDEX_FILE, {"dates": []})
    if today_str not in index["dates"]:
        index["dates"].insert(0, today_str)
    index["dates"] = sorted(list(set(index["dates"])), reverse=True)[:90]
    index["latest"] = index["dates"][0]
    save_json(INDEX_FILE, index)
    print(f"Owner Multi-Agent Council complete | Saved daily_reports/{today_str}.json")


if __name__ == "__main__":
    main()