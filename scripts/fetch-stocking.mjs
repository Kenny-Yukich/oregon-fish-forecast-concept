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
const sightings = {};
async function collect(urls, seen, rows, now, label, maxEmpty = Infinity) {
  let empty = 0, total = null, previous = null;
  for (const url of urls) {
    let html;
    try { html = await get(url); } catch (e) { if (DEBUG) console.log(`  ${label}: ${e.message}`); break; }
    total ??= Number((/of\s+([\d,]+)\s+(?:results|items|entries)/i.exec(html)?.[1] || /([\d,]+)\s+results/i.exec(html)?.[1] || '').replace(/,/g, '')) || null;
    const found = rowsFrom(html, now, false);
    const signature = found.map(r => r.week_start + r.odfw_name + r.total).join('|');
    for (const r of found) { const k = r.week_start + '|' + r.odfw_name + '|' + r.zone + '|' + r.total; (sightings[label] ??= new Map()).set(k, [...(sightings[label].get(k) || []), urls.indexOf(url)]); }
    const fresh = found.filter(r => { const k = r.week_start + '|' + r.odfw_name + '|' + r.zone + '|' + r.total; if (seen.has(k)) return false; seen.add(k); return true; });
    rows.push(...fresh);
    if (DEBUG) console.log(`  ${label} ${url.replace(/^https:\/\/myodfw\.com/, '')}: ${found.length} rows, ${fresh.length} new`);
    if (!found.length || signature === previous || (total && seen.size >= total)) break;
    previous = signature;
    empty = fresh.length ? 0 : empty + 1;
    if (empty >= maxEmpty) break;
  }
  if (DEBUG && total) console.log(`  ${label}: page says ${total} results`);
  return total;
}

async function scrape(now) {
  const rows = [], seen = new Set();
  const pages = (base, n) => Array.from({length: n}, (_, i) => i ? `${base}${base.includes('?') ? '&' : '?'}page=${i}` : base);
  await collect(pages(PRINT, 20), seen, rows, now, 'print pages', 2);
  const total = await collect(pages(PAGE, 60), seen, rows, now, 'schedule pages');
  if (DEBUG) {
    const main = sightings['schedule pages'] || new Map(), print = sightings['print pages'] || new Map();
    const dups = [...main].filter(([, p]) => p.length > 1);
    const samePage = dups.filter(([, p]) => new Set(p).size < p.length).length;
    console.log(`  diagnostics: main pages listed ${[...main.values()].reduce((t, p) => t + p.length, 0)} rows, ${main.size} unique; ${dups.length} repeated (${samePage} within one page, ${dups.length - samePage} across pages)`);
    for (const [k, p] of dups.slice(0, 6)) console.log(`    repeat: ${k} on pages ${p.join(', ')}`);
    const printOnly = [...print.keys()].filter(k => !main.has(k));
    console.log(`  diagnostics: ${printOnly.length} print-view rows never appeared in main pages${printOnly.length ? ', e.g. ' + printOnly.slice(0, 3).join(' ; ') : ''}`);
    try {
      const html = await get(PAGE);
      const form = /<form[^>]*views-exposed-form[\s\S]*?<\/form>/i.exec(html)?.[0] || '';
      const fields = [...form.matchAll(/<(select|input)[^>]*name="([^"]+)"[^>]*>/gi)].map(m => m[2]).filter(n => !/^(form_|op$)/.test(n));
      const zoneSelect = /<select[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/select>/i.exec(form);
      const options = zoneSelect ? [...zoneSelect[2].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/gi)].map(m => m[1] + '=' + decode(m[2])).slice(0, 25) : [];
      console.log(`  filter form fields: ${fields.join(', ') || '(none found)'}`);
      if (zoneSelect) console.log(`  first select "${zoneSelect[1]}" options: ${options.join(' | ')}`);
    } catch (e) { console.log('  filter form unavailable: ' + e.message); }
  }
  // On 2026-10-14 the main schedule paged out to Oct 2027, but 1,019 listed rows held 971 unique ones. A sort
  // with ties can repeat some rows across pages and skip others, so make a second pass in a column sort taken
  // from the table's own header links. New rows from it are rows the first pass missed.
  try {
    const head = await get(PAGE);
    const links = [...head.matchAll(/<th[^>]*>[\s\S]*?<a[^>]+href="([^"]*order=[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)].map(m => ({href: m[1].replace(/&amp;/g, '&'), text: decode(m[2])}));
    if (DEBUG) console.log('  sortable columns: ' + (links.map(l => l.text + ' -> ' + l.href).join(' , ') || '(none)'));
    const pick = links.find(l => /water/i.test(l.text)) || links[0];
    if (pick) {
      const base = new URL(pick.href, PAGE).toString().replace(/[?&]page=\d+/, '');
      const before = rows.length;
      await collect(pages(base, 60), seen, rows, now, 'second pass');
      console.log(`  second pass added ${rows.length - before} rows the first pass missed`);
    }
  } catch (e) { console.log('  second pass skipped: ' + e.message); }
  return {rows, source: PAGE, total};
}

const now = new Date();
let previous = {rows: []};
if (existsSync(OUT)) {
  try { previous = JSON.parse(readFileSync(OUT, 'utf8').replace(/^window\.ORFF_STOCKING = /, '').replace(/;\s*$/, '')); } catch {}
}
let scraped = [], source = PAGE, pageTotal = null;
try {
  ({rows: scraped, source, total: pageTotal} = await scrape(now));
  console.log(`ODFW schedule: ${scraped.length} rows` + (pageTotal ? ` (page reports ${pageTotal})` : ''));
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
  writeFileSync(OUT, 'window.ORFF_STOCKING = ' + JSON.stringify({source: PAGE, fetched_at: now.toISOString(), keep_days: KEEP_DAYS, rows}) + ';\n');
  console.log(`Wrote data/stocking.js (${rows.length} rows)`);
}
if (STRICT && !scraped.length) process.exit(1);
