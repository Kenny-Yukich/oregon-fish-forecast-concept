// Collects new angler posts from public Facebook groups and TikTok (via Apify), has Claude read them, and merges
// the fishing reports into data/angler.js. Run weekly by .github/workflows/angler-posts.yml. Node 18+.
// Needs APIFY_TOKEN and ANTHROPIC_API_KEY. Without them, or when a step fails, the existing file is kept.
// STRICT=1 exits non-zero on failure instead of keeping the old file.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const OUT = new URL('../data/angler.js', import.meta.url);
const SEEN = new URL('../data/angler-seen.json', import.meta.url);
const STRICT = process.env.STRICT === '1';
const WINDOW_DAYS = 30;      // posts stay on the site this long
const SEEN_DAYS = 45;        // how long post links are remembered so they are not read twice
const MAX_LOOKBACK = 15;     // after a missed week, catch up on at most this many days
const MODEL = 'claude-opus-5-5';

export const GROUPS = [
  {label: 'Oregon Fishing (public Facebook group, about 38,000 people)', url: 'https://www.facebook.com/groups/1552453421736697/'},
  {label: 'Oregon Fishing Network (public Facebook group, about 4,000 people)', url: 'https://www.facebook.com/groups/474041098053000/'},
  {label: 'Rogue River, Chetco River, Elk River, & Sixes River Fishing Reports (public Facebook group, about 11,500 people)', url: 'https://www.facebook.com/groups/672427923442117/'}
];
export const TIKTOK = {hashtags: ['oregonfishing'], profiles: ['getrightkell', 'outdoorguy35']};
const SOURCES = [...GROUPS, {label: 'TikTok #oregonfishing and Oregon fishing creators', url: 'https://www.tiktok.com/tag/oregonfishing'}];

const pacificDate = d => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Los_Angeles'}).format(new Date(d));
const daysAgo = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

/* ---------- Apify ---------- */
async function runActor(actor, input, maxUsd) {
  const base = 'https://api.apify.com/v2', headers = {Authorization: 'Bearer ' + process.env.APIFY_TOKEN, 'Content-Type': 'application/json'};
  let res = await fetch(`${base}/acts/${actor.replace('/', '~')}/runs?waitForFinish=60&maxTotalChargeUsd=${maxUsd}`, {method: 'POST', headers, body: JSON.stringify(input)});
  if (!res.ok) throw new Error(`${actor}: start failed, HTTP ${res.status}`);
  let run = (await res.json()).data;
  const deadline = Date.now() + 12 * 60 * 1000;
  while (!['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(run.status)) {
    if (Date.now() > deadline) throw new Error(`${actor}: still ${run.status} after 12 minutes`);
    res = await fetch(`${base}/actor-runs/${run.id}?waitForFinish=60`, {headers});
    if (!res.ok) throw new Error(`${actor}: status check failed, HTTP ${res.status}`);
    run = (await res.json()).data;
  }
  if (run.status !== 'SUCCEEDED') throw new Error(`${actor}: run ${run.status}`);
  res = await fetch(`${base}/datasets/${run.defaultDatasetId}/items?clean=true&format=json&limit=2000`, {headers});
  if (!res.ok) throw new Error(`${actor}: results failed, HTTP ${res.status}`);
  return res.json();
}

/* ---------- Normalizing ---------- */
const textOf = v => (typeof v === 'string' ? v : '').trim();
export function fromFacebook(it) {
  const comments = (Array.isArray(it.topComments) ? it.topComments : []).map(c => textOf(c?.text)).filter(Boolean).slice(0, 5);
  return {platform: 'Facebook', source: it.groupTitle || 'Facebook group', date: pacificDate(it.time), url: it.url,
    text: [textOf(it.text), textOf(it.sharedPost?.text)].filter(Boolean).join('\n\n'), location: '', comments};
}
export function fromTikTok(it) {
  const loc = [it.locationMeta?.locationName, it.locationMeta?.city].filter(Boolean);
  return {platform: 'TikTok', source: it.authorMeta?.name ? 'TikTok creator' : 'TikTok', date: pacificDate(it.createTimeISO || it.createTime * 1000), url: it.webVideoUrl,
    text: textOf(it.text), location: [...new Set(loc)].join(', '), comments: []};
}
// Photo-only posts with no text or location tag cannot be read, so they are skipped.
export const readable = p => p.url && p.date && (p.text.length > 3 || p.location);

/* ---------- Claude ---------- */
const REPORT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['reports'],
  properties: {reports: {type: 'array', items: {
    type: 'object', additionalProperties: false,
    required: ['url', 'water_id', 'elsewhere_water', 'kind', 'where', 'note', 'signal', 'scoring'],
    properties: {
      url: {type: 'string'},
      water_id: {type: 'string'},
      elsewhere_water: {type: 'string'},
      kind: {type: 'string', enum: ['catch', 'guide', 'conditions', 'mention']},
      where: {type: 'string'},
      note: {type: 'string'},
      signal: {type: 'string', enum: ['positive', 'mixed', 'negative', 'neutral']},
      scoring: {type: 'boolean'}
    }
  }}}
};

export function systemPrompt(waters, elsewhereNames) {
  const list = waters.map(w => `- ${w.id}: ${w.name}, ${w.reach} (${w.region}; ${w.kind}; ${w.planning.target_species.join(', ')})`).join('\n');
  return `You read public social media posts from Oregon and Southwest Washington anglers for a fishing guide website and pick out real fishing reports.

The guide covers these waters. Each is one named reach or lake:
${list}

For each post that reports fishing on an identifiable water (a catch, a guide's report of how fishing is going, or conditions such as water level, temperature or ramp status), return one report. Leave out everything else: gear sales, questions, ads that only list open seats or prices, memes, welcome posts, and posts from outside Oregon and Southwest Washington.

Fields:
- url: the post's url, exactly as given.
- water_id: the guide water the post is about, or "none". Match on the river or lake, then judge the section. A post on the same river but clearly a different section still gets that water_id, with the section described in "where". Only use ids from the list.
- elsewhere_water: when the post is about a water or a section that is not one of the guide's reaches, a short common name for it (for example "Alsea and Yaquina", "Deschutes in and near Bend", "Columbia estuary (Astoria, Buoy 10)"). Reuse one of these names when it fits: ${elsewhereNames.join('; ') || '(none yet)'}. Otherwise "".
- kind: catch, guide (a guide or charter describing the fishing), conditions, or mention (secondhand or indirect).
- where: "" when the post is on the guide's reach. Otherwise say where it was relative to the reach, briefly, for example "Tidewater, below this reach", "Rogue, section not stated", "Tagged at Detroit Lake".
- note: one short, plain sentence summarizing the report, at most 25 words. Paraphrase. No names, usernames, business names, phone numbers or prices. Write it so a reader learns what was caught or what conditions were like.
- signal: positive (fish caught, fishing good), mixed (slow but some fish), negative (skunked, poor), or neutral (conditions only).
- scoring: true only when kind is catch or guide, the post is on this guide reach or does not say which section of this water, and it describes fishing in the few days before it was posted. Otherwise false.

A post can name more than one water; return the most specific one. Return an empty list when nothing qualifies.`;
}

async function readPosts(posts, waters, elsewhereNames) {
  const client = new Anthropic();
  const reports = [];
  for (let i = 0; i < posts.length; i += 60) {
    const batch = posts.slice(i, i + 60).map(p => ({url: p.url, date: p.date, platform: p.platform, source: p.source, location_tag: p.location, text: p.text.slice(0, 2500), top_comments: p.comments}));
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {effort: 'medium', format: {type: 'json_schema', schema: REPORT_SCHEMA}},
      system: systemPrompt(waters, elsewhereNames),
      messages: [{role: 'user', content: 'Posts as JSON:\n' + JSON.stringify(batch)}]
    });
    if (response.stop_reason === 'refusal') throw new Error('Claude declined the batch: ' + (response.stop_details?.category || 'no category'));
    if (response.stop_reason === 'max_tokens') throw new Error('Claude ran out of output tokens on a batch');
    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    reports.push(...JSON.parse(text).reports);
  }
  return reports;
}

/* ---------- Merging ---------- */
export function loadCurrent(src) {
  const win = {};
  new Function('window', src)(win);
  return win.ORFF_ANGLER || {};
}
export function merge(current, posts, reports, waterIds, today, readCounts) {
  const byUrl = new Map(posts.map(p => [p.url, p]));
  const start = daysAgo(today, WINDOW_DAYS);
  const waters = {};
  for (const [id, list] of Object.entries(current.waters || {})) waters[id] = list.filter(p => p.date >= start);
  const elsewherePosts = (current.elsewhere_posts || []).filter(p => p.date >= start);
  const known = new Set([...Object.values(waters).flat(), ...elsewherePosts].map(p => p.url));
  let added = 0;
  for (const r of reports) {
    const post = byUrl.get(r.url);
    if (!post || known.has(r.url) || post.date < start || !r.note.trim()) continue;
    const id = waterIds.has(r.water_id) ? r.water_id : null;
    if (id) {
      (waters[id] ||= []).push({date: post.date, platform: post.platform, kind: r.kind, where: r.where.trim(), note: r.note.trim(), signal: r.signal,
        scoring: r.scoring && (r.kind === 'catch' || r.kind === 'guide'), url: post.url});
      added++;
    }
    if (r.elsewhere_water.trim()) { elsewherePosts.push({date: post.date, water: r.elsewhere_water.trim(), note: r.note.trim(), url: post.url}); if (!id) added++; }
    known.add(r.url);
  }
  for (const id of Object.keys(waters)) { waters[id].sort((a, b) => b.date.localeCompare(a.date)); if (!waters[id].length) delete waters[id]; }
  elsewherePosts.sort((a, b) => b.date.localeCompare(a.date));
  // One row per water: newest note, number of posts (used for ordering) and latest date.
  const groups = new Map();
  for (const p of elsewherePosts) {
    const key = p.water.toLowerCase();
    if (!groups.has(key)) groups.set(key, {water: p.water, note: p.note, posts: 0, latest: p.date});
    groups.get(key).posts++;
  }
  // Posts read, by the day they were posted. Each run only counts posts it has not seen before, so days add up.
  const log = new Map((current.read_log || []).filter(r => r.date >= start).map(r => [r.date, {...r}]));
  for (const [date, c] of Object.entries(readCounts || {})) {
    if (date < start) continue;
    const row = log.get(date) || {date, facebook_posts: 0, tiktok_videos: 0};
    row.facebook_posts += c.facebook_posts || 0; row.tiktok_videos += c.tiktok_videos || 0;
    log.set(date, row);
  }
  const readLog = [...log.values()].sort((a, b) => a.date.localeCompare(b.date));
  const reviewed = readLog.reduce((t, r) => ({facebook_posts: t.facebook_posts + (r.facebook_posts || 0), tiktok_videos: t.tiktok_videos + (r.tiktok_videos || 0)}), {facebook_posts: 0, tiktok_videos: 0});
  return {data: {checked_on: today, window_start: start, reviewed, sources: SOURCES, waters, elsewhere: [...groups.values()].sort((a, b) => b.posts - a.posts || b.latest.localeCompare(a.latest)), elsewhere_posts: elsewherePosts, read_log: readLog}, added};
}

export function render(data) {
  return `/* Angler posts: word of mouth from public social media. Written by scripts/fetch-angler.mjs; edit that script, not this file.
   Posts from public Facebook groups and TikTok are collected with Apify and read by Claude every week.
   - Summaries are short and general. No names, handles or photos.
   - \`where\` says when a post was on another section of the river or did not say where on the river it was.
   - \`scoring: true\` only for a catch or guide report on this water, with the section unstated or on this reach.
     Angler posts can only raise a score, never lower it (see assets/member-preview.js), and only for 14 days.
   - Posts stay for ${WINDOW_DAYS} days. \`elsewhere\` lists waters anglers talked about that are not in the guide yet.
   - \`read_log\` counts the posts read, by the day they were posted; \`reviewed\` is the total for the last ${WINDOW_DAYS} days. */
window.ORFF_ANGLER = ${JSON.stringify(data, null, 2)};
`;
}

/* ---------- Main ---------- */
async function main() {
  if (!process.env.APIFY_TOKEN || !process.env.ANTHROPIC_API_KEY) {
    console.log('Angler posts: APIFY_TOKEN or ANTHROPIC_API_KEY is not set. Keeping the existing data/angler.js.');
    if (STRICT) process.exit(1);
    return;
  }
  const today = pacificDate(Date.now());
  const win = {};
  new Function('window', readFileSync(new URL('../data/waters.js', import.meta.url), 'utf8'))(win);
  const waters = win.ORFF_DATA.waters;
  const current = loadCurrent(readFileSync(OUT, 'utf8'));
  const seen = existsSync(SEEN) ? JSON.parse(readFileSync(SEEN, 'utf8')) : {};
  // Back to the last run plus a day of overlap (at least two days), so nothing posted between runs is skipped.
  const since = current.checked_on ? Math.round((Date.parse(today) - Date.parse(current.checked_on)) / 864e5) : 0;
  const lookback = Math.min(MAX_LOOKBACK, Math.max(2, since + 1));
  const oldest = daysAgo(today, lookback);

  const posts = [];
  let collected = 0;
  try {
    const fb = await runActor('apify/facebook-groups-scraper', {startUrls: GROUPS.map(g => ({url: g.url})), resultsLimit: 60 * lookback, viewOption: 'CHRONOLOGICAL', onlyPostsNewerThan: `${lookback} days`}, 2);
    posts.push(...fb.map(fromFacebook));
    collected++;
    console.log(`Facebook: ${fb.length} posts from ${GROUPS.length} groups, last ${lookback} days`);
  } catch (e) { console.log('Facebook failed: ' + e.message); }
  try {
    const tt = await runActor('clockworks/tiktok-scraper', {hashtags: TIKTOK.hashtags, profiles: TIKTOK.profiles, profileSorting: 'latest', oldestPostDateUnified: `${lookback} days`, resultsPerPage: 30, commentsPerPost: 0,
      shouldDownloadVideos: false, shouldDownloadCovers: false, shouldDownloadAvatars: false, shouldDownloadMusicCovers: false, shouldDownloadSlideshowImages: false}, 1);
    posts.push(...tt.filter(t => t.webVideoUrl).map(fromTikTok));
    collected++;
    console.log(`TikTok: ${tt.length} videos`);
  } catch (e) { console.log('TikTok failed: ' + e.message); }
  if (!collected) {
    console.log('No posts collected. Keeping the existing data/angler.js.');
    if (STRICT) process.exit(1);
    return;
  }

  // The look-back overlaps the last run, so posts already seen are dropped before counting and reading.
  // Older posts (pinned posts, popular hashtag videos) are left out too.
  const unseen = [...new Map(posts.filter(p => p.url && p.date >= oldest).map(p => [p.url, p])).values()].filter(p => !seen[p.url]);
  const counts = {};
  for (const p of unseen) { const c = counts[p.date] ||= {facebook_posts: 0, tiktok_videos: 0}; c[p.platform === 'TikTok' ? 'tiktok_videos' : 'facebook_posts']++; }
  const fresh = unseen.filter(readable);
  console.log(`${unseen.length} new posts, ${fresh.length} with text to read`);
  let reports = [];
  if (fresh.length) {
    try {
      const elsewhereNames = (current.elsewhere || []).map(e => e.water);
      reports = await readPosts(fresh, waters, elsewhereNames);
      console.log(`Claude found ${reports.length} reports`);
    } catch (e) {
      console.log('Reading posts failed: ' + (e instanceof Anthropic.APIError ? `API ${e.status} ${e.message}` : e.message) + '. Keeping the existing file.');
      if (STRICT) process.exit(1);
      return;
    }
  }
  const {data, added} = merge(current, fresh, reports, new Set(waters.map(w => w.id)), today, counts);
  for (const r of reports) {
    const tag = r.water_id !== 'none' ? r.water_id : r.elsewhere_water || 'none';
    console.log(`  ${tag}: ${r.note}${r.where ? ' (' + r.where + ')' : ''}${r.scoring ? ' [scores]' : ''}`);
  }
  for (const p of unseen) seen[p.url] = today;
  for (const [url, date] of Object.entries(seen)) if (date < daysAgo(today, SEEN_DAYS)) delete seen[url];
  writeFileSync(OUT, render(data));
  writeFileSync(SEEN, JSON.stringify(seen, null, 0) + '\n');
  console.log(`Wrote data/angler.js: ${added} new, ${Object.values(data.waters).flat().length} guide-water posts, ${data.elsewhere.length} other waters`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.log('Angler posts failed: ' + e.message); process.exit(STRICT ? 1 : 0); });
