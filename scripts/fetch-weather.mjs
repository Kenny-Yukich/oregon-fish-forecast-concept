// Reads the National Weather Service forecast and active alerts for every water with a map position in
// data/map.js and writes data/weather.js for the water pages. Run by .github/workflows/daily-data.yml. Node 18+.
// Gridpoints are cached in the output file, so the points lookup only runs when a position changes.
// STRICT=1 exits non-zero when no water gets a forecast (used on pull requests).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const OUT = new URL('../data/weather.js', import.meta.url);
const STRICT = process.env.STRICT === '1';
const API = 'https://api.weather.gov';
const HEADERS = {'user-agent': 'oregon-fish-forecast-concept (GitHub Actions; daily weather)', accept: 'application/geo+json'};
const PERIODS = 4, GAP_MS = 250, KEEP_MS = 48 * 3600000;

const load = (file, win = {}) => { new Function('window', readFileSync(new URL('../data/' + file, import.meta.url), 'utf8'))(win); return win; };
const win = load('map.js', load('waters.js'));
const positions = win.ORFF_MAP?.positions || {};
const waters = (win.ORFF_DATA?.waters || []).filter(w => Array.isArray(positions[w.id]));
let prev = {};
if (existsSync(OUT)) { try { prev = load('weather.js').ORFF_WEATHER?.waters || {}; } catch (e) { console.log(`Previous weather.js unreadable: ${e.message}`); } }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const round = n => +Number(n).toFixed(4);
let last = 0;
// Sequential and spaced out, with one retry on a 5xx or network error.
async function get(url) {
  for (let attempt = 0; ; attempt++) {
    const wait = last + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    try {
      const res = await fetch(url, {headers: HEADERS});
      if (res.ok) return await res.json();
      if (res.status < 500 || attempt) throw new Error('HTTP ' + res.status);
    } catch (e) { if (attempt || /^HTTP 4/.test(e.message)) throw e; }
    await sleep(1500);
  }
}

async function grid(lat, lon, cached) {
  if (cached?.office && cached.lat === lat && cached.lon === lon) return cached;
  const p = (await get(`${API}/points/${lat},${lon}`)).properties || {};
  if (!p.gridId || !Number.isFinite(p.gridX) || !Number.isFinite(p.gridY)) throw new Error('points: no gridpoint');
  return {lat, lon, office: p.gridId, x: p.gridX, y: p.gridY, zone: (p.forecastZone || '').split('/').pop() || null};
}

const forecasts = new Map(), alertsAt = new Map();
async function forecast(g) {
  const key = `${g.office}/${g.x},${g.y}`;
  if (!forecasts.has(key)) forecasts.set(key, get(`${API}/gridpoints/${key}/forecast`).then(j => (j.properties?.periods || []).slice(0, PERIODS).map(p => ({
    name: p.name, start: p.startTime, isDaytime: !!p.isDaytime, temp: p.temperature ?? null, tempUnit: p.temperatureUnit || null,
    wind: [p.windDirection, p.windSpeed].filter(Boolean).join(' ') || null, short: p.shortForecast || null,
    precip: p.probabilityOfPrecipitation?.value ?? null
  }))));
  return forecasts.get(key);
}
async function alerts(lat, lon) {
  const key = `${lat},${lon}`;
  if (!alertsAt.has(key)) alertsAt.set(key, get(`${API}/alerts/active?point=${key}`).then(j => (j.features || []).map(f => ({
    event: f.properties?.event || null, headline: f.properties?.headline || null, severity: f.properties?.severity || null,
    ends: f.properties?.ends || f.properties?.expires || null, url: f.properties?.['@id'] || f.id || null
  })).filter(a => a.event)));
  return alertsAt.get(key);
}

const now = Date.now();
const result = {fetched_at: new Date(now).toISOString(), waters: {}};
let ok = 0, kept = 0;
for (const w of waters) {
  const [lat, lon] = positions[w.id].map(round);
  const old = prev[w.id];
  try {
    const g = await grid(lat, lon, old?.grid);
    const periods = await forecast(g);
    if (!periods.length) throw new Error('forecast: no periods');
    // An alerts failure keeps the forecast; it is logged and shows no alerts.
    let al = [];
    try { al = await alerts(lat, lon); } catch (e) { console.log(`${w.id}: alerts failed: ${e.message}`); }
    result.waters[w.id] = {at: result.fetched_at, grid: g, periods, alerts: al};
    ok++;
    console.log(`${w.id}: ${g.office} ${g.x},${g.y} ${periods[0].name} ${periods[0].temp}${periods[0].tempUnit || ''}, ${al.length} alert(s)`);
  } catch (e) {
    const fresh = old?.at && now - Date.parse(old.at) < KEEP_MS;
    if (fresh) { result.waters[w.id] = old; kept++; }
    console.log(`${w.id}: failed: ${e.message}${fresh ? ' (kept previous entry from ' + old.at + ')' : ''}`);
  }
}
if (!ok && !kept && Object.keys(prev).length) console.log('Nothing fetched; leaving data/weather.js as it was.');
else {
  writeFileSync(OUT, 'window.ORFF_WEATHER = ' + JSON.stringify(result) + ';\n');
  console.log(`Wrote data/weather.js (${ok} of ${waters.length} waters fetched, ${kept} kept from the last run, ${forecasts.size} forecast grids requested)`);
}
if (STRICT && !ok) process.exit(1);
