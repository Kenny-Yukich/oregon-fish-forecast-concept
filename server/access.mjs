// Who may ask Eddy, and how many questions they have left today.
//
//   owner  the site owner's access code (x-eddy-key): free and unlimited.
//   paid   a guest's Eddy pass (x-eddy-pass), bought through Stripe: PLAN.paidPerDay questions a day.
//   free   anyone else, once selling is on: PLAN.freePerDay questions a day per connection, and
//          PLAN.freeSiteWidePerDay for the whole site, so free questions can never run up a bill.
//   none   selling is off and there is no owner code: Eddy stays private.
//
// A pass is a signed token ("ep1.<payload>.<signature>") naming the guest's Stripe subscription and when it
// runs out. Nothing about guests is stored here: Stripe holds the subscription, and an expired pass is renewed
// by asking Stripe whether the subscription is still active. Only daily question counts are stored, keyed by
// the subscription or by a hash of the connection's address (never the address itself).
import {createHash, createHmac, timingSafeEqual} from 'node:crypto';

export const PLAN = {
  name: 'Eddy monthly pass',
  price: '$4.99/month',
  amountCents: 499,
  currency: 'usd',
  interval: 'month',
  paidPerDay: 50,
  freePerDay: 3,
  freeSiteWidePerDay: 300
};
const GRACE_SECONDS = 3 * 24 * 3600;   // a pass stays good this long past the paid period while renewal settles
const LIVE = new Set(['active', 'trialing']);

export const sha256 = text => createHash('sha256').update(String(text)).digest('hex');
const pacificDay = ms => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Los_Angeles'}).format(new Date(ms));
const b64 = s => Buffer.from(s).toString('base64url');

export function clientIp(request) {
  return (request.headers.get('x-nf-client-connection-ip') || request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown').trim();
}

export function matchesHash(value, hashHex) {
  if (!value || !hashHex || value.length > 200) return false;
  const a = Buffer.from(sha256(value), 'hex'), b = Buffer.from(hashHex, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ---------- Passes ---------- */
export function signPass(payload, secret) {
  const body = 'ep1.' + b64(JSON.stringify(payload));
  return body + '.' + createHmac('sha256', secret).update(body).digest('base64url');
}
// The payload when the signature is right (expired or not), otherwise null.
export function readPass(token, secret) {
  if (typeof token !== 'string' || token.length > 600 || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'ep1') return null;
  const want = createHmac('sha256', secret).update(parts[0] + '.' + parts[1]).digest();
  let got;
  try { got = Buffer.from(parts[2], 'base64url'); } catch { return null; }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return p && typeof p.sub === 'string' && Number.isFinite(p.exp) ? p : null;
  } catch { return null; }
}

/* ---------- Daily counts ---------- */
export function memoryUsage() {
  const counts = new Map();
  return {get: async key => counts.get(key) || 0, add: async key => { counts.set(key, (counts.get(key) || 0) + 1); }};
}
// Netlify Blobs store. Read-then-write, so two questions at the same instant can count once; that only errs by a question.
export function blobUsage(getStore) {
  let store = null;
  const s = () => (store ||= getStore());
  return {
    get: async key => Number(await s().get(key)) || 0,
    add: async key => { const n = Number(await s().get(key)) || 0; await s().set(key, String(n + 1)); }
  };
}

/* ---------- Stripe (REST API, form-encoded) ---------- */
function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const key = prefix ? prefix + '[' + k + ']' : k;
    if (Array.isArray(v)) v.forEach((x, i) => typeof x === 'object' ? form(x, key + '[' + i + ']', out) : out.append(key + '[]', String(x)));
    else if (typeof v === 'object') form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}
export class StripeError extends Error { constructor(status, message) { super(message); this.status = status; } }

export function stripeClient(secretKey, {fetchImpl = (...a) => fetch(...a), plan = PLAN, priceId = null} = {}) {
  async function call(method, path, params) {
    const url = 'https://api.stripe.com/v1/' + path + (method === 'GET' && params ? '?' + form(params) : '');
    const res = await fetchImpl(url, {
      method,
      headers: {authorization: 'Bearer ' + secretKey, 'content-type': 'application/x-www-form-urlencoded'},
      body: method === 'GET' ? undefined : form(params || {}).toString()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new StripeError(res.status, data?.error?.message || 'Stripe HTTP ' + res.status);
    return data;
  }
  return {
    testMode: secretKey.startsWith('sk_test_') || secretKey.startsWith('rk_test_'),
    createCheckout: ({successUrl, cancelUrl}) => call('POST', 'checkout/sessions', {
      mode: 'subscription',
      line_items: [priceId ? {price: priceId, quantity: 1} : {quantity: 1, price_data: {
        currency: plan.currency, unit_amount: plan.amountCents, recurring: {interval: plan.interval},
        product_data: {name: plan.name, description: 'Ask Eddy, the AI fishing assistant on Oregon Fish Forecast. Up to ' + plan.paidPerDay + ' questions a day. Cancel anytime.'}
      }}],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: {product: 'eddy'}
    }),
    getCheckout: id => call('GET', 'checkout/sessions/' + encodeURIComponent(id), {expand: ['subscription']}),
    getSubscription: id => call('GET', 'subscriptions/' + encodeURIComponent(id)),
    createPortal: ({customer, returnUrl}) => call('POST', 'billing_portal/sessions', {customer, return_url: returnUrl})
  };
}
// Newer Stripe API versions keep the period end on the subscription's items.
const periodEnd = sub => sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null;

/* ---------- Access ---------- */
export function createAccess({ownerHash = null, stripe = null, passSecret = null, usage = null, plan = PLAN, salt = '', now = () => Date.now(), selling = true}) {
  const billing = !!(selling && stripe && passSecret && usage);
  const day = () => pacificDay(now());
  const key = (kind, id) => day() + '/' + kind + '/' + id;

  const passFor = sub => signPass({v: 1, sub: sub.id, cus: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id, exp: periodEnd(sub) + GRACE_SECONDS}, passSecret);

  async function check(request) {
    if (ownerHash && matchesHash(request.headers.get('x-eddy-key'), ownerHash)) return {kind: 'owner', billing, limit: null, remaining: null};
    if (!ownerHash && !billing) return {kind: 'owner', billing, limit: null, remaining: null};   // open, as on the local server
    if (!billing) return {kind: 'none', billing};
    let expired = false;
    const p = readPass(request.headers.get('x-eddy-pass'), passSecret);
    if (p) {
      let pass = null, live = p.exp * 1000 > now();
      if (!live) {
        // The paid period ended: ask Stripe whether the subscription renewed, and if so hand back a fresh pass.
        const sub = await stripe.getSubscription(p.sub).catch(e => { console.error('access: subscription check failed:', e.message); return null; });
        if (sub && LIVE.has(sub.status) && periodEnd(sub)) { pass = passFor(sub); live = true; }
      }
      if (live) {
        const used = await usage.get(key('paid', p.sub));
        return {kind: 'paid', billing, id: p.sub, customer: p.cus, limit: plan.paidPerDay, used, remaining: Math.max(0, plan.paidPerDay - used), pass};
      }
      expired = true;
    }
    const id = sha256(salt + clientIp(request)).slice(0, 20);
    const [used, site] = await Promise.all([usage.get(key('free', id)), usage.get(key('free', 'all'))]);
    const remaining = site >= plan.freeSiteWidePerDay ? 0 : Math.max(0, plan.freePerDay - used);
    return {kind: 'free', billing, id, limit: plan.freePerDay, used, remaining, expired};
  }

  async function spend(grant) {
    if (grant.kind === 'paid') await usage.add(key('paid', grant.id));
    else if (grant.kind === 'free') await Promise.all([usage.add(key('free', grant.id)), usage.add(key('free', 'all'))]);
  }

  return {billing, plan, check, spend, passFor, testMode: !!stripe?.testMode};
}

// A fixed-window counter per key, in this process (a brake against bots, not an exact quota).
function windowLimiter(limit, windowMs, now = () => Date.now()) {
  const hits = new Map();
  return key => {
    const t = now(), e = hits.get(key);
    if (!e || t - e.start >= windowMs) { hits.set(key, {start: t, n: 1}); if (hits.size > 5000) hits.clear(); return true; }
    return ++e.n <= limit;
  };
}

/* ---------- Checkout, redeem and manage (the /api/eddy/* routes) ---------- */
// returnTo must be a page on one of the allowed sites, so Stripe never sends a guest anywhere else.
export function createBillingHandler({access, stripe, passSecret, allowedOrigins = [], perVisitor = windowLimiter(20, 10 * 60 * 1000)}) {
  const allowed = new Set(allowedOrigins.map(o => o.replace(/\/$/, '')));
  const cors = origin => ({'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, x-eddy-pass', 'access-control-max-age': '86400', vary: 'origin'});
  const reply = (status, obj, headers) => new Response(JSON.stringify(obj), {status, headers: {'content-type': 'application/json', 'cache-control': 'no-store', ...headers}});
  const safeReturn = (value, origin) => {
    try {
      const u = new URL(value);
      if (u.origin !== origin) return null;
      u.search = ''; u.hash = '';
      return u.href;
    } catch { return null; }
  };

  return async function handleBilling(request) {
    const origin = request.headers.get('origin');
    if (!origin || !allowed.has(origin)) return reply(403, {type: 'error', message: 'This site is not allowed to use Eddy.'});
    const headers = cors(origin);
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
    if (request.method !== 'POST') return reply(405, {type: 'error', message: 'Use POST.'}, headers);
    if (!access.billing) return reply(404, {type: 'error', message: 'Eddy passes are not on sale yet.'}, headers);
    if (!perVisitor(clientIp(request))) return reply(429, {type: 'error', message: 'Too many tries in a short time. Wait a few minutes.'}, headers);
    let body = {};
    try { body = JSON.parse((await request.text()) || '{}'); } catch {}
    const page = safeReturn(body.return_to, origin) || origin + '/';
    const route = new URL(request.url).pathname.replace(/^.*\/api\/eddy\//, '');
    try {
      if (route === 'checkout') {
        const session = await stripe.createCheckout({successUrl: page + '?eddy_paid={CHECKOUT_SESSION_ID}', cancelUrl: page + '?eddy_cancel=1'});
        return reply(200, {url: session.url}, headers);
      }
      if (route === 'redeem') {
        if (typeof body.session_id !== 'string' || !/^cs_[A-Za-z0-9_]+$/.test(body.session_id)) return reply(400, {type: 'error', message: 'That checkout link is not valid.'}, headers);
        const session = await stripe.getCheckout(body.session_id);
        const sub = session.subscription;
        if (session.status !== 'complete' || !sub || typeof sub !== 'object' || !LIVE.has(sub.status)) return reply(402, {type: 'error', message: 'That payment has not gone through yet. Try again in a minute.'}, headers);
        return reply(200, {pass: access.passFor(sub), plan: access.plan.name}, headers);
      }
      if (route === 'portal') {
        const p = readPass(request.headers.get('x-eddy-pass'), passSecret);
        if (!p?.cus) return reply(401, {type: 'error', message: 'No Eddy pass found in this browser.'}, headers);
        const portal = await stripe.createPortal({customer: p.cus, returnUrl: page});
        return reply(200, {url: portal.url}, headers);
      }
      return reply(404, {type: 'error', message: 'Not found.'}, headers);
    } catch (e) {
      console.error('billing:', route, e.status || '', e.message);
      return reply(502, {type: 'error', message: 'The payment service did not answer. Try again shortly.'}, headers);
    }
  };
}
