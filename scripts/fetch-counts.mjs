// Pulls daily adult fish counts from Columbia River DART and writes data/counts.js.
// Run by .github/workflows/fish-counts.yml. Node 18+, no dependencies.
// STRICT=1 exits non-zero when a station cannot be read (used on pull requests).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const OUT = new URL('../data/counts.js', import.meta.url);
const STATIONS = ['BON', 'TDA', 'WFF'];
const STRICT = process.env.STRICT === '1';
const BASE = 'https://www.cbr.washington.edu/dart/cs/php/rpt/adult_daily.php';
const SPECIES = {
  chinook: {label: 'Chinook', test: h => /chin/.test(h) && !/jack|mini/.test(h)},
  chinook_jack: {label: 'Chinook jacks', test: h => /chin/.test(h) && /jack/.test(h)},
  coho: {label: 'Coho', test: h => /coho/.test(h) && !/jack/.test(h)},
  coho_jack: {label: 'Coho jacks', test: h => /coho/.test(h) && /jack/.test(h)},
  steelhead: {label: 'Steelhead', test: h => /(steel|stlhd)/.test(h) && !/(wild|unclip)/.test(h)},
  steelhead_wild: {label: 'Wild steelhead', test: h => /(steel|stlhd)/.test(h) && /(wild|unclip)/.test(h)}
};

function urls(proj, year) {
  const common = {sc: '1', year: String(year), proj, span: 'no', startdate: '1/1', enddate: '12/31', run: ''};
  return ['csvSingle', 'csv'].map(f => BASE + '?' + new URLSearchParams({...common, outputFormat: f}));
}

function parseCSV(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { cells.push(cur); cur = ''; } else cur += c;
    }
    cells.push(cur);
    rows.push(cells.map(s => s.trim()));
  }
  return rows;
}

function toISO(value, year) {
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(value);
  if (m) { const y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : String(year); return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; }
  return null;
}

// Returns [{date, counts:{species:n}}] sorted by date, or throws with a description of what arrived.
function readDaily(text, year) {
  const rows = parseCSV(text);
  const hi = rows.findIndex(r => r.some(c => /date/i.test(c)) && r.some(c => /(chin|coho|steel|stlhd)/i.test(c)));
  if (hi < 0) throw new Error('No header row with a date and species columns. First 300 chars: ' + JSON.stringify(text.slice(0, 300)));
  const header = rows[hi].map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
  const dateCol = header.findIndex(h => /date/.test(h));
  const cols = {};
  for (const [key, s] of Object.entries(SPECIES)) {
    const i = header.findIndex(s.test);
    if (i >= 0) cols[key] = i;
  }
  console.log(`  header: ${rows[hi].join(' | ')}`);
  console.log(`  mapped: ${Object.entries(cols).map(([k, i]) => k + '=' + rows[hi][i]).join(', ')}`);
  const days = [];
  for (const r of rows.slice(hi + 1)) {
    const date = toISO(r[dateCol] || '', year);
    if (!date || !date.startsWith(String(year))) continue;
    const counts = {}; let any = false;
    for (const [key, i] of Object.entries(cols)) {
      const n = Number(String(r[i] ?? '').replace(/,/g, ''));
      if (r[i] !== '' && Number.isFinite(n)) { counts[key] = n; any = true; }
    }
    if (any) days.push({date, counts});
  }
  if (!days.length) throw new Error('Header found but no dated rows for ' + year);
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchYear(proj, year) {
  const errors = [];
  for (const url of urls(proj, year)) {
    try {
      const res = await fetch(url, {headers: {'user-agent': 'oregon-fish-forecast-concept (GitHub Actions; daily fish-count snapshot)'}});
      const text = await res.text();
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return {days: readDaily(text, year), url};
    } catch (e) { errors.push(url + ' -> ' + e.message); }
  }
  throw new Error(errors.join('\n    '));
}

const sumTo = (days, key, md) => days.filter(d => d.date.slice(5) <= md).reduce((t, d) => t + (d.counts[key] ?? 0), 0);

async function station(proj, year) {
  const cur = await fetchYear(proj, year);
  const counted = cur.days.filter(d => Object.values(d.counts).some(n => n > 0));
  const last = (counted.at(-1) || cur.days.at(-1)).date, md = last.slice(5);
  let prev = null;
  try { prev = await fetchYear(proj, year - 1); } catch (e) { console.log(`  last year unavailable: ${e.message}`); }
  const weekStart = new Date(Date.parse(last + 'T12:00:00Z') - 6 * 86400000).toISOString().slice(0, 10);
  const species = {};
  for (const key of Object.keys(SPECIES)) {
    if (!cur.days.some(d => key in d.counts)) continue;
    species[key] = {
      label: SPECIES[key].label,
      ytd: sumTo(cur.days, key, md),
      last7: cur.days.filter(d => d.date >= weekStart && d.date <= last).reduce((t, d) => t + (d.counts[key] ?? 0), 0),
      last_year_ytd: prev ? sumTo(prev.days, key, md) : null
    };
  }
  return {through: last, week_start: weekStart, species, source: cur.url};
}

const year = Number(process.env.COUNT_YEAR) || new Date().getUTCFullYear();
let previous = {stations: {}};
if (existsSync(OUT)) {
  try { previous = JSON.parse(readFileSync(OUT, 'utf8').replace(/^window\.ORFF_COUNTS = /, '').replace(/;\s*$/, '')); } catch {}
}
const result = {stations: {...previous.stations}};
let failed = 0;
for (const proj of STATIONS) {
  console.log(`${proj} ${year}`);
  try {
    result.stations[proj] = await station(proj, year);
    const s = result.stations[proj];
    console.log(`  through ${s.through}: ` + Object.values(s.species).map(v => `${v.label} ytd ${v.ytd}, 7d ${v.last7}, last yr ${v.last_year_ytd}`).join('; '));
  } catch (e) {
    failed++;
    console.log(`  FAILED, keeping previous data if any:\n    ${e.message}`);
  }
}
const body = JSON.stringify(result.stations);
if (body === JSON.stringify(previous.stations)) console.log('No change in counts.');
else {
  result.generated_at = new Date().toISOString();
  writeFileSync(OUT, 'window.ORFF_COUNTS = ' + JSON.stringify(result) + ';\n');
  console.log('Wrote data/counts.js');
}
if (STRICT && failed) process.exit(1);
