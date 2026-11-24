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

  function wireGradedBanner() {
    const banner = document.getElementById('accuracy-banner');
    if (!banner || banner.dataset.auditWired) return;
    banner.dataset.auditWired = '1';
    banner.addEventListener('click', () => window.openGradedAuditModal());
  }
  wireGradedBanner();
  setInterval(wireGradedBanner, 1500);

  window.openGradedAuditModal = async () => {
    const modal = document.getElementById('graded-audit-modal');
    const body = document.getElementById('graded-audit-body');
    if (!modal || !body) return;
    modal.classList.add('open');
    body.innerHTML = '<p style="font-size:12px;color:var(--text-muted);">Loading frozen audit record...</p>';

    cachedHistory = await fetchFresh('history.json');
    const pickerVal = document.getElementById('date-picker')?.value;
    const allDates = Object.keys(cachedHistory?.dates || {}).sort().reverse();
    const targetDate = (pickerVal && cachedHistory?.dates?.[pickerVal]) ? pickerVal : allDates[0];

    if (!targetDate || !cachedHistory?.dates?.[targetDate]) {
      body.innerHTML = '<p style="font-size:12px;color:var(--text-muted);">No archived graded games found for this date yet.</p>';
      return;
    }

    const snap = cachedHistory.dates[targetDate];
    const w = snap.weights_used || { gem: 10, h2h: 60, ros: 30 };
    const games = (snap.games || []).filter((g) => {
      const r = String(g.result || '').toUpperCase();
      return ['W', 'L', 'WIN', 'LOSS'].includes(r) || ['home', 'away'].includes(String(g.actual_winner || '').toLowerCase());
    });

    let wins = 0;
    const rowsHtml = games.map((g) => {
      const r = String(g.result || '').toUpperCase();
      const isWin = ['W', 'WIN'].includes(r) || (g.pick && String(g.pick).toLowerCase() === String(g.actual_winner || '').toLowerCase());
      if (isWin) wins++;
      return `
        <div class="proof-item ${isWin ? '' : 'danger'}">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong>${g.league || ''} · ${g.matchup || g.id || 'Matchup'}</strong>
            <span style="font-weight:800;color:${isWin ? 'var(--accent)' : 'var(--danger)'};">${isWin ? 'WIN' : 'LOSS'}</span>
          </div>
          <div class="proof-sub">
            Pick: <strong>${g.pick || g.actual_winner || '—'}</strong>
            ${g.confidence ? ` · Locked: <strong>${g.confidence}%</strong>` : ''}
            ${g.final_score ? ` · Final: <strong>${g.final_score}</strong>` : ''}
          </div>
        </div>
      `;
    }).join('');

    const pct = games.length ? ((wins / games.length) * 100).toFixed(1) : '0.0';
    body.innerHTML = `
      <div class="proof-item arb-box">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>🔒 Frozen Slate: ${targetDate}</strong>
          <strong style="font-size:15px;">${wins}-${games.length - wins} (${pct}%)</strong>
        </div>
        <div class="proof-sub">Model: ${snap.algo_version || 'Locked'} · ${w.gem}% Signals / ${w.h2h}% Odds / ${w.ros}% Form</div>
      </div>
      ${rowsHtml || '<p class="proof-sub">Games on this date are pending final scores.</p>'}
    `;
  };

  window.openOwnerAnalyticsModal = async () => {
    if (!window.ALIGNIQ_IS_OWNER) return;
    const modal = document.getElementById('owner-analytics-modal');
    const body = document.getElementById('owner-analytics-body');
    if (!modal || !body) return;
    modal.classList.add('open');
    destroyCharts();
    body.innerHTML = '<p style="font-size:12px;color:var(--text-muted);">Loading owner intelligence &amp; ROI charts...</p>';

    cachedReport = await fetchFresh('agent_report.json');
    if (!cachedReport) {
      body.innerHTML = '<p style="color:var(--danger);font-size:12px;">Could not load agent_report.json.</p>';
      return;
    }

    const s60 = cachedReport.summary_60d || { wins: 0, losses: 0, total: 0, win_rate: 0, underdogs: { wins: 0, losses: 0, total: 0, win_rate: 0 }, factors: {}, leagues: {}, daily_trend: [] };
    const dog = s60.underdogs || { wins: 0, losses: 0, total: 0, win_rate: 0, roi_pct: null };
    const w = cachedReport.weights || { gem: 10, h2h: 60, ros: 30 };
    const gr = cachedReport.guardrails || { min_global_games: 500, min_league_games: 100 };
    const samplePct = Math.min(100, Math.round((s60.total / gr.min_global_games) * 100));

    body.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;font-size:12px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div class="proof-item" style="margin:0;">
            <div style="font-size:10px;color:var(--text-muted);font-weight:700;">60-DAY RECORD</div>
            <div style="font-size:20px;font-weight:800;color:var(--accent);margin-top:2px;">${s60.win_rate}%</div>
            <div class="proof-sub">${s60.wins}-${s60.losses} (${s60.total} games)</div>
          </div>
          <div class="proof-item" style="margin:0;">
            <div style="font-size:10px;color:var(--text-muted);font-weight:700;">NET UNITS / ROI</div>
            <div style="font-size:20px;font-weight:800;color:var(--blue);margin-top:2px;">${s60.roi_pct != null ? (s60.roi_pct >= 0 ? '+' : '') + s60.roi_pct + '%' : 'Pending ML'}</div>
            <div class="proof-sub">${s60.net_units != null ? (s60.net_units >= 0 ? '+' : '') + s60.net_units + 'u' : 'Log moneylines'}</div>
          </div>
        </div>

        <div class="proof-item" style="margin:0;border-color:rgba(245,158,11,0.4);">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="color:var(--amber);">🐶 Underdog Gate Performance</strong>
            <strong>${dog.wins}-${dog.losses} (${dog.win_rate}%)</strong>
          </div>
          <div class="proof-sub">Underdog ROI: <strong>${dog.roi_pct != null ? (dog.roi_pct >= 0 ? '+' : '') + dog.roi_pct + '%' : 'Pending ML'}</strong> · Active Scale: ${w.gem}/${w.h2h}/${w.ros}</div>
        </div>

        <div class="proof-item" style="margin:0;">
          <div style="display:flex;justify-content:space-between;font-size:11px;">
            <strong>🛡️ Auto-Tune Guardrail (${s60.total}/${gr.min_global_games} games)</strong>
            <span>${samplePct}%</span>
          </div>
          <div style="height:7px;background:var(--bg);border-radius:999px;overflow:hidden;margin-top:6px;">
            <div style="height:100%;width:${samplePct}%;background:linear-gradient(90deg,var(--blue),var(--accent));"></div>
          </div>
        </div>

        <div class="proof-item" style="margin:0;">
          <strong style="color:var(--blue);">📈 30-Day Win Rate Trend</strong>
          <canvas id="chart-trend" height="145" style="margin-top:8px;"></canvas>
        </div>

        <div class="proof-item" style="margin:0;">
          <strong style="color:var(--accent);">🏆 League Win Rates</strong>
          <canvas id="chart-leagues" height="145" style="margin-top:8px;"></canvas>
        </div>

        <div class="proof-item" style="margin:0;">
          <strong style="color:var(--accent);">✅ Working</strong>
          <ul style="margin:4px 0 8px 16px;padding:0;color:var(--text-muted);">${(cachedReport.whats_working || []).map(x => `<li>${x}</li>`).join('')}</ul>
          <strong style="color:var(--danger);">⚠️ Watchlist</strong>
          <ul style="margin:4px 0 0 16px;padding:0;color:var(--text-muted);">${(cachedReport.whats_not_working || []).map(x => `<li>${x}</li>`).join('')}</ul>
        </div>
      </div>
    `;

    if (typeof window.Chart === 'function') {
      const baseOpts = {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#8b95a5', font: { size: 9 } }, grid: { display: false } },
          y: { min: 0, max: 100, ticks: { color: '#8b95a5', font: { size: 9 } }, grid: { color: 'rgba(148,163,184,0.1)' } }
        }
      };

      const trend = s60.daily_trend || [];
      activeCharts.push(new Chart(document.getElementById('chart-trend'), {
        type: 'line',
        data: {
          labels: trend.map(d => d.date.slice(5)),
          datasets: [{ data: trend.map(d => d.win_rate), borderColor: '#00d285', backgroundColor: 'rgba(0,210,133,0.12)', fill: true, tension: 0.35 }]
        },
        options: baseOpts
      }));

      const lgKeys = Object.keys(s60.leagues || {});
      activeCharts.push(new Chart(document.getElementById('chart-leagues'), {
        type: 'bar',
        data: {
          labels: lgKeys.length ? lgKeys : ['Pending'],
          datasets: [{ data: lgKeys.length ? lgKeys.map(k => s60.leagues[k].win_rate) : [0], backgroundColor: '#38bdf8', borderRadius: 6 }]
        },
        options: baseOpts
      }));
    }
  };
})();