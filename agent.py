import json
import os
import re
import urllib.request
from datetime import datetime, timezone, timedelta
from collections import defaultdict

HISTORY_FILE = "history.json"
REPORT_FILE = "agent_report.json"
CONFIG_FILE = "algo_config.json"
ANALYSIS_FILE = "analysis_report.json"

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
        req = urllib.request.Request(url, headers={"User-Agent": "AlignIQ-Agent/5.2"})
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


def american_to_implied(ml):
    try:
        v = float(ml)
        if v == 0:
            return None
        return (100.0 / (v + 100.0)) if v > 0 else (abs(v) / (abs(v) + 100.0))
    except Exception:
        return None


# --- 4-CIPHER GEMATRIA ENGINE (EXACT MATCH TO app.js) ---
def reduce_digit(n):
    while n > 9:
        n = sum(int(c) for c in str(n))
    return n


def calc_ciphers(text):
    clean = re.sub(r"[^A-Z]", "", str(text or "").upper())
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
    m, day, y = dt.month, dt.day, dt.year
    y_top, y_bot = y // 100, y % 100
    full = m + day + y_top + y_bot
    short = m + day + y_bot
    digits = sum(int(c) for c in f"{m}{day}{y}")
    mixed = m + day + sum(int(c) for c in str(y))
    doy = dt.timetuple().tm_yday
    is_leap = (y % 4 == 0 and y % 100 != 0) or (y % 400 == 0)
    left = (366 if is_leap else 365) - doy
    return [full, short, digits, mixed, doy, left]


def parse_record(s):
    m = re.search(r"(\d+)\s*-\s*(\d+)", str(s or ""))
    return (int(m.group(1)), int(m.group(2))) if m else None


def build_record_targets(w, l):
    t = set()
    c = int(f"{w}{l}")
    nz_str = f"{w}{l}".replace("0", "") or "0"
    nz = int(nz_str)
    if c > 0:
        t.add(c)
    if nz > 0 and nz != c:
        t.add(nz)
    if w > 0:
        t.add(w)
    if l > 0:
        t.add(l)
    return t


def progressive_gem_score(hits):
    tiers = [0, 0, 42, 62, 76, 88, 95, 100]
    return 0 if hits < 2 else tiers[min(hits, len(tiers) - 1)]


def compute_gematria_scores(entities, away_short, home_short, away_rec, home_rec, date_nums):
    def count_hits(win_t, opp_loss_t, short_nm):
        hits = 0
        for text in entities:
            for val in calc_ciphers(text):
                if val > 0 and (val in win_t or val in opp_loss_t):
                    hits += 1
        if short_nm:
            for val in calc_ciphers(short_nm):
                if val in date_nums:
                    hits += 1
        return hits

    a_win = build_record_targets(away_rec[0] + 1, away_rec[1]) if away_rec else set()
    h_loss = build_record_targets(home_rec[0], home_rec[1] + 1) if home_rec else set()
    h_win = build_record_targets(home_rec[0] + 1, home_rec[1]) if home_rec else set()
    a_loss = build_record_targets(away_rec[0], away_rec[1] + 1) if away_rec else set()

    a_hits = count_hits(a_win, h_loss, away_short)
    h_hits = count_hits(h_win, a_loss, home_short)
    return progressive_gem_score(h_hits), progressive_gem_score(a_hits), h_hits, a_hits


def load_active_config():
    cfg = load_json(CONFIG_FILE, {})
    if not isinstance(cfg, dict) or not cfg.get("weights"):
        cfg = {
            "version": "phase5-baseline",
            "weights": dict(DEFAULT_WEIGHTS),
            "league_weights": {k: dict(v) for k, v in LEAGUE_DEFAULT_WEIGHTS.items()},
            "active_features": {},
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


def is_dummy_postgame_row(g):
    """Detects post-game fallback rows created without real pre-game odds/Gematria."""
    if not isinstance(g, dict):
        return True
    if g.get("data_quality") == "postgame_fallback":
        return True
    h, a = as_dict(g.get("home")), as_dict(g.get("away"))
    return (
        safe_float(h.get("gem"), 0) == 0
        and safe_float(a.get("gem"), 0) == 0
        and safe_float(h.get("h2h"), 50) in (45.0, 50.0, 55.0)
        and safe_float(a.get("h2h"), 50) in (45.0, 50.0, 55.0)
        and safe_float(h.get("ros"), 50) == 52.0
        and safe_float(a.get("ros"), 50) == 48.0
    )


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
        "pick": pick,
        "confidence": conf,
        "home_score": h_score,
        "away_score": a_score,
        "is_underdog": bool(market_dog and pick == market_dog),
        "dog_gate_triggered": dog_gate,
        "factor_deltas": {
            "gem": round((h_gem - a_gem) if pick == "home" else (a_gem - h_gem), 1),
            "h2h": round((h_h2h - a_h2h) if pick == "home" else (a_h2h - h_h2h), 1),
            "ros": round((h_ros - a_ros) if pick == "home" else (a_ros - h_ros), 1),
        },
        "pillar_leans": {
            "gem": "home" if h_gem > a_gem else ("away" if a_gem > h_gem else None),
            "h2h": "home" if h_h2h > a_h2h else ("away" if a_h2h > h_h2h else None),
            "ros": "home" if h_ros > a_ros else ("away" if a_ros > h_ros else None),
        },
    }


def extract_pregame_features(ev, comp, home_c, away_c, lg, dt):
    h_team, a_team = as_dict(home_c.get("team")), as_dict(away_c.get("team"))
    h_name = h_team.get("displayName") or as_dict(home_c.get("athlete")).get("displayName") or "Home"
    a_name = a_team.get("displayName") or as_dict(away_c.get("athlete")).get("displayName") or "Away"
    h_short = h_team.get("shortDisplayName") or h_team.get("name") or h_name
    a_short = a_team.get("shortDisplayName") or a_team.get("name") or a_name

    def get_rec(c, rtype):
        for r in (c.get("records") or []):
            if isinstance(r, dict) and r.get("type") == rtype:
                return r.get("summary", "")
        return (c.get("records") or [{}])[0].get("summary", "") if c.get("records") else ""

    h_rec_str, a_rec_str = get_rec(home_c, "total"), get_rec(away_c, "total")
    h_home_str, a_road_str = get_rec(home_c, "home"), get_rec(away_c, "road")
    h_rec, a_rec = parse_record(h_rec_str), parse_record(a_rec_str)
    h_sp, a_sp = parse_record(h_home_str), parse_record(a_road_str)

    h_pct = h_rec[0] / (h_rec[0] + h_rec[1]) if (h_rec and sum(h_rec) > 0) else 0.5
    a_pct = a_rec[0] / (a_rec[0] + a_rec[1]) if (a_rec and sum(a_rec) > 0) else 0.5
    h_sp_pct = h_sp[0] / (h_sp[0] + h_sp[1]) if (h_sp and sum(h_sp) > 0) else h_pct
    a_sp_pct = a_sp[0] / (a_sp[0] + a_sp[1]) if (a_sp and sum(a_sp) > 0) else a_pct

    odds_obj = first_dict(comp.get("odds"))
    h_odds, a_odds = as_dict(odds_obj.get("homeTeamOdds")), as_dict(odds_obj.get("awayTeamOdds"))
    h_ml, a_ml = h_odds.get("moneyLine"), a_odds.get("moneyLine")
    fair_home = 0.5
    has_real_odds = False
    if h_ml is not None and a_ml is not None:
        ih, ia = american_to_implied(h_ml), american_to_implied(a_ml)
        if ih and ia and (ih + ia) > 0:
            fair_home = ih / (ih + ia)
            has_real_odds = True
    elif h_odds.get("favorite"):
        fair_home, has_real_odds = 0.58, True
    elif a_odds.get("favorite"):
        fair_home, has_real_odds = 0.42, True

    odds_h = clamp(round(fair_home * 100), 12, 95)
    odds_a = clamp(round((1 - fair_home) * 100), 12, 95)
    if lg == "UFC":
        h2h_h, h2h_a = odds_h, odds_a
    else:
        h2h_h = round(clamp(odds_h * 0.60 + clamp(50 + (h_sp_pct - a_sp_pct) * 45, 15, 95) * 0.40, 12, 95))
        h2h_a = round(clamp(odds_a * 0.60 + clamp(50 + (a_sp_pct - h_sp_pct) * 45, 15, 95) * 0.40, 12, 95))

    ros_h = round(clamp(56 + (h_sp_pct - a_sp_pct) * 32, 12, 95))
    ros_a = round(clamp(52 + (a_sp_pct - h_sp_pct) * 32, 12, 95))

    venue = as_dict(comp.get("venue"))
    addr = as_dict(venue.get("address"))
    bcast = first_dict(comp.get("broadcasts")).get("names") or []
    entities = list(dict.fromkeys([
        x.strip() for x in [
            a_name, a_team.get("location", ""), a_team.get("name", ""),
            h_name, h_team.get("location", ""), h_team.get("name", ""),
            venue.get("fullName", ""), f"{addr.get('city', '')}, {addr.get('state', '')}".strip(", "),
            bcast[0] if bcast else "", first_dict(comp.get("notes")).get("headline", ""),
        ] if x and x.strip() and x.strip() != "TBD Venue"
    ]))
    h_gem, a_gem, h_hits, a_hits = compute_gematria_scores(entities, a_short, h_short, a_rec, h_rec, get_date_math(dt))

    return {
        "matchup": f"{a_short} @ {h_short}",
        "home_ml": h_ml,
        "away_ml": a_ml,
        "has_real_odds": has_real_odds,
        "home": {"name": h_short, "gem": h_gem, "gem_hits": h_hits, "h2h": h2h_h, "ros": ros_h},
        "away": {"name": a_short, "gem": a_gem, "gem_hits": a_hits, "h2h": h2h_a, "ros": ros_a},
    }


def sync_espn_history(history, now, cfg):
    """
    1. Locks TODAY'S upcoming ('pre') games with real pre-game odds, splits & 4-cipher Gematria.
    2. Grades COMPLETED ('post') games from the past 3 days WITHOUT overwriting frozen pre-game predictions.
    """
    dates = history.setdefault("dates", {})

    for offset in (3, 2, 1, 0):
        dt = now - timedelta(days=offset)
        d_str, ymd = dt.strftime("%Y-%m-%d"), dt.strftime("%Y%m%d")
        entry = dates.setdefault(d_str, {
            "algo_version": cfg["version"],
            "weights_used": dict(cfg["weights"]),
            "games": [],
        })
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
                state = as_dict(as_dict(comp.get("status")).get("type")).get("state")
                comps = [c for c in (comp.get("competitors") or []) if isinstance(c, dict)]
                if len(comps) < 2:
                    continue
                home_c = next((c for c in comps if c.get("homeAway") == "home"), comps[0])
                away_c = next((c for c in comps if c.get("homeAway") == "away"), comps[1])
                ev_id = str(ev.get("id") or "")
                if not ev_id:
                    continue

                if state == "pre" and ev_id not in existing:
                    feats = extract_pregame_features(ev, comp, home_c, away_c, lg, dt)
                    w_game = get_league_weights(lg, cfg)
                    scored = score_matchup(feats["home"], feats["away"], w_game)
                    new_g = {
                        "id": ev_id,
                        "league": lg,
                        "matchup": feats["matchup"],
                        "home_ml": feats["home_ml"],
                        "away_ml": feats["away_ml"],
                        "home": feats["home"],
                        "away": feats["away"],
                        "weights_used": dict(w_game),
                        "original_weights": dict(w_game),
                        "original_pick": scored["pick"],
                        "original_confidence": scored["confidence"],
                        "original_is_underdog": scored["is_underdog"],
                        "pick": scored["pick"],
                        "confidence": scored["confidence"],
                        "algo_version_at_pick": cfg["version"],
                        "data_quality": "pregame_locked",
                        "locked_at": now.isoformat(),
                    }
                    entry["games"].append(new_g)
                    existing[ev_id] = new_g
                    continue

                if state == "post":
                    hs, as_ = int(safe_float(home_c.get("score"), 0)), int(safe_float(away_c.get("score"), 0))
                    if hs == as_:
                        continue
                    actual = "home" if hs > as_ else "away"

                    if ev_id in existing:
                        g = existing[ev_id]
                        g["final_score"] = f"{as_}-{hs}"
                        g["actual_winner"] = actual
                        if not g.get("matchup") or str(g.get("matchup", "")).startswith("Game #"):
                            h_short = as_dict(home_c.get("team")).get("shortDisplayName") or "Home"
                            a_short = as_dict(away_c.get("team")).get("shortDisplayName") or "Away"
                            g["matchup"] = f"{a_short} @ {h_short}"
                    else:
                        feats = extract_pregame_features(ev, comp, home_c, away_c, lg, dt)
                        w_game = get_league_weights(lg, cfg)
                        scored = score_matchup(feats["home"], feats["away"], w_game)
                        new_g = {
                            "id": ev_id,
                            "league": lg,
                            "matchup": feats["matchup"],
                            "final_score": f"{as_}-{hs}",
                            "actual_winner": actual,
                            "home_ml": feats["home_ml"],
                            "away_ml": feats["away_ml"],
                            "home": feats["home"],
                            "away": feats["away"],
                            "weights_used": dict(w_game),
                            "original_weights": dict(w_game),
                            "original_pick": scored["pick"],
                            "original_confidence": scored["confidence"],
                            "original_is_underdog": scored["is_underdog"],
                            "pick": scored["pick"],
                            "confidence": scored["confidence"],
                            "algo_version_at_pick": cfg["version"],
                            "data_quality": "postgame_fallback",
                        }
                        entry["games"].append(new_g)
                        existing[ev_id] = new_g
    return history


def run_historical_analysis(history, cfg, now):
    """Agent 1: Grades verified games with frozen original weights and quarantines post-game fallback rows."""
    cutoff_60 = (now - timedelta(days=60)).strftime("%Y-%m-%d")
    factor_perf = {
        "gem": {"label": "Pattern Signals (Gematria)", "agree_w": 0, "agree_n": 0, "solo_w": 0, "solo_n": 0, "misled_losses": 0},
        "h2h": {"label": "Market Fair Odds", "agree_w": 0, "agree_n": 0, "solo_w": 0, "solo_n": 0, "misled_losses": 0},
        "ros": {"label": "Form, Rest & Health", "agree_w": 0, "agree_n": 0, "solo_w": 0, "solo_n": 0, "misled_losses": 0},
    }
    calibration = defaultdict(lambda: {"w": 0, "n": 0})
    by_league = defaultdict(lambda: {"w": 0, "n": 0, "units": 0.0, "odds_n": 0})
    daily_trend = defaultdict(lambda: {"w": 0, "n": 0})
    underdogs = {"w": 0, "n": 0}
    biggest_hits, biggest_misses = [], []
    newly_processed = 0
    excluded_fallbacks = 0
    pregame_locked_n = 0
    gematria_logged_n = 0
    total_w, total_n, total_units, total_odds_n = 0, 0, 0.0, 0

    for d_str, entry in sorted(history.get("dates", {}).items()):
        if not isinstance(entry, dict) or d_str < cutoff_60:
            continue
        snap_w = entry.get("weights_used")
        for g in entry.get("games", []):
            if not isinstance(g, dict):
                continue
            actual = str(g.get("actual_winner") or "").lower().strip()
            if actual not in ("home", "away"):
                continue

            if is_dummy_postgame_row(g):
                g["data_quality"] = "postgame_fallback"
                excluded_fallbacks += 1
                continue

            if not g.get("data_quality"):
                g["data_quality"] = "verified_legacy"
            if g.get("data_quality") == "pregame_locked":
                pregame_locked_n += 1

            h_obj, a_obj = as_dict(g.get("home")), as_dict(g.get("away"))
            if safe_float(h_obj.get("gem"), 0) > 0 or safe_float(a_obj.get("gem"), 0) > 0:
                gematria_logged_n += 1

            w_used = g.get("original_weights") or g.get("weights_used") or snap_w or get_league_weights(g.get("league"), cfg)
            scored = score_matchup(h_obj, a_obj, w_used)

            if not g.get("original_pick"):
                g["original_pick"] = scored["pick"]
                g["original_confidence"] = scored["confidence"]
                g["original_weights"] = dict(w_used)
                g["original_is_underdog"] = scored["is_underdog"]
            elif not g.get("original_weights"):
                g["original_weights"] = dict(w_used)

            pick = g["original_pick"]
            conf = safe_float(g.get("original_confidence"), scored["confidence"])
            is_dog = bool(g.get("original_is_underdog", scored["is_underdog"]))
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
                        f"Weights at Tip-Off: {w_used.get('gem', 10)}% Sig / {w_used.get('h2h', 60)}% Odds / {w_used.get('ros', 30)}% Form",
                    ],
                    "lesson_learned": (
                        f"{factor_perf[primary_driver]['label']} accurately predicted outcome."
                        if won else
                        f"Model overvalued {factor_perf[primary_driver]['label']} ({deltas[primary_driver]:+.1f}) on a {conf}% pick."
                    ),
                    "processed_at": now.isoformat(),
                }
                g["autopsy_processed"] = True
                newly_processed += 1

            total_n += 1
            total_w += 1 if won else 0
            lg = g.get("league", "OTHER")
            by_league[lg]["n"] += 1
            by_league[lg]["w"] += 1 if won else 0
            daily_trend[d_str]["n"] += 1
            daily_trend[d_str]["w"] += 1 if won else 0

            if is_dog:
                underdogs["n"] += 1
                underdogs["w"] += 1 if won else 0

            dec = american_to_decimal(g.get(f"{pick}_ml"))
            if dec:
                pnl = (dec - 1.0) if won else -1.0
                total_units += pnl
                total_odds_n += 1
                by_league[lg]["units"] += pnl
                by_league[lg]["odds_n"] += 1

            bucket = "70%+" if conf >= 70 else ("60-69%" if conf >= 60 else "50-59%")
            calibration[bucket]["n"] += 1
            calibration[bucket]["w"] += 1 if won else 0

            for fk, delta in scored["factor_deltas"].items():
                if delta > 2.0:
                    factor_perf[fk]["agree_n"] += 1
                    if won:
                        factor_perf[fk]["agree_w"] += 1
                    else:
                        factor_perf[fk]["misled_losses"] += 1
                lean = scored["pillar_leans"].get(fk)
                if lean in ("home", "away"):
                    factor_perf[fk]["solo_n"] += 1
                    if lean == actual:
                        factor_perf[fk]["solo_w"] += 1

            rec = {"date": d_str, "league": lg, "matchup": g.get("matchup", g.get("id")), "pick": pick, "confidence": conf, "score": g.get("final_score", "")}
            (biggest_hits if won else biggest_misses).append(rec)

    overall_wr = round((total_w / total_n) * 100, 1) if total_n else 0.0
    factor_summary = {}
    overvalued, undervalued = [], []
    for fk, fp in factor_perf.items():
        wr = round((fp["agree_w"] / fp["agree_n"]) * 100, 1) if fp["agree_n"] else 0.0
        solo_wr = round((fp["solo_w"] / fp["solo_n"]) * 100, 1) if fp["solo_n"] else 0.0
        lift = round(wr - overall_wr, 1) if fp["agree_n"] else 0.0
        factor_summary[fk] = {**fp, "win_rate": wr, "solo_win_rate": solo_wr, "lift_vs_avg": lift}
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

    dog_stats = {
        "wins": underdogs["w"],
        "losses": underdogs["n"] - underdogs["w"],
        "total": underdogs["n"],
        "w": underdogs["w"],
        "n": underdogs["n"],
        "win_rate": round((underdogs["w"] / underdogs["n"]) * 100, 1) if underdogs["n"] else 0.0,
    }

    analysis = {
        "generated_at": now.isoformat(),
        "agent": "Agent 1: Historical Game Analysis",
        "status": "SUCCESS",
        "newly_analyzed_games": newly_processed,
        "excluded_fallback_games": excluded_fallbacks,
        "pregame_locked_games": pregame_locked_n,
        "gematria_logged_games": gematria_logged_n,
        "total_completed_60d": total_n,
        "wins_60d": total_w,
        "losses_60d": total_n - total_w,
        "win_rate_60d": overall_wr,
        "roi_pct_60d": round((total_units / total_odds_n) * 100, 1) if total_odds_n else None,
        "net_units_60d": round(total_units, 2) if total_odds_n else None,
        "underdogs": dog_stats,
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
        "active_features": cfg.get("active_features", {}),
        "guardrails": {"min_global_games": 500, "min_league_games": 100, "min_odds_for_roi": 50},
        "summary_60d": {
            "wins": analysis["wins_60d"],
            "losses": analysis["losses_60d"],
            "total": analysis["total_completed_60d"],
            "win_rate": analysis["win_rate_60d"],
            "roi_pct": analysis["roi_pct_60d"],
            "net_units": analysis["net_units_60d"],
            "underdogs": analysis["underdogs"],
            "leagues": analysis["leagues"],
            "daily_trend": analysis["daily_trend"],
        },
        "last_rebalance_note": (
            f"Active Config: {cfg['version']} | {analysis['total_completed_60d']} verified games "
            f"({analysis['excluded_fallback_games']} post-game fallbacks quarantined)."
        ),
    }

    save_json(HISTORY_FILE, history)
    save_json(ANALYSIS_FILE, analysis)
    save_json(REPORT_FILE, report)
    print(
        f"Agent 1 complete | Verified 60d: {analysis['win_rate_60d']}% ({analysis['wins_60d']}-{analysis['losses_60d']}) "
        f"| Dogs: {analysis['underdogs']['wins']}-{analysis['underdogs']['losses']} "
        f"| Quarantined fallbacks: {analysis['excluded_fallback_games']}"
    )


if __name__ == "__main__":
    main()