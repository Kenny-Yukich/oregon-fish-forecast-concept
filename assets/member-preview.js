/* Member preview: shows the proposed paid river scores using a prototype formula.
   The formula is transparent and uses only data already on the site: the dated report's wording and age,
   dam counts against last year, and recent ODFW stocking. It is not validated and every score says so.
   Rivers with a rules notice stay withheld, and lakes are not scored, matching the membership proposal. */
(() => {
  'use strict';
  const KEY = 'orff-concept.preview';
  const read = () => { try { return localStorage.getItem(KEY) === 'member'; } catch { return false; } };
  let on = read();
  function set(value) {
    on = value;
    try { if (value) localStorage.setItem(KEY, 'member'); else localStorage.removeItem(KEY); } catch {}
    window.dispatchEvent(new CustomEvent('orff-preview-change'));
  }

  const POSITIVE = /\b(good|excellent|strong|productive|consistent|active|success|successful|improving|great|hot|best|coho are in)\b/i;
  const NEGATIVE = /\b(slow|poor|tough|closed|ended|no (?:dated|report)|unconfirmed|withheld)\b/i;
  const MIXED = /\b(fair|mixed|spotty|some)\b/i;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
  const today = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Los_Angeles'}).format(new Date());
  const SPECIES_KEYS = [['coho', /coho/i], ['chinook', /chinook/i], ['steelhead', /steelhead/i]];

  function reportTone(w) {
    const r = w.planning.report;
    if (!r?.reported_on) return null;
    const text = r.summary;
    const pos = POSITIVE.test(text), neg = NEGATIVE.test(text), mixed = MIXED.test(text);
    const value = pos && !neg ? (mixed ? 65 : 80) : neg && !pos ? 30 : pos && neg ? 55 : mixed ? 50 : 55;
    const word = value >= 75 ? 'Positive' : value >= 60 ? 'Mostly positive' : value >= 45 ? 'Mixed' : 'Slow';
    return {key: 'tone', label: 'Report tone', value, weight: 0.35, display: word, reason: '“' + text + '”'};
  }
  function reportFreshness(w) {
    const r = w.planning.report;
    if (!r?.reported_on) return null;
    const age = days(r.reported_on, today());
    const value = age <= 7 ? 100 : age <= 14 ? 80 : age <= 30 ? 55 : 25;
    return {key: 'fresh', label: 'Report freshness', value, weight: 0.2, display: age + (age === 1 ? ' day old' : ' days old'), reason: 'Reported ' + r.reported_on + '. Older reports count for less.'};
  }
  function runStrength(w) {
    const links = window.ORFF_COUNT_STATIONS?.waters?.[w.id] || [];
    const targets = SPECIES_KEYS.filter(([, re]) => w.planning.target_species.some(s => re.test(s))).map(([k]) => k);
    let best = null;
    for (const l of links) {
      const data = window.ORFF_COUNTS?.stations?.[l.station], meta = window.ORFF_COUNT_STATIONS.stations[l.station];
      if (!data) continue;
      for (const k of targets) {
        const v = data.species[k];
        if (!v || !v.last_year_ytd) continue;
        if (!best || v.last7 > best.v.last7) best = {v, k, meta, through: data.through};
      }
    }
    if (!best) return null;
    const ratio = best.v.ytd / best.v.last_year_ytd;
    const value = Math.round(clamp(50 + 50 * (ratio - 1), 10, 95));
    return {key: 'run', label: 'Run strength', value, weight: 0.3, display: Math.round(ratio * 100) + '% of last year',
      reason: best.v.label + ' at ' + best.meta.name + ': ' + best.v.ytd.toLocaleString('en-US') + ' this year vs ' + best.v.last_year_ytd.toLocaleString('en-US') + ' by the same date last year, through ' + best.through + '.'};
  }
  function stocking(w) {
    const names = window.ORFF_STOCKING_MATCH?.[w.id];
    if (!names) return null;
    const res = names.map(n => new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'));
    const past = (window.ORFF_STOCKING?.rows || []).filter(r => res.some(re => re.test(r.waterbody)) && r.week_start <= today()).sort((a, b) => b.week_start.localeCompare(a.week_start))[0];
    if (!past) return null;
    const age = days(past.week_start, today());
    const value = age <= 14 ? 85 : age <= 30 ? 65 : 45;
    return {key: 'stock', label: 'Recent stocking', value, weight: 0.15, display: 'Week of ' + past.week_start, reason: past.total.toLocaleString('en-US') + ' trout planned by ODFW at ' + past.waterbody + '.'};
  }

  function score(w) {
    if (w.kind !== 'river') return {status: 'not-scored'};
    if (w.planning.score_notice) return {status: 'withheld', reason: w.planning.score_notice};
    const factors = [reportTone(w), reportFreshness(w), runStrength(w), stocking(w)].filter(Boolean);
    if (!factors.length) return {status: 'insufficient', reason: 'No dated report, dam count or stocking record yet, so there is nothing to score.'};
    const total = factors.reduce((t, f) => t + f.weight, 0);
    const value = Math.round(factors.reduce((t, f) => t + f.value * f.weight, 0) / total);
    const unverified = w.planning.alerts.filter(a => a.status === 'unverified').length;
    const confidence = factors.length >= 3 && unverified === 0 ? 'High' : factors.length >= 2 && unverified <= 1 ? 'Medium' : 'Low';
    const label = value >= 80 ? 'Excellent' : value >= 65 ? 'Good' : value >= 45 ? 'Fair' : 'Slow';
    const missing = ['Report tone', 'Report freshness', 'Run strength', 'Recent stocking'].filter(l => !factors.some(f => f.label === l));
    return {status: 'scored', value, label, confidence, factors, missing, unverified};
  }

  window.ORFFPreview = {get on() { return on; }, set, score};
})();
