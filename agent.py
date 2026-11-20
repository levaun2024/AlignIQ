import json
import os
import re
import urllib.request
from datetime import datetime, timedelta, timezone

LEAGUES = [
    {"key": "NBA", "path": "basketball/nba"},
    {"key": "NFL", "path": "football/nfl"},
    {"key": "NHL", "path": "hockey/nhl"},
    {"key": "MLB", "path": "baseball/mlb"},
    {"key": "NCAAF", "path": "football/college-football"},
    {"key": "NCAAB", "path": "basketball/mens-college-basketball"},
    {"key": "NCAAW", "path": "basketball/womens-college-basketball"},
    {"key": "WNBA", "path": "basketball/wnba"},
    {"key": "UFC", "path": "mma/ufc"},
    {"key": "EPL", "path": "soccer/eng.1"},
    {"key": "MLS", "path": "soccer/usa.1"},
    {"key": "UCL", "path": "soccer/uefa.champions"},
]

HISTORY_FILE = "history.json"
REPORT_FILE = "agent_report.json"
DEFAULT_WEIGHTS = {"gem": 45, "h2h": 25, "ros": 30}
MAX_WEEKLY_SWING = 5  # Max +/- 5% change per pillar per weekly retune
MIN_SAMPLE_SIZE = 100
ROLLING_DAYS = 60


# --- 4-CIPHER GEMATRIA ENGINE ---
def reduce_digit(n):
    while n > 9:
        n = sum(int(ch) for ch in str(n))
    return n


def calc_ciphers(text):
    clean = re.sub(r"[^A-Z]", "", (text or "").upper())
    ord_v = red_v = rev_v = rred_v = 0
    for ch in clean:
        v = ord(ch) - 64
        rv = 27 - v
        ord_v += v
        red_v += reduce_digit(v)
        rev_v += rv
        rred_v += reduce_digit(rv)
    return (ord_v, red_v, rev_v, rred_v)


def get_date_math(dt):
    m, d, y = dt.month, dt.day, dt.year
    y_top, y_bot = y // 100, y % 100
    full = m + d + y_top + y_bot
    short = m + d + y_bot
    digits = sum(int(c) for c in f"{m}{d}{y}")
    mixed = m + d + sum(int(c) for c in str(y))
    doy = dt.timetuple().tm_yday
    is_leap = (y % 4 == 0 and y % 100 != 0) or (y % 400 == 0)
    left = (366 if is_leap else 365) - doy
    return {full, short, digits, mixed, doy, left}


def parse_record(rec_str):
    m = re.search(r"(\d+)\s*-\s*(\d+)", str(rec_str or ""))
    return (int(m.group(1)), int(m.group(2))) if m else None


def build_targets(w, l):
    t = set()
    concat = int(f"{w}{l}")
    no_zero_str = f"{w}{l}".replace("0", "")
    no_zero = int(no_zero_str) if no_zero_str else 0
    if concat > 0:
        t.add(concat)
    if no_zero > 0:
        t.add(no_zero)
    if w > 0:
        t.add(w)
    if l > 0:
        t.add(l)
    return t


def progressive_score(hits):
    if hits < 2:
        return 0
    tiers = [0, 0, 42, 62, 76, 88, 95, 100]
    return tiers[min(hits, len(tiers) - 1)]


# --- ESPN FETCHER ---
def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "AlignIQ-Agent/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None
    return None


def fetch_completed_games_for_date(dt):
    ymd = dt.strftime("%Y%m%d")
    dm = get_date_math(dt)
    games = []

    for lg in LEAGUES:
        url = f"https://site.api.espn.com/apis/site/v2/sports/{lg['path']}/scoreboard?dates={ymd}"
        data = fetch_json(url)
        if not isinstance(data, dict):
            continue

        for ev in data.get("events") or []:
            if not isinstance(ev, dict):
                continue
            comps = ev.get("competitions") or []
            comp = comps[0] if (comps and isinstance(comps[0], dict)) else {}
            competitors = comp.get("competitors") or []
            if len(competitors) < 2:
                continue

            status_state = ((comp.get("status") or {}).get("type") or {}).get("state")
            if status_state != "post":
                continue

            home = next((c for c in competitors if isinstance(c, dict) and c.get("homeAway") == "home"), competitors[0])
            away = next((c for c in competitors if isinstance(c, dict) and c.get("homeAway") == "away"), competitors[1])
            if not isinstance(home, dict) or not isinstance(away, dict):
                continue

            try:
                h_score = int(float(home.get("score", 0)))
                a_score = int(float(away.get("score", 0)))
            except (ValueError, TypeError):
                continue

            if h_score == a_score:
                continue  # Skip ties/draws

            actual_winner = "home" if h_score > a_score else "away"

            def get_rec(team_obj, rtype):
                recs = team_obj.get("records") or []
                for r in recs:
                    if isinstance(r, dict) and r.get("type") == rtype:
                        return r.get("summary", "")
                return recs[0].get("summary", "") if (recs and isinstance(recs[0], dict) and rtype == "total") else ""

            h_team = home.get("team") or {}
            a_team = away.get("team") or {}
            h_name = h_team.get("displayName") or (home.get("athlete") or {}).get("displayName") or "Home"
            a_name = a_team.get("displayName") or (away.get("athlete") or {}).get("displayName") or "Away"
            h_short = h_team.get("shortDisplayName") or h_team.get("name") or h_name
            a_short = a_team.get("shortDisplayName") or a_team.get("name") or a_name

            # Reconstruct pre-game records by subtracting the final result
            h_rec_post = parse_record(get_rec(home, "total"))
            a_rec_post = parse_record(get_rec(away, "total"))
            if h_rec_post:
                h_pre = (
                    max(0, h_rec_post[0] - (1 if actual_winner == "home" else 0)),
                    max(0, h_rec_post[1] - (1 if actual_winner == "away" else 0)),
                )
            else:
                h_pre = None

            if a_rec_post:
                a_pre = (
                    max(0, a_rec_post[0] - (1 if actual_winner == "away" else 0)),
                    max(0, a_rec_post[1] - (1 if actual_winner == "home" else 0)),
                )
            else:
                a_pre = None

            venue = (comp.get("venue") or {}).get("fullName", "")
            broadcasts = comp.get("broadcasts") or []
            b_names = (broadcasts[0].get("names") or []) if (broadcasts and isinstance(broadcasts[0], dict)) else []
            broadcast = b_names[0] if b_names else ""

            entities = list({
                t.strip() for t in [
                    a_name, a_team.get("location", ""), a_team.get("name", ""),
                    h_name, h_team.get("location", ""), h_team.get("name", ""),
                    venue, broadcast
                ] if t and isinstance(t, str) and t.strip()
            })

            a_win_t = build_targets(a_pre[0] + 1, a_pre[1]) if a_pre else set()
            a_loss_t = build_targets(a_pre[0], a_pre[1] + 1) if a_pre else set()
            h_win_t = build_targets(h_pre[0] + 1, h_pre[1]) if h_pre else set()
            h_loss_t = build_targets(h_pre[0], h_pre[1] + 1) if h_pre else set()

            def count_hits(win_t, opp_loss_t, team_short):
                hits = 0
                for ent in entities:
                    for val in calc_ciphers(ent):
                        if val > 0 and (val in win_t or val in opp_loss_t):
                            hits += 1
                for val in calc_ciphers(team_short):
                    if val in dm:
                        hits += 1
                return hits

            away_hits = count_hits(a_win_t, h_loss_t, a_short)
            home_hits = count_hits(h_win_t, a_loss_t, h_short)
            away_gem = progressive_score(away_hits)
            home_gem = progressive_score(home_hits)

            # Odds & Splits (null-safe)
            odds_list = comp.get("odds") or []
            odds_obj = odds_list[0] if (odds_list and isinstance(odds_list[0], dict)) else {}
            odds_fav = None
            if (odds_obj.get("homeTeamOdds") or {}).get("favorite"):
                odds_fav = "home"
            elif (odds_obj.get("awayTeamOdds") or {}).get("favorite"):
                odds_fav = "away"

            a_pct = (a_pre[0] / (a_pre[0] + a_pre[1])) if (a_pre and (a_pre[0] + a_pre[1]) > 0) else 0.5
            h_pct = (h_pre[0] / (h_pre[0] + h_pre[1])) if (h_pre and (h_pre[0] + h_pre[1]) > 0) else 0.5

            vegas_home = 10 if odds_fav == "home" else (-10 if odds_fav == "away" else 0)
            h2h_home = min(95, max(15, round(50 + (h_pct - a_pct) * 38 + vegas_home)))
            h2h_away = min(95, max(15, round(50 + (a_pct - h_pct) * 38 - vegas_home)))

            # Baseline roster/form pillar (home-court + win% edge)
            ros_home = min(95, max(15, round(58 + (h_pct - a_pct) * 28)))
            ros_away = min(95, max(15, round(54 + (a_pct - h_pct) * 28)))

            games.append({
                "id": str(ev.get("id")),
                "date": dt.strftime("%Y-%m-%d"),
                "league": lg["key"],
                "matchup": f"{a_short} @ {h_short}",
                "actual_winner": actual_winner,
                "home_gem": home_gem,
                "away_gem": away_gem,
                "home_h2h": h2h_home,
                "away_h2h": h2h_away,
                "home_ros": ros_home,
                "away_ros": ros_away,
            })

    return games


# --- SCORING & OPTIMIZER ---
def score_game(g, w):
    total_w = (w["gem"] + w["h2h"] + w["ros"]) or 1
    home_conf = round((g["home_gem"] * w["gem"] + g["home_h2h"] * w["h2h"] + g["home_ros"] * w["ros"]) / total_w)
    away_conf = round((g["away_gem"] * w["gem"] + g["away_h2h"] * w["h2h"] + g["away_ros"] * w["ros"]) / total_w)

    if home_conf >= away_conf:
        pick, conf = "home", min(99, max(8, home_conf))
    else:
        pick, conf = "away", min(99, max(8, away_conf))

    return pick, conf, (pick == g["actual_winner"])


def evaluate_weights(games, w):
    if not games:
        return 0.0, 0, 0
    wins = sum(1 for g in games if score_game(g, w)[2])
    return (wins / len(games)), wins, len(games)


def clamp_weights(old_w, target_w):
    # Apply max +/- 5% weekly damping per pillar, then normalize to 100
    clamped = {}
    for k in ("gem", "h2h", "ros"):
        diff = target_w[k] - old_w[k]
        step = max(-MAX_WEEKLY_SWING, min(MAX_WEEKLY_SWING, diff))
        clamped[k] = max(0, old_w[k] + step)
    total = sum(clamped.values()) or 1
    norm = {k: round(clamped[k] * 100 / total) for k in ("gem", "h2h", "ros")}
    norm["ros"] = 100 - norm["gem"] - norm["h2h"]
    return norm


def optimize_weights(games, current_w):
    best_w = dict(current_w)
    best_acc, _, _ = evaluate_weights(games, current_w)

    for gem in range(0, 101, 5):
        for h2h in range(0, 101 - gem, 5):
            ros = 100 - gem - h2h
            cand = {"gem": gem, "h2h": h2h, "ros": ros}
            acc, _, _ = evaluate_weights(games, cand)
            if acc > best_acc + 0.002:  # Require real improvement
                best_acc = acc
                best_w = cand

    return clamp_weights(current_w, best_w), best_w


def main():
    now_utc = datetime.now(timezone.utc)
    today = (now_utc - timedelta(hours=5)).date()  # EST reference

    # 1. Load existing history
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            history = json.load(f)
    else:
        history = []

    existing_ids = {g["id"] for g in history}

    # 2. Initial 30-day backfill OR daily yesterday sync
    days_to_fetch = 30 if len(history) == 0 else 2
    new_count = 0
    for offset in range(1, days_to_fetch + 1):
        target_day = today - timedelta(days=offset)
        fetched = fetch_completed_games_for_date(datetime(target_day.year, target_day.month, target_day.day))
        for g in fetched:
            if g["id"] not in existing_ids:
                history.append(g)
                existing_ids.add(g["id"])
                new_count += 1

    # Keep history sorted by date
    history.sort(key=lambda x: x["date"])
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)

    # 3. Load previous report & weights
    prev_report = {}
    if os.path.exists(REPORT_FILE):
        with open(REPORT_FILE, "r", encoding="utf-8") as f:
            prev_report = json.load(f)

    active_weights = prev_report.get("active_weights", dict(DEFAULT_WEIGHTS))

    # 4. Filter to rolling 60-day window
    cutoff = (today - timedelta(days=ROLLING_DAYS)).strftime("%Y-%m-%d")
    window_games = [g for g in history if g["date"] >= cutoff]

    # 5. Retune ONLY on Mondays (weekday == 0) or first-ever run, AND if sample >= 100
    is_monday = today.weekday() == 0
    is_first_run = not bool(prev_report)
    retuned = False
    ideal_unclamped = active_weights

    if (is_monday or is_first_run) and len(window_games) >= MIN_SAMPLE_SIZE:
        active_weights, ideal_unclamped = optimize_weights(window_games, active_weights)
        retuned = True

    # 6. Build Accuracy & Confidence Tier Report
    overall_acc, overall_w, overall_n = evaluate_weights(window_games, active_weights)

    tiers = {}
    for thresh in (60, 65, 70, 75):
        t_games = [g for g in window_games if score_game(g, active_weights)[1] >= thresh]
        t_acc, t_w, t_n = evaluate_weights(t_games, active_weights)
        tiers[f"{thresh}%+"] = {"wins": t_w, "total": t_n, "win_rate": round(t_acc * 100, 1)}

    by_league = {}
    for lg in LEAGUES:
        lg_games = [g for g in window_games if g["league"] == lg["key"]]
        if lg_games:
            l_acc, l_w, l_n = evaluate_weights(lg_games, active_weights)
            by_league[lg["key"]] = {"wins": l_w, "total": l_n, "win_rate": round(l_acc * 100, 1)}

    report = {
        "last_updated": now_utc.strftime("%Y-%m-%d %H:%M UTC"),
        "new_games_logged": new_count,
        "rolling_window_days": ROLLING_DAYS,
        "total_games_graded": overall_n,
        "overall_win_rate": round(overall_acc * 100, 1),
        "overall_record": f"{overall_w}-{overall_n - overall_w}",
        "retuned_this_run": retuned,
        "active_weights": active_weights,
        "ideal_target_weights": ideal_unclamped,
        "confidence_tiers": tiers,
        "by_league": by_league,
    }

    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"Logged {new_count} new games. Rolling {overall_n} games: {report['overall_record']} ({report['overall_win_rate']}%)")
    print(f"Active weights: {active_weights} (Retuned: {retuned})")


if __name__ == "__main__":
    main()
