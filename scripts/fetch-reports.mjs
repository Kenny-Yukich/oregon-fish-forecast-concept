// Reads WDFW's weekly Southwest Washington creel report and ODFW's in-season regulation updates into data/auto-reports.js.
// Run daily by .github/workflows/daily-data.yml. Node 18+. Needs ANTHROPIC_API_KEY; without it the existing file is kept.
// Claude is only called when a source changed: the newest creel PDF has a new address, or the ODFW page text has a new hash.
// A source that fails keeps its previous data. STRICT=1 exits non-zero on any failure.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const OUT = new URL('../data/auto-reports.js', import.meta.url);
const STRICT = process.env.STRICT === '1';
const MODEL = 'claude-opus-5-5';
export const WDFW_URL = 'https://wdfw.wa.gov/fishing/reports/creel/southwest';
export const REGS_URL = 'https://myodfw.com/articles/regulation-updates';
// Guide waters the WDFW creel report can cover. Others are ignored even if Claude returns them.
export const WDFW_WATERS = ['cowlitz-river-kelso-castle-rock', 'cowlitz-river-blue-creek', 'kalama-river-modrow-bridge', 'lewis-river-woodland',
  'toutle-river-tower-road', 'elochoman-river-cathlamet', 'coweeman-river-kelso', 'columbia-river-chinook-landing'];
const REPORT_DAYS = 60;   // creel reports older than this drop off
const RULE_DAYS = 14;     // rules starting within this many days are included
const HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; OregonFishForecast/1.0; +https://kenny-yukich.github.io/oregon-fish-forecast-concept/)', Accept: 'text/html,application/pdf;q=0.9,*/*;q=0.8'};

const pacificDate = d => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Los_Angeles'}).format(new Date(d));
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
// Summaries go on the site as written, so long dashes become plain punctuation.
const plain = s => String(s || '').replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, '$1 to $2').replace(/\s*[\u2013\u2014]\s*/g, ', ').replace(/\s+/g, ' ').trim();

async function get(url, binary) {
  const res = await fetch(url, {headers: HEADERS, redirect: 'follow'});
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return binary ? Buffer.from(await res.arrayBuffer()) : res.text();
}

/* ---------- HTML ---------- */
const ENTITIES = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '\u2013', mdash: '\u2014', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“'};
export const decode = s => s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENTITIES[e.toLowerCase()] ?? m);
const cellText = s => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// Readable text of the page's main region, with headings and list items kept on their own lines.
export function mainText(html) {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html.match(/<body[\s\S]*<\/body>/i)?.[0] || html;
  return decode(main
    .replace(/<(script|style|noscript|svg|form|nav)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<h([1-6])[^>]*>/gi, (m, n) => '\n\n' + '#'.repeat(+n) + ' ').replace(/<li[^>]*>/gi, '\n- ').replace(/<(td|th)[^>]*>/gi, ' | ')
    .replace(/<br\s*\/?>|<\/(p|div|h[1-6]|li|tr|table|ul|ol)>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .split('\n').map(l => l.replace(/[ \t ]+/g, ' ').trim()).join('\n').replace(/^(#+)\n+/gm, '$1 ').replace(/\n{3,}/g, '\n\n').trim();
}

// The newest creel PDF is the first one listed. File names vary, so they are read from the page, never built.
export function newestPdf(html, base = WDFW_URL) {
  const hrefs = [...html.matchAll(/href\s*=\s*["']([^"']+?\.pdf)(?:[?#][^"']*)?["']/gi)].map(m => decode(m[1]));
  const pick = hrefs.find(h => /swwa-fishing-reports.*\.pdf$/i.test(h)) || hrefs.find(h => /\/sites\/default\/files\/.*\.pdf$/i.test(h));
  return pick ? new URL(pick, base).href : null;
}

// WDFW's tributary weir status table, when the page has one. No Claude needed.
export function weirTable(html) {
  const table = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map(m => m[0]).find(t => /weir location/i.test(cellText(t)));
  if (!table) return {rows: [], updated: ''};
  const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(m => [...m[0].matchAll(/<t([dh])[^>]*>([\s\S]*?)<\/t\1>/gi)].map(c => cellText(c[2])));
  const head = rows.shift().map(h => h.toLowerCase());
  const col = re => head.findIndex(h => re.test(h));
  const at = {river: col(/tributary|waterbody|river/), location: col(/location/), status: col(/status/), expected: col(/removal|expected|est\./)};
  const after = html.slice(html.indexOf(table) + table.length, html.indexOf(table) + table.length + 600);
  return {rows: rows.filter(r => r.length > 1).map(r => Object.fromEntries(Object.entries(at).map(([k, i]) => [k, i >= 0 ? r[i] || '' : '']))).filter(r => r.river),
    updated: cellText(after.match(/Last updated\s*(?:<\/strong>)?\s*:?\s*([^<]+)/i)?.[1] || '').replace(/^:\s*/, '')};
}

/* ---------- Claude ---------- */
const SIGNALS = ['positive', 'mixed', 'negative', 'neutral'];
const CREEL_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['reports'],
  properties: {reports: {type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['water_id', 'period', 'reported_on', 'summary', 'coverage', 'signal'],
    properties: {water_id: {type: 'string', enum: WDFW_WATERS}, period: {type: 'string'}, reported_on: {type: 'string'}, summary: {type: 'string'}, coverage: {type: 'string'}, signal: {type: 'string', enum: SIGNALS}}
  }}}
};
const RULES_SCHEMA = waterIds => ({
  type: 'object', additionalProperties: false, required: ['rules'],
  properties: {rules: {type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['water_id', 'summary', 'effective_from', 'effective_to', 'species', 'kind', 'url'],
    properties: {water_id: {type: 'string', enum: waterIds}, summary: {type: 'string'}, effective_from: {type: 'string'}, effective_to: {type: 'string'},
      species: {type: 'array', items: {type: 'string'}}, kind: {type: 'string', enum: ['closure', 'restriction', 'opening', 'other']}, url: {type: 'string'}}
  }}}
});

async function ask(system, content, schema) {
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {effort: 'medium', format: {type: 'json_schema', schema}},
    system,
    messages: [{role: 'user', content}]
  });
  if (response.stop_reason === 'refusal') throw new Error('Claude declined: ' + (response.stop_details?.category || 'no category'));
  if (response.stop_reason === 'max_tokens') throw new Error('Claude ran out of output tokens');
  return JSON.parse(response.content.filter(b => b.type === 'text').map(b => b.text).join(''));
}

export function creelPrompt(waters) {
  const list = waters.map(w => `- ${w.id}: ${w.name}, ${w.reach}`).join('\n');
  return `You read the Washington Department of Fish and Wildlife (WDFW) weekly creel report for Southwest Washington and the lower Columbia River for a fishing guide website.

The guide covers these reaches:
${list}

For each reach whose river the report gives creel numbers for, return one report. Leave out reaches whose river the report does not mention.

Fields:
- water_id: the guide reach, from the list only.
- period: the days the creel checks cover, written plainly, for example "Oct 5 to 11".
- reported_on: the last day of that period as an ISO date (YYYY-MM-DD), not the publication date.
- summary: one plain sentence of at most 30 words with the numbers kept, for example "39 bank anglers kept three coho and released two jacks below the I-5 bridge." When the report splits the river into sections, use the section that best matches the reach, and mention a second section only if it overlaps the reach too. No dashes as punctuation.
- coverage: one short sentence saying which section of the river the numbers cover and how it relates to the guide reach (the same as, part of, broader than, upstream or downstream of it). For the Columbia, name the numbered section used and its relation to the reach.
- signal: positive (fish being kept at a fair rate), mixed (a few fish for the effort), negative (little or no catch for real effort), or neutral (no effort reported or too little to judge).

Return an empty list when nothing qualifies.`;
}

export function rulesPrompt(waters, today) {
  const list = waters.map(w => `- ${w.id}: ${w.name}, ${w.reach} (${w.planning.target_species.join(', ')})`).join('\n');
  return `You read the Oregon Department of Fish and Wildlife (ODFW) in-season regulation updates page for a fishing guide website. Today is ${today}.

The guide covers these Oregon reaches:
${list}

Return the in-season rule changes on the page that are in effect today or start within ${RULE_DAYS} days (on or before ${addDays(today, RULE_DAYS)}), for these reaches only. A rule counts when its boundaries include the guide reach or it applies to the whole river containing the reach. A rule for a different section of the same river, or for a tributary, does not count. Leave out rules that have ended. Return one entry per distinct rule; a rule for several species is one entry.

Fields:
- water_id: the guide reach, from the list only.
- summary: one plain sentence of at most 30 words saying what changed and where, for example "Coho retention closes from the mouth to Pringle Falls; trout rules are unchanged." No dashes as punctuation.
- effective_from: the first day as an ISO date (YYYY-MM-DD). Take the year from the page when a date leaves it out.
- effective_to: the last day as an ISO date, or "" when the rule is open-ended.
- species: the species the rule is about, for example ["Coho salmon"].
- kind: closure (fishing or retention closed), restriction (lower limits, gear, days or areas narrowed), opening (fishing or retention opened or limits raised), or other.
- url: ${REGS_URL} unless the page links a more specific notice for this rule.

Return an empty list when nothing qualifies.`;
}

export function cleanReports(list, pdf, ids) {
  const out = {};
  for (const r of list || []) {
    if (!ids.has(r.water_id) || out[r.water_id] || !ISO.test(r.reported_on) || !plain(r.summary)) continue;
    out[r.water_id] = {water_id: r.water_id, period: plain(r.period), reported_on: r.reported_on, summary: plain(r.summary), coverage: plain(r.coverage),
      signal: SIGNALS.includes(r.signal) ? r.signal : 'neutral', source: 'WDFW creel report', url: pdf};
  }
  return out;
}
export function cleanRules(list, ids, today) {
  const out = {}, last = addDays(today, RULE_DAYS);
  for (const r of list || []) {
    if (!ids.has(r.water_id) || !ISO.test(r.effective_from) || (r.effective_to && !ISO.test(r.effective_to)) || !plain(r.summary)) continue;
    if (r.effective_from > last || (r.effective_to && r.effective_to < today)) continue;
    (out[r.water_id] ||= []).push({water_id: r.water_id, summary: plain(r.summary), effective_from: r.effective_from, effective_to: r.effective_to || '',
      species: (r.species || []).map(plain).filter(Boolean), kind: r.kind, url: /^https:\/\//.test(r.url) ? r.url : REGS_URL});
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  return out;
}

/* ---------- File ---------- */
export const EMPTY = {checked_on: null, sources: {}, reports: {}, rules: {}, weirs: []};
export function loadCurrent(src) {
  const win = {};
  new Function('window', src)(win);
  return {...EMPTY, ...(win.ORFF_AUTO || {})};
}
export function render(data) {
  return `/* Automatic reports and rules. Generated by scripts/fetch-reports.mjs; edit that script, not this file.
   Checked daily. Claude only reads a source when it changed (a new creel PDF, or new text on the ODFW page).
   - reports: one per guide water from WDFW's weekly Southwest Washington creel report (PDF). The site uses one
     instead of the water's own report when it is newer (see assets/member-preview.js).
   - rules: ODFW in-season regulation updates in effect or starting within ${RULE_DAYS} days, per Oregon guide water.
     They show as notices and never withhold a score.
   - weirs: WDFW's tributary weir status table, copied as published. */
window.ORFF_AUTO = ${JSON.stringify(data, null, 2)};
`;
}

/* ---------- Main ---------- */
export async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('Reports: ANTHROPIC_API_KEY is not set. Keeping the existing data/auto-reports.js.');
    if (STRICT) process.exit(1);
    return;
  }
  const today = pacificDate(Date.now());
  const win = {};
  new Function('window', readFileSync(new URL('../data/waters.js', import.meta.url), 'utf8'))(win);
  const waters = win.ORFF_DATA.waters;
  const before = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  const current = before ? loadCurrent(before) : {...EMPTY};
  const next = {...current, sources: {...current.sources}, reports: {...current.reports}, rules: {...current.rules}};
  let checked = 0, failed = 0, calls = 0;

  // A. WDFW creel report. Weirs come from the page itself; the PDF is read only when its address is new.
  try {
    const html = await get(WDFW_URL);
    const weirs = weirTable(html), pdf = newestPdf(html), old = current.sources.wdfw || {};
    if (!pdf) throw new Error('no creel PDF link on the WDFW page');
    let reports = null;
    if (pdf !== old.pdf) {
      const file = await get(pdf, true);
      if (file.subarray(0, 5).toString() !== '%PDF-') throw new Error(pdf + ' is not a PDF');
      const guide = WDFW_WATERS.map(id => waters.find(w => w.id === id)).filter(Boolean);
      calls++;
      const res = await ask(creelPrompt(guide), [{type: 'document', source: {type: 'base64', media_type: 'application/pdf', data: file.toString('base64')}},
        {type: 'text', text: 'Creel report PDF: ' + pdf}], CREEL_SCHEMA);
      reports = cleanReports(res.reports, pdf, new Set(guide.map(w => w.id)));
      console.log(`WDFW: read ${pdf}, ${Object.keys(reports).length} guide waters`);
      for (const r of Object.values(reports)) console.log(`  ${r.water_id} (${r.period}, ${r.signal}): ${r.summary}`);
    } else console.log('WDFW: newest creel PDF unchanged, not read again.');
    if (reports) Object.assign(next.reports, reports);
    for (const [id, r] of Object.entries(next.reports)) if (r.reported_on < addDays(today, -REPORT_DAYS)) delete next.reports[id];
    if (weirs.rows.length) next.weirs = weirs.rows;
    next.sources.wdfw = {url: WDFW_URL, read_on: reports ? today : old.read_on || null, pdf: reports ? pdf : old.pdf || null, weirs_updated: weirs.updated || old.weirs_updated || ''};
    console.log(`WDFW: ${weirs.rows.length} weirs in the status table${weirs.updated ? ', updated ' + weirs.updated : ''}`);
    checked++;
  } catch (e) {
    failed++;
    console.log('WDFW failed: ' + (e instanceof Anthropic.APIError ? `API ${e.status} ${e.message}` : e.message) + '. Keeping its previous data.');
  }

  // B. ODFW regulation updates. The page's main text is hashed; Claude reads it only when the hash changes.
  try {
    const text = mainText(await get(REGS_URL));
    if (text.length < 500) throw new Error('the ODFW page has almost no text');
    const hash = createHash('sha256').update(text).digest('hex'), old = current.sources.odfw_regs || {};
    if (hash !== old.hash) {
      const oregon = waters.filter(w => w.region !== 'Southwest Washington');
      calls++;
      const res = await ask(rulesPrompt(oregon, today), 'ODFW regulation updates page (' + REGS_URL + '), as text:\n\n' + text.slice(0, 120000), RULES_SCHEMA(oregon.map(w => w.id)));
      next.rules = cleanRules(res.rules, new Set(oregon.map(w => w.id)), today);
      next.sources.odfw_regs = {url: REGS_URL, hash, read_on: today};
      const all = Object.values(next.rules).flat();
      console.log(`ODFW: page changed, ${all.length} rules for ${Object.keys(next.rules).length} guide waters`);
      for (const r of all) console.log(`  ${r.water_id} (${r.kind}, ${r.effective_from} to ${r.effective_to || 'open'}): ${r.summary}`);
    } else console.log('ODFW: regulation updates unchanged, not read again.');
    // Rules that have ended drop off between reads.
    for (const [id, list] of Object.entries(next.rules)) { next.rules[id] = list.filter(r => !r.effective_to || r.effective_to >= today); if (!next.rules[id].length) delete next.rules[id]; }
    checked++;
  } catch (e) {
    failed++;
    console.log('ODFW failed: ' + (e instanceof Anthropic.APIError ? `API ${e.status} ${e.message}` : e.message) + '. Keeping its previous data.');
  }

  if (!checked) {
    console.log('No source could be read. Keeping the existing data/auto-reports.js.');
    if (STRICT) process.exit(1);
    return {calls, failed};
  }
  next.checked_on = today;
  writeFileSync(OUT, render(next));
  console.log(`Wrote data/auto-reports.js: ${Object.keys(next.reports).length} creel reports, ${Object.values(next.rules).flat().length} rules, ${next.weirs.length} weirs, ${calls} Claude ${calls === 1 ? 'call' : 'calls'}`);
  if (failed && STRICT) process.exit(1);
  return {calls, failed};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.log('Reports failed: ' + e.message); process.exit(STRICT ? 1 : 0); });
