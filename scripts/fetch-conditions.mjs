// Reads the last 7 days of flow and water temperature for every USGS gauge in data/monitoring.js and writes
// data/conditions.js for the member-preview score. Run by .github/workflows/daily-data.yml. Node 18+.
// STRICT=1 exits non-zero when no gauge returns data (used on pull requests).
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = new URL('../data/conditions.js', import.meta.url);
const STRICT = process.env.STRICT === '1';
const PARAMS = {flow: '00060', temp: '00010'};
const UA = {'user-agent': 'oregon-fish-forecast-concept (GitHub Actions; daily river conditions)'};

const win = {};
new Function('window', readFileSync(new URL('../data/monitoring.js', import.meta.url), 'utf8'))(win);
const stations = [...new Set(Object.values(win.ORFF_MONITORING).map(c => c.station).filter(s => /^USGS-\d+$/.test(s || '')))];

const median = xs => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const clean = pts => pts.filter(p => Number.isFinite(p.value) && p.value > -9999 && Number.isFinite(Date.parse(p.time))).sort((a, b) => Date.parse(a.time) - Date.parse(b.time));

// The USGS OGC API first (the site's own readings use it), the older Water Services API as a fallback.
// An empty answer also falls through: some gauges (the Kalama) return nothing from the OGC API.
async function series(station, code) {
  const errors = [];
  let empty = null;
  for (const version of ['v0', 'v1']) {
    const url = `https://api.waterdata.usgs.gov/ogcapi/${version}/collections/continuous/items?` + new URLSearchParams({f: 'json', monitoring_location_id: station, parameter_code: code, time: 'P7D', skipGeometry: 'true', limit: '20000'});
    try {
      const res = await fetch(url, {headers: UA});
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const pts = clean((json.features || []).map(f => ({time: f.properties?.time, value: Number(f.properties?.value), unit: f.properties?.unit_of_measure})));
      if (pts.length) return {pts, via: 'ogc ' + version};
      empty ??= {pts, via: 'ogc ' + version};
    } catch (e) { errors.push(`ogc ${version}: ${e.message}`); }
  }
  const url = 'https://waterservices.usgs.gov/nwis/iv/?' + new URLSearchParams({format: 'json', sites: station.replace('USGS-', ''), parameterCd: code, period: 'P7D'});
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

const result = {fetched_at: new Date().toISOString(), stations: {}};
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
      if (key === 'flow') entry.flow.median7 = median(pts.map(p => p.value));
      notes.push(`${key} ${last.value}${last.unit ? ' ' + last.unit : ''} (${pts.length} pts, ${via})`);
    } catch (e) { notes.push(`${key} failed: ${e.message}`); }
  }
  if (entry.flow || entry.temp) { result.stations[station] = entry; ok++; }
  console.log(`${station}: ${notes.join('; ')}`);
}
writeFileSync(OUT, 'window.ORFF_CONDITIONS = ' + JSON.stringify(result) + ';\n');
console.log(`Wrote data/conditions.js (${ok} of ${stations.length} gauges)`);
if (STRICT && !ok) process.exit(1);
