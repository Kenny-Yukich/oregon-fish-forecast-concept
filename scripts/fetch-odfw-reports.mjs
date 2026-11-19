// Reads ODFW's weekly fishing report for every zone and writes data/odfw-reports.js for Eddy, the AI fishing
// assistant (server/context.mjs). The reports name many waters the guide does not cover yet.
// Run daily by .github/workflows/daily-data.yml. Node 18+. No API key and no AI: the text is ODFW's own words.
// Most report pages carry no date, so each zone records the day its text last changed (`changed_on`).
// A zone that fails keeps its previous text. STRICT=1 exits non-zero when any zone fails (used on pull requests).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const OUT = new URL('../data/odfw-reports.js', import.meta.url);
const STRICT = process.env.STRICT === '1';
const BASE = 'https://myodfw.com/recreation-report/fishing-report/';
export const ZONES = {
  'northwest-zone': 'Northwest Zone', 'southwest-zone': 'Southwest Zone', 'willamette-zone': 'Willamette Zone',
  'central-zone': 'Central Zone', 'northeast-zone': 'Northeast Zone', 'southeast-zone': 'Southeast Zone',
  'columbia-zone': 'Columbia Zone', 'marine-zone': 'Marine Zone'
};
const MAX_CHARS = 8000;   // a zone's text is cut here so one long page cannot crowd out the rest
const HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; OregonFishForecast/1.0; +https://oregonfishforecast.com/)', Accept: 'text/html'};
const pacificDate = d => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Los_Angeles'}).format(new Date(d));
const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';

const ENTITIES = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…'};
const decode = s => s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENTITIES[e.toLowerCase()] ?? m);

// The report itself: the page's "Recreation Report" field, without its photo, caption, label or sign-up box.
export function reportText(html) {
  const start = html.search(/<div[^>]*field--name-field-recreation-report[^>]*>/i);
  if (start < 0) return null;
  const end = html.slice(start).search(/<div[^>]*field--name-field-regulation-updates[^>]*>/i);
  const part = end > 0 ? html.slice(start, start + end) : html.slice(start, start + 60000);
  const text = decode(part
    .replace(/<(script|style|noscript|svg|form|figure|figcaption)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<div[^>]*field__label[^>]*>[\s\S]*?<\/div>/i, ' ')
    .replace(/<h([1-6])[^>]*>/gi, '\n\n').replace(/<li[^>]*>/gi, '\n- ').replace(/<(td|th)[^>]*>/gi, ' | ')
    .replace(/<br\s*\/?>|<\/(p|div|h[1-6]|li|tr|table|ul|ol)>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .split('\n').map(l => l.replace(/[\s​-‍⁠﻿]+/g, ' ').trim()).filter(Boolean)
    .filter(l => !/^(Subscribe|Recreation Report)$/i.test(l) && !/^Get the .* in your inbox$/i.test(l) && !/^Photo by /i.test(l))
    .join('\n').trim();
  return text || null;
}

// A date written in the report ("November 13, 2026"), when the page has one: the first one that is not after
// the day it was read, so a deadline such as "good through April 30, 2027" is never taken for the report's date.
export function writtenDate(text, today = pacificDate(Date.now())) {
  const re = new RegExp('\\b(' + MONTHS + ')\\.?\\s+(\\d{1,2}),\\s*(20\\d\\d)\\b', 'g');
  for (const m of text.matchAll(re)) {
    const d = new Date(`${m[1]} ${m[2]}, ${m[3]} 12:00 UTC`);
    if (!Number.isNaN(+d) && d.toISOString().slice(0, 10) <= today) return d.toISOString().slice(0, 10);
  }
  return null;
}

async function main() {
  const today = pacificDate(Date.now());
  let previous = {};
  if (existsSync(OUT)) {
    try { const w = {}; new Function('window', readFileSync(OUT, 'utf8'))(w); previous = w.ORFF_ODFW_REPORTS?.zones || {}; }
    catch (e) { console.log('Previous odfw-reports.js unreadable: ' + e.message); }
  }
  const zones = {};
  let failed = 0;
  for (const [slug, name] of Object.entries(ZONES)) {
    const url = BASE + slug, old = previous[slug];
    try {
      const res = await fetch(url, {headers: HEADERS, redirect: 'follow'});
      if (!res.ok) throw new Error('HTTP ' + res.status);
      let text = reportText(await res.text());
      if (!text) throw new Error('no report text found on the page');
      if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS).replace(/\s+\S*$/, '') + ' …';
      const hash = createHash('sha256').update(text).digest('hex').slice(0, 16);
      zones[slug] = {name, url, text, dated: writtenDate(text, today), changed_on: old?.hash === hash ? old.changed_on : today, read_on: today, hash};
      console.log(`${name}: ${text.length} characters${old?.hash === hash ? ', unchanged' : ', new text'}`);
    } catch (e) {
      failed++;
      console.log(`${name} failed: ${e.message}.${old ? ' Keeping its previous text.' : ''}`);
      if (old) zones[slug] = old;
    }
  }
  if (!Object.keys(zones).length) { console.log('No zone report read. Leaving data/odfw-reports.js as it was.'); process.exit(STRICT ? 1 : 0); }
  const header = `/* ODFW's weekly fishing reports by zone, in ODFW's own words, for Eddy (server/context.mjs).
   Written by scripts/fetch-odfw-reports.mjs every morning; edit that script, not this file.
   - text: the report as published. dated: a date written in the report, when it has one.
   - changed_on: the first day this exact text was read (most pages carry no date). read_on: the last successful read. */\n`;
  writeFileSync(OUT, header + 'window.ORFF_ODFW_REPORTS = ' + JSON.stringify({checked_on: today, source: 'https://myodfw.com/recreation-report/fishing-report', zones}) + ';\n');
  console.log(`Wrote data/odfw-reports.js: ${Object.keys(zones).length} zones${failed ? `, ${failed} failed` : ''}.`);
  if (STRICT && failed) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
