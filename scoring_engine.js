// scoring_engine.js — AlignIQ Phase 1 Normalized & Gated Scoring Engine
(function (global) {
  const DEFAULT_WEIGHTS = Object.freeze({
    gem: 10,
    h2h: 60,
    ros: 30
  });

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  // Stretch compressed h2h (36–68) onto a full 0–100 scale
  function normalizeH2H(rawH2H) {
    const val = Number(rawH2H);
    if (!Number.isFinite(val)) return 50;
    return clamp(((val - 36) / 32) * 100, 0, 100);
  }

  // Soft-scale Gematria so a single hit cannot hijack heavy favorites
  function scaleGematria(rawGem) {
    const val = Number(rawGem);
    if (!Number.isFinite(val)) return 0;
    return clamp(val * 0.85, 0, 100);
  }

  function scoreMatchup(home, away, customWeights) {
    const w = { ...DEFAULT_WEIGHTS, ...(customWeights || {}) };

    const hGem = scaleGematria(home?.gem);
    const aGem = scaleGematria(away?.gem);
    const hH2H = normalizeH2H(home?.h2h);
    const aH2H = normalizeH2H(away?.h2h);
    const hRos = clamp(Number(home?.ros ?? 50), 0, 100);
    const aRos = clamp(Number(away?.ros ?? 50), 0, 100);

    const homeScore = Number(
      ((hGem * w.gem + hH2H * w.h2h + hRos * w.ros) / 100).toFixed(2)
    );
    const awayScore = Number(
      ((aGem * w.gem + aH2H * w.h2h + aRos * w.ros) / 100).toFixed(2)
    );

    let pick = homeScore >= awayScore ? 'home' : 'away';

    const rawHomeH2H = Number(home?.h2h ?? 50);
    const rawAwayH2H = Number(away?.h2h ?? 50);
    const marketDog =
      rawHomeH2H === rawAwayH2H ? null : rawHomeH2H < rawAwayH2H ? 'home' : 'away';

    // Underdog Agreement Gate
    let dogGateTriggered = false;
    if (marketDog && pick === marketDog) {
      const dog = pick === 'home' ? home : away;
      const fav = pick === 'home' ? away : home;

      const dogH2H = Number(dog?.h2h ?? 50);
      const dogRos = Number(dog?.ros ?? 50);
      const favRos = Number(fav?.ros ?? 50);
      const dogGem = Number(dog?.gem ?? 0);
      const favGem = Number(fav?.gem ?? 0);

      const closeMarket = dogH2H >= 44;
      const bothAgree = dogRos > favRos && dogGem > favGem;
      const strongFormEdge = dogRos - favRos >= 22;

      if (!(closeMarket && (bothAgree || strongFormEdge))) {
        pick = pick === 'home' ? 'away' : 'home';
        dogGateTriggered = true;
      }
    }

    return {
      pick,
      homeScore,
      awayScore,
      confidenceDiff: Number(Math.abs(homeScore - awayScore).toFixed(2)),
      isUnderdogPick: Boolean(marketDog && pick === marketDog),
      dogGateTriggered,
      weightsUsed: w
    };
  }

  global.ALIGNIQ_WEIGHTS = { ...DEFAULT_WEIGHTS };
  global.AlignIQScoring = {
    DEFAULT_WEIGHTS,
    normalizeH2H,
    scaleGematria,
    scoreMatchup
  };
})(window);
