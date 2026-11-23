// Builds data/app.json, the one file the iPhone app (ios/) reads.
// It runs the same data files and score formula as the website (through server/context.mjs), so the app shows the
// scores a visitor sees on the site without a second copy of the formula. Field-check wording stays out, as on the site.
//
//   node scripts/build-app-feed.mjs           writes data/app.json (left untouched when only the build time would change)
//   node scripts/build-app-feed.mjs --check   builds it and checks its shape, without writing
import vm from 'node:vm';
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadSite, localSource, pacificToday} from '../server/context.mjs';

export const FEED_VERSION = 1;
const SITE = 'https://oregonfishforecast.com/';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = new URL('../data/app.json', import.meta.url);

const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
const num = n => Math.round(n).toLocaleString('en-US');
const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const orNull = v => v === undefined || v === '' ? null : v;
const fmtDate = iso => new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'});
const nameRes = names => names.map(n => new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'));
function mondayOf(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* ---------- Pieces of one water, mirroring v2/assets/app.js ---------- */

// The fish a score is for, in an angler's words ("trout", "salmon and steelhead").
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

// Gauge readings over 36 hours old are not shown as current, as on the site.
function gaugeOf(g, w) {
  const mon = g.ORFF_MONITORING?.[w.id];
  if (!mon) return null;
  const cond = g.ORFF_CONDITIONS || {};
  const data = mon.station && cond.stations?.[mon.station];
  const fetched = Date.parse(cond.fetched_at || 0);
  const ok = x => x && Number.isFinite(x.latest) && fetched - Date.parse(x.time) <= 36 * 3600000;
  const flow = ok(data?.flow) ? data.flow : null, temp = ok(data?.temp) ? data.temp : null, stage = !flow && ok(data?.stage) ? data.stage : null;
  const fah = temp ? (/F/.test(temp.unit || '') ? temp.latest : temp.latest * 9 / 5 + 32) : null;
  const resv = cond.reservoirs?.[mon.dam?.id || mon.usbrLake];
  const pool = resv && ok(resv.elev) ? {
    name: clean(resv.name),
    elevation_ft: +resv.elev.latest.toFixed(1),
    week_change_ft: resv.elev.week_ago != null ? +(resv.elev.latest - resv.elev.week_ago).toFixed(1) : null,
    below_plan_ft: resv.rule && Number.isFinite(resv.rule.latest) ? +(resv.rule.latest - resv.elev.latest).toFixed(1) : null,
    outflow_cfs: resv.outflow && Number.isFinite(resv.outflow.latest) ? Math.round(resv.outflow.latest) : null,
    time: resv.elev.time
  } : null;
  return {
    name: clean(mon.name).replace(/\s*·.*$/, ''),
    short_name: gaugeName(w, mon),
    coverage: clean(mon.coverage || mon.note),
    url: orNull(w.gauge?.url || mon.url),
    live: !!(flow || stage || temp || pool),
    flow: flow ? {cfs: Math.round(flow.latest), median7: flow.median7 != null ? Math.round(flow.median7) : null, median30: flow.median30 != null ? Math.round(flow.median30) : null, time: flow.time} : null,
    stage: stage ? {value: stage.latest, unit: stage.unit || 'ft', time: stage.time} : null,
    water_temp_f: fah != null ? +fah.toFixed(1) : null,
    water_temp_time: temp ? temp.time : null,
    forecast: forecastOf(cond, mon, flow),
    pool
  };
}
function gaugeName(w, mon) {
  if (w.gauge?.label) return w.gauge.label;
  const name = String(mon?.name || '').replace(/\s*[(·].*$/, '');
  const place = name.match(/\b(?:near|at|below|above)\s+(.+)$/);
  return place ? place[1] + ' gauge' : name + ' gauge';
}
// NOAA river forecast: where the flow is headed over the next few days.
function forecastOf(cond, mon, flow) {
  const pts = (mon.forecast && cond.forecasts?.[mon.forecast]?.points || []).filter(p => p.flow != null);
  if (pts.length < 2) return null;
  const peak = pts.reduce((a, b) => b.flow > a.flow ? b : a), last = pts.at(-1);
  const when = t => new Date(t).toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles'});
  const now = flow?.latest ?? pts[0].flow;
  const text = peak.flow > 1.3 * now ? 'Rising to about ' + num(peak.flow) + ' cfs by ' + when(peak.time)
    : last.flow < 0.77 * now ? 'Falling to about ' + num(last.flow) + ' cfs by ' + when(last.time)
    : 'Holding near ' + num(now) + ' cfs through ' + when(last.time);
  return {text, peak_cfs: Math.round(peak.flow), url: 'https://water.noaa.gov/gauges/' + mon.forecast.toLowerCase()};
}

function reportOf(g, w) {
  const a = g.ORFFPreview.autoReport?.(w), r = a || w.planning.report;
  if (!r) return null;
  return {
    summary: clean(r.summary),
    reported_on: orNull(r.reported_on),
    coverage: orNull(clean(r.coverage)),
    url: orNull(r.url),
    source: a ? 'WDFW creel report' + (a.period ? ', ' + a.period : '') : null
  };
}

function stockingOf(g, w, today) {
  const names = g.ORFF_STOCKING_MATCH?.[w.id];
  if (!names) return null;
  const res = nameRes(names);
  const rows = (g.ORFF_STOCKING?.rows || []).filter(r => res.some(re => re.test(r.waterbody)));
  const row = r => ({week_start: r.week_start, week_label: clean(r.week_label), waterbody: r.waterbody, total: r.total});
  return {
    latest: rows.filter(r => r.week_start <= today).sort((a, b) => b.week_start.localeCompare(a.week_start)).slice(0, 2).map(row),
    next: rows.filter(r => r.week_start > today).sort((a, b) => a.week_start.localeCompare(b.week_start)).slice(0, 3).map(row)
  };
}

function countsOf(g, w) {
  return (g.ORFF_COUNT_STATIONS?.waters?.[w.id] || []).map(l => {
    const meta = g.ORFF_COUNT_STATIONS.stations[l.station];
    return meta ? {station: l.station, name: meta.name, relation: clean(l.relation)} : null;
  }).filter(Boolean);
}

function weatherOf(g, w) {
  const x = g.ORFF_WEATHER?.waters?.[w.id];
  if (!x?.periods?.length || Date.now() - Date.parse(x.at) > 48 * 3600000) return null;
  return {
    read_at: x.at,
    url: x.grid ? 'https://forecast.weather.gov/MapClick.php?lat=' + x.grid.lat + '&lon=' + x.grid.lon : null,
    periods: x.periods.map(p => ({name: p.name, is_daytime: !!p.isDaytime, temp: p.temp, temp_unit: p.tempUnit || 'F', short: clean(p.short), precip: p.precip ?? null, wind: orNull(p.wind)})),
    alerts: (x.alerts || []).map(a => ({event: clean(a.event || a.headline), headline: orNull(clean(a.headline)), ends: orNull(a.ends), url: orNull(a.url)}))
  };
}

function anglerOf(g, w, today) {
  return (g.ORFF_ANGLER?.waters?.[w.id] || []).filter(p => { const d = days(p.date, today); return d >= 0 && d <= 30; })
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(p => ({date: p.date, platform: p.platform, kind: p.kind, where: orNull(clean(p.where)), note: clean(p.note), signal: orNull(p.signal), url: p.url}));
}

// One concrete reason to go, from the input that says most about a water today (whyNow in v2/assets/app.js).
function whyNow(g, w, s, gauge, angler, report) {
  const strong = k => s.factors.find(f => f.key === k && f.value >= 70);
  const pick = ['field', 'stock', 'run', 'cond', 'angler', 'tone'].map(strong).find(Boolean) || [...s.factors].sort((x, y) => y.value - x.value)[0];
  if (!pick) return null;
  if (pick.key === 'cond') return pick.display.split(' · ')[0] + ' at the ' + (gauge?.short_name || 'gauge') + (gauge?.water_temp_f != null ? ', ' + Math.round(gauge.water_temp_f) + '°F' : '');
  if (pick.key === 'angler') {
    const post = angler.find(p => p.kind === 'catch') || angler[0];
    return post ? 'Angler catch post, ' + fmtDate(post.date) + ' (' + post.platform + ', not verified)' : pick.display;
  }
  return pick.key === 'field' ? 'Field check: ' + pick.display
    : pick.key === 'stock' ? (/^Week of/.test(pick.display) ? 'ODFW stocking, ' + pick.display.replace(/^W/, 'w') : pick.display + ' (ODFW)')
    : pick.key === 'run' ? 'Run at ' + pick.display
    : pick.key === 'tone' ? pick.display + ' report' + (report?.reported_on ? ', ' + fmtDate(report.reported_on) : '')
    : pick.key === 'fresh' ? 'Report ' + pick.display
    : pick.display;
}

function scoreOf(g, w, gauge, angler, report) {
  const s = g.ORFFPreview.score(w);
  if (s.status !== 'scored') return {status: s.status === 'withheld' ? 'withheld' : 'insufficient', reason: clean(s.reason)};
  const firstSentence = n => n.match(/^.*?\.(?=\s|$)/)?.[0] || n;
  // Field-check wording stays private: the breakdown shows only "Field check", a one-word result and the date.
  const factors = s.factors.map(f => ({
    key: f.key, label: f.label, weight: f.weight, value: f.value, display: clean(f.display),
    reason: f.key === 'field' ? 'A first-hand trip check on this water. It counts for two weeks and can raise or lower the score.' : clean(f.reason)
  }));
  return {
    status: 'scored', value: s.value, label: s.label, confidence: s.confidence, used: s.used, inputs: s.inputs,
    factors, missing: s.missing, notes: s.notes.map(clean),
    short_note: orNull(s.notes.filter(n => n !== w.planning.score_species_note).map(firstSentence)[0]),
    why: whyNow(g, w, {...s, factors}, gauge, angler, report)
  };
}

function waterOf(g, w, today) {
  const p = w.planning;
  const pos = g.ORFF_MAP?.positions?.[w.id];
  const gauge = gaugeOf(g, w), angler = anglerOf(g, w, today), report = reportOf(g, w);
  const season = (g.ORFF_FLOW_SEASONS?.[w.id] || []).find(s => s.from <= today.slice(5) && today.slice(5) <= s.to);
  const points = p.access_points?.length ? p.access_points : p.access_point ? [p.access_point] : [];
  return {
    id: w.id, name: w.name, reach: w.reach, kind: w.kind, region: w.region,
    url: SITE + '#/water/' + w.id,
    species: p.target_species,
    score_species: p.score_species || null,
    species_word: speciesWord(w),
    position: pos ? {lat: pos[0], lon: pos[1]} : null,
    score: scoreOf(g, w, gauge, angler, report),
    report,
    notices: (p.alerts || []).map(a => ({summary: clean(a.summary), status: a.status, url: orNull(a.url)})),
    rules: (g.ORFF_AUTO?.rules?.[w.id] || []).filter(r => !r.effective_to || r.effective_to >= today)
      .map(r => ({kind: r.kind, summary: clean(r.summary), effective_from: r.effective_from, effective_to: orNull(r.effective_to), url: r.url})),
    flow_season: season ? clean(season.note) : null,
    season: {summary: clean(p.seasonal_summary), detail: clean(p.seasonal_detail)},
    methods: clean(p.methods),
    access: {
      summary: clean(p.access_summary), detail: clean(p.access_detail),
      points: points.map(x => ({label: x.label, type: orNull(x.type), note: orNull(clean(x.note)), map_query: x.map_query || x.label, source: orNull(x.source)}))
    },
    gauge, weather: weatherOf(g, w), stocking: stockingOf(g, w, today), counts: countsOf(g, w), angler,
    sources: (p.sources || []).map(x => ({label: x.label, url: x.url})),
    checked_on: orNull(p.checked_on)
  };
}

/* ---------- Statewide ---------- */
function countStations(g) {
  const meta = g.ORFF_COUNT_STATIONS?.stations || {}, data = g.ORFF_COUNTS?.stations || {};
  return Object.entries(meta).map(([code, m]) => {
    const d = data[code];
    return {
      code, name: m.name, river: m.river, operator: m.operator, url: m.url, note: orNull(m.note),
      live: m.live ? {url: m.live.url, label: m.live.label, by: orNull(m.live.by)} : null,
      through: d?.through || null,
      species: d ? Object.entries(d.species).map(([key, v]) => ({key, label: v.label, last7: v.last7, ytd: v.ytd, last_year_ytd: v.last_year_ytd ?? null})) : [],
      source: orNull(d?.source)
    };
  });
}

// ODFW's planned stockings from last week through five weeks out, with guide waters linked.
function stockingWeeks(g, today, guideIds) {
  const rows = g.ORFF_STOCKING?.rows || [];
  const guide = waterbody => { for (const [id, res] of guideIds) if (res.some(re => re.test(waterbody))) return id; return null; };
  const mon = mondayOf(today), from = addDays(mon, -7), to = addDays(mon, 35);
  const weeks = [...new Set(rows.map(r => r.week_start))].filter(d => d >= from && d <= to).sort();
  return {
    fetched_at: orNull(g.ORFF_STOCKING?.fetched_at),
    source: g.ORFF_STOCKING?.source || 'https://myodfw.com/fishing/species/trout/stocking-schedule',
    this_week: mon,
    weeks: weeks.map(wk => {
      const list = rows.filter(r => r.week_start === wk).sort((a, b) => b.total - a.total || a.waterbody.localeCompare(b.waterbody));
      return {
        week_start: wk, week_label: clean(list[0].week_label),
        rows: list.map(r => ({waterbody: r.waterbody, zone: clean(r.zone), total: r.total, water_id: guide(r.waterbody)}))
      };
    })
  };
}

export function buildFeed(g, today = pacificToday()) {
  const guideIds = new Map(Object.entries(g.ORFF_STOCKING_MATCH || {}).map(([id, names]) => [id, nameRes(names)]));
  return {
    version: FEED_VERSION,
    generated_at: new Date().toISOString(),
    today,
    site: SITE,
    gauges_read_at: orNull(g.ORFF_CONDITIONS?.fetched_at),
    angler_checked_on: orNull(g.ORFF_ANGLER?.checked_on),
    map_note: orNull(g.ORFF_MAP?.note),
    waters: g.ORFF_DATA.waters.map(w => waterOf(g, w, today)),
    count_stations: countStations(g),
    stocking: stockingWeeks(g, today, guideIds)
  };
}

// The app decodes these fields without defaults, so a missing one would stop it from reading the feed.
export function checkFeed(feed) {
  const problems = [];
  const need = (obj, keys, where) => { for (const k of keys) if (!(k in (obj || {}))) problems.push(where + ': missing ' + k); };
  need(feed, ['version', 'generated_at', 'today', 'site', 'waters', 'count_stations', 'stocking'], 'feed');
  for (const w of feed.waters || []) {
    const at = 'water ' + w.id;
    need(w, ['id', 'name', 'reach', 'kind', 'region', 'url', 'species', 'species_word', 'score', 'notices', 'rules', 'season', 'methods', 'access', 'counts', 'angler', 'sources'], at);
    if (!['scored', 'withheld', 'insufficient'].includes(w.score?.status)) problems.push(at + ': unknown score status ' + w.score?.status);
    if (w.score?.status === 'scored') need(w.score, ['value', 'label', 'confidence', 'used', 'inputs', 'factors', 'missing', 'notes'], at + ' score');
    if (!w.position) problems.push(at + ': no map position in data/map.js');
  }
  if (!feed.waters?.length) problems.push('feed: no waters');
  if (new Set((feed.waters || []).map(w => w.id)).size !== (feed.waters || []).length) problems.push('feed: duplicate water ids');
  return problems;
}

async function main() {
  const g = await loadSite(localSource(ROOT));
  // The map positions are not part of the site files the score reads, so load them into the same sandbox.
  vm.runInContext(await readFile(new URL('../data/map.js', import.meta.url), 'utf8'), g, {filename: 'data/map.js'});
  const feed = buildFeed(g);
  const problems = checkFeed(feed);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  const scored = feed.waters.filter(w => w.score.status === 'scored').length;
  const summary = feed.waters.length + ' waters (' + scored + ' scored), ' + feed.count_stations.length + ' count sites, ' + feed.stocking.weeks.length + ' stocking weeks';
  if (process.argv.includes('--check')) { console.log('App feed OK: ' + summary + '.'); return; }
  // Leave the file alone when nothing but the build time changed, so a quiet day makes no data commit.
  const strip = f => JSON.stringify({...f, generated_at: null});
  const old = await readFile(OUT, 'utf8').then(JSON.parse).catch(() => null);
  if (old && strip(old) === strip(feed)) { console.log('App feed unchanged: ' + summary + '.'); return; }
  await writeFile(OUT, JSON.stringify(feed) + '\n');
  console.log('Wrote data/app.json: ' + summary + '.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
