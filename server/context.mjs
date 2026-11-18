// Builds the site data Eddy, the AI fishing assistant, reads.
// It runs the same data files and score formula the pages load (data/*.js, assets/member-preview.js), so the
// assistant sees the numbers a visitor sees. Field-check wording stays out, as it does on the site.
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// The page's script order (index.html). The score formula comes last because it reads the data globals.
export const SITE_FILES = [
  'data/waters.js', 'data/monitoring.js', 'data/count-stations.js', 'data/counts.js', 'data/stocking.js',
  'data/stocking-match.js', 'data/conditions.js', 'data/weather.js', 'data/angler.js', 'data/field-checks.js',
  'data/flow-seasons.js', 'data/auto-reports.js', 'data/odfw-reports.js', 'assets/member-preview.js'
];
// Files Eddy can do without: a missing one is skipped instead of failing the whole build.
const OPTIONAL = new Set(['data/odfw-reports.js']);

// Reads the site files from this checkout.
export function localSource(root = fileURLToPath(new URL('..', import.meta.url))) {
  return path => readFile(new URL(path, 'file://' + root.replace(/\/?$/, '/')), 'utf8');
}

// Reads the site files from the published site, so the endpoint follows the daily data commits without a redeploy.
export function remoteSource(siteUrl, fetchImpl = fetch) {
  const base = siteUrl.replace(/\/?$/, '/');
  return async path => {
    const res = await fetchImpl(new URL(path, base), {headers: {'cache-control': 'no-cache'}});
    if (!res.ok) throw new Error(path + ': HTTP ' + res.status);
    return res.text();
  };
}

// Runs the files in a sandbox whose global object stands in for `window`.
export async function loadSite(read) {
  const texts = await Promise.all(SITE_FILES.map(path => OPTIONAL.has(path) ? read(path).catch(e => { console.error('Skipping ' + path + ': ' + e.message); return ''; }) : read(path)));
  const g = {};
  g.window = g;
  vm.createContext(g);
  texts.forEach((text, i) => vm.runInContext(text, g, {filename: SITE_FILES[i], timeout: 2000}));
  if (!Array.isArray(g.ORFF_DATA?.waters)) throw new Error('data/waters.js did not define ORFF_DATA.waters');
  if (typeof g.ORFFPreview?.score !== 'function') throw new Error('assets/member-preview.js did not define the score formula');
  return g;
}

/* ---------- Helpers ---------- */
export const pacificToday = (d = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Los_Angeles'}).format(d);
const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
const num = n => Math.round(n).toLocaleString('en-US');
const ago = (iso, today) => {
  const n = days(iso.slice(0, 10), today);
  return n === 0 ? 'today' : n === 1 ? '1 day ago' : n > 0 ? n + ' days ago' : 'in ' + -n + ' days';
};
const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
function mondayOf(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}
const nameRes = names => names.map(n => new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'));

/* ---------- One water ---------- */
function scoreLines(g, w) {
  const s = g.ORFFPreview.score(w);
  if (s.status === 'withheld') return ['Score: withheld. ' + clean(s.reason)];
  if (s.status !== 'scored') return ['Score: none. ' + clean(s.reason)];
  const lines = ['Score: ' + s.value + '/100, ' + s.label + ', ' + s.confidence + ' confidence (' + s.used + ' of ' + s.inputs + ' inputs).'];
  for (const f of s.factors) lines.push('  - ' + f.label + ' (' + Math.round(f.weight * 100) + '%): ' + clean(f.display) + '. ' + clean(f.reason));
  if (s.missing.length) lines.push('  - Missing inputs: ' + s.missing.join(', ') + '.');
  for (const n of s.notes) lines.push('  - Note: ' + clean(n));
  return lines;
}

function gaugeLines(g, w, today) {
  const mon = g.ORFF_MONITORING?.[w.id], cond = g.ORFF_CONDITIONS;
  if (!mon) return [];
  const lines = [];
  const data = mon.station && cond?.stations?.[mon.station];
  const fetched = Date.parse(cond?.fetched_at || 0);
  const ok = x => x && Number.isFinite(x.latest) && fetched - Date.parse(x.time) <= 36 * 3600000;
  const bits = [];
  if (ok(data?.flow)) bits.push(num(data.flow.latest) + ' cfs (7-day median ' + num(data.flow.median7) + (data.flow.median30 ? ', 30-day median ' + num(data.flow.median30) : '') + ')');
  else if (ok(data?.stage)) bits.push('stage ' + data.stage.latest + ' ' + (data.stage.unit || 'ft'));
  if (ok(data?.temp)) {
    const f = /F/.test(data.temp.unit || '') ? data.temp.latest : data.temp.latest * 9 / 5 + 32;
    bits.push('water ' + f.toFixed(1) + '°F');
  }
  const when = [data?.flow, data?.stage, data?.temp].filter(ok).map(x => x.time).sort().pop();
  if (bits.length) lines.push('Gauge: ' + clean(mon.name) + ', read ' + ago(when, today) + ': ' + bits.join(', ') + '. ' + clean(mon.coverage));
  else if (mon.station) lines.push('Gauge: ' + clean(mon.name) + ' has no current reading. ' + clean(mon.coverage));
  else lines.push('Gauge: none connected. ' + clean(mon.coverage || mon.note));
  const fc = mon.forecast && cond?.forecasts?.[mon.forecast];
  const pts = (fc?.points || []).filter(p => p.flow != null);
  if (pts.length >= 2) {
    const peak = pts.reduce((a, b) => b.flow > a.flow ? b : a), last = pts.at(-1);
    const day = t => new Date(t).toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles'});
    lines.push('NOAA river forecast: from ' + num(pts[0].flow) + ' cfs, peak ' + num(peak.flow) + ' cfs on ' + day(peak.time) + ', ' + num(last.flow) + ' cfs by ' + day(last.time) + '.');
  }
  const resv = cond?.reservoirs?.[mon.dam?.id || mon.usbrLake];
  if (resv && ok(resv.elev)) {
    const change = resv.elev.week_ago != null ? resv.elev.latest - resv.elev.week_ago : null;
    const rule = resv.rule && Number.isFinite(resv.rule.latest) ? resv.elev.latest - resv.rule.latest : null;
    lines.push('Pool (' + clean(resv.name) + '): ' + resv.elev.latest.toFixed(1) + ' ft' + (change != null ? ', ' + (change < 0 ? 'down ' : 'up ') + Math.abs(change).toFixed(1) + ' ft in a week' : '') +
      (rule != null ? ', ' + Math.abs(rule).toFixed(1) + ' ft ' + (rule < 0 ? 'below' : 'above') + ' the planned level' : '') + (resv.outflow ? ', outflow ' + num(resv.outflow.latest) + ' cfs' : '') + '.');
  }
  return lines;
}

function countLines(g, w) {
  const links = g.ORFF_COUNT_STATIONS?.waters?.[w.id] || [];
  const lines = [];
  for (const l of links) {
    const meta = g.ORFF_COUNT_STATIONS.stations[l.station], data = g.ORFF_COUNTS?.stations?.[l.station];
    if (!meta) continue;
    const head = 'Dam/trap count, ' + meta.name + ' (' + clean(l.relation) + ')';
    if (!data) { lines.push(head + ': no daily numbers on the site; counts are published by the operator at ' + meta.url + (meta.note ? '. ' + clean(meta.note) : '')); continue; }
    const sp = Object.values(data.species).filter(v => v.ytd || v.last7).map(v => v.label + ' ' + num(v.last7) + ' in the last 7 days, ' + num(v.ytd) + ' this year' + (v.last_year_ytd ? ' vs ' + num(v.last_year_ytd) + ' by this date last year' : ''));
    lines.push(head + ', through ' + data.through + ': ' + sp.join('; ') + '.');
  }
  return lines;
}

function stockingLines(g, w, today) {
  const names = g.ORFF_STOCKING_MATCH?.[w.id];
  if (!names) return [];
  const res = nameRes(names);
  const rows = (g.ORFF_STOCKING?.rows || []).filter(r => res.some(re => re.test(r.waterbody)));
  const past = rows.filter(r => r.week_start <= today).sort((a, b) => b.week_start.localeCompare(a.week_start)).slice(0, 2);
  const next = rows.filter(r => r.week_start > today).sort((a, b) => a.week_start.localeCompare(b.week_start)).slice(0, 2);
  const fmt = r => num(r.total) + ' trout at ' + r.waterbody + ', week of ' + r.week_start;
  if (!past.length && !next.length) return ['ODFW stocking: none planned in the schedule window the site keeps.'];
  return ['ODFW stocking (planned, not confirmed): ' + [past.length ? 'latest ' + past.map(fmt).join('; ') : '', next.length ? 'next ' + next.map(fmt).join('; ') : ''].filter(Boolean).join('. ') + '.'];
}

function weatherLines(g, w) {
  const x = g.ORFF_WEATHER?.waters?.[w.id];
  if (!x?.periods?.length || Date.now() - Date.parse(x.at) > 48 * 3600000) return [];
  const lines = ['NWS forecast for the general area (read ' + x.at.slice(0, 10) + '): ' + x.periods.map(p => p.name + ' ' + p.temp + '°' + p.tempUnit + ', ' + p.short + (p.precip ? ' (' + p.precip + '% precip)' : '') + (p.wind ? ', wind ' + p.wind : '')).join('; ') + '.'];
  for (const a of x.alerts || []) lines.push('NWS alert: ' + clean(a.event || a.headline || a.title) + (a.ends ? ' until ' + a.ends : '') + '.');
  return lines;
}

function anglerLines(g, w, today) {
  const posts = (g.ORFF_ANGLER?.waters?.[w.id] || []).filter(p => { const d = days(p.date, today); return d >= 0 && d <= 30; }).sort((a, b) => b.date.localeCompare(a.date));
  return posts.map(p => 'Angler post (' + p.date + ', ' + p.platform + ', ' + p.kind + (p.where ? ', ' + clean(p.where) : '') + '): ' + clean(p.note));
}

function waterBlock(g, w, today) {
  const p = w.planning, out = [];
  out.push('### ' + w.name + ', ' + w.reach);
  out.push('Page: #/water/' + w.id + ' · ' + (w.kind === 'river' ? 'River' : w.kind === 'reservoir' ? 'Reservoir' : 'Lake') + ' · ' + w.region);
  out.push('Target species: ' + p.target_species.join(', ') + '.');
  out.push(...scoreLines(g, w));
  const a = g.ORFFPreview.autoReport?.(w), r = a || p.report;
  if (r?.reported_on) {
    out.push('Latest report (' + r.reported_on + ', ' + ago(r.reported_on, today) + (a ? ', WDFW creel report for ' + a.period : '') + '): "' + clean(r.summary) + '"' + (r.coverage ? ' Coverage: ' + clean(r.coverage) : '') + (r.url ? ' Source: ' + r.url : ''));
  } else out.push('Latest report: no dated fishing report.');
  for (const n of p.alerts || []) out.push('Notice (' + n.status + '): ' + clean(n.summary) + (n.url ? ' Source: ' + n.url : ''));
  for (const rule of (g.ORFF_AUTO?.rules?.[w.id] || []).filter(x => !x.effective_to || x.effective_to >= today)) {
    out.push('ODFW in-season rule (' + rule.kind + ', ' + rule.effective_from + (rule.effective_to ? ' to ' + rule.effective_to : ', no end date') + '): ' + clean(rule.summary) + ' Source: ' + rule.url);
  }
  out.push(...gaugeLines(g, w, today), ...countLines(g, w), ...stockingLines(g, w, today), ...weatherLines(g, w), ...anglerLines(g, w, today));
  out.push('Season: ' + clean(p.seasonal_summary) + '. ' + clean(p.seasonal_detail));
  out.push('Methods: ' + clean(p.methods));
  const points = p.access_points?.length ? p.access_points : p.access_point ? [p.access_point] : [];
  out.push('Access: ' + clean(p.access_summary) + '. ' + clean(p.access_detail) + (points.length ? ' Access points: ' + points.map(x => x.label).join('; ') + '.' : ''));
  return out.join('\n');
}

/* ---------- Statewide ---------- */
function countsBlock(g) {
  const out = ['## Dam counts (adult fish passing upstream; run timing, not catch rates)'];
  for (const [code, data] of Object.entries(g.ORFF_COUNTS?.stations || {})) {
    const meta = g.ORFF_COUNT_STATIONS?.stations?.[code];
    const sp = Object.values(data.species).filter(v => v.ytd || v.last7).map(v => v.label + ' ' + num(v.last7) + ' last 7 days, ' + num(v.ytd) + ' this year' + (v.last_year_ytd ? ' vs ' + num(v.last_year_ytd) + ' last year to date' : ''));
    out.push('- ' + (meta?.name || code) + ' (' + (meta?.river || '') + '), through ' + data.through + ': ' + sp.join('; ') + '.');
  }
  return out.join('\n');
}

function stockingBlock(g, today, byId) {
  const rows = g.ORFF_STOCKING?.rows || [];
  if (!rows.length) return '## ODFW trout stocking\nThe stocking schedule did not load.';
  const guide = waterbody => {
    for (const [id, names] of Object.entries(g.ORFF_STOCKING_MATCH || {})) if (nameRes(names).some(re => re.test(waterbody))) return byId.get(id);
    return null;
  };
  const mon = mondayOf(today);
  const weeks = [...new Set(rows.map(r => r.week_start))].filter(d => d >= mon).sort().slice(0, 2);
  const lastWeek = [...new Set(rows.map(r => r.week_start))].filter(d => d < mon).sort().pop();
  const out = ['## ODFW trout stocking (planned releases from the ODFW schedule, not confirmed; schedule read ' + (g.ORFF_STOCKING.fetched_at || '').slice(0, 10) + ')'];
  for (const wk of [lastWeek, ...weeks].filter(Boolean)) {
    const list = rows.filter(r => r.week_start === wk).sort((a, b) => b.total - a.total);
    const label = wk === mon ? 'This week' : wk < mon ? 'Last week' : 'Coming up';
    out.push(label + ', ' + list[0].week_label + ' (' + num(list.reduce((s, r) => s + r.total, 0)) + ' trout at ' + list.length + (list.length === 1 ? ' water' : ' waters') + '):');
    for (const r of list) { const gw = guide(r.waterbody); out.push('- ' + r.waterbody + ' (' + r.zone + '): ' + num(r.total) + (gw ? ' · in the guide as #/water/' + gw.id : '')); }
  }
  out.push('Full year schedule: classic/#/stocking on this site, or ' + (g.ORFF_STOCKING.source || 'https://myodfw.com/fishing/species/trout/stocking-schedule'));
  return out.join('\n');
}

// Every water on ODFW's schedule, guide or not, with its latest and next planned stockings, grouped by ODFW zone.
// The site keeps past rows for g.ORFF_STOCKING.keep_days, so older releases are not known.
function stockingDirectoryBlock(g, today, byId) {
  const rows = g.ORFF_STOCKING?.rows || [];
  if (!rows.length) return '';
  const guideIds = new Map();
  for (const [id, names] of Object.entries(g.ORFF_STOCKING_MATCH || {})) guideIds.set(id, nameRes(names));
  const guideFor = waterbody => { for (const [id, res] of guideIds) if (res.some(re => re.test(waterbody))) return byId.get(id); return null; };
  // One entry per water. ODFW labels some rows of the same water with different zones, so the region is the
  // first part of its most common zone.
  const byWater = new Map();
  for (const r of rows) (byWater.get(r.waterbody) || byWater.set(r.waterbody, []).get(r.waterbody)).push(r);
  const keepWeeks = Math.round((g.ORFF_STOCKING.keep_days || 56) / 7);
  const regions = new Map();
  const when = r => r.week_start + ' (' + num(r.total) + ')';
  for (const [name, list] of byWater) {
    const counts = new Map();
    for (const r of list) { const z = (r.zone || '').split('/')[0].trim() || 'No zone listed'; counts.set(z, (counts.get(z) || 0) + 1); }
    const region = [...counts].sort((a, b) => b[1] - a[1])[0][0];
    const past = list.filter(r => r.week_start <= today).sort((a, b) => b.week_start.localeCompare(a.week_start))[0];
    const next = list.filter(r => r.week_start > today).sort((a, b) => a.week_start.localeCompare(b.week_start)).slice(0, 2);
    const gw = guideFor(name);
    // ODFW's own name only where it carries a qualifier the readable name may lose, such as "LAVA LK, B".
    const odfw = list[0].odfw_name && /[,(]/.test(list[0].odfw_name) ? ' [' + list[0].odfw_name + ']' : '';
    const line = '- ' + name + odfw + ': last ' + (past ? when(past) : 'none') + '; next ' + (next.length ? next.map(when).join(', ') : 'none') + (gw ? ' · #/water/' + gw.id : '');
    (regions.get(region) || regions.set(region, []).get(region)).push(line);
  }
  const out = ['## Every water on the ODFW trout stocking schedule (' + byWater.size + ' waters; planned releases, not confirmed)',
    'Format: water: last = the most recent planned stocking week within the last ' + keepWeeks + ' weeks (older releases are not kept, so "none" does not mean never stocked); next = the next two planned weeks. Numbers in brackets after a date are trout. ODFW\'s own name is in square brackets where it has a qualifier. A #/water/ link means the water has a guide page.'];
  for (const region of [...regions.keys()].sort()) out.push(region + ':', ...regions.get(region).sort());
  return out.join('\n');
}

// ODFW's weekly report for each zone, in ODFW's own words. They name many waters the guide does not cover.
function odfwReportsBlock(g, today) {
  const zones = Object.values(g.ORFF_ODFW_REPORTS?.zones || {});
  if (!zones.length) return '';
  const out = ['## ODFW weekly fishing reports by zone (ODFW\'s own words; most pages carry no date, so each shows when its text first appeared here)'];
  for (const z of zones) {
    out.push('### ' + z.name + ' report' + (z.dated ? ', dated ' + z.dated : '') + ' (text unchanged since ' + z.changed_on + ', ' + ago(z.changed_on, today) + '; last read ' + z.read_on + '). Source: ' + z.url);
    out.push(z.text);
  }
  return out.join('\n');
}

function elsewhereBlock(g) {
  const list = g.ORFF_ANGLER?.elsewhere || [];
  if (!list.length) return '';
  return ['## Not in the guide yet (other Oregon waters anglers posted about in the last 30 days; word of mouth, not verified)',
    ...list.map(e => '- ' + e.water + ' (' + e.posts + (e.posts === 1 ? ' post' : ' posts') + ', latest ' + e.latest + '): ' + clean(e.note))].join('\n');
}

// The full text the assistant reads, plus what the endpoint needs to validate requests.
export function buildContext(g, today = pacificToday()) {
  const waters = g.ORFF_DATA.waters;
  const byId = new Map(waters.map(w => [w.id, w]));
  const text = [
    '# Oregon Fish Forecast site data, built ' + today + ' (Pacific)',
    'Data files refresh every morning. Angler posts were last read ' + (g.ORFF_ANGLER?.checked_on || 'unknown') + '. Gauges were read ' + (g.ORFF_CONDITIONS?.fetched_at || 'unknown').slice(0, 16).replace('T', ' ') + ' UTC.',
    '',
    '## The ' + waters.length + ' guide waters (full detail: score, reports, gauges, counts, stocking, weather, access)',
    waters.map(w => waterBlock(g, w, today)).join('\n\n'),
    '',
    countsBlock(g),
    '',
    stockingBlock(g, today, byId),
    '',
    stockingDirectoryBlock(g, today, byId),
    '',
    odfwReportsBlock(g, today),
    '',
    elsewhereBlock(g)
  ].join('\n');
  return {today, text, waters: waters.map(w => ({id: w.id, name: w.name, reach: w.reach}))};
}

// Caches the built context and rebuilds it when it is older than ttlMs or the Pacific date changes.
// A failed rebuild keeps serving the last good copy.
export function contextCache(read, {ttlMs = 15 * 60 * 1000, now = () => Date.now()} = {}) {
  let cached = null, at = 0, pending = null;
  return async () => {
    const fresh = cached && now() - at < ttlMs && cached.today === pacificToday(new Date(now()));
    if (fresh) return cached;
    pending ||= loadSite(read).then(g => { cached = buildContext(g, pacificToday(new Date(now()))); at = now(); return cached; })
      .catch(e => { if (cached) { console.error('Context rebuild failed, keeping the last copy:', e.message); return cached; } throw e; })
      .finally(() => { pending = null; });
    return pending;
  };
}
