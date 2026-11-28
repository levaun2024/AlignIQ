(function () {
  let activeCharts = [];
  let cachedHistory = null;
  let cachedReport = null;
  let proposalMap = {};
  let ownerTab = 'overview';
  let selectedReportDate = null;
  let approvalState = JSON.parse(localStorage.getItem('aligniq_owner_approvals') || '{}');

  const ESPN_PATHS = {
    NBA: 'basketball/nba', NFL: 'football/nfl', NHL: 'hockey/nhl', MLB: 'baseball/mlb',
    NCAAF: 'football/college-football', NCAAB: 'basketball/mens-college-basketball',
    NCAAW: 'basketball/womens-college-basketball', WNBA: 'basketball/wnba',
    UFC: 'mma/ufc', EPL: 'soccer/eng.1', MLS: 'soccer/usa.1', UCL: 'soccer/uefa.champions'
  };

  async function fetchFresh(file) {
    try {
      const res = await fetch(`./${file}?t=${Date.now()}`, { cache: 'no-store' });
      return res.ok ? res.json() : null;
    } catch {
      return null;
    }
  }

  function destroyCharts() {
    activeCharts.forEach((c) => { try { c.destroy(); } catch {} });
    activeCharts = [];
  }

  function clamp(v, lo = 0, hi = 100) {
    return Math.max(lo, Math.min(hi, Number(v) || 0));
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function isFallbackRow(g) {
    if (!g || g.data_quality === 'postgame_fallback') return true;
    const h = g.home || {}, a = g.away || {};
    const hh2h = Number(h.h2h ?? 50), ah2h = Number(a.h2h ?? 50);
    return (
      Number(h.gem || 0) === 0 &&
      Number(a.gem || 0) === 0 &&
      [45, 50, 55].includes(hh2h) &&
      [45, 50, 55].includes(ah2h) &&
      Number(h.ros ?? 50) === 52 &&
      Number(a.ros ?? 50) === 48
    );
  }

  function scoreHistoryGame(g, fallbackWeights) {
    const w = (g.original_weights && typeof g.original_weights.h2h === 'number')
      ? g.original_weights
      : (g.weights_used && typeof g.weights_used.h2h === 'number')
      ? g.weights_used
      : (fallbackWeights || { gem: 10, h2h: 60, ros: 30 });
    const h = g.home || {}, a = g.away || {};
    const hScore = (clamp((Number(h.gem) || 0) * 0.85) * w.gem + clamp((((Number(h.h2h) || 50) - 36) / 32) * 100) * w.h2h + clamp(Number(h.ros) || 50) * w.ros) / ((w.gem + w.h2h + w.ros) || 1);
    const aScore = (clamp((Number(a.gem) || 0) * 0.85) * w.gem + clamp((((Number(a.h2h) || 50) - 36) / 32) * 100) * w.h2h + clamp(Number(a.ros) || 50) * w.ros) / ((w.gem + w.h2h + w.ros) || 1);
    let pick = hScore >= aScore ? 'home' : 'away';
    const rawH = Number(h.h2h) || 50, rawA = Number(a.h2h) || 50;
    const marketDog = rawH === rawA ? null : (rawH < rawA ? 'home' : 'away');
    if (marketDog && pick === marketDog) {
      const dogH2H = pick === 'home' ? rawH : rawA;
      const dogRos = pick === 'home' ? clamp(Number(h.ros) || 50) : clamp(Number(a.ros) || 50);
      const favRos = pick === 'home' ? clamp(Number(a.ros) || 50) : clamp(Number(h.ros) || 50);
      const dogGem = pick === 'home' ? (Number(h.gem) || 0) : (Number(a.gem) || 0);
      const favGem = pick === 'home' ? (Number(a.gem) || 0) : (Number(h.gem) || 0);
      if (!(dogH2H >= 44 && ((dogRos > favRos && dogGem > favGem) || (dogRos - favRos) >= 22))) {
        pick = pick === 'home' ? 'away' : 'home';
      }
    }
    return { pick, confidence: Math.round(clamp(50 + Math.abs(hScore - aScore) * 0.5, 50, 99)), isUnderdog: Boolean(marketDog && pick === marketDog) };
  }

  // --- 1. GRADED PICKS & POST-GAME AUTOPSY ---
  window.openArchivedGameDetail = async (league, gameId, dateStr) => {
    const modal = document.getElementById('graded-audit-modal');
    const body = document.getElementById('graded-audit-body');
    if (!modal || !body) return;
    modal.classList.add('open');
    body.innerHTML = `<p style="font-size:12px;color:var(--text-muted);">Pulling full game details &amp; analytics from ESPN...</p>`;

    if (!cachedHistory) cachedHistory = await fetchFresh('history.json');
    const snap = cachedHistory?.dates?.[dateStr];
    const g = (snap?.games || []).find((x) => String(x.id) === String(gameId)) || {};
    const gw = g.original_weights || g.weights_used || snap?.weights_used || { gem: 10, h2h: 60, ros: 30 };
    const path = ESPN_PATHS[String(league || '').toUpperCase()];
    let espn = null;
    if (path && gameId) {
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${gameId}`);
        if (res.ok) espn = await res.json();
      } catch {}
    }

    const comp = espn?.header?.competitions?.[0];
    const comps = comp?.competitors || [];
    const homeC = comps.find((c) => c.homeAway === 'home') || comps[0];
    const awayC = comps.find((c) => c.homeAway === 'away') || comps[1];
    const matchupTitle = (awayC && homeC)
      ? `${awayC.team?.displayName || awayC.athlete?.displayName} @ ${homeC.team?.displayName || homeC.athlete?.displayName}`
      : (g.matchup || `Game #${gameId}`);
    const finalScore = (awayC && homeC && (awayC.score || homeC.score))
      ? `${awayC.score ?? ''} - ${homeC.score ?? ''}`
      : (g.final_score || 'Upcoming / Pre-Game');

    const boxTeams = espn?.boxscore?.teams || [];
    const statsHtml = boxTeams.length === 2
      ? (boxTeams[0].statistics || []).slice(0, 8).map((st, idx) => {
          const st2 = boxTeams[1].statistics?.[idx];
          return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:11.5px;">
            <strong>${st.displayValue || '—'}</strong>
            <span style="color:var(--text-muted);">${st.label || st.name}</span>
            <strong>${st2?.displayValue || '—'}</strong>
          </div>`;
        }).join('')
      : '<div class="proof-sub">Detailed team boxscore not published by ESPN yet for this event.</div>';

    const leadersHtml = (espn?.leaders || []).flatMap((tl) =>
      (tl.leaders || []).slice(0, 2).map((cat) => {
        const top = cat.leaders?.[0];
        if (!top?.athlete) return '';
        return `<div class="proof-sub">• <strong>${tl.team?.abbreviation || ''} ${cat.shortDisplayName || cat.name}:</strong> ${top.athlete.displayName} (${top.displayValue})</div>`;
      })
    ).filter(Boolean).join('');

    const autopsy = g.autopsy || {};
    body.innerHTML = `
      <button class="icon-btn" style="margin-bottom:10px;" onclick="openGradedAuditModal('${dateStr}')">‹ Back to ${dateStr} Slate</button>
      <div class="proof-item arb-box">
        <div style="font-size:10px;color:var(--accent);font-weight:800;">${league} · ${dateStr}</div>
        <div style="font-size:15px;font-weight:800;margin:4px 0;">${matchupTitle}</div>
        <div style="font-size:18px;font-weight:800;color:var(--text);">${finalScore}</div>
        <div class="proof-sub" style="margin-top:4px;">⚖️ Frozen Weights at Pick: <b>${gw.gem ?? 10}% Sig · ${gw.h2h ?? 60}% Odds · ${gw.ros ?? 30}% Form</b></div>
      </div>

      <div class="proof-item">
        <strong style="color:var(--blue);">⚖️ Determining Factors &amp; Model Autopsy</strong>
        <div class="proof-sub">${(autopsy.determining_factors || ['Pre-game prediction locked with active weights']).join(' · ')}</div>
        <div class="proof-sub" style="color:var(--accent);margin-top:6px;"><strong>🧠 Agent Note:</strong> ${autopsy.lesson_learned || 'Waiting for final score to grade and run post-game autopsy.'}</div>
      </div>

      <div class="proof-item">
        <strong>📊 Team Stats</strong>
        <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--blue);font-weight:800;margin:6px 0 4px;">
          <span>${boxTeams[0]?.team?.abbreviation || 'AWAY'}</span><span>STAT</span><span>${boxTeams[1]?.team?.abbreviation || 'HOME'}</span>
        </div>
        ${statsHtml}
      </div>

      ${leadersHtml ? `<div class="proof-item"><strong>⭐ Top Performers</strong>${leadersHtml}</div>` : ''}
    `;
  };

  window.openGradedAuditModal = async (overrideDate = null) => {
    const modal = document.getElementById('graded-audit-modal');
    const body = document.getElementById('graded-audit-body');
    if (!modal || !body) return;
    modal.classList.add('open');
    body.innerHTML = '<p style="font-size:12px;color:var(--text-muted);">Loading archived slates...</p>';

    cachedHistory = await fetchFresh('history.json');
    const allDates = Object.keys(cachedHistory?.dates || {}).sort().reverse();
    const completedDates = allDates.filter((d) =>
      (cachedHistory.dates[d]?.games || []).some((g) => g.result || g.actual_winner)
    );

    const pickerVal = overrideDate || document.getElementById('date-picker')?.value;
    const hasExact = Boolean(pickerVal && cachedHistory?.dates?.[pickerVal]);
    // If the selected date isn't archived (e.g. Nov 13), default to the latest COMPLETED slate (not an unplayed future slate)
    const targetDate = hasExact ? pickerVal : (completedDates[0] || allDates[0]);

    if (!targetDate || !cachedHistory?.dates?.[targetDate]) {
      body.innerHTML = '<p class="proof-sub">No archived slates found yet. Go to GitHub → Actions → Run workflow once.</p>';
      return;
    }

    const snap = cachedHistory.dates[targetDate];
    const w = snap.weights_used || { gem: 10, h2h: 60, ros: 30 };
    const allSlateGames = snap.games || [];
    const completedGames = allSlateGames.filter((g) => g.result || g.actual_winner);
    const pendingLockedGames = allSlateGames.filter((g) => !(g.result || g.actual_winner) && g.original_pick);
    const isUpcomingSlate = completedGames.length === 0 && pendingLockedGames.length > 0;
    const gamesToShow = completedGames.length ? completedGames : pendingLockedGames;

    let verifiedWins = 0, verifiedTotal = 0, fallbackCount = 0;
    const cardsHtml = gamesToShow.map((g) => {
      const isPending = !(g.result || g.actual_winner);
      const isFallback = !isPending && isFallbackRow(g);
      const gw = g.original_weights || g.weights_used || w;
      const actual = String(g.actual_winner || '').toLowerCase().trim();
      let pickSide = String(g.original_pick || g.pick || '').toLowerCase().trim();
      let conf = g.original_confidence || g.confidence;
      let isWin = false;

      if (!isPending) {
        if (actual === 'home' || actual === 'away') {
          const scored = scoreHistoryGame(g, gw);
          if (pickSide !== 'home' && pickSide !== 'away') pickSide = scored.pick;
          if (!conf) conf = scored.confidence;
          isWin = pickSide === actual;
        } else {
          isWin = ['W', 'WIN'].includes(String(g.result || '').toUpperCase());
        }
        if (isFallback) fallbackCount++;
        else { verifiedTotal++; if (isWin) verifiedWins++; }
      }

      const autopsy = g.autopsy || {};
      const detFactors = autopsy.determining_factors || [];
      const lesson = isPending
        ? 'Pre-game pick & weights locked before tip-off. Will grade automatically once final.'
        : isFallback
        ? 'Captured post-game without pre-game odds/Gematria — excluded from AI weight tuning.'
        : (autopsy.lesson_learned || 'Tap card to inspect full ESPN post-game boxscore & stats.');
      const pickName = pickSide === 'home' ? (g.home?.name || 'Home') : (g.away?.name || 'Away');
      const weightLine = `Weights at Pick: ${gw.gem ?? 10}% Sig · ${gw.h2h ?? 60}% Odds · ${gw.ros ?? 30}% Form`;
      const qualityBadge = isPending
        ? `<span style="font-size:9.5px;font-weight:800;color:var(--blue);margin-left:6px;">🔒 LOCKED PRE-GAME</span>`
        : isFallback
        ? `<span style="font-size:9.5px;font-weight:800;color:var(--amber);margin-left:6px;">⚠ FALLBACK (EXCLUDED)</span>`
        : `<span style="font-size:9.5px;font-weight:800;color:var(--accent);margin-left:6px;">🔒 FROZEN</span>`;
      const statusPill = isPending
        ? `<span class="grade-tag" style="background:rgba(56,189,248,0.18);color:var(--blue);">PENDING</span>`
        : `<span class="grade-tag ${isWin ? 'won' : 'lost'}">${isWin ? 'WIN' : 'LOSS'}</span>`;
      const borderCol = isPending ? 'rgba(56,189,248,0.35)' : (isWin ? 'rgba(0,210,133,0.4)' : 'rgba(239,68,68,0.4)');

      return `
        <div class="game-card" onclick="openArchivedGameDetail('${g.league || ''}', '${g.id || ''}', '${targetDate}')" style="cursor:pointer;opacity:${isFallback ? '0.68' : '1'};border-color:${borderCol};">
          <div class="card-top">
            <div class="card-meta">
              <span class="league-tag">${g.league || 'SPORT'}</span>
              ${statusPill}
              ${g.final_score ? `<span class="meta-text">Final: ${g.final_score}</span>` : ''}
            </div>
            <span style="font-size:12px;font-weight:800;color:var(--blue);">${conf || 55}% CONF</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <strong style="font-size:14px;">${g.matchup || `Game #${g.id}`}</strong>
            <span style="font-size:11px;color:var(--blue);font-weight:700;">Details ›</span>
          </div>
          <div style="font-size:12px;margin-bottom:4px;">Pick: <strong style="color:var(--accent);">${pickName}</strong>${qualityBadge}</div>
          <div style="font-size:10.5px;color:var(--text-dim);margin-bottom:8px;">⚖️ ${weightLine}</div>
          <div style="background:var(--surface-2);border-radius:10px;padding:8px;font-size:11px;">
            <strong style="color:var(--accent);">🧠 ${isPending ? 'Lock Status' : 'Autopsy'}:</strong> <span style="color:var(--text-muted);">${detFactors.length && !isFallback && !isPending ? detFactors[0] + ' · ' : ''}${lesson}</span>
          </div>
        </div>
      `;
    }).join('');

    const pct = verifiedTotal ? ((verifiedWins / verifiedTotal) * 100).toFixed(1) : '0.0';
    const recordHeader = isUpcomingSlate
      ? `${pendingLockedGames.length} Pre-Game Locks`
      : verifiedTotal > 0
      ? `${verifiedWins}-${verifiedTotal - verifiedWins} (${pct}%)`
      : fallbackCount > 0
      ? `Quarantined (${fallbackCount} Fallbacks)`
      : '0 Games';

    const notice = (!hasExact && pickerVal)
      ? `<div class="proof-item warn" style="font-size:11px;"><strong>${pickerVal}</strong> predates your automated archive. Showing latest graded slate (<strong>${targetDate}</strong>).</div>`
      : isUpcomingSlate
      ? `<div class="proof-item" style="font-size:11px;border-color:rgba(56,189,248,0.4);">🔒 Today's games are locked pre-game with active weights &amp; Gematria. They will grade automatically once finished.</div>`
      : (fallbackCount > 0 && verifiedTotal === 0)
      ? `<div class="proof-item warn" style="font-size:11px;">⚠ This slate was captured post-game before pre-game locking was enabled. All ${fallbackCount} rows are quarantined from AI tuning.</div>`
      : '';

    body.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
        <label style="font-size:11px;font-weight:700;color:var(--text-muted);">Archived Slate:</label>
        <select class="form-input" style="height:34px;flex:1;" onchange="openGradedAuditModal(this.value)">
          ${allDates.map((d) => {
            const hasFin = completedDates.includes(d);
            return `<option value="${d}" ${d === targetDate ? 'selected' : ''}>${d}${hasFin ? '' : ' (Locked Pre-Game)'}</option>`;
          }).join('')}
        </select>
      </div>
      ${notice}
      <div class="proof-item arb-box">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>🔒 Frozen Slate: ${targetDate}</strong>
          <strong style="font-size:15px;">${recordHeader}</strong>
        </div>
        <div class="proof-sub">Default Slate Weights: ${w.gem ?? 10}% Sig · ${w.h2h ?? 60}% Odds · ${w.ros ?? 30}% Form</div>
      </div>
      ${cardsHtml || '<p class="proof-sub">No games archived for this date.</p>'}
    `;
  };

  // --- 2. OWNER COMMAND CENTER ---
  window.switchOwnerTab = (tab) => { ownerTab = tab; renderOwnerModal(); };
  window.selectOwnerReportDate = (d) => { selectedReportDate = d; renderOwnerModal(); };

  window.setProposalDecision = async (propId, decision) => {
    const prop = proposalMap[propId] || {};
    const existing = approvalState[propId] || {};
    const noteEl = document.getElementById(`prop-note-${propId}`);
    const notes = noteEl ? noteEl.value.trim() : (decision === 'COMPLETED' ? 'Completed by Owner' : (existing.notes || ''));
    const title = prop.title || existing.title || propId;
    const changeSpec = prop.change_spec || existing.change_spec || null;

    approvalState[propId] = {
      ...existing,
      title,
      decision,
      status: decision === 'COMPLETED' ? 'COMPLETED' : (decision === 'APPROVED' ? 'QUEUED_FOR_EXECUTION' : decision),
      notes,
      change_spec: changeSpec,
      syncing: true,
      syncedToGitHub: false,
      workflowTriggered: false,
      syncError: null,
      updated_at: new Date().toISOString()
    };
    localStorage.setItem('aligniq_owner_approvals', JSON.stringify(approvalState));
    renderOwnerModal();

    if (typeof window.ownerWorkerCall === 'function') {
      try {
        const res = await window.ownerWorkerCall('/admin/approve', 'POST', {
          proposalId: propId,
          title,
          decision,
          notes,
          changeSpec
        });
        approvalState[propId].syncing = false;
        approvalState[propId].syncedToGitHub = Boolean(res && res.ok);
        approvalState[propId].workflowTriggered = Boolean(res && res.workflowTriggered);
        if (!res || !res.ok) {
          approvalState[propId].syncError = res?.error || res?.details || 'Sync failed';
        } else if (res.workflowTriggered) {
          setTimeout(() => {
            if (document.getElementById('owner-analytics-modal')?.classList.contains('open')) {
              renderOwnerModal();
            }
          }, 45000);
        }
      } catch (err) {
        approvalState[propId].syncing = false;
        approvalState[propId].syncError = err?.message || 'Network error';
      }
      localStorage.setItem('aligniq_owner_approvals', JSON.stringify(approvalState));
      renderOwnerModal();
    } else {
      approvalState[propId].syncing = false;
      approvalState[propId].syncError = 'Missing window.ownerWorkerCall in security.js';
      localStorage.setItem('aligniq_owner_approvals', JSON.stringify(approvalState));
      renderOwnerModal();
    }
  };

  window.openOwnerAnalyticsModal = async () => {
    if (!window.ALIGNIQ_IS_OWNER) return;
    document.getElementById('owner-analytics-modal').classList.add('open');
    await renderOwnerModal();
  };

  async function renderOwnerModal() {
    const body = document.getElementById('owner-analytics-body');
    if (!body) return;
    destroyCharts();
    body.innerHTML = '<p style="font-size:12px;color:var(--text-muted);">Loading Owner Command Center...</p>';

    const [rep, idx, remoteApprovals] = await Promise.all([
      fetchFresh('agent_report.json'),
      fetchFresh('daily_reports/index.json'),
      fetchFresh('owner_approvals.json')
    ]);

    if (remoteApprovals && typeof remoteApprovals === 'object') {
      for (const [k, v] of Object.entries(remoteApprovals)) {
        const local = approvalState[k];
        if (!local || (!local.syncing && new Date(v.updated_at || 0) >= new Date(local.updated_at || 0))) {
          approvalState[k] = { ...v, syncing: false, syncedToGitHub: true };
        }
      }
      localStorage.setItem('aligniq_owner_approvals', JSON.stringify(approvalState));
    }

    cachedReport = rep || {};
    const reportDates = idx?.dates || [];
    if (!selectedReportDate && reportDates.length) selectedReportDate = reportDates[0];
    const dailyRep = selectedReportDate ? await fetchFresh(`daily_reports/${selectedReportDate}.json`) : null;

    // Populate safe JS lookup map (avoids putting titles/quotes inside HTML onclick attributes)
    proposalMap = {};
    (dailyRep?.pending_proposals || []).forEach((p) => { if (p && p.id) proposalMap[p.id] = p; });

    const devQueueEntries = Object.entries(approvalState).filter(([, v]) =>
      v && (v.status === 'AWAITING_OWNER_CODE' || v.change_spec?.type === 'manual_code' || v.status === 'COMPLETED')
    );
    const openDevCount = devQueueEntries.filter(([, v]) => v.status !== 'COMPLETED' && v.decision === 'APPROVED').length;

    const tabsHtml = `
      <div class="tabs-row" style="margin-bottom:12px;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;">
        <button class="tab-btn ${ownerTab === 'overview' ? 'active' : ''}" style="font-size:10.5px;padding:6px 4px;" onclick="switchOwnerTab('overview')">📊 Overview</button>
        <button class="tab-btn ${ownerTab === 'reports' ? 'active' : ''}" style="font-size:10.5px;padding:6px 4px;" onclick="switchOwnerTab('reports')">📁 Reports</button>
        <button class="tab-btn ${ownerTab === 'approvals' ? 'active' : ''}" style="font-size:10.5px;padding:6px 4px;" onclick="switchOwnerTab('approvals')">✅ Approve (${(dailyRep?.pending_proposals || []).length})</button>
        <button class="tab-btn ${ownerTab === 'devqueue' ? 'active' : ''}" style="font-size:10.5px;padding:6px 4px;" onclick="switchOwnerTab('devqueue')">📋 Dev (${openDevCount})</button>
      </div>
    `;

    if (ownerTab === 'overview') {
      const s60 = cachedReport.summary_60d || { wins: 0, losses: 0, total: 0, win_rate: 0, underdogs: { wins: 0, losses: 0, win_rate: 0 }, leagues: {}, daily_trend: [] };
      const dog = s60.underdogs || { wins: 0, losses: 0, win_rate: 0 };
      const dogWins = dog.wins ?? dog.w ?? 0;
      const dogLosses = dog.losses ?? Math.max(0, (dog.n ?? 0) - dogWins);
      const gr = cachedReport.guardrails || { min_global_games: 500 };
      const samplePct = Math.min(100, Math.round((s60.total / gr.min_global_games) * 100));
      const w = cachedReport.weights || { gem: 10, h2h: 60, ros: 30 };

      const friendNote = s60.total === 0
        ? "We haven't graded any verified games yet—run your daily workflow once to start tracking."
        : `Across <b>${s60.total} verified games</b> in the last 60 days (excluding quarantined post-game fallbacks), AlignIQ is hitting <b>${s60.win_rate}%</b> (${s60.wins}-${s60.losses}). Underdogs are <b>${dogWins}-${dogLosses} (${dog.win_rate}%)</b>, and we're <b>${samplePct}%</b> of the way to our ${gr.min_global_games}-game guardrail.`;

      body.innerHTML = `${tabsHtml}
        <div style="display:flex;flex-direction:column;gap:12px;font-size:12px;">
          <div class="proof-item arb-box" style="margin:0;">
            <strong style="color:var(--accent);">💬 Plain-English Snapshot</strong>
            <div class="proof-sub" style="margin-top:4px;line-height:1.45;">${friendNote}</div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div class="proof-item" style="margin:0;">
              <div style="font-size:10px;color:var(--text-muted);font-weight:700;">VERIFIED 60-DAY RECORD</div>
              <div style="font-size:20px;font-weight:800;color:var(--accent);">${s60.win_rate}%</div>
              <div class="proof-sub">${s60.wins}-${s60.losses} (${s60.total} clean games)</div>
            </div>
            <div class="proof-item" style="margin:0;">
              <div style="font-size:10px;color:var(--text-muted);font-weight:700;">NET UNITS / ROI</div>
              <div style="font-size:20px;font-weight:800;color:var(--blue);">${s60.roi_pct != null ? (s60.roi_pct >= 0 ? '+' : '') + s60.roi_pct + '%' : 'Pending ML'}</div>
              <div class="proof-sub">${s60.net_units != null ? (s60.net_units >= 0 ? '+' : '') + s60.net_units + 'u' : 'Needs closing odds'}</div>
            </div>
          </div>

          <div class="proof-item" style="margin:0;">
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px;">
              <strong>⚖️ Active Model Mix</strong>
              <span style="color:var(--text-muted);">${w.gem}% Signals · ${w.h2h}% Odds · ${w.ros}% Form</span>
            </div>
            <div style="display:flex;height:8px;border-radius:999px;overflow:hidden;background:var(--bg);">
              <div style="width:${w.gem}%;background:#a78bfa;"></div>
              <div style="width:${w.h2h}%;background:#38bdf8;"></div>
              <div style="width:${w.ros}%;background:#00d285;"></div>
            </div>
          </div>

          <div class="proof-item" style="margin:0;border-color:rgba(245,158,11,0.4);">
            <div style="display:flex;justify-content:space-between;"><strong style="color:var(--amber);">🐶 Underdog Gate &amp; Sample Scale</strong><strong>${samplePct}% Ready</strong></div>
            <div style="height:6px;background:var(--bg);border-radius:999px;overflow:hidden;margin:6px 0;"><div style="height:100%;width:${samplePct}%;background:var(--amber);"></div></div>
            <div class="proof-sub">Underdogs: ${dogWins}-${dogLosses} (${dog.win_rate}%) · Clean Sample: ${s60.total}/${gr.min_global_games} games</div>
          </div>

          <div class="proof-item" style="margin:0;"><strong style="color:var(--blue);">📈 30-Day Verified Win Rate Trend</strong><canvas id="chart-trend" height="145" style="margin-top:8px;"></canvas></div>
          <div class="proof-item" style="margin:0;"><strong style="color:var(--accent);">🏆 Verified Win Rate by League</strong><canvas id="chart-leagues" height="145" style="margin-top:8px;"></canvas></div>
        </div>
      `;

      if (typeof window.Chart === 'function') {
        const baseOpts = { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#8b95a5', font: { size: 9 } }, grid: { display: false } }, y: { min: 0, max: 100, ticks: { color: '#8b95a5', font: { size: 9 } }, grid: { color: 'rgba(148,163,184,0.1)' } } } };
        const trend = s60.daily_trend || [];
        activeCharts.push(new Chart(document.getElementById('chart-trend'), { type: 'line', data: { labels: trend.map(d => d.date.slice(5)), datasets: [{ data: trend.map(d => d.win_rate), borderColor: '#00d285', backgroundColor: 'rgba(0,210,133,0.12)', fill: true, tension: 0.35 }] }, options: baseOpts }));
        const lgKeys = Object.keys(s60.leagues || {});
        activeCharts.push(new Chart(document.getElementById('chart-leagues'), { type: 'bar', data: { labels: lgKeys.length ? lgKeys : ['Pending'], datasets: [{ data: lgKeys.length ? lgKeys.map(k => s60.leagues[k].win_rate) : [0], backgroundColor: '#38bdf8', borderRadius: 6 }] }, options: baseOpts }));
      }
    } else if (ownerTab === 'reports') {
      if (!dailyRep) { body.innerHTML = `${tabsHtml}<div class="proof-item warn">Run your GitHub Action once to generate today's report.</div>`; return; }
      const ha = dailyRep.app_health_audit || {};
      const pa = dailyRep.performance_analysis || {};
      const ba = dailyRep.before_and_after_performance || [];
      const ci = dailyRep.competitor_intel?.competitors_tracked || [];
      const pb = dailyRep.plain_english_brief || {};
      const di = dailyRep.data_integrity || {};
      const factors = Object.values(pa.factor_attribution || {});
      const cal = Object.entries(pa.calibration || {});
      const hits = pa.biggest_successes || [];
      const misses = pa.biggest_failures || [];
      const score = dailyRep.investor_audit_score ?? 80;
      const scoreColor = score >= 85 ? 'var(--accent)' : score >= 65 ? 'var(--amber)' : 'var(--danger)';

      body.innerHTML = `${tabsHtml}
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
          <label style="font-size:11px;font-weight:700;color:var(--text-muted);">Archived Date (${reportDates.length}):</label>
          <select class="form-input" style="height:34px;flex:1;" onchange="selectOwnerReportDate(this.value)">${reportDates.map(d => `<option value="${d}" ${d === selectedReportDate ? 'selected' : ''}>${d}</option>`).join('')}</select>
        </div>

        <div class="proof-item arb-box">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="color:var(--accent);">🏛️ Investor Audit Score</strong>
            <strong style="font-size:16px;color:${scoreColor};">${score}/100</strong>
          </div>
          <div style="height:7px;background:var(--bg);border-radius:999px;overflow:hidden;margin:6px 0 8px;">
            <div style="height:100%;width:${score}%;background:${scoreColor};"></div>
          </div>
          <div class="proof-sub" style="line-height:1.45;"><b>The Bottom Line:</b> ${pb.headline || dailyRep.chief_auditor_critique || ''}</div>
          ${pb.what_worked ? `<div class="proof-sub" style="margin-top:4px;color:var(--accent);"><b>What Worked:</b> ${pb.what_worked}</div>` : ''}
          ${pb.watch_out ? `<div class="proof-sub" style="margin-top:4px;color:var(--amber);"><b>Watch Out For:</b> ${pb.watch_out}</div>` : ''}
          <div class="proof-sub" style="font-size:10px;color:var(--text-dim);margin-top:6px;">
            Config: <b>${dailyRep.algo_version || 'baseline'}</b> · Clean: ${di.verified_games_60d ?? pa.completed_games_analyzed ?? 0} · Quarantined: ${di.quarantined_fallbacks ?? 0} · Updated: ${dailyRep.generated_at ? new Date(dailyRep.generated_at).toLocaleString() : 'N/A'}
          </div>
        </div>

        <div class="proof-item">
          <strong style="color:var(--blue);">⚖️ What Actually Drove Wins (Factor Scale)</strong>
          <div class="proof-sub" style="margin-bottom:8px;">Shows how often each pillar won when it backed our pick (and its solo accuracy on its own).</div>
          ${factors.length ? `<canvas id="chart-daily-factors" height="125" style="margin-bottom:8px;"></canvas>` : ''}
          ${factors.length ? factors.map(f => `
            <div style="margin-bottom:6px;">
              <div style="display:flex;justify-content:space-between;font-size:11px;">
                <span>${f.label}</span>
                <span><b>${f.win_rate}%</b> (${f.agree_w}/${f.agree_n}) · Solo: ${f.solo_win_rate ?? 0}%</span>
              </div>
              <div style="height:5px;background:var(--bg);border-radius:999px;overflow:hidden;margin-top:2px;">
                <div style="height:100%;width:${clamp(f.win_rate)}%;background:${f.lift_vs_avg >= 0 ? 'var(--accent)' : 'var(--amber)'};"></div>
              </div>
            </div>
          `).join('') : '<div class="proof-sub">Run daily_agents.yml to populate factor attribution.</div>'}
        </div>

        ${cal.length ? `
          <div class="proof-item">
            <strong style="color:var(--accent);">🎯 Confidence Calibration (Is High Conf Winning More?)</strong>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px;">
              ${cal.map(([tier, m]) => `
                <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:6px;text-align:center;">
                  <div style="font-size:10px;color:var(--text-muted);">${tier}</div>
                  <div style="font-size:14px;font-weight:800;color:var(--blue);">${m.win_rate}%</div>
                  <div style="font-size:10px;color:var(--text-dim);">${m.wins}/${m.total}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${(hits.length || misses.length) ? `
          <div class="proof-item">
            <strong style="color:var(--blue);">🏆 Biggest Hits &amp; Misses (Tap for Full ESPN Boxscore)</strong>
            ${hits.slice(0, 3).map(h => `<div class="proof-sub" style="color:var(--accent);cursor:pointer;padding:3px 0;" onclick="closeModal('owner-analytics-modal'); openGradedAuditModal('${h.date}')">✓ ${h.league} ${h.matchup} (${h.confidence}% conf · ${h.score}) ↗</div>`).join('')}
            ${misses.slice(0, 3).map(m => `<div class="proof-sub" style="color:var(--danger);cursor:pointer;padding:3px 0;" onclick="closeModal('owner-analytics-modal'); openGradedAuditModal('${m.date}')">✕ ${m.league} ${m.matchup} (${m.confidence}% conf · ${m.score}) ↗</div>`).join('')}
          </div>
        ` : ''}

        ${ba.length ? `
          <div class="proof-item">
            <strong style="color:var(--accent);">📈 Implemented Changes (Before &amp; After)</strong>
            ${ba.map(c => `
              <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:8px;margin-top:6px;font-size:11px;">
                <strong>[${c.category || 'ALGO'}] ${c.title || c.proposal_id}</strong> · <span style="color:var(--blue);">${c.impact}</span>
                <div class="proof-sub">Baseline: ${c.baseline_wr}% → Current: ${c.current_wr}%</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${ci.length ? `
          <div class="proof-item">
            <strong style="color:var(--blue);">🕵️ Competitor Intelligence</strong>
            ${ci.map(c => `
              <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:8px;margin-top:6px;font-size:11px;">
                <strong>${c.name}</strong>
                <div class="proof-sub"><b>Our Edge:</b> ${c.aligniq_edge}</div>
                <div class="proof-sub" style="color:var(--amber);"><b>Gap to Close:</b> ${c.gap_to_close}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="proof-item ${ha.status === 'HEALTHY' ? '' : 'warn'}">
          <strong>🩺 App Health Audit: ${ha.status || 'OK'}</strong>
          <ul style="margin:6px 0 0 16px;padding:0;font-size:11.5px;color:var(--text-muted);">
            ${(ha.passed || []).map(x => `<li style="color:var(--accent);">✓ ${x}</li>`).join('')}
            ${(ha.issues || []).map(x => `<li style="color:var(--amber);">⚠ ${x}</li>`).join('')}
          </ul>
        </div>
      `;

      if (factors.length && typeof window.Chart === 'function') {
        activeCharts.push(new Chart(document.getElementById('chart-daily-factors'), {
          type: 'bar',
          data: {
            labels: factors.map(f => f.label),
            datasets: [{ data: factors.map(f => f.win_rate), backgroundColor: ['#a78bfa', '#38bdf8', '#00d285'], borderRadius: 6 }]
          },
          options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#8b95a5', font: { size: 9 } }, grid: { display: false } }, y: { min: 0, max: 100, ticks: { color: '#8b95a5', font: { size: 9 } }, grid: { color: 'rgba(148,163,184,0.1)' } } } }
        }));
      }
    } else if (ownerTab === 'approvals') {
      const props = dailyRep?.pending_proposals || [];
      body.innerHTML = `${tabsHtml}
        <div class="proof-item arb-box" style="font-size:11.5px;">
          <strong>🔒 Owner Approval Gate</strong><br/>
          <span style="color:var(--accent);">🤖 AGENT AUTO</span> updates go live in ~45s. <span style="color:var(--amber);">🛠️ YOUR CODE</span> updates archive to your <b>📋 Dev</b> tab so you can build &amp; check them off.
        </div>
        ${props.length ? props.map(p => {
          const st = approvalState[p.id] || {};
          const isManual = p.execution_type === 'OWNER_CODE' || p.change_spec?.type === 'manual_code';
          const execBadge = isManual
            ? `<span style="font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:999px;background:rgba(245,158,11,0.18);color:var(--amber);border:1px solid rgba(245,158,11,0.4);">🛠️ REQUIRES YOUR CODE</span>`
            : `<span style="font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:999px;background:rgba(0,210,133,0.15);color:var(--accent);border:1px solid rgba(0,210,133,0.4);">🤖 AGENT AUTO-APPLIES</span>`;
          const displayStatus = st.status === 'IMPLEMENTED' ? 'IMPLEMENTED' : st.status === 'AWAITING_OWNER_CODE' ? 'IN DEV QUEUE' : (st.decision || 'PENDING');
          const statusBadge = st.decision
            ? `<span style="font-size:10px;font-weight:800;color:${st.decision === 'APPROVED' ? 'var(--accent)' : st.decision === 'REJECTED' ? 'var(--danger)' : 'var(--amber)'};">${displayStatus}</span>`
            : `<span style="font-size:10px;font-weight:800;color:var(--blue);">PENDING</span>`;
          const syncTag = st.syncing
            ? `<div style="font-size:10px;color:var(--blue);margin-top:4px;">⏳ Syncing to GitHub...</div>`
            : st.status === 'IMPLEMENTED'
            ? `<div style="font-size:10px;color:var(--accent);margin-top:4px;">✓ Live in algo_config.json</div>`
            : st.status === 'AWAITING_OWNER_CODE'
            ? `<div style="font-size:10px;color:var(--amber);margin-top:4px;">📋 Archived in your Dev Queue tab</div>`
            : st.workflowTriggered
            ? `<div style="font-size:10px;color:var(--accent);margin-top:4px;">✓ Synced &amp; Agent running (~45s)</div>`
            : st.syncedToGitHub
            ? `<div style="font-size:10px;color:var(--accent);margin-top:4px;">✓ Synced to GitHub (owner_approvals.json)</div>`
            : st.syncError
            ? `<div style="font-size:10px;color:var(--danger);margin-top:4px;">⚠ ${escapeHtml(st.syncError)}</div>`
            : '';
          return `
            <div class="proof-item">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                ${execBadge}
                ${statusBadge}
              </div>
              <strong style="font-size:13px;">${p.category ? `[${escapeHtml(p.category)}] ` : ''}${escapeHtml(p.title)}</strong>
              ${syncTag}
              <div class="proof-sub" style="margin:6px 0 8px;line-height:1.4;">${escapeHtml(p.description)}</div>
              <div style="margin-bottom:10px;">${p.visual_preview_html || ''}</div>
              <input id="prop-note-${p.id}" class="form-input" style="height:34px;font-size:12px;margin-bottom:8px;" value="${escapeHtml(st.notes || '')}" placeholder="Add your notes or requested tweaks..." />
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
                <button class="icon-btn accent" onclick="setProposalDecision('${p.id}', 'APPROVED')">✓ Approve</button>
                <button class="icon-btn" style="border-color:var(--amber);color:var(--amber);" onclick="setProposalDecision('${p.id}', 'CHANGES REQUESTED')">✎ Modify</button>
                <button class="icon-btn" style="border-color:var(--danger);color:var(--danger);" onclick="setProposalDecision('${p.id}', 'REJECTED')">✕ Reject</button>
              </div>
            </div>
          `;
        }).join('') : '<div class="proof-item">All caught up! No pending proposals right now.</div>'}
      `;
    } else {
      const activeItems = devQueueEntries.filter(([, v]) => v.status !== 'COMPLETED' && v.decision === 'APPROVED');
      const doneItems = devQueueEntries.filter(([, v]) => v.status === 'COMPLETED');

      body.innerHTML = `${tabsHtml}
        <div class="proof-item arb-box" style="font-size:11.5px;">
          <strong>📋 Your Code Update Checklist</strong><br/>
          Approved updates that require manual repo edits are archived here. Once you push the code, tap <b>✓ Mark Completed</b> to check them off.
        </div>

        <strong style="font-size:11px;color:var(--amber);display:block;margin:8px 0 6px;">🛠️ TO BUILD (${activeItems.length})</strong>
        ${activeItems.length ? activeItems.map(([id, v]) => `
          <div class="proof-item" style="border-color:rgba(245,158,11,0.45);">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
              <strong>${escapeHtml(v.title || id)}</strong>
              <span style="font-size:9.5px;color:var(--amber);font-weight:800;">OPEN</span>
            </div>
            ${v.change_spec?.target_files ? `<div class="proof-sub" style="color:var(--blue);margin-top:4px;">Files: <code>${escapeHtml(v.change_spec.target_files.join(', '))}</code></div>` : ''}
            ${v.notes ? `<div class="proof-sub" style="margin-top:4px;"><b>Your Note:</b> ${escapeHtml(v.notes)}</div>` : ''}
            <div class="proof-sub" style="font-size:10px;color:var(--text-dim);margin:4px 0 8px;">Approved: ${v.updated_at ? new Date(v.updated_at).toLocaleDateString() : 'Recently'}</div>
            <button class="icon-btn accent" style="width:100%;" onclick="setProposalDecision('${id}', 'COMPLETED')">✓ Mark Completed</button>
          </div>
        `).join('') : '<div class="proof-item"><div class="proof-sub">No open code tasks—you’re all caught up!</div></div>'}

        ${doneItems.length ? `
          <strong style="font-size:11px;color:var(--accent);display:block;margin:12px 0 6px;">✅ COMPLETED (${doneItems.length})</strong>
          ${doneItems.map(([id, v]) => `
            <div class="proof-item" style="opacity:0.7;">
              <div style="display:flex;justify-content:space-between;">
                <strong style="text-decoration:line-through;">${escapeHtml(v.title || id)}</strong>
                <span style="font-size:10px;color:var(--accent);font-weight:800;">DONE ✓</span>
              </div>
              <div class="proof-sub" style="font-size:10px;">Checked off: ${v.updated_at ? new Date(v.updated_at).toLocaleDateString() : ''}</div>
            </div>
          `).join('')}
        ` : ''}
      `;
    }
  }
})();