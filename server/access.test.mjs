// Offline tests for Eddy passes, free questions and the checkout routes. A stand-in replaces Stripe; nothing is charged.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccess, createBillingHandler, signPass, readPass, memoryUsage, sha256, PLAN} from './access.mjs';
import {createAskHandler, readAnswer, rateLimiter} from './ask.mjs';
import {loadSite, localSource, buildContext} from './context.mjs';

const context = buildContext(await loadSite(localSource()), '2026-11-19');
const SECRET = 'test-pass-secret', OWNER = 'owner-code', SITE = 'https://oregonfishforecast.com';
const DAY = Date.parse('2026-11-19T20:00:00Z');
const quiet = () => {};

function fakeStripe({subStatus = 'active', periodEnd = DAY / 1000 + 30 * 86400} = {}) {
  const calls = [];
  const sub = {id: 'sub_123', customer: 'cus_123', status: subStatus, items: {data: [{current_period_end: periodEnd}]}};
  return {
    calls, testMode: true,
    createCheckout: async args => { calls.push(['checkout', args]); return {url: 'https://checkout.stripe.com/c/pay/cs_test_abc'}; },
    getCheckout: async id => { calls.push(['redeem', id]); return id === 'cs_test_done' ? {status: 'complete', subscription: sub} : {status: 'open', subscription: null}; },
    getSubscription: async id => { calls.push(['subscription', id]); return sub; },
    createPortal: async args => { calls.push(['portal', args]); return {url: 'https://billing.stripe.com/p/session/abc'}; }
  };
}
function fakeClient() {
  const calls = [];
  return {calls, messages: {stream(params) {
    calls.push(params);
    return {
      async *[Symbol.asyncIterator]() { yield {type: 'content_block_delta', delta: {type: 'text_delta', text: 'Hi.'}}; },
      finalMessage: async () => ({model: 'claude-haiku-5-5', stop_reason: 'end_turn', usage: {}})
    };
  }}};
}
function setup({stripe = fakeStripe(), now = () => DAY} = {}) {
  const access = createAccess({ownerHash: sha256(OWNER), stripe, passSecret: SECRET, usage: memoryUsage(), salt: 's', now});
  const client = fakeClient();
  const ask = createAskHandler({getContext: async () => context, client, allowedOrigins: [SITE], access, onUsage: quiet,
    perVisitor: rateLimiter({limit: 1000, windowMs: 60000}), overall: rateLimiter({limit: 1000, windowMs: 60000})});
  const billing = createBillingHandler({access, stripe, passSecret: SECRET, allowedOrigins: [SITE]});
  return {access, client, ask, billing, stripe};
}
const q = {messages: [{role: 'user', content: 'How is the Rogue?'}]};
const call = (handler, method, {key, pass, ip = '1.1.1.1', body, path = '/api/ask', origin = SITE} = {}) => handler(new Request('https://eddy.example' + path, {
  method, headers: {'content-type': 'application/json', origin, 'x-forwarded-for': ip, ...(key ? {'x-eddy-key': key} : {}), ...(pass ? {'x-eddy-pass': pass} : {})},
  body: method === 'POST' ? JSON.stringify(body ?? q) : undefined
}));

test('passes are signed: tampering or the wrong secret is refused', () => {
  const token = signPass({v: 1, sub: 'sub_1', cus: 'cus_1', exp: 2e9}, SECRET);
  assert.deepEqual(readPass(token, SECRET), {v: 1, sub: 'sub_1', cus: 'cus_1', exp: 2e9});
  assert.equal(readPass(token, 'other-secret'), null);
  const [a, , c] = token.split('.');
  assert.equal(readPass(a + '.' + Buffer.from(JSON.stringify({v: 1, sub: 'sub_x', cus: 'c', exp: 2e9})).toString('base64url') + '.' + c, SECRET), null);
  assert.equal(readPass('nonsense', SECRET), null);
});

test('a free visitor gets 3 questions a day, then the paywall; the owner is never counted', async () => {
  const {ask, client} = setup();
  const status = await (await call(ask, 'GET')).json();
  assert.deepEqual([status.access, status.remaining, status.billing, status.price], ['free', 3, true, PLAN.price]);
  for (let i = 0; i < 3; i++) assert.equal((await readAnswer(await call(ask, 'POST'))).end.type, 'done');
  const blocked = await call(ask, 'POST');
  assert.equal(blocked.status, 402);
  const body = await blocked.json();
  assert.deepEqual([body.type, body.reason, body.price], ['paywall', 'free_used', '$4.99/month']);
  assert.equal(client.calls.length, 3, 'the paywall answer never reaches Claude');
  assert.equal((await (await call(ask, 'GET', {ip: '2.2.2.2'})).json()).remaining, 3, 'another visitor has their own 3');
  for (let i = 0; i < 5; i++) assert.equal((await call(ask, 'POST', {key: OWNER})).status, 200);
  assert.equal((await (await call(ask, 'GET', {key: OWNER})).json()).access, 'owner');
});

test('free questions stop site-wide at the daily ceiling', async () => {
  const {ask} = setup();
  for (let i = 0; i < PLAN.freeSiteWidePerDay; i++) await readAnswer(await call(ask, 'POST', {ip: '10.0.' + Math.floor(i / 3) + '.' + (i % 3)}));
  assert.equal((await call(ask, 'POST', {ip: '9.9.9.9'})).status, 402);
});

test('a paid pass allows 50 a day, then explains the limit; questions reset the next day', async () => {
  let now = DAY;
  const {ask, access} = setup({now: () => now});
  const pass = access.passFor({id: 'sub_123', customer: 'cus_123', items: {data: [{current_period_end: DAY / 1000 + 86400 * 30}]}});
  const status = await (await call(ask, 'GET', {pass})).json();
  assert.deepEqual([status.access, status.remaining], ['paid', 50]);
  for (let i = 0; i < 50; i++) await readAnswer(await call(ask, 'POST', {pass}));
  const capped = await call(ask, 'POST', {pass});
  assert.equal(capped.status, 429);
  assert.equal((await capped.json()).type, 'limit');
  now += 24 * 3600 * 1000;
  assert.equal((await (await call(ask, 'GET', {pass})).json()).remaining, 50);
});

test('an expired pass renews from Stripe while the subscription is active, and ends when it is cancelled', async () => {
  const old = signPass({v: 1, sub: 'sub_123', cus: 'cus_123', exp: DAY / 1000 - 60}, SECRET);
  const live = setup();
  const res = await call(live.ask, 'POST', {pass: old});
  assert.equal(res.status, 200);
  const fresh = res.headers.get('x-eddy-pass');
  assert.ok(readPass(fresh, SECRET).exp > DAY / 1000, 'a renewed pass comes back in the x-eddy-pass header');
  await readAnswer(res);
  const status = await (await call(live.ask, 'GET', {pass: old})).json();
  assert.ok(status.pass, 'and in the status check');

  const gone = setup({stripe: fakeStripe({subStatus: 'canceled'})});
  const s2 = await (await call(gone.ask, 'GET', {pass: old})).json();
  assert.deepEqual([s2.access, s2.expired], ['free', true], 'a cancelled pass falls back to free questions');
  for (let i = 0; i < 3; i++) await readAnswer(await call(gone.ask, 'POST', {pass: old}));
  assert.equal((await (await call(gone.ask, 'POST', {pass: old})).json()).reason, 'expired');
});

test('checkout, redeem and manage: Stripe is only reached for allowed sites and real payments', async () => {
  const {billing, stripe, ask} = setup();
  const out = await (await call(billing, 'POST', {path: '/api/eddy/checkout', body: {return_to: SITE + '/#/water/rogue-river-touvelle'}})).json();
  assert.match(out.url, /^https:\/\/checkout\.stripe\.com\//);
  const args = stripe.calls[0][1];
  assert.equal(args.successUrl, SITE + '/?eddy_paid={CHECKOUT_SESSION_ID}');
  assert.equal(args.cancelUrl, SITE + '/?eddy_cancel=1');
  await call(billing, 'POST', {path: '/api/eddy/checkout', body: {return_to: 'https://evil.example/steal'}});
  assert.equal(stripe.calls[1][1].successUrl, SITE + '/?eddy_paid={CHECKOUT_SESSION_ID}', 'a return address on another site is ignored');
  assert.equal((await call(billing, 'POST', {path: '/api/eddy/checkout', origin: 'https://evil.example'})).status, 403);

  assert.equal((await call(billing, 'POST', {path: '/api/eddy/redeem', body: {session_id: 'cs_test_open'}})).status, 402, 'an unpaid checkout gives no pass');
  assert.equal((await call(billing, 'POST', {path: '/api/eddy/redeem', body: {session_id: '../x'}})).status, 400);
  const {pass} = await (await call(billing, 'POST', {path: '/api/eddy/redeem', body: {session_id: 'cs_test_done'}})).json();
  assert.equal(readPass(pass, SECRET).sub, 'sub_123');
  assert.equal((await (await call(ask, 'GET', {pass})).json()).access, 'paid', 'the new pass works at once');

  assert.equal((await call(billing, 'POST', {path: '/api/eddy/portal'})).status, 401);
  const portal = await (await call(billing, 'POST', {path: '/api/eddy/portal', pass, body: {return_to: SITE + '/'}})).json();
  assert.match(portal.url, /^https:\/\/billing\.stripe\.com\//);
});

test('without Stripe, Eddy stays owner-only and passes are not on sale', async () => {
  const access = createAccess({ownerHash: sha256(OWNER)});
  const ask = createAskHandler({getContext: async () => context, client: fakeClient(), allowedOrigins: [SITE], access, onUsage: quiet});
  assert.equal((await call(ask, 'GET')).status, 401);
  assert.equal((await call(ask, 'POST')).status, 401);
  assert.equal((await (await call(ask, 'GET', {key: OWNER})).json()).billing, false);
  const billing = createBillingHandler({access, stripe: null, passSecret: null, allowedOrigins: [SITE]});
  assert.equal((await call(billing, 'POST', {path: '/api/eddy/checkout'})).status, 404);
});

test('the checkout routes are rate limited per visitor', async () => {
  const {billing} = setup();
  let last;
  for (let i = 0; i < 21; i++) last = await call(billing, 'POST', {path: '/api/eddy/checkout', ip: '7.7.7.7'});
  assert.equal(last.status, 429);
  assert.equal((await call(billing, 'POST', {path: '/api/eddy/checkout', ip: '8.8.8.8'})).status, 200);
});
