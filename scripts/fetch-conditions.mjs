// Reads river and reservoir conditions (30 days of readings, kept as latest plus 7- and 30-day medians) for the waters in data/monitoring.js and writes data/conditions.js for the
// score and the water pages. Run by .github/workflows/daily-data.yml. Node 18+. Sources, all keyless:
//  - USGS: the last 7 days of flow and water temperature (stations "USGS-<id>").
//  - NOAA National Water Prediction Service: observed flow or stage for gauges USGS does not carry (stations
//    "NWPS-<LID>", e.g. Reclamation's PRVO below Bowman Dam), and river forecasts (monitoring `forecast`).
//  - US Army Corps of Engineers CWMS: reservoir pool, rule curve and outflow (monitoring `dam`).
//  - Reclamation Hydromet: water temperature (`usbr`) and reservoir level (`usbrLake`). It often refuses cloud
//    requests, so it is optional.
// Every source fails on its own; one outage never blanks the others. STRICT=1 exits non-zero when no gauge
// returns data (used on pull requests).
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = new URL('../data/conditions.js', import.meta.url);
const STRICT = process.env.STRICT === '1';
const PARAMS = {flow: '00060', temp: '00010'};
const UA = {'user-agent': 'oregon-fish-forecast-concept (GitHub Actions; daily river conditions)'};

const win = {};
new Function('window', readFileSync(new URL('../data/monitoring.js', import.meta.url), 'utf8'))(win);
const mons = Object.values(win.ORFF_MONITORING);
const stations = [...new Set(mons.map(c => c.station).filter(s => /^USGS-\d+$/.test(s || '')))];
const nwpsStations = [...new Set(mons.map(c => c.station).filter(s => /^NWPS-\w+$/.test(s || '')))];
const forecastLids = [...new Set(mons.map(c => c.forecast).filter(Boolean))];
const dams = [...new Map(mons.filter(c => c.dam).map(c => [c.dam.id, c.dam])).values()];
const usbrTemps = [...new Set(mons.map(c => c.usbr).filter(Boolean))], usbrLakes = [...new Set(mons.map(c => c.usbrLake).filter(Boolean))];
const timeout = ms => AbortSignal.timeout(ms);
const getJSON = async (url, headers = {}) => { const res = await fetch(url, {headers: {...UA, ...headers}, signal: timeout(30000)}); if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); };

// The 7-day median shows the trend; the 30-day median shows whether the river is far from its recent normal.
const medians = pts => { const week = Date.now() - 7 * 86400000; const w = pts.filter(p => Date.parse(p.time) >= week); return {median7: median((w.length ? w : pts).map(p => p.value)), median30: median(pts.map(p => p.value))}; };
const median = xs => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const clean = pts => pts.filter(p => Number.isFinite(p.value) && p.value > -9999 && Number.isFinite(Date.parse(p.time))).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));

// The USGS OGC API first (the site's own readings use it), the older Water Services API as a fallback.
// An empty answer also falls through: some gauges (the Kalama) return nothing from the OGC API.
async function series(station, code) {
  const errors = [];
  let empty = null;
  for (const version of ['v0', 'v1']) {
    const url = `https://api.waterdata.usgs.gov/ogcapi/${version}/collections/continuous/items?` + new URLSearchParams({f: 'json', monitoring_location_id: station, parameter_code: code, time: 'P30D', skipGeometry: 'true', limit: '20000'});
    try {
      const res = await fetch(url, {headers: UA});
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const pts = clean((json.features || []).map(f => ({time: f.properties?.time, value: Number(f.properties?.value), unit: f.properties?.unit_of_measure})));
      if (pts.length) return {pts, via: 'ogc ' + version};
      empty ??= {pts, via: 'ogc ' + version};
    } catch (e) { errors.push(`ogc ${version}: ${e.message}`); }
  }
  const url = 'https://waterservices.usgs.gov/nwis/iv/?' + new URLSearchParams({format: 'json', sites: station.replace('USGS-', ''), parameterCd: code, period: 'P30D'});
  try {
    const res = await fetch(url, {headers: UA});
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const ts = json.value?.timeSeries || [];
    const pts = clean(ts.flatMap(t => (t.values?.[0]?.value || []).map(v => ({time: v.dateTime, value: Number(v.value), unit: t.variable?.unit?.unitCode}))));
    if (pts.length || !empty) return {pts, via: 'waterservices'};
  } catch (e) { errors.push(`waterservices: ${e.message}`); }
  if (empty) return empty;
  throw new Error(errors.join('; '));
}

const result = {fetched_at: new Date().toISOString(), stations: {}, forecasts: {}, reservoirs: {}};
let ok = 0;
for (const station of stations) {
  const entry = {};
  const notes = [];
  for (const [key, code] of Object.entries(PARAMS)) {
    try {
      const {pts, via} = await series(station, code);
      if (!pts.length) { notes.push(`${key}: none`); continue; }
      const last = pts.at(-1);
      entry[key] = {latest: last.value, unit: last.unit || null, time: last.time, n: pts.length};
      if (key === 'flow') Object.assign(entry.flow, medians(pts.map(p => ({time: p.time, value: p.value}))));
      notes.push(`${key} ${last.value}${last.unit ? ' ' + last.unit : ''} (${pts.length} pts, ${via})`);
    } catch (e) { notes.push(`${key} failed: ${e.message}`); }
  }
  if (entry.flow || entry.temp) { result.stations[station] = entry; ok++; }
  console.log(`${station}: ${notes.join('; ')}`);
}
// NOAA NWPS observed series: stage in ft (primary) and flow in kcfs (secondary); -999 means no value.
const NWPS = 'https://api.water.noaa.gov/nwps/v1/gauges/';
const nwpsPoints = json => (json.data || []).map(d => ({time: d.validTime, stage: d.primary > -999 ? d.primary : null, flow: d.secondary > -999 ? Math.round(d.secondary * 1000) : null}))
  .filter(p => Number.isFinite(Date.parse(p.time))).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
for (const station of nwpsStations) {
  const lid = station.slice(5);
  try {
    const since = Date.now() - 30 * 86400000;
    const pts = nwpsPoints(await getJSON(NWPS + lid + '/stageflow/observed')).filter(p => Date.parse(p.time) >= since);
    const entry = {}, flows = pts.filter(p => p.flow != null), stages = pts.filter(p => p.stage != null);
    if (flows.length) entry.flow = {latest: flows.at(-1).flow, unit: 'ft^3/s', time: flows.at(-1).time, n: flows.length, ...medians(flows.map(p => ({time: p.time, value: p.flow})))};
    if (stages.length) entry.stage = {latest: stages.at(-1).stage, unit: 'ft', time: stages.at(-1).time, n: stages.length, ...medians(stages.map(p => ({time: p.time, value: p.stage})))};
    if (entry.flow || entry.stage) { result.stations[station] = entry; ok++; }
    console.log(`${station}: ${entry.flow ? 'flow ' + entry.flow.latest + ' cfs' : 'no flow'}; ${entry.stage ? 'stage ' + entry.stage.latest + ' ft' : 'no stage'} (${pts.length} pts, nwps)`);
  } catch (e) { console.log(`${station}: failed: ${e.message}`); }
}
// NOAA river forecasts, 6-hourly, kept for the next 10 days.
for (const lid of forecastLids) {
  try {
    const json = await getJSON(NWPS + lid + '/stageflow/forecast');
    const pts = nwpsPoints(json).filter(p => Date.parse(p.time) >= Date.now() - 6 * 3600000).slice(0, 40);
    if (pts.length) result.forecasts[lid] = {issued: json.issuedTime || null, points: pts};
    console.log(`forecast ${lid}: ${pts.length} points` + (pts.length ? `, ${pts[0].flow ?? pts[0].stage} to ${pts.at(-1).flow ?? pts.at(-1).stage}` : ''));
  } catch (e) { console.log(`forecast ${lid}: failed: ${e.message}`); }
}
// US Army Corps of Engineers reservoirs: pool elevation, rule curve (the planned pool) and outflow.
const CDA = 'https://cwms-data.usace.army.mil/cwms-data/timeseries?';
// Each value tries its series in order; the instantaneous outflow series is often empty, so hourly averages back it up.
const DAM_SERIES = {elev: ['Elev-Forebay.Inst.0.0.MIXED-REV', 'Elev-Forebay.Inst.1Hour.0.CBT-REV'], rule: ['Elev-RuleCurve.Inst.~1Day.0.CENWP-CALC'],
  outflow: ['Flow-Out.Inst.0.0.MIXED-REV', 'Flow-Out.Ave.1Hour.1Hour.CBT-REV', 'Flow-Out.Ave.1Hour.1Hour.CBT-RAW']};
for (const dam of dams) {
  const entry = {name: dam.name};
  for (const [key, names] of Object.entries(DAM_SERIES)) {
    for (const ts of names) {
      try {
        const json = await getJSON(CDA + new URLSearchParams({name: dam.id + '.' + ts, office: dam.office, unit: 'EN', begin: new Date(Date.now() - 7 * 86400000).toISOString(), end: new Date().toISOString(), format: 'json'}), {accept: 'application/json;version=2'});
        const vals = (json.values || []).filter(v => Number.isFinite(v[1]));
        if (vals.length) { entry[key] = {latest: Math.round(vals.at(-1)[1] * 100) / 100, unit: json.units || null, time: new Date(vals.at(-1)[0]).toISOString(), week_ago: vals[0][1]}; break; }
      } catch (e) { console.log(`${dam.id} ${key} (${ts}): failed: ${e.message}`); }
    }
  }
  if (entry.elev || entry.outflow) result.reservoirs[dam.id] = entry;
  console.log(`${dam.id}: ` + ['elev', 'rule', 'outflow'].map(k => entry[k] ? `${k} ${entry[k].latest}` : `${k} none`).join(', '));
}
// Reclamation Hydromet CSV: a DateTime column, then one column per "station parameter" pair.
async function hydromet(list, days) {
  const res = await fetch('https://www.usbr.gov/pn-bin/instant.pl?' + new URLSearchParams({list, back: String(days), format: 'csv', flags: 'false'}), {headers: UA, signal: timeout(30000)});
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const rows = (await res.text()).trim().split(/\r?\n/).map(l => l.split(',').map(c => c.trim()));
  const head = rows.findIndex(r => /date/i.test(r[0] || ''));
  if (head < 0) throw new Error('no CSV header');
  const cols = rows[head].map(c => c.toLowerCase().replace(/\s+/g, ' '));
  const series = {};
  for (const r of rows.slice(head + 1)) {
    const t = Date.parse(r[0]);
    if (!Number.isFinite(t)) continue;
    cols.forEach((c, i) => { const v = Number(r[i]); if (i && Number.isFinite(v) && r[i] !== '' && v > -998) (series[c] ||= []).push({time: new Date(t).toISOString(), value: v}); });
  }
  return series;
}
if (usbrTemps.length || usbrLakes.length) {
  try {
    const list = [...usbrTemps.map(s => s.toLowerCase() + ' wf'), ...usbrLakes.map(s => s.toLowerCase() + ' fb')].join(',');
    const series = await hydromet(list, 7);
    for (const mon of mons) {
      const temp = mon.usbr && series[mon.usbr.toLowerCase() + ' wf'];
      if (temp?.length && result.stations[mon.station]) { result.stations[mon.station].temp = {latest: temp.at(-1).value, unit: 'degF', time: temp.at(-1).time, n: temp.length}; console.log(`${mon.usbr} water temp ${temp.at(-1).value} F (hydromet)`); }
      const fb = mon.usbrLake && series[mon.usbrLake.toLowerCase() + ' fb'];
      if (fb?.length) { result.reservoirs[mon.usbrLake] = {name: mon.name, elev: {latest: fb.at(-1).value, unit: 'ft', time: fb.at(-1).time, week_ago: fb[0].value}}; console.log(`${mon.usbrLake} pool ${fb.at(-1).value} ft (hydromet)`); }
    }
  } catch (e) { console.log(`Reclamation Hydromet: failed: ${e.message} (optional)`); }
}

writeFileSync(OUT, 'window.ORFF_CONDITIONS = ' + JSON.stringify(result) + ';\n');
console.log(`Wrote data/conditions.js (${ok} of ${stations.length + nwpsStations.length} gauges, ${Object.keys(result.forecasts).length} forecasts, ${Object.keys(result.reservoirs).length} reservoirs)`);
if (STRICT && !ok) process.exit(1);
