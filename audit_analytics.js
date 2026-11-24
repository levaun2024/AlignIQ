(function () {
  let activeCharts = [];
  let cachedHistory = null;
  let cachedReport = null;

  async function fetchFresh(file) {
    const res = await fetch(`./${file}?t=${Date.now()}`, { cache: 'no-store' });
    return res.ok ? res.json() : null;
  }

  function destroyCharts() {
    activeCharts.forEach((c) => { try { c.destroy(); } catch {} });
    activeCharts = [];
  }

  function gradeHistoryGame(g, snapWeights) {
    const resStr = String(g.result || g.outcome || g.grade || '').toUpperCase().trim();
    if (['W', 'L', 'WIN', 'LOSS'].includes(resStr)) {
      return {
        graded: true,
        isWin: ['W', 'WIN'].includes(resStr),
        matchup: g.matchup || `${g.away || 'Away'} @ ${g.home || 'Home'}`,
        pick: g.pick || 'Pick',
        confidence: g.confidence ?? 50,
        finalScore: g.final_score || '',
        isDog: Boolean(g.is_underdog_pick),
        gemHits: g.factors?.gematria_hits ?? 0,
        oddsEdge: g.factors?.odds_edge ?? 0,
        formScore: g.factors?.form_health_score ?? 0,
        refs: Array.isArray(g.factors?.references) ? g.factors.references : []
      };
    }

    const actual = String(g.actual_winner || '').toLowerCase().trim();
    if ((actual === 'home' || actual === 'away') && g.home && g.away) {
      const w = g.weights_used || snapWeights || { gem: 10, h2h: 60, ros: 30 };
      const normH2H = (v) => Math.max(0, Math.min(100, (((Number(v) || 50) - 36) / 32) * 100));
      const hScore = ((Number(g.home.gem || 0) * 0.85) * w.gem + normH2H(g.home.h2h) * w.h2h + Number(g.home.ros || 50) * w.ros) / 100;
      const aScore = ((Number(g.away.gem || 0) * 0.85) * w.gem + normH2H(g.away.h2h) * w.h2h + Number(g.away.ros || 50) * w.ros) / 100;
      let pick = hScore >= aScore ? 'home' : 'away';
      const dog = Number(g.home.h2h) === Number(g.away.h2h) ? null : (Number(g.home.h2h) < Number(g.away.h2h) ? 'home' : 'away');
      if (dog && pick === dog) {
        const d = g[pick], f = g[pick === 'home' ? 'away' : 'home'];
        const ok = Number(d.h2h) >= 44 && ((Number(d.ros) > Number(f.ros) && Number(d.gem) > Number(f.gem)) || (Number(d.ros) - Number(f.ros) >= 22));
        if (!ok) pick = pick === 'home' ? 'away' : 'home';
      }
      const conf = Math.min(99, Math.max(50, Math.round(50 + Math.abs(hScore - aScore) * 0.5)));
      return {
        graded: true,
        isWin: pick === actual,
        matchup: g.matchup || g.id || 'Matchup',
        pick: pick.toUpperCase(),
        confidence: conf,
        finalScore: g.final_score || '',
        isDog: Boolean(dog && pick === dog),
        gemHits: g[pick]?.gem > 0 ? 2 : 0,
        oddsEdge: Math.round((g[pick]?.h2h || 50) - (g[pick === 'home' ? 'away' : 'home']?.h2h || 50)),
        formScore: g[pick]?.ros ?? 50,
        refs: []
      };
    }
    return { graded: false };
  }

  // --- 1. CLICKABLE GRADED PICKS BANNER ---
  function wireGradedBanner() {
    const banner = document.getElementById('accuracy-banner');
    if (!banner || banner.dataset.auditWired) return;
    banner.dataset.auditWired = '1';
    banner.style.cursor = 'pointer';
    banner.title = 'Tap to inspect all graded picks, locked percentages & references';
    banner.addEventListener('click', () => window.openGradedAuditModal());
  }
  wireGradedBanner();
  setInterval(wireGradedBanner, 1500);

  window.openGradedAuditModal = async () => {
    const modal = document.getElementById('graded-audit-modal');
    const body = document.getElementById('graded-audit-body');
    if (!modal || !body) return;
    modal.classList.add('open');
    body.innerHTML = '<p class="muted-note">Loading frozen audit record...</p>';

    cachedHistory = await fetchFresh('history.json');
    const pickerVal = document.getElementById('date-picker')?.value;
    const allDates = Object.keys(cachedHistory?.dates || {}).sort().reverse();
    const targetDate = (pickerVal && cachedHistory?.dates?.[pickerVal]) ? pickerVal : allDates[0];

    if (!targetDate || !cachedHistory?.dates?.[targetDate]) {
      body.innerHTML = '<p class="muted-note">No archived graded games found for this date yet.</p>';
      return;
    }

    const snap = cachedHistory.dates[targetDate];
    const w = snap.weights_used || { gem: 10, h2h: 60, ros: 30 };
    const gradedGames = (snap.games || []).map((g) => ({ raw: g, g: gradeHistoryGame(g, w) })).filter((x) => x.g.graded);
    const wins = gradedGames.filter((x) => x.g.isWin).length;
    const pct = gradedGames.length ? ((wins / gradedGames.length) * 100).toFixed(1) : '0.0';

    body.innerHTML = `
      <div class="stack-gap">
        <div class="audit-card accent-border">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="color:var(--accent);">🔒 Frozen Slate: ${targetDate}</strong>
            <span style="font-weight:800;font-variant-numeric:tabular-nums;">${wins}-${gradedGames.length - wins} (${pct}%)</span>
          </div>
          <div class="muted-note" style="margin-top:4px;">
            Algo: <strong style="color:var(--blue);">${snap.algo_version || 'Locked'}</strong> ·
            Gem ${w.gem}% / Odds ${w.h2h}% / Form ${w.ros}%
          </div>
        </div>

        ${gradedGames.length ? gradedGames.map(({ raw, g }) => {
          const refs = g.refs.length
            ? g.refs.map((r) => `<span class="mini-pill">${r}</span>`).join(' ')
            : '<span class="muted-note" style="font-size:10px;">Normalized 3-pillar slate signals</span>';
          return `
            <div class="audit-subcard" style="border-color:${g.isWin ? 'var(--accent)' : 'var(--danger)'};">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong>${raw.league || ''} · ${g.matchup}</strong>
                <span style="font-weight:800;color:${g.isWin ? 'var(--accent)' : 'var(--danger)'};">${g.isWin ? 'WIN' : 'LOSS'}</span>
              </div>
              <div style="margin-top:4px;font-size:12px;">
                Pick: <strong>${g.pick}</strong>${g.isDog ? ' <span class="dog-pill">LIVE DOG</span>' : ''} · Conf: <strong style="color:var(--blue);">${g.confidence}%</strong>
                ${g.finalScore ? ` · Final: <strong>${g.finalScore}</strong>` : ''}
              </div>
              <div class="muted-note" style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap;">
                <span>✦ Gem: <b>${g.gemHits}</b></span>
                <span>📈 Odds Edge: <b>${g.oddsEdge > 0 ? '+' : ''}${g.oddsEdge}</b></span>
                <span>💪 Form/Health: <b>${g.formScore}</b></span>
              </div>
              <div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">${refs}</div>
            </div>
          `;
        }).join('') : '<p class="muted-note">Games on this date are pending final scores.</p>'}
      </div>
    `;
  };

  // --- 2. OWNER-ONLY EXECUTIVE ANALYTICS, CHARTS & ROI INTELLIGENCE ---
  window.openOwnerAnalyticsModal = async () => {
    if (!window.ALIGNIQ_IS_OWNER) return;
    const modal = document.getElementById('owner-analytics-modal');
    const body = document.getElementById('owner-analytics-body');
    if (!modal || !body) return;
    modal.classList.add('open');
    destroyCharts();
    body.innerHTML = '<p class="muted-note">Loading owner intelligence, ROI &amp; charts...</p>';

    cachedReport = await fetchFresh('agent_report.json');
    if (!cachedReport) {
      body.innerHTML = '<p style="color:var(--danger);font-size:12px;">Could not load agent_report.json. Run your GitHub Action once to initialize it.</p>';
      return;
    }

    const s60 = cachedReport.summary_60d || { wins: 0, losses: 0, total: 0, win_rate: 0, gap_to_target: 95, factors: {}, leagues: {}, calibration: {}, daily_trend: [], underdogs: { wins: 0, losses: 0, total: 0, win_rate: 0, roi_pct: null } };
    const w = cachedReport.weights || { gem: 10, h2h: 60, ros: 30 };
    const lwMap = cachedReport.league_weights || {};
    const guard = cachedReport.guardrails || { min_global_games: 500, min_league_games: 100, min_odds_for_roi: 50 };
    const target = cachedReport.target_win_rate || 95;
    const progressPct = Math.min(100, Math.round((s60.win_rate / target) * 100));
    const dog = s60.underdogs || { wins: 0, losses: 0, total: 0, win_rate: 0, roi_pct: null };
    const globalSamplePct = Math.min(100, Math.round(((s60.total || 0) / guard.min_global_games) * 100));
    const oddsSamplePct = Math.min(100, Math.round(((s60.graded_with_odds || 0) / guard.min_odds_for_roi) * 100));

    const leagueRows = Object.entries(s60.leagues || {}).map(([lg, lm]) => {
      const lw = lwMap[lg] || w;
      const roiTxt = lm.roi_pct != null ? `${lm.roi_pct >= 0 ? '+' : ''}${lm.roi_pct}%` : '—';
      const ready = lm.total >= guard.min_league_games ? '🟢' : `${lm.total}/${guard.min_league_games}`;
      return `
        <tr>
          <td><strong>${lg}</strong></td>
          <td>${lm.wins}-${lm.losses}</td>
          <td style="color:${lm.win_rate >= 65 ? 'var(--accent)' : lm.win_rate < 52 ? 'var(--danger)' : 'var(--text)'};font-weight:700;">${lm.win_rate}%</td>
          <td>${roiTxt}</td>
          <td>${lw.gem}/${lw.h2h}/${lw.ros}</td>
          <td>${ready}</td>
        </tr>
      `;
    }).join('');

    body.innerHTML = `
      <div class="stack-gap">
        <!-- KPI GRID -->
        <div class="kpi-grid">
          <div class="kpi-tile accent-border">
            <span class="kpi-label">60D WIN RATE</span>
            <strong class="kpi-val">${s60.win_rate}%</strong>
            <span class="kpi-sub">${s60.wins}-${s60.losses} (${s60.total} games)</span>
          </div>
          <div class="kpi-tile blue-border">
            <span class="kpi-label">NET UNITS / ROI</span>
            <strong class="kpi-val">${s60.roi_pct != null ? (s60.roi_pct >= 0 ? '+' : '') + s60.roi_pct + '%' : 'Pending'}</strong>
            <span class="kpi-sub">${s60.net_units != null ? (s60.net_units >= 0 ? '+' : '') + s60.net_units + 'u' : `${s60.graded_with_odds || 0} w/ ML`}</span>
          </div>
          <div class="kpi-tile warn-border">
            <span class="kpi-label">UNDERDOG GATE</span>
            <strong class="kpi-val">${dog.win_rate}%</strong>
            <span class="kpi-sub">${dog.wins}-${dog.losses}${dog.roi_pct != null ? ` · ${dog.roi_pct >= 0 ? '+' : ''}${dog.roi_pct}% ROI` : ''}</span>
          </div>
          <div class="kpi-tile">
            <span class="kpi-label">ALGO VERSION</span>
            <strong class="kpi-val" style="font-size:13px;">${cachedReport.algo_version || 'phase4'}</strong>
            <span class="kpi-sub">Gem ${w.gem} / H2H ${w.h2h} / ROS ${w.ros}</span>
          </div>
        </div>

        <!-- GUARDRAILS & GOAL PROGRESS -->
        <div class="audit-card">
          <strong style="color:var(--accent);">🛡️ Auto-Tuner Guardrails &amp; Goal Progress</strong>
          <div class="scale-row" style="margin-top:8px;">
            <div class="scale-head"><span>Win Rate vs. ${target}% Goal</span><strong>${s60.win_rate}% / ${target}%</strong></div>
            <div class="scale-track"><div class="scale-fill" style="width:${progressPct}%;background:linear-gradient(90deg,var(--blue),var(--accent));"></div></div>
          </div>
          <div class="scale-row">
            <div class="scale-head"><span>Global Auto-Tune Sample (${s60.total}/${guard.min_global_games} games)</span><strong>${globalSamplePct}%</strong></div>
            <div class="scale-track"><div class="scale-fill" style="width:${globalSamplePct}%;background:var(--blue);"></div></div>
          </div>
          <div class="scale-row">
            <div class="scale-head"><span>Moneyline ROI Sample (${s60.graded_with_odds || 0}/${guard.min_odds_for_roi} games)</span><strong>${oddsSamplePct}%</strong></div>
            <div class="scale-track"><div class="scale-fill" style="width:${oddsSamplePct}%;background:var(--amber);"></div></div>
          </div>
        </div>

        <!-- CHARTS -->
        <div class="audit-card">
          <strong style="color:var(--blue);">📈 30-Day Win Rate Trend vs. ${target}% Goal</strong>
          <canvas id="chart-trend" height="145" style="margin-top:8px;"></canvas>
        </div>

        <div class="audit-card">
          <strong style="color:var(--accent);">⚖️ Pillar &amp; Underdog Attribution (Win %)</strong>
          <canvas id="chart-factors" height="155" style="margin-top:8px;"></canvas>
        </div>

        <div class="audit-card">
          <strong style="color:var(--amber);">🎯 Confidence Calibration (Actual Win % by Tier)</strong>
          <canvas id="chart-cal" height="145" style="margin-top:8px;"></canvas>
        </div>

        <!-- PER-LEAGUE WEIGHTS & ROI TABLE -->
        <div class="audit-card">
          <strong style="color:var(--blue);">🏆 Per-League Performance &amp; Active Weights</strong>
          <div class="table-wrap" style="margin-top:8px;">
            <table class="pro-table">
              <thead><tr><th>League</th><th>W-L</th><th>Win%</th><th>ROI</th><th>G/H/R</th><th>Tune</th></tr></thead>
              <tbody>${leagueRows || '<tr><td colspan="6" class="muted-note">No league data yet.</td></tr>'}</tbody>
            </table>
          </div>
        </div>

        <!-- INSIGHTS -->
        <div class="audit-card stack-gap">
          <div>
            <strong style="color:var(--accent);">✅ What's Working</strong>
            <ul class="audit-list">${(cachedReport.whats_working || []).map((x) => `<li>${x}</li>`).join('')}</ul>
          </div>
          <div>
            <strong style="color:var(--danger);">⚠️ What's Lagging</strong>
            <ul class="audit-list">${(cachedReport.whats_not_working || []).map((x) => `<li>${x}</li>`).join('')}</ul>
          </div>
          <div>
            <strong style="color:var(--blue);">💡 Model Recommendations</strong>
            <ul class="audit-list">${(cachedReport.suggestions || []).map((x) => `<li>${x}</li>`).join('')}</ul>
          </div>
        </div>

        <!-- MONTHLY WEIGHT HISTORY -->
        <div class="audit-card">
          <strong style="color:#a78bfa;">🔄 Monthly Weight History</strong>
          <div class="stack-gap" style="margin-top:8px;">
            ${(cachedReport.weight_history || []).length
              ? cachedReport.weight_history.slice().reverse().map((wh) => `
                  <div class="audit-subcard">
                    <strong>${wh.date} (${wh.algo_version})</strong> · Win: <b>${wh.win_rate_at_rebalance}%</b>${wh.roi_at_rebalance != null ? ` · ROI: <b>${wh.roi_at_rebalance}%</b>` : ''}<br/>
                    <span class="muted-note">${wh.note}</span><br/>
                    <span style="color:var(--accent);font-size:11px;">Scale: Gem ${wh.updated.gem}% / H2H ${wh.updated.h2h}% / ROS ${wh.updated.ros}%</span>
                  </div>
                `).join('')
              : `<span class="muted-note">${cachedReport.last_rebalance_note || 'First monthly rebalance pending.'}</span>`}
          </div>
        </div>

        <!-- BIWEEKLY REPORTS -->
        <div class="audit-card">
          <strong style="color:var(--amber);">📋 Biweekly Executive Reports</strong>
          <div class="stack-gap" style="margin-top:8px;">
            ${(cachedReport.biweekly_reports || []).map((bw) => `
              <div class="audit-subcard">
                <div style="display:flex;justify-content:space-between;">
                  <strong>${bw.period_start} → ${bw.period_end}</strong>
                  <strong style="color:var(--accent);">${bw.record} (${bw.win_rate}%)</strong>
                </div>
                <div class="muted-note" style="margin:3px 0;">Algo ${bw.algo_version}${bw.underdog_record ? ` · Dogs: ${bw.underdog_record}` : ''}</div>
                <div style="font-size:11px;"><b>Working:</b> ${(bw.whats_working || []).join(' ')}</div>
                <div style="font-size:11px;color:#fca5a5;margin-top:2px;"><b>Lagging:</b> ${(bw.whats_not_working || []).join(' ')}</div>
              </div>
            `).join('') || '<span class="muted-note">First biweekly report generates on the next agent run.</span>'}
          </div>
        </div>
      </div>
    `;

    if (typeof window.Chart === 'function') {
      const baseOpts = {
        responsive: true,
        plugins: { legend: { labels: { color: '#94a3b8', font: { size: 10 } } } },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(148,163,184,0.08)' } },
          y: { min: 0, max: 100, ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(148,163,184,0.1)' } }
        }
      };

      const trend = s60.daily_trend || [];
      activeCharts.push(new Chart(document.getElementById('chart-trend'), {
        type: 'line',
        data: {
          labels: trend.map((d) => d.date.slice(5)),
          datasets: [
            { label: 'Daily Win %', data: trend.map((d) => d.win_rate), borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.14)', fill: true, tension: 0.32 },
            { label: `${target}% Goal`, data: trend.map(() => target), borderColor: '#10b981', borderDash: [5, 5], pointRadius: 0 }
          ]
        },
        options: baseOpts
      }));

      const fVals = Object.values(s60.factors || {});
      activeCharts.push(new Chart(document.getElementById('chart-factors'), {
        type: 'bar',
        data: {
          labels: fVals.map((f) => f.label.split(' ')[0]),
          datasets: [{
            label: 'Win %',
            data: fVals.map((f) => f.win_rate),
            backgroundColor: fVals.map((f) => f.lift_vs_avg >= 0 ? '#10b981' : '#f59e0b'),
            borderRadius: 6
          }]
        },
        options: baseOpts
      }));

      const cal = s60.calibration || {};
      const calKeys = ['50-59%', '60-69%', '70-79%', '80%+'];
      activeCharts.push(new Chart(document.getElementById('chart-cal'), {
        type: 'bar',
        data: {
          labels: calKeys,
          datasets: [{
            label: 'Actual Win %',
            data: calKeys.map((k) => cal[k]?.actual_rate || 0),
            backgroundColor: '#a78bfa',
            borderRadius: 6
          }]
        },
        options: baseOpts
      }));
    }
  };
})();
