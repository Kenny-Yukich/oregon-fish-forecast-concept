// Reads ODFW's weekly trout stocking schedule and writes data/stocking.js.
// Past weeks drop off ODFW's page, so rows are merged into the existing file and kept for 8 weeks.
// Run by .github/workflows/daily-data.yml. Node 18+, no dependencies.
// STRICT=1 exits non-zero when no rows can be read (used on pull requests); DEBUG=1 logs page structure.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const OUT = new URL('../data/stocking.js', import.meta.url);
const PAGE = 'https://myodfw.com/fishing/species/trout/stocking-schedule';
// The print view lists the whole schedule; the main page shows 50 rows at a time.
const PRINT = 'https://myodfw.com/fishing/species/trout/stocking-schedule-print';
const KEEP_DAYS = 56;
const STRICT = process.env.STRICT === '1', DEBUG = process.env.DEBUG === '1' || STRICT;
const UA = {'user-agent': 'oregon-fish-forecast-concept (GitHub Actions; daily stocking snapshot)'};
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const COLUMNS = {
  waterbody: h => /water/.test(h),
  zone: h => /(zone|office|district|region)/.test(h),
  week: h => /(week|date)/.test(h),
  legals: h => /legal/.test(h),
  larger: h => /larger/.test(h),
  pounders: h => /pound/.test(h),
  trophy: h => /trophy/.test(h),
  brood: h => /brood/.test(h),
  fingerling: h => /finger/.test(h),
  total: h => /total/.test(h)
};

const decode = s => s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/\s+/g, ' ').trim();

function tables(html) {
  return [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map(m => {
    const rows = [...m[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(r => [...r[0].matchAll(/<t([hd])[^>]*>([\s\S]*?)<\/t\1>/gi)].map(c => ({th: c[1].toLowerCase() === 'h', text: decode(c[2])})));
    return rows.filter(r => r.length);
  });
}

// "Oct. 12-16, 2026", "October 12 - 16", "Oct 30 - Nov 3, 2026", "10/12/2026", "2026-10-12"
function weekStart(label, now) {
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(label);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(label);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  m = /([a-z]{3})[a-z]*\.?\s+(\d{1,2})/i.exec(label);
  if (!m) return null;
  const mi = MONTHS.indexOf(m[1].toLowerCase());
  if (mi < 0) return null;
  const y = /(\d{4})/.exec(label)?.[1];
  let year = y ? +y : now.getUTCFullYear();
  if (!y) { const diff = mi - now.getUTCMonth(); if (diff > 6) year--; else if (diff < -6) year++; }
  return `${year}-${String(mi + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

// ODFW writes names in capitals with abbreviations ("EMPIRE LK, UPR", "N FK SANTIAM R").
const ABBR = {LK: 'Lake', LKS: 'Lakes', PD: 'Pond', PDS: 'Ponds', RES: 'Reservoir', R: 'River', CR: 'Creek', CRK: 'Creek', FK: 'Fork',
  NF: 'North Fork', SF: 'South Fork', MF: 'Middle Fork', N: 'North', S: 'South', E: 'East', W: 'West', M: 'Middle', MID: 'Middle',
  UPR: 'Upper', UP: 'Upper', LWR: 'Lower', LW: 'Lower', SL: 'Slough', PK: 'Park', CN: 'Canal'};
const QUALIFIERS = /^(Upper|Lower|North|South|East|West|Middle)$/;
const titleWord = w => w.toLowerCase().replace(/(^|[-'(])([a-z])/g, (_, a, b) => a + b.toUpperCase()).replace(/^Mc([a-z])/, (_, c) => 'Mc' + c.toUpperCase());
function cleanName(raw) {
  if (raw !== raw.toUpperCase()) return raw; // already in normal case
  const expand = part => part.trim().split(/\s+/).map(t => ABBR[t.replace(/\.$/, '')] || titleWord(t)).join(' ');
  const [main, ...rest] = raw.split(',').map(expand);
  const quals = rest.filter(r => QUALIFIERS.test(r)), other = rest.filter(r => !QUALIFIERS.test(r));
  return [...quals, main].join(' ') + (other.length ? ' (' + other.join(', ') + ')' : '');
}

const num = s => { const n = Number(String(s ?? '').replace(/[,\s]/g, '')); return Number.isFinite(n) && String(s ?? '').trim() !== '' ? n : 0; };

function rowsFrom(html, now, log = true) {
  const out = [];
  for (const [ti, t] of tables(html).entries()) {
    const hi = t.findIndex(r => r.some(c => /water/i.test(c.text)) && r.some(c => /(legal|trophy|total|brood|finger)/i.test(c.text)));
    if (DEBUG && log) console.log(`  table ${ti}: ${t.length} rows; header row ${hi}: ${hi >= 0 ? t[hi].map(c => c.text).join(' | ') : '(none)'}${t[hi + 1] ? '\n    first row: ' + t[hi + 1].map(c => c.text).join(' | ') : ''}`);
    if (hi < 0) continue;
    const header = t[hi].map(c => c.text.toLowerCase());
    const col = {};
    for (const [k, test] of Object.entries(COLUMNS)) { const i = header.findIndex(test); if (i >= 0) col[k] = i; }
    if (col.waterbody == null) continue;
    let carryWeek = null;
    for (const r of t.slice(hi + 1)) {
      const cell = k => col[k] != null ? r[col[k]]?.text ?? '' : '';
      // Some schedules group rows under a single week heading row.
      if (r.length === 1 && weekStart(r[0].text, now)) { carryWeek = r[0].text; continue; }
      const waterbody = cell('waterbody');
      if (!waterbody || /^total/i.test(waterbody)) continue;
      const weekLabel = cell('week') || carryWeek || '';
      const start = weekStart(weekLabel, now);
      if (!start) continue;
      const fish = {legals: num(cell('legals')), larger: num(cell('larger')), pounders: num(cell('pounders')), trophy: num(cell('trophy')), brood: num(cell('brood')), fingerling: num(cell('fingerling'))};
      const sum = Object.values(fish).reduce((a, b) => a + b, 0);
      out.push({week_start: start, week_label: weekLabel, waterbody: cleanName(waterbody), odfw_name: waterbody, zone: cell('zone'), ...fish, total: num(cell('total')) || sum});
    }
  }
  return out;
}

async function get(url) {
  const res = await fetch(url, {headers: UA});
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return text;
}

// Collects every row it can reach and merges them. On 2026-10-14 the print view returned a 500-row window
// and its ?page=N windows overlapped, so no single request was known to hold the whole season.
// Stops when a page is empty, repeats the previous page exactly (the site ignored ?page), reaches the
// total the page reports, or, when maxEmpty is set, after that many pages in a row add nothing new.
async function collect(urls, seen, rows, now, label, maxEmpty = Infinity) {
  let empty = 0, total = null, previous = null;
  for (const url of urls) {
    let html;
    try { html = await get(url); } catch (e) { if (DEBUG) console.log(`  ${label}: ${e.message}`); break; }
    total ??= Number((/of\s+([\d,]+)\s+(?:results|items|entries)/i.exec(html)?.[1] || '').replace(/,/g, '')) || null;
    const found = rowsFrom(html, now, false);
    const signature = found.map(r => r.week_start + r.odfw_name + r.total).join('|');
    const fresh = found.filter(r => add(seen, r));
    rows.push(...fresh);
    if (DEBUG) console.log(`  ${label} ${url.replace(/^https:\/\/myodfw\.com/, '')}: ${found.length} rows, ${fresh.length} new`);
    if (!found.length || signature === previous || (total && seen.size >= total)) break;
    previous = signature;
    empty = fresh.length ? 0 : empty + 1;
    if (empty >= maxEmpty) break;
  }
  return total;
}
const rowKey = r => r.week_start + '|' + r.odfw_name + '|' + r.zone + '|' + r.total;
function add(seen, r) { const k = rowKey(r); if (seen.has(k)) return false; seen.add(k); return true; }

// Zone and date filters from the schedule's own filter form (seen 2026-10-14). The print view answers
// these filters with HTTP 400, so slices go to the main schedule page, which lists 50 rows per page.
const ZONES = {1: 'Central', 2: 'Northeast', 3: 'Northwest', 4: 'Southeast', 5: 'Southwest', 6: 'Willamette'};
const PAGE_SIZE = 50;
const iso = d => d.toISOString().slice(0, 10);
const addDaysISO = (d, n) => iso(new Date(Date.parse(d + 'T12:00:00Z') + n * 86400000));
const dow = d => new Date(d + 'T12:00:00Z').getUTCDay();

// One request for a zone and date range, checked against the filter it asked for. Null when ODFW ignored it.
async function slice(zoneId, from, to, now, page = 0) {
  const params = {field_zone_value: zoneId, field_planned_stocking_date_value: from, field_planned_stocking_date_end_value: to};
  if (page) params.page = page;
  const found = rowsFrom(await get(PAGE + '?' + new URLSearchParams(params)), now, false);
  const zoneOk = found.every(r => r.zone.toLowerCase().startsWith(ZONES[zoneId].toLowerCase()));
  const dateOk = found.every(r => r.week_start >= from && r.week_start <= to);
  if (!zoneOk || !dateOk) console.log(`  ${ZONES[zoneId]} ${from}..${to}: ${zoneOk ? '' : 'zone '}${dateOk ? '' : 'date '}filter ignored`);
  return zoneOk && dateOk ? found : null;
}

// Splits a Monday-to-Sunday range in half on a week boundary until each piece fits on one page. ODFW weeks run
// Monday to Friday, so no stocking straddles two pieces. A single week that still fills a page is paged through.
async function sliceRows(zoneId, from, to, now, stats) {
  stats.requests++;
  const found = await slice(zoneId, from, to, now);
  if (found == null) return null;
  if (found.length < PAGE_SIZE) return found;
  const weeks = Math.round((Date.parse(to) - Date.parse(from)) / 604800000);
  if (weeks <= 1) {
    const all = [...found];
    for (let page = 1; page < 10; page++) { stats.requests++; const more = await slice(zoneId, from, to, now, page); if (!more?.length) break; all.push(...more); if (more.length < PAGE_SIZE) break; }
    stats.paged++;
    return all;
  }
  const mid = addDaysISO(from, Math.floor(weeks / 2) * 7 - 1); // a Sunday
  const a = await sliceRows(zoneId, from, mid, now, stats);
  const b = a && await sliceRows(zoneId, addDaysISO(mid, 1), to, now, stats);
  return a && b ? [...a, ...b] : null;
}

async function scrape(now) {
  const rows = [], seen = new Set(), counts = [], stats = {requests: 0, paged: 0};
  // From the Monday 9 weeks back to a Sunday about 15 months ahead; ODFW plans roughly a year out.
  const today = iso(now), monday = addDaysISO(today, -((dow(today) + 6) % 7));
  const from = addDaysISO(monday, -63), to = addDaysISO(monday, 7 * 66 - 1);
  let sliced = true;
  for (const zoneId of Object.keys(ZONES)) {
    let found = null;
    try { found = await sliceRows(zoneId, from, to, now, stats); } catch (e) { console.log(`  ${ZONES[zoneId]} slices failed: ${e.message}`); }
    if (found == null) { sliced = false; break; }
    const fresh = found.filter(r => add(seen, r));
    rows.push(...fresh);
    counts.push(`${ZONES[zoneId]} ${fresh.length}`);
  }
  if (sliced) console.log(`  slices: ${counts.join(', ')} (${stats.requests} requests${stats.paged ? `, ${stats.paged} busy weeks paged` : ''})`);
  else { console.log('  zone and date filters unavailable; using print view and paging only, which can miss rows'); rows.length = 0; seen.clear(); }
  // Safety net: the print view's first 500 rows and the plain 50-row pages. On 2026-10-14 those pages repeated
  // 101 rows and skipped 53, so they cannot be trusted alone, but anything they find is a real row.
  const before = rows.length;
  const pages = (base, n) => Array.from({length: n}, (_, i) => i ? `${base}${base.includes('?') ? '&' : '?'}page=${i}` : base);
  await collect(pages(PRINT, 20), seen, rows, now, 'print pages', 2);
  await collect(pages(PAGE, 60), seen, rows, now, 'schedule pages');
  if (sliced && rows.length > before) console.log(`  WARNING: print view and paging found ${rows.length - before} rows the slices missed`);
  else if (sliced) console.log('  print view and paging found nothing the slices missed');
  return {rows, source: PAGE, method: sliced ? 'zones' : 'paging'};
}

const now = new Date();
let previous = {rows: []};
if (existsSync(OUT)) {
  try { previous = JSON.parse(readFileSync(OUT, 'utf8').replace(/^window\.ORFF_STOCKING = /, '').replace(/;\s*$/, '')); } catch {}
}
let scraped = [], method = null;
try {
  ({rows: scraped, method} = await scrape(now));
  console.log(`ODFW schedule: ${scraped.length} rows (${method === 'zones' ? 'complete, by zone' : 'paging fallback, may be incomplete'})`);
  for (const r of scraped.slice(0, 8)) console.log(`  ${r.week_start} ${r.waterbody} [${r.odfw_name}] (${r.zone}): ${r.total}`);
  console.log(`  weeks: ${[...new Set(scraped.map(r => r.week_start))].join(', ')}`);
} catch (e) { console.log('ODFW schedule FAILED, keeping previous rows: ' + e.message); }

const cutoff = new Date(now.getTime() - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
const key = r => r.week_start + '|' + (r.odfw_name || r.waterbody).toLowerCase() + '|' + (r.zone || '').toLowerCase();
const merged = new Map((previous.rows || []).filter(r => r.week_start >= cutoff).map(r => [key(r), r]));
for (const r of scraped) merged.set(key(r), r); // the current page wins for weeks it still lists
const rows = [...merged.values()].sort((a, b) => a.week_start.localeCompare(b.week_start) || a.waterbody.localeCompare(b.waterbody));
const body = JSON.stringify(rows);
if (body === JSON.stringify(previous.rows || [])) console.log('No change in stocking rows.');
else {
  writeFileSync(OUT, 'window.ORFF_STOCKING = ' + JSON.stringify({source: PAGE, fetched_at: now.toISOString(), keep_days: KEEP_DAYS, method, rows}) + ';\n');
  console.log(`Wrote data/stocking.js (${rows.length} rows)`);
}
if (STRICT && !scraped.length) process.exit(1);
