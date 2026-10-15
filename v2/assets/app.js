/* Oregon Fish Forecast, version two.
   Reads the same data files as the classic site. Every number on the page comes from those files;
   missing values stay missing. Motion: GSAP + ScrollTrigger, with Lenis as the only smooth-scroll
   engine. Under prefers-reduced-motion there is no smooth scrolling, no scrubbing and no shader. */
(() => {
  'use strict';
  const packet = window.ORFF_DATA;
  const view = document.getElementById('view');
  if (!packet || !Array.isArray(packet.waters)) {
    view.insertAdjacentHTML('beforeend', '<section class="noscript"><p>Water records could not load. Keep the v2 folder beside the data folder, or open the <a href="classic/">classic site</a>.</p></section>');
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

  // Reports: freshness from today, so the page ages honestly.
  function freshness(w) {
    const r = w.planning.report;
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
    const flow = ok(data?.flow) ? data.flow : null, temp = ok(data?.temp) ? data.temp : null;
    const cel = temp ? (/F/.test(temp.unit || '') ? (temp.latest - 32) * 5 / 9 : temp.latest) : null;
    const fah = cel != null ? cel * 9 / 5 + 32 : null;
    return {mon, flow, cel, fah, fetched};
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
  const score = w => window.ORFFPreview ? window.ORFFPreview.score(w) : {status: 'unavailable', reason: 'The score formula did not load.'};
  function stockRows(id) {
    const names = window.ORFF_STOCKING_MATCH?.[id];
    if (!names) return [];
    const res = names.map(n => new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'));
    return (window.ORFF_STOCKING?.rows || []).filter(r => res.some(re => re.test(r.waterbody)));
  }
  function guideFor(waterbody) {
    for (const [id, names] of Object.entries(window.ORFF_STOCKING_MATCH || {})) {
      if (names.some(n => new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(waterbody))) return byId.get(id);
    }
    return null;
  }
  function mondayOf(iso) {
    const d = new Date(iso + 'T12:00:00Z'), day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
  }
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
      for (const k of ['coho', 'chinook', 'steelhead']) {
        const v = s.species[k];
        if (v) items.push('<b>' + num(v.last7) + '</b> ' + esc(v.label.toLowerCase()) + ' <span>past ' + esc(meta[code]?.name || code) + ' in 7 days</span>');
      }
    }
    for (const w of waters) {
      const g = gauge(w);
      if (g.flow && items.length < 16) items.push('<b>' + num(g.flow.latest) + ' cfs</b> ' + esc(w.name) + (g.fah != null ? ' <span>' + Math.round(g.fah) + '°F</span>' : ''));
    }
    const t = today(), mon = mondayOf(t);
    const week = (window.ORFF_STOCKING?.rows || []).filter(r => r.week_start === mon);
    if (week.length) items.push('<b>' + week.length + '</b> waters <span>on ODFW’s trout stocking plan this week</span>');
    if (!items.length) return '';
    const list = items.map(i => '<li><i class="dot" aria-hidden="true"></i>' + i + '</li>').join('');
    return '<div class="wire" id="wire" role="region" aria-label="Latest readings"><div class="wire-track"><ul>' + list + '</ul><ul aria-hidden="true">' + list + '</ul></div></div>';
  }

  function shortlist() {
    const scored = waters.map(w => ({w, s: score(w), f: freshness(w)})).filter(x => x.s.status === 'scored')
      .sort((a, b) => b.s.value - a.s.value || a.f.age - b.f.age).slice(0, 4);
    if (!scored.length) return '';
    return '<section class="section" id="shortlist" aria-labelledby="sl-h"><div class="inner">' +
      '<div class="section-head"><div><p class="eyebrow">This week’s short list</p><h2 id="sl-h" class="display h-section" data-split tabindex="-1">Worth the <em>drive</em> this week.</h2></div>' +
      '<p class="lede" data-reveal>The four waters scoring highest today, from dated reports, gauges, dam counts and stocking. Open one to see every input.</p></div>' +
      '<div class="shortlist">' + scored.map(({w, s, f}) =>
        '<a class="pick" href="#/water/' + esc(w.id) + '" data-reveal>' +
        '<div class="ring-row">' + ring(s.value) + '<div><small>Fishing score</small><strong>' + esc(s.label) + '</strong><small>' + esc(s.confidence) + ' confidence</small></div></div>' +
        '<div><h3>' + esc(w.name) + '</h3><p class="reach">' + esc(w.reach) + '</p></div>' +
        '<blockquote>' + esc(w.planning.report.summary.length > 140 ? w.planning.report.summary.slice(0, 137).trim() + '…' : w.planning.report.summary) + '</blockquote>' +
        '<div class="foot"><span>' + esc(w.region) + ' · ' + esc(f.text) + '</span><span class="go" aria-hidden="true">' + icon('arrow-right-linear') + '</span></div></a>').join('') +
      '</div><p class="score-note">Every score shows its inputs on the water page. Rules notices always come first.</p></div></section>';
  }

  function counts() {
    const data = window.ORFF_COUNTS?.stations || {}, meta = window.ORFF_COUNT_STATIONS?.stations || {};
    const codes = ['BON', 'TDA', 'WFF'].filter(c => data[c]);
    const head = '<div class="section-head"><div><p class="eyebrow">Fish counts · Columbia River DART</p><h2 id="ct-h" class="display h-section" data-split tabindex="-1">Are the fish <em>in the river</em> yet?</h2></div>' +
      '<p class="lede" data-reveal>Adult salmon and steelhead counted climbing the ladders, updated every morning. Counts show run timing, not how many fish are being caught.</p></div>';
    let body;
    if (!codes.length) {
      body = '<p class="count-note">Today’s counts did not load. Use the official sources: ' + Object.values(meta).filter(m => m.dart).map(m => ext(m.url, m.name)).join(', ') + '.</p>';
    } else {
      body = '<div class="stations">' + codes.map(code => {
        const s = data[code], m = meta[code] || {name: code};
        const keys = ['chinook', 'coho', 'steelhead'].filter(k => s.species[k]);
        const week = keys.reduce((t, k) => t + s.species[k].last7, 0);
        return '<article class="station" data-reveal><h3>' + esc(m.name) + '</h3><p class="meta">' + esc(m.river || '') + ' · through ' + time(s.through) + '</p>' +
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
      '<div class="section-head"><div><p class="eyebrow">' + waters.length + ' reaches · ' + regions.length + ' regions</p><h2 id="dir-h" class="display h-section" data-split tabindex="-1">Every water, <em>one reach</em> at a time.</h2></div>' +
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
      : '<span class="muted">' + (g.mon?.mode === 'operator' ? 'Operator flow data' : g.mon?.mode === 'historical' ? 'Historical gauge only' : g.mon?.station ? 'No current gauge reading' : 'No live feed') + '</span>';
    const sc = s.status === 'scored' ? '<span class="mini-score"><span class="sr-only">Score </span>' + s.value + '<i aria-hidden="true"><b style="width:' + s.value + '%"></b></i></span>'
      : '<span class="mini-score off">' + (s.status === 'withheld' ? 'Score held for rules' : 'Not enough to score') + '</span>';
    return '<li class="row"><a href="#/water/' + esc(w.id) + '">' +
      '<span class="idx" aria-hidden="true">' + pad(i + 1) + '</span>' +
      '<span class="name">' + esc(w.name) + '<small class="muted">' + esc(w.reach) + '</small></span>' +
      '<span class="cell c-species"><b class="muted">' + esc(w.region) + ' · ' + kindLabel(w) + '</b>' + esc(w.planning.target_species.slice(0, 3).join(', ')) + '</span>' +
      '<span class="cell c-report"><span class="chip ' + f.cls + '">' + esc(f.text) + '</span>' + (notices ? ' <span class="muted">· ' + notices + (notices === 1 ? ' notice' : ' notices') + '</span>' : '') + (anglerFor(w.id).length ? ' <span class="muted">· ' + anglerFor(w.id).length + (anglerFor(w.id).length === 1 ? ' angler post' : ' angler posts') + '</span>' : '') + '</span>' +
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
      '<div class="section-head"><div><p class="eyebrow">ODFW trout stocking</p><h2 id="st-h" class="display h-section" data-split tabindex="-1">Fresh trout, <em>' + esc(label) + '.</em></h2></div>' +
      '<p class="lede" data-reveal>ODFW’s planned releases, read every morning. These are plans, not confirmed releases, and the agency can change them.</p></div>' +
      (week.length ? '<div class="stock-grid"><div data-reveal><p class="stock-total num" data-count="' + total + '">' + num(total) + '</p><p class="lede" style="margin-top:14px">trout planned across ' + week.length + (week.length === 1 ? ' water' : ' waters') + ' for ' + esc(week[0].week_label) + '.</p>' +
        '<p style="margin-top:28px"><a class="btn btn-ink" href="classic/#/stocking">Full year schedule ' + icon('arrow-right-up-linear') + '</a></p></div>' +
        '<ul class="stock-list">' + week.map(r => {
          const g = guideFor(r.waterbody);
          const name = g ? '<a href="#/water/' + esc(g.id) + '"><strong>' + esc(r.waterbody) + '</strong></a>' : '<strong>' + esc(r.waterbody) + '</strong>';
          return '<li data-reveal>' + name + '<span class="num">' + num(r.total) + ' fish</span><small>' + esc(r.zone) + (g ? ' · In the guide' : '') + '</small></li>';
        }).join('') + '</ul></div>'
        : '<p class="lede">No stockings are listed for the coming weeks. ' + ext(window.ORFF_STOCKING?.source || 'https://myodfw.com/fishing/species/trout/stocking-schedule', 'Check ODFW’s schedule') + '</p>') +
      '</div></section>';
  }

  function method() {
    const f = [['tone', 30, 'Report tone', 'What the latest dated report says, word for word.'], ['run', 25, 'Run strength', 'This year’s dam counts against the same date last year.'], ['cond', 20, 'River conditions', 'Gauge flow against its 7-day median, and water temperature for cold-water fish.'], ['fresh', 15, 'Report freshness', 'A week-old report counts for more than a month-old one.'], ['stock', 10, 'Recent stocking', 'An ODFW trout release in the last few weeks.']];
    return '<section class="section" id="method" aria-labelledby="m-h"><div class="inner method-pin">' +
      '<div><p class="eyebrow">How a river score is built</p><h2 id="m-h" class="display h-section" data-split tabindex="-1">Five inputs, <em>weighed</em> in the open.</h2>' +
      '<p class="lede" data-reveal>Every input has a source and a date. A missing input is skipped and lowers confidence; it is never filled in. A rules notice holds the score entirely. Lakes use stocking 40%, report tone 35% and freshness 25%. Recent angler posts can nudge a score up, never down.</p>' +
      '</div>' +
      '<div class="stack"><div class="stack-bar" role="img" aria-label="River score weights: report tone 30%, run strength 25%, river conditions 20%, report freshness 15%, recent stocking 10%">' +
      f.map(([k, w]) => '<span class="f-' + k + '" style="width:' + w + '%" data-stack></span>').join('') + '</div>' +
      '<ul class="factor-list">' + f.map(([k, w, l, d]) => '<li data-factor><span class="sw f-' + k + '" aria-hidden="true"></span><strong>' + l + '</strong><span class="num">' + w + '%</span><p>' + d + '</p></li>').join('') + '</ul></div>' +
      '</div></section>';
  }

  function principles() {
    const p = [['Missing stays missing.', 'If a gauge is down or a report is undated, the page says so. Nothing is estimated to fill the gap.'], ['A gauge is not an access point.', 'Readings describe one station. Directions only ever go to a documented public access.'], ['Every claim has a date and a source.', 'Reports, notices and counts link to the agency or operator that published them.'], ['Rules come before scores.', 'A closure or restriction holds a score, and a trip-day check is flagged when a rule could not be confirmed.']];
    return '<section class="section ink" aria-labelledby="p-h"><div class="inner"><div class="section-head"><div><p class="eyebrow">What this site won’t do</p><h2 id="p-h" class="display h-section" data-split>Honest about <em>the river.</em></h2></div></div>' +
      '<ol class="principles">' + p.map(([h, t], i) => '<li data-reveal><span class="n">' + pad(i + 1) + '</span><h3>' + h + '</h3><p>' + t + '</p></li>').join('') + '</ol></div></section>';
  }

  function anglers() {
    const a = window.ORFF_ANGLER;
    if (!a) return '';
    // Waters with posts from their own reach come first; each shows its most useful post and where it was.
    const lead = posts => posts.find(p => p.scoring) || posts.find(p => p.kind === 'catch') || posts[0];
    const inGuide = waters.map(w => ({w, posts: anglerFor(w.id)})).filter(x => x.posts.length)
      .sort((x, y) => (y.posts.some(p => p.scoring) - x.posts.some(p => p.scoring)) || y.posts[0].date.localeCompare(x.posts[0].date));
    const r = a.reviewed || {};
    return '<section class="section paper-2" id="anglers" aria-labelledby="an-h"><div class="inner">' +
      '<div class="section-head"><div><p class="eyebrow">Word on the water · ' + fmtDate(a.window_start) + ' to ' + fmtDate(a.checked_on) + '</p><h2 id="an-h" class="display h-section" data-split tabindex="-1">What anglers are <em>posting.</em></h2></div>' +
      '<p class="lede" data-reveal>We read ' + num(r.facebook_posts || 0) + ' posts from two public Oregon fishing groups on Facebook and ' + num(r.tiktok_videos || 0) + ' TikTok videos. Here is what mentioned a real catch or condition. Word of mouth, not verified.</p></div>' +
      '<div class="word-grid"><div><h3 class="word-h">In the guide</h3><ul class="word-list">' + inGuide.map(({w, posts}) =>
        '<li data-reveal><a href="#/water/' + esc(w.id) + '"><strong>' + esc(w.name) + '</strong><span class="muted"> ' + esc(w.reach) + '</span></a><p>' + esc(lead(posts).note) + (lead(posts).where ? ' <span class="muted">(' + esc(lead(posts).where) + ')</span>' : '') + '</p><span class="a-meta">' + posts.length + (posts.length === 1 ? ' post' : ' posts') + ' · latest ' + fmtDate(posts[0].date) + '</span></li>').join('') + '</ul></div>' +
      '<div><h3 class="word-h">Also busy this month</h3><p class="small">Waters anglers talked about that are not in the guide yet.</p><ol class="word-list elsewhere">' + (a.elsewhere || []).slice().sort((x, y) => y.posts - x.posts || y.latest.localeCompare(x.latest)).map(e =>
        '<li data-reveal><strong>' + esc(e.water) + '</strong><p>' + esc(e.note) + '</p><span class="a-meta">' + e.posts + (e.posts === 1 ? ' post' : ' posts') + ' · latest ' + fmtDate(e.latest) + '</span></li>').join('') + '</ol></div></div>' +
      '<p class="small" style="margin-top:28px">Sources: ' + (a.sources || []).map(x => ext(x.url, x.label)).join(', ') + '.</p></div></section>';
  }

  function homeHTML() { return heroHTML + wire() + shortlist() + anglers() + counts() + directory() + stocking() + method() + principles(); }

  /* ---------- Water page ---------- */
  function waterHTML(w) {
    const p = w.planning, s = score(w), f = freshness(w), g = gauge(w);
    const points = p.access_points?.length ? p.access_points : p.access_point ? [{label: p.access_point.label, type: 'Documented access', note: p.access_summary, map_query: p.access_point.map_query}] : [];
    const idx = waters.indexOf(w), prev = waters[(idx - 1 + waters.length) % waters.length], next = waters[(idx + 1) % waters.length];
    const scoreBlock = s.status === 'scored'
      ? ring(s.value, 150) + '<p>' + esc(s.label) + ' · ' + esc(s.confidence) + ' confidence</p>'
      : '<div class="held"><strong>' + (s.status === 'withheld' ? 'Score held' : 'Not scored') + '</strong>' + esc(s.reason) + '</div>';
    const facts = [['Target species', p.target_species.length], ['Access', points.length ? points.length + (points.length === 1 ? ' point' : ' points') : 'Unverified'], ['Monitoring', g.mon?.station ? 'USGS gauge' : g.mon?.mode === 'operator' ? 'Operator' : g.mon?.mode === 'historical' ? 'Historical' : 'None'], ['Notices', p.alerts.length]];

    const report = '<section aria-labelledby="r-h"><p class="eyebrow">Latest report</p><h2 id="r-h" class="sr-only">Latest report</h2><p class="quote" data-reveal>' + esc(p.report.summary) + '</p>' +
      '<div class="quote-meta"><span class="chip ' + f.cls + '">' + esc(f.text) + '</span><span>Source checked ' + time(p.report.checked_on, true) + '</span>' + (p.report.url ? ext(p.report.url, 'Original report') : '') + '</div>' +
      '<div class="callout" data-reveal><strong>Where this report applies</strong>' + esc(p.report.coverage) + '</div>' + anglerBlock(w) + '</section>';

    const notices = p.alerts.length ? '<section aria-labelledby="n-h"><h2 id="n-h" class="d-h">Before you go</h2><div class="notices">' + p.alerts.map(a =>
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
      if (g.fah != null) cards.push('<div class="gauge-card" data-reveal><small>Water temperature</small><b class="num">' + g.fah.toFixed(1) + '°F</b><p>At the gauge</p></div>');
      const stamp = g.flow?.time || null;
      river = '<section aria-labelledby="c-h"><h2 id="c-h" class="d-h">The river this morning</h2>' +
        (cards.length ? '<div class="gauge">' + cards.join('') + '</div>' : '<p class="small">The gauge returned no reading in the last 36 hours, so nothing is shown as current.</p>') +
        '<p class="small" style="margin-top:16px">' + esc(g.mon.name) + '. ' + esc(g.mon.coverage) + (stamp ? ' Reading from ' + new Date(stamp).toLocaleString('en-US', {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short'}) + ', provisional USGS data.' : '') + '</p>' +
        '<p>' + ext('https://waterdata.usgs.gov/monitoring-location/' + g.mon.station + '/', 'Official station record') + '</p></section>';
    } else if (g.mon) {
      river = '<section aria-labelledby="c-h"><h2 id="c-h" class="d-h">River conditions</h2><p>' + esc(g.mon.name) + '</p><p class="small">' + esc(g.mon.coverage) + '</p>' + (g.mon.url ? '<p>' + ext(g.mon.url, g.mon.mode === 'operator' ? 'Operator readings' : 'Station record') + '</p>' : '') + '</section>';
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

    const breakdown = s.status === 'scored' ? '<section aria-labelledby="b-h"><h2 id="b-h" class="d-h">How the score adds up</h2><ul class="factors">' + s.factors.map(x =>
      '<li data-reveal><strong>' + esc(x.label) + ' · ' + Math.round(x.weight * 100) + '%</strong><span class="num">' + x.value + '</span><span class="bar"><i data-bar style="transform:scaleX(' + (x.value / 100) + ')"></i></span><p><b>' + esc(x.display) + '.</b> ' + esc(x.reason) + '</p></li>').join('') + '</ul>' +
      (s.missing.length ? '<p class="small" style="margin-top:14px">Not available: ' + esc(s.missing.join(', ')) + '. Missing inputs are skipped, not guessed.</p>' : '') +
      s.notes.map(n => '<div class="callout"><strong>Note</strong>' + esc(n) + '</div>').join('') +
      '</section>' : '';

    const access = '<div class="card ink" data-reveal><h2>Getting there</h2>' + (points.length
      ? '<ul class="access">' + points.map(pt => '<li><small>' + esc(pt.type || 'Access') + '</small><strong>' + esc(pt.label) + '</strong>' + (pt.note ? '<p>' + esc(pt.note) + '</p>' : '') +
        '<a class="link ext" data-dest="' + esc(pt.map_query) + '" href="' + esc(mapsRoute(pt.map_query)) + '" target="_blank" rel="noopener noreferrer">Directions<span class="sr-only"> to ' + esc(pt.label) + ' in Google Maps (opens in a new tab)</span></a></li>').join('') + '</ul>' +
        (p.access_detail ? '<p class="small">' + esc(p.access_detail) + '</p>' : '') +
        '<form class="origin" id="origin-form"><label for="origin">Driving from</label><div><input id="origin" maxlength="180" required autocomplete="off" value="' + esc(origin) + '"><button type="submit">Update</button></div><span role="status" id="origin-status"></span></form>'
      : '<p>No verified public access is documented for this reach, so no directions are offered.</p>' + (p.access_detail ? '<p class="small">' + esc(p.access_detail) + '</p>' : '')) + '</div>';
    const seen = new Set();
    const sources = '<div class="card" data-reveal><h2>Sources</h2><ul class="sources">' + [...(p.sources || []), ...(w.sources || [])].filter(x => { const k = x.label + x.url; if (seen.has(k)) return false; seen.add(k); return true; }).map(x => '<li>' + ext(x.url, x.label) + '</li>').join('') + '</ul>' +
      '<p class="small" style="margin-top:16px">Record checked ' + time(p.checked_on, true) + '. Check the exact reach and current rules before your trip.</p><p class="small"><a class="link" href="classic/#/water/' + esc(w.id) + '">Open in the classic site</a></p></div>';

    return '<article><header class="d-hero"><div class="inner">' +
      '<a class="crumb" href="#/waters">' + icon('arrow-left-linear') + 'All waters</a>' +
      '<div class="d-top"><div><p class="eyebrow on-ink">' + esc(w.region) + ' · ' + kindLabel(w) + '</p><h1 class="d-title" data-split tabindex="-1" id="d-title">' + esc(w.name) + '</h1><p class="d-reach">' + esc(w.reach) + '</p></div>' +
      '<div class="d-score">' + scoreBlock + '</div></div>' +
      '<dl class="facts">' + facts.map(([l, v]) => '<div><dt>' + l + '</dt><dd>' + esc(v) + '</dd></div>').join('') + '</dl></div></header>' +
      '<div class="d-body"><div class="inner"><div class="d-main">' + report + notices + river + fish + stock + season + breakdown + '</div>' +
      '<aside class="aside" aria-label="Access and sources">' + access + sources + '</aside></div></div>' +
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
  let lenis = null, ctx = null, mm = null, stopRiver = null, wireObserver = null;
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
    mm?.revert(); mm = null;
    stopRiver?.(); stopRiver = null;
    wireObserver?.disconnect(); wireObserver = null;
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
        tl.from(hero.querySelectorAll('.hero-title .wi, .d-title .wi'), {yPercent: 110, duration: 1.1, stagger: 0.06}, 0.05)
          .from(hero.querySelectorAll('.eyebrow, .d-reach, .crumb'), {y: 14, duration: .8}, 0.1)
          .from(hero.querySelectorAll('.hero-lede, .hero-actions, .facts, .d-score'), {y: 26, duration: 1, stagger: .08}, 0.25);
        const plate = hero.querySelector('.plate-frame');
        if (plate) {
          tl.from(plate, {yPercent: 14, duration: 1.4, ease: 'expo.out'}, 0.15);
          const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter')) || 0;
          const inset = Math.min(innerWidth * 0.04, 56) || g;
          gsap.fromTo(plate, {'--plate-inset': inset + 'px'}, {'--plate-inset': '0px', ease: 'none', scrollTrigger: {trigger: plate, start: 'top 85%', end: 'bottom 60%', scrub: true}});
        }
        const ring = hero.querySelector('.ring .val');
        if (ring) gsap.from(ring, {strokeDashoffset: ring.dataset.ring, duration: 1.6, ease: 'expo.out', delay: .3});
      }
      // Section headings word by word, then their supporting copy.
      [...root.querySelectorAll('.section [data-split]'), ...(footFresh ? [footWord] : [])].forEach(h => {
        gsap.from(h.querySelectorAll('.wi'), {yPercent: 110, duration: 1, stagger: .05, ease: 'expo.out', scrollTrigger: {trigger: h, start: 'top 85%', once: true}});
      });
      root.querySelectorAll('[data-reveal]').forEach(el => {
        gsap.from(el, {y: 36, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: {trigger: el, start: 'top 90%', once: true}});
      });
      root.querySelectorAll('.station, .pick, .factors li').forEach(card => {
        const n = card.querySelector('[data-count]');
        const bars = card.querySelectorAll('[data-bar]'), rings = card.querySelectorAll('.ring .val');
        const trig = {trigger: card, start: 'top 85%', once: true};
        if (n) { const end = +n.dataset.count, o = {v: 0}; gsap.to(o, {v: end, duration: 1.6, ease: 'expo.out', scrollTrigger: trig, onUpdate: () => { n.textContent = num(o.v); }}); }
        bars.forEach(b => gsap.from(b, {scaleX: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: trig}));
        rings.forEach(r => gsap.from(r, {strokeDashoffset: r.dataset.ring, duration: 1.6, ease: 'expo.out', scrollTrigger: trig}));
      });
      const stockTotal = root.querySelector('.stock-total');
      if (stockTotal) { const end = +stockTotal.dataset.count, o = {v: 0}; gsap.to(o, {v: end, duration: 1.8, ease: 'expo.out', scrollTrigger: {trigger: stockTotal, start: 'top 85%', once: true}, onUpdate: () => { stockTotal.textContent = num(o.v); }}); }
    }, root);

    // One pinned, scrubbed moment: the score weights assemble as you read the method.
    const pin = root.querySelector('.method-pin');
    if (pin) {
      mm = gsap.matchMedia();
      mm.add('(min-width: 901px)', () => {
        const tl = gsap.timeline({scrollTrigger: {trigger: pin, start: 'center center', end: '+=110%', scrub: 0.6, pin: true}});
        pin.querySelectorAll('[data-stack]').forEach((s, i) => {
          tl.from(s, {scaleX: 0, duration: 1, ease: 'none'}, i);
          tl.from(pin.querySelectorAll('[data-factor]')[i], {opacity: .2, duration: .6}, i);
        });
      });
    }
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
  const SECTIONS = {waters: 'waters', counts: 'counts', stocking: 'stocking', method: 'method', shortlist: 'shortlist', anglers: 'anglers'};
  let current = null, firstRender = true;
  const curtain = document.createElement('div');
  curtain.className = 'curtain'; curtain.setAttribute('aria-hidden', 'true');
  document.body.appendChild(curtain);

  function parse() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path] = h.split('?');
    const parts = path.split('/');
    if (parts[0] === 'water' && byId.has(parts[1])) return {view: 'water:' + parts[1], water: byId.get(parts[1])};
    return {view: 'home', section: SECTIONS[parts[0]] || null};
  }
  function scrollToEl(el, immediate) {
    const y = el ? el.getBoundingClientRect().top + scrollY - (el.id === 'waters' ? 40 : 0) : 0;
    if (lenis) { lenis.resize(); lenis.scrollTo(y, {immediate, force: true, duration: 1.4}); }
    else window.scrollTo({top: y, behavior: 'auto'});
  }
  function setNav(route) {
    document.querySelectorAll('#nav-links a').forEach(a => {
      const match = route.section && a.getAttribute('href') === '#/' + route.section;
      if (match) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
  }
  function render(route) {
    teardown();
    if (route.view === 'home') {
      view.innerHTML = homeHTML();
      document.title = 'Oregon Fish Forecast · Read the river';
      renderRows(false);
      bindDirectory();
    } else {
      view.innerHTML = waterHTML(route.water);
      document.title = route.water.name + ', ' + route.water.reach + ' · Oregon Fish Forecast';
      bindOrigin();
    }
    current = route.view;
    animateIn(view, route.view === 'home');
  }
  function afterRender(route, immediate) {
    setNav(route);
    ST?.refresh();
    if (route.view === 'home' && route.section) {
      const el = document.getElementById(route.section);
      scrollToEl(el, immediate);
      el?.querySelector('h2')?.focus({preventScroll: true});
    } else {
      scrollToEl(null, true);
      if (!firstRender) (document.getElementById('d-title') || document.getElementById('main')).focus({preventScroll: true});
    }
    if (ST) document.fonts?.ready.then(() => {
      ST.refresh();
      // Fonts can shift section positions after a deep link; settle on the section again.
      if (route.view === 'home' && route.section && immediate) scrollToEl(document.getElementById(route.section), true);
    });
    firstRender = false;
  }
  function go() {
    closeMenu();
    const route = parse();
    if (route.view === current && !firstRender) { afterRender(route, false); return; }
    if (firstRender || !motionOK()) { render(route); afterRender(route, true); return; }
    gsap.timeline()
      .set(curtain, {transformOrigin: 'bottom'})
      .to(curtain, {scaleY: 1, duration: .5, ease: 'expo.in'})
      .add(() => { render(route); afterRender(route, true); })
      .set(curtain, {transformOrigin: 'top'})
      .to(curtain, {scaleY: 0, duration: .7, ease: 'expo.out'});
  }

  /* ---------- Controls ---------- */
  function bindDirectory() {
    const q = document.getElementById('q');
    q?.addEventListener('input', () => { dir.q = q.value; renderRows(true); });
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
      q.value = ''; document.getElementById('region').value = 'all';
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
