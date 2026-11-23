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

  // --- 1. MAKE GRADED PICKS BANNER CLICKABLE FOR FULL AUDIT BREAKDOWN ---
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
    body.innerHTML = '<p style="font-size:12px;color:#94a3b8;">Loading frozen audit record...</p>';

    cachedHistory = await fetchFresh('history.json');
    const pickerVal = document.getElementById('date-picker')?.value;
    const allDates = Object.keys(cachedHistory?.dates || {}).sort().reverse();
    const targetDate = (pickerVal && cachedHistory?.dates?.[pickerVal]) ? pickerVal : allDates[0];

    if (!targetDate || !cachedHistory?.dates?.[targetDate]) {
      body.innerHTML = '<p style="font-size:12px;color:#94a3b8;">No archived graded games found for this date yet.</p>';
      return;
    }

    const snap = cachedHistory.dates[targetDate];
    const w = snap.weights_used || { gem: 42, h2h: 21, ros: 37 };
    const games = (snap.games || []).filter((g) => ['W', 'L', 'WIN', 'LOSS'].includes(String(g.result || '').toUpperCase()));
    const wins = games.filter((g) => ['W', 'WIN'].includes(String(g.result).toUpperCase())).length;
    const pct = games.length ? ((wins / games.length) * 100).toFixed(1) : '0.0';

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;font-size:12px;">
        <div style="background:#0f172a;border:1px solid #10b981;border-radius:12px;padding:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="color:#34d399;">🔒 Frozen Slate: ${targetDate}</strong>
            <span style="font-weight:800;color:#f1f5f9;">${wins}-${games.length - wins} (${pct}%)</span>
          </div>
          <div style="color:#94a3b8;font-size:11px;margin-top:4px;">
            Algorithm Active on Date: <strong style="color:#38bdf8;">${snap.algo_version || 'Locked'}</strong> ·
            Gem ${w.gem}% / Odds ${w.h2h}% / Form ${w.ros}%
          </div>
        </div>

        ${games.length ? games.map((g) => {
          const isWin = ['W', 'WIN'].includes(String(g.result).toUpperCase());
          const f = g.factors || {};
          const refs = Array.isArray(f.references) && f.references.length
            ? f.references.map((r) => `<span style="background:#1e293b;padding:2px 6px;border-radius:6px;font-size:10px;color:#cbd5e1;">${r}</span>`).join(' ')
            : '<span style="color:#64748b;font-size:10px;">Standard multi-pillar slate signals</span>';
          return `
            <div style="background:#080d17;border:1px solid ${isWin ? '#10b981' : '#ef4444'};border-radius:12px;padding:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="color:#f1f5f9;">${g.league || ''} · ${g.matchup || (g.away + ' @ ' + g.home)}</strong>
                <span style="font-weight:800;color:${isWin ? '#34d399' : '#f87171'};">${isWin ? 'WIN' : 'LOSS'}</span>
              </div>
              <div style="margin-top:4px;color:#cbd5e1;">
                Pick: <strong>${g.pick}</strong> · Locked Conf: <strong style="color:#38bdf8;">${g.confidence}%</strong>
                ${g.final_score ? ` · Final: <strong>${g.final_score}</strong>` : ''}
              </div>
              <div style="margin-top:6px;font-size:11px;color:#94a3b8;display:flex;gap:8px;flex-wrap:wrap;">
                <span>✦ Gem Hits: <b>${f.gematria_hits ?? 0}</b></span>
                <span>📈 +EV Edge: <b>${f.odds_edge ?? 0}%</b></span>
                <span>💪 Form/Health: <b>${f.form_health_score ?? 0}</b></span>
              </div>
              <div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">${refs}</div>
            </div>
          `;
        }).join('') : '<p style="color:#94a3b8;">Games on this date are pending final scores.</p>'}
      </div>
    `;
  };

  // --- 2. OWNER-ONLY EXECUTIVE ANALYTICS, CHARTS & BIWEEKLY REPORT MODAL ---
  window.openOwnerAnalyticsModal = async () => {
    if (!window.ALIGNIQ_IS_OWNER) return;
    const modal = document.getElementById('owner-analytics-modal');
    const body = document.getElementById('owner-analytics-body');
    if (!modal || !body) return;
    modal.classList.add('open');
    destroyCharts();
    body.innerHTML = '<p style="font-size:12px;color:#94a3b8;">Loading owner intelligence &amp; charts...</p>';

    cachedReport = await fetchFresh('agent_report.json');
    if (!cachedReport) {
      body.innerHTML = '<p style="color:#f87171;font-size:12px;">Could not load agent_report.json. Run your GitHub Action once to initialize it.</p>';
      return;
    }

    const s60 = cachedReport.summary_60d || { wins: 0, losses: 0, total: 0, win_rate: 0, gap_to_target: 95, factors: {}, leagues: {}, calibration: {}, daily_trend: [] };
    const w = cachedReport.weights || { gem: 42, h2h: 21, ros: 37 };
    const target = cachedReport.target_win_rate || 95;
    const progressPct = Math.min(100, Math.round((s60.win_rate / target) * 100));

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px;font-size:12px;">
        <!-- TOP KPI & 95% TARGET SCALE -->
        <div style="background:#0f172a;border:1px solid #10b981;border-radius:14px;padding:12px;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;">
            <strong style="color:#34d399;font-size:13px;">🎯 Win Rate vs. ${target}% Target</strong>
            <span style="font-size:16px;font-weight:800;color:#f1f5f9;">${s60.win_rate}% <span style="font-size:11px;color:#94a3b8;">(${s60.wins}-${s60.losses})</span></span>
          </div>
          <div style="height:10px;background:#1e293b;border-radius:999px;overflow:hidden;margin:8px 0;">
            <div style="height:100%;width:${progressPct}%;background:linear-gradient(90deg,#38bdf8,#10b981);"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;">
            <span>Algo: <b style="color:#f1f5f9;">${cachedReport.algo_version || 'v1'}</b> (Monthly Rebalance)</span>
            <span>Gap to ${target}%: <b style="color:#fbbf24;">${s60.gap_to_target}%</b></span>
          </div>
          <div style="margin-top:6px;font-size:11px;color:#cbd5e1;">
            Active Scale: <b>Gem ${w.gem}%</b> · <b>Odds ${w.h2h}%</b> · <b>Form/Health ${w.ros}%</b>
          </div>
        </div>

        <!-- CHARTS GRID -->
        <div style="background:#0f172a;border:1px solid #1e2d47;border-radius:14px;padding:10px;">
          <strong style="color:#38bdf8;">📈 30-Day Win Rate Trend vs. ${target}% Goal</strong>
          <canvas id="chart-trend" height="150" style="margin-top:8px;"></canvas>
        </div>

        <div style="background:#0f172a;border:1px solid #1e2d47;border-radius:14px;padding:10px;">
          <strong style="color:#34d399;">⚖️ Determining Factor Attribution (Win % &amp; Lift)</strong>
          <canvas id="chart-factors" height="160" style="margin-top:8px;"></canvas>
        </div>

        <div style="background:#0f172a;border:1px solid #1e2d47;border-radius:14px;padding:10px;">
          <strong style="color:#fbbf24;">🏆 Per-League Performance &amp; Confidence Calibration</strong>
          <canvas id="chart-leagues" height="150" style="margin-top:8px;"></canvas>
        </div>

        <!-- WHAT'S WORKING / WHAT'S NOT / SUGGESTIONS -->
        <div style="background:#0f172a;border:1px solid #1e2d47;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px;">
          <div>
            <strong style="color:#34d399;">✅ What's Working</strong>
            <ul style="margin:4px 0 0 16px;padding:0;color:#cbd5e1;">
              ${(cachedReport.whats_working || []).map((x) => `<li>${x}</li>`).join('')}
            </ul>
          </div>
          <div>
            <strong style="color:#f87171;">⚠️ What's Not Working</strong>
            <ul style="margin:4px 0 0 16px;padding:0;color:#cbd5e1;">
              ${(cachedReport.whats_not_working || []).map((x) => `<li>${x}</li>`).join('')}
            </ul>
          </div>
          <div>
            <strong style="color:#38bdf8;">💡 Model Suggestions</strong>
            <ul style="margin:4px 0 0 16px;padding:0;color:#cbd5e1;">
              ${(cachedReport.suggestions || []).map((x) => `<li>${x}</li>`).join('')}
            </ul>
          </div>
        </div>

        <!-- MONTHLY WEIGHT EVOLUTION LOG -->
        <div style="background:#0f172a;border:1px solid #1e2d47;border-radius:14px;padding:12px;">
          <strong style="color:#a78bfa;">🔄 Monthly Weight History (What Changed)</strong>
          <div style="margin-top:6px;display:flex;flex-direction:column;gap:6px;">
            ${(cachedReport.weight_history || []).length
              ? cachedReport.weight_history.slice().reverse().map((wh) => `
                  <div style="background:#080d17;border:1px solid #1e293b;border-radius:8px;padding:8px;font-size:11px;">
                    <strong>${wh.date} (${wh.algo_version})</strong> · Win Rate: <b>${wh.win_rate_at_rebalance}%</b><br/>
                    <span style="color:#94a3b8;">${wh.note}</span><br/>
                    <span style="color:#34d399;">New Scale: Gem ${wh.updated.gem}% / Odds ${wh.updated.h2h}% / Form ${wh.updated.ros}%</span>
                  </div>
                `).join('')
              : `<span style="color:#64748b;font-size:11px;">${cachedReport.last_rebalance_note || 'First monthly rebalance pending.'}</span>`}
          </div>
        </div>

        <!-- BIWEEKLY EXECUTIVE SUMMARY REPORTS -->
        <div style="background:#0f172a;border:1px solid #1e2d47;border-radius:14px;padding:12px;">
          <strong style="color:#f59e0b;">📋 Biweekly Summary Reports</strong>
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:8px;">
            ${(cachedReport.biweekly_reports || []).map((bw) => `
              <div style="background:#080d17;border:1px solid #1e293b;border-radius:10px;padding:10px;font-size:11px;">
                <div style="display:flex;justify-content:space-between;color:#f1f5f9;">
                  <strong>${bw.period_start} → ${bw.period_end}</strong>
                  <strong style="color:#34d399;">${bw.record} (${bw.win_rate}%)</strong>
                </div>
                <div style="color:#94a3b8;margin:4px 0;">Algo ${bw.algo_version} · ${bw.what_changed}</div>
                <div style="color:#cbd5e1;"><b>Working:</b> ${(bw.whats_working || []).join(' ')}</div>
                <div style="color:#fca5a5;margin-top:2px;"><b>Lagging:</b> ${(bw.whats_not_working || []).join(' ')}</div>
                <div style="color:#7dd3fc;margin-top:2px;"><b>Next Steps:</b> ${(bw.suggestions || []).join(' ')}</div>
              </div>
            `).join('') || '<span style="color:#64748b;">First biweekly report generates on the next agent run.</span>'}
          </div>
        </div>
      </div>
    `;

    // Render Chart.js Graphs
    if (typeof window.Chart === 'function') {
      const baseOpts = {
        responsive: true,
        plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 10 } } } },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(148,163,184,0.1)' } },
          y: { min: 0, max: 100, ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(148,163,184,0.12)' } }
        }
      };

      // 1. Trend Line
      const trend = s60.daily_trend || [];
      activeCharts.push(new Chart(document.getElementById('chart-trend'), {
        type: 'line',
        data: {
          labels: trend.map((d) => d.date.slice(5)),
          datasets: [
            { label: 'Daily Win %', data: trend.map((d) => d.win_rate), borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.15)', fill: true, tension: 0.3 },
            { label: `${target}% Target`, data: trend.map(() => target), borderColor: '#10b981', borderDash: [5, 5], pointRadius: 0 }
          ]
        },
        options: baseOpts
      }));

      // 2. Factor Attribution Bar
      const fVals = Object.values(s60.factors || {});
      activeCharts.push(new Chart(document.getElementById('chart-factors'), {
        type: 'bar',
        data: {
          labels: fVals.map((f) => f.label.split(' ')[0]),
          datasets: [{
            label: 'Factor Win %',
            data: fVals.map((f) => f.win_rate),
            backgroundColor: fVals.map((f) => f.lift_vs_avg >= 0 ? '#10b981' : '#f59e0b'),
            borderRadius: 6
          }]
        },
        options: baseOpts
      }));

      // 3. League Win Rates Bar
      const lgKeys = Object.keys(s60.leagues || {});
      activeCharts.push(new Chart(document.getElementById('chart-leagues'), {
        type: 'bar',
        data: {
          labels: lgKeys.length ? lgKeys : ['Pending'],
          datasets: [{
            label: 'League Win %',
            data: lgKeys.length ? lgKeys.map((k) => s60.leagues[k].win_rate) : [0],
            backgroundColor: '#38bdf8',
            borderRadius: 6
          }]
        },
        options: baseOpts
      }));
    }
  };
})();
