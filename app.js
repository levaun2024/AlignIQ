const LEAGUES = [
  { key: 'NBA', path: 'basketball/nba', espnSlug: 'nba', oddsKey: 'basketball_nba', propMarkets: 'player_points,player_rebounds,player_assists' },
  { key: 'NFL', path: 'football/nfl', espnSlug: 'nfl', oddsKey: 'americanfootball_nfl', propMarkets: 'player_pass_yds,player_rush_yds,player_reception_yds,player_anytime_td' },
  { key: 'NHL', path: 'hockey/nhl', espnSlug: 'nhl', oddsKey: 'icehockey_nhl', propMarkets: 'player_points,player_goals,player_shots_on_goal' },
  { key: 'MLB', path: 'baseball/mlb', espnSlug: 'mlb', oddsKey: 'baseball_mlb', propMarkets: 'batter_hits,batter_total_bases,pitcher_strikeouts' },
  { key: 'NCAAF', path: 'football/college-football', espnSlug: 'college-football', oddsKey: 'americanfootball_ncaaf', propMarkets: 'player_pass_yds,player_rush_yds,player_anytime_td' },
  { key: 'NCAAB', path: 'basketball/mens-college-basketball', espnSlug: 'mens-college-basketball', oddsKey: 'basketball_ncaab', propMarkets: 'player_points,player_rebounds,player_assists' },
  { key: 'NCAAW', path: 'basketball/womens-college-basketball', espnSlug: 'womens-college-basketball', oddsKey: 'basketball_wncaab', propMarkets: '' },
  { key: 'WNBA', path: 'basketball/wnba', espnSlug: 'wnba', oddsKey: 'basketball_wnba', propMarkets: 'player_points,player_rebounds,player_assists' },
  { key: 'UFC', path: 'mma/ufc', espnSlug: 'mma', oddsKey: 'mma_mixed_martial_arts', propMarkets: '' },
  { key: 'EPL', path: 'soccer/eng.1', espnSlug: 'soccer', oddsKey: 'soccer_epl', propMarkets: '' },
  { key: 'MLS', path: 'soccer/usa.1', espnSlug: 'soccer', oddsKey: 'soccer_usa_mls', propMarkets: '' },
  { key: 'UCL', path: 'soccer/uefa.champions', espnSlug: 'soccer', oddsKey: 'soccer_uefa_champs_league', propMarkets: '' }
];

const FIGHT_LEAGUES = new Set(['UFC', 'BOXING', 'BKFC']);
const B2B_LEAGUES = new Set(['NBA', 'NHL']);
const WORKER_BASE_URL = 'https://alighiq-gate.levaun2024.workers.dev';

const SPORTSBOOK_LINKS = {
  draftkings: { name: 'DraftKings', pkg: 'com.draftkings.sportsbook', ios: 'https://apps.apple.com/us/app/draftkings-sports-casino/id1375031369', web: 'https://sportsbook.draftkings.com' },
  fanduel: { name: 'FanDuel', pkg: 'com.fanduel.android.self', ios: 'https://apps.apple.com/us/app/fanduel-sportsbook-casino/id1413721906', web: 'https://sportsbook.fanduel.com' },
  betmgm: { name: 'BetMGM', pkg: 'com.playmgm.nj.sports', ios: 'https://apps.apple.com/us/app/betmgm-sportsbook-casino/id1430875409', web: 'https://sports.betmgm.com' },
  williamhill_us: { name: 'Caesars', pkg: 'com.williamhill.us.nj.sports', ios: 'https://apps.apple.com/us/app/caesars-sportsbook-casino/id1413099571', web: 'https://www.caesars.com/sportsbook-and-casino' },
  espnbet: { name: 'ESPN BET', pkg: 'com.penn.espnbet', ios: 'https://espnbet.com', web: 'https://espnbet.com' },
  fanatics: { name: 'Fanatics', pkg: 'com.betfanatics.sportsbook.android', ios: 'https://apps.apple.com/us/app/fanatics-sports-casino/id1616738407', web: 'https://sportsbook.fanatics.com' },
  betrivers: { name: 'BetRivers', pkg: 'com.rushstreetinteractive.betrivers', ios: 'https://apps.apple.com/us/app/betrivers-casino-sportsbook/id1635357259', web: 'https://www.betrivers.com' },
  hardrockbet: { name: 'Hard Rock Bet', pkg: 'com.hardrock.sportsbook', ios: 'https://apps.apple.com/us/app/hard-rock-bet-sportsbook/id1572525917', web: 'https://www.hardrock.bet' },
  kalshi: { name: 'Kalshi', pkg: 'com.kalshi.mobile', ios: 'https://apps.apple.com/us/app/kalshi-trade-events-sports/id1632713844', web: 'https://kalshi.com/markets/sports' },
  novig: { name: 'Novig', pkg: 'us.novig.app', ios: 'https://apps.apple.com/us/app/novig-prediction-market/id6443958997', web: 'https://www.novig.us' },
  prophetx: { name: 'ProphetX', pkg: 'com.prophetxsweepstake', ios: 'https://apps.apple.com/us/app/prophetx-prediction-market/id6504584166', web: 'https://www.prophetx.co' },
  fliff: { name: 'Fliff', pkg: 'com.fliff.sports', ios: 'https://apps.apple.com/us/app/fliff-sportsbook-casino/id1489145500', web: 'https://www.getfliff.com' },
  prizepicks: { name: 'PrizePicks', pkg: 'com.prizepicks.app', ios: 'https://apps.apple.com/us/app/prizepicks-daily-fantasy/id1407493120', web: 'https://app.prizepicks.com' },
  underdog: { name: 'Underdog', pkg: 'com.underdogsports.android', ios: 'https://apps.apple.com/us/app/underdog-fantasy-sports/id1514665962', web: 'https://underdogfantasy.com' },
  parlayplay: { name: 'ParlayPlay', pkg: 'io.parlayplay.app', ios: 'https://apps.apple.com/us/app/parlayplay-fantasy-sports/id1566037258', web: 'https://parlayplay.io' },
  bovada: { name: 'Bovada', pkg: '', ios: '', web: 'https://www.bovada.lv/sports' },
  betonlineag: { name: 'BetOnline', pkg: '', ios: '', web: 'https://www.betonline.ag/sportsbook' },
  betus: { name: 'BetUS', pkg: '', ios: '', web: 'https://www.betus.com.pa/sportsbook/' }
};

const DEFAULT_ODDS_KEY = '';
let oddsApiKey = localStorage.getItem('aligniq_odds_key') || DEFAULT_ODDS_KEY;

const PHASE4_DEFAULT_WEIGHTS = { gem: 10, h2h: 60, ros: 30 };
const PHASE4_LEAGUE_WEIGHTS = {
  NBA: { gem: 10, h2h: 60, ros: 30 },
  NFL: { gem: 10, h2h: 60, ros: 30 },
  MLB: { gem: 10, h2h: 60, ros: 30 },
  WNBA: { gem: 10, h2h: 60, ros: 30 },
  UFC: { gem: 10, h2h: 60, ros: 30 },
  NHL: { gem: 10, h2h: 55, ros: 35 },
  EPL: { gem: 10, h2h: 55, ros: 35 },
  MLS: { gem: 10, h2h: 55, ros: 35 },
  UCL: { gem: 10, h2h: 55, ros: 35 },
  NCAAF: { gem: 8, h2h: 68, ros: 24 },
  NCAAB: { gem: 8, h2h: 68, ros: 24 },
  NCAAW: { gem: 8, h2h: 68, ros: 24 }
};

let currentDate = new Date(), allGames = [], summaryCache = {}, scheduleCache = {}, leagueNewsCache = {}, oddsSportCache = {}, propsEventCache = {}, fightersDb = {}, prevConfMap = {};
let yesterdayTeamsSet = new Set();
let activeSport = 'All', filterMode = 'all', agentReport = null, weights = { ...PHASE4_DEFAULT_WEIGHTS }, leagueWeights = { ...PHASE4_LEAGUE_WEIGHTS };
let selectedGameId = null, currentTab = 'odds', currentToolsTab = 'slip', currentSettingsTab = 'theme', oddsViewSide = 'pick', livePollTimer = null, sourceRegistry = [];
let savedIds = new Set(JSON.parse(localStorage.getItem('aligniq_saved') || '[]'));
let customContextMap = JSON.parse(localStorage.getItem('aligniq_ctx') || '{}');
let fightIntelMap = JSON.parse(localStorage.getItem('aligniq_fight_intel') || '{}');
let openOddsMap = JSON.parse(localStorage.getItem('aligniq_open_odds') || '{}');
let helpChatLog = [{ role: 'bot', text: 'Hi! I’m the AlignIQ Help Assistant. Ask me anything about CONF %, +EV, Weight Cut Gauges, Body Maps, or our multi-pillar model.' }];

// --- NORMALIZATION & AUTO-LOCKED ALGO WEIGHTS ---
function clampVal(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(val) || 0));
}
function normalizeH2H(rawH2H) {
  const val = Number(rawH2H);
  if (!Number.isFinite(val)) return 50;
  return clampVal(((val - 36) / 32) * 100, 0, 100);
}
function scaleGematria(rawGem) {
  const val = Number(rawGem);
  if (!Number.isFinite(val)) return 0;
  return clampVal(val * 0.85, 0, 100);
}

// Sliders are strictly read-only for everyone (including Owner) to prevent accidental edits
function syncOwnerAlgoLock() {
  ['w-gem', 'w-h2h', 'w-ros'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = true;
      el.style.opacity = '0.75';
      el.style.cursor = 'default';
      el.style.pointerEvents = 'none';
    }
  });
  const resetBtn = document.querySelector('#tuner-panel .tuner-header button');
  if (resetBtn) resetBtn.style.display = 'none';
  const hdr = document.querySelector('#tuner-panel .tuner-header h3');
  if (hdr) {
    hdr.innerHTML = 'AI Agent Weights <span style="font-size:10px;color:#34d399;font-weight:700;margin-left:6px;">AUTO-LOCKED</span>';
  }
}
window.syncOwnerAlgoLock = syncOwnerAlgoLock;

// --- HEADSHOT & AVATAR BUILDER ---
function getInitials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
function buildEspnHeadshotUrl(leagueKey, athleteId) {
  if (!athleteId) return '';
  const map = { NBA: 'nba', NFL: 'nfl', NHL: 'nhl', MLB: 'mlb', WNBA: 'wnba', UFC: 'mma', NCAAB: 'mens-college-basketball', NCAAF: 'college-football' };
  const slug = map[leagueKey];
  return slug ? `https://a.espncdn.com/i/headshots/${slug}/players/full/${athleteId}.png` : '';
}
function renderAvatar(name, imgUrl, size = 34) {
  const initials = getInitials(name);
  const safeUrl = (imgUrl || '').replace(/"/g, '');
  if (safeUrl) {
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,#1e293b,#0f172a);border:1.5px solid rgba(56,189,248,0.45);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.36)}px;font-weight:800;color:#cbd5e1;"><img src="${safeUrl}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.remove();this.parentElement.textContent='${initials}';" /></div>`;
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;flex-shrink:0;background:linear-gradient(135deg,#1e293b,#0f172a);border:1.5px solid rgba(148,163,184,0.35);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.36)}px;font-weight:800;color:#cbd5e1;">${initials}</div>`;
}

// --- DIRECT YOUTUBE VIDEO PLAYBACK ---
async function openDirectYouTube(query, fallbackUrl) {
  const q = String(query || '').trim();
  if (!q) { window.open(fallbackUrl || 'https://www.youtube.com', '_blank', 'noopener,noreferrer'); return; }
  try {
    const res = await fetch(`${WORKER_BASE_URL}/youtube?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.videoId) {
        window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(data.videoId)}&autoplay=1`, '_blank', 'noopener,noreferrer');
        return;
      }
    }
  } catch {}
  window.open(fallbackUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, '_blank', 'noopener,noreferrer');
}
window.openDirectYouTube = openDirectYouTube;

// --- THEME & SETTINGS MODAL ---
function applyTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('aligniq_theme', t);
  const meta = document.getElementById('meta-theme-color');
  if (meta) meta.setAttribute('content', t === 'light' ? '#f4f6fa' : '#06090f');
}
applyTheme(localStorage.getItem('aligniq_theme') || 'dark');

function openSettingsModal(tab = 'theme') {
  currentSettingsTab = tab;
  document.getElementById('settings-modal').classList.add('open');
  ['theme', 'help'].forEach(t => document.getElementById(`set-tab-${t}`).classList.toggle('active', t === tab));
  renderSettingsTab();
}
function switchSettingsTab(tab, btn) {
  currentSettingsTab = tab;
  document.querySelectorAll('#settings-modal .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderSettingsTab();
}
function setTheme(t) { applyTheme(t); renderSettingsTab(); }

function getHelpAnswer(q) {
  const s = (q || '').toLowerCase();
  if (/conf|weight|score|calculat|formula|pillar/.test(s)) return 'CONF % uses league-specific normalized weights, B2B rest fatigue (NBA/NHL), Home/Road splits, sharp line movement, and the Underdog Agreement Gate.';
  if (/\+ev|ev|value|arb|arbitrage/.test(s)) return '+EV% shows when a sportsbook is paying more than the No-Vig Fair Consensus probability. Arbitrage (⚡) appears when two books disagree enough that betting both sides guarantees a profit. Neither alters CONF %.';
  if (/weight cut|cut|gauge|ufc|fight|boxing|bkfc/.test(s)) return 'In Fight IQ, each fighter’s Weight Cut Gauge compares their current weight against their career lowest weight (Biggest Cut) and highest weight (Lowest Cut), automatically weighing cut stress and striking defense/reach into CONF %.';
  if (/body|weak|red|dot|map|injur/.test(s)) return 'Red pulsing dots on the Body Outline highlight fighter target/defense weak points or injured body zones on team sports. Tap any red dot to open ESPN reports, X/Twitter posts, Google News, and YouTube clips.';
  if (/source|link|box|hover|proof/.test(s)) return 'Every reference has verified source links. If there is 1 source, tapping opens it directly; if there are 2+ sources, a floating scrollable box pops up so you can choose which one to visit.';
  if (/theme|light|dark|mode/.test(s)) return 'Switch between Dark Mode and Light Mode right here in Settings → Theme. Your preference saves automatically on this device.';
  if (/parlay|slip|calc/.test(s)) return 'Tap ☆ on any game card to add it to your ★ Parlay Slip. Tap Slip in the bottom bar or Calculators in the menu for the Parlay Slip, Arbitrage Splitter, +EV Calculator, and American ↔ Kalshi ¢ converter.';
  return 'I can explain CONF % weights, +EV & Arbitrage, Weight Cut Gauges, Body Weak-Point Maps, Player Props/DFS, or the Parlay Slip. What would you like to know?';
}

function sendHelpMsg() {
  const inp = document.getElementById('help-input');
  const txt = (inp?.value || '').trim();
  if (!txt) return;
  helpChatLog.push({ role: 'user', text: txt });
  helpChatLog.push({ role: 'bot', text: getHelpAnswer(txt) });
  inp.value = '';
  renderSettingsTab();
}
function askHelpQuick(txt) {
  helpChatLog.push({ role: 'user', text: txt });
  helpChatLog.push({ role: 'bot', text: getHelpAnswer(txt) });
  renderSettingsTab();
}

function renderSettingsTab() {
  const body = document.getElementById('settings-body');
  if (currentSettingsTab === 'theme') {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    body.innerHTML = `
      <div class="theme-grid">
        <div class="theme-card ${cur === 'dark' ? 'active' : ''}" onclick="setTheme('dark')">
          <div style="font-size:24px;">🌙</div><strong>Dark Mode</strong><span>Sleek low-glare slate</span>
        </div>
        <div class="theme-card ${cur === 'light' ? 'active' : ''}" onclick="setTheme('light')">
          <div style="font-size:24px;">☀️</div><strong>Light Mode</strong><span>Crisp high-contrast day</span>
        </div>
      </div>
    `;
  } else {
    body.innerHTML = `
      <div class="help-chips">
        <button class="help-chip" onclick="askHelpQuick('How is CONF % calculated?')">CONF % Formula</button>
        <button class="help-chip" onclick="askHelpQuick('How does the Weight Cut Gauge work?')">Weight Cut Gauge</button>
        <button class="help-chip" onclick="askHelpQuick('What do the red dots on the body map do?')">Body Map</button>
        <button class="help-chip" onclick="askHelpQuick('What is +EV and Arbitrage?')">+EV &amp; Arb</button>
      </div>
      <div class="chat-box" id="help-chat-box">
        ${helpChatLog.map(m => `<div class="chat-msg ${m.role}">${m.text}</div>`).join('')}
      </div>
      <div class="chat-input-row">
        <input id="help-input" class="form-input" placeholder="Ask about any AlignIQ feature..." onkeydown="if(event.key==='Enter') sendHelpMsg()" />
        <button class="icon-btn accent" style="height:36px;padding:0 14px;" onclick="sendHelpMsg()">Send</button>
      </div>
    `;
    const box = document.getElementById('help-chat-box');
    if (box) box.scrollTop = box.scrollHeight;
  }
}

// --- UNIVERSAL SOURCE ROUTER ---
function registerSources(title, sources) {
  const clean = (sources || []).filter(s => s && s.url);
  const idx = sourceRegistry.length;
  sourceRegistry.push({ title, sources: clean });
  return { idx, count: clean.length };
}
function triggerSource(idx, ev) {
  if (ev) ev.stopPropagation();
  const entry = sourceRegistry[idx];
  if (!entry || !entry.sources.length) return;
  if (entry.sources.length === 1) {
    const s = entry.sources[0];
    if (s.kind === 'video' && s.ytQuery) openDirectYouTube(s.ytQuery, s.url);
    else window.open(s.url, '_blank', 'noopener,noreferrer');
    return;
  }
  document.getElementById('source-box-title').textContent = `${entry.title} (${entry.sources.length} Sources)`;
  document.getElementById('source-box-list').innerHTML = entry.sources.map(s => {
    if (s.kind === 'video' && s.ytQuery) {
      const safeQ = s.ytQuery.replace(/'/g, "\\'");
      const safeUrl = s.url.replace(/'/g, "\\'");
      return `
        <a class="source-link-row" href="${s.url}" onclick="event.preventDefault(); openDirectYouTube('${safeQ}', '${safeUrl}')">
          <div style="min-width:0;flex:1;">
            <span class="source-tag video">${s.platform || 'YOUTUBE'} ▶</span>
            <div class="source-title">${s.title}</div>
            ${s.sub ? `<div class="source-sub">${s.sub}</div>` : ''}
          </div>
          <span style="color:#ef4444;font-weight:800;font-size:14px;flex-shrink:0;">▶</span>
        </a>
      `;
    }
    return `
      <a class="source-link-row" href="${s.url}" target="_blank" rel="noopener noreferrer">
        <div style="min-width:0;flex:1;">
          <span class="source-tag ${s.kind || ''}">${s.platform || 'SOURCE'}</span>
          <div class="source-title">${s.title}</div>
          ${s.sub ? `<div class="source-sub">${s.sub}</div>` : ''}
        </div>
        <span style="color:var(--blue);font-weight:800;font-size:14px;flex-shrink:0;">↗</span>
      </a>
    `;
  }).join('');
  document.getElementById('source-popover').classList.add('open');
}
function closeSourceBox() { document.getElementById('source-popover').classList.remove('open'); }

function buildSocialAndNewsSources(subject, topic, extraNews = []) {
  const rawQ = `${subject} ${topic}`.trim();
  const q = encodeURIComponent(rawQ), list = [];
  (extraNews || []).slice(0, 3).forEach(n => { if (n.url) list.push({ platform: 'ESPN NEWS', title: n.headline, sub: n.published || 'Official Report', url: n.url }); });
  list.push(
    { platform: 'YOUTUBE', kind: 'video', ytQuery: rawQ, title: `Play top video: ${subject} (${topic})`, sub: 'Direct relevant video playback', url: `https://www.youtube.com/results?search_query=${q}` },
    { platform: 'X / TWITTER', kind: 'social', title: `Live X posts: ${subject} (${topic})`, sub: 'Real-time fan, reporter & camp updates', url: `https://x.com/search?q=${q}&f=live` },
    { platform: 'GOOGLE NEWS', title: `News coverage: ${subject} ${topic}`, sub: 'Latest headlines & injury/weigh-in reports', url: `https://news.google.com/search?q=${q}` },
    { platform: 'REDDIT', kind: 'social', title: `Reddit threads: ${subject} ${topic}`, sub: 'Community breakdown & camp rumors', url: `https://www.reddit.com/search/?q=${q}&sort=new` }
  );
  return list;
}

function espnGameUrl(g) {
  const lg = LEAGUES.find(l => l.key === g.league);
  if (g.path && lg?.espnSlug && !String(g.id).startsWith('odds_')) return `https://www.espn.com/${lg.espnSlug}/game/_/gameId/${g.id}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${g.away.name} vs ${g.home.name} ${g.league}`)}`;
}

// Verified sport-specific routing (prevents MMA fighters from linking to team schedules)
function espnTeamScheduleUrl(g, teamId) {
  if (FIGHT_LEAGUES.has(g.league)) {
    return teamId
      ? `https://www.espn.com/mma/fighter/_/id/${teamId}`
      : `https://www.tapology.com/search?term=${encodeURIComponent(g.pickedTeam?.name || '')}`;
  }
  const lg = LEAGUES.find(l => l.key === g.league);
  return (lg?.espnSlug && teamId) ? `https://www.espn.com/${lg.espnSlug}/team/schedule/_/id/${teamId}` : espnGameUrl(g);
}

// --- BODY OUTLINE WEAK-POINT MAPPER ---
function detectBodyZoneFromText(txt) {
  const t = (txt || '').toLowerCase();
  if (/head|concuss|eye|jaw|nose|ear|neck|face|chin|migraine/i.test(t)) return 'head';
  if (/rib|chest|torso|abdom|back|core|oblique|hip|pelvis|groin|body|liver/i.test(t)) return 'upper';
  if (/shoulder|arm|elbow|wrist|hand|finger|thumb|bicep|tricep|clavicle|pec/i.test(t)) return 'arms';
  if (/ankle|foot|toe|achilles|heel|plantar|calf|shin/i.test(t)) return 'feet';
  if (/knee|acl|mcl|meniscus|hamstring|quad|thigh|leg|patella/i.test(t)) return 'legs';
  return 'upper';
}
const BODY_COORDS = {
  head: [{ cx: 70, cy: 26, r: 10 }], upper: [{ cx: 70, cy: 84, r: 11 }],
  arms: [{ cx: 34, cy: 96, r: 9 }, { cx: 106, cy: 96, r: 9 }],
  legs: [{ cx: 56, cy: 162, r: 10 }, { cx: 84, cy: 162, r: 10 }],
  feet: [{ cx: 55, cy: 222, r: 9 }, { cx: 85, cy: 222, r: 9 }]
};
function renderBodyOutlineCard(title, hotspots) {
  const activeZones = {}; hotspots.forEach(h => { if (!activeZones[h.zone]) activeZones[h.zone] = h; });
  const circlesHtml = Object.keys(activeZones).map(z => (BODY_COORDS[z] || []).map(pt => `<circle class="hotspot-ring" cx="${pt.cx}" cy="${pt.cy}" r="${pt.r}" onclick="triggerSource(${activeZones[z].srcIdx}, event)" /><circle class="hotspot-dot" cx="${pt.cx}" cy="${pt.cy}" r="4" onclick="triggerSource(${activeZones[z].srcIdx}, event)" />`).join('')).join('');
  const listHtml = hotspots.length
    ? hotspots.map(h => `<button class="weak-zone-btn" onclick="triggerSource(${h.srcIdx}, event)"><strong>● ${h.label}</strong><span>${h.sub} · Tap for Video &amp; News ↗</span></button>`).join('')
    : `<div class="proof-sub">No major weak points or injuries flagged. Tap any card below for sources.</div>`;
  return `<div class="body-map-card"><div class="body-map-head"><h4>🎯 ${title}</h4><span style="font-size:10px;color:var(--danger);font-weight:700;">Tap red dots for video/news</span></div><div class="body-map-wrap"><div class="body-svg-box"><svg width="96" height="178" viewBox="0 0 140 250" fill="none"><circle cx="70" cy="26" r="16" stroke="#64748b" stroke-width="2.2" fill="rgba(56,189,248,0.06)"/><path d="M52 48 C58 45, 82 45, 88 48 L108 60 L114 128 L102 130 L96 78 L92 132 L92 232 L76 232 L72 152 L68 152 L64 232 L48 232 L48 132 L44 78 L38 130 L26 128 L32 60 Z" stroke="#64748b" stroke-width="2.2" fill="rgba(56,189,248,0.06)"/>${circlesHtml}</svg></div><div class="weak-zone-list">${listHtml}</div></div></div>`;
}

// --- AUTO WEIGHT-CUT GAUGE ---
function computeWeightCutGauge(fighterObj, manualCutPen = 0) {
  const wc = fighterObj?.weight_cut;
  if (!wc || !wc.min_lbs || !wc.max_lbs || !wc.current_lbs) return { hasAuto: false, pen: manualCutPen, label: manualCutPen > 0 ? `Manual Cut Stress (-${manualCutPen} pts)` : 'Pending Official Weigh-In' };
  const minL = Number(wc.min_lbs), maxL = Number(wc.max_lbs), curL = Number(wc.current_lbs), missed = Number(wc.missed_count || 0), span = Math.max(0, maxL - minL);
  const cutRatio = span > 0 ? Math.max(0, Math.min(1, (maxL - curL) / span)) : 0.25;
  const totalPen = Math.min(20, Math.max(Math.min(16, Math.round(cutRatio * 10) + missed * 5), manualCutPen));
  const posPct = span > 0 ? Math.max(4, Math.min(96, ((curL - minL) / span) * 100)) : 50;
  return { hasAuto: true, minL, maxL, curL, missed, posPct, pen: totalPen, label: totalPen >= 10 ? `Heavy Cut (-${totalPen} pts)` : totalPen >= 5 ? `Moderate Cut (-${totalPen} pts)` : `Comfortable Weight (-${totalPen} pts)` };
}

// --- AGENT & DATA LOADERS ---
async function loadAgentReport() {
  try {
    const res = await fetch(`./agent_report.json?t=${Date.now()}`);
    if (res.ok) {
      agentReport = await res.json();
      const reportW = agentReport.weights || agentReport.active_weights;
      if (reportW && typeof reportW.gem === 'number') weights = { ...reportW };
      if (agentReport.league_weights) leagueWeights = { ...PHASE4_LEAGUE_WEIGHTS, ...agentReport.league_weights };
      syncSlidersToWeights(); renderAgentStatusBox(); syncOwnerAlgoLock();
    }
  } catch {}
  try { const fres = await fetch(`./fighters.json?t=${Date.now()}`); if (fres.ok) fightersDb = await fres.json(); } catch {}
  if (allGames.length) renderFeed();
}
function syncSlidersToWeights() {
  document.getElementById('w-gem').value = weights.gem; document.getElementById('w-h2h').value = weights.h2h; document.getElementById('w-ros').value = weights.ros;
  document.getElementById('w-gem-val').textContent = weights.gem + '%'; document.getElementById('w-h2h-val').textContent = weights.h2h + '%'; document.getElementById('w-ros-val').textContent = weights.ros + '%';
  syncOwnerAlgoLock();
}
function renderAgentStatusBox() {
  const box = document.getElementById('agent-status-box'); if (!agentReport || !box) return;
  const s60 = agentReport.summary_60d;
  const winRate = s60 ? s60.win_rate : (agentReport.overall_win_rate ?? 0);
  const record = s60 ? `${s60.wins}-${s60.losses}` : (agentReport.overall_record || '0-0');
  const totalGraded = s60 ? s60.total : (agentReport.total_games_graded || 0);
  const dogStr = s60?.underdogs ? ` · Dogs: ${s60.underdogs.wins}-${s60.underdogs.losses} (${s60.underdogs.win_rate}%)` : '';
  const roiStr = s60?.roi_pct != null ? ` · ${s60.roi_pct >= 0 ? '+' : ''}${s60.roi_pct}% ROI` : '';
  const note = agentReport.last_rebalance_note || agentReport.adjustment_reason || 'Phase 4 ROI Tuner active.';
  const updated = agentReport.updated_at ? new Date(agentReport.updated_at).toLocaleDateString() : (agentReport.last_updated || 'Today');
  box.innerHTML = `<strong>AI Agent Verified: ${winRate}% (${record} · ${totalGraded} games${roiStr}${dogStr})</strong><div>${note}</div><div style="margin-top:4px;color:var(--text-dim);">Algo: ${agentReport.algo_version || 'phase4'} · Leagues: ${Object.keys(leagueWeights).length} · Updated: ${updated}</div>`;
  document.getElementById('feed-sub').textContent = `AI Verified ${winRate}% (${record}) · 30s live sync`;
}

// --- ODDS MATH ---
function americanToDecimal(o) { return !o ? 2 : (o > 0 ? 1 + o / 100 : 1 + 100 / Math.abs(o)); }
function americanToImplied(o) { return !o ? 0.5 : (o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100)); }
function americanToProfit100(o) { return !o ? 0 : (o > 0 ? o : 10000 / Math.abs(o)); }
function americanToCents(o) { return Math.round(americanToImplied(o) * 100); }
function decimalToAmerican(dec) { return (!dec || dec <= 1.01) ? -10000 : (dec >= 2 ? Math.round((dec - 1) * 100) : Math.round(-100 / (dec - 1))); }

function analyzeOddsEvent(oddsEv, homeTeam, awayTeam) {
  if (!oddsEv?.bookmakers?.length) return { homeRows: [], awayRows: [], fairHome: 0.5, fairAway: 0.5, fairPairs: 0, arb: null, opened: null, lineMoveHome: 0, lineMoveAway: 0 };
  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const hFull = norm(homeTeam.name), aFull = norm(awayTeam.name), hShort = norm(homeTeam.mascot || homeTeam.short || homeTeam.name), aShort = norm(awayTeam.mascot || awayTeam.short || awayTeam.name);
  const homeRows = [], awayRows = []; let sumFairHome = 0, fairPairs = 0;

  oddsEv.bookmakers.forEach(bm => {
    const h2h = (bm.markets || []).find(m => m.key === 'h2h'); if (!h2h?.outcomes?.length) return;
    const hOut = h2h.outcomes.find(o => norm(o.name) === hFull || norm(o.name).includes(hShort) || hFull.includes(norm(o.name)));
    const aOut = h2h.outcomes.find(o => o !== hOut && (norm(o.name) === aFull || norm(o.name).includes(aShort) || aFull.includes(norm(o.name))));
    if (hOut && aOut && typeof hOut.price === 'number' && typeof aOut.price === 'number') {
      const ih = americanToImplied(hOut.price), ia = americanToImplied(aOut.price);
      if (ih + ia > 0) { sumFairHome += ih / (ih + ia); fairPairs++; }
    }
    if (hOut && typeof hOut.price === 'number') homeRows.push({ key: bm.key, title: bm.title, price: hOut.price, dec: americanToDecimal(hOut.price), profit100: americanToProfit100(hOut.price), cents: americanToCents(hOut.price), link: hOut.link || h2h.link || bm.link || '' });
    if (aOut && typeof aOut.price === 'number') awayRows.push({ key: bm.key, title: bm.title, price: aOut.price, dec: americanToDecimal(aOut.price), profit100: americanToProfit100(aOut.price), cents: americanToCents(aOut.price), link: aOut.link || h2h.link || bm.link || '' });
  });

  const fairHome = fairPairs ? (sumFairHome / fairPairs) : 0.5, fairAway = 1 - fairHome;
  homeRows.forEach(r => { r.ev = ((fairHome * r.dec) - 1) * 100; }); awayRows.forEach(r => { r.ev = ((fairAway * r.dec) - 1) * 100; });
  homeRows.sort((a, b) => b.profit100 - a.profit100); awayRows.sort((a, b) => b.profit100 - a.profit100);

  const openKey = oddsEv.id || `${hFull}_${aFull}`;
  if (!openOddsMap[openKey] && homeRows[0] && awayRows[0]) { openOddsMap[openKey] = { home: homeRows[0].price, away: awayRows[0].price }; localStorage.setItem('aligniq_open_odds', JSON.stringify(openOddsMap)); }
  const opened = openOddsMap[openKey] || null;

  let lineMoveHome = 0, lineMoveAway = 0;
  if (opened && homeRows[0] && awayRows[0]) {
    lineMoveHome = Math.round((americanToImplied(homeRows[0].price) - americanToImplied(opened.home)) * 100);
    lineMoveAway = Math.round((americanToImplied(awayRows[0].price) - americanToImplied(opened.away)) * 100);
  }

  let arb = null;
  if (homeRows[0] && awayRows[0]) {
    const invSum = (1 / homeRows[0].dec) + (1 / awayRows[0].dec);
    if (invSum < 0.998) {
      const roi = ((1 / invSum) - 1) * 100, stakeHome = 100 / (homeRows[0].dec * invSum), stakeAway = 100 - stakeHome;
      arb = { roi, profit100: (stakeHome * homeRows[0].dec) - 100, homeBook: homeRows[0].title, homePrice: homeRows[0].price, stakeHome, awayBook: awayRows[0].title, awayPrice: awayRows[0].price, stakeAway };
    }
  }
  return { homeRows, awayRows, fairHome, fairAway, fairPairs, arb, opened, lineMoveHome, lineMoveAway };
}

// --- FORM, FIGHT IQ & INJURIES ---
function computeFormMetrics(sched) {
  if (!sched || !sched.length) return null;
  const l10 = sched.slice(-10), l5 = sched.slice(-5);
  return { pct: (l5.filter(x => x.won).length / l5.length) * 0.6 + (l10.filter(x => x.won).length / l10.length) * 0.4, avgMargin: l5.reduce((s, x) => s + x.margin, 0) / l5.length };
}
function parseReachInches(s) { const m = String(s || '').match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : null; }
function findFighterStats(name) { return (!name || !fightersDb) ? null : (fightersDb[name.toLowerCase().replace(/[^a-z0-9]/g, '')] || null); }
function computeFightEdge(homeName, awayName) {
  const fH = findFighterStats(homeName), fA = findFighterStats(awayName);
  if (!fH || !fA || !fH.str_def || !fA.str_def) return { edge: 0, hasData: false };
  const defDiff = (fH.str_def - fA.str_def) * 0.6, sapmDiff = ((fA.sapm || 3.2) - (fH.sapm || 3.2)) * 4.0;
  const rH = parseReachInches(fH.reach), rA = parseReachInches(fA.reach);
  const reachDiff = (rH && rA) ? Math.max(-6, Math.min(6, (rH - rA) * 1.2)) : 0;
  return { edge: Math.max(-22, Math.min(22, Math.round(defDiff + sapmDiff + reachDiff))), hasData: true, defDiff: Math.round(defDiff), sapmDiff: Math.round(sapmDiff), reachDiff: Math.round(reachDiff) };
}
const PRIMARY_STAT_RE = /point|passing|goal|rating|scoring/i;
function extractLeadersFromArr(arr, teamShort, side) {
  const out = [];
  (arr || []).forEach(cat => {
    const top = (cat.leaders || [])[0]; if (!top?.athlete) return;
    out.push({
      id: String(top.athlete.id || ''),
      headshot: top.athlete.headshot?.href || top.athlete.headshot || '',
      name: top.athlete.displayName || top.athlete.shortName || '',
      team: teamShort,
      side,
      stat: cat.shortDisplayName || cat.displayName || cat.name || 'Stat',
      value: top.displayValue || '',
      isPrimary: PRIMARY_STAT_RE.test(`${cat.name || ''} ${cat.displayName || ''}`)
    });
  });
  return out;
}
function classifyInjuryImpact(inj, allLeaders) {
  const norm = s => (s || '').toLowerCase().replace(/[^a-z]/g, '');
  const matches = (allLeaders || []).filter(l => l.side === inj.teamSide && ((inj.athleteId && l.id && inj.athleteId === l.id) || (norm(inj.player) && norm(l.name) === norm(inj.player))));
  const isMulti = matches.length >= 2, tier = (isMulti || matches.some(m => m.isPrimary)) ? 'star' : (matches.length === 1 ? 'key' : 'bench');
  const st = inj.status || '', isOut = /out|ir|injured reserve|suspended/i.test(st), isDoubt = /doubtful/i.test(st), isQuest = /questionable|day-to-day|gtd/i.test(st);
  const pts = tier === 'star' ? (isOut ? (isMulti ? 18 : 16) : isDoubt ? 11 : isQuest ? 5 : 0) : tier === 'key' ? (isOut ? 10 : isDoubt ? 7 : isQuest ? 3 : 0) : (isOut ? 2 : isDoubt ? 1 : 0);
  return { tier, pts, statLabels: [...new Set(matches.map(m => m.stat))].join('/') };
}

// --- 4-CIPHER GEMATRIA & EVALUATION ---
function reduceDigit(n) { while (n > 9) n = String(n).split('').reduce((a, b) => a + Number(b), 0); return n; }
function calcCiphers(str) {
  const clean = (str || '').toUpperCase().replace(/[^A-Z]/g, ''); let ord = 0, red = 0, rev = 0, rred = 0;
  for (let i = 0; i < clean.length; i++) { const v = clean.charCodeAt(i) - 64, rv = 27 - v; ord += v; red += reduceDigit(v); rev += rv; rred += reduceDigit(rv); }
  return { ord, red, rev, rred };
}
function getDateMath(d) {
  const m = d.getMonth() + 1, day = d.getDate(), y = d.getFullYear(), yTop = Math.floor(y / 100), yBot = y % 100;
  const full = m + day + yTop + yBot, short = m + day + yBot, digits = `${m}${day}${y}`.split('').reduce((a, b) => a + Number(b), 0);
  const mixed = m + day + String(y).split('').reduce((a, b) => a + Number(b), 0), doy = Math.floor((d - new Date(y, 0, 0)) / 86400000);
  const left = (((y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0)) ? 366 : 365) - doy;
  return { full, short, digits, mixed, doy, left, nums: [full, short, digits, mixed, doy, left] };
}
function parseRecord(s) { const m = String(s || '').match(/(\d+)\s*-\s*(\d+)/); return m ? { w: parseInt(m[1], 10), l: parseInt(m[2], 10) } : null; }
function buildRecordTargets(w, l) {
  const t = new Set(), c = Number(`${w}${l}`), nz = Number(`${w}${l}`.replace(/0/g, '') || 0);
  if (c > 0) t.add(c); if (nz > 0 && nz !== c) t.add(nz); if (w > 0) t.add(w); if (l > 0) t.add(l);
  return Array.from(t);
}
function progressiveScore(hits) { const tiers = [0, 0, 42, 62, 76, 88, 95, 100]; return hits < 2 ? 0 : tiers[Math.min(hits, tiers.length - 1)]; }
function buildEntities(game, sumData, userCtx) {
  const list = [], add = (label, text) => { const t = (text || '').trim(); if (t && t !== 'TBD Venue' && !list.some(x => x.text.toLowerCase() === t.toLowerCase())) list.push({ label, text: t }); };
  add('Away Full', game.away.name); add('Away City', game.away.location); add('Away Mascot', game.away.mascot);
  add('Home Full', game.home.name); add('Home City', game.home.location); add('Home Mascot', game.home.mascot);
  add('Stadium', game.venue); add('Venue City', game.venueCity); add('Broadcast', game.broadcast); add('Event Note', game.eventNote);
  if (sumData?.officials?.length) sumData.officials.forEach((ref, i) => add(`Official #${i + 1}`, ref));
  if (userCtx) { add('Performer', userCtx.artist); add('Song', userCtx.song); add('Coaches / Extra', userCtx.extra); }
  return list;
}

function evaluateGame(game, dm) {
  const sumData = summaryCache[game.id] || null, userCtx = customContextMap[game.id] || game.customCtx || null, fIntel = fightIntelMap[game.id] || null;
  const entities = buildEntities(game, sumData, userCtx);
  const activeW = leagueWeights[game.league] || PHASE4_LEAGUE_WEIGHTS[game.league] || weights;
  const awayRec = parseRecord(game.away.record), homeRec = parseRecord(game.home.record);

  function scanOutcome(winT, oppLossT, winLbl, oppLossLbl, shortNm) {
    const hits = [];
    entities.forEach(ent => {
      const c = calcCiphers(ent.text);
      [['Ordinal', c.ord], ['Full Red', c.red], ['Reverse', c.rev], ['Rev Red', c.rred]].forEach(([cn, v]) => {
        if (v > 0 && winT.includes(v)) hits.push(`${ent.label} (${ent.text}) = ${v} [${cn}] → ${winLbl}`);
        else if (v > 0 && oppLossT.includes(v)) hits.push(`${ent.label} (${ent.text}) = ${v} [${cn}] → ${oppLossLbl}`);
      });
    });
    if (shortNm) {
      const tc = calcCiphers(shortNm);
      [['Ordinal', tc.ord], ['Full Red', tc.red], ['Reverse', tc.rev], ['Rev Red', tc.rred]].forEach(([cn, v]) => {
        if (dm.nums.includes(v)) hits.push(`${shortNm} = ${v} [${cn}] → matches Date Numerology (${v})`);
      });
    }
    return hits;
  }

  const awayHits = scanOutcome(awayRec ? buildRecordTargets(awayRec.w + 1, awayRec.l) : [], homeRec ? buildRecordTargets(homeRec.w, homeRec.l + 1) : [], awayRec ? `${game.away.short} Win (${awayRec.w + 1}-${awayRec.l})` : `${game.away.short} Win`, homeRec ? `${game.home.short} Loss (${homeRec.w}-${homeRec.l + 1})` : `${game.home.short} Loss`, game.away.short);
  const homeHits = scanOutcome(homeRec ? buildRecordTargets(homeRec.w + 1, homeRec.l) : [], awayRec ? buildRecordTargets(awayRec.w, awayRec.l + 1) : [], homeRec ? `${game.home.short} Win (${homeRec.w + 1}-${homeRec.l})` : `${game.home.short} Win`, awayRec ? `${game.away.short} Loss (${awayRec.w}-${awayRec.l + 1})` : `${game.away.short} Loss`, game.home.short);
  const awayGem = progressiveScore(awayHits.length), homeGem = progressiveScore(homeHits.length);

  const cachedOddsEv = game.oddsEventDirect || matchGameInOdds(game, oddsSportCache[game.oddsKey]?.data || []);
  const oa = analyzeOddsEvent(cachedOddsEv, game.home, game.away);
  let fairHomeProb = 0.5, hasScaledOdds = false;
  if (oa.fairPairs > 0) { fairHomeProb = oa.fairHome; hasScaledOdds = true; }
  else if (typeof game.homeML === 'number' && typeof game.awayML === 'number') {
    const ih = americanToImplied(game.homeML), ia = americanToImplied(game.awayML);
    if (ih + ia > 0) { fairHomeProb = ih / (ih + ia); hasScaledOdds = true; }
  } else if (game.oddsFav === 'home') fairHomeProb = 0.58;
  else if (game.oddsFav === 'away') fairHomeProb = 0.42;

  const aPct = awayRec && (awayRec.w + awayRec.l) > 0 ? awayRec.w / (awayRec.w + awayRec.l) : 0.5;
  const hPct = homeRec && (homeRec.w + homeRec.l) > 0 ? homeRec.w / (homeRec.w + homeRec.l) : 0.5;
  const aSp = parseRecord(game.away.roadRecord), hSp = parseRecord(game.home.homeRecord);
  const aSpPct = aSp && (aSp.w + aSp.l) > 0 ? aSp.w / (aSp.w + aSp.l) : aPct;
  const hSpPct = hSp && (hSp.w + hSp.l) > 0 ? hSp.w / (hSp.w + hSp.l) : hPct;

  const isFight = FIGHT_LEAGUES.has(game.league);
  const oddsH = Math.min(95, Math.max(12, Math.round(fairHomeProb * 100))), oddsA = Math.min(95, Math.max(12, Math.round((1 - fairHomeProb) * 100)));
  const h2hHome = isFight ? oddsH : Math.min(95, Math.max(12, Math.round(oddsH * 0.60 + Math.min(95, Math.max(15, 50 + (hSpPct - aSpPct) * 45)) * 0.40)));
  const h2hAway = isFight ? oddsA : Math.min(95, Math.max(12, Math.round(oddsA * 0.60 + Math.min(95, Math.max(15, 50 + (aSpPct - hSpPct) * 45)) * 0.40)));

  const homeForm = (!isFight && game.path && game.home.id) ? computeFormMetrics(scheduleCache[`${game.path}_${game.home.id}`]) : null;
  const awayForm = (!isFight && game.path && game.away.id) ? computeFormMetrics(scheduleCache[`${game.path}_${game.away.id}`]) : null;
  const blendedH = homeForm ? (hSpPct * 0.60 + homeForm.pct * 0.40) : hSpPct;
  const blendedA = awayForm ? (aSpPct * 0.60 + awayForm.pct * 0.40) : aSpPct;
  const marginBoost = (homeForm && awayForm) ? Math.max(-8, Math.min(8, Math.round((homeForm.avgMargin - awayForm.avgMargin) * 0.5))) : 0;

  const homeB2B = B2B_LEAGUES.has(game.league) && game.home.id && yesterdayTeamsSet.has(`${game.league}_${game.home.id}`);
  const awayB2B = B2B_LEAGUES.has(game.league) && game.away.id && yesterdayTeamsSet.has(`${game.league}_${game.away.id}`);
  const homeRestPen = (homeB2B && !awayB2B) ? 6 : 0;
  const awayRestPen = (awayB2B && !homeB2B) ? 6 : 0;

  const fightIQ = isFight ? computeFightEdge(game.home.name, game.away.name) : { edge: 0, hasData: false };
  const homeCutGauge = isFight ? computeWeightCutGauge(findFighterStats(game.home.name), Number(fIntel?.homeCutPen || 0)) : null;
  const awayCutGauge = isFight ? computeWeightCutGauge(findFighterStats(game.away.name), Number(fIntel?.awayCutPen || 0)) : null;

  const allLeaders = [...(game.leaders || []), ...(sumData?.leaders || [])];
  let homeInjPen = 0, awayInjPen = 0;
  const gradedInjuries = (sumData?.injuries || []).map(inj => {
    const impact = classifyInjuryImpact(inj, allLeaders);
    if (inj.teamSide === 'home') homeInjPen += impact.pts; else awayInjPen += impact.pts;
    return { ...inj, ...impact };
  });
  if (isFight) { homeInjPen += (homeCutGauge?.pen || 0) + Number(fIntel?.homeInjPen || 0); awayInjPen += (awayCutGauge?.pen || 0) + Number(fIntel?.awayInjPen || 0); }
  homeInjPen = Math.min(35, homeInjPen); awayInjPen = Math.min(35, awayInjPen);

  const rosHomeBase = Math.min(95, Math.max(12, Math.round(56 + (blendedH - blendedA) * 32 + marginBoost + fightIQ.edge - homeInjPen + awayInjPen - homeRestPen + awayRestPen)));
  const rosAwayBase = Math.min(95, Math.max(12, Math.round(52 + (blendedA - blendedH) * 32 - marginBoost - fightIQ.edge - awayInjPen + homeInjPen - awayRestPen + homeRestPen)));

  const normH2HHome = clampVal(normalizeH2H(h2hHome) + (oa.lineMoveHome >= 3 ? 3 : 0), 0, 100);
  const normH2HAway = clampVal(normalizeH2H(h2hAway) + (oa.lineMoveAway >= 3 ? 3 : 0), 0, 100);
  const totalW = (activeW.gem + activeW.h2h + activeW.ros) || 1;
  const normHomeScore = (scaleGematria(homeGem) * activeW.gem + normH2HHome * activeW.h2h + rosHomeBase * activeW.ros) / totalW;
  const normAwayScore = (scaleGematria(awayGem) * activeW.gem + normH2HAway * activeW.h2h + rosAwayBase * activeW.ros) / totalW;

  let pickSide = normHomeScore >= normAwayScore ? 'home' : 'away';
  const marketDog = h2hHome === h2hAway ? null : (h2hHome < h2hAway ? 'home' : 'away');
  let dogGateTriggered = false;

  if (marketDog && pickSide === marketDog) {
    const dogH2H = pickSide === 'home' ? h2hHome : h2hAway;
    const dogRos = pickSide === 'home' ? rosHomeBase : rosAwayBase;
    const favRos = pickSide === 'home' ? rosAwayBase : rosHomeBase;
    const dogGem = pickSide === 'home' ? homeGem : awayGem;
    const favGem = pickSide === 'home' ? awayGem : homeGem;
    const dogMove = pickSide === 'home' ? oa.lineMoveHome : oa.lineMoveAway;

    const closeMarket = dogH2H >= 44;
    const bothAgree = (dogRos > favRos) && (dogGem > favGem);
    const strongFormEdge = (dogRos - favRos) >= 22;
    const sharpMove = dogMove >= 3;

    if (!(closeMarket && (bothAgree || strongFormEdge || sharpMove))) {
      pickSide = pickSide === 'home' ? 'away' : 'home';
      dogGateTriggered = true;
    }
  }

  const isUnderdogPick = Boolean(marketDog && pickSide === marketDog);
  const pickLineMove = pickSide === 'home' ? oa.lineMoveHome : oa.lineMoveAway;
  const primaryHits = pickSide === 'home' ? homeHits : awayHits;
  const gemScore = pickSide === 'home' ? homeGem : awayGem, h2hScore = pickSide === 'home' ? h2hHome : h2hAway;
  const normH2HPick = Math.round(pickSide === 'home' ? normH2HHome : normH2HAway);
  const injuryPenalty = pickSide === 'home' ? homeInjPen : awayInjPen, oppInjuryBonus = pickSide === 'home' ? awayInjPen : homeInjPen;

  let liveShift = 0; const liveEvents = sumData?.liveEvents || [];
  if (game.state === 'in') {
    const aS = Number(game.away.score || 0), hS = Number(game.home.score || 0), margin = pickSide === 'home' ? (hS - aS) : (aS - hS);
    liveShift = sumData?.liveHomeWP != null ? Math.round(((pickSide === 'home' ? sumData.liveHomeWP : (1 - sumData.liveHomeWP)) - 0.5) * 44) : Math.max(-22, Math.min(22, Math.round(margin * 2.2)));
    liveEvents.forEach(ev => { liveShift += ev.impact; });
    liveShift = Math.max(-28, Math.min(28, liveShift));
  }

  const rosScore = Math.min(98, Math.max(10, Math.round(pickSide === 'home' ? rosHomeBase : rosAwayBase)));
  const pickedNormScore = pickSide === 'home' ? normHomeScore : normAwayScore;
  const conf = Math.min(99, Math.max(8, Math.round(pickedNormScore + liveShift)));
  const pickedTeam = pickSide === 'home' ? game.home : game.away, pRec = parseRecord(pickedTeam.record);
  const nextRecStr = pRec && game.state !== 'post' ? ` → ${pRec.w + 1}-${pRec.l}` : '';
  let grade = null;
  if (game.state === 'post') { const aS = Number(game.away.score || 0), hS = Number(game.home.score || 0); if (aS !== hS) grade = (hS > aS ? 'home' : 'away') === pickSide ? 'WON' : 'LOST'; }

  return {
    ...game, activeW, pickSide, pickedTeam, pickLabel: `${pickedTeam.short || pickedTeam.name} Win${nextRecStr}`,
    confidence: conf, hitsCount: primaryHits.length, primaryHits, gemScore, h2hScore, normH2HPick, rosScore,
    homeSplitPct: Math.round(hSpPct * 100), awaySplitPct: Math.round(aSpPct * 100),
    isUnderdogPick, dogGateTriggered, homeB2B, awayB2B, pickLineMove, injuryPenalty, oppInjuryBonus,
    fairProbPick: Math.round((pickSide === 'home' ? fairHomeProb : (1 - fairHomeProb)) * 100),
    hasScaledOdds, fightIQ, homeCutGauge, awayCutGauge, homeForm, awayForm, gradedInjuries, allLeaders,
    liveShift, liveEvents, grade, entitiesCount: entities.length
  };
}

// --- DEEP LINKING & FETCHERS ---
function openSportsbook(bookKey, gameLink) {
  const info = SPORTSBOOK_LINKS[bookKey] || { web: 'https://www.google.com/search?q=' + encodeURIComponent(bookKey + ' sportsbook') };
  const targetUrl = (gameLink && gameLink.startsWith('http')) ? gameLink : info.web;
  if (/Android/i.test(navigator.userAgent || '') && info.pkg) {
    window.location.href = `intent://${targetUrl.replace(/^https?:\/\//i, '')}#Intent;scheme=https;package=${info.pkg};S.browser_fallback_url=${encodeURIComponent(`https://play.google.com/store/apps/details?id=${info.pkg}`)};end`;
  } else window.open(targetUrl, '_blank');
}
function openAppStore(e, bookKey) {
  e.stopPropagation(); const info = SPORTSBOOK_LINKS[bookKey]; if (!info) return;
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent || '') && info.ios) window.location.href = info.ios; else window.open(info.web, '_blank');
}
function updateCreditsHeader(res) { const rem = res.headers.get('x-requests-remaining'); if (rem !== null) { const el = document.getElementById('credits-badge'); if (el) el.textContent = `(${rem} credits left)`; } }

async function fetchOddsForSport(sportKey) {
  if (!oddsApiKey || !sportKey) return [];
  const cached = oddsSportCache[sportKey]; if (cached && (Date.now() - cached.ts < 600000)) return cached.data;
  try {
    const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${encodeURIComponent(oddsApiKey)}&regions=us,us2,us_ex&markets=h2h&oddsFormat=american&includeLinks=true`);
    updateCreditsHeader(res); if (!res.ok) return [];
    const data = await res.json(); oddsSportCache[sportKey] = { ts: Date.now(), data: Array.isArray(data) ? data : [] }; return oddsSportCache[sportKey].data;
  } catch { return []; }
}
async function loadPropsForSelectedGame() {
  const g = allGames.find(x => x.id === selectedGameId); if (!g) return;
  const markets = LEAGUES.find(l => l.key === g.league)?.propMarkets; if (!markets) return;
  if (!oddsApiKey) { propsEventCache[g.id] = { error: 'Live Player Props require an active Odds proxy session.' }; renderDetailTab(); return; }
  const oddsEv = g.oddsEventDirect || matchGameInOdds(g, oddsSportCache[g.oddsKey]?.data || await fetchOddsForSport(g.oddsKey));
  if (!oddsEv?.id) { propsEventCache[g.id] = { error: 'No matching live sportsbook event found for player props.' }; renderDetailTab(); return; }
  document.getElementById('detail-body').innerHTML = '<div class="empty-state">Fetching live Player Props &amp; DFS (PrizePicks / Underdog)...</div>';
  try {
    const res = await fetch(`https://api.the-odds-api.com/v4/sports/${g.oddsKey}/events/${oddsEv.id}/odds?apiKey=${encodeURIComponent(oddsApiKey)}&regions=us,us_dfs&markets=${markets}&oddsFormat=american&includeLinks=true`);
    updateCreditsHeader(res); propsEventCache[g.id] = res.ok ? { data: await res.json() } : { error: 'Player props are not posted yet for this matchup.' };
  } catch { propsEventCache[g.id] = { error: 'Could not connect to Player Props feed.' }; }
  if (selectedGameId === g.id) renderDetailTab();
}
function matchGameInOdds(game, events) {
  if (!events || !events.length) return null;
  const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const hF = norm(game.home.name), aF = norm(game.away.name), hS = norm(game.home.mascot || game.home.short), aS = norm(game.away.mascot || game.away.short);
  return events.find(ev => { const eh = norm(ev.home_team), ea = norm(ev.away_team); return (eh.includes(hS) && ea.includes(aS)) || (eh.includes(aS) && ea.includes(hS)) || (eh === hF && ea === aF); });
}
async function fetchTeamSchedule(path, teamId) {
  if (!path || !teamId) return null; const key = `${path}_${teamId}`; if (scheduleCache[key]) return scheduleCache[key];
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/teams/${teamId}/schedule`); if (!res.ok) return null;
    const data = await res.json();
    const last10 = (data.events || []).filter(ev => ev.competitions?.[0]?.status?.type?.completed).slice(-10).map(ev => {
      const comp = ev.competitions[0], me = comp.competitors.find(c => String(c.id) === String(teamId)), opp = comp.competitors.find(c => String(c.id) !== String(teamId));
      const myS = Number(me?.score?.value ?? me?.score ?? 0), oppS = Number(opp?.score?.value ?? opp?.score ?? 0);
      return { won: Boolean(me?.winner) || myS > oppS, margin: myS - oppS, opp: opp?.team?.abbreviation || 'OPP', score: `${myS}-${oppS}` };
    });
    scheduleCache[key] = last10; return last10;
  } catch { return null; }
}

async function fetchYesterdayB2B(dateObj) {
  const prev = new Date(dateObj);
  prev.setDate(prev.getDate() - 1);
  const ymd = fmtYYYYMMDD(prev);
  const b2bSet = new Set();
  await Promise.all(LEAGUES.filter(l => B2B_LEAGUES.has(l.key)).map(async lg => {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${lg.path}/scoreboard?dates=${ymd}`);
      if (!res.ok) return;
      const data = await res.json();
      (data.events || []).forEach(ev => {
        (ev.competitions?.[0]?.competitors || []).forEach(c => {
          const tid = String(c.team?.id || c.id || '');
          if (tid) b2bSet.add(`${lg.key}_${tid}`);
        });
      });
    } catch {}
  }));
  yesterdayTeamsSet = b2bSet;
}

function fmtYYYYMMDD(d) { return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; }
function fmtISODate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function isSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

async function loadSlate(silent = false) {
  if (!silent) { document.getElementById('live-count-badge').textContent = 'Syncing...'; document.getElementById('games-feed').innerHTML = '<div class="empty-state">Scanning 14 sports, fair odds, B2B rest, splits &amp; Fight IQ...</div>'; }
  updateDateUI(); const ymd = fmtYYYYMMDD(currentDate), dm = getDateMath(currentDate);

  const [espnResults] = await Promise.all([
    Promise.all(LEAGUES.map(async lg => {
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${lg.path}/scoreboard?dates=${ymd}`); if (!res.ok) return [];
        const data = await res.json();
        return (data.events || []).map(ev => {
          const comp = ev.competitions?.[0]; if (!comp || !comp.competitors || comp.competitors.length < 2) return null;
          const home = comp.competitors.find(c => c.homeAway === 'home') || comp.competitors[0], away = comp.competitors.find(c => c.homeAway === 'away') || comp.competitors[1];
          const state = comp.status?.type?.state || 'pre', timeStr = comp.status?.type?.shortDetail || new Date(ev.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          const getRec = (o, t) => (o.records || []).find(r => r.type === t)?.summary || '', oddsObj = comp.odds?.[0];
          const hShort = home.team?.shortDisplayName || home.athlete?.shortName || home.team?.name || 'Home', aShort = away.team?.shortDisplayName || away.athlete?.shortName || away.team?.name || 'Away';
          const hId = String(home.team?.id || home.athlete?.id || home.id || '');
          const aId = String(away.team?.id || away.athlete?.id || away.id || '');
          const hHeadshot = home.athlete?.headshot?.href || home.athlete?.headshot || (FIGHT_LEAGUES.has(lg.key) ? buildEspnHeadshotUrl('UFC', hId) : '');
          const aHeadshot = away.athlete?.headshot?.href || away.athlete?.headshot || (FIGHT_LEAGUES.has(lg.key) ? buildEspnHeadshotUrl('UFC', aId) : '');
          return {
            id: ev.id, league: lg.key, path: lg.path, oddsKey: lg.oddsKey, state, time: timeStr,
            venue: comp.venue?.fullName || 'TBD Venue', venueCity: [comp.venue?.address?.city, comp.venue?.address?.state].filter(Boolean).join(', '),
            broadcast: comp.broadcasts?.[0]?.names?.[0] || comp.geoBroadcasts?.[0]?.media?.shortName || '', eventNote: comp.notes?.[0]?.headline || '',
            oddsText: oddsObj?.details || '', oddsFav: oddsObj?.homeTeamOdds?.favorite ? 'home' : (oddsObj?.awayTeamOdds?.favorite ? 'away' : null),
            homeML: typeof oddsObj?.homeTeamOdds?.moneyLine === 'number' ? oddsObj.homeTeamOdds.moneyLine : null,
            awayML: typeof oddsObj?.awayTeamOdds?.moneyLine === 'number' ? oddsObj.awayTeamOdds.moneyLine : null,
            leaders: [...extractLeadersFromArr(home.leaders, hShort, 'home'), ...extractLeadersFromArr(away.leaders, aShort, 'away')],
            home: { id: hId, name: home.team?.displayName || home.athlete?.displayName || 'Home', short: hShort, location: home.team?.location || '', mascot: home.team?.name || home.athlete?.displayName || '', logo: home.team?.logo || '', headshot: hHeadshot, score: home.score ?? '', record: getRec(home, 'total') || home.records?.[0]?.summary || '', homeRecord: getRec(home, 'home') },
            away: { id: aId, name: away.team?.displayName || away.athlete?.displayName || 'Away', short: aShort, location: away.team?.location || '', mascot: away.team?.name || away.athlete?.displayName || '', logo: away.team?.logo || '', headshot: aHeadshot, score: away.score ?? '', record: getRec(away, 'total') || away.records?.[0]?.summary || '', roadRecord: getRec(away, 'road') }
          };
        }).filter(Boolean);
      } catch { return []; }
    })),
    fetchYesterdayB2B(currentDate)
  ]);

  let fightGames = [];
  if (oddsApiKey && isSameDay(currentDate, new Date())) {
    fightGames = (await fetchOddsForSport('boxing_boxing')).slice(0, 12).map(ev => {
      const dt = new Date(ev.commence_time);
      return {
        id: `odds_${ev.id}`, league: /bkfc|bare knuckle/i.test(ev.sport_title || '') ? 'BKFC' : 'BOXING', path: null, oddsKey: 'boxing_boxing',
        oddsEventDirect: ev, state: 'pre', time: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        venue: ev.sport_title || 'Fight Card', venueCity: '', broadcast: 'PPV / Live', eventNote: ev.sport_title || '',
        oddsText: `${ev.bookmakers?.length || 0} Sportsbooks Live`, oddsFav: null, homeML: null, awayML: null, leaders: [],
        home: { id: '', name: ev.home_team, short: ev.home_team, location: '', mascot: ev.home_team, logo: '', headshot: '', score: '', record: '', homeRecord: '' },
        away: { id: '', name: ev.away_team, short: ev.away_team, location: '', mascot: ev.away_team, logo: '', headshot: '', score: '', record: '', roadRecord: '' }
      };
    });
  }

  const espnFlat = espnResults.flat();
  if (silent && espnFlat.length === 0 && allGames.length > 0) return;

  allGames = [...espnFlat, ...fightGames].map(g => evaluateGame(g, dm));
  window.allGames = allGames;
  renderSportsBar(); renderFeed(); setupLivePolling();
  const liveGames = allGames.filter(g => g.state === 'in' && g.path).slice(0, 8);
  if (liveGames.length) { await Promise.all(liveGames.map(g => fetchGameSummary(g, true))); renderFeed(); }
}

function setupLivePolling() {
  if (livePollTimer) clearInterval(livePollTimer);
  if (allGames.some(g => g.state === 'in') && isSameDay(currentDate, new Date())) livePollTimer = setInterval(() => { if (!document.hidden) loadSlate(true); }, 30000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && localStorage.getItem('aligniq_user')) setTimeout(() => loadSlate(true), 500); });

async function fetchGameSummary(game, silent = false) {
  if (!game.path) return null;
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${game.path}/summary?event=${game.id}`); if (!res.ok) return null;
    const data = await res.json();
    const officials = (data.gameInfo?.officials || []).map(o => o.displayName || o.fullName).filter(Boolean);
    const homeId = String(data.header?.competitions?.[0]?.competitors?.find(c => c.homeAway === 'home')?.id || '');
    const leaders = [];
    (data.leaders || []).forEach(tl => {
      const side = String(tl.team?.id || '') === homeId ? 'home' : 'away';
      leaders.push(...extractLeadersFromArr(tl.leaders, tl.team?.shortDisplayName || (side === 'home' ? game.home.short : game.away.short), side));
    });
    const injuries = (data.injuries || []).flatMap(ti => {
      const side = String(ti.team?.id || '') === homeId ? 'home' : 'away';
      return (ti.injuries || []).slice(0, 8).map(inj => ({ team: ti.team?.shortDisplayName || '', teamSide: side, athleteId: String(inj.athlete?.id || ''), player: inj.athlete?.displayName || 'Player', status: inj.status || 'Listed', detail: inj.shortComment || inj.longComment || '' }));
    });
    const liveHomeWP = Array.isArray(data.winprobability) && data.winprobability.length ? data.winprobability[data.winprobability.length - 1].homeWinPercentage : null;
    const liveEvents = [];
    (data.plays || data.keyEvents || []).slice(-15).reverse().forEach(p => {
      const txt = p.text || p.shortText || ''; if (!txt) return;
      const clock = `${p.period?.displayValue || (p.period?.number ? `P${p.period.number}` : '')} ${p.clock?.displayValue || ''}`.trim();
      let tag = null, impact = 0;
      if (/injury|injured/i.test(txt)) { tag = 'INJURY'; impact = -3; }
      else if (/red card|ejected|flagrant|technical/i.test(txt)) { tag = 'MAJOR FOUL'; impact = -3; }
      else if (/foul|penalty|yellow card/i.test(txt)) { tag = 'FOUL/PEN'; impact = -1; }
      else if (/turnover|interception|fumble|steal/i.test(txt)) { tag = 'TURNOVER'; impact = -2; }
      else if (/touchdown|goal|three point|home run/i.test(txt)) { tag = 'BIG SCORE'; impact = 2; }
      if (tag && liveEvents.length < 6) liveEvents.push({ tag, clock, text: txt, impact });
    });
    let news = data.news?.articles?.length ? data.news.articles : (data.article ? [data.article] : []);
    if (!news.length) {
      if (!leagueNewsCache[game.path]) { try { const nr = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${game.path}/news?limit=25`); if (nr.ok) leagueNewsCache[game.path] = (await nr.json()).articles || []; } catch {} }
      const pool = leagueNewsCache[game.path] || [], k1 = (game.away.mascot || game.away.short || '').toLowerCase(), k2 = (game.home.mascot || game.home.short || '').toLowerCase();
      news = pool.filter(a => `${a.headline || ''} ${a.description || ''}`.toLowerCase().includes(k1) || `${a.headline || ''} ${a.description || ''}`.toLowerCase().includes(k2)).slice(0, 6);
      if (!news.length) news = pool.slice(0, 4);
    }
    summaryCache[game.id] = { officials, leaders, injuries, liveHomeWP, liveEvents, news: news.map(a => ({ headline: a.headline || 'ESPN Story', description: a.description || '', url: a.links?.web?.href || a.links?.mobile?.href || 'https://www.espn.com', published: a.published ? new Date(a.published).toLocaleDateString() : '' })) };
    if (!silent && selectedGameId === game.id) { renderFeed(); renderDetailTab(); }
    return summaryCache[game.id];
  } catch { return null; }
}

// --- UI RENDERING ---
function updateDateUI() {
  const today = new Date(), isToday = isSameDay(currentDate, today);
  const shortFmt = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), fullFmt = currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  document.getElementById('date-display').textContent = isToday ? `Today · ${shortFmt}` : fullFmt;
  document.getElementById('today-btn').style.display = isToday ? 'none' : 'inline-block';
  document.getElementById('date-picker').value = fmtISODate(currentDate);
  document.getElementById('auth-date-badge').textContent = `LIVE SLATE · ${fullFmt.toUpperCase()}`;
  document.getElementById('dm-pills').innerHTML = getDateMath(currentDate).nums.map(n => `<span class="dm-pill">${n}</span>`).join('');
  document.getElementById('saved-count').textContent = savedIds.size;
  const keyInp = document.getElementById('odds-api-key');
  if (keyInp) keyInp.value = oddsApiKey;
}
function renderSportsBar() {
  const counts = {}; allGames.forEach(g => { counts[g.league] = (counts[g.league] || 0) + 1; });
  const activeLeagues = Object.keys(counts); if (activeSport !== 'All' && !counts[activeSport]) activeSport = 'All';
  document.getElementById('sports-bar').innerHTML = `<button class="sport-pill ${activeSport === 'All' ? 'active' : ''}" onclick="setSport('All')">All <span class="sport-count">${allGames.length}</span></button>` + activeLeagues.map(lg => `<button class="sport-pill ${activeSport === lg ? 'active' : ''}" onclick="setSport('${lg}')">${lg} <span class="sport-count">${counts[lg]}</span></button>`).join('');
  document.getElementById('live-count-badge').textContent = `${allGames.length} Games · ${activeLeagues.length} Sports`;
}

// Tiered Animated Underdog Emblems
function renderUnderdogEmblem(g) {
  if (!g.isUnderdogPick) return '';
  if (g.confidence >= 70) return `<span class="dog-emblem tier-3">👑 APEX DOG</span>`;
  if (g.confidence >= 60) return `<span class="dog-emblem tier-2">⚡ SHARP DOG</span>`;
  return `<span class="dog-emblem tier-1">🐶 LIVE DOG</span>`;
}

function renderFeed() {
  const dm = getDateMath(currentDate); allGames = allGames.map(g => evaluateGame(g, dm));
  window.allGames = allGames;
  const graded = allGames.filter(g => g.grade), banner = document.getElementById('accuracy-banner');
  if (graded.length) {
    const wins = graded.filter(g => g.grade === 'WON').length;
    document.getElementById('acc-record').textContent = `Graded Picks: ${wins}–${graded.length - wins}`;
    document.getElementById('acc-pct').textContent = `${Math.round((wins / graded.length) * 100)}%`;
    banner.classList.add('show');
  } else banner.classList.remove('show');

  const q = (document.getElementById('search-input').value || '').trim().toLowerCase();
  let list = activeSport === 'All' ? allGames : allGames.filter(g => g.league === activeSport);
  if (filterMode === 'upcoming') list = list.filter(g => g.state === 'pre');
  else if (filterMode === 'live') list = list.filter(g => g.state === 'in');
  else if (filterMode === 'high') list = list.filter(g => g.confidence >= 70);
  else if (filterMode === 'gem') list = list.filter(g => g.hitsCount >= 2);
  if (q) list = list.filter(g => `${g.away.name} ${g.home.name} ${g.venue} ${g.broadcast} ${g.league}`.toLowerCase().includes(q));
  list = list.sort((a, b) => b.confidence - a.confidence);

  const feed = document.getElementById('games-feed');
  if (!list.length) { feed.innerHTML = '<div class="empty-state">No games match this filter. Try another date, filter, or use <strong>Custom Scan</strong>.</div>'; return; }

  feed.innerHTML = list.map(g => {
    const tier = g.confidence >= 70 ? 'high' : g.confidence >= 52 ? 'mid' : 'low', barColor = tier === 'high' ? '#00d285' : tier === 'mid' ? '#f59e0b' : '#64748b';
    const isSaved = savedIds.has(g.id), showScore = g.state === 'in' || g.state === 'post', isFight = FIGHT_LEAGUES.has(g.league);
    let flashClass = '';
    if (g.state === 'in' && prevConfMap[g.id] !== undefined && g.confidence !== prevConfMap[g.id]) flashClass = g.confidence > prevConfMap[g.id] ? 'flash-up' : 'flash-down';
    prevConfMap[g.id] = g.confidence;

    const awayMedia = isFight ? renderAvatar(g.away.name, g.away.headshot, 26) : (g.away.logo ? `<img class="team-logo" src="${g.away.logo}" alt="" />` : '');
    const homeMedia = isFight ? renderAvatar(g.home.name, g.home.headshot, 26) : (g.home.logo ? `<img class="team-logo" src="${g.home.logo}" alt="" />` : '');

    return `
      <div class="game-card ${g.state === 'in' ? 'is-live' : ''}" onclick="openGameDetail('${g.id}')">
        <div class="card-top">
          <div class="card-meta">
            <span class="league-tag">${g.league}</span>
            ${g.state === 'in' ? `<span class="live-tag"><span class="pulse-dot red"></span>LIVE</span>` : ''}
            ${g.grade ? `<span class="grade-tag ${g.grade.toLowerCase()}">${g.grade}</span>` : ''}
            <span class="meta-text">${g.time}</span>
          </div>
          <div class="card-top-right">
            <span class="hits-tag ${g.hitsCount < 2 ? 'muted' : ''}">${g.hitsCount >= 2 ? `${g.hitsCount} Hits` : `< 2 Refs`}</span>
            <button class="star-btn ${isSaved ? 'saved' : ''}" onclick="toggleSave(event, '${g.id}')">${isSaved ? '★' : '☆'}</button>
          </div>
        </div>
        <div class="card-mid">
          <div class="teams-col">
            <div class="team-row">
              <div class="team-left"><span class="pick-dot ${g.pickSide === 'away' ? 'active' : ''}"></span>${awayMedia}<span class="team-name">${g.away.name}${g.awayB2B ? ' <span style="font-size:10px;color:#f59e0b;font-weight:800;">B2B</span>' : ''}</span></div>
              <div class="team-right"><span class="team-rec">${g.away.record || '—'}</span>${showScore ? `<span class="team-score">${g.away.score}</span>` : ''}</div>
            </div>
            <div class="team-row">
              <div class="team-left"><span class="pick-dot ${g.pickSide === 'home' ? 'active' : ''}"></span>${homeMedia}<span class="team-name">${g.home.name}${g.homeB2B ? ' <span style="font-size:10px;color:#f59e0b;font-weight:800;">B2B</span>' : ''}</span></div>
              <div class="team-right"><span class="team-rec">${g.home.record || '—'}</span>${showScore ? `<span class="team-score">${g.home.score}</span>` : ''}</div>
            </div>
          </div>
          <div class="conf-box ${tier} ${flashClass}"><span class="conf-num">${g.confidence}%</span><span class="conf-lbl">CONF</span></div>
        </div>
        <div class="card-sub-info"><span>${g.venue}${g.broadcast ? ' · ' + g.broadcast : ''}</span><span>${g.oddsText || ''}</span></div>
        <div class="card-foot"><span class="pick-text ${tier === 'high' ? 'high' : ''}">Pick: ${g.pickLabel}${renderUnderdogEmblem(g)}</span><span class="decode-link">Scales, +EV &amp; Sources ›</span></div>
        <div class="meter-track"><div class="meter-fill ${flashClass}" style="width:${g.confidence}%;background:${barColor};"></div></div>
      </div>
    `;
  }).join('');
}

// --- ALGO VISUALS & DIAGRAMS (AI EDGE TAB) ---
function renderAlgoVisuals(g) {
  const w = g.activeW || PHASE4_DEFAULT_WEIGHTS;
  const gateStatus = g.isUnderdogPick
    ? { label: 'LIVE UNDERDOG PASSED', color: '#00d285', desc: 'Close market + multi-signal confirmation unlocked.' }
    : g.dogGateTriggered
    ? { label: 'LONGSHOT BLOCKED', color: '#f59e0b', desc: 'Gate prevented low-conviction underdog flip; favorite held.' }
    : { label: 'MARKET FAVORITE ALIGNED', color: '#38bdf8', desc: 'Normalized pillars agree with market favorite.' };

  const moveColor = g.pickLineMove >= 3 ? '#00d285' : g.pickLineMove <= -3 ? '#ef4444' : '#8b95a5';
  const moveText = g.pickLineMove > 0 ? `+${g.pickLineMove}% Sharp Steam` : g.pickLineMove < 0 ? `${g.pickLineMove}% Drift` : 'Flat (0%)';

  return `
    <div style="background:rgba(15,23,42,0.85);border:1px solid rgba(56,189,248,0.28);border-radius:14px;padding:12px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <strong style="font-size:12px;color:#38bdf8;">⚖️ ${g.league} Normalized Pillar Scale</strong>
        <span style="font-size:10px;color:#8b95a5;">${w.gem}% Signals · ${w.h2h}% Odds · ${w.ros}% Form</span>
      </div>
      <div style="display:flex;height:9px;border-radius:999px;overflow:hidden;background:#1e293b;margin-bottom:10px;">
        <div style="width:${w.gem}%;background:#a78bfa;"></div>
        <div style="width:${w.h2h}%;background:#38bdf8;"></div>
        <div style="width:${w.ros}%;background:#00d285;"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center;font-size:11px;">
        <div style="background:#06090f;border-radius:8px;padding:6px;border:1px solid #1e293b;">
          <div style="color:#a78bfa;font-weight:800;">${g.gemScore}</div><div style="color:#8b95a5;font-size:9.5px;">Signals</div>
        </div>
        <div style="background:#06090f;border-radius:8px;padding:6px;border:1px solid #1e293b;">
          <div style="color:#38bdf8;font-weight:800;">${g.normH2HPick}</div><div style="color:#8b95a5;font-size:9.5px;">Norm Odds</div>
        </div>
        <div style="background:#06090f;border-radius:8px;padding:6px;border:1px solid #1e293b;">
          <div style="color:#00d285;font-weight:800;">${g.rosScore}</div><div style="color:#8b95a5;font-size:9.5px;">Form/Rest</div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
      <div style="background:rgba(15,23,42,0.85);border:1px solid #1e2d47;border-radius:12px;padding:10px;">
        <div style="font-size:10px;color:#8b95a5;font-weight:700;margin-bottom:6px;">🏟️ HOME / ROAD SPLITS</div>
        <div style="font-size:11px;display:flex;justify-content:space-between;"><span>${g.home.short} (Home)</span><strong>${g.homeSplitPct}%</strong></div>
        <div style="height:5px;background:#1e293b;border-radius:999px;margin:3px 0 6px;overflow:hidden;"><div style="height:100%;width:${g.homeSplitPct}%;background:#38bdf8;"></div></div>
        <div style="font-size:11px;display:flex;justify-content:space-between;"><span>${g.away.short} (Road)</span><strong>${g.awaySplitPct}%</strong></div>
        <div style="height:5px;background:#1e293b;border-radius:999px;margin-top:3px;overflow:hidden;"><div style="height:100%;width:${g.awaySplitPct}%;background:#a78bfa;"></div></div>
      </div>
      <div style="background:rgba(15,23,42,0.85);border:1px solid #1e2d47;border-radius:12px;padding:10px;">
        <div style="font-size:10px;color:#8b95a5;font-weight:700;margin-bottom:6px;">⚡ LINE MOVE &amp; REST</div>
        <div style="font-size:11px;margin-bottom:6px;">Steam: <strong style="color:${moveColor};">${moveText}</strong></div>
        <div style="font-size:11px;">Rest: <strong>${g.homeB2B ? `${g.home.short} B2B (-6)` : g.awayB2B ? `${g.away.short} B2B (-6)` : 'Both Rested'}</strong></div>
      </div>
    </div>

    <div style="background:rgba(15,23,42,0.85);border:1px solid ${gateStatus.color};border-radius:12px;padding:10px;margin-bottom:10px;">
      <strong style="font-size:11px;color:${gateStatus.color};">🛡️ UNDERDOG GATE: ${gateStatus.label}</strong>
      <div style="font-size:11px;color:#cbd5e1;margin-top:3px;">${gateStatus.desc}</div>
    </div>
  `;
}

// --- DETAIL MODAL ---
async function openGameDetail(id) {
  selectedGameId = id; oddsViewSide = 'pick';
  const g = allGames.find(x => x.id === id); if (!g) return;
  document.getElementById('detail-title').textContent = `${g.away.short} @ ${g.home.short}`;
  document.getElementById('tab-ros-btn').textContent = FIGHT_LEAGUES.has(g.league) ? 'Fight IQ' : 'Health';
  document.getElementById('detail-modal').classList.add('open');
  currentTab = 'odds';
  document.querySelectorAll('#detail-tabs .tab-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  renderDetailTab();

  const tasks = [g.oddsKey ? fetchOddsForSport(g.oddsKey) : Promise.resolve(), g.path ? fetchGameSummary(g, false) : Promise.resolve()];
  if (g.path && !FIGHT_LEAGUES.has(g.league)) { if (g.home?.id) tasks.push(fetchTeamSchedule(g.path, g.home.id)); if (g.away?.id) tasks.push(fetchTeamSchedule(g.path, g.away.id)); }
  await Promise.all(tasks);
  if (selectedGameId === id) { renderFeed(); renderDetailTab(); }
}
function switchTab(tab, btn) { currentTab = tab; document.querySelectorAll('#detail-tabs .tab-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderDetailTab(); }
function setOddsSide(side) { oddsViewSide = side; renderDetailTab(); }
function saveExtraContext(id) { customContextMap[id] = { artist: document.getElementById('ctx-artist').value.trim(), song: document.getElementById('ctx-song').value.trim(), extra: document.getElementById('ctx-extra').value.trim() }; localStorage.setItem('aligniq_ctx', JSON.stringify(customContextMap)); renderFeed(); renderDetailTab(); }
function saveFightIntel(id) { fightIntelMap[id] = { awayCutPen: Number(document.getElementById('fi-away-cut').value || 0), awayInjPen: Number(document.getElementById('fi-away-inj').value || 0), homeCutPen: Number(document.getElementById('fi-home-cut').value || 0), homeInjPen: Number(document.getElementById('fi-home-inj').value || 0), notes: document.getElementById('fi-notes').value.trim() }; localStorage.setItem('aligniq_fight_intel', JSON.stringify(fightIntelMap)); renderFeed(); renderDetailTab(); }

function renderHitRateCard(title, games, srcIdx) {
  if (!games || !games.length) return '';
  const wins = games.filter(x => x.won).length, pct = Math.round((wins / games.length) * 100), cls = pct >= 65 ? 'green' : pct >= 45 ? 'yellow' : 'red';
  const maxM = Math.max(10, ...games.map(x => Math.abs(x.margin)));
  return `<div class="hr-card" onclick="triggerSource(${srcIdx}, event)"><div class="hr-top"><span class="hr-label">${title} (${wins}-${games.length - wins}) ↗</span><span class="hr-pct ${cls}">${pct}%</span></div><div class="hr-bars">${games.map(x => `<div class="hr-bar-col"><div class="hr-bar ${x.won ? 'w' : 'l'}" style="height:${Math.max(18, Math.min(100, Math.round((Math.abs(x.margin) / maxM) * 100)))}%"></div><span class="hr-bar-lbl">${x.won ? 'W' : 'L'}</span></div>`).join('')}</div></div>`;
}

function findPlayerHeadshot(playerName, game) {
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  const target = norm(playerName);
  const leader = (game.allLeaders || []).find(l => norm(l.name) === target || norm(l.name).includes(target) || target.includes(norm(l.name)));
  if (leader?.headshot) return leader.headshot;
  if (leader?.id) return buildEspnHeadshotUrl(game.league, leader.id);
  return '';
}

function renderDetailTab() {
  sourceRegistry = [];
  const g = allGames.find(x => x.id === selectedGameId); if (!g) return;
  const sum = summaryCache[g.id], ctx = customContextMap[g.id] || { artist: '', song: '', extra: '' }, body = document.getElementById('detail-body');
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || ''), gameSrcUrl = espnGameUrl(g);
  const oddsEv = g.oddsEventDirect || matchGameInOdds(g, oddsSportCache[g.oddsKey]?.data || []);
  const oddsAnalysis = analyzeOddsEvent(oddsEv, g.home, g.away);

  if (currentTab === 'odds') {
    const oppSide = g.pickSide === 'home' ? 'away' : 'home', oppTeam = oppSide === 'home' ? g.home : g.away;
    const showHome = (oddsViewSide === 'pick' && g.pickSide === 'home') || (oddsViewSide === 'opp' && oppSide === 'home');
    const rows = showHome ? oddsAnalysis.homeRows : oddsAnalysis.awayRows, fairProb = Math.round((showHome ? oddsAnalysis.fairHome : oddsAnalysis.fairAway) * 100);
    const openedPrice = oddsAnalysis.opened ? (showHome ? oddsAnalysis.opened.home : oddsAnalysis.opened.away) : null;
    const arbHtml = oddsAnalysis.arb ? `<div class="proof-item arb-box"><strong>⚡ ARBITRAGE FOUND (+${oddsAnalysis.arb.roi.toFixed(2)}% Guaranteed ROI)</strong><div class="proof-sub">Bet $${oddsAnalysis.arb.stakeHome.toFixed(0)} on ${g.home.short} (${oddsAnalysis.arb.homeBook} ${oddsAnalysis.arb.homePrice > 0 ? '+' : ''}${oddsAnalysis.arb.homePrice}) &amp; $${oddsAnalysis.arb.stakeAway.toFixed(0)} on ${g.away.short} (${oddsAnalysis.arb.awayBook} ${oddsAnalysis.arb.awayPrice > 0 ? '+' : ''}${oddsAnalysis.arb.awayPrice}) → +$${oddsAnalysis.arb.profit100.toFixed(2)} guaranteed profit.</div></div>` : '';
    const emptyMsg = `<div class="proof-item warn"><strong>No Live Multi-Book Lines Found Yet</strong><div class="proof-sub">This game may be finished or off the board.</div></div>`;
    const listHtml = rows.length ? rows.map((r, idx) => {
      const safeLink = (r.link || '').replace(/'/g, ''), hasIosApp = Boolean(SPORTSBOOK_LINKS[r.key]?.ios);
      const evBadge = r.ev >= 0.5 ? `<span class="ev-badge">+${r.ev.toFixed(1)}% EV</span>` : '';
      const moveBadge = (openedPrice && openedPrice !== r.price && idx === 0) ? `<span class="move-badge">Open ${openedPrice > 0 ? '+' + openedPrice : openedPrice} → Now ${r.price > 0 ? '+' + r.price : r.price}</span>` : '';
      const subHtml = (isIOS && hasIosApp) ? `<button class="get-app-btn" onclick="openAppStore(event, '${r.key}')">Get App</button><span>Implied ${r.cents}¢ · Fair ${fairProb}¢</span>` : `<span>Tap to open game · Implied ${r.cents}¢ · Fair ${fairProb}¢</span>`;
      return `<div class="book-row ${idx === 0 ? 'best' : ''}" onclick="openSportsbook('${r.key}', '${safeLink}')"><div class="book-left"><div class="book-name">${r.title}${idx === 0 ? '<span class="best-badge">BEST PAYOUT</span>' : ''}${evBadge}${moveBadge}</div><div class="book-sub">${subHtml}</div></div><div class="book-right"><div class="book-odds">${r.price > 0 ? '+' + r.price : r.price}</div><div class="book-payout">+$${r.profit100.toFixed(0)} on $100</div></div></div>`;
    }).join('') : emptyMsg;
    body.innerHTML = `<div class="odds-toggle"><button class="odds-side-btn ${oddsViewSide === 'pick' ? 'active' : ''}" onclick="setOddsSide('pick')">Pick: ${g.pickedTeam.short}</button><button class="odds-side-btn ${oddsViewSide === 'opp' ? 'active' : ''}" onclick="setOddsSide('opp')">Opp: ${oppTeam.short}</button></div>${arbHtml}${listHtml}`;
  } else if (currentTab === 'props') {
    if (!LEAGUES.find(l => l.key === g.league)?.propMarkets) { body.innerHTML = `<div class="proof-item warn"><strong>Player Props Not Available for ${g.league}</strong><div class="proof-sub">On-demand Player Props &amp; DFS are supported for NBA, NFL, NHL, MLB, NCAAF, NCAAB &amp; WNBA.</div></div>`; return; }
    const cached = propsEventCache[g.id];
    if (!cached) { body.innerHTML = `<div class="proof-item"><strong>On-Demand Player Props &amp; DFS</strong><div class="proof-sub">Pulls live player lines from DraftKings, FanDuel, BetMGM, PrizePicks, Underdog &amp; ParlayPlay on demand.</div></div><button class="primary-btn" onclick="loadPropsForSelectedGame()">Load Live Player Props &amp; DFS</button>`; return; }
    if (cached.error) { body.innerHTML = `<div class="proof-item warn"><strong>${cached.error}</strong></div><button class="secondary-btn" onclick="delete propsEventCache['${g.id}']; loadPropsForSelectedGame();">Retry</button>`; return; }
    const propRows = [];
    (cached.data?.bookmakers || []).forEach(bm => (bm.markets || []).forEach(mkt => (mkt.outcomes || []).forEach(out => {
      if (out.name === 'Over' || out.name === 'Yes') propRows.push({ player: out.description || 'Player', market: mkt.key.replace(/^player_|^batter_|^pitcher_/, '').replace(/_/g, ' ').toUpperCase(), point: out.point ?? '', side: out.name, price: out.price, profit100: americanToProfit100(out.price), bookKey: bm.key, bookTitle: bm.title, link: out.link || mkt.link || bm.link || '' });
    })));
    propRows.sort((a, b) => b.profit100 - a.profit100);
    body.innerHTML = propRows.length ? propRows.slice(0, 35).map(p => {
      const avatar = renderAvatar(p.player, findPlayerHeadshot(p.player, g), 34);
      return `<div class="book-row" onclick="openSportsbook('${p.bookKey}', '${(p.link || '').replace(/'/g, '')}')"><div class="book-left" style="display:flex;align-items:center;gap:10px;">${avatar}<div style="min-width:0;"><div class="book-name">${p.player} <span class="ev-badge">${p.side} ${p.point} ${p.market}</span></div><div class="book-sub">${p.bookTitle} · Tap to open app</div></div></div><div class="book-right"><div class="book-odds">${p.price > 0 ? '+' + p.price : p.price}</div><div class="book-payout">+$${p.profit100.toFixed(0)} on $100</div></div></div>`;
    }).join('') : `<div class="proof-item warn"><strong>No Player Props Posted Yet</strong></div>`;
  } else if (currentTab === 'trends') {
    const sched = g.path && g.pickedTeam?.id ? scheduleCache[`${g.path}_${g.pickedTeam.id}`] : null, l5 = sched ? sched.slice(-5) : null, l10 = sched ? sched.slice(-10) : null;
    const schedLabel = FIGHT_LEAGUES.has(g.league) ? `${g.pickedTeam.name} Official Fighter Profile` : `${g.pickedTeam.name} Official Schedule & Scores`;
    const schedSrc = registerSources(`${g.pickedTeam.short} Verified Profile`, [{ platform: 'ESPN PROFILE', title: schedLabel, sub: 'Verified sport-specific record', url: espnTeamScheduleUrl(g, g.pickedTeam.id) }, { platform: 'ESPN MATCHUP', title: `${g.away.short} @ ${g.home.short} Gamecast`, sub: 'Live splits & boxscore', url: gameSrcUrl }]);
    const bullSrc = registerSources(`${g.pickedTeam.short} Matchup Proof`, [{ platform: 'ESPN GAMECAST', title: `${g.away.name} vs ${g.home.name}`, sub: 'Official records, odds & play-by-play', url: gameSrcUrl }, ...buildSocialAndNewsSources(`${g.pickedTeam.name} ${g.league}`, `matchup preview`, sum?.news)]);
    const bestRow = g.pickSide === 'home' ? oddsAnalysis.homeRows[0] : oddsAnalysis.awayRows[0], bulls = [], bears = [];
    if (g.isUnderdogPick) bulls.push(`Live Underdog passed the Agreement Gate (close market + confirmed form/sharp-move edge).`);
    if (g.dogGateTriggered) bulls.push(`Underdog Agreement Gate blocked a low-conviction longshot override and held the market favorite.`);
    if (g.pickLineMove >= 3) bulls.push(`Sharp Line Movement: ${g.pickedTeam.short}'s implied odds strengthened by +${g.pickLineMove}% since open.`);
    const pickB2B = g.pickSide === 'home' ? g.homeB2B : g.awayB2B, oppB2B = g.pickSide === 'home' ? g.awayB2B : g.homeB2B;
    if (oppB2B && !pickB2B) bulls.push(`Rest Advantage: Opponent is on a back-to-back (B2B) fatigue spot (-6 pt penalty applied).`);
    if (pickB2B && !oppB2B) bears.push(`Rest Risk: ${g.pickedTeam.short} is playing on a back-to-back (B2B) with a -6 pt fatigue deduction.`);
    if (g.hasScaledOdds) bulls.push(`Scaled No-Vig Fair Odds give ${g.pickedTeam.short} a ${g.fairProbPick}% consensus win probability (normalized in CONF %).`);
    if (g.hitsCount >= 2) bulls.push(`Strong Pattern Signal convergence (${g.hitsCount} matching references across 4 ciphers).`); else bears.push(`Signal threshold not met (${g.hitsCount}/2 hits) — relying on Normalized Fair Odds, Splits & Rest.`);
    if (bestRow && bestRow.ev >= 0.5) bulls.push(`Positive EV edge: ${bestRow.title} is paying +${bestRow.ev.toFixed(1)}% above fair market consensus.`);
    if (g.fightIQ?.hasData && g.fightIQ.edge !== 0) { const favSide = g.fightIQ.edge > 0 ? 'home' : 'away'; if (favSide === g.pickSide) bulls.push(`Fight IQ edge (+${Math.abs(g.fightIQ.edge)} pts) from striking defense, absorbed rate & reach.`); else bears.push(`Opponent holds a +${Math.abs(g.fightIQ.edge)} pt striking defense / reach advantage.`); }
    if (g.oppInjuryBonus >= 10) bulls.push(`Opponent missing key star production (+${g.oppInjuryBonus} pt health edge).`);
    if (g.injuryPenalty >= 10) bears.push(`Picked side has significant star/injury/cut risk (-${g.injuryPenalty} pt deduction).`);
    if (l5 && l5.filter(x => x.won).length >= 4) bulls.push(`${g.pickedTeam.short} is hot — won ${l5.filter(x => x.won).length} of their last ${l5.length} games.`);
    if (l5 && l5.filter(x => x.won).length <= 1) bears.push(`Recent form concern — ${g.pickedTeam.short} won only ${l5.filter(x => x.won).length} of their last ${l5.length}.`);
    if (!bulls.length) bulls.push(`Composite model (${g.confidence}%) favors ${g.pickedTeam.short} using ${g.league} league weights.`);
    if (!bears.length) bears.push(`Standard matchup variance — check live line movement in Best Odds before locking in.`);
    const chartsHtml = sched && sched.length ? `<div class="hr-grid">${renderHitRateCard(`${g.pickedTeam.short} Last 5`, l5, schedSrc.idx)}${renderHitRateCard(`${g.pickedTeam.short} Last 10`, l10, schedSrc.idx)}</div>` : `<div class="proof-item clickable-ref" onclick="triggerSource(${schedSrc.idx}, event)"><span class="src-chip">🔗 ${schedSrc.count} Sources</span><strong>Hit-Rate Form</strong><div class="proof-sub">${g.away.short} (${g.away.record || '—'}) vs ${g.home.short} (${g.home.record || '—'}) · Fair Win Prob: ${g.fairProbPick}%</div></div>`;
    const eventsHtml = g.liveEvents.map(ev => { const evSrc = registerSources(`Live Play: ${ev.tag}`, [{ platform: 'ESPN PLAY-BY-PLAY', title: ev.text, sub: ev.clock, url: gameSrcUrl }]); return `<div class="proof-item clickable-ref ${ev.impact < 0 ? 'danger' : ''}" onclick="triggerSource(${evSrc.idx}, event)"><span class="src-chip">🔗 Source ↗</span><strong>[${ev.tag}] ${ev.clock}</strong> (${ev.impact > 0 ? '+' : ''}${ev.impact}% shift)<div class="proof-sub">${ev.text}</div></div>`; }).join('');
    body.innerHTML = `${renderAlgoVisuals(g)}${chartsHtml}<div class="proof-item clickable-ref" onclick="triggerSource(${bullSrc.idx}, event)"><span class="src-chip">🔗 ${bullSrc.count} Sources</span><strong>🤖 AI Breakdown — Why ${g.pickedTeam.short} Hits</strong>${bulls.map(b => `<div class="proof-sub">• ${b}</div>`).join('')}</div><div class="proof-item warn clickable-ref" onclick="triggerSource(${bullSrc.idx}, event)"><span class="src-chip">🔗 ${bullSrc.count} Sources</span><strong>⚠ Main Risk Factors</strong>${bears.map(b => `<div class="proof-sub">• ${b}</div>`).join('')}</div>${sum?.officials?.length ? `<div class="proof-item clickable-ref" onclick="triggerSource(${bullSrc.idx}, event)"><span class="src-chip">🔗 Sources</span><strong>Officials:</strong> ${sum.officials.join(', ')}</div>` : ''}${eventsHtml}`;
  } else if (currentTab === 'gem') {
    const hitsHtml = g.primaryHits.length >= 2 ? g.primaryHits.map(h => {
      const gSrc = registerSources('Pattern Signal Sources', [{ platform: 'ESPN MATCHUP', title: `Verify Records & Venue: ${g.away.short} @ ${g.home.short}`, sub: h, url: gameSrcUrl }, { platform: 'GEMATRIX', title: `Check 4-Cipher Calculation Online`, sub: 'Verify Ordinal / Reduction / Reverse values', url: `https://www.gematrix.org/?word=${encodeURIComponent(g.pickedTeam.name)}` }]);
      return `<div class="proof-item clickable-ref" onclick="triggerSource(${gSrc.idx}, event)"><span class="src-chip">🔗 ${gSrc.count} Sources</span><strong>✓ Hit:</strong> ${h}</div>`;
    }).join('') : `<div class="proof-item warn"><strong>Threshold Not Met (${g.primaryHits.length}/2):</strong> Fewer than 2 references matched. Signal pillar is 0% until 2+ align.</div>`;
    body.innerHTML = `<div class="proof-item"><strong>Composite: ${g.confidence}%</strong> (${g.pickLabel})<div class="proof-sub">Weights (${g.league}): ${g.activeW.gem}% Signals · ${g.activeW.h2h}% Normalized Fair Odds/H2H · ${g.activeW.ros}% Splits/Rest/Health</div></div><div class="context-box"><h4>+ Add Walkout Song, Performer, Refs or Coaches</h4><div class="form-grid"><div class="form-group"><label>Performer</label><input id="ctx-artist" class="form-input" value="${ctx.artist || ''}" placeholder="Artist name" /></div><div class="form-group"><label>Song Title</label><input id="ctx-song" class="form-input" value="${ctx.song || ''}" placeholder="Song title" /></div></div><div class="form-group"><label>Coaches / Extra Keywords</label><input id="ctx-extra" class="form-input" value="${ctx.extra || ''}" placeholder="Coach, ref, theme..." /></div><button class="primary-btn" onclick="saveExtraContext('${g.id}')">Recalculate Signals with Context</button></div>${hitsHtml}`;
  } else if (currentTab === 'ros') {
    if (FIGHT_LEAGUES.has(g.league)) {
      const fA = findFighterStats(g.away.name), fB = findFighterStats(g.home.name), fi = fightIntelMap[g.id] || { awayCutPen: 0, awayInjPen: 0, homeCutPen: 0, homeInjPen: 0, notes: '' };
      const hotspots = [];
      const addF = (nm, fObj) => {
        if (!fObj || !fObj.str_def) return;
        const def = fObj.str_def, sapm = fObj.sapm ?? 0, headP = fObj.head_pct ?? 0, bodyP = fObj.body_pct ?? 0, legP = fObj.leg_pct ?? 0;
        const base = (fObj.sources || []).map(u => ({ platform: 'FIGHT PROFILE', title: `${nm} Official Stats`, sub: 'Career striking & fight history', url: u }));
        if (def < 60 || sapm >= 3.0) hotspots.push({ zone: 'head', label: `${nm}: Head / Chin Risk`, sub: `Str Def ${def}% · Absorbs ${sapm}/m`, srcIdx: registerSources(`${nm} — Head Defense`, [...base, ...buildSocialAndNewsSources(`${nm} ${g.league} fighter`, 'chin knockout head defense', sum?.news)]).idx });
        if (bodyP >= 18) hotspots.push({ zone: 'upper', label: `${nm}: Body / Cut Zone`, sub: `${bodyP}% body strike exposure`, srcIdx: registerSources(`${nm} — Body & Weight Cut`, [...base, ...buildSocialAndNewsSources(`${nm} ${g.league} fighter`, 'body shot weight cut', sum?.news)]).idx });
        if (legP >= 14 && g.league === 'UFC') hotspots.push({ zone: 'legs', label: `${nm}: Leg / Calf Risk`, sub: `${legP}% leg strike exposure`, srcIdx: registerSources(`${nm} — Leg Kick Vulnerability`, [...base, ...buildSocialAndNewsSources(`${nm} ${g.league} fighter`, 'leg kick knee injury', sum?.news)]).idx });
      };
      addF(g.away.short, fA); addF(g.home.short, fB);

      const fighterBanner = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
          <div style="background:rgba(15,23,42,0.85);border:1px solid #1e2d47;border-radius:12px;padding:10px;display:flex;align-items:center;gap:10px;">
            ${renderAvatar(g.away.name, g.away.headshot, 44)}
            <div style="min-width:0;"><div style="font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${g.away.short}</div><div style="font-size:10px;color:#8b95a5;">${g.away.record || 'Fighter A'}</div></div>
          </div>
          <div style="background:rgba(15,23,42,0.85);border:1px solid #1e2d47;border-radius:12px;padding:10px;display:flex;align-items:center;gap:10px;">
            ${renderAvatar(g.home.name, g.home.headshot, 44)}
            <div style="min-width:0;"><div style="font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${g.home.short}</div><div style="font-size:10px;color:#8b95a5;">${g.home.record || 'Fighter B'}</div></div>
          </div>
        </div>
      `;

      const renderWc = (nm, gauge, fObj) => {
        const srcs = [
          { platform: 'TAPOLOGY', title: `${nm} — Official Weigh-In History`, sub: 'Verified MMA/Boxing weigh-in records', url: `https://www.tapology.com/search?term=${encodeURIComponent(nm)}` }
        ];
        if (fObj?.weight_cut?.source_url) srcs.unshift({ platform: 'WEIGH-IN RECORD', title: `${nm} Official Weigh-In`, sub: 'Career weight classes & bouts', url: fObj.weight_cut.source_url });
        srcs.push(...buildSocialAndNewsSources(`${nm} ${g.league} fighter`, 'weigh in weight cut', sum?.news));
        const s = registerSources(`${nm} Weight Cut Sources`, srcs);
        if (gauge?.hasAuto) return `<div class="wc-gauge-card clickable-ref" onclick="triggerSource(${s.idx}, event)"><span class="src-chip">🔗 ${s.count} Sources</span><div class="wc-top"><strong>⚖ ${nm}: ${gauge.curL} lbs</strong><span style="color:${gauge.pen >= 10 ? 'var(--danger)' : 'var(--amber)'};font-weight:800;">${gauge.label}</span></div><div class="wc-track"><div class="wc-marker" style="left:${gauge.posPct}%;"></div></div><div class="wc-labels"><span>Biggest Cut: ${gauge.minL} lbs</span><span>Now: ${gauge.curL} lbs</span><span>Lowest Cut: ${gauge.maxL} lbs</span></div></div>`;
        return `<div class="wc-gauge-card clickable-ref" onclick="triggerSource(${s.idx}, event)"><span class="src-chip">🔗 ${s.count} Sources</span><div class="wc-top"><strong>⚖ ${nm} Weight Cut Gauge</strong><span style="color:var(--text-muted);">${gauge?.label || 'Pending Official Weigh-In'}</span></div><div class="proof-sub">Tap for verified Tapology weigh-in history, X posts &amp; YouTube weigh-in videos.</div></div>`;
      };

      const renderFC = (nm, st) => {
        const s = registerSources(`${nm} Verified ${g.league} Sources`, [
          ...(st?.sources || []).map(u => ({ platform: 'FIGHTER PROFILE', title: `${nm} Official Stats`, url: u })),
          { platform: 'TAPOLOGY', title: `${nm} — Official Fight & Weigh-In History`, sub: 'Verified MMA/Boxing database', url: `https://www.tapology.com/search?term=${encodeURIComponent(nm)}` },
          ...buildSocialAndNewsSources(`${nm} ${g.league} fighter`, `weigh in highlights`, sum?.news)
        ]);
        if (!st || !st.str_def) return `<div class="strike-card" onclick="triggerSource(${s.idx}, event)"><div class="strike-name">${nm} ↗</div><div class="proof-sub">Official striking &amp; weigh-in data pending. Tap for verified Tapology &amp; ${g.league} fighter profile.</div></div>`;
        return `<div class="strike-card" onclick="triggerSource(${s.idx}, event)"><div class="strike-name">${nm} <span style="color:var(--blue);font-size:10px;">↗</span></div><div class="proof-sub" style="margin-bottom:6px;">${st.stance || '—'} · Reach: ${st.reach || '—'} · Def: ${st.str_def}%</div><div class="zone-row"><div class="zone-lbl"><span>Head Target</span><strong>${st.head_pct || '—'}%</strong></div><div class="zone-track"><div class="zone-fill" style="width:${st.head_pct || 0}%;background:var(--accent);"></div></div></div><div class="zone-row"><div class="zone-lbl"><span>Defense Gap</span><strong style="color:var(--danger);">${st.sapm || '—'}/m</strong></div><div class="zone-track"><div class="zone-fill" style="width:${Math.min(100, Math.round(100 - st.str_def))}%;background:var(--danger);"></div></div></div></div>`;
      };

      body.innerHTML = `${fighterBanner}${renderBodyOutlineCard('Fighter Weak-Point Body Map', hotspots)}${renderWc(g.away.short, g.awayCutGauge, fA)}${renderWc(g.home.short, g.homeCutGauge, fB)}<div class="strike-grid">${renderFC(g.away.short, fA)}${renderFC(g.home.short, fB)}</div><div class="context-box"><h4>⚖ Manual Camp / Weigh-In Override (Optional)</h4><div class="form-grid"><div class="form-group"><label>${g.away.short} Weight Cut</label><select id="fi-away-cut" class="form-input"><option value="0" ${fi.awayCutPen==0?'selected':''}>Auto-Gauged (Default)</option><option value="6" ${fi.awayCutPen==6?'selected':''}>Drained / Tough Cut (-6 pts)</option><option value="12" ${fi.awayCutPen==12?'selected':''}>Missed Weight / Severe (-12 pts)</option></select></div><div class="form-group"><label>${g.away.short} Prior Injury</label><select id="fi-away-inj" class="form-input"><option value="0" ${fi.awayInjPen==0?'selected':''}>Healthy Camp (0 pts)</option><option value="5" ${fi.awayInjPen==5?'selected':''}>Minor Knock (-5 pts)</option><option value="12" ${fi.awayInjPen==12?'selected':''}>Major / Recent Surgery (-12 pts)</option></select></div></div><div class="form-grid"><div class="form-group"><label>${g.home.short} Weight Cut</label><select id="fi-home-cut" class="form-input"><option value="0" ${fi.homeCutPen==0?'selected':''}>Auto-Gauged (Default)</option><option value="6" ${fi.homeCutPen==6?'selected':''}>Drained / Tough Cut (-6 pts)</option><option value="12" ${fi.homeCutPen==12?'selected':''}>Missed Weight / Severe (-12 pts)</option></select></div><div class="form-group"><label>${g.home.short} Prior Injury</label><select id="fi-home-inj" class="form-input"><option value="0" ${fi.homeInjPen==0?'selected':''}>Healthy Camp (0 pts)</option><option value="5" ${fi.homeInjPen==5?'selected':''}>Minor Knock (-5 pts)</option><option value="12" ${fi.homeInjPen==12?'selected':''}>Major / Recent Surgery (-12 pts)</option></select></div></div><div class="form-group"><label>Camp / Weight Cut Notes</label><input id="fi-notes" class="form-input" value="${fi.notes || ''}" placeholder="e.g. Moving down a division, rib injury in camp..." /></div><button class="primary-btn" onclick="saveFightIntel('${g.id}')">Apply Override to Confidence</button></div>`;
    } else {
      const sortedInj = [...(g.gradedInjuries || [])].sort((a, b) => b.pts - a.pts);
      const teamHotspots = sortedInj.slice(0, 5).map(i => {
        const zone = detectBodyZoneFromText(`${i.detail} ${i.status}`);
        const s = registerSources(`${i.player} (${i.team}) — Injury Intel`, [{ platform: 'ESPN INJURY REPORT', title: `${i.player} — ${i.status}`, sub: i.detail || 'Official ESPN status', url: gameSrcUrl }, ...buildSocialAndNewsSources(`${i.player} ${g.league}`, `injury ${i.team}`, sum?.news)]);
        return { zone, label: `${i.player} (${i.team}) — ${i.status}`, sub: i.detail || `${zone.toUpperCase()} zone`, srcIdx: s.idx };
      });
      const uniqueLeaders = []; (g.allLeaders || []).forEach(l => { if (l.name && !uniqueLeaders.some(u => u.name === l.name && u.stat === l.stat)) uniqueLeaders.push(l); });
      const lSrc = registerSources('Key Stat Leaders', [{ platform: 'ESPN BOXSCORE', title: `${g.away.short} @ ${g.home.short} Team Leaders`, url: gameSrcUrl }]);
      const leadersHtml = uniqueLeaders.length ? `<div class="proof-item clickable-ref" onclick="triggerSource(${lSrc.idx}, event)"><span class="src-chip">🔗 Source ↗</span><strong>Tracked Key Stat Leaders</strong><div class="proof-sub">${uniqueLeaders.slice(0, 6).map(l => `${l.team} ${l.stat}: ${l.name} (${l.value})`).join(' · ')}</div></div>` : '';
      const injHtml = sortedInj.length ? sortedInj.map(i => {
        const s = registerSources(`${i.player} Injury Sources`, [{ platform: 'ESPN REPORT', title: `${i.player} (${i.team}) — ${i.status}`, sub: i.detail || 'Official injury status', url: gameSrcUrl }, ...buildSocialAndNewsSources(`${i.player} ${g.league}`, `injury update ${i.team}`, sum?.news)]);
        const badge = i.tier === 'star' ? `<span class="star-badge">★ STAR ${i.statLabels ? '(' + i.statLabels + ')' : ''}</span>` : i.tier === 'key' ? `<span class="key-badge">KEY (${i.statLabels})</span>` : `<span class="bench-badge">ROTATION</span>`;
        return `<div class="proof-item clickable-ref ${i.tier === 'star' ? 'danger star-out' : i.pts > 0 ? 'danger' : ''}" onclick="triggerSource(${s.idx}, event)"><span class="src-chip">🔗 ${s.count} Sources</span>${badge}<strong>${i.player}</strong> (${i.team}) — ${i.status} (${i.pts > 0 ? '-' + i.pts + ' pts' : '0 pts'})<div class="proof-sub">${i.detail || 'Listed on official ESPN injury report.'}</div></div>`;
      }).join('') : `<div class="proof-item"><strong>Clean Injury Report</strong><div class="proof-sub">No major ESPN injury deductions impacting this game.</div></div>`;
      body.innerHTML = `<div class="proof-item"><strong>Star-Weighted Health, Splits &amp; Rest Score: ${g.rosScore}%</strong><div class="proof-sub">Pick Star/Injury Penalty: -${g.injuryPenalty} pts · Opponent Injury Boost: +${g.oppInjuryBonus} pts</div></div>${renderBodyOutlineCard('Injury Weak-Point Body Map', teamHotspots)}${leadersHtml}${injHtml}`;
    }
  } else {
    const news = sum?.news || [];
    body.innerHTML = news.length ? news.map(n => `<a class="news-card" href="${n.url}" target="_blank" rel="noopener noreferrer"><div class="news-title">${n.headline} ↗</div><div class="news-desc">${n.description}</div><div class="news-meta">ESPN · ${n.published || 'Latest'}</div></a>`).join('') : `<div class="proof-item">No recent ESPN articles found for this matchup.</div>`;
  }
}

// --- TOOLS, SCANNER & NAVIGATION ---
function openToolsModal(tab = 'slip') { currentToolsTab = tab; document.getElementById('tools-modal').classList.add('open'); ['slip', 'calc', 'conv'].forEach(t => document.getElementById(`tool-tab-${t}`).classList.toggle('active', t === tab)); renderToolsTab(); }
function switchToolsTab(tab, btn) { currentToolsTab = tab; document.querySelectorAll('#tools-modal .tab-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderToolsTab(); }
function renderToolsTab() {
  const body = document.getElementById('tools-body');
  if (currentToolsTab === 'slip') {
    const legs = allGames.filter(g => savedIds.has(g.id));
    if (!legs.length) { body.innerHTML = `<div class="empty-state">Your Parlay Slip is empty.<br/>Tap the <strong>☆</strong> icon on any game card to add legs.</div>`; return; }
    let combDec = 1;
    const legsHtml = legs.map(g => {
      const oa = analyzeOddsEvent(g.oddsEventDirect || matchGameInOdds(g, oddsSportCache[g.oddsKey]?.data || []), g.home, g.away);
      const best = g.pickSide === 'home' ? oa.homeRows[0] : oa.awayRows[0], dec = best ? best.dec : (1 / Math.max(0.15, g.confidence / 100)); combDec *= dec;
      return `<div class="book-row" onclick="closeModal('tools-modal'); openGameDetail('${g.id}')"><div class="book-left"><div class="book-name">${g.pickLabel} <span class="ev-badge">${g.confidence}% CONF</span></div><div class="book-sub">${g.league} · ${g.away.short} @ ${g.home.short}</div></div><div class="book-right"><div class="book-odds">${best ? (best.price > 0 ? '+' + best.price : best.price) : 'Est'}</div><button class="get-app-btn" onclick="toggleSave(event, '${g.id}'); renderToolsTab();">Remove</button></div></div>`;
    }).join('');
    const combAm = decimalToAmerican(combDec);
    body.innerHTML = `${legsHtml}<div class="proof-item arb-box"><strong>${legs.length}-Leg Parlay Odds: ${combAm > 0 ? '+' + combAm : combAm} (${combDec.toFixed(2)}x)</strong><div class="proof-sub">$50 Stake → <strong>$${(50 * combDec).toFixed(2)}</strong> Payout · $100 Stake → <strong>$${(100 * combDec).toFixed(2)}</strong> Payout</div></div><button class="primary-btn" onclick="shareParlaySlip(${combAm})">Two-Click Share Parlay Slip</button>`;
  } else if (currentToolsTab === 'calc') {
    body.innerHTML = `<div class="context-box"><h4>⚡ Arbitrage / Hedge Splitter</h4><div class="form-grid"><div class="form-group"><label>Side A Odds</label><input id="arb-a" class="form-input" type="number" value="140" oninput="calcArb()" /></div><div class="form-group"><label>Side B Odds</label><input id="arb-b" class="form-input" type="number" value="-120" oninput="calcArb()" /></div></div><div class="form-group"><label>Total Stake ($)</label><input id="arb-stake" class="form-input" type="number" value="100" oninput="calcArb()" /></div><div id="arb-out" class="proof-item" style="margin-bottom:0;"></div></div><div class="context-box"><h4>📈 +EV Edge Calculator</h4><div class="form-grid"><div class="form-group"><label>Sportsbook Odds</label><input id="ev-odds" class="form-input" type="number" value="130" oninput="calcEv()" /></div><div class="form-group"><label>Fair Win Prob (%)</label><input id="ev-prob" class="form-input" type="number" value="48" oninput="calcEv()" /></div></div><div id="ev-out" class="proof-item" style="margin-bottom:0;"></div></div>`;
    calcArb(); calcEv();
  } else {
    body.innerHTML = `<div class="context-box"><h4>🔄 American Odds ↔ Decimal ↔ Kalshi ¢</h4><div class="form-group"><label>Enter American Odds</label><input id="conv-am" class="form-input" type="number" value="-110" oninput="calcConv()" /></div><div id="conv-out" class="proof-item" style="margin-bottom:0;"></div></div>`;
    calcConv();
  }
}
function calcArb() {
  const a = Number(document.getElementById('arb-a')?.value || 0), b = Number(document.getElementById('arb-b')?.value || 0), st = Number(document.getElementById('arb-stake')?.value || 100), out = document.getElementById('arb-out');
  if (!a || !b || !out) return;
  const dA = americanToDecimal(a), dB = americanToDecimal(b), inv = (1 / dA) + (1 / dB), sA = st / (dA * inv), sB = st - sA, profit = (sA * dA) - st;
  out.innerHTML = `<strong style="color:${profit > 0 ? 'var(--accent)' : 'var(--danger)'}">${profit > 0 ? 'Arbitrage Profit' : 'No Arb (Vig)'}: ${profit >= 0 ? '+$' : '-$'}${Math.abs(profit).toFixed(2)} (${(((1 / inv) - 1) * 100).toFixed(2)}%)</strong><div class="proof-sub">Bet <strong>$${sA.toFixed(2)}</strong> on Side A &amp; <strong>$${sB.toFixed(2)}</strong> on Side B</div>`;
}
function calcEv() {
  const o = Number(document.getElementById('ev-odds')?.value || 0), p = Number(document.getElementById('ev-prob')?.value || 50) / 100, out = document.getElementById('ev-out');
  if (!o || !out) return;
  const ev = ((p * americanToDecimal(o)) - 1) * 100;
  out.innerHTML = `<strong style="color:${ev > 0 ? 'var(--accent)' : 'var(--danger)'}">Expected Value: ${ev >= 0 ? '+' : ''}${ev.toFixed(2)}% EV</strong><div class="proof-sub">Expected profit per $100 wagered: ${ev >= 0 ? '+$' : '-$'}${Math.abs(ev).toFixed(2)}</div>`;
}
function calcConv() {
  const o = Number(document.getElementById('conv-am')?.value || -110), out = document.getElementById('conv-out'); if (!o || !out) return;
  out.innerHTML = `<strong>Decimal: ${americanToDecimal(o).toFixed(3)} · Kalshi Price: ${americanToCents(o)}¢</strong><div class="proof-sub">Implied Win Prob: ${(americanToImplied(o) * 100).toFixed(1)}% · Profit on $100: +$${americanToProfit100(o).toFixed(2)}</div>`;
}
async function shareParlaySlip(combAm) {
  const legs = allGames.filter(g => savedIds.has(g.id)), text = `AlignIQ ${legs.length}-Leg Parlay (${combAm > 0 ? '+' + combAm : combAm}):\n${legs.map(g => `• ${g.league}: ${g.pickLabel} (${g.confidence}%)`).join('\n')}\nhttps://levaun2024.github.io/AlignIQ/`;
  if (navigator.share) { try { await navigator.share({ title: 'AlignIQ Parlay', text }); return; } catch {} }
  navigator.clipboard?.writeText(text); alert('Parlay copied to clipboard!');
}
async function shareSelectedGame() {
  const g = allGames.find(x => x.id === selectedGameId); if (!g) return;
  const text = `AlignIQ Pick (${g.league}): ${g.pickLabel} — ${g.confidence}% Confidence | ${g.away.short} @ ${g.home.short}\nhttps://levaun2024.github.io/AlignIQ/`;
  if (navigator.share) { try { await navigator.share({ title: 'AlignIQ Pick', text }); return; } catch {} }
  navigator.clipboard?.writeText(text); alert('Pick copied to clipboard!');
}
function openScanModal() { document.getElementById('scan-result').innerHTML = ''; document.getElementById('scan-modal').classList.add('open'); }
function runCustomScan() {
  const dm = getDateMath(currentDate), awayFull = document.getElementById('sc-away').value.trim(), homeFull = document.getElementById('sc-home').value.trim();
  const custom = evaluateGame({ id: 'custom', league: 'CUSTOM', state: 'pre', time: 'Custom Scan', venue: document.getElementById('sc-venue').value, leaders: [], homeML: null, awayML: null, away: { id: '', name: awayFull, short: awayFull.split(' ').pop(), location: awayFull.split(' ')[0], mascot: awayFull.split(' ').pop(), record: document.getElementById('sc-away-rec').value }, home: { id: '', name: homeFull, short: homeFull.split(' ').pop(), location: homeFull.split(' ')[0], mascot: homeFull.split(' ').pop(), record: document.getElementById('sc-home-rec').value }, customCtx: { artist: document.getElementById('sc-artist').value, song: document.getElementById('sc-song').value, extra: document.getElementById('sc-extra').value } }, dm);
  document.getElementById('scan-result').innerHTML = `<div class="proof-item"><strong>${custom.pickLabel} — ${custom.confidence}% Confidence</strong><div class="proof-sub">${custom.hitsCount} Pattern Hits across ${custom.entitiesCount} variables · Signal Score: ${custom.gemScore}%</div></div>${custom.primaryHits.map(h => `<div class="proof-item">${h}</div>`).join('') || '<div class="proof-item warn">Fewer than 2 references matched.</div>'}`;
}
function openDateMathModal() {
  const dm = getDateMath(currentDate);
  document.getElementById('dm-modal-body').innerHTML = `<div class="proof-item"><strong>Full Date Sum:</strong> ${dm.full}</div><div class="proof-item"><strong>Short Date Sum:</strong> ${dm.short}</div><div class="proof-item"><strong>Digit Sum:</strong> ${dm.digits}</div><div class="proof-item"><strong>Mixed Sum:</strong> ${dm.mixed}</div><div class="proof-item"><strong>Day of Year:</strong> ${dm.doy} (${dm.left} days remaining)</div>`;
  document.getElementById('dm-modal').classList.add('open');
}

function saveOddsKey(val) { if (!window.ALIGNIQ_IS_OWNER) return; oddsApiKey = val.trim(); localStorage.setItem('aligniq_odds_key', oddsApiKey); oddsSportCache = {}; loadSlate(false); }
function toggleSave(e, id) { e.stopPropagation(); if (savedIds.has(id)) savedIds.delete(id); else savedIds.add(id); localStorage.setItem('aligniq_saved', JSON.stringify(Array.from(savedIds))); document.getElementById('saved-count').textContent = savedIds.size; renderFeed(); }
function setFilterMode(m) { filterMode = m; ['all', 'high', 'gem', 'live', 'upcoming'].forEach(k => document.getElementById(`mode-${k}`).classList.toggle('active', k === m)); renderFeed(); }
function setSport(s) { activeSport = s; renderSportsBar(); renderFeed(); }
function toggleTuner() { document.getElementById('tuner-panel').classList.toggle('open'); syncOwnerAlgoLock(); }
function onWeightChange() { syncSlidersToWeights(); }
function resetToAgentWeights() { syncSlidersToWeights(); }
function shiftDate(delta) { currentDate.setDate(currentDate.getDate() + delta); loadSlate(false); }
function onPickDate(val) { if (!val) return; const [y, m, d] = val.split('-').map(Number); currentDate = new Date(y, m - 1, d); loadSlate(false); }
function goToday() { currentDate = new Date(); loadSlate(false); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function closeModalOnBg(e, id) { if (e.target.id === id) closeModal(id); }

updateDateUI();
syncOwnerAlgoLock();
loadAgentReport();