// Offline tests for water alerts and the yearly pass. Stand-ins replace Stripe and the email service.
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSite, localSource} from './context.mjs';
import {factsFor, digest, followables, renderEmail, runAlerts, createAlertsHandler, memoryAlertStore, stopToken, readStopToken, MAX_WATERS} from './alerts.mjs';
import {createAccess, createBillingHandler, memoryUsage, sha256, readPass, PLAN} from './access.mjs';
import {createAskHandler} from './ask.mjs';

const g = await loadSite(localSource());
const TODAY = '2026-11-19', NOW = Date.parse('2026-11-19T16:00:00Z');
const SECRET = 'test-secret', OWNER = 'owner-code', SITE = 'https://oregonfishforecast.com', STOP = 'https://eddy.example/api/eddy/stop';
const POND = 's:Junction City Pond';          // 1,000 trout planned for the week of Nov 23 in the checked-in data
const DESCHUTES = 'lower-deschutes-moody';     // scored Good (70) in the checked-in data
const withRow = (site, row) => ({...site, ORFF_STOCKING: {...site.ORFF_STOCKING, rows: [...site.ORFF_STOCKING.rows, row]}});

function fakeStripe({status = 'active', email = 'guest@example.com'} = {}) {
  const calls = [];
  const sub = {id: 'sub_123', customer: 'cus_123', status, items: {data: [{current_period_end: NOW / 1000 + 365 * 86400}]}};
  return {calls, testMode: true,
    createCheckout: async args => { calls.push(['checkout', args]); return {url: 'https://checkout.stripe.com/c/pay/cs_test_abc'}; },
    getCheckout: async () => ({status: 'complete', subscription: sub}),
    getSubscription: async id => { calls.push(['subscription', id]); return sub; },
    getCustomer: async id => { calls.push(['customer', id]); return {id, email}; },
    createPortal: async () => ({url: 'https://billing.stripe.com/p/session/abc'})};
}
function fakeMailer({fail = false} = {}) {
  const sent = [];
  return {sent, send: async m => { if (fail) throw new Error('down'); sent.push(m); }, sendMany: async list => { if (fail) throw new Error('down'); sent.push(...list); }};
}
function setup({stripe = fakeStripe(), mailer = fakeMailer(), site = g} = {}) {
  const usage = memoryUsage(), store = memoryAlertStore();
  const access = createAccess({ownerHash: sha256(OWNER), stripe, passSecret: SECRET, usage, salt: 's', now: () => NOW, freePerDay: 0});
  const alerts = createAlertsHandler({access, store, mailer, getSite: async () => site, stripe, secret: SECRET, allowedOrigins: [SITE], siteUrl: SITE + '/', stopBase: STOP, usage, now: () => NOW});
  const pass = access.passFor({id: 'sub_123', customer: 'cus_123', items: {data: [{current_period_end: NOW / 1000 + 365 * 86400}]}});
  return {access, alerts, store, mailer, stripe, pass, usage};
}
const call = (handler, method, path, {key, pass, body, origin = SITE} = {}) => handler(new Request('https://eddy.example' + path, {
  method, headers: {'content-type': 'application/json', origin, 'x-forwarded-for': '1.1.1.1', ...(key ? {'x-eddy-key': key} : {}), ...(pass ? {'x-eddy-pass': pass} : {})},
  body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined
}));

test('facts: stocking a week ahead, a Good score, rules and ODFW report mentions', () => {
  const f = factsFor(g, [POND, DESCHUTES, 'diamond-lake'], {today: TODAY, now: NOW});
  const pond = f.get(POND).facts;
  assert.equal(pond[0].kind, 'stocking');
  assert.match(pond[0].title, /^1,000 trout planned next week$/);
  const des = f.get(DESCHUTES).facts.map(x => x.key);
  assert.ok(des.includes('score:good'));
  assert.ok(des.some(k => k.startsWith('rule:')));
  assert.ok(f.get('diamond-lake').facts.some(x => x.kind === 'reports' && /Diamond Lake/.test(x.detail)));
  assert.ok(followables(g).size > 200, 'every water on the ODFW schedule can be followed');
});

test('a fact is sent once, and again only after it has gone for a week', () => {
  const rec = {waters: [POND], seen: {}};
  const day1 = digest(rec, factsFor(g, rec.waters, {today: TODAY, now: NOW}), TODAY);
  assert.equal(day1.groups.length, 1);
  const day2 = digest({...rec, seen: day1.seen}, factsFor(g, rec.waters, {today: '2026-11-20', now: NOW + 86400000}), '2026-11-20');
  assert.equal(day2.groups.length, 0, 'nothing new the next day');
  // A new row on the schedule is news.
  const site = withRow(g, {...g.ORFF_STOCKING.rows.find(r => r.waterbody === 'Junction City Pond'), week_start: '2026-11-23', total: 2500, waterbody: 'Junction City Pond'});
  const facts = factsFor(site, rec.waters, {today: '2026-11-20', now: NOW + 86400000});
  assert.ok(facts.get(POND).facts.length >= 1);
});

test('a score that wobbles across the line does not send every day; Excellent replaces Good', () => {
  const fact = k => new Map([[DESCHUTES, {name: 'Lower Deschutes', url: 'u', facts: k.map(key => ({kind: 'score', key, title: key, detail: ''}))}]]);
  let rec = {waters: [DESCHUTES], seen: {}};
  let d = digest(rec, fact(['score:good']), '2026-11-01'); assert.equal(d.groups.length, 1); rec.seen = d.seen;
  d = digest(rec, fact([]), '2026-11-02'); rec.seen = d.seen;
  d = digest(rec, fact(['score:good']), '2026-11-03'); assert.equal(d.groups.length, 0, 'back within a week: quiet'); rec.seen = d.seen;
  d = digest(rec, fact([]), '2026-11-04'); rec.seen = d.seen;
  d = digest(rec, fact([]), '2026-11-12'); rec.seen = d.seen;
  d = digest(rec, fact(['score:good', 'score:excellent']), '2026-11-13');
  assert.deepEqual(d.groups[0].items.map(i => i.key), ['score:excellent']);
});

test('turned-off kinds are not sent, and turning them on later does not send old news', () => {
  const facts = factsFor(g, [DESCHUTES], {today: TODAY, now: NOW});
  const off = digest({waters: [DESCHUTES], seen: {}, kinds: {score: false, rules: false, reports: false}}, facts, TODAY);
  assert.ok(off.groups.every(gr => gr.items.every(i => !['score', 'rules', 'reports'].includes(i.kind))));
  const on = digest({waters: [DESCHUTES], seen: off.seen}, facts, '2026-11-20');
  assert.equal(on.groups.length, 0);
});

test('the email names the waters, links the page and carries a stop link', () => {
  const {groups} = digest({waters: [POND], seen: {}}, factsFor(g, [POND], {today: TODAY, now: NOW}), TODAY);
  const m = renderEmail({groups, siteUrl: SITE + '/', stopUrl: STOP + '?t=x', today: TODAY});
  assert.equal(m.subject, 'Junction City Pond: 1,000 trout planned next week');
  assert.match(m.html, /Stop these emails/);
  assert.match(m.text, /Stop these emails: https:\/\/eddy\.example\/api\/eddy\/stop\?t=x/);
  assert.doesNotMatch(m.html, /<script/i);
});

test('the owner sets an email and follows waters; a new water starts quiet', async () => {
  const {alerts, store} = setup();
  let r = await call(alerts, 'GET', '/api/eddy/alerts', {key: OWNER});
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).waters, []);
  r = await call(alerts, 'POST', '/api/eddy/alerts', {key: OWNER, body: {email: 'me@example.com', waters: [POND, DESCHUTES]}});
  const view = await r.json();
  assert.equal(view.email, 'me@example.com');
  assert.deepEqual(view.waters.map(w => w.key), [POND, DESCHUTES]);
  const rec = await store.get('owner');
  assert.ok(rec.seen[POND]['stock:Junction City Pond:2026-11-23'], 'what is already planned is marked seen');
  assert.equal((await call(alerts, 'POST', '/api/eddy/alerts', {key: OWNER, body: {waters: ['nowhere']}})).status, 400);
  assert.equal((await call(alerts, 'POST', '/api/eddy/alerts', {key: OWNER, body: {email: 'not an email'}})).status, 400);
  const many = [...followables(g).keys()].slice(0, MAX_WATERS + 1);
  assert.equal((await call(alerts, 'POST', '/api/eddy/alerts', {key: OWNER, body: {waters: many}})).status, 400);
});

test('a pass holder gets alerts at the email on their Stripe subscription and cannot change it here', async () => {
  const {alerts, store, pass} = setup();
  const view = await (await call(alerts, 'GET', '/api/eddy/alerts', {pass})).json();
  assert.equal(view.email, 'guest@example.com');
  assert.equal(view.email_editable, false);
  assert.equal((await call(alerts, 'POST', '/api/eddy/alerts', {pass, body: {email: 'other@example.com'}})).status, 400);
  await call(alerts, 'POST', '/api/eddy/alerts', {pass, body: {waters: [POND]}});
  const rec = await store.get('sub_123');
  assert.equal(rec.email, 'guest@example.com');
  assert.ok(rec.paid_through > NOW / 1000, 'remembers when the pass next needs a Stripe check');
});

test('strangers and other sites are refused', async () => {
  const {alerts} = setup();
  assert.equal((await call(alerts, 'GET', '/api/eddy/alerts')).status, 401);
  assert.equal((await call(alerts, 'GET', '/api/eddy/alerts', {key: OWNER, origin: 'https://evil.example'})).status, 403);
});

test('a sample email goes out now, three a day', async () => {
  const {alerts, mailer} = setup();
  await call(alerts, 'POST', '/api/eddy/alerts', {key: OWNER, body: {email: 'me@example.com', waters: [POND]}});
  const r = await call(alerts, 'POST', '/api/eddy/alerts/test', {key: OWNER});
  assert.equal(r.status, 200);
  assert.equal(mailer.sent[0].to, 'me@example.com');
  assert.match(mailer.sent[0].subject, /^Sample Eddy alert/);
  assert.match(mailer.sent[0].text, /1,000 trout planned next week/, 'a sample shows what is current');
  for (let i = 0; i < 2; i++) await call(alerts, 'POST', '/api/eddy/alerts/test', {key: OWNER});
  assert.equal((await call(alerts, 'POST', '/api/eddy/alerts/test', {key: OWNER})).status, 429);
  const noMail = setup({mailer: null});
  await call(noMail.alerts, 'POST', '/api/eddy/alerts', {key: OWNER, body: {email: 'me@example.com', waters: [POND]}});
  assert.equal((await call(noMail.alerts, 'POST', '/api/eddy/alerts/test', {key: OWNER})).status, 503);
});

test('the stop link shows a button, and only the POST stops the emails', async () => {
  const {alerts, store} = setup();
  await call(alerts, 'POST', '/api/eddy/alerts', {key: OWNER, body: {email: 'me@example.com', waters: [POND]}});
  const t = stopToken('owner', SECRET);
  assert.equal(readStopToken(t, SECRET), 'owner');
  assert.equal(readStopToken(t, 'other'), null);
  const get = await alerts(new Request(STOP + '?t=' + t));
  assert.match(await get.text(), /<form method="post">/);
  assert.equal((await store.get('owner')).stopped, false, 'opening the link (or a mail scanner) does not stop anything');
  await alerts(new Request(STOP + '?t=' + t, {method: 'POST'}));
  assert.equal((await store.get('owner')).stopped, true);
  assert.equal((await alerts(new Request(STOP + '?t=bad.token'))).status, 400);
  await call(alerts, 'POST', '/api/eddy/alerts', {key: OWNER, body: {waters: [POND]}});
  assert.equal((await store.get('owner')).stopped, false, 'saving alerts again turns them back on');
});

test('the morning run emails what is new, once a day, and checks ended passes with Stripe', async () => {
  const store = memoryAlertStore(), mailer = fakeMailer();
  await store.put('owner', {id: 'owner', kind: 'owner', email: 'me@example.com', waters: [POND], seen: {}});
  await store.put('owner-quiet', {id: 'owner-quiet', kind: 'owner', email: 'q@example.com', waters: [POND], seen: {[POND]: {'stock:Junction City Pond:2026-11-23': TODAY}}});
  await store.put('stopped', {id: 'stopped', kind: 'owner', email: 's@example.com', waters: [POND], seen: {}, stopped: true});
  await store.put('sub_old', {id: 'sub_old', kind: 'paid', email: 'old@example.com', waters: [POND], seen: {}, paid_through: NOW / 1000 - 10});
  const run = stripe => runAlerts({loadSite: async () => g, store, mailer, stripe, secret: SECRET, siteUrl: SITE + '/', stopBase: STOP, now: () => NOW, log: () => {}});
  const out = await run(fakeStripe({status: 'canceled'}));
  assert.deepEqual(mailer.sent.map(m => m.to), ['me@example.com']);
  assert.equal(out.emailed, 1);
  assert.match(mailer.sent[0].headers['List-Unsubscribe'], /api\/eddy\/stop\?t=/);
  assert.equal((await store.get('sub_old')).inactive, true, 'a cancelled subscription gets no more alerts');
  assert.equal((await store.get('owner')).last_sent_on, TODAY);
  await run(fakeStripe());
  assert.equal(mailer.sent.length, 1, 'a second run the same day sends nothing');
});

test('a failed send is tried again on the next run', async () => {
  const store = memoryAlertStore();
  await store.put('owner', {id: 'owner', kind: 'owner', email: 'me@example.com', waters: [POND], seen: {}});
  const args = mailer => ({loadSite: async () => g, store, mailer, secret: SECRET, siteUrl: SITE + '/', stopBase: STOP, now: () => NOW, log: () => {}});
  await assert.rejects(runAlerts(args(fakeMailer({fail: true}))));
  assert.equal((await store.get('owner')).checked_on, undefined);
  const ok = fakeMailer();
  await runAlerts(args(ok));
  assert.equal(ok.sent.length, 1);
});

test('the yearly pass: checkout sells the plan asked for, the status lists both, and a yearly pass is rechecked monthly', async () => {
  const stripe = fakeStripe();
  const access = createAccess({ownerHash: sha256(OWNER), stripe, passSecret: SECRET, usage: memoryUsage(), salt: 's', now: () => NOW});
  const billing = createBillingHandler({access, stripe, passSecret: SECRET, allowedOrigins: [SITE]});
  await call(billing, 'POST', '/api/eddy/checkout', {body: {plan: 'year'}});
  await call(billing, 'POST', '/api/eddy/checkout', {body: {plan: 'lifetime'}});
  assert.deepEqual(stripe.calls.filter(c => c[0] === 'checkout').map(c => c[1].option), ['year', 'month']);
  const ask = createAskHandler({getContext: async () => ({today: TODAY, text: '', waters: []}), client: {}, allowedOrigins: [SITE], access, onUsage: () => {}});
  const status = await (await call(ask, 'GET', '/api/ask')).json();
  assert.deepEqual(status.plans.map(p => [p.id, p.price]), [['month', '$4.99/month'], ['year', '$39.99/year']]);
  assert.equal(PLAN.options.year.amountCents, 3999);
  const pass = access.passFor({id: 'sub_y', customer: 'cus_y', items: {data: [{current_period_end: NOW / 1000 + 365 * 86400}]}});
  const days = (readPass(pass, SECRET).exp - NOW / 1000) / 86400;
  assert.ok(days > 30 && days < 35, 'a yearly pass still checks in with Stripe about monthly');
});
