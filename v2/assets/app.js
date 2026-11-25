/* Oregon Fish Forecast, version two.
   Reads the shared data files in data/. Every number on the page comes from those files;
   missing values stay missing. Motion: GSAP + ScrollTrigger, with Lenis as the only smooth-scroll
   engine. Under prefers-reduced-motion there is no smooth scrolling, no scrubbing and no shader. */
(() => {
  'use strict';
  const packet = window.ORFF_DATA;
  const view = document.getElementById('view');
  if (!packet || !Array.isArray(packet.waters)) {
    view.classList.remove('booting');
    view.insertAdjacentHTML('beforeend', '<section class="noscript"><p>Water records did not load. Reload the page to try again.</p></section>');
    return;
  }
  const waters = packet.waters;
  const byId = new Map(waters.map(w => [w.id, w]));
  const heroHTML = view.querySelector('.hero').outerHTML;
  // The shader module sits next to this script, wherever the page that loads it lives.
  const riverURL = new URL('river.js', document.currentScript?.src || location.href).href;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const gsap = window.gsap, ST = window.ScrollTrigger;
  const motionOK = () => !!gsap && !!ST && !reduced.matches;
  if (gsap && ST) gsap.registerPlugin(ST);

  /* ---------- Helpers ---------- */
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const num = n => Math.round(n).toLocaleString('en-US');
  const ICONS = window.V2_ICONS || {};
  const icon = name => ICONS[name] ? '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>' : '';
  const today = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Los_Angeles'}).format(new Date());
  const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  const fmtDate = (iso, year) => iso ? new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', {month: 'short', day: 'numeric', ...(year ? {year: 'numeric'} : {}), timeZone: 'UTC'}) : 'Undated';
  const time = (iso, year) => iso ? '<time datetime="' + esc(iso.slice(0, 10)) + '">' + fmtDate(iso, year) + '</time>' : 'Undated';
  const ext = (url, label, cls = 'link ext') => '<a class="' + cls + '" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '<span class="sr-only"> (opens in a new tab)</span></a>';
  const kindLabel = w => w.kind === 'river' ? 'River' : w.kind === 'reservoir' ? 'Reservoir' : 'Lake';
  const pad = n => String(n).padStart(2, '0');
  const store = {
    get(k, f) { try { return localStorage.getItem('orff-concept.' + k) || f; } catch { return f; } },
    set(k, v) { try { localStorage.setItem('orff-concept.' + k, v); } catch {} }
  };
  let origin = store.get('origin', packet.defaultOrigin);
  const mapsRoute = dest => 'https://www.google.com/maps/dir/?' + new URLSearchParams({api: '1', origin, destination: dest, travelmode: 'driving'});

  // A newer WDFW creel report from data/auto-reports.js stands in for the record's report; the score formula decides which.
  const autoReport = w => window.ORFFPreview?.autoReport?.(w) || null;
  const latest = w => autoReport(w) || w.planning.report;
  // ODFW in-season rules from the same file that have not ended.
  const rulesFor = id => (window.ORFF_AUTO?.rules?.[id] || []).filter(r => !r.effective_to || r.effective_to >= today());
  // Reports: freshness from today, so the page ages honestly.
  function freshness(w) {
    const r = latest(w);
    if (!r?.reported_on) return {cls: 'none', text: 'No dated report', age: Infinity};
    const age = daysBetween(r.reported_on, today());
    return {cls: age <= 10 ? 'fresh' : age > 30 ? 'stale' : '', text: 'Reported ' + fmtDate(r.reported_on), age};
  }
  // Daily gauge readings from data/conditions.js. Readings over 36 hours old are not shown as current.
  function gauge(w) {
    const mon = window.ORFF_MONITORING?.[w.id];
    const data = mon?.station && window.ORFF_CONDITIONS?.stations?.[mon.station];
    const fetched = Date.parse(window.ORFF_CONDITIONS?.fetched_at || 0);
    const ok = x => x && Number.isFinite(x.latest) && fetched - Date.parse(x.time) <= 36 * 3600000;
    const flow = ok(data?.flow) ? data.flow : null, temp = ok(data?.temp) ? data.temp : null, stage = !flow && ok(data?.stage) ? data.stage : null;
    const cel = temp ? (/F/.test(temp.unit || '') ? (temp.latest - 32) * 5 / 9 : temp.latest) : null;
    const fah = cel != null ? cel * 9 / 5 + 32 : null;
    // NOAA river forecast and reservoir readings (Army Corps or Reclamation), when this water has them.
    const forecast = mon?.forecast && window.ORFF_CONDITIONS?.forecasts?.[mon.forecast] || null;
    const resv = window.ORFF_CONDITIONS?.reservoirs?.[mon?.dam?.id || mon?.usbrLake] || null;
    const pool = resv && ok(resv.elev) ? resv : null;
    return {mon, flow, stage, cel, fah, fetched, forecast, pool};
  }
  // Reservoir pool from the Army Corps (with its planned rule-curve level and outflow) or Reclamation.
  function poolCard(r) {
    const change = r.elev.week_ago != null ? r.elev.latest - r.elev.week_ago : null;
    const rule = r.rule && Number.isFinite(r.rule.latest) ? r.elev.latest - r.rule.latest : null;
    return '<div class="gauge-card" data-reveal><small>Pool elevation</small><b class="num">' + r.elev.latest.toFixed(1) + ' <span style="font-size:.45em">ft</span></b><p>' +
      [change != null && Math.abs(change) >= 0.1 ? (change < 0 ? 'Down ' : 'Up ') + Math.abs(change).toFixed(1) + ' ft in a week' : change != null ? 'Steady this week' : '',
       rule != null ? Math.abs(rule).toFixed(1) + ' ft ' + (rule < 0 ? 'below' : 'above') + ' the planned level' : '',
       r.outflow ? 'Outflow ' + num(r.outflow.latest) + ' cfs' : ''].filter(Boolean).join('. ') + '. ' + esc(r.name || '') + '.</p></div>';
  }
  // NOAA river forecast: where the flow is headed over the next few days.
  function forecastLine(g) {
    const pts = (g.forecast?.points || []).filter(p => p.flow != null);
    if (pts.length < 2) return '';
    const peak = pts.reduce((a, b) => b.flow > a.flow ? b : a), last = pts.at(-1), when = t => new Date(t).toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles'});
    const now = g.flow?.latest ?? pts[0].flow;
    const text = peak.flow > 1.3 * now ? 'rising to about ' + num(peak.flow) + ' cfs by ' + when(peak.time) : last.flow < 0.77 * now ? 'falling to about ' + num(last.flow) + ' cfs by ' + when(last.time) : 'holding near ' + num(now) + ' cfs through ' + when(last.time);
    return '<p class="small" style="margin-top:16px"><b>NOAA river forecast:</b> ' + text + '. ' + ext('https://water.noaa.gov/gauges/' + g.mon.forecast.toLowerCase(), 'Forecast') + '</p>';
  }
  // Angler posts (data/angler.js): word of mouth, shown for 30 days, newest first.
  const anglerFor = id => (window.ORFF_ANGLER?.waters?.[id] || []).filter(p => { const d = daysBetween(p.date, today()); return d >= 0 && d <= 30; }).sort((a, b) => b.date.localeCompare(a.date));
  function anglerBlock(w) {
    const posts = anglerFor(w.id);
    if (!posts.length) return '';
    const kinds = {catch: 'Catch', guide: 'Guide', conditions: 'Conditions', mention: 'Mention'};
    return '<div class="anglers" data-reveal><p class="eyebrow">From anglers · last 30 days</p><ul>' + posts.map(p =>
      '<li><span class="a-meta">' + time(p.date) + ' · ' + esc(p.platform) + ' · ' + esc(kinds[p.kind] || p.kind) + '</span><p>' + esc(p.note) + (p.where ? ' <span class="muted">(' + esc(p.where) + ')</span>' : '') + '</p>' + ext(p.url, 'Source post') + '</li>').join('') + '</ul>' +
      '<p class="small">Word of mouth from public Facebook groups and TikTok, read ' + fmtDate(window.ORFF_ANGLER.checked_on) + '. Not verified. Recent catch posts on this water can raise its score, never lower it.</p></div>';
  }
  const score = w => window.ORFFPreview ? window.ORFFPreview.score(w) : {status: 'unavailable', reason: 'The score formula did not load. Reload the page to see this score.'};
  // The fish a score is for, in an angler's words: the species the score formula uses ("score_species" when a rule
  // narrows it, otherwise the target species), grouped. Whitefish is named only when nothing else is.
  function speciesWord(w) {
    const groups = [];
    for (const s of w.planning.score_species || w.planning.target_species) {
      const g = /steelhead/i.test(s) ? 'steelhead' : /chinook|coho|salmon/i.test(s) ? 'salmon' : /kokanee/i.test(s) ? 'kokanee'
        : /trout/i.test(s) ? 'trout' : /bass/i.test(s) ? 'bass' : /whitefish/i.test(s) ? 'whitefish' : s.toLowerCase();
      if (!groups.includes(g)) groups.push(g);
    }
    const named = groups.length > 1 ? groups.filter(g => g !== 'whitefish') : groups;
    if (named.length > 3) return named.slice(0, 2).join(', ') + ' and more';
    return named.length > 1 ? named.slice(0, -1).join(', ') + ' and ' + named.at(-1) : named[0] || '';
  }
  // A gauge by its short name: "Madras gauge", or the place in its station name ("Deschutes River near Madras").
  function gaugeName(w, g) {
    if (w.gauge?.label) return w.gauge.label;
    const name = String(g.mon?.name || '').replace(/\s*[(·].*$/, '');
    const place = name.match(/\b(?:near|at|below|above)\s+(.+)$/);
    return place ? place[1] + ' gauge' : name + ' gauge';
  }
  // The one rule an angler most needs before going: an ODFW closure or restriction in effect, then a recorded notice,
  // then a rule that starts soon or another ODFW update, then a notice that needs a trip-day check.
  function keyRule(w) {
    const t = today(), rules = rulesFor(w.id), alerts = w.planning.alerts;
    const hard = r => r.kind === 'closure' || r.kind === 'restriction', live = r => r.effective_from <= t;
    const regs = window.ORFF_AUTO?.sources?.odfw_regs;
    const fromRule = r => ({text: r.summary, url: r.url, tone: hard(r) ? 'warn' : 'info',
      when: live(r) ? (r.effective_to ? 'ODFW, in effect through ' + fmtDate(r.effective_to) : 'ODFW, in effect') : 'ODFW, starts ' + fmtDate(r.effective_from) + (r.effective_to ? ', through ' + fmtDate(r.effective_to) : '')});
    const rule = rules.find(r => live(r) && hard(r));
    if (rule) return fromRule(rule);
    const notice = alerts.find(a => a.status !== 'unverified');
    if (notice) return {text: notice.summary, url: notice.url, tone: 'warn', when: notice.checked_on ? 'Recorded notice, source checked ' + fmtDate(notice.checked_on) : 'Recorded notice'};
    const other = rules.find(r => hard(r)) || rules[0];
    if (other) return fromRule(other);
    const check = alerts.find(a => a.status === 'unverified');
    if (check) return {text: check.summary, url: check.url, tone: 'check', when: 'Needs a trip-day check'};
    return {text: 'No closure or notice is on record for this reach.', url: regs?.url || 'https://myodfw.com/articles/regulation-updates', tone: 'none', when: 'Check ODFW’s current rules before you go', none: true};
  }
  function stockRows(id) {
    const names = window.ORFF_STOCKING_MATCH?.[id];
    if (!names) return [];
    const res = names.map(n => new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'));
    return (window.ORFF_STOCKING?.rows || []).filter(r => res.some(re => re.test(r.waterbody)));
  }
  // The guide water an ODFW schedule name belongs to, if any. Remembered, since the full schedule asks for every row.
  const guideCache = new Map();
  function guideFor(waterbody) {
    if (guideCache.has(waterbody)) return guideCache.get(waterbody);
    let found = null;
    for (const [id, names] of Object.entries(window.ORFF_STOCKING_MATCH || {})) {
      if (names.some(n => new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(waterbody))) { found = byId.get(id) || null; break; }
    }
    guideCache.set(waterbody, found);
    return found;
  }
  function mondayOf(iso) {
    const d = new Date(iso + 'T12:00:00Z'), day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
  }
  const addDays = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  // Where to get on the water: the documented access points, or the single access point older records carry.
  const accessPoints = w => { const p = w.planning; return p.access_points?.length ? p.access_points : p.access_point ? [{label: p.access_point.label, type: 'Documented access', note: p.access_summary, map_query: p.access_point.map_query}] : []; };
  function ring(value, size = 92) {
    const r = 40, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value));
    return '<div class="ring" style="width:' + size + 'px;height:' + size + 'px"><svg viewBox="0 0 92 92" aria-hidden="true"><circle class="track" cx="46" cy="46" r="' + r + '"/><circle class="val" cx="46" cy="46" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - v / 100)).toFixed(1) + '" data-ring="' + c.toFixed(1) + '"/></svg><b class="num" data-count="' + v + '">' + v + '</b></div>';
  }

  /* ---------- Home sections ---------- */
  function wire() {
    const items = [];
    const counts = window.ORFF_COUNTS?.stations || {}, meta = window.ORFF_COUNT_STATIONS?.stations || {};
    for (const code of ['BON', 'TDA', 'WFF']) {
      const s = counts[code];
      if (!s) continue;
      // Every seven-day count says which seven days, since each dam reports on its own schedule.
      for (const k of ['coho', 'chinook', 'steelhead']) {
        const v = s.species[k];
        if (v) items.push('<b>' + num(v.last7) + '</b> ' + esc(v.label.toLowerCase()) + ' <span>past ' + esc(meta[code]?.name || code) + ' in the 7 days to ' + fmtDate(s.through) + '</span>');
      }
    }
    for (const w of waters) {
      const g = gauge(w);
      if (g.flow && items.length < 16) items.push('<b>' + num(g.flow.latest) + ' cfs</b> ' + esc(w.name) + ' <span>at the ' + esc(gaugeName(w, g)) + (g.fah != null ? ', ' + Math.round(g.fah) + '°F' : '') + '</span>');
    }
    const t = today(), mon = mondayOf(t);
    const week = (window.ORFF_STOCKING?.rows || []).filter(r => r.week_start === mon);
    if (week.length) items.push('<b>' + week.length + '</b> ' + (week.length === 1 ? 'water' : 'waters') + ' <span>on ODFW’s trout stocking plan for the week of ' + fmtDate(mon) + '</span>');
    if (!items.length) return '';
    const list = items.map(i => '<li><i class="dot" aria-hidden="true"></i>' + i + '</li>').join('');
    return '<div class="wire" id="wire" role="region" aria-label="Latest readings"><div class="wire-track"><ul>' + list + '</ul><ul aria-hidden="true">' + list + '</ul></div></div>';
  }

  // One concrete reason to go, from the input that says most about a short-listed water today.
  // Firm news comes first (our own field check, ODFW stocking, the run, the gauge), then angler posts and the report.
  function whyNow(w, s) {
    const strong = k => s.factors.find(f => f.key === k && f.value >= 70);
    const pick = ['field', 'stock', 'run', 'cond', 'angler', 'tone'].map(strong).find(Boolean) || [...s.factors].sort((x, y) => y.value - x.value)[0];
    if (!pick) return '';
    const r = latest(w), g = gauge(w);
    if (pick.key === 'cond') return pick.display.split(' · ')[0] + ' at the ' + gaugeName(w, g) + (g.fah != null ? ', ' + Math.round(g.fah) + '°F' : '');
    if (pick.key === 'angler') {
      const post = anglerFor(w.id).find(p => p.scoring && p.kind === 'catch') || anglerFor(w.id).find(p => p.scoring);
      return post ? 'Angler catch post, ' + fmtDate(post.date) + ' (' + post.platform + ', not verified)' : pick.display;
    }
    return pick.key === 'field' ? 'Field check: ' + pick.display
      : pick.key === 'stock' ? (/^Week of/.test(pick.display) ? 'ODFW stocking, ' + pick.display.replace(/^W/, 'w') : pick.display + ' (ODFW)')
      : pick.key === 'run' ? 'Run at ' + pick.display
      : pick.key === 'tone' ? pick.display + ' report' + (r?.reported_on ? ', ' + fmtDate(r.reported_on) : '')
      : pick.key === 'fresh' ? 'Report ' + pick.display
      : pick.display;
  }
  function shortlist() {
    const scored = waters.map(w => ({w, s: score(w), f: freshness(w)})).filter(x => x.s.status === 'scored')
      .sort((a, b) => b.s.value - a.s.value || a.f.age - b.f.age).slice(0, 5);
    if (!scored.length) return '';
    return '<section class="section home-list" id="shortlist" aria-labelledby="sl-h"><div class="inner">' +
      '<div class="list-head"><h2 id="sl-h" class="display h-list" tabindex="-1">This week’s <em>best waters</em></h2>' +
      '<p class="list-sub">Top scores today</p>' +
      '<a class="list-all" href="#/waters">Explore all waters ' + icon('arrow-right-linear') + '</a></div>' +
      '<ul class="picks">' + scored.map(({w, s, f}) => {
        // The species note is said by "for trout"; any other note (a rule change, a cap) keeps its first sentence.
        const note = (s.notes || []).filter(n => n !== w.planning.score_species_note).map(n => n.match(/^.*?\.(?=\s|$)/)?.[0] || n)[0] || '';
        const kind = w.planning.score_species ? 'Score for ' : 'Fishing score for ';
        return '<li class="pick-row"><a href="#/water/' + esc(w.id) + '">' +
          '<span class="p-place"><span class="p-name">' + esc(w.name) + '</span><span class="p-reach">' + esc(w.reach) + '</span></span>' +
          '<span class="p-verdict"><span class="p-line"><span class="p-score num"><span class="sr-only">' + kind + esc(speciesWord(w)) + ': </span>' + s.value + '<i>/100</i></span>' +
          '<span class="p-for" aria-hidden="true">for ' + esc(speciesWord(w)) + '</span></span>' +
          '<span class="p-why">' + esc(whyNow(w, s)) + '</span>' +
          (f.age > 14 || note ? '<span class="p-notes">' + (f.age > 14 ? '<span>' + (f.age === Infinity ? 'No dated report' : 'Latest report ' + fmtDate(latest(w).reported_on)) + '</span>' : '') +
            (note ? '<span class="p-warn">' + icon('danger-triangle-linear') + esc(note) + '</span>' : '') + '</span>' : '') + '</span>' +
          '<span class="p-go" aria-hidden="true">' + icon('arrow-right-linear') + '</span></a></li>';
      }).join('') + '</ul>' +
      '<p class="score-note">Scores come from dated reports, river gauges, dam counts and ODFW stocking. Each water page shows every input, how sure the score is and any rules notice. <a class="link" href="#/method">How scores work</a></p></div></section>';
  }

  function counts() {
    const data = window.ORFF_COUNTS?.stations || {}, meta = window.ORFF_COUNT_STATIONS?.stations || {};
    const codes = ['BON', 'TDA', 'WFF'].filter(c => data[c]);
    const head = '<div class="section-head"><div><p class="eyebrow">Fish counts · Columbia River DART</p><h1 id="ct-h" class="display h-section" data-split tabindex="-1">Are the fish <em>in the river</em> yet?</h1></div>' +
      '<p class="lede" data-reveal>Adult salmon and steelhead counted climbing the ladders, updated every morning. Counts show run timing, not how many fish are being caught.</p></div>';
    let body;
    if (!codes.length) {
      body = '<p class="count-note">Today’s counts did not load. Use the official sources: ' + Object.values(meta).filter(m => m.dart).map(m => ext(m.url, m.name)).join(', ') + '.</p>';
    } else {
      body = '<div class="stations">' + codes.map(code => {
        const s = data[code], m = meta[code] || {name: code};
        const keys = ['chinook', 'coho', 'steelhead'].filter(k => s.species[k]);
        const week = keys.reduce((t, k) => t + s.species[k].last7, 0);
        return '<article class="station" data-reveal><h2>' + esc(m.name) + '</h2><p class="meta">' + esc(m.river || '') + ' · through ' + time(s.through) + '</p>' +
          '<p class="big-count num" data-count="' + week + '">' + num(week) + '</p><p class="big-label">adult Chinook, coho and steelhead in the 7 days to ' + fmtDate(s.through) + '</p>' +
          '<ul class="runs">' + keys.map(k => {
            const v = s.species[k], max = Math.max(v.ytd, v.last_year_ytd || 0) || 1;
            const pct = v.last_year_ytd ? Math.round(100 * v.ytd / v.last_year_ytd) + '% of last year' : 'No last-year figure';
            return '<li class="run-row"><span>' + esc(v.label) + ' · <span class="num">' + num(v.ytd) + '</span> this year</span><span class="num">' + pct + '</span>' +
              '<span class="bars-pair" role="img" aria-label="' + esc(v.label + ': ' + num(v.ytd) + ' this year to date, ' + (v.last_year_ytd ? num(v.last_year_ytd) + ' by the same date last year' : 'no last-year figure')) + '">' +
              '<span class="bar"><i data-bar style="transform:scaleX(' + (v.ytd / max).toFixed(3) + ')"></i></span>' +
              (v.last_year_ytd ? '<span class="bar last"><i data-bar style="transform:scaleX(' + (v.last_year_ytd / max).toFixed(3) + ')"></i></span>' : '') + '</span></li>';
          }).join('') + '</ul><p class="count-legend" aria-hidden="true"><span><i></i>This year</span><span class="ly"><i></i>Same date last year</span></p>' +
          '<p class="small" style="margin:18px 0 0">' + ext(s.source || m.url, 'Daily counts') + '</p></article>';
      }).join('') + '</div><p class="count-note">Sherars Falls, Leaburg Dam and Winchester Dam publish their own counts; each water page links the ones that matter for that reach.</p>';
    }
    return '<section class="section ink" id="counts" aria-labelledby="ct-h"><div class="inner">' + head + body + '</div></section>';
  }

  const dir = {q: '', kind: 'all', region: 'all', sort: 'fresh'};
  function directory() {
    const regions = [...new Set(waters.map(w => w.region))].sort();
    return '<section class="section" id="waters" aria-labelledby="dir-h"><div class="inner">' +
      '<div class="section-head"><div><p class="eyebrow">' + waters.length + ' reaches · ' + regions.length + ' regions</p><h1 id="dir-h" class="display h-section" data-split tabindex="-1">Every water, <em>one reach</em> at a time.</h1></div>' +
      '<p class="lede" data-reveal>Each row names the exact reach the report covers. Open one for access, notices, gauge readings, counts and sources.</p></div>' +
      '<div class="controls" role="search">' +
      '<label class="search"><span class="sr-only">Search waters</span>' + icon('magnifer-linear') + '<input id="q" type="search" placeholder="Search a river, lake, region or species" autocomplete="off" value="' + esc(dir.q) + '"></label>' +
      '<div class="seg" role="group" aria-label="Water type">' + [['all', 'All'], ['river', 'Rivers'], ['lake', 'Lakes']].map(([v, l]) => '<button type="button" data-kind="' + v + '" aria-pressed="' + (dir.kind === v) + '">' + l + '</button>').join('') + '</div>' +
      '<label><span class="sr-only">Region</span><select class="select" id="region"><option value="all">All regions</option>' + regions.map(r => '<option' + (dir.region === r ? ' selected' : '') + '>' + esc(r) + '</option>').join('') + '</select></label>' +
      '<label><span class="sr-only">Sort</span><select class="select" id="sort">' + [['fresh', 'Freshest report'], ['score', 'Best score'], ['name', 'A to Z']].map(([v, l]) => '<option value="' + v + '"' + (dir.sort === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></label>' +
      '</div><p class="result-count" id="result-count" role="status" aria-live="polite"></p><ul class="rows" id="rows"></ul></div></section>';
  }
  function rowHTML(w, i) {
    const f = freshness(w), g = gauge(w), s = score(w), notices = w.planning.alerts.length;
    const cond = g.flow ? '<b>' + num(g.flow.latest) + ' cfs' + (g.fah != null ? ' · ' + Math.round(g.fah) + '°F' : '') + '</b><span class="muted">' + esc(g.mon.name) + '</span>'
      : g.stage ? '<b>' + g.stage.latest.toFixed(1) + ' ft stage</b><span class="muted">' + esc(g.mon.name) + '</span>'
      : g.pool ? '<b>Pool ' + g.pool.elev.latest.toFixed(0) + ' ft</b><span class="muted">' + esc(g.pool.name || g.mon.name) + '</span>'
      : '<span class="muted">' + (g.mon?.mode === 'operator' ? 'Operator flow data' : g.mon?.mode === 'historical' ? 'Historical gauge only' : g.mon?.station ? 'No current gauge reading' : 'No live feed') + '</span>';
    const sc = s.status === 'scored' ? '<span class="mini-score"><span class="sr-only">Score </span>' + s.value + '<i aria-hidden="true"><b style="width:' + s.value + '%"></b></i></span>'
      : '<span class="mini-score off">' + (s.status === 'withheld' ? 'Score held for rules' : s.status === 'unavailable' ? 'Score unavailable' : 'Not enough to score') + '</span>';
    return '<li class="row"><a href="#/water/' + esc(w.id) + '">' +
      '<span class="idx" aria-hidden="true">' + pad(i + 1) + '</span>' +
      '<span class="name">' + esc(w.name) + '<small class="muted">' + esc(w.reach) + '</small></span>' +
      '<span class="cell c-species"><b class="muted">' + esc(w.region) + ' · ' + kindLabel(w) + '</b>' + esc(w.planning.target_species.slice(0, 3).join(', ')) + '</span>' +
      '<span class="cell c-report"><span class="chip ' + f.cls + '">' + esc(f.text) + '</span>' + (notices ? ' <span class="muted">· ' + notices + (notices === 1 ? ' notice' : ' notices') + '</span>' : '') + (anglerFor(w.id).length ? ' <span class="muted">· Angler report ' + fmtDate(anglerFor(w.id)[0].date) + '</span>' : '') + '</span>' +
      '<span class="cell c-cond">' + cond + '</span>' +
      '<span class="c-score">' + sc + '</span>' +
      '<span class="arrow" aria-hidden="true">' + icon('arrow-right-linear') + '</span></a></li>';
  }
  function renderRows(animate) {
    const list = document.getElementById('rows');
    if (!list) return;
    const q = dir.q.trim().toLowerCase();
    let rows = waters.filter(w => (dir.kind === 'all' || (dir.kind === 'river' ? w.kind === 'river' : w.kind !== 'river')) && (dir.region === 'all' || w.region === dir.region) &&
      (!q || [w.name, w.reach, w.region, ...w.planning.target_species].join(' ').toLowerCase().includes(q)));
    const sv = w => { const s = score(w); return s.status === 'scored' ? s.value : -1; };
    rows.sort(dir.sort === 'name' ? (a, b) => (a.name + a.reach).localeCompare(b.name + b.reach)
      : dir.sort === 'score' ? (a, b) => sv(b) - sv(a) || a.name.localeCompare(b.name)
      : (a, b) => freshness(a).age - freshness(b).age || a.name.localeCompare(b.name));
    document.getElementById('result-count').textContent = rows.length === waters.length ? 'Showing all ' + rows.length + ' waters' : 'Showing ' + rows.length + ' of ' + waters.length + ' waters';
    list.innerHTML = rows.length ? rows.map(rowHTML).join('') : '<li class="empty"><p>No water matches that.</p><button type="button" class="btn btn-line" id="reset">Clear search and filters</button></li>';
    if (animate && motionOK()) gsap.from(list.children, {y: 18, opacity: 0, duration: .5, stagger: .025, ease: 'power3.out', clearProps: 'all'});
    if (ST) requestAnimationFrame(() => ST.refresh());
  }

  function stocking() {
    const all = window.ORFF_STOCKING?.rows || [], t = today(), mon = mondayOf(t);
    let week = all.filter(r => r.week_start === mon), label = 'this week';
    if (!week.length) {
      const next = all.map(r => r.week_start).filter(d => d > t).sort()[0];
      if (next) { week = all.filter(r => r.week_start === next); label = 'the week of ' + fmtDate(next); }
    }
    week.sort((a, b) => b.total - a.total);
    const total = week.reduce((s, r) => s + r.total, 0);
    return '<section class="section paper-2" id="stocking" aria-labelledby="st-h"><div class="inner">' +
      '<div class="section-head"><div><p class="eyebrow">ODFW trout stocking</p><h1 id="st-h" class="display h-section" data-split tabindex="-1">Fresh trout, <em>' + esc(label) + '.</em></h1></div>' +
      '<p class="lede" data-reveal>ODFW’s planned releases, read every morning. These are plans, not confirmed releases, and the agency can change them.</p></div>' +
      (week.length ? '<div class="stock-grid"><div data-reveal><p class="stock-total num" data-count="' + total + '">' + num(total) + '</p><p class="lede" style="margin-top:14px">trout planned across ' + week.length + (week.length === 1 ? ' water' : ' waters') + ' for ' + esc(week[0].week_label) + '.</p>' +
        '<p style="margin-top:28px"><button type="button" class="btn btn-ink" data-jump="sch-h">Search the whole schedule ' + icon('arrow-down-linear') + '</button></p></div>' +
        '<ul class="stock-list">' + week.map(r => {
          const g = guideFor(r.waterbody);
          const name = g ? '<a href="#/water/' + esc(g.id) + '"><strong>' + esc(r.waterbody) + '</strong></a>' : '<strong>' + esc(r.waterbody) + '</strong>';
          return '<li data-reveal>' + name + '<span class="num">' + num(r.total) + ' fish</span><small>' + esc(r.zone) + (g ? ' · In the guide' : '') + '</small></li>';
        }).join('') + '</ul></div>'
        : '<p class="lede">' + (window.ORFF_STOCKING ? 'No stockings are listed for the coming weeks. ' : 'The stocking schedule did not load. ') + ext(window.ORFF_STOCKING?.source || 'https://myodfw.com/fishing/species/trout/stocking-schedule', 'Check ODFW’s schedule') + '</p>') +
      '</div></section>' + (all.length ? scheduleHTML() : '');
  }

  // The whole ODFW schedule, searchable: about a year ahead, plus the past 8 weeks. #/stocking?q=<words>&weeks=past|all
  // opens it searched (alert emails link a water this way), and the address follows the search box.
  const sched = {q: '', weeks: 'coming', zone: ''};
  const zoneOf = r => String(r.zone || '').split('/')[0].trim();
  const monthOf = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {month: 'long', year: 'numeric', timeZone: 'UTC'});
  function weekBucket(r, mon) {
    return r.week_start < addDays(mon, -56) ? 'old' : r.week_start < mon ? 'past' : r.week_start < addDays(mon, 7) ? 'this' : r.week_start < addDays(mon, 14) ? 'next' : 'later';
  }
  function fishLine(r) {
    const parts = [['legals', 'legals'], ['larger', 'larger'], ['pounders', 'pounders'], ['trophy', 'trophy'], ['brood', 'brood'], ['fingerling', 'fingerlings']].filter(([k]) => r[k] > 0).map(([k, l]) => num(r[k]) + ' ' + l);
    return parts.length > 1 ? parts.join(', ') : parts[0] || '';
  }
  function scheduleHTML() {
    const zones = [...new Set((window.ORFF_STOCKING?.rows || []).map(zoneOf).filter(Boolean))].sort();
    return '<section class="section" id="schedule" aria-labelledby="sch-h"><div class="inner">' +
      '<div class="section-head"><div><p class="eyebrow">ODFW stocking schedule · read ' + fmtDate(window.ORFF_STOCKING.fetched_at, true) + '</p><h2 id="sch-h" class="display h-section" data-split tabindex="-1">When is my lake <em>stocked?</em></h2></div>' +
      '<p class="lede" data-reveal>Every water on ODFW’s plan, about a year ahead, and the past 8 weeks. Waters in this guide link to their pages. Plans can change for weather, access or fish health.</p></div>' +
      '<div class="controls sched-controls" role="search">' +
      '<label class="search"><span class="sr-only">Search stocked waters or zones</span>' + icon('magnifer-linear') + '<input id="sq" type="search" placeholder="Search a lake, pond or zone" autocomplete="off" value="' + esc(sched.q) + '"></label>' +
      '<div class="seg" role="group" aria-label="Weeks">' + [['coming', 'Coming up'], ['past', 'Recent'], ['all', 'All']].map(([v, l]) => '<button type="button" data-weeks="' + v + '" aria-pressed="' + (sched.weeks === v) + '">' + l + '</button>').join('') + '</div>' +
      '<label><span class="sr-only">Zone</span><select class="select" id="szone"><option value="">All zones</option>' + zones.map(z => '<option value="' + esc(z) + '"' + (sched.zone === z ? ' selected' : '') + '>' + esc(z) + '</option>').join('') + '</select></label>' +
      '</div><p class="result-count" id="sched-count" role="status" aria-live="polite"></p><div id="sched"></div></div></section>';
  }
  function renderSchedule() {
    const box = document.getElementById('sched');
    if (!box) return;
    const mon = mondayOf(today()), terms = sched.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const order = {this: 0, next: 1, later: 2, past: 3};
    const hits = (window.ORFF_STOCKING?.rows || []).map(r => ({r, b: weekBucket(r, mon)})).filter(({r, b}) => b !== 'old' &&
      (sched.weeks === 'all' || (sched.weeks === 'past') === (b === 'past')) && (!sched.zone || zoneOf(r) === sched.zone) &&
      terms.every(t => (r.waterbody + ' ' + (r.odfw_name || '') + ' ' + r.zone).toLowerCase().includes(t)))
      .sort((x, y) => order[x.b] - order[y.b] || (x.b === 'past' ? y.r.week_start.localeCompare(x.r.week_start) : x.r.week_start.localeCompare(y.r.week_start)) || x.r.waterbody.localeCompare(y.r.waterbody));
    const groups = new Map();
    for (const {r, b} of hits) {
      const label = b === 'this' ? 'This week' : b === 'next' ? 'Next week' : b === 'past' ? 'Past 8 weeks' : monthOf(r.week_start);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(r);
    }
    document.querySelectorAll('[data-weeks]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.weeks === sched.weeks)));
    document.getElementById('sched-count').textContent = hits.length + ' planned ' + (hits.length === 1 ? 'stocking' : 'stockings');
    box.innerHTML = hits.length ? [...groups].map(([label, list]) => '<div class="sched-group"><h3 class="sched-h">' + esc(label) + ' <span class="num">' + list.length + '</span></h3><ul class="stock-list">' + list.map(r => {
      const g = guideFor(r.waterbody), fish = fishLine(r);
      return '<li>' + (g ? '<a href="#/water/' + esc(g.id) + '"><strong>' + esc(r.waterbody) + '</strong></a>' : '<strong>' + esc(r.waterbody) + '</strong>') + '<span class="num">' + num(r.total) + ' trout</span>' +
        '<small>' + esc([r.week_label || 'Week of ' + fmtDate(r.week_start), fish, r.zone, g && 'In the guide'].filter(Boolean).join(' · ')) + '</small></li>';
    }).join('') + '</ul></div>').join('')
      : '<div class="empty"><p>No stockings match.</p><button type="button" class="btn btn-line" id="sched-reset">Clear search and filters</button></div>';
    if (ST) requestAnimationFrame(() => ST.refresh());
  }
  function noteSchedule() {
    const p = new URLSearchParams();
    if (sched.q.trim()) p.set('q', sched.q.trim());
    if (sched.weeks !== 'coming') p.set('weeks', sched.weeks);
    try { history.replaceState(history.state, '', '#/stocking' + (p.toString() ? '?' + p : '')); } catch {}
  }
  function bindSchedule() {
    const q = document.getElementById('sq'), zone = document.getElementById('szone');
    if (!q) return;
    q.addEventListener('input', () => { sched.q = q.value; noteSchedule(); renderSchedule(); });
    zone.addEventListener('change', () => { sched.zone = zone.value; renderSchedule(); });
    document.querySelectorAll('[data-weeks]').forEach(b => b.addEventListener('click', () => { sched.weeks = b.dataset.weeks; noteSchedule(); renderSchedule(); }));
    document.getElementById('sched').addEventListener('click', e => {
      if (!e.target.closest('#sched-reset')) return;
      Object.assign(sched, {q: '', weeks: 'coming', zone: ''});
      q.value = ''; zone.value = ''; noteSchedule(); renderSchedule(); q.focus();
    });
  }

  function method() {
    const f = [['tone', 30, 'Report tone', 'What the latest dated report says, word for word.'], ['run', 25, 'Run strength', 'This year’s dam counts against the same date last year.'], ['cond', 20, 'River conditions', 'Gauge flow against its 7-day median, and water temperature for cold-water fish.'], ['fresh', 15, 'Report freshness', 'A week-old report counts for more than a month-old one.'], ['stock', 10, 'Recent stocking', 'An ODFW trout release in the last few weeks.']];
    return '<section class="section" id="method" aria-labelledby="m-h"><div class="inner method-pin">' +
      '<div><p class="eyebrow">How a river score is built</p><h1 id="m-h" class="display h-section" data-split tabindex="-1">Five inputs, <em>weighed</em> in the open.</h1>' +
      '<p class="lede" data-reveal>Every input has a source and a date. A missing input is skipped and lowers confidence; it is never filled in. A rules notice holds the score, or limits it to the species still open. A river needs a live flow reading, and any water needs three inputs, to reach Excellent. Lakes use stocking 40%, report tone 35% and freshness 25%. Recent angler posts can nudge a score up, never down; our own field checks can move it either way.</p>' +
      '</div>' +
      '<div class="stack"><div class="stack-bar" role="img" aria-label="River score weights: report tone 30%, run strength 25%, river conditions 20%, report freshness 15%, recent stocking 10%">' +
      f.map(([k, w]) => '<span class="f-' + k + '" style="width:' + w + '%" data-stack></span>').join('') + '</div>' +
      '<ul class="factor-list">' + f.map(([k, w, l, d]) => '<li data-factor><span class="sw f-' + k + '" aria-hidden="true"></span><strong>' + l + '</strong><span class="num">' + w + '%</span><p>' + d + '</p></li>').join('') + '</ul></div>' +
      '</div></section>';
  }

  function principles() {
    const p = [['Missing stays missing.', 'If a gauge is down or a report is undated, the page says so. Nothing is estimated to fill the gap.'], ['A gauge is not an access point.', 'Readings describe one station. Directions only ever go to a documented public access.'], ['Every claim has a date and a source.', 'Reports, notices and counts link to the agency or operator that published them.'], ['Rules come before scores.', 'A closure or restriction holds a score or limits it to the species still open, and a trip-day check is flagged when a rule could not be confirmed.']];
    return '<section class="section ink" aria-labelledby="p-h"><div class="inner"><div class="section-head"><div><p class="eyebrow">What this site won’t do</p><h2 id="p-h" class="display h-section" data-split>Honest about <em>the river.</em></h2></div></div>' +
      '<ol class="principles">' + p.map(([h, t], i) => '<li data-reveal><span class="n">' + pad(i + 1) + '</span><h3>' + h + '</h3><p>' + t + '</p></li>').join('') + '</ol></div></section>';
  }

  // A lake or reservoir added to the guide after anglers' posts about it were filed as "not in the guide yet"
  // (data/angler.js keeps them for 30 days). Rivers are left alone: a post may be about another section.
  function guideLakeFor(name) {
    const n = String(name || '').toLowerCase();
    return waters.find(w => w.kind !== 'river' && [w.name, ...(window.ORFF_STOCKING_MATCH?.[w.id] || [])]
      .some(x => x.length > 4 && !/[()]/.test(x) && n.includes(x.toLowerCase()))) || null;
  }
  function anglers() {
    const a = window.ORFF_ANGLER;
    if (!a) return '<section class="section paper-2" id="anglers" aria-labelledby="an-h"><div class="inner"><h1 id="an-h" class="display h-section" tabindex="-1">What anglers are <em>posting.</em></h1><p class="lede">Angler posts did not load. Reload the page to try again.</p></div></section>';
    // Waters with posts from their own reach come first; each shows its most useful post and where it was.
    const lead = posts => posts.find(p => p.scoring) || posts.find(p => p.kind === 'catch') || posts[0];
    const inGuide = waters.map(w => ({w, posts: anglerFor(w.id)})).filter(x => x.posts.length)
      .sort((x, y) => (y.posts.some(p => p.scoring) - x.posts.some(p => p.scoring)) || y.posts[0].date.localeCompare(x.posts[0].date));
    const r = a.reviewed || {};
    return '<section class="section paper-2" id="anglers" aria-labelledby="an-h"><div class="inner">' +
      '<div class="section-head"><div><p class="eyebrow">Word on the water · ' + fmtDate(a.window_start) + ' to ' + fmtDate(a.checked_on) + '</p><h1 id="an-h" class="display h-section" data-split tabindex="-1">What anglers are <em>posting.</em></h1></div>' +
      '<p class="lede" data-reveal>We read ' + num(r.facebook_posts || 0) + ' posts from public Oregon fishing groups on Facebook and ' + num(r.tiktok_videos || 0) + ' TikTok videos from the last 30 days. Here is what mentioned a real catch or condition. Word of mouth, not verified.</p></div>' +
      '<div class="word-grid"><div><h2 class="word-h">In the guide</h2><ul class="word-list">' + inGuide.map(({w, posts}) =>
        '<li data-reveal><a href="#/water/' + esc(w.id) + '"><strong>' + esc(w.name) + '</strong><span class="muted"> ' + esc(w.reach) + '</span></a><p>' + esc(lead(posts).note) + (lead(posts).where ? ' <span class="muted">(' + esc(lead(posts).where) + ')</span>' : '') + '</p><span class="a-meta">' + fmtDate(lead(posts).date) + '</span></li>').join('') + '</ul></div>' +
      '<div><h2 class="word-h">Also busy this month</h2><p class="small">Waters anglers talked about that are not in the guide yet.</p><ol class="word-list elsewhere">' + (a.elsewhere || []).filter(e => !guideLakeFor(e.water)).sort((x, y) => y.posts - x.posts || y.latest.localeCompare(x.latest)).map(e =>
        '<li data-reveal><strong>' + esc(e.water) + '</strong><p>' + esc(e.note) + '</p><span class="a-meta">' + fmtDate(e.latest) + '</span></li>').join('') + '</ol></div></div>' +
      '<p class="small" style="margin-top:28px">Sources: ' + (a.sources || []).map(x => ext(x.url, x.label)).join(', ') + '.</p></div></section>';
  }

  /* ---------- Water map ---------- */
  // Leaflet, the map code (map.js) and the pin positions (data/map.js) load only when the map opens. Their addresses
  // sit in index.html's <template id="map-assets">, so they carry stamps like every other file.
  const mapState = {kind: 'all', base: 'satellite', hydro: true, selected: null, trace: {}};
  let liveMap = null, mapLoad = null;
  function loadMapAssets() {
    if (window.L && window.ORFFMap && window.ORFF_MAP) return Promise.resolve();
    const tpl = document.getElementById('map-assets');
    if (!tpl) return Promise.reject(new Error('The map files are not listed on this page.'));
    return mapLoad ??= Promise.all([...tpl.content.children].map(src => {
      const css = src.tagName === 'LINK', url = src.getAttribute(css ? 'href' : 'src');
      const el = document.createElement(css ? 'link' : 'script');
      if (css) { el.rel = 'stylesheet'; el.href = url; } else { el.src = url; el.async = false; }
      return new Promise((resolve, reject) => {
        el.onload = resolve;
        el.onerror = () => { el.remove(); reject(new Error('Could not load ' + url)); };
        document.head.appendChild(el);
      });
    })).catch(e => { mapLoad = null; throw e; });
  }
  function mapPage() {
    const kind = w => w.kind === 'river' ? 'river' : 'lake';
    return '<section class="section map-section" id="map" aria-labelledby="map-h"><div class="inner">' +
      '<div class="section-head"><div><p class="eyebrow">The water map · ' + waters.length + ' reaches</p><h1 id="map-h" class="display h-section" data-split tabindex="-1">See the <em>water.</em></h1></div>' +
      '<p class="lede" data-reveal>Every stream and lake in blue, with a pin for each reach in the guide. Choose one to find it; a river with a USGS gauge traces its own channel.</p></div>' +
      '<div class="map-layout"><div class="map-frame">' +
      '<div id="water-map" class="water-map" data-lenis-prevent role="region" aria-label="Map of the guide’s waters. Use the list of waters to choose one with a keyboard."><p class="map-msg">Loading the map…</p></div>' +
      '<div class="map-tools"><div class="seg" role="group" aria-label="Water type">' + [['all', 'All'], ['river', 'Rivers'], ['lake', 'Lakes']].map(([v, l]) => '<button type="button" data-map-kind="' + v + '">' + l + '</button>').join('') + '</div>' +
      '<div class="seg" role="group" aria-label="Base map">' + [['satellite', 'Satellite'], ['topo', 'Topo']].map(([v, l]) => '<button type="button" data-map-base="' + v + '">' + l + '</button>').join('') + '</div></div>' +
      '<div class="map-legend"><span><i class="dot river" aria-hidden="true"></i>River reach</span><span><i class="dot lake" aria-hidden="true"></i>Lake or reservoir</span><span><i class="trace" aria-hidden="true"></i>Traced river</span>' +
      '<label><input type="checkbox" id="hydro"' + (mapState.hydro ? ' checked' : '') + '> Streams and lakes</label></div></div>' +
      '<aside class="map-side" aria-label="Waters on the map"><div class="card map-card" id="map-card" aria-live="polite"></div>' +
      '<div class="map-list-head"><h2>Waters</h2><span class="num" id="map-count"></span></div>' +
      '<ul class="map-list" id="map-list" data-lenis-prevent>' + waters.map(w => '<li data-kind="' + kind(w) + '"><button type="button" data-map-water="' + esc(w.id) + '" aria-pressed="false"><i class="dot ' + kind(w) + '" aria-hidden="true"></i>' +
        '<span><strong>' + esc(w.name) + '</strong><small>' + esc(w.reach) + '</small></span></button></li>').join('') + '</ul></aside></div>' +
      '<p class="small map-note">Pins mark the general area of each reach. They are not access points: directions go only to a documented public access. A traced river follows the USGS network about 25 km up and downstream of its gauge, which can run past the named reach. Map tiles and river lines need a connection.</p>' +
      '</div></section>';
  }
  function mapCard(id) {
    const el = document.getElementById('map-card'), w = byId.get(id);
    if (!el) return;
    document.querySelectorAll('[data-map-water]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mapWater === id)));
    if (!w) { el.innerHTML = '<p class="eyebrow">Start here</p><p class="map-empty">Choose a pin, or a water from the list.</p>'; return; }
    const s = score(w), t = mapState.trace[id], pt = accessPoints(w)[0];
    const gauged = w.kind === 'river' && !!window.ORFFMap?.station(w.id);
    const trace = w.kind !== 'river' || !window.ORFFMap ? '' : !gauged ? 'No connected USGS gauge, so the river line is not traced. The blue stream layer still shows it.'
      : t === 'loading' ? 'Tracing the river from its USGS gauge…' : t === 'done' ? 'River traced from its USGS gauge.' : t === 'error' ? 'The river line could not load. The blue stream layer still shows the channel.' : '';
    el.innerHTML = '<p class="eyebrow">' + kindLabel(w) + ' · ' + esc(w.region) + '</p><h3>' + esc(w.name) + '</h3><p class="map-reach">' + esc(w.reach) + '</p>' +
      '<p class="map-score">' + (s.status === 'scored' ? '<b class="num">' + s.value + '</b>/100 for ' + esc(speciesWord(w)) + ' · ' + esc(s.label) : s.status === 'withheld' ? 'Score held for rules' : 'Not scored yet') + '</p>' +
      '<p class="small">' + esc(w.planning.target_species.join(', ')) + '</p>' + (trace ? '<p class="small">' + trace + '</p>' : '') +
      '<p class="map-acts"><a class="btn btn-ink" href="#/water/' + esc(w.id) + '">Open this water ' + icon('arrow-right-linear') + '</a>' +
      (pt ? '<a class="link ext" data-dest="' + esc(pt.map_query) + '" href="' + esc(mapsRoute(pt.map_query)) + '" target="_blank" rel="noopener noreferrer">Directions<span class="sr-only"> to ' + esc(pt.label) + ' in Google Maps (opens in a new tab)</span></a>' : '') + '</p>';
  }
  // Keeps the chosen water in view inside the list, without scrolling the page (on a phone the list is not a scroll box).
  function revealInList(id) {
    const list = document.getElementById('map-list'), li = list?.querySelector('[data-map-water="' + id + '"]')?.parentElement;
    if (!li || list.scrollHeight <= list.clientHeight + 1) return;
    if (li.offsetTop < list.scrollTop) list.scrollTop = li.offsetTop;
    else if (li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = li.offsetTop + li.offsetHeight - list.clientHeight;
  }
  // A water hidden by the Rivers or Lakes filter is shown again when it is chosen, by showing every water.
  function showKindOf(id) {
    const w = byId.get(id);
    if (!w || mapState.kind === 'all' || mapState.kind === (w.kind === 'river' ? 'river' : 'lake')) return;
    mapState.kind = 'all';
    paintMapControls();
    liveMap?.filter('all');
  }
  function chooseOnMap(id, opts) {
    showKindOf(id);
    mapState.selected = id;
    mapCard(id);
    liveMap?.select(id, opts);
    revealInList(id);
    try { history.replaceState(history.state, '', '#/map' + (id ? '?water=' + encodeURIComponent(id) : '')); } catch {}
  }
  function paintMapControls() {
    document.querySelectorAll('[data-map-kind]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mapKind === mapState.kind)));
    document.querySelectorAll('[data-map-base]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mapBase === mapState.base)));
    document.querySelectorAll('#map-list li').forEach(li => { li.hidden = mapState.kind !== 'all' && li.dataset.kind !== mapState.kind; });
    const count = document.getElementById('map-count');
    if (count) count.textContent = document.querySelectorAll('#map-list li:not([hidden])').length;
  }
  function bindMap(route) {
    mapState.selected = route.select || null;
    showKindOf(mapState.selected);
    paintMapControls();
    mapCard(mapState.selected);
    revealInList(mapState.selected);
    document.getElementById('map-list').addEventListener('click', e => {
      const b = e.target.closest('[data-map-water]');
      if (!b) return;
      chooseOnMap(b.dataset.mapWater);
      // On a phone the list sits under the map: bring the map back into view to show the choice.
      const frame = document.querySelector('.map-frame'), r = frame.getBoundingClientRect();
      if (r.top < 70 || r.bottom > innerHeight) scrollToEl(frame, !motionOK(), 84);
    });
    document.querySelectorAll('[data-map-kind]').forEach(b => b.addEventListener('click', () => { mapState.kind = b.dataset.mapKind; paintMapControls(); liveMap?.filter(mapState.kind); }));
    document.querySelectorAll('[data-map-base]').forEach(b => b.addEventListener('click', () => { mapState.base = b.dataset.mapBase; paintMapControls(); liveMap?.setBase(mapState.base); }));
    document.getElementById('hydro').addEventListener('change', e => { mapState.hydro = e.target.checked; liveMap?.setHydro(mapState.hydro); });
    const token = renderToken;
    loadMapAssets().then(() => {
      const box = document.getElementById('water-map');
      if (token !== renderToken || !box) return;
      box.innerHTML = '';
      liveMap = window.ORFFMap.mount(box, {waters, esc, onSelect: chooseOnMap, onTrace: (id, status) => { mapState.trace[id] = status; if (mapState.selected === id) mapCard(id); }});
      liveMap.filter(mapState.kind); liveMap.setBase(mapState.base); liveMap.setHydro(mapState.hydro);
      if (mapState.selected) liveMap.select(mapState.selected, {fly: false});
      mapCard(mapState.selected);
      document.fonts?.ready.then(() => { if (token === renderToken) liveMap?.map?.invalidateSize(); });
    }).catch(() => {
      const box = document.getElementById('water-map');
      if (token === renderToken && box) box.innerHTML = '<p class="map-msg">The map could not load. The list of waters still works, and every water page has directions.</p>';
    });
  }

  // The homepage: search, this week's short list, then the live wire. Each other section is its own page.
  function homeHTML() { return heroHTML + shortlist() + wire(); }
  const PAGES = {
    waters: {html: directory, title: 'Explore waters', top: 'paper'},
    map: {html: mapPage, title: 'Water map', top: 'paper'},
    counts: {html: counts, title: 'Fish counts', top: 'ink'},
    stocking: {html: stocking, title: 'Trout stocking', top: 'paper'},
    reports: {html: anglers, title: 'Angler reports', top: 'paper'},
    method: {html: () => method() + principles(), title: 'How scores work', top: 'paper'}
  };

  /* ---------- Water page ---------- */
  // NWS forecast from data/weather.js. Hidden when missing, over 48 hours old or every period has passed.
  function weatherBlock(w) {
    const d = window.ORFF_WEATHER?.waters?.[w.id], at = Date.parse(d?.at || window.ORFF_WEATHER?.fetched_at || 0), now = Date.now();
    if (!d?.grid || !(now - at < 48 * 3600000)) return '';
    const periods = (d.periods || []).filter(p => Date.parse(p.start) + 12 * 3600000 > now && Number.isFinite(p.temp));
    if (!periods.length) return '';
    const page = 'https://forecast.weather.gov/MapClick.php?' + new URLSearchParams({lat: d.grid.lat, lon: d.grid.lon});
    const fah = p => Math.round(/C/i.test(p.tempUnit || '') ? p.temp * 9 / 5 + 32 : p.temp);
    const alerts = (d.alerts || []).filter(a => a.event && !(Date.parse(a.ends) < now));
    return '<div class="card wx" data-reveal><h2>Weather</h2>' +
      (alerts.length ? '<div class="notices">' + alerts.map(a => '<div class="notice"><div class="notice-label">' + icon('danger-triangle-linear') + esc(a.event) + '</div>' +
        (a.headline ? '<p>' + esc(a.headline) + '</p>' : '') + ext(page, 'Read the NWS alert') + '</div>').join('') + '</div>' : '') +
      '<ul class="wx-list">' + periods.map(p => '<li><div class="l-top"><strong>' + esc(p.name) + '</strong><span class="num">' + fah(p) + '°F</span></div><p>' +
        [p.short, p.wind && 'Wind ' + p.wind, p.precip > 0 && p.precip + '% chance of precipitation'].filter(Boolean).map(esc).join(' · ') + '</p></li>').join('') + '</ul>' +
      '<p class="small">National Weather Service forecast for this spot, read ' + time(new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Los_Angeles'}).format(at), true) + '. ' + ext(page, 'Full forecast') + '</p></div>';
  }

  function waterHTML(w) {
    const p = w.planning, s = score(w), f = freshness(w), g = gauge(w), points = accessPoints(w);
    const idx = waters.indexOf(w), prev = waters[(idx - 1 + waters.length) % waters.length], next = waters[(idx + 1) % waters.length];
    const scoreBlock = s.status === 'scored'
      ? ring(s.value, 150) + '<p><span class="d-for">For ' + esc(speciesWord(w)) + '</span>' + esc(s.label) + ' · <button type="button" class="d-conf" data-jump="b-h">' + esc(s.confidence) + ' confidence</button></p>'
      : '<div class="held"><strong>' + (s.status === 'withheld' ? 'Score held' : s.status === 'unavailable' ? 'Score unavailable' : 'Not scored') + '</strong>' + esc(s.reason) + '</div>';
    const rules = rulesFor(w.id), auto = autoReport(w), wdfw = window.ORFF_AUTO?.sources?.wdfw, regs = window.ORFF_AUTO?.sources?.odfw_regs;
    // What someone at the truck needs first: the fish, where to get on the water, and the rule that could end the trip.
    const rule = keyRule(w), more = p.alerts.length + rules.length - (rule.none ? 0 : 1), pt = points[0];
    const quick = '<dl class="quick">' +
      '<div class="q-species"><dt>' + icon('waterdrop-linear') + 'Target species</dt><dd><strong>' + esc(p.target_species.join(', ')) + '</strong></dd></div>' +
      '<div class="q-access"><dt>' + icon('map-point-linear') + 'Access point</dt><dd>' + (pt
        ? '<strong>' + esc(pt.label) + '</strong>' + (pt.note || p.access_summary ? '<small>' + esc(pt.note || p.access_summary) + '</small>' : '') +
          '<span class="q-acts"><a class="link ext" data-dest="' + esc(pt.map_query) + '" href="' + esc(mapsRoute(pt.map_query)) + '" target="_blank" rel="noopener noreferrer">Directions<span class="sr-only"> to ' + esc(pt.label) + ' in Google Maps (opens in a new tab)</span></a>' +
          (points.length > 1 ? '<button type="button" class="q-more" data-jump="a-h">' + (points.length - 1) + ' more access ' + (points.length === 2 ? 'point' : 'points') + '</button>' : '') + '</span>'
        : '<strong>No verified public access</strong><small>No directions are offered for this reach.</small>') + '</dd></div>' +
      '<div class="q-rule ' + rule.tone + '"><dt>' + icon(rule.tone === 'warn' ? 'danger-triangle-linear' : rule.tone === 'none' ? 'check-circle-linear' : 'info-circle-linear') + 'Key rule</dt><dd><p>' + esc(rule.text) + '</p>' +
        '<small>' + esc(rule.when) + '</small><span class="q-acts">' + ext(rule.url, rule.none ? 'ODFW rule updates' : 'Source') +
        (more > 0 ? '<button type="button" class="q-more" data-jump="n-h">' + more + ' more ' + (more === 1 ? 'notice' : 'notices') + '</button>' : '') + '</span></dd></div></dl>';

    const report = '<section aria-labelledby="r-h"><p class="eyebrow">Latest report</p><h2 id="r-h" class="sr-only">Latest report</h2>' + (auto
      ? '<p class="quote" data-reveal>' + esc(auto.summary) + '</p>' +
        '<div class="quote-meta"><span class="chip ' + f.cls + '">' + esc(f.text) + '</span><span>Creel checks ' + esc(auto.period) + (wdfw?.read_on ? ', read ' + time(wdfw.read_on, true) : '') + '</span>' + ext(auto.url, 'WDFW creel report') + '</div>' +
        '<div class="callout" data-reveal><strong>Where this report applies</strong>' + esc(auto.coverage) + ' Read automatically from WDFW’s weekly creel report.</div>'
      : '<p class="quote" data-reveal>' + esc(p.report.summary) + '</p>' +
        '<div class="quote-meta"><span class="chip ' + f.cls + '">' + esc(f.text) + '</span><span>Source checked ' + time(p.report.checked_on, true) + '</span>' + (p.report.url ? ext(p.report.url, 'Original report') : '') + '</div>' +
        '<div class="callout" data-reveal><strong>Where this report applies</strong>' + esc(p.report.coverage) + '</div>') + anglerBlock(w) + '</section>';

    // ODFW rule updates show as recorded notices. They do not withhold the score; an active closure or restriction adds a score note.
    const ruleDates = r => r.effective_from > today() ? 'Starts ' + time(r.effective_from, true) + (r.effective_to ? ', through ' + time(r.effective_to, true) : '') : r.effective_to ? 'In effect through ' + time(r.effective_to, true) : 'In effect since ' + time(r.effective_from, true);
    const notices = p.alerts.length || rules.length ? '<section aria-labelledby="n-h"><h2 id="n-h" class="d-h" tabindex="-1">Before you go</h2><div class="notices">' + rules.map(r =>
      '<div class="notice" data-reveal><div class="notice-label">' + icon('danger-triangle-linear') + 'ODFW regulation update</div><p>' + esc(r.summary) + '</p>' +
      '<small>' + ruleDates(r) + (regs?.read_on ? '. Read ' + time(regs.read_on, true) : '') + '</small>' + ext(r.url, 'Read source') + '</div>').join('') + p.alerts.map(a =>
      '<div class="notice' + (a.status === 'unverified' ? ' unverified' : '') + '" data-reveal><div class="notice-label">' + icon(a.status === 'unverified' ? 'info-circle-linear' : 'danger-triangle-linear') + (a.status === 'unverified' ? 'Needs a trip-day check' : 'Recorded notice') + '</div><p>' + esc(a.summary) + '</p>' +
      '<small>' + (a.checked_on ? 'Source checked ' + time(a.checked_on, true) : 'Current status unverified') + '</small>' + ext(a.url, 'Read source') + '</div>').join('') + '</div></section>' : '';

    let river;
    if (g.mon?.station) {
      const cards = [];
      if (g.flow) {
        const pos = g.flow.median7 > 0 ? Math.max(2, Math.min(98, 50 * g.flow.latest / g.flow.median7)) : null;
        const ratio = g.flow.median7 > 0 ? g.flow.latest / g.flow.median7 : null;
        const word = ratio == null ? '' : ratio > 1.3 ? 'Running above' : ratio < 0.75 ? 'Running below' : 'Close to';
        cards.push('<div class="gauge-card" data-reveal><small>Flow</small><b class="num">' + num(g.flow.latest) + ' <span style="font-size:.45em">cfs</span></b>' +
          (pos != null ? '<div class="flow-scale" role="img" aria-label="' + word + ' the 7-day median of ' + num(g.flow.median7) + ' cfs"><i style="left:50%"></i><b style="left:' + pos.toFixed(1) + '%"></b></div><p>' + word + ' the 7-day median (' + num(g.flow.median7) + ' cfs)</p>' : '<p>No 7-day median available</p>') + '</div>');
      }
      if (g.flow?.median30 > 0 && g.flow.latest < 0.5 * g.flow.median30) cards.push('<div class="gauge-card" data-reveal><small>Against last month</small><b class="num">' + Math.round(100 * g.flow.latest / g.flow.median30) + '%</b><p>Of its 30-day median (' + num(g.flow.median30) + ' cfs). Expect low, thin water.</p></div>');
      else if (g.flow?.median30 > 0 && g.flow.latest > 2.5 * g.flow.median30) cards.push('<div class="gauge-card" data-reveal><small>Against last month</small><b class="num">' + Math.round(100 * g.flow.latest / g.flow.median30) + '%</b><p>Of its 30-day median (' + num(g.flow.median30) + ' cfs). Expect high, fast water.</p></div>');
      if (g.stage) cards.push('<div class="gauge-card" data-reveal><small>River stage</small><b class="num">' + g.stage.latest.toFixed(2) + ' <span style="font-size:.45em">ft</span></b><p>' + (g.stage.median7 != null ? (g.stage.latest > g.stage.median7 + 0.3 ? 'Higher than' : g.stage.latest < g.stage.median7 - 0.3 ? 'Lower than' : 'Close to') + ' its 7-day median (' + g.stage.median7.toFixed(2) + ' ft). Height, not flow.' : 'Height, not flow.') + '</p></div>');
      if (g.fah != null) cards.push('<div class="gauge-card" data-reveal><small>Water temperature</small><b class="num">' + g.fah.toFixed(1) + '°F</b><p>At the gauge</p></div>');
      if (g.pool) cards.push(poolCard(g.pool));
      const stamp = g.flow?.time || g.stage?.time || null, lake = w.kind !== 'river';
      river = '<section aria-labelledby="c-h"><h2 id="c-h" class="d-h">' + (lake ? 'The lake this morning' : 'The river this morning') + '</h2>' +
        (cards.length ? '<div class="gauge">' + cards.join('') + '</div>' : '<p class="small">' + (window.ORFF_CONDITIONS ? 'The gauge returned no reading in the last 36 hours, so nothing is shown as current. The official station record below has its latest data.' : 'Today’s gauge readings did not load. The official station record below has the latest reading.') + '</p>') +
        forecastLine(g) +
        '<p class="small" style="margin-top:16px">' + esc(g.mon.name) + '. ' + esc(g.mon.coverage) + (stamp ? ' Reading from ' + new Date(stamp).toLocaleString('en-US', {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short'}) + ', provisional ' + (/^NWPS-/.test(g.mon.station) ? 'data via NOAA' : 'USGS data') + '.' : '') + '</p>' +
        '<p>' + ext(g.mon.url || 'https://waterdata.usgs.gov/monitoring-location/' + g.mon.station + '/', 'Official station record') + '</p></section>';
    } else if (g.mon) {
      river = '<section aria-labelledby="c-h"><h2 id="c-h" class="d-h">' + (w.kind !== 'river' ? 'Lake conditions' : 'River conditions') + '</h2>' + (g.pool ? '<div class="gauge">' + poolCard(g.pool) + '</div>' : '') + '<p>' + esc(g.mon.name) + '</p><p class="small">' + esc(g.mon.coverage) + '</p>' + (g.mon.url ? '<p>' + ext(g.mon.url, g.mon.mode === 'operator' ? 'Operator readings' : 'Station record') + '</p>' : '') + '</section>';
    } else river = '';

    const links = window.ORFF_COUNT_STATIONS?.waters?.[w.id] || [];
    const countData = window.ORFF_COUNTS?.stations || {};
    const fish = links.length ? '<section aria-labelledby="f-h"><h2 id="f-h" class="d-h">Are fish in the system?</h2><ul class="list">' + links.map(l => {
      const m = window.ORFF_COUNT_STATIONS.stations[l.station], d = countData[l.station];
      const mini = d ? '<div class="counts-mini">' + ['chinook', 'coho', 'steelhead'].filter(k => d.species[k]).map(k => '<div><small>' + esc(d.species[k].label) + ', 7 days</small><b>' + num(d.species[k].last7) + '</b></div>').join('') + '</div><p>Through ' + time(d.through, true) + '. ' + ext(d.source || m.url, 'Daily counts') + '</p>'
        : '<p>' + ext(m.url, 'Counts published by ' + m.operator) + (m.live ? ' · ' + ext(m.live.url, m.live.label) : '') + '</p>';
      return '<li data-reveal><div class="l-top"><strong>' + esc(m.name) + '</strong><span class="small">' + esc(m.river) + '</span></div><p>' + esc(l.relation) + '</p>' + (m.note ? '<p>' + esc(m.note) + '</p>' : '') + mini + '</li>';
    }).join('') + '</ul><p class="small" style="margin-top:14px">Counts show fish moving upstream past a dam or trap. They are run timing, not catch rates.</p></section>' : '';

    const t = today(), rows = stockRows(w.id).sort((a, b) => b.week_start.localeCompare(a.week_start));
    const upcoming = rows.filter(r => r.week_start > t).reverse().slice(0, 3), recent = rows.filter(r => r.week_start <= t).slice(0, 4);
    const stock = rows.length ? '<section aria-labelledby="s-h"><h2 id="s-h" class="d-h">When was it stocked?</h2><ul class="list">' + [...upcoming.map(r => [r, 'Planned']), ...recent.map(r => [r, 'Listed'])].map(([r, k]) =>
      '<li data-reveal><div class="l-top"><strong>' + esc(r.week_label) + '</strong><span class="num">' + num(r.total) + ' trout</span></div><p>' + k + ' · ' + esc(r.waterbody) + '</p></li>').join('') + '</ul><p class="small" style="margin-top:14px">ODFW’s planned stockings, not confirmed releases. ' + ext(window.ORFF_STOCKING.source, 'ODFW schedule') + '</p></section>' : '';

    const season = '<section aria-labelledby="se-h"><h2 id="se-h" class="d-h">Season and methods</h2><p class="quote" style="font-size:clamp(1.3rem,2.2vw,1.8rem)" data-reveal>' + esc(p.seasonal_summary) + '</p><p style="margin-top:18px">' + esc(p.seasonal_detail) + '</p><div class="callout"><strong>Methods</strong>' + esc(p.methods) + '</div>' +
      '<p class="small" style="margin-top:16px">Target species: ' + esc(p.target_species.join(', ')) + '.</p></section>';

    // How sure the score is, in the formula's own terms, and what ground the report it leans on covers.
    const unchecked = s.unverified ? s.unverified + (s.unverified === 1 ? ' notice on this water still needs' : ' notices on this water still need') + ' a trip-day check.' : 'Every notice on this water is confirmed.';
    const coverage = auto ? auto.coverage : p.report?.coverage;
    const confidence = s.status === 'scored' ? '<div class="confidence" data-reveal><p class="conf-h"><strong>' + esc(s.confidence) + ' confidence</strong><span class="num">' + s.value + '/100 for ' + esc(speciesWord(w)) + '</span></p>' +
      '<p>Built from ' + s.used + (s.used === 1 ? ' input' : ' inputs') + (s.used <= s.inputs ? ' of the ' + s.inputs + ' a ' + (s.kind === 'river' ? 'river' : 'lake') + ' score can use' : '') + '. ' + unchecked +
      ' High confidence takes three or more inputs and no unchecked notices; Medium takes two and at most one. Angler posts never change it.</p>' +
      (coverage ? '<p class="conf-cover"><b>What the report covers:</b> ' + esc(coverage) + '</p>' : '') + '</div>' : '';
    const breakdown = s.status === 'scored' ? '<section aria-labelledby="b-h"><h2 id="b-h" class="d-h" tabindex="-1">How the score adds up</h2>' + confidence + '<ul class="factors">' + s.factors.map(x =>
      '<li data-reveal><strong>' + esc(x.label) + ' · ' + Math.round(x.weight * 100) + '%</strong><span class="num">' + x.value + '</span><span class="bar"><i data-bar style="transform:scaleX(' + (x.value / 100) + ')"></i></span><p><b>' + esc(x.display) + '.</b> ' + esc(x.reason) + '</p></li>').join('') + '</ul>' +
      (s.missing.length ? '<p class="small" style="margin-top:14px">Not available: ' + esc(s.missing.join(', ')) + '. Missing inputs are skipped, not guessed.</p>' : '') +
      s.notes.map(n => '<div class="callout"><strong>Note</strong>' + esc(n) + '</div>').join('') +
      '</section>' : '';

    const access = '<div class="card ink" data-reveal><h2 id="a-h" tabindex="-1">Getting there</h2>' + (points.length
      ? '<ul class="access">' + points.map(pt => '<li><small>' + esc(pt.type || 'Access') + '</small><strong>' + esc(pt.label) + '</strong>' + (pt.note ? '<p>' + esc(pt.note) + '</p>' : '') +
        '<a class="link ext" data-dest="' + esc(pt.map_query) + '" href="' + esc(mapsRoute(pt.map_query)) + '" target="_blank" rel="noopener noreferrer">Directions<span class="sr-only"> to ' + esc(pt.label) + ' in Google Maps (opens in a new tab)</span></a></li>').join('') + '</ul>' +
        (p.access_detail ? '<p class="small">' + esc(p.access_detail) + '</p>' : '') +
        '<form class="origin" id="origin-form"><label for="origin">Driving from</label><div><input id="origin" maxlength="180" required autocomplete="off" value="' + esc(origin) + '"><button type="submit">Update</button></div><span role="status" id="origin-status"></span></form>'
      : '<p>No verified public access is documented for this reach, so no directions are offered.</p>' + (p.access_detail ? '<p class="small">' + esc(p.access_detail) + '</p>' : '')) +
      '<p class="d-map"><a class="link" href="#/map?water=' + esc(w.id) + '">' + icon('map-linear') + 'See it on the map</a></p></div>';
    const seen = new Set();
    const sources = '<div class="card" data-reveal><h2>Sources</h2><ul class="sources">' + [...(p.sources || []), ...(w.sources || [])].filter(x => { const k = x.label + x.url; if (seen.has(k)) return false; seen.add(k); return true; }).map(x => '<li>' + ext(x.url, x.label) + '</li>').join('') + '</ul>' +
      '<p class="small" style="margin-top:16px">Record checked ' + time(p.checked_on, true) + '. Check the exact reach and current rules before your trip.</p></div>';

    return '<article><header class="d-hero"><div class="inner">' +
      '<a class="crumb" href="#/waters">' + icon('arrow-left-linear') + 'All waters</a>' +
      '<div class="d-top"><div class="d-name"><p class="eyebrow on-ink">' + esc(w.region) + ' · ' + kindLabel(w) + '</p><h1 class="d-title" data-split tabindex="-1" id="d-title">' + esc(w.name) + '</h1><p class="d-reach">' + esc(w.reach) + '</p></div>' +
      '<div class="d-score">' + scoreBlock + '</div></div>' +
      quick + '<div class="d-follow" data-follow="' + esc(w.id) + '"></div></div></header>' +
      '<div class="d-body"><div class="inner"><div class="d-main">' + report + notices + river + fish + stock + season + breakdown + '</div>' +
      '<aside class="aside" aria-label="Access, weather and sources">' + access + weatherBlock(w) + sources + '</aside></div></div>' +
      '<nav class="next" aria-label="More waters"><a href="#/water/' + esc(prev.id) + '"><small>Previous water</small><strong>' + esc(prev.name) + '</strong></a><a href="#/water/' + esc(next.id) + '"><small>Next water</small><strong>' + esc(next.name) + '</strong></a></nav></article>';
  }

  /* ---------- Split text (decorative words hidden; unsplit text kept for assistive tech) ---------- */
  function split(el) {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    visual.innerHTML = el.innerHTML;
    const walker = document.createTreeWalker(visual, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span'), i = document.createElement('span');
        w.className = 'w'; i.className = 'wi'; i.textContent = part;
        w.appendChild(i); frag.appendChild(w);
      });
      node.replaceWith(frag);
    }
    const sr = document.createElement('span');
    sr.className = 'sr-only'; sr.innerHTML = el.innerHTML;
    el.replaceChildren(sr, visual);
  }

  /* ---------- Motion ---------- */
  let lenis = null, ctx = null, stopRiver = null, wireObserver = null;
  function startLenis() {
    if (lenis || !motionOK() || !window.Lenis) return;
    lenis = new window.Lenis({lerp: 0.1, smoothWheel: true});
    lenis.on('scroll', ST.update);
    gsap.ticker.add(lenisRaf);
    gsap.ticker.lagSmoothing(0);
  }
  function lenisRaf(t) { lenis?.raf(t * 1000); }
  function stopLenis() {
    if (!lenis) return;
    gsap.ticker.remove(lenisRaf);
    lenis.destroy(); lenis = null;
  }
  function teardown() {
    ctx?.revert(); ctx = null;
    stopRiver?.(); stopRiver = null;
    wireObserver?.disconnect(); wireObserver = null;
    liveMap?.destroy(); liveMap = null;
  }

  function animateIn(root, isHome) {
    // The wire marquee runs only while on screen.
    const wireEl = root.querySelector('#wire');
    if (wireEl && 'IntersectionObserver' in window) {
      wireObserver = new IntersectionObserver(([e]) => wireEl.classList.toggle('paused', !e.isIntersecting));
      wireObserver.observe(wireEl);
    }
    if (isHome) mountShader(root);
    if (!motionOK()) return;
    root.querySelectorAll('[data-split]').forEach(split);
    const footWord = document.querySelector('.footer [data-split]');
    const footFresh = footWord && !footWord.dataset.splitDone;
    if (footWord) split(footWord);
    ctx = gsap.context(() => {
      const hero = root.querySelector('.hero, .d-hero');
      if (hero) {
        // Navigation, message and CTA stay readable: the CTA and lede only move, they never start hidden.
        const tl = gsap.timeline({defaults: {ease: 'expo.out'}});
        tl.from(hero.querySelectorAll('.hero-title .wi, .d-title .wi'), {yPercent: 140, duration: 1.1, stagger: 0.06}, 0.05)
          .from(hero.querySelectorAll('.eyebrow, .d-reach, .crumb'), {y: 14, duration: .8}, 0.1)
          .from(hero.querySelectorAll('.hero-search, .hero-jump, .hero-eddy, .quick, .d-score'), {y: 26, duration: 1, stagger: .08}, 0.25);
        const plate = hero.querySelector('.plate-frame');
        if (plate) tl.from(plate, {yPercent: 6, duration: 1.4, ease: 'expo.out'}, 0.15);
        const ring = hero.querySelector('.ring .val');
        if (ring) gsap.from(ring, {strokeDashoffset: ring.dataset.ring, duration: 1.6, ease: 'expo.out', delay: .3});
      }
      // Section headings word by word, then their supporting copy.
      [...root.querySelectorAll('.section [data-split]'), ...(footFresh ? [footWord] : [])].forEach(h => {
        gsap.from(h.querySelectorAll('.wi'), {yPercent: 140, duration: 1, stagger: .05, ease: 'expo.out', scrollTrigger: {trigger: h, start: 'top 85%', once: true}});
      });
      // The short list arrives as one group as soon as any of it is on screen, so no row waits hidden at the fold.
      const picks = root.querySelector('.picks');
      if (picks) gsap.from(picks.children, {y: 22, opacity: 0, duration: .9, stagger: .06, ease: 'expo.out', scrollTrigger: {trigger: picks, start: 'top bottom', once: true}});
      root.querySelectorAll('[data-reveal]').forEach(el => {
        gsap.from(el, {y: 36, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: {trigger: el, start: 'top 90%', once: true}});
      });
      root.querySelectorAll('.station, .factors li').forEach(card => {
        const n = card.querySelector('[data-count]');
        const bars = card.querySelectorAll('[data-bar]'), rings = card.querySelectorAll('.ring .val');
        const trig = {trigger: card, start: 'top 85%', once: true};
        if (n) { const end = +n.dataset.count, o = {v: 0}; gsap.to(o, {v: end, duration: 1.6, ease: 'expo.out', scrollTrigger: trig, onUpdate: () => { n.textContent = num(o.v); }}); }
        bars.forEach(b => gsap.from(b, {scaleX: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: trig}));
        rings.forEach(r => gsap.from(r, {strokeDashoffset: r.dataset.ring, duration: 1.6, ease: 'expo.out', scrollTrigger: trig}));
      });
      // On the method page the score weights assemble once, in order, as the page opens.
      const weights = root.querySelector('.method-pin');
      if (weights) {
        const tl = gsap.timeline({delay: .4, defaults: {ease: 'expo.out'}});
        const factors = weights.querySelectorAll('[data-factor]');
        weights.querySelectorAll('[data-stack]').forEach((bar, i) => {
          tl.from(bar, {scaleX: 0, duration: .9}, i * .28);
          if (factors[i]) tl.from(factors[i], {opacity: .25, duration: .6}, i * .28);
        });
      }
      const stockTotal = root.querySelector('.stock-total');
      if (stockTotal) { const end = +stockTotal.dataset.count, o = {v: 0}; gsap.to(o, {v: end, duration: 1.8, ease: 'expo.out', scrollTrigger: {trigger: stockTotal, start: 'top 85%', once: true}, onUpdate: () => { stockTotal.textContent = num(o.v); }}); }
    }, root);

  }

  function mountShader(root) {
    const plate = root.querySelector('#plate');
    if (!plate || reduced.matches || location.protocol === 'file:') return;
    try {
      const c = document.createElement('canvas');
      if (!(c.getContext('webgl2') || c.getContext('webgl'))) return;
    } catch { return; }
    let cancelled = false;
    stopRiver = () => { cancelled = true; };
    import(riverURL).then(m => { if (!cancelled) stopRiver = m.mountRiver(plate); }).catch(() => {});
  }

  /* ---------- Router ---------- */
  // #/ is the homepage. #/waters, #/map, #/counts, #/stocking, #/reports and #/method are pages; #/water/<id> is a water.
  // #/anglers is the old address of #/reports, and #/shortlist still scrolls to the short list on the homepage.
  // The retired classic site (classic/) forwards its old addresses here.
  const ROUTES = {waters: 'waters', map: 'map', counts: 'counts', stocking: 'stocking', reports: 'reports', anglers: 'reports', method: 'method'};
  let current = null, firstRender = true, renderToken = 0;
  const curtain = document.createElement('div');
  curtain.className = 'curtain'; curtain.setAttribute('aria-hidden', 'true');
  document.body.appendChild(curtain);

  function parse() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, query = ''] = h.split('?');
    const parts = path.split('/');
    if (parts[0] === 'water' && byId.has(parts[1])) return {view: 'water:' + parts[1], water: byId.get(parts[1])};
    // #/waters?q=<words> opens the directory already searched (the homepage search sends visitors here);
    // plain #/waters lists every water. The address holds the search words, so Back returns to the same list.
    // #/stocking?q=<words>&weeks=past|all opens the schedule searched, and #/map?water=<id> opens the map on a water.
    const view = ROUTES[parts[0]], params = new URLSearchParams(query);
    if (view === 'waters') return {view, q: params.get('q') || ''};
    if (view === 'stocking') {
      const weeks = params.get('weeks');
      return {view, q: params.get('q') || '', weeks: weeks === 'all' ? 'all' : weeks === 'past' || weeks === 'recent' ? 'past' : 'coming'};
    }
    if (view === 'map') return {view, select: byId.has(params.get('water')) ? params.get('water') : null};
    if (view) return {view};
    return {view: 'home', section: parts[0] === 'shortlist' ? 'shortlist' : null};
  }
  function scrollToEl(el, immediate, gap = 0) {
    const y = el ? Math.max(0, el.getBoundingClientRect().top + scrollY - gap) : 0;
    if (lenis) { lenis.resize(); lenis.scrollTo(y, {immediate, force: true, duration: 1.4}); }
    else window.scrollTo({top: y, behavior: 'auto'});
  }
  // Buttons that jump within a page (the water page's "2 more notices", "Medium confidence"). Hash links would
  // change the route, so these scroll instead, clear of the navigation bar, and move focus to the heading.
  view.addEventListener('click', e => {
    const b = e.target.closest('[data-jump]');
    const el = b && document.getElementById(b.dataset.jump);
    if (!el) return;
    e.preventDefault();
    scrollToEl(el, !motionOK(), 96);
    el.focus({preventScroll: true});
  });
  function setNav(route) {
    document.querySelectorAll('#nav-links a').forEach(a => {
      if (a.getAttribute('href') === '#/' + route.view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  function searchDirectory(q) {
    dir.q = q;
    const box = document.getElementById('q');
    if (box) box.value = q;
  }
  // Keeps the address in step with the directory's search box without adding a history entry per keystroke.
  function noteSearch() {
    try { history.replaceState(history.state, '', '#/waters' + (dir.q.trim() ? '?q=' + encodeURIComponent(dir.q.trim()) : '')); } catch {}
  }
  function render(route) {
    teardown();
    renderToken++;
    view.classList.remove('booting');
    const page = PAGES[route.view];
    if (route.view === 'home') {
      view.innerHTML = homeHTML();
      document.title = 'Oregon Fish Forecast · Read the river';
      bindHeroSearch();
    } else if (page) {
      if (route.view === 'waters') dir.q = route.q;
      if (route.view === 'stocking') Object.assign(sched, {q: route.q, weeks: route.weeks});
      view.innerHTML = page.html();
      document.title = page.title + ' · Oregon Fish Forecast';
      if (route.view === 'waters') { renderRows(false); bindDirectory(); }
      if (route.view === 'stocking') { renderSchedule(); bindSchedule(); }
      if (route.view === 'map') bindMap(route);
    } else {
      view.innerHTML = waterHTML(route.water);
      document.title = route.water.name + ', ' + route.water.reach + ' · Oregon Fish Forecast';
      bindOrigin();
    }
    current = route.view;
    // The navigation sits on paper or on forest ink, whichever the page opens with.
    nav.classList.toggle('on-paper', route.view === 'home' || page?.top === 'paper');
    animateIn(view, route.view === 'home');
    // Lets the Eddy panel (ask.js) fill the homepage's "Ask Eddy" card and a water page's "Follow this water" slot.
    document.dispatchEvent(new CustomEvent('orff:render', {detail: {water: route.water?.id || null}}));
  }
  // A section a route opens on instead of the top: the homepage short list, or the stocking schedule when searched.
  function landing(route) {
    if (route.view === 'home' && route.section) return document.getElementById(route.section);
    if (route.view === 'stocking' && (route.q || route.weeks !== 'coming')) return document.getElementById('schedule');
    return null;
  }
  function afterRender(route, immediate) {
    setNav(route);
    ST?.refresh();
    const el = landing(route);
    if (el) {
      scrollToEl(el, immediate);
      el.querySelector('h2')?.focus({preventScroll: true});
    } else {
      scrollToEl(null, true);
      if (!firstRender) (view.querySelector('h1[tabindex]') || document.getElementById('main')).focus({preventScroll: true});
    }
    if (ST) document.fonts?.ready.then(() => {
      ST.refresh();
      // Fonts can shift section positions after a deep link; settle on the section again.
      if (immediate && landing(route)) scrollToEl(landing(route), true);
    });
    firstRender = false;
  }
  function go() {
    closeMenu();
    const route = parse();
    if (route.view === current && !firstRender) {
      if (route.view === 'waters' && route.q !== dir.q) { searchDirectory(route.q); renderRows(true); }
      if (route.view === 'stocking' && (route.q !== sched.q || route.weeks !== sched.weeks)) {
        Object.assign(sched, {q: route.q, weeks: route.weeks});
        const box = document.getElementById('sq');
        if (box) box.value = sched.q;
        renderSchedule();
      }
      // A link to another water while the map is open chooses it in place; the map stays where it is.
      if (route.view === 'map' && route.select) { if (route.select !== mapState.selected) chooseOnMap(route.select); setNav(route); return; }
      afterRender(route, false);
      return;
    }
    if (firstRender || !motionOK()) { render(route); afterRender(route, true); return; }
    gsap.timeline()
      .set(curtain, {transformOrigin: 'bottom'})
      .to(curtain, {scaleY: 1, duration: .5, ease: 'expo.in'})
      .add(() => { render(route); afterRender(route, true); })
      .set(curtain, {transformOrigin: 'top'})
      .to(curtain, {scaleY: 0, duration: .7, ease: 'expo.out'});
  }

  /* ---------- Controls ---------- */
  // Waters matching the words typed, best first: names that start with them, then names, then reach, region and species.
  function findWaters(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    const rank = w => { const n = w.name.toLowerCase(); return n.startsWith(q) ? 0 : n.includes(q) ? 1 : w.reach.toLowerCase().includes(q) ? 2 : 3; };
    return waters.filter(w => [w.name, w.reach, w.region, ...w.planning.target_species].join(' ').toLowerCase().includes(q))
      .map((w, i) => ({w, r: rank(w), i})).sort((a, b) => a.r - b.r || a.i - b.i).map(x => x.w);
  }
  function bindHeroSearch() {
    const form = document.getElementById('hero-search');
    if (!form) return;
    const input = form.querySelector('input'), list = form.querySelector('.hero-suggest'), status = form.querySelector('[role="status"]');
    const SHOW = 6;
    let found = [], active = -1;
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', 'hero-suggest');
    input.setAttribute('aria-expanded', 'false');
    const options = () => [...list.querySelectorAll('[role="option"]')];
    const close = () => { list.hidden = true; active = -1; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); };
    const mark = i => {
      const opts = options();
      active = opts.length ? (i + opts.length) % opts.length : -1;
      opts.forEach((o, n) => o.setAttribute('aria-selected', String(n === active)));
      if (active >= 0) input.setAttribute('aria-activedescendant', opts[active].id); else input.removeAttribute('aria-activedescendant');
    };
    const all = q => '#/waters' + (q ? '?q=' + encodeURIComponent(q) : '');
    const paint = () => {
      const q = input.value.trim();
      found = findWaters(q);
      if (!q) { close(); status.textContent = ''; return; }
      list.innerHTML = found.length
        ? found.slice(0, SHOW).map((w, i) => {
            const s = score(w);
            return '<li role="option" id="hero-opt-' + i + '" aria-selected="false" data-go="#/water/' + esc(w.id) + '"><span class="hs-name">' + esc(w.name) + '<small>' + esc(w.reach) + '</small></span>' +
              '<span class="hs-meta">' + esc(w.region) + '</span>' + (s.status === 'scored' ? '<span class="hs-score num"><span class="sr-only">Score </span>' + s.value + '</span>' : '<span class="hs-score off">Not scored</span>') + '</li>';
          }).join('') + (found.length > SHOW ? '<li role="option" class="hs-more" id="hero-opt-all" aria-selected="false" data-go="' + esc(all(q)) + '">See all ' + found.length + ' matching waters</li>' : '')
        : '<li class="hs-none" role="presentation">No water matches that. Try a river, lake, region or species.</li>';
      list.hidden = false; active = -1;
      input.setAttribute('aria-expanded', 'true'); input.removeAttribute('aria-activedescendant');
      status.textContent = found.length ? found.length + (found.length === 1 ? ' water matches.' : ' waters match.') + ' Use the arrow keys to choose one.' : 'No water matches that.';
    };
    input.addEventListener('input', paint);
    input.addEventListener('focus', () => { if (input.value.trim() && list.hidden) paint(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (list.hidden) { paint(); if (list.hidden) return; }
        mark(active < 0 ? (e.key === 'ArrowDown' ? 0 : -1) : active + (e.key === 'ArrowDown' ? 1 : -1));
      } else if (e.key === 'Escape' && !list.hidden) { e.preventDefault(); close(); }
    });
    // Choosing with the pointer must not take focus from the box before the click lands.
    list.addEventListener('mousedown', e => e.preventDefault());
    list.addEventListener('click', e => { const o = e.target.closest('[data-go]'); if (o) location.hash = o.dataset.go; });
    form.addEventListener('focusout', e => { if (!form.contains(e.relatedTarget)) close(); });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const q = input.value.trim(), chosen = options()[active];
      // Enter opens the highlighted water, the only match, or the directory searched for these words.
      location.hash = chosen ? chosen.dataset.go : found.length === 1 && q ? '#/water/' + found[0].id : all(q);
    });
  }
  function bindDirectory() {
    const q = document.getElementById('q');
    q?.addEventListener('input', () => { dir.q = q.value; noteSearch(); renderRows(true); });
    document.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click', () => {
      dir.kind = b.dataset.kind;
      document.querySelectorAll('[data-kind]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      renderRows(true);
    }));
    document.getElementById('region')?.addEventListener('change', e => { dir.region = e.target.value; renderRows(true); });
    document.getElementById('sort')?.addEventListener('change', e => { dir.sort = e.target.value; renderRows(true); });
    document.getElementById('rows')?.addEventListener('click', e => {
      if (!e.target.closest('#reset')) return;
      Object.assign(dir, {q: '', kind: 'all', region: 'all'});
      q.value = ''; noteSearch(); document.getElementById('region').value = 'all';
      document.querySelectorAll('[data-kind]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.kind === 'all')));
      renderRows(true); q.focus();
    });
  }
  function bindOrigin() {
    const form = document.getElementById('origin-form');
    form?.addEventListener('submit', e => {
      e.preventDefault();
      const value = document.getElementById('origin').value.trim();
      const status = document.getElementById('origin-status');
      if (!value) { status.textContent = 'Enter a town or address.'; return; }
      origin = value; store.set('origin', value);
      document.querySelectorAll('[data-dest]').forEach(a => { a.href = mapsRoute(a.dataset.dest); });
      status.textContent = 'Directions now start from ' + value + '. Saved in this browser only.';
    });
  }

  /* ---------- Navigation chrome ---------- */
  const nav = document.getElementById('nav'), toggle = document.getElementById('nav-toggle'), links = document.getElementById('nav-links');
  function closeMenu() {
    if (toggle.getAttribute('aria-expanded') !== 'true') return;
    toggle.setAttribute('aria-expanded', 'false'); links.classList.remove('open'); nav.classList.remove('menu-open');
    lenis?.start();
  }
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open)); links.classList.toggle('open', open); nav.classList.toggle('menu-open', open);
    if (open) { lenis?.stop(); links.querySelector('a')?.focus(); } else lenis?.start();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && links.classList.contains('open')) { closeMenu(); toggle.focus(); } });
  links.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });

  let lastY = 0, ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY;
      nav.classList.toggle('solid', y > 40);
      nav.classList.toggle('hide', y > 500 && y > lastY + 2 && !links.classList.contains('open') && !nav.contains(document.activeElement));
      if (y < lastY - 2) nav.classList.remove('hide');
      lastY = y; ticking = false;
    });
  }, {passive: true});
  nav.addEventListener('focusin', () => nav.classList.remove('hide'));

  // Reduced-motion can change while the page is open: rebuild with or without motion.
  reduced.addEventListener?.('change', () => {
    if (reduced.matches) stopLenis(); else startLenis();
    current = null; firstRender = true; go();
  });
  addEventListener('pagehide', () => { teardown(); stopLenis(); });
  addEventListener('hashchange', go);

  startLenis();
  go();
})();
