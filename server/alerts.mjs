// Water alerts: pass holders (and the owner) follow waters and get one email a morning when something new
// happens on them. The facts come from the same data files the site and Eddy read (context.mjs loads them).
//
// What counts as news, per water ("kinds", each can be turned off):
//   stocking  ODFW plans trout for this week or next (guide waters and every water on ODFW's schedule)
//   score     the site's score turns Good, or Excellent
//   flow      the NOAA river forecast shows a big rise coming (a blowout heads-up)
//   rules     a new ODFW in-season rule or a notice on the water's page
//   weather   a National Weather Service alert covering the water
//   reports   ODFW's weekly zone report has new text that names the water
//
// Each follower keeps a "seen" list per water: fact keys and the day they were sent. A fact is sent once. It can
// be sent again only after it has gone away and a week has passed, so a score that wobbles across a line does
// not send an email every day. A newly followed water starts with everything current marked seen.
import {createHmac, timingSafeEqual} from 'node:crypto';
import {clientIp, sha256, windowLimiter} from './access.mjs';

export const KINDS = {
  stocking: 'Stocking planned',
  score: 'Score turns Good or better',
  flow: 'Big rise in the river forecast',
  rules: 'New ODFW rules and notices',
  weather: 'Weather alerts',
  reports: 'ODFW weekly report mentions it'
};
export const MAX_WATERS = 20;
const SEEN_DAYS = 7;
const TESTS_PER_DAY = 3;

const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);
const num = n => Math.round(n).toLocaleString('en-US');
const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const hash = s => sha256(s).slice(0, 12);
const pacificDay = ms => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Los_Angeles'}).format(new Date(ms));
const shortDay = iso => new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'});
const weekday = t => new Date(t).toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles'});
const reEscape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function mondayOf(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/* ---------- What can be followed ---------- */
// Guide waters by id; any other water on ODFW's stocking schedule as "s:<name>".
export function followables(g) {
  const out = new Map();
  for (const w of g.ORFF_DATA.waters) out.set(w.id, {key: w.id, name: w.name, detail: w.reach, guide: w});
  for (const r of g.ORFF_STOCKING?.rows || []) {
    const key = 's:' + r.waterbody;
    if (!out.has(key)) out.set(key, {key, name: r.waterbody, detail: 'ODFW stocking schedule' + (r.zone ? ', ' + r.zone.split('/')[0].trim() : ''), stocked: r.waterbody});
  }
  return out;
}

// Words that name a water in ODFW's reports: the guide name, "the <river>" for rivers, and ODFW's stocking names.
function namePatterns(g, item) {
  const names = new Set([item.name]);
  const w = item.guide;
  if (w) {
    if (w.kind === 'river') { const stem = w.name.replace(/ River$/, ''); if (stem !== w.name && stem.length >= 4) names.add('the ' + stem); }
    for (const n of g.ORFF_STOCKING_MATCH?.[w.id] || []) if (n.length > 4 && !/[()]/.test(n)) names.add(n);
  }
  return [...names].map(n => new RegExp('\\b' + reEscape(n) + '\\b', 'i'));
}

/* ---------- Facts: what is true about each water today ---------- */
// Returns Map<followKey, {name, url, facts: [{kind, key, title, detail, link}]}> for the keys asked for.
export function factsFor(g, keys, {today, now = Date.now(), siteUrl = 'https://oregonfishforecast.com/'} = {}) {
  const all = followables(g);
  const base = siteUrl.replace(/\/?$/, '/');
  const mon = mondayOf(today), until = addDays(mon, 13);
  const rows = g.ORFF_STOCKING?.rows || [];
  const zones = Object.entries(g.ORFF_ODFW_REPORTS?.zones || {});
  const out = new Map();
  for (const k of keys) {
    const item = all.get(k);
    if (!item) continue;
    const w = item.guide, facts = [];
    // A water outside the guide links to the stocking schedule, searched for that water.
    const url = w ? base + '#/water/' + w.id : base + '#/stocking?q=' + encodeURIComponent(item.stocked || item.name);

    // Stocking planned for this week or next.
    const res = w ? (g.ORFF_STOCKING_MATCH?.[w.id] || []).map(n => new RegExp('\\b' + reEscape(n) + '\\b', 'i')) : null;
    const mine = rows.filter(r => (w ? res.some(re => re.test(r.waterbody)) : r.waterbody === item.stocked) && r.week_start >= mon && r.week_start <= until)
      .sort((a, b) => a.week_start.localeCompare(b.week_start));
    for (const r of mine) {
      facts.push({kind: 'stocking', key: 'stock:' + r.waterbody + ':' + r.week_start,
        title: num(r.total) + ' trout planned' + (r.week_start === mon ? ' this week' : ' next week') + (w && r.waterbody !== w.name ? ' at ' + r.waterbody : ''),
        detail: 'ODFW stocking schedule, week of ' + shortDay(r.week_start) + '. Planned, not confirmed: ODFW can move a release.', link: url});
    }

    if (w) {
      // Score: Good or better.
      const s = g.ORFFPreview?.score(w);
      if (s?.status === 'scored' && s.value >= 65) {
        const top = [...(s.factors || [])].sort((a, b) => b.weight - a.weight)[0];
        const fact = {kind: 'score', title: 'Score is ' + s.label + ', ' + s.value + ' out of 100', detail: s.confidence.charAt(0).toUpperCase() + s.confidence.slice(1) + ' confidence' + (top ? '. Biggest input: ' + clean(top.label).toLowerCase() + ', ' + clean(top.display).toLowerCase() : '') + '.', link: url};
        facts.push({...fact, key: 'score:good'});
        if (s.label === 'Excellent') facts.push({...fact, key: 'score:excellent'});
      }

      // River forecast: a big rise coming.
      const gauge = g.ORFF_MONITORING?.[w.id], cond = g.ORFF_CONDITIONS;
      const fc = gauge?.forecast && cond?.forecasts?.[gauge.forecast];
      const pts = (fc?.points || []).filter(p => Number.isFinite(p.flow) && Date.parse(p.time) > now);
      const nowFlow = cond?.stations?.[gauge?.station]?.flow?.latest ?? pts[0]?.flow;
      if (pts.length && Number.isFinite(nowFlow)) {
        const peak = pts.reduce((a, b) => b.flow > a.flow ? b : a);
        if (peak.flow >= nowFlow * 1.5 && peak.flow - nowFlow >= 100) {
          facts.push({kind: 'flow', key: 'flow:rise', title: 'River forecast: up to ' + num(peak.flow) + ' cfs by ' + weekday(peak.time),
            detail: 'NOAA river forecast. Running about ' + num(nowFlow) + ' cfs now, so expect high, dirty water around the peak.', link: url});
        }
      }

      // ODFW in-season rules and notices on the page.
      for (const r of (g.ORFF_AUTO?.rules?.[w.id] || []).filter(x => !x.effective_to || x.effective_to >= today)) {
        facts.push({kind: 'rules', key: 'rule:' + hash(r.summary + r.effective_from), title: r.kind === 'closure' ? 'ODFW closure' : /^open/.test(r.kind || '') ? 'ODFW opening' : 'ODFW rule change',
          detail: clean(r.summary) + ' (' + shortDay(r.effective_from) + (r.effective_to ? ' to ' + shortDay(r.effective_to) : ', no end date') + ')', link: r.url || url});
      }
      for (const n of (w.planning?.alerts || []).filter(x => x.status !== 'unverified')) {
        facts.push({kind: 'rules', key: 'notice:' + hash(n.summary), title: 'Notice on the water’s page', detail: clean(n.summary), link: n.url || url});
      }

      // Weather Service alerts covering the water.
      for (const a of (g.ORFF_WEATHER?.waters?.[w.id]?.alerts || []).filter(x => x.event && !(Date.parse(x.ends) < now))) {
        facts.push({kind: 'weather', key: 'nws:' + hash(a.url || a.event + a.headline), title: a.event, detail: clean(a.headline), link: url});
      }
    }

    // ODFW's weekly zone reports: new text that names the water.
    const pats = namePatterns(g, item);
    for (const [zid, z] of zones) {
      if (!z.text || !z.changed_on || days(z.changed_on, today) > 8) continue;
      // Table rows (ODFW's stocking tables) read as plain lists: "10/26/2026, Willamette, Alton Baker Canal, 750".
      const lines = [...new Set(z.text.split(/\n+/).map(l => /\|/.test(l) ? l.split('|').map(clean).filter(Boolean).join(', ') : clean(l).replace(/^[-•*]\s*/, ''))
        .filter(l => pats.some(re => re.test(l)) && pats.reduce((t, re) => t.replace(new RegExp(re.source, 'gi'), ''), l).replace(/[\W_]+/g, '').length >= 8))];
      if (!lines.length) continue;
      const quote = lines.slice(0, 2).map(l => l.length > 320 ? l.slice(0, 317) + '…' : l).join(' … ');
      facts.push({kind: 'reports', key: 'odfw:' + zid + ':' + z.changed_on, title: 'ODFW\'s ' + z.name + ' report mentions it', detail: '“' + quote + '”', link: z.url});
    }
    out.set(k, {key: k, name: item.name, detail: item.detail, url, facts});
  }
  return out;
}

/* ---------- One follower's news ---------- */
// Returns {groups: [{name, url, items}], seen} where seen is the follower's updated seen-list.
export function digest(rec, facts, today, {sample = false} = {}) {
  const kinds = {...Object.fromEntries(Object.keys(KINDS).map(k => [k, true])), ...(rec.kinds || {})};
  const seen = {};
  const groups = [];
  for (const key of rec.waters || []) {
    const f = facts.get(key);
    const was = rec.seen?.[key] || {};
    if (!f) { seen[key] = was; continue; }
    const now = {};
    // Keep what is still current, and what went away less than a week ago.
    for (const [k, d] of Object.entries(was)) if (f.facts.some(x => x.key === k) || days(d, today) < SEEN_DAYS) now[k] = d;
    let fresh = f.facts.filter(x => kinds[x.kind] && (sample || !now[x.key]));
    // Everything current is marked, even kinds turned off, so turning a kind on later does not send old news.
    for (const x of f.facts) if (!now[x.key]) now[x.key] = today;
    // Excellent already says Good.
    if (fresh.some(x => x.key === 'score:excellent')) fresh = fresh.filter(x => x.key !== 'score:good');
    seen[key] = now;
    if (fresh.length) groups.push({key, name: f.name, url: f.url, items: fresh});
  }
  return {groups, seen};
}
// Marks everything current as seen, for waters just followed.
export function seedSeen(rec, facts, today) {
  return digest(rec, facts, today).seen;
}

/* ---------- The email ---------- */
export function renderEmail({groups, siteUrl, stopUrl, sample = false, today}) {
  const n = groups.reduce((s, g) => s + g.items.length, 0);
  const subject = sample ? 'Sample Eddy alert: ' + (n ? groups.map(g => g.name).join(', ') : 'your waters')
    : groups.length === 1 && n === 1 ? groups[0].name + ': ' + groups[0].items[0].title
    : n + ' updates on ' + (groups.length === 1 ? groups[0].name : groups.map(g => g.name).slice(0, 3).join(', ') + (groups.length > 3 ? ' and more' : ''));
  const intro = sample ? 'This is a sample of your Eddy alerts, showing everything current on the waters you follow. Real alerts only include what is new since the last email.' : 'New this morning on the waters you follow:';
  const body = groups.map(g => '<h2 style="font:600 18px/1.3 Georgia,serif;margin:28px 0 8px;color:#12261f"><a href="' + esc(g.url) + '" style="color:#12261f">' + esc(g.name) + '</a></h2>' +
    g.items.map(i => '<p style="margin:0 0 12px;font:15px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#24332d"><strong>' + esc(i.title) + '</strong><br>' + esc(i.detail) +
      (i.link && i.link !== g.url ? ' <a href="' + esc(i.link) + '" style="color:#1f6f5c">Source</a>' : '') + '</p>').join('')).join('') ||
    '<p style="font:15px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#24332d">Nothing is current on your waters right now. You will hear from Eddy when something changes.</p>';
  const html = '<!doctype html><html><body style="margin:0;background:#f4f1ea"><div style="max-width:560px;margin:0 auto;padding:28px 20px">' +
    '<p style="font:600 12px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#1f6f5c;margin:0 0 6px">Eddy alerts · ' + esc(shortDay(today)) + '</p>' +
    '<p style="font:15px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#24332d;margin:0">' + esc(intro) + '</p>' + body +
    '<hr style="border:0;border-top:1px solid #d9d3c5;margin:28px 0 14px">' +
    '<p style="font:13px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#5b6862;margin:0 0 6px">From Oregon Fish Forecast data, read this morning. Check ODFW\'s current rules before you fish.</p>' +
    '<p style="font:13px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#5b6862;margin:0">Change your waters in Eddy at <a href="' + esc(siteUrl) + '" style="color:#1f6f5c">oregonfishforecast.com</a>. <a href="' + esc(stopUrl) + '" style="color:#1f6f5c">Stop these emails</a>.</p>' +
    '</div></body></html>';
  const text = 'Eddy alerts, ' + shortDay(today) + '\n\n' + intro + '\n' +
    (groups.map(g => '\n' + g.name + '\n' + g.url + '\n' + g.items.map(i => '- ' + i.title + '. ' + i.detail + (i.link && i.link !== g.url ? ' ' + i.link : '')).join('\n')).join('\n') || '\nNothing is current on your waters right now.') +
    '\n\nCheck ODFW\'s current rules before you fish.\nChange your waters in Eddy at ' + siteUrl + '\nStop these emails: ' + stopUrl + '\n';
  return {subject, html, text};
}

/* ---------- Sending (Resend) ---------- */
export function resendMailer(apiKey, {from, fetchImpl = (...a) => fetch(...a)} = {}) {
  async function post(path, body) {
    const res = await fetchImpl('https://api.resend.com' + path, {method: 'POST', headers: {authorization: 'Bearer ' + apiKey, 'content-type': 'application/json'}, body: JSON.stringify(body)});
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error('Resend HTTP ' + res.status + ': ' + (data?.message || data?.name || 'error'));
    return data;
  }
  const shape = m => ({from, to: [m.to], subject: m.subject, html: m.html, text: m.text, ...(m.headers ? {headers: m.headers} : {})});
  return {
    send: m => post('/emails', shape(m)),
    // Up to 100 emails per request.
    async sendMany(list) {
      for (let i = 0; i < list.length; i += 100) await post('/emails/batch', list.slice(i, i + 100).map(shape));
    }
  };
}

/* ---------- Followers (Netlify Blobs, one record per follower) ---------- */
export function memoryAlertStore() {
  const m = new Map();
  return {get: async id => structuredClone(m.get(id) ?? null), put: async (id, rec) => { m.set(id, structuredClone(rec)); }, list: async () => [...m.keys()]};
}
export function blobAlertStore(getStore) {
  let store = null;
  const s = () => (store ||= getStore());
  return {
    get: id => s().get('f/' + id, {type: 'json'}),
    put: (id, rec) => s().setJSON('f/' + id, rec),
    list: async () => (await s().list({prefix: 'f/'})).blobs.map(b => b.key.slice(2))
  };
}

/* ---------- Stop links ---------- */
export const stopToken = (id, secret) => Buffer.from(id).toString('base64url') + '.' + createHmac('sha256', secret).update('stop:' + id).digest('base64url').slice(0, 32);
export function readStopToken(token, secret) {
  if (typeof token !== 'string' || token.length > 300) return null;
  const [a, sig] = token.split('.');
  if (!a || !sig) return null;
  const id = Buffer.from(a, 'base64url').toString('utf8');
  const want = Buffer.from(stopToken(id, secret).split('.')[1]), got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? id : null;
}

/* ---------- The morning run ---------- */
// Loads today's site data, works out each follower's news and sends one email each. Safe to run twice in a day:
// a follower already handled today is skipped.
export async function runAlerts({loadSite, store, mailer, stripe = null, LIVE = new Set(['active', 'trialing']), periodEnd = s => s?.current_period_end ?? s?.items?.data?.[0]?.current_period_end, secret, siteUrl, stopBase, now = () => Date.now(), log = console.log}) {
  if (!mailer) { log('alerts: no email service set up (RESEND_API_KEY); nothing sent'); return {followers: 0, emailed: 0}; }
  const today = pacificDay(now());
  const ids = await store.list();
  if (!ids.length) return {followers: 0, emailed: 0};
  const g = await loadSite();
  const recs = (await Promise.all(ids.map(id => store.get(id).catch(() => null)))).filter(Boolean);
  const active = [];
  for (const rec of recs) {
    if (rec.stopped || rec.inactive || !rec.email || !rec.waters?.length || rec.checked_on === today) continue;
    if (rec.kind === 'paid' && !(rec.paid_through * 1000 > now())) {
      // The paid period ended: check the subscription before sending.
      const sub = stripe ? await stripe.getSubscription(rec.id).catch(e => { log('alerts: subscription check failed for a follower: ' + e.message); return null; }) : null;
      if (!sub) continue;
      if (LIVE.has(sub.status) && periodEnd(sub)) rec.paid_through = periodEnd(sub);
      else { rec.inactive = true; await store.put(rec.id, rec); continue; }
    }
    active.push(rec);
  }
  const facts = factsFor(g, [...new Set(active.flatMap(r => r.waters))], {today, now: now(), siteUrl});
  const outgoing = [], updated = [];
  for (const rec of active) {
    const {groups, seen} = digest(rec, facts, today);
    rec.seen = seen;
    rec.checked_on = today;
    if (groups.length) {
      const stopUrl = stopBase + '?t=' + stopToken(rec.id, secret);
      const mail = renderEmail({groups, siteUrl, stopUrl, today});
      outgoing.push({to: rec.email, ...mail, headers: {'List-Unsubscribe': '<' + stopUrl + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'}});
      rec.last_sent_on = today;
    }
    updated.push(rec);
  }
  // Send first; only then remember what was sent, so a failed send is tried again on the next run.
  if (outgoing.length) await mailer.sendMany(outgoing);
  await Promise.all(updated.map(r => store.put(r.id, r)));
  log('alerts: ' + active.length + ' followers checked, ' + outgoing.length + ' emailed');
  return {followers: active.length, emailed: outgoing.length};
}

/* ---------- The /api/eddy/alerts routes ---------- */
//   GET  /api/eddy/alerts        this browser's alert settings (owner or pass holder)
//   POST /api/eddy/alerts        save them: {waters: [...keys], kinds: {...}, email (owner only)}
//   POST /api/eddy/alerts/test   email a sample now (3 a day)
//   GET  /api/eddy/stop?t=...    the stop page from an email; POST to it stops the emails (also one-click unsubscribe)
export function createAlertsHandler({access, store, mailer, getSite, stripe = null, secret, allowedOrigins = [], siteUrl, stopBase, usage = null, now = () => Date.now(), perVisitor = windowLimiter(30, 10 * 60 * 1000)}) {
  const allowed = new Set(allowedOrigins.map(o => o.replace(/\/$/, '')));
  const cors = origin => ({'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-eddy-key, x-eddy-pass', 'access-control-max-age': '86400', vary: 'origin'});
  const reply = (status, obj, headers) => new Response(JSON.stringify(obj), {status, headers: {'content-type': 'application/json', 'cache-control': 'no-store', ...headers}});
  const page = (status, title, html) => new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title></head>' +
    '<body style="margin:0;background:#f4f1ea;font:16px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#24332d"><main style="max-width:520px;margin:0 auto;padding:48px 20px"><h1 style="font:600 26px/1.2 Georgia,serif">' + esc(title) + '</h1>' + html + '</main></body></html>',
    {status, headers: {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex'}});
  const today = () => pacificDay(now());

  async function who(request) {
    const grant = await access.check(request);
    if (grant.kind === 'owner') return {id: 'owner', kind: 'owner', grant};
    if (grant.kind === 'paid') return {id: grant.id, kind: 'paid', grant};
    return null;
  }
  async function stripeEmail(customer) {
    if (!stripe || !customer) return null;
    const c = await stripe.getCustomer(customer).catch(e => { console.error('alerts: customer lookup failed:', e.message); return null; });
    return c?.email || null;
  }
  const view = (rec, all) => ({
    ok: true,
    email: rec.email || null,
    email_editable: rec.kind === 'owner',
    waters: (rec.waters || []).map(k => ({key: k, name: all.get(k)?.name || k.replace(/^s:/, ''), detail: all.get(k)?.detail || ''})),
    kinds: {...Object.fromEntries(Object.keys(KINDS).map(k => [k, true])), ...(rec.kinds || {})},
    kind_labels: KINDS,
    max: MAX_WATERS,
    stopped: !!rec.stopped,
    sending: !!mailer,
    last_sent_on: rec.last_sent_on || null
  });

  async function stop(request) {
    const url = new URL(request.url);
    const id = readStopToken(url.searchParams.get('t'), secret);
    if (!id) return page(400, 'That link is not valid', '<p>Open Eddy on oregonfishforecast.com to change your alerts.</p>');
    if (request.method === 'GET') {
      return page(200, 'Stop Eddy alerts?', '<p>You will stop getting Eddy alert emails. Your Eddy pass is not affected, and you can turn alerts back on in Eddy any time.</p>' +
        '<form method="post"><button type="submit" style="font:inherit;padding:12px 20px;border:0;border-radius:999px;background:#12261f;color:#fff;cursor:pointer">Stop the emails</button></form>');
    }
    const rec = await store.get(id);
    if (rec) { rec.stopped = true; rec.updated = new Date(now()).toISOString(); await store.put(id, rec); }
    return page(200, 'Alerts stopped', '<p>You will not get any more Eddy alert emails. To turn them back on, open Eddy on <a href="' + esc(siteUrl) + '">oregonfishforecast.com</a> and save your alerts again.</p>');
  }

  return async function handleAlerts(request) {
    const path = new URL(request.url).pathname;
    // Stop links come from email, not from the site, so they skip the site check.
    if (/\/api\/eddy\/stop$/.test(path)) {
      if (!['GET', 'POST'].includes(request.method)) return page(405, 'Not allowed', '');
      return stop(request);
    }
    // The site calls from another origin; a browser on the endpoint's own origin (the local server) sends no Origin on GET.
    const origin = request.headers.get('origin'), own = new URL(request.url).origin;
    if (origin && origin !== own && !allowed.has(origin)) return reply(403, {type: 'error', message: 'This site is not allowed to use Eddy.'});
    const headers = origin && origin !== own ? cors(origin) : {};
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
    if (!perVisitor(clientIp(request))) return reply(429, {type: 'error', message: 'Too many tries in a short time. Wait a few minutes.'}, headers);
    let me;
    try { me = await who(request); } catch (e) { console.error('alerts: access check failed:', e.message); return reply(503, {type: 'error', message: 'Could not check your pass just now.'}, headers); }
    if (!me) return reply(401, {type: 'error', message: 'Alerts come with an Eddy pass.'}, headers);

    try {
      const g = await getSite();
      const all = followables(g);
      let rec = await store.get(me.id) || {id: me.id, kind: me.kind, waters: [], seen: {}, created: new Date(now()).toISOString()};
      if (me.kind === 'paid') {
        rec.cus = me.grant.customer || rec.cus;
        rec.paid_through = Math.max(rec.paid_through || 0, me.grant.paidThrough || 0);
        rec.inactive = false;
      }

      if (request.method === 'GET' && /\/alerts$/.test(path)) {
        if (me.kind === 'paid' && !rec.email) rec.email = await stripeEmail(rec.cus);
        return reply(200, view(rec, all), headers);
      }
      if (request.method !== 'POST') return reply(405, {type: 'error', message: 'Use POST.'}, headers);
      let body = {};
      try { body = JSON.parse((await request.text()) || '{}'); } catch { return reply(400, {type: 'error', message: 'Send JSON.'}, headers); }

      if (/\/alerts\/test$/.test(path)) {
        if (!mailer) return reply(503, {type: 'error', message: 'Alert emails are not connected yet (the site needs an email service key).'}, headers);
        if (me.kind === 'paid') rec.email = await stripeEmail(rec.cus) || rec.email;
        if (!rec.email) return reply(400, {type: 'error', message: 'Add your email address first.'}, headers);
        if (!rec.waters.length) return reply(400, {type: 'error', message: 'Follow a water first.'}, headers);
        if (usage) {
          const k = today() + '/alert-test/' + me.id;
          if (await usage.get(k) >= TESTS_PER_DAY) return reply(429, {type: 'error', message: 'That’s ' + TESTS_PER_DAY + ' samples today. Try again tomorrow.'}, headers);
          await usage.add(k);
        }
        const facts = factsFor(g, rec.waters, {today: today(), now: now(), siteUrl});
        const {groups} = digest(rec, facts, today(), {sample: true});
        const stopUrl = stopBase + '?t=' + stopToken(me.id, secret);
        await mailer.send({to: rec.email, ...renderEmail({groups, siteUrl, stopUrl, sample: true, today: today()}), headers: {'List-Unsubscribe': '<' + stopUrl + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'}});
        return reply(200, {ok: true, sent_to: rec.email, items: groups.reduce((s, x) => s + x.items.length, 0)}, headers);
      }

      // Save settings.
      if (!/\/alerts$/.test(path)) return reply(404, {type: 'error', message: 'Not found.'}, headers);
      if (body.waters != null) {
        if (!Array.isArray(body.waters) || body.waters.some(k => typeof k !== 'string' || !all.has(k))) return reply(400, {type: 'error', message: 'One of those waters is not on the site.'}, headers);
        const list = [...new Set(body.waters)];
        if (list.length > MAX_WATERS) return reply(400, {type: 'error', message: 'You can follow up to ' + MAX_WATERS + ' waters.'}, headers);
        const added = list.filter(k => !rec.waters.includes(k));
        rec.waters = list;
        rec.seen = Object.fromEntries(Object.entries(rec.seen || {}).filter(([k]) => list.includes(k)));
        if (added.length) {
          // A newly followed water starts quiet: what is already true is not news.
          const facts = factsFor(g, added, {today: today(), now: now(), siteUrl});
          Object.assign(rec.seen, seedSeen({...rec, waters: added, seen: {}, kinds: {}}, facts, today()));
        }
      }
      if (body.kinds != null) {
        if (typeof body.kinds !== 'object' || Object.keys(body.kinds).some(k => !(k in KINDS))) return reply(400, {type: 'error', message: 'Unknown alert type.'}, headers);
        rec.kinds = Object.fromEntries(Object.keys(KINDS).map(k => [k, body.kinds[k] !== false]));
      }
      if (body.email != null) {
        if (me.kind !== 'owner') return reply(400, {type: 'error', message: 'Alerts go to the email on your Eddy pass. Change it under Manage subscription.'}, headers);
        const email = String(body.email).trim();
        if (email && !/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[a-z]{2,}$/i.test(email)) return reply(400, {type: 'error', message: 'That email address does not look right.'}, headers);
        rec.email = email || null;
      }
      if (me.kind === 'paid') rec.email = await stripeEmail(rec.cus) || rec.email;
      rec.stopped = false;
      rec.updated = new Date(now()).toISOString();
      await store.put(me.id, rec);
      return reply(200, view(rec, all), headers);
    } catch (e) {
      console.error('alerts:', e.message);
      return reply(502, {type: 'error', message: 'Alerts could not be saved just now. Try again shortly.'}, headers);
    }
  };
}
