(function () {
  let activeCharts = [];
  let cachedHistory = null;
  let cachedReport = null;
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

  function escapeAttr(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function scoreHistoryGame(g, fallbackWeights) {
    const w = (g.weights_used && typeof g.weights_used.h2h === 'number')
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

  window.openArchivedGameDetail = async (league, gameId, dateStr) => {
    const body = document.getElementById('graded-audit-body');
    if (!body) return;
    body.innerHTML = `<p style="font-size:12px;color:var(--text-muted);">Pulling full post-game boxscore &amp; analytics from ESPN...</p>`;

    const snap = cachedHistory?.dates?.[dateStr];
    const g = (snap?.games || []).find((x) => String(x.id) === String(gameId)) || {};
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
    const finalScore = (awayC && homeC) ? `${awayC.score ?? ''} - ${homeC.score ?? ''}` : (g.final_score || 'Final');

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
      : '<div class="proof-sub">Detailed team boxscore not published by ESPN for this event.</div>';

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
        <div style="font-size:18px;font-weight:800;color:var(--text);">Final: ${finalScore}</div>
      </div>

      <div class="proof-item">
        <strong style="color:var(--blue);">⚖️ Determining Factors &amp; Model Autopsy</strong>
        <div class="proof-sub">${(autopsy.determining_factors || ['Multi-pillar composite']).join(' · ')}</div>
        <div class="proof-sub" style="color:var(--accent);margin-top:6px;"><strong>🧠 Agent Learned:</strong> ${autopsy.lesson_learned || 'Logged into 60-day learning dataset.'}</div>
      </div>

      <div class="proof-item">
        <strong>📊 Full Post-Game Team Stats</strong>
        <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--blue);font-weight:800;margin:6px 0 4px;">
          <span>${boxTeams[0]?.team?.abbreviation || 'AWAY'}</span><span>STAT</span><span>${boxTeams[1]?.team?.abbreviation || 'HOME'}</span>
        </div>
        ${statsHtml}
      </div>

      ${leadersHtml ? `<div class="proof-item"><strong>⭐ Top Game Performers</strong>${leadersHtml}</div>` : ''}
    `;
  };

  window.openGradedAuditModal = async (overrideDate = null) => {
    const modal = document.getElementById('graded-audit-modal');
    const body = document.getElementById('graded-audit-body');
    if (!modal || !body) return;
    modal.classList.add('open');
    body.innerHTML = '<p style="font-size:12px;color:var(--text-muted);">Loading post-game autopsy cards...</p>';

    cachedHistory = await fetchFresh('history.json');
    const allDates = Object.keys(cachedHistory?.dates || {}).sort().reverse();
    const pickerVal = overrideDate || document.getElementById('date-picker')?.value;
    const hasExact = Boolean(pickerVal && cachedHistory?.dates?.[pickerVal]);
    const targetDate = hasExact ? pickerVal : allDates[0];

    if (!targetDate || !cachedHistory?.dates?.[targetDate]) {
      body.innerHTML = '<p class="proof-sub">No archived graded slates found yet. Go to GitHub → Actions → Run workflow once.</p>';
      return;
    }

    const snap = cachedHistory.dates[targetDate];
    const w = snap.weights_used || { gem: 10, h2h: 60, ros: 30 };
    const games = (snap.games || []).filter((g) => g.result || g.actual_winner);

    let wins = 0;
    const cardsHtml = games.map((g) => {
      const actual = String(g.actual_winner || '').toLowerCase().trim();
      let pickSide = String(g.original_pick || g.pick || '').toLowerCase().trim();
      let conf = g.original_confidence || g.confidence;
      let isWin = false;

      if (actual === 'home' || actual === 'away') {
        const scored = scoreHistoryGame(g, w);
        if (pickSide !== 'home' && pickSide !== 'away') pickSide = scored.pick;
        if (!conf) conf = scored.confidence;
        isWin = pickSide === actual;
      } else {
        isWin = ['W', 'WIN'].includes(String(g.result || '').toUpperCase());
      }
      if (isWin) wins++;

      const autopsy = g.autopsy || {};
      const detFactors = autopsy.determining_factors || [];
      const lesson = autopsy.lesson_learned || 'Tap card to inspect full ESPN post-game boxscore & stats.';
      const pickName = pickSide === 'home' ? (g.home?.name || 'Home') : (g.away?.name || 'Away');

      return `
        <div class="game-card" onclick="openArchivedGameDetail('${g.league || ''}', '${g.id || ''}', '${targetDate}')" style="cursor:pointer;border-color:${isWin ? 'rgba(0,210,133,0.4)' : 'rgba(239,68,68,0.4)'};">
          <div class="card-top">
            <div class="card-meta">
              <span class="league-tag">${g.league || 'SPORT'}</span>
              <span class="grade-tag ${isWin ? 'won' : 'lost'}">${isWin ? 'WIN' : 'LOSS'}</span>
              ${g.final_score ? `<span class="meta-text">Final: ${g.final_score}</span>` : ''}
            </div>
            <span style="font-size:12px;font-weight:800;color:var(--blue);">${conf || 55}% CONF</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <strong style="font-size:14px;">${g.matchup || `Game #${g.id}`}</strong>
            <span style="font-size:11px;color:var(--blue);font-weight:700;">Full Boxscore ›</span>
          </div>
          <div style="font-size:12px;margin-bottom:8px;">Pick: <strong style="color:var(--accent);">${pickName}</strong></div>
          <div style="background:var(--surface-2);border-radius:10px;padding:8px;font-size:11px;">
            <strong style="color:var(--accent);">🧠 Autopsy:</strong> <span style="color:var(--text-muted);">${detFactors.length ? detFactors[0] + ' · ' : ''}${lesson}</span>
          </div>
        </div>
      `;
    }).join('');

    const pct = games.length ? ((wins / games.length) * 100).toFixed(1) : '0.0';
    const notice = (!hasExact && pickerVal)
      ? `<div class="proof-item warn" style="font-size:11px;">Run your GitHub Action once to archive <strong>${pickerVal}</strong>. Showing latest archived slate (<strong>${targetDate}</strong>).</div>`
      : '';

    body.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
        <label style="font-size:11px;font-weight:700;color:var(--text-muted);">Archived Slate:</label>
        <select class="form-input" style="height:34px;flex:1;" onchange="openGradedAuditModal(this.value)">
          ${allDates.map((d) => `<option value="${d}" ${d === targetDate ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
      </div>
      ${notice}
      <div class="proof-item arb-box">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>🔒 Frozen Slate: ${targetDate}</strong>
          <strong style="font-size:15px;">${wins}-${games.length - wins} (${pct}%)</strong>
        </div>
        <div class="proof-sub">Tap any game below for full ESPN boxscore &amp; post-game stats</div>
      </div>
      ${cardsHtml || '<p class="proof-sub">No completed games archived for this date.</p>'}
    `;
  };

  // --- OWNER COMMAND CENTER ---
  window.switchOwnerTab = (tab) => { ownerTab = tab; renderOwnerModal(); };
  window.selectOwnerReportDate = (d) => { selectedReportDate = d; renderOwnerModal(); };

  window.setProposalDecision = async (propId, decision, title = '', changeSpecB64 = '') => {
    const noteEl = document.getElementById(`prop-note-${propId}`);
    const notes = noteEl ? noteEl.value.trim() : '';
    let changeSpec = null;
    try { if (changeSpecB64) changeSpec = JSON.parse(atob(changeSpecB64)); } catch {}

    approvalState[propId] = {
      ...(approvalState[propId] || {}),
      title: title || propId,
      decision,
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
          title: title || propId,
          decision,
          notes,
          changeSpec
        });
        approvalState[propId].syncing = false;
        approvalState[propId].syncedToGitHub = Boolean(res && res.ok);
        approvalState[propId].workflowTriggered = Boolean(res && res.workflowTriggered);
        if (!res || !res.ok) {
          approvalState[propId].syncError = res?.error || 'Sync failed';
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

    const tabsHtml = `
      <div class="tabs-row" style="margin-bottom:12px;">
        <button class="tab-btn ${ownerTab === 'overview' ? 'active' : ''}" onclick="switchOwnerTab('overview')">📊 Overview &amp; ROI</button>
        <button class="tab-btn ${ownerTab === 'reports' ? 'active' : ''}" onclick="switchOwnerTab('reports')">📁 Daily Reports</button>
        <button class="tab-btn ${ownerTab === 'approvals' ? 'active' : ''}" onclick="switchOwnerTab('approvals')">✅ Approvals (${(dailyRep?.pending_proposals || []).length})</button>
      </div>
    `;

    if (ownerTab === 'overview') {
      const s60 = cachedReport.summary_60d || { wins: 0, losses: 0, total: 0, win_rate: 0, underdogs: { wins: 0, losses: 0, win_rate: 0 }, leagues: {}, daily_trend: [] };
      const dog = s60.underdogs || { wins: 0, losses: 0, win_rate: 0, roi_pct: null };
      const gr = cachedReport.guardrails || { min_global_games: 500 };
      const samplePct = Math.min(100, Math.round((s60.total / gr.min_global_games) * 100));

      body.innerHTML = `${tabsHtml}
        <div style="display:flex;flex-direction:column;gap:12px;font-size:12px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div class="proof-item" style="margin:0;">
              <div style="font-size:10px;color:var(--text-muted);font-weight:700;">60-DAY RECORD</div>
              <div style="font-size:20px;font-weight:800;color:var(--accent);">${s60.win_rate}%</div>
              <div class="proof-sub">${s60.wins}-${s60.losses} (${s60.total} games)</div>
            </div>
            <div class="proof-item" style="margin:0;">
              <div style="font-size:10px;color:var(--text-muted);font-weight:700;">NET UNITS / ROI</div>
              <div style="font-size:20px;font-weight:800;color:var(--blue);">${s60.roi_pct != null ? (s60.roi_pct >= 0 ? '+' : '') + s60.roi_pct + '%' : 'Pending ML'}</div>
              <div class="proof-sub">${s60.net_units != null ? (s60.net_units >= 0 ? '+' : '') + s60.net_units + 'u' : 'Log moneylines'}</div>
            </div>
          </div>
          <div class="proof-item" style="margin:0;border-color:rgba(245,158,11,0.4);">
            <div style="display:flex;justify-content:space-between;"><strong style="color:var(--amber);">🐶 Underdog Gate</strong><strong>${dog.wins}-${dog.losses} (${dog.win_rate}%)</strong></div>
            <div class="proof-sub">Guardrail: ${s60.total}/${gr.min_global_games} games (${samplePct}%)</div>
          </div>
          <div class="proof-item" style="margin:0;"><strong style="color:var(--blue);">📈 30-Day Win Rate Trend</strong><canvas id="chart-trend" height="145" style="margin-top:8px;"></canvas></div>
          <div class="proof-item" style="margin:0;"><strong style="color:var(--accent);">🏆 League Win Rates</strong><canvas id="chart-leagues" height="145" style="margin-top:8px;"></canvas></div>
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
      const factors = Object.values(pa.factor_attribution || {});
      const cal = Object.entries(pa.calibration || {});
      const hits = pa.biggest_successes || [];
      const misses = pa.biggest_failures || [];

      body.innerHTML = `${tabsHtml}
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
          <label style="font-size:11px;font-weight:700;color:var(--text-muted);">Report Date:</label>
          <select class="form-input" style="height:34px;flex:1;" onchange="selectOwnerReportDate(this.value)">${reportDates.map(d => `<option value="${d}" ${d === selectedReportDate ? 'selected' : ''}>${d}</option>`).join('')}</select>
        </div>

        <div class="proof-item arb-box">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="color:var(--accent);">🏛️ Investor Audit Score</strong>
            <strong style="font-size:16px;">${dailyRep.investor_audit_score ?? '—'}/100</strong>
          </div>
          <div class="proof-sub" style="margin-top:4px;">${dailyRep.chief_auditor_critique || ''}</div>
          <div class="proof-sub" style="font-size:10.5px;color:var(--text-dim);margin-top:4px;">
            Config: <b>${dailyRep.algo_version || 'baseline'}</b> · Updated: ${dailyRep.generated_at ? new Date(dailyRep.generated_at).toLocaleString() : 'N/A'}
          </div>
        </div>

        <div class="proof-item">
          <strong style="color:var(--blue);">⚖️ Factor Attribution &amp; Bias</strong>
          ${factors.length ? factors.map(f => `
            <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);font-size:11.5px;">
              <span>${f.label}</span>
              <span><b>${f.win_rate}%</b> (${f.agree_w}/${f.agree_n}) · <span style="color:${f.lift_vs_avg >= 0 ? 'var(--accent)' : 'var(--danger)'};">${f.lift_vs_avg >= 0 ? '+' : ''}${f.lift_vs_avg}%</span></span>
            </div>
          `).join('') : '<div class="proof-sub">Run daily_agents.yml to populate factor attribution.</div>'}
          <div class="proof-sub" style="margin-top:6px;"><b>Overvalued:</b> ${(pa.overvalued_factors || []).join(', ') || 'None'}</div>
          <div class="proof-sub"><b>Undervalued:</b> ${(pa.undervalued_factors || []).join(', ') || 'None'}</div>
        </div>

        ${cal.length ? `
          <div class="proof-item">
            <strong style="color:var(--accent);">🎯 Confidence Calibration</strong>
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
            <strong style="color:var(--blue);">🏆 Biggest Hits &amp; Misses</strong>
            ${hits.slice(0, 3).map(h => `<div class="proof-sub" style="color:var(--accent);">✓ ${h.league} ${h.matchup} (${h.confidence}% conf · ${h.score})</div>`).join('')}
            ${misses.slice(0, 3).map(m => `<div class="proof-sub" style="color:var(--danger);">✕ ${m.league} ${m.matchup} (${m.confidence}% conf · ${m.score})</div>`).join('')}
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
                <div class="proof-sub"><b>Edge:</b> ${c.aligniq_edge}</div>
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
    } else {
      const props = dailyRep?.pending_proposals || [];
      body.innerHTML = `${tabsHtml}
        <div class="proof-item arb-box" style="font-size:11.5px;"><strong>🔒 Owner Approval Gate Active</strong> — Approved weight &amp; feature changes execute via GitHub Actions automatically (~45s).</div>
        ${props.length ? props.map(p => {
          const st = approvalState[p.id] || {};
          const safeTitle = escapeAttr(p.title);
          const specB64 = btoa(JSON.stringify(p.change_spec || null));
          const displayStatus = st.status === 'IMPLEMENTED' ? 'IMPLEMENTED' : (st.decision || 'PENDING REVIEW');
          const catTag = p.category ? `<span style="font-size:9.5px;font-weight:800;color:var(--blue);margin-right:6px;">[${p.category}]</span>` : '';
          const badge = st.decision
            ? `<span style="font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;background:${st.decision === 'APPROVED' ? 'var(--accent-soft)' : st.decision === 'REJECTED' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'};color:${st.decision === 'APPROVED' ? 'var(--accent)' : st.decision === 'REJECTED' ? 'var(--danger)' : 'var(--amber)'};">${displayStatus}</span>`
            : `<span style="font-size:10px;font-weight:800;color:var(--blue);">PENDING REVIEW</span>`;
          const syncTag = st.syncing
            ? `<div style="font-size:10px;color:var(--blue);margin-top:4px;">⏳ Syncing to GitHub &amp; triggering agents...</div>`
            : st.status === 'IMPLEMENTED'
            ? `<div style="font-size:10px;color:var(--accent);margin-top:4px;">✓ Executed &amp; persisted to algo_config.json</div>`
            : st.workflowTriggered
            ? `<div style="font-size:10px;color:var(--accent);margin-top:4px;">✓ Synced &amp; GitHub Action triggered (refreshing in ~45s)</div>`
            : st.syncedToGitHub
            ? `<div style="font-size:10px;color:var(--accent);margin-top:4px;">✓ Synced to GitHub (owner_approvals.json)</div>`
            : st.syncError
            ? `<div style="font-size:10px;color:var(--danger);margin-top:4px;">⚠ Saved locally only: ${escapeAttr(st.syncError)}</div>`
            : '';
          return `
            <div class="proof-item">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <strong>${catTag}${p.title}</strong>
                ${badge}
              </div>
              ${syncTag}
              <div class="proof-sub" style="margin:6px 0 8px;">${p.description}</div>
              <div style="font-size:10px;font-weight:800;color:var(--blue);margin-bottom:4px;">👁️ VISUAL PREVIEW</div>
              <div style="margin-bottom:10px;">${p.visual_preview_html || ''}</div>
              <input id="prop-note-${p.id}" class="form-input" style="height:34px;font-size:12px;margin-bottom:8px;" value="${escapeAttr(st.notes || '')}" placeholder="Request changes (e.g. change color, move position)..." />
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
                <button class="icon-btn accent" onclick="setProposalDecision('${p.id}', 'APPROVED', '${safeTitle}', '${specB64}')">✓ Approve</button>
                <button class="icon-btn" style="border-color:var(--amber);color:var(--amber);" onclick="setProposalDecision('${p.id}', 'CHANGES REQUESTED', '${safeTitle}', '${specB64}')">✎ Modify</button>
                <button class="icon-btn" style="border-color:var(--danger);color:var(--danger);" onclick="setProposalDecision('${p.id}', 'REJECTED', '${safeTitle}', '${specB64}')">✕ Reject</button>
              </div>
            </div>
          `;
        }).join('') : '<div class="proof-item">No pending update proposals right now.</div>'}
      `;
    }
  }
})();