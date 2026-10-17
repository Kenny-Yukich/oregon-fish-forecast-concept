/* Fishing scores, shown to every visitor.
   The formula is transparent and uses only data already on the site: the dated report's wording and age,
   dam counts against last year, USGS flow and water temperature, and ODFW stocking. It has not yet been
   checked against catch results. A rules notice withholds a score unless the record names the species that can
   still be scored (Lower Deschutes trout) or the notice has an end date that has passed (Coweeman).
   First-hand field checks (data/field-checks.js) move a score either way. A score needs three inputs, and on a river a
   live flow reading, to reach Excellent. During an irrigation switch (data/flow-seasons.js) a river with no live flow
   reading is capped at Fair. */
(() => {
  'use strict';
  // Scores are open to everyone, so `on` is always true. `set` stays as a no-op for older callers.
  const on = true;
  function set() {}

  const POSITIVE = /\b(good|excellent|strong|productive|consistent|active|success|successful|improving|great|hot|best|coho are in)\b/i;
  const NEGATIVE = /\b(slow|poor|tough|closed|ended|no (?:dated|report)|unconfirmed|withheld)\b/i;
  const MIXED = /\b(fair|mixed|spotty|some)\b/i;
  const COLD_WATER = /trout|salmon|steelhead|whitefish|kokanee|chinook|coho|cutthroat/i;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
  const today = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Los_Angeles'}).format(new Date());
  const num = n => Math.round(n).toLocaleString('en-US');
  const short = iso => new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'});
  // A plain "Salmon" in the target species means Chinook and coho; "Coho salmon" means coho only.
  const generic = s => /^salmon$/i.test(s.trim());
  const SPECIES_KEYS = [['coho', s => /coho/i.test(s) || generic(s)], ['chinook', s => /chinook/i.test(s) || generic(s)], ['steelhead', s => /steelhead/i.test(s)]];
  const WEIGHTS = {
    river: {tone: 0.30, run: 0.25, cond: 0.20, fresh: 0.15, stock: 0.10},
    lake: {stock: 0.40, tone: 0.35, fresh: 0.25}
  };
  const LABELS = {tone: 'Report tone', fresh: 'Report freshness', run: 'Run strength', cond: 'River conditions', stock: 'Recent stocking', angler: 'Angler posts', field: 'Field check'};
  // Angler posts from data/angler.js can raise a score but never lower it, and only count for two weeks.
  const ANGLER_WEIGHT = {river: 0.15, lake: 0.20}, ANGLER_DAYS = 14;
  // First-hand field checks from data/field-checks.js count both ways, for two weeks.
  const FIELD_WEIGHT = {river: 0.25, lake: 0.25}, FIELD_DAYS = 14;
  const FIELD_VALUE = {none: 15, slow: 35, fair: 55, good: 80, great: 95};
  const FIELD_WORD = {none: 'No fish', slow: 'Slow', fair: 'Fair', good: 'Good', great: 'Great'};
  // Score caps: Excellent needs this many inputs and, on a river, a live flow reading.
  const EXCELLENT_INPUTS = 3, CAP_GOOD = 79, CAP_FAIR = 64;
  const kindOf = w => w.kind === 'river' ? 'river' : 'lake';
  const species = w => w.planning.score_species || w.planning.target_species;

  function reportTone(w) {
    const r = w.planning.report;
    if (!r?.reported_on) return null;
    const text = r.summary;
    const pos = POSITIVE.test(text), neg = NEGATIVE.test(text), mixed = MIXED.test(text);
    const value = pos && !neg ? (mixed ? 65 : 80) : neg && !pos ? 30 : pos && neg ? 55 : mixed ? 50 : 55;
    const word = value >= 75 ? 'Positive' : value >= 60 ? 'Mostly positive' : value >= 45 ? 'Mixed' : 'Slow';
    return {key: 'tone', value, display: word, reason: '“' + text + '”'};
  }
  function reportFreshness(w) {
    const r = w.planning.report;
    if (!r?.reported_on) return null;
    const age = days(r.reported_on, today());
    const value = age <= 7 ? 100 : age <= 14 ? 80 : age <= 30 ? 55 : 25;
    return {key: 'fresh', value, display: age + (age === 1 ? ' day old' : ' days old'), reason: 'Reported ' + r.reported_on + '. Older reports count for less.'};
  }
  function runStrength(w) {
    const links = window.ORFF_COUNT_STATIONS?.waters?.[w.id] || [];
    const targets = SPECIES_KEYS.filter(([, test]) => species(w).some(test)).map(([k]) => k);
    let best = null;
    for (const l of links) {
      const data = window.ORFF_COUNTS?.stations?.[l.station], meta = window.ORFF_COUNT_STATIONS.stations[l.station];
      if (!data) continue;
      for (const k of targets) {
        const v = data.species[k];
        if (!v || !v.last_year_ytd) continue;
        if (!best || v.last7 > best.v.last7) best = {v, meta, through: data.through};
      }
    }
    if (!best) return null;
    const ratio = best.v.ytd / best.v.last_year_ytd;
    const value = Math.round(clamp(50 + 50 * (ratio - 1), 10, 95));
    return {key: 'run', value, display: Math.round(ratio * 100) + '% of last year',
      reason: best.v.label + ' at ' + best.meta.name + ': ' + num(best.v.ytd) + ' this year vs ' + num(best.v.last_year_ytd) + ' by the same date last year, through ' + best.through + '.'};
  }
  // Flow trend and water temperature from the river's USGS gauge, read daily by the data workflow.
  function conditions(w) {
    const c = window.ORFF_MONITORING?.[w.id], data = c?.station && window.ORFF_CONDITIONS?.stations?.[c.station];
    if (!data) return null;
    const fetched = Date.parse(window.ORFF_CONDITIONS.fetched_at);
    const fresh = x => x && fetched - Date.parse(x.time) <= 36 * 3600000;
    const parts = [];
    if (fresh(data.flow) && data.flow.median7 > 0) {
      const r = data.flow.latest / data.flow.median7, unit = /ft/.test(data.flow.unit || 'ft') ? 'cfs' : data.flow.unit;
      const [value, word] = r > 2 ? [25, 'Rising fast'] : r > 1.3 ? [50, 'Rising'] : r >= 0.75 ? [85, 'Steady flow'] : r >= 0.5 ? [70, 'Dropping'] : [35, 'Dropping sharply'];
      parts.push({value, word, detail: num(data.flow.latest) + ' ' + unit + ' against a 7-day median of ' + num(data.flow.median7)});
    }
    if (fresh(data.temp) && species(w).some(s => COLD_WATER.test(s))) {
      const cel = /F/.test(data.temp.unit || '') ? (data.temp.latest - 32) * 5 / 9 : data.temp.latest, fah = cel * 9 / 5 + 32;
      const [value, word] = cel < 4 ? [45, 'Cold water'] : cel < 7 ? [70, 'Cool water'] : cel <= 16 ? [90, 'Good water temperature'] : cel < 19 ? [55, 'Warm water'] : [25, 'Too warm for trout and salmon'];
      parts.push({value, word, detail: fah.toFixed(1) + '°F'});
    }
    if (!parts.length) return null;
    const value = Math.round(parts.reduce((t, p) => t + p.value, 0) / parts.length);
    return {key: 'cond', value, display: parts.map(p => p.word).join(' · '), reason: c.name + ': ' + parts.map(p => p.detail).join('; ') + '. Gauge readings, not a reading at the access point.'};
  }
  function matchedRows(w) {
    const names = window.ORFF_STOCKING_MATCH?.[w.id];
    if (!names) return [];
    const res = names.map(n => new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'));
    return (window.ORFF_STOCKING?.rows || []).filter(r => res.some(re => re.test(r.waterbody)));
  }
  function stocking(w) {
    const t = today(), rows = matchedRows(w);
    const past = rows.filter(r => r.week_start <= t).sort((a, b) => b.week_start.localeCompare(a.week_start))[0];
    if (kindOf(w) === 'river') {
      if (!past) return null;
      const age = days(past.week_start, t);
      return {key: 'stock', value: age <= 14 ? 85 : age <= 30 ? 65 : 45, display: 'Week of ' + short(past.week_start), reason: num(past.total) + ' trout planned by ODFW at ' + past.waterbody + '.'};
    }
    // Lakes: a stocking in the last two months or one coming within two weeks.
    const next = rows.filter(r => r.week_start > t).sort((a, b) => a.week_start.localeCompare(b.week_start))[0];
    const age = past ? days(past.week_start, t) : Infinity, until = next ? days(t, next.week_start) : Infinity;
    const pastValue = age <= 14 ? 90 : age <= 30 ? 75 : age <= 60 ? 55 : 0, nextValue = until <= 14 ? 80 : 0;
    if (!pastValue && !nextValue) return null;
    const bits = [past && age <= 60 ? 'Stocked ' + short(past.week_start) : null, next && until <= 14 ? 'next ' + short(next.week_start) : null].filter(Boolean);
    const reason = [past && age <= 60 ? num(past.total) + ' trout planned for the week of ' + short(past.week_start) : null, next && until <= 14 ? num(next.total) + ' more planned for the week of ' + short(next.week_start) : null].filter(Boolean).join('; ');
    return {key: 'stock', value: Math.max(pastValue, nextValue), display: bits.join(' · '), reason: reason + ' (ODFW schedule).'};
  }

  function anglerPosts(w) {
    const t = today();
    const posts = (window.ORFF_ANGLER?.waters?.[w.id] || []).filter(p => p.scoring && days(p.date, t) >= 0 && days(p.date, t) <= ANGLER_DAYS);
    const pos = posts.filter(p => p.signal === 'positive').length, mixed = posts.filter(p => p.signal === 'mixed').length;
    if (!pos && !mixed) return null;
    return {key: 'angler', value: pos >= 2 ? 90 : pos ? 80 : 60, display: (pos + mixed) === 1 ? 'A recent catch post' : 'Recent catch posts',
      reason: 'Word of mouth from public Facebook groups and TikTok in the last two weeks, not verified. Angler posts can raise a score but never lower it.'};
  }

  function fieldCheck(w) {
    const t = today();
    const check = (window.ORFF_FIELD?.checks || []).filter(c => c.water === w.id && FIELD_VALUE[c.result] != null && days(c.date, t) >= 0 && days(c.date, t) <= FIELD_DAYS)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!check) return null;
    return {key: 'field', value: FIELD_VALUE[check.result], display: FIELD_WORD[check.result] + ', ' + short(check.date),
      reason: 'A first-hand trip check on this water. It counts for two weeks and can raise or lower the score.'};
  }
  // The irrigation-switch window this water is in today, if any (data/flow-seasons.js).
  function flowSeason(w) {
    const md = today().slice(5);
    return (window.ORFF_FLOW_SEASONS?.[w.id] || []).find(s => s.from <= md && md <= s.to) || null;
  }

  function score(w) {
    const p = w.planning, t = today(), kind = kindOf(w), notes = [];
    const noticeActive = !!p.score_notice && (!p.score_notice_until || t <= p.score_notice_until);
    if (noticeActive && !p.score_species) return {status: 'withheld', reason: p.score_notice + (p.score_notice_until ? ' The notice runs through ' + short(p.score_notice_until) + '.' : '')};
    if (noticeActive && p.score_species) notes.push(p.score_species_note || 'Scored for ' + p.score_species.join(' and ') + ' only.');
    if (p.score_notice && !noticeActive) notes.push('The closure listed through ' + short(p.score_notice_until) + ' has ended. Confirm the reopening with the source before fishing.');
    const found = kind === 'river' ? [reportTone(w), runStrength(w), conditions(w), reportFreshness(w), stocking(w)] : [stocking(w), reportTone(w), reportFreshness(w)];
    const field = fieldCheck(w);
    const factors = [...found.filter(Boolean).map(f => ({...f, label: LABELS[f.key], weight: WEIGHTS[kind][f.key]})), ...(field ? [{...field, label: LABELS.field, weight: FIELD_WEIGHT[kind]}] : [])];
    if (!factors.some(f => f.key !== 'cond')) return {status: 'insufficient', reason: factors.length ? 'Only gauge readings are available. A score also needs a dated report, a dam count or a stocking record.' : 'No dated report, dam count, gauge reading or stocking record yet, so there is nothing to score.'};
    const total = factors.reduce((s, f) => s + f.weight, 0);
    let value = Math.round(factors.reduce((s, f) => s + f.value * f.weight, 0) / total);
    // Angler posts are applied last and kept only when they raise the score. They never change confidence.
    const angler = anglerPosts(w);
    if (angler) {
      const weight = ANGLER_WEIGHT[kind];
      const raised = Math.round((factors.reduce((s, f) => s + f.value * f.weight, 0) + angler.value * weight) / (total + weight));
      if (raised > value) { value = raised; factors.push({...angler, label: LABELS.angler, weight}); }
    }
    const unverified = p.alerts.filter(a => a.status === 'unverified').length;
    const counted = factors.filter(f => f.key !== 'angler').length;
    // Caps keep a thin score from reading as a sure thing.
    const season = flowSeason(w), liveFlow = factors.some(f => f.key === 'cond');
    if (season) notes.push(season.note);
    if (season && kind === 'river' && !liveFlow && value > CAP_FAIR) {
      value = CAP_FAIR; notes.push('There is no live flow reading during this switch, so the score is capped at Fair. Check the flow before you go.');
    } else if (value > CAP_GOOD && kind === 'river' && !liveFlow) {
      value = CAP_GOOD; notes.push('There is no live flow reading for this reach, so the score is capped at Good.');
    } else if (value > CAP_GOOD && counted < EXCELLENT_INPUTS) {
      value = CAP_GOOD; notes.push('Only ' + counted + ' inputs are available, so the score is capped at Good.');
    }
    const confidence = counted >= 3 && unverified === 0 ? 'High' : counted >= 2 && unverified <= 1 ? 'Medium' : 'Low';
    const label = value >= 80 ? 'Excellent' : value >= 65 ? 'Good' : value >= 45 ? 'Fair' : 'Slow';
    const missing = Object.keys(WEIGHTS[kind]).filter(k => !factors.some(f => f.key === k)).map(k => LABELS[k]);
    return {status: 'scored', kind, value, label, confidence, factors, used: counted, missing, unverified, notes, inputs: Object.keys(WEIGHTS[kind]).length};
  }
  const formula = kind => Object.entries(WEIGHTS[kind]).map(([k, v]) => LABELS[k].toLowerCase() + ' ' + Math.round(v * 100) + '%').join(', ');

  window.ORFFPreview = {get on() { return on; }, set, score, formula};
})();
