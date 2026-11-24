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

// STEP 1 SECURITY LOCK: Never hardcode your private Odds API key in GitHub
const DEFAULT_ODDS_KEY = '';
let oddsApiKey = localStorage.getItem('aligniq_odds_key') || DEFAULT_ODDS_KEY;

// Phase 1: Market-anchored base weights (10% Gem / 60% H2H / 30% ROS)
const PHASE1_DEFAULT_WEIGHTS = { gem: 10, h2h: 60, ros: 30 };

let currentDate = new Date(), allGames = [], summaryCache = {}, scheduleCache = {}, leagueNewsCache = {}, oddsSportCache = {}, propsEventCache = {}, fightersDb = {}, prevConfMap = {};
let activeSport = 'All', filterMode = 'all', agentReport = null, weights = { ...PHASE1_DEFAULT_WEIGHTS }, leagueWeights = {}, manualOverride = false;
let selectedGameId = null, currentTab = 'odds', currentToolsTab = 'slip', currentSettingsTab = 'theme', oddsViewSide = 'pick', livePollTimer = null, sourceRegistry = [];
let savedIds = new Set(JSON.parse(localStorage.getItem('aligniq_saved') || '[]'));
let customContextMap = JSON.parse(localStorage.getItem('aligniq_ctx') || '{}');
let fightIntelMap = JSON.parse(localStorage.getItem('aligniq_fight_intel') || '{}');
let openOddsMap = JSON.parse(localStorage.getItem('aligniq_open_odds') || '{}');
let helpChatLog = [{ role: 'bot', text: 'Hi! I’m the AlignIQ Help Assistant. Ask me anything about CONF %, +EV, Weight Cut Gauges, Body Maps, or your Odds API key.' }];

// --- PHASE 1 NORMALIZATION & UNDERDOG GATE HELPERS ---
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

// --- THEME & SETTINGS MODAL ---
function applyTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('aligniq_theme', t);
  const meta = document.getElementById('meta-theme-color');
  if (meta) meta.setAttribute('content', t === 'light' ? '#f8fafc' : '#080d17');
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
  if (/conf|weight|score|calculat|formula|pillar/.test(s)) return 'CONF % combines 3 normalized pillars (default 10% Gematria / 60% Scaled Fair Odds / 30% Form & Health) plus the Underdog Agreement Gate, which only flips to an underdog in close markets when signals agree.';
  if (/\+ev|ev|value|arb|arbitrage/.test(s)) return '+EV% shows when a sportsbook is paying more than the No-Vig Fair Consensus probability. Arbitrage (⚡) appears when two books disagree enough that betting both sides guarantees a profit. Neither alters CONF %.';
  if (/weight cut|cut|gauge|ufc|fight|boxing|bkfc/.test(s)) return 'In Fight IQ, each fighter’s Weight Cut Gauge compares their current weight against their career lowest weight (Biggest Cut) and highest weight (Lowest Cut), automatically weighing cut stress and striking defense/reach into CONF %.';
  if (/body|weak|red|dot|map|injur/.test(s)) return 'Red pulsing dots on the Body Outline highlight fighter target/defense weak points or injured body zones on team sports. Tap any red dot to open ESPN reports, X/Twitter posts, Google News, and YouTube clips.';
  if (/source|link|box|hover|proof/.test(s)) return 'Every reference has verified source links. If there is 1 source, tapping opens it directly; if there are 2+ sources, a floating scrollable box pops up so you can choose which one to visit.';
  if (/odds|empty|credit|key|api/.test(s)) return 'Live Best Odds and Player Props use your private Odds API key stored only on this device. Tap 🤖 Agent at the top to paste your key and check remaining monthly credits.';
  if (/theme|light|dark|mode/.test(s)) return 'Switch between Dark Mode and Light Mode right here in Settings → Theme. Your preference saves automatically on this device.';
  if (/parlay|slip|calc/.test(s)) return 'Tap ☆ on any game card to add it to your ★ Parlay Slip. Tap 🧮 in the top bar for the Parlay Slip, Arbitrage Splitter, +EV Calculator, and American ↔ Kalshi ¢ converter.';
  return 'I can explain CONF % weights, +EV & Arbitrage, Weight Cut Gauges, Body Weak-Point Maps, Player Props/DFS, Parlay Slip, or your Private Odds API key. What would you like to know?';
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
      <div class="proof-item"><strong>Private API Key Security</strong><div class="proof-sub">Your Odds API key is stored only on this device and never exposed in GitHub. Manage it anytime under <strong>🤖 Agent</strong>.</div></div>
    `;
  } else {
    body.innerHTML = `
      <div class="help-chips">
        <button class="help-chip" onclick="askHelpQuick('How is CONF % calculated?')">CONF % Formula</button>
        <button class="help-chip" onclick="askHelpQuick('How does the Weight Cut Gauge work?')">Weight Cut Gauge</button>
        <button class="help-chip" onclick="askHelpQuick('What do the red dots on the body map do?')">Body Map</button>
        <button class="help-chip" onclick="askHelpQuick('Why are Best Odds empty?')">Odds / API Key</button>
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
  if (entry.sources.length === 1) { window.open(entry.sources[0].url, '_blank', 'noopener,noreferrer'); return; }
  document.getElementById('source-box-title').textContent = `${entry.title} (${entry.sources.length} Sources)`;
  document.getElementById('source-box-list').innerHTML = entry.sources.map(s => `
    <a class="source-link-row" href="${s.url}" target="_blank" rel="noopener noreferrer">
      <div style="min-width:0;flex:1;">
        <span class="source-tag ${s.kind || ''}">${s.platform || 'SOURCE'}</span>
        <div class="source-title">${s.title}</div>
        ${s.sub ? `<div class="source-sub">${s.sub}</div>` : ''}
      </div>
      <span style="color:var(--blue);font-weight:800;font-size:14px;flex-shrink:0;">↗</span>
    </a>
  `).join('');
  document.getElementById('source-popover').classList.add('open');
}
function closeSourceBox() { document.getElementById('source-popover').classList.remove('open'); }
function buildSocialAndNewsSources(subject, topic, extraNews = []) {
  const q = encodeURIComponent(`${subject} ${topic}`.trim()), list = [];
  (extraNews || []).slice(0, 3).forEach(n => { if (n.url) list.push({ platform: 'ESPN NEWS', title: n.headline, sub: n.published || 'Official Report', url: n.url }); });
  list.push(
    { platform: 'X / TWITTER', kind: 'social', title: `Live X posts: ${subject} (${topic})`, sub: 'Real-time fan, reporter & camp updates', url: `https://x.com/search?q=${q}&f=live` },
    { platform: 'GOOGLE NEWS', title: `News coverage: ${subject} ${topic}`, sub: 'Latest headlines & injury/weigh-in reports', url: `https://news.google.com/search?q=${q}` },
    { platform: 'YOUTUBE', kind: 'video', title: `Video clips: ${subject} ${topic}`, sub: 'Weigh-ins, highlights & film breakdowns', url: `https://www.youtube.com/results?search_query=${q}` },
    { platform: 'REDDIT', kind: 'social', title: `Reddit threads: ${subject} ${topic}`, sub: 'Community breakdown & camp rumors', url: `https://www.reddit.com/search/?q=${q}&sort=new` }
  );
  return list;
}
function espnGameUrl(g) {
  const lg = LEAGUES.find(l => l.key === g.league);
  if (g.path && lg?.espnSlug && !String(g.id).startsWith('odds_')) return `https://www.espn.com/${lg.espnSlug}/game/_/gameId/${g.id}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${g.away.name} vs ${g.home.name}${g.league}`)}`;
}
function espnTeamScheduleUrl(g, teamId)
