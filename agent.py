import json
import os
import re
import urllib.request
from datetime import datetime, timedelta, timezone

LEAGUES = [
    ("NBA", "basketball/nba"),
    ("NFL", "football/nfl"),
    ("NHL", "hockey/nhl"),
    ("MLB", "baseball/mlb"),
    ("NCAAF", "football/college-football"),
    ("NCAAB", "basketball/mens-college-basketball"),
    ("NCAAW", "basketball/womens-college-basketball"),
    ("WNBA", "basketball/wnba"),
    ("UFC", "mma/ufc"),
    ("EPL", "soccer/eng.1"),
    ("MLS", "soccer/usa.1"),
    ("UCL", "soccer/uefa.champions"),
]

FIGHT_LEAGUES = {"UFC", "BOXING", "BKFC"}
HISTORY_FILE = "history.json"
REPORT_FILE = "agent_report.json"
FIGHTERS_FILE = "fighters.json"
DEFAULT_WEIGHTS = {"gem": 42, "h2h": 21, "ros": 37}


def fetch_json(url, timeout=12):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "AlignIQ-Agent/2.3"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


def load_json(path, default):
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return default


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# --- ODDS, FORM, FIGHT IQ & WEIGHT-CUT HELPERS ---
def american_to_implied(odds):
    if not odds:
        return 0.5
    return (100.0 / (odds + 100.0)) if odds > 0 else (abs(odds) / (abs(odds) + 100.0))


def parse_float_num(val):
    m = re.search(r"(\d+(?:\.\d+)?)", str(val or ""))
    return float(m.group(1)) if m else None


def norm_fighter_key(name):
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def compute_fight_edge(home_name, away_name, fighters_db):
    f_h = fighters_db.get(norm_fighter_key(home_name))
    f_a = fighters_db.get(norm_fighter_key(away_name))
    if not f_h or not f_a:
        return 0
    def_diff = ((f_h.get("str_def") or 55) - (f_a.get("str_def") or 55)) * 0.6
    sapm_diff = ((f_a.get("sapm") or 3.2) - (f_h.get("sapm") or 3.2)) * 4.0
    r_h = parse_float_num(f_h.get("reach"))
    r_a = parse_float_num(f_a.get("reach"))
    reach_diff = max(-6.0, min(6.0, (r_h - r_a) * 1.2)) if (r_h and r_a) else 0.0
    return max(-22, min(22, round(def_diff + sapm_diff + reach_diff)))


def compute_weight_cut_penalty(fighter_name, fighters_db):
    f_obj = fighters_db.get(norm_fighter_key(fighter_name))
    wc = (f_obj or {}).get("weight_cut") or {}
    min_l = wc.get("min_lbs")
    max_l = wc.get("max_lbs")
    cur_l = wc.get("current_lbs")
    if not min_l or not max_l or not cur_l:
        return 0
    span = max(0.0, float(max_l) - float(min_l))
    cut_ratio = max(0.0, min(1.0, (float(max_l) - float(cur_l)) / span)) if span > 0 else 0.25
    missed = int(wc.get("missed_count") or 0)
    return min(16, round(cut_ratio * 10) + missed * 5)


def get_team_form(lg_path, team_id, before_date_str, schedule_cache):
    if not lg_path or not team_id:
        return None
    cache_key = f"{lg_path}_{team_id}"
    if cache_key not in schedule_cache:
        data = fetch_json(f"https://site.api.espn.com/apis/site/v2/sports/{lg_path}/teams/{team_id}/schedule")
        parsed = []
        if data:
            for ev in data.get("events") or []:
                comp = (ev.get("competitions") or [None])[0]
                if not comp or not comp.get("status", {}).get("type", {}).get("completed"):
                    continue
                ev_date = (ev.get("date") or "")[:10]
                comps = comp.get("competitors") or []
                me = next((c for c in comps if str(c.get("id")) == str(team_id)), None)
                opp = next((c for c in comps if str(c.get("id")) != str(team_id)), None)
                if not me or not opp:
                    continue
                try:
                    my_s = float(me.get("score", {}).get("value") if isinstance(me.get("score"), dict) else me.get("score", 0))
                    opp_s = float(opp.get("score", {}).get("value") if isinstance(opp.get("score"), dict) else opp.get("score", 0))
                except Exception:
                    continue
                parsed.append({
                    "date": ev_date,
                    "won": bool(me.get("winner")) or (my_s > opp_s),
                    "margin": my_s - opp_s,
                })
        schedule_cache[cache_key] = parsed

    prior = [g for g in schedule_cache[cache_key] if g["date"] and g["date"] < before_date_str]
    if not prior:
        return None
    l10 = prior[-10:]
    l5 = prior[-5:]
    l10_pct = sum(1 for g in l10 if g["won"]) / len(l10)
    l5_pct = sum(1 for g in l5 if g["won"]) / len(l5)
    avg_margin = sum(g["margin"] for g in l5) / len(l5)
    return {"pct": l5_pct * 0.6 + l10_pct * 0.4, "avg_margin": avg_margin}


# --- GEMATRIA & SCORING ENGINE ---
def reduce_digit(n):
    while n > 9:
        n = sum(int(d) for d in str(n))
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


def get_date_nums(d):
    m, day, y = d.month, d.day, d.year
    y_top, y_bot = y // 100, y % 100
    full = m + day + y_top + y_bot
    short = m + day + y_bot
    digits = sum(int(c) for c in f"{m}{day}{y}")
    mixed = m + day + sum(int(c) for c in str(y))
    doy = d.timetuple().tm_yday
    is_leap = (y % 4 == 0 and y % 100 != 0) or (y % 400 == 0)
    left = (366 if is_leap else 365) - doy
    return {full, short, digits, mixed, doy, left}


def parse_record(rec_str):
    m = re.search(r"(\d+)\s*-\s*(\d+)", str(rec_str or ""))
    return (int(m.group(1)), int(m.group(2))) if m else None


def record_targets(w, l):
    t = set()
    concat = int(f"{w}{l}")
    no_zero = int(f"{w}{l}".replace("0", "") or 0)
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
    tiers = [0, 0, 42, 62, 76, 88, 95, 100]
    return tiers[min(hits, len(tiers) - 1)]


def score_game_pillars(ev, league_key, lg_path, date_nums, fighters_db, schedule_cache):
    comp = (ev.get("competitions") or [None])[0]
    if not comp or len(comp.get("competitors") or []) < 2:
        return None
    if not comp.get("status", {}).get("type", {}).get("completed"):
        return None

    home = next((c for c in comp["competitors"] if c.get("homeAway") == "home"), comp["competitors"][0])
    away = next((c for c in comp["competitors"] if c.get("homeAway") == "away"), comp["competitors"][1])

    try:
        hs = int(float(home.get("score", 0)))
        as_ = int(float(away.get("score", 0)))
    except Exception:
        return None
    if hs == as_:
        return None

    actual_winner = "home" if hs > as_ else "away"
    ev_date = (ev.get("date") or "")[:10]

    def team_info(c):
        t = c.get("team") or {}
        a = c.get("athlete") or {}
        recs = c.get("records") or []
        tot = next((r.get("summary") for r in recs if r.get("type") == "total"), recs[0].get("summary") if recs else "")
        home_r = next((r.get("summary") for r in recs if r.get("type") == "home"), "")
        road_r = next((r.get("summary") for r in recs if r.get("type") == "road"), "")
        return {
            "id": str(t.get("id") or c.get("id") or ""),
            "name": t.get("displayName") or a.get("displayName") or "",
            "short": t.get("shortDisplayName") or a.get("shortName") or t.get("name") or "",
            "loc": t.get("location") or "",
            "mascot": t.get("name") or a.get("displayName") or "",
            "rec": parse_record(tot),
            "home_rec": parse_record(home_r),
            "road_rec": parse_record(road_r),
        }

    hi, ai = team_info(home), team_info(away)
    venue = (comp.get("venue") or {}).get("fullName") or ""
    entities = [x for x in {hi["name"], hi["loc"], hi["mascot"], ai["name"], ai["loc"], ai["mascot"], venue} if x]

    h_rec = hi["rec"]
    a_rec = ai["rec"]
    if h_rec:
        h_rec = (max(0, h_rec[0] - (1 if actual_winner == "home" else 0)), max(0, h_rec[1] - (1 if actual_winner == "away" else 0)))
    if a_rec:
        a_rec = (max(0, a_rec[0] - (1 if actual_winner == "away" else 0)), max(0, a_rec[1] - (1 if actual_winner == "home" else 0)))

    hw_t = record_targets(h_rec[0] + 1, h_rec[1]) if h_rec else set()
    hl_t = record_targets(h_rec[0], h_rec[1] + 1) if h_rec else set()
    aw_t = record_targets(a_rec[0] + 1, a_rec[1]) if a_rec else set()
    al_t = record_targets(a_rec[0], a_rec[1] + 1) if a_rec else set()

    def count_hits(win_t, opp_loss_t, short_nm):
        hits = 0
        for ent in entities:
            for val in calc_ciphers(ent):
                if val > 0 and (val in win_t or val in opp_loss_t):
                    hits += 1
        for val in calc_ciphers(short_nm):
            if val in date_nums:
                hits += 1
        return hits

    home_gem = progressive_score(count_hits(hw_t, al_t, hi["short"]))
    away_gem = progressive_score(count_hits(aw_t, hl_t, ai["short"]))

    # Scaled No-Vig Fair Odds
    odds = (comp.get("odds") or [{}])[0]
    h_ml = (odds.get("homeTeamOdds") or {}).get("moneyLine")
    a_ml = (odds.get("awayTeamOdds") or {}).get("moneyLine")
    fair_home_prob = 0.5
    if isinstance(h_ml, (int, float)) and isinstance(a_ml, (int, float)):
        ih, ia = american_to_implied(h_ml), american_to_implied(a_ml)
        if ih + ia > 0:
            fair_home_prob = ih / (ih + ia)
    elif (odds.get("homeTeamOdds") or {}).get("favorite"):
        fair_home_prob = 0.58
    elif (odds.get("awayTeamOdds") or {}).get("favorite"):
        fair_home_prob = 0.42
    fair_away_prob = 1.0 - fair_home_prob

    h_pct = (h_rec[0] / (h_rec[0] + h_rec[1])) if (h_rec and (h_rec[0] + h_rec[1]) > 0) else 0.5
    a_pct = (a_rec[0] / (a_rec[0] + a_rec[1])) if (a_rec and (a_rec[0] + a_rec[1]) > 0) else 0.5

    h_sp = hi["home_rec"]
    a_sp = ai["road_rec"]
    h_sp_pct = (h_sp[0] / (h_sp[0] + h_sp[1])) if (h_sp and (h_sp[0] + h_sp[1]) > 0) else h_pct
    a_sp_pct = (a_sp[0] / (a_sp[0] + a_sp[1])) if (a_sp and (a_sp[0] + a_sp[1]) > 0) else a_pct

    is_fight = league_key in FIGHT_LEAGUES
    split_home = min(95, max(15, 50 + (h_sp_pct - a_sp_pct) * 45))
    split_away = min(95, max(15, 50 + (a_sp_pct - h_sp_pct) * 45))
    odds_home = min(95, max(12, round(fair_home_prob * 100)))
    odds_away = min(95, max(12, round(fair_away_prob * 100)))

    home_h2h = odds_home if is_fight else min(95, max(12, round(odds_home * 0.60 + split_home * 0.40)))
    away_h2h = odds_away if is_fight else min(95, max(12, round(odds_away * 0.60 + split_away * 0.40)))

    # L5 / L10 Recent Form
    home_form = None if is_fight else get_team_form(lg_path, hi["id"], ev_date, schedule_cache)
    away_form = None if is_fight else get_team_form(lg_path, ai["id"], ev_date, schedule_cache)
    blended_h = (h_pct * 0.50 + home_form["pct"] * 0.50) if home_form else h_pct
    blended_a = (a_pct * 0.50 + away_form["pct"] * 0.50) if away_form else a_pct
    margin_boost = max(-8, min(8, round((home_form["avg_margin"] - away_form["avg_margin"]) * 0.5))) if (home_form and away_form) else 0

    # UFC Fight IQ Edge + Auto-Gauged Weight Cut Penalty
    fight_edge = compute_fight_edge(hi["name"], ai["name"], fighters_db) if is_fight else 0
    home_cut_pen = compute_weight_cut_penalty(hi["name"], fighters_db) if is_fight else 0
    away_cut_pen = compute_weight_cut_penalty(ai["name"], fighters_db) if is_fight else 0

    home_ros = min(95, max(12, round(56 + (blended_h - blended_a) * 32 + margin_boost + fight_edge - home_cut_pen + away_cut_pen)))
    away_ros = min(95, max(12, round(52 + (blended_a - blended_h) * 32 - margin_boost - fight_edge - away_cut_pen + home_cut_pen)))

    return {
        "id": str(ev.get("id")),
        "league": league_key,
        "date": ev_date,
        "actual_winner": actual_winner,
        "home": {"gem": home_gem, "h2h": home_h2h, "ros": home_ros},
        "away": {"gem": away_gem, "h2h": away_h2h, "ros": away_ros},
    }


def eval_weights(games, w):
    wins = 0
    total = 0
    for g in games:
        if not isinstance(g.get("home"), dict) or not isinstance(g.get("away"), dict):
            continue
        total += 1
        hs = g["home"].get("gem", 0) * w["gem"] + g["home"].get("h2h", 0) * w["h2h"] + g["home"].get("ros", 0) * w["ros"]
        as_ = g["away"].get("gem", 0) * w["gem"] + g["away"].get("h2h", 0) * w["h2h"] + g["away"].get("ros", 0) * w["ros"]
        pick = "home" if hs >= as_ else "away"
        if pick == g.get("actual_winner"):
            wins += 1
    return wins, total


def optimize_weights(games, current_w, max_step=10):
    if len(games) < 15:
        return current_w, None
    best_w = dict(current_w)
    best_wins, _ = eval_weights(games, current_w)

    for gem in range(10, 71, 5):
        for h2h in range(10, 71, 5):
            ros = 100 - gem - h2h
            if ros < 10 or ros > 70:
                continue
            cand = {"gem": gem, "h2h": h2h, "ros": ros}
            w_cnt, _ = eval_weights(games, cand)
            if w_cnt > best_wins:
                best_wins = w_cnt
                best_w = cand

    stepped = {}
    for k in ("gem", "h2h", "ros"):
        diff = best_w[k] - current_w[k]
        stepped[k] = current_w[k] + max(-max_step, min(max_step, diff))
    s = sum(stepped.values())
    if s != 100:
        stepped["ros"] += 100 - s
    return stepped, best_w


# --- UFC FIGHTER STRIKING, WEIGHT-CUT HISTORY & SOURCE SYNC ---
WEIGHT_CLASS_LBS = {
    "strawweight": 115,
    "flyweight": 125,
    "bantamweight": 135,
    "featherweight": 145,
    "lightweight": 155,
    "welterweight": 170,
    "middleweight": 185,
    "light heavyweight": 205,
    "heavyweight": 265,
}


def extract_weight_lbs_from_text(text):
    t = (text or "").lower()
    for wc_name, lbs in WEIGHT_CLASS_LBS.items():
        if wc_name in t:
            return float(lbs)
    m = re.search(r"(\d{3}(?:\.\d+)?)\s*(?:lbs?|pounds?)", t)
    if m:
        val = float(m.group(1))
        if 105 <= val <= 285:
            return val
    return None


def sync_ufc_fighters():
    fighters = load_json(FIGHTERS_FILE, {})
    today = datetime.now(timezone.utc).date()
    athlete_ids = {}

    for offset in range(-3, 15):
        d_str = (today + timedelta(days=offset)).strftime("%Y%m%d")
        data = fetch_json(f"https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates={d_str}")
        if not data:
            continue
        for ev in data.get("events") or []:
            for comp in ev.get("competitions") or []:
                bout_wc = (comp.get("type") or {}).get("text") or ""
                for c in comp.get("competitors") or []:
                    ath = c.get("athlete") or {}
                    aid = str(ath.get("id") or c.get("id") or "")
                    name = ath.get("displayName") or ath.get("fullName") or ""
                    if aid and name:
                        athlete_ids[aid] = {"name": name, "bout_wc": bout_wc}

    for aid, meta in athlete_ids.items():
        name = meta["name"]
        fkey = norm_fighter_key(name)
        prev = fighters.get(fkey) or {}
        profile = fetch_json(f"https://site.web.api.espn.com/apis/common/v3/sports/mma/athletes/{aid}")
        stats_data = fetch_json(f"https://site.web.api.espn.com/apis/common/v3/sports/mma/athletes/{aid}/stats")
        gamelog = fetch_json(f"https://site.web.api.espn.com/apis/common/v3/sports/mma/athletes/{aid}/gamelog")

        ath_obj = (profile or {}).get("athlete") or {}
        stance = (ath_obj.get("stance") or {}).get("text") or prev.get("stance") or "Orthodox"
        reach = ath_obj.get("displayReach") or prev.get("reach") or "—"

        espn_profile_url = f"https://www.espn.com/mma/fighter/_/id/{aid}"
        espn_stats_url = f"https://www.espn.com/mma/fighter/stats/_/id/{aid}"
        for lnk in ath_obj.get("links") or []:
            href = lnk.get("href") or ""
            if "espn.com/mma/fighter" in href and "/stats/" not in href:
                espn_profile_url = href
                break

        stat_map = {}
        for cat in (stats_data or {}).get("categories") or []:
            for k, v in zip(cat.get("names") or [], cat.get("totals") or []):
                stat_map[k.lower()] = v

        def to_float(val, default):
            try:
                return float(str(val).replace("%", "").strip())
            except Exception:
                return default

        str_def = round(to_float(stat_map.get("sigstrdef") or stat_map.get("strdef"), prev.get("str_def", 55)))
        sapm = round(to_float(stat_map.get("sigstrabsorbedpermin") or stat_map.get("sapm"), prev.get("sapm", 3.2)), 2)

        head_p = round(to_float(stat_map.get("sigstrheadpct") or stat_map.get("headpct"), prev.get("head_pct", 64)))
        body_p = round(to_float(stat_map.get("sigstrbodypct") or stat_map.get("bodypct"), prev.get("body_pct", 20)))
        leg_p = round(to_float(stat_map.get("sigstrlegpct") or stat_map.get("legpct"), prev.get("leg_pct", 16)))
        total_p = head_p + body_p + leg_p
        if total_p > 0 and total_p != 100:
            head_p = round((head_p / total_p) * 100)
            body_p = round((body_p / total_p) * 100)
            leg_p = max(0, 100 - head_p - body_p)

        observed_weights = []
        missed_count = int((prev.get("weight_cut") or {}).get("missed_count") or 0)

        listed_w = parse_float_num(ath_obj.get("weight") or ath_obj.get("displayWeight"))
        if listed_w and 105 <= listed_w <= 285:
            observed_weights.append(listed_w)

        bout_w = extract_weight_lbs_from_text(meta.get("bout_wc") or (ath_obj.get("weightClass") or {}).get("text"))
        if bout_w:
            observed_weights.append(bout_w)

        prev_wc = prev.get("weight_cut") or {}
        for k in ("min_lbs", "max_lbs", "current_lbs"):
            if prev_wc.get(k):
                observed_weights.append(float(prev_wc[k]))

        for _, ev_obj in ((gamelog or {}).get("events") or {}).items():
            txt = json.dumps(ev_obj)
            w_found = extract_weight_lbs_from_text(txt)
            if w_found:
                observed_weights.append(w_found)
            if "catchweight" in txt.lower() or "missed weight" in txt.lower():
                missed_count = max(missed_count, 1)

        current_lbs = bout_w or listed_w or prev_wc.get("current_lbs")
        if current_lbs:
            observed_weights.append(current_lbs)

        weight_cut = None
        if observed_weights and current_lbs:
            min_lbs = round(min(observed_weights), 1)
            max_lbs = round(max(observed_weights), 1)
            if max_lbs - min_lbs < 2.0 and current_lbs < 240:
                max_lbs = round(current_lbs + 15.0, 1)
            weight_cut = {
                "min_lbs": min_lbs,
                "max_lbs": max_lbs,
                "current_lbs": round(current_lbs, 1),
                "missed_count": missed_count,
                "source_url": espn_profile_url,
            }

        fighters[fkey] = {
            "name": name,
            "stance": stance,
            "reach": reach,
            "str_def": str_def,
            "sapm": sapm,
            "head_pct": head_p,
            "body_pct": body_p,
            "leg_pct": leg_p,
            "weight_cut": weight_cut,
            "sources": [espn_profile_url, espn_stats_url],
            "updated": today.isoformat(),
        }

    save_json(FIGHTERS_FILE, fighters)
    print(f"Synced {len(athlete_ids)} active UFC fighters ({len(fighters)} total in {FIGHTERS_FILE}).")
    return fighters


def main():
    now = datetime.now(timezone.utc)
    today = now.date()

    fighters_db = sync_ufc_fighters()

    history = load_json(HISTORY_FILE, [])
    history = [
        g for g in history
        if isinstance(g, dict) and isinstance(g.get("home"), dict) and isinstance(g.get("away"), dict)
    ]
    report = load_json(REPORT_FILE, {})
    existing_ids = {g["id"] for g in history}
    schedule_cache = {}

    new_games = []
    for offset in range(1, 4):
        d = today - timedelta(days=offset)
        d_str = d.strftime("%Y%m%d")
        d_nums = get_date_nums(d)
        for lg_key, lg_path in LEAGUES:
            data = fetch_json(f"https://site.api.espn.com/apis/site/v2/sports/{lg_path}/scoreboard?dates={d_str}")
            if not data:
                continue
            for ev in data.get("events") or []:
                gid = str(ev.get("id"))
                if gid in existing_ids:
                    continue
                scored = score_game_pillars(ev, lg_key, lg_path, d_nums, fighters_db, schedule_cache)
                if scored:
                    new_games.append(scored)
                    existing_ids.add(gid)

    history.extend(new_games)
    cutoff = (today - timedelta(days=60)).isoformat()
    history = [g for g in history if g.get("date", "") >= cutoff]
    save_json(HISTORY_FILE, history)

    active_w = report.get("active_weights") or dict(DEFAULT_WEIGHTS)
    league_w = report.get("league_weights") or {}
    is_monday = today.weekday() == 0
    reason = report.get("adjustment_reason") or "Monitoring 60-day rolling window. Next auto-retune runs Monday."

    if is_monday or not league_w:
        new_global, _ = optimize_weights(history, active_w, max_step=10)
        if new_global != active_w:
            reason = f"Retuned global weights from {active_w['gem']}/{active_w['h2h']}/{active_w['ros']} to {new_global['gem']}/{new_global['h2h']}/{new_global['ros']} (capped at ±10%) to maximize 60-day win rate."
        else:
            reason = f"Global weights ({active_w['gem']}/{active_w['h2h']}/{active_w['ros']}) held steady as highest-converting split."
        active_w = new_global

        by_league = {}
        for g in history:
            by_league.setdefault(g["league"], []).append(g)
        for lg_key, lg_games in by_league.items():
            if len(lg_games) >= 30:
                cur_lw = league_w.get(lg_key) or dict(active_w)
                opt_lw, _ = optimize_weights(lg_games, cur_lw, max_step=10)
                league_w[lg_key] = opt_lw

    wins, total = eval_weights(history, active_w)
    win_rate = round((wins / total) * 100, 1) if total else 0.0

    new_report = {
        "last_updated": today.isoformat(),
        "total_games_graded": total,
        "overall_record": f"{wins}-{total - wins}",
        "overall_win_rate": win_rate,
        "active_weights": active_w,
        "league_weights": league_w,
        "adjustment_reason": reason,
    }
    save_json(REPORT_FILE, new_report)
    print(f"Agent complete: {new_report['overall_record']} ({win_rate}%) across {total} games.")


if __name__ == "__main__":
    main()
