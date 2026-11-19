/* Eddy: the AI fishing assistant, a chat panel where visitors ask about the guide waters. Answers come from Claude Haiku on the
   server (server/ask.mjs), grounded in the same data files this page reads. The panel only appears when
   assets/ask-config.js names an endpoint, so the static site never shows a chat that cannot answer.
   The conversation is kept for this tab only (sessionStorage).

   Who can use Eddy (server/access.mjs decides; this script only carries the proof):
   - The owner: the unlock link (?eddy=<code>) saves the owner's code in this browser. Free and unlimited.
   - Guests with an Eddy pass: bought through Stripe checkout ($4.99/month or $39.99/year). Stripe sends them back with
     ?eddy_paid=<checkout id>; the pass is saved in this browser, and a personal link (?eddy_pass=<pass>) opens
     Eddy on another device.
   - Free visitors: a few questions a day, then an offer of a pass. Only when passes are on sale:
     ask-config.js `sell: true`, or this browser opened once with ?eddy_shop=1 (to test before going live).
   Without any of these the page never contacts Eddy. ?eddy=off forgets the code, the pass and the test flag.

   Water alerts (server/alerts.mjs): the owner and pass holders follow waters, from the Alerts view in the panel or the
   "Follow this water" button on a water page (the .d-follow slot app.js leaves in the page header), and get one email a
   morning when something new happens on them. */
(() => {
  'use strict';
  const config = window.ORFF_ASK || {};
  const endpoint = config.endpoint;
  if (!endpoint) return;
  const billingBase = config.billing || endpoint.replace(/\/api\/ask$/, '/api/eddy');
  const CODE = 'orff-eddy.code', PASS = 'orff-eddy.pass', SHOP = 'orff-eddy.shop', PENDING = 'orff-eddy.pending';
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} }
  };
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch {} }
  };

  // Read and remove Eddy's own address-bar settings, so codes and passes are not bookmarked or shared by accident.
  const params = new URLSearchParams(location.search);
  const take = name => { if (!params.has(name)) return null; const v = (params.get(name) || '').trim(); params.delete(name); return v; };
  const unlock = take('eddy'), passLink = take('eddy_pass'), paidSession = take('eddy_paid'), cancelled = take('eddy_cancel'), shopFlag = take('eddy_shop');
  if ([unlock, passLink, paidSession, cancelled, shopFlag].some(v => v != null)) {
    const rest = params.toString();
    window.history.replaceState(window.history.state, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
  }
  if (unlock === 'off') { ls.set(CODE, null); ls.set(PASS, null); ls.set(SHOP, null); }
  else if (unlock) ls.set(CODE, unlock);
  if (passLink) ls.set(PASS, passLink);
  if (shopFlag != null) ls.set(SHOP, shopFlag === '0' ? null : '1');

  let code = ls.get(CODE), pass = ls.get(PASS);
  const selling = !!config.sell || ls.get(SHOP) === '1';
  if (config.private && !code && !pass && !selling && !paidSession) return;
  const proof = () => ({...(code ? {'x-eddy-key': code} : {}), ...(pass ? {'x-eddy-pass': pass} : {})});
  const setPass = value => { if (value && value !== pass) { pass = value; ls.set(PASS, value); } };

  const waters = window.ORFF_DATA?.waters || [];
  const byId = new Map(waters.map(w => [w.id, w]));
  const ICONS = window.V2_ICONS || {};
  const icon = name => ICONS[name] ? '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>' : '';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const MAX = 800, KEY = 'orff-ask.v1';
  const store = {
    load() { try { const v = JSON.parse(sessionStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter(m => m && typeof m.content === 'string') : []; } catch { return []; } },
    save(v) { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch {} }
  };
  const pageWater = () => { const m = location.hash.match(/^#\/water\/([^?/]+)/); return m && byId.has(m[1]) ? m[1] : null; };
  const small = matchMedia('(max-width: 640px)');
  const pageAddress = () => location.origin + location.pathname;

  /* ---------- Answer formatting: paragraphs, "- " bullets, **bold** and safe links only ---------- */
  function linkHTML(label, href) {
    const water = href.match(/^#\/water\/([a-z0-9-]+)$/);
    if (water && byId.has(water[1])) return '<a class="ask-link" href="' + esc(href) + '" data-internal>' + label + '</a>';
    if (href === 'classic/#/stocking' || href === '#/stocking' || href === '#/counts') return '<a class="ask-link" href="' + esc(href) + '" data-internal>' + label + '</a>';
    if (/^https:\/\/[^\s<>"']+$/.test(href)) return '<a class="ask-link" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + label + '<span class="sr-only"> (opens in a new tab)</span></a>';
    return label;
  }
  function inline(text) {
    const links = [];
    const hold = html => '\u0000' + (links.push(html) - 1) + '\u0000';
    let s = text.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, label, href) => hold(linkHTML(esc(label), href)));
    s = s.replace(/https:\/\/[^\s<>"'()]+[^\s<>"'().,;:!?]/g, url => hold(linkHTML(esc(url.replace(/^https:\/\/(www\.)?/, '').split(/[/?#]/)[0]), url)));
    s = esc(s).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => links[i]);
  }
  function format(md) {
    const out = [];
    let list = null, para = [];
    const flushPara = () => { if (para.length) out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; };
    const flushList = () => { if (list) out.push('<ul>' + list.map(li => '<li>' + inline(li) + '</li>').join('') + '</ul>'); list = null; };
    for (const raw of md.replace(/\r/g, '').split('\n')) {
      const line = raw.trim();
      const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
      if (bullet) { flushPara(); (list ||= []).push(bullet[1]); }
      else if (!line) { flushPara(); flushList(); }
      else { flushList(); para.push(line.replace(/^#+\s*/, '')); }
    }
    flushPara(); flushList();
    return out.join('');
  }

  /* ---------- Markup ---------- */
  const launch = document.createElement('button');
  launch.type = 'button';
  launch.className = 'ask-launch';
  launch.setAttribute('aria-expanded', 'false');
  launch.setAttribute('aria-controls', 'ask-panel');
  launch.innerHTML = icon('compass-linear') + '<span>Ask Eddy</span>';

  const panel = document.createElement('section');
  panel.className = 'ask-panel';
  panel.id = 'ask-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'ask-title');
  panel.innerHTML =
    '<header class="ask-head"><div><p class="eyebrow on-ink">AI fishing assistant</p><h2 id="ask-title" class="display">Eddy</h2></div>' +
      '<div class="ask-head-actions"><button type="button" class="ask-reset ask-alerts-btn" hidden>Alerts</button><button type="button" class="ask-reset ask-new" hidden>New chat</button>' +
      '<button type="button" class="ask-close" aria-label="Close Eddy">' + icon('close-circle-linear') + '</button></div></header>' +
    '<div class="ask-log" data-lenis-prevent tabindex="-1"></div>' +
    '<section class="ask-alerts" data-lenis-prevent hidden aria-labelledby="ask-alerts-title"></section>' +
    '<p class="sr-only" aria-live="polite" data-ask-status></p>' +
    '<p class="ask-plan" hidden></p>' +
    '<form class="ask-form" novalidate>' +
      '<label class="sr-only" for="ask-input">Your question</label>' +
      '<textarea id="ask-input" rows="1" maxlength="' + MAX + '" placeholder="Ask Eddy about a river or lake" autocomplete="off"></textarea>' +
      '<button type="submit" class="ask-send" aria-label="Send question">' + icon('arrow-right-linear') + '</button>' +
    '</form>' +
    '<p class="ask-note">Eddy is an AI built on Claude. It answers from this morning’s reports, gauges, counts and stocking on this site, and it can be wrong. Check ODFW’s current rules before you fish.</p>';

  const log = panel.querySelector('.ask-log'), form = panel.querySelector('form'), input = panel.querySelector('textarea');
  const reset = panel.querySelector('.ask-new'), status = panel.querySelector('[data-ask-status]'), planLine = panel.querySelector('.ask-plan');
  const alertsBtn = panel.querySelector('.ask-alerts-btn'), alertsBox = panel.querySelector('.ask-alerts');
  let history = store.load(), busy = null, plan = null, planAt = 0, shown = false, alerts = null;

  /* ---------- Status: who this browser is to Eddy, and what is left today ---------- */
  async function fetchStatus() {
    try {
      const res = await fetch(endpoint, {method: 'GET', cache: 'no-store', headers: proof()});
      // A refused owner code (mistyped, or replaced by the owner) is forgotten so this browser stops sending it.
      if (res.status === 401) { if (code) { ls.set(CODE, null); code = null; } return null; }
      const s = res.ok ? await res.json() : null;
      if (s?.pass) setPass(s.pass);
      if (s?.ok) { plan = s; planAt = Date.now(); renderPlan(); alertsBtn.hidden = !alertsOK(); paintFollow(); }
      return s;
    } catch { return null; }
  }
  function renderPlan() {
    if (!plan || plan.access === 'owner' || !plan.billing) { planLine.hidden = true; return; }
    const left = plan.remaining;
    planLine.innerHTML = plan.access === 'paid'
      ? 'Eddy pass · ' + left + ' of ' + plan.limit + ' questions left today · <button type="button" class="ask-textbtn ask-manage">Manage subscription</button>'
      : plan.limit === 0 ? 'Eddy pass · ' + prices() + ' · <button type="button" class="ask-textbtn ask-offer">Get Eddy</button>'
      : left + ' of ' + plan.limit + ' free questions left today · <button type="button" class="ask-textbtn ask-offer">Get Eddy</button>';
    if (plan.test_mode) planLine.insertAdjacentHTML('beforeend', '<span class="ask-test">Stripe test mode: pay with card 4242 4242 4242 4242, any future date and CVC.</span>');
    planLine.hidden = false;
  }
  const plansOf = info => info?.plans || plan?.plans || [{id: 'month', price: info?.price || plan?.price || '$4.99/month'}];
  const priceWords = p => p.price.replace('/', ' a ');
  const prices = () => plansOf().map(p => esc(p.price)).join(' or ');
  function paywallHTML(info) {
    const per = info?.paid_per_day || plan?.paid_per_day || 50;
    return '<p><strong>' + esc(info?.message || 'You’ve used today’s free questions.') + '</strong></p>' +
      '<p>An Eddy pass gets you up to ' + per + ' questions a day about every river and lake on the site, plus a morning email when something new happens on the waters you follow. Cancel anytime.</p>' +
      '<div class="ask-buy-row">' + plansOf(info).map((p, i) => '<button type="button" class="ask-buy ' + (i ? 'ask-buy-alt' : 'ask-buy-main') + '" data-plan="' + esc(p.id) + '">' + esc(priceWords(p)) + (p.note ? ' <small>' + esc(p.note) + '</small>' : '') + '</button>').join('') + '</div>' +
      '<p class="ask-fine">Already have a pass? Open your personal Eddy link on this device.</p>';
  }

  /* ---------- Buying, returning from Stripe, and managing a pass ---------- */
  async function billing(route, body, note) {
    const res = await fetch(billingBase + '/' + route, {method: 'POST', headers: {'content-type': 'application/json', ...proof()}, body: JSON.stringify({return_to: pageAddress(), ...body})});
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out) throw Object.assign(new Error(out?.message || note), {status: res.status});
    return out;
  }
  async function checkout(button) {
    const choice = button?.dataset.plan || 'month';
    if (button) { button.closest('.ask-buy-row')?.querySelectorAll('button').forEach(b => { b.disabled = true; }); button.textContent = 'Opening secure checkout…'; }
    try {
      const {url} = await billing('checkout', {plan: choice}, 'Checkout did not open.');
      if (!/^https:\/\/checkout\.stripe\.com\//.test(url)) throw new Error('Checkout did not open.');
      location.href = url;
    } catch (e) {
      if (button) { button.closest('.ask-buy-row')?.querySelectorAll('button').forEach(b => { b.disabled = false; }); button.textContent = 'Try checkout again'; }
      bubble('guide', '<p class="ask-error-note">' + esc(e.message || 'Checkout did not open. Try again shortly.') + '</p>').classList.add('ask-error');
    }
  }
  async function manage(button) {
    if (button) button.disabled = true;
    try { const {url} = await billing('portal', {}, 'Could not open your subscription.'); if (/^https:\/\/billing\.stripe\.com\//.test(url)) location.href = url; }
    catch (e) { if (button) button.disabled = false; bubble('guide', '<p class="ask-error-note">' + esc(e.message) + '</p>').classList.add('ask-error'); }
  }
  async function redeem(sessionId) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const out = await billing('redeem', {session_id: sessionId}, 'Could not confirm your payment.');
        setPass(out.pass);
        return true;
      } catch (e) {
        if (e.status !== 402 || attempt === 3) { bubble('guide', '<p class="ask-error-note">' + esc(e.message) + ' If you were charged, open the link in your Stripe receipt email or contact the site owner.</p>').classList.add('ask-error'); return false; }
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    return false;
  }
  function welcome() {
    const link = pageAddress() + '?eddy_pass=' + encodeURIComponent(pass);
    const el = bubble('guide', '<p><strong>You’re in. Your Eddy pass is active.</strong> Ask away: up to ' + (plan?.limit || 50) + ' questions a day.</p>' +
      '<p>To use Eddy on your phone or another computer, open your personal link there. Keep it to yourself; it carries your pass.</p>' +
      '<p>Want a heads-up when your waters get stocked or turn good? Open <button type="button" class="ask-textbtn ask-alerts-open">Alerts</button> and pick them.</p>' +
      '<p><button type="button" class="ask-copy" data-link="' + esc(link) + '">Copy my personal link</button></p>');
    el.classList.add('ask-welcome');
  }

  /* ---------- Water alerts ---------- */
  const alertsOK = () => !!plan && (plan.access === 'owner' || plan.access === 'paid');
  async function alertsCall(method, path, body) {
    const res = await fetch(billingBase + '/' + path, {method, cache: 'no-store', headers: {'content-type': 'application/json', ...proof()}, body: body ? JSON.stringify(body) : undefined});
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(out?.message || 'Alerts are not available just now. Try again shortly.'), {status: res.status});
    return out;
  }
  async function loadAlerts(force) {
    if (!alerts || force) alerts = await alertsCall('GET', 'alerts');
    return alerts;
  }
  // Everything that can be followed: the guide waters, then every other water on ODFW's stocking schedule.
  let choices = null;
  function options() {
    if (choices) return choices;
    choices = waters.map(w => ({key: w.id, label: w.name + ', ' + w.reach}));
    const res = Object.values(window.ORFF_STOCKING_MATCH || {}).flat().map(n => new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'));
    const seen = new Set();
    for (const r of window.ORFF_STOCKING?.rows || []) {
      if (seen.has(r.waterbody)) continue;
      seen.add(r.waterbody);
      // Waters with a guide page are already listed under their guide name.
      if (!res.some(re => re.test(r.waterbody))) choices.push({key: 's:' + r.waterbody, label: r.waterbody + ' (ODFW stocking)'});
    }
    return choices;
  }
  function renderAlerts(note, isError) {
    const a = alerts;
    if (!a) return;
    const kinds = Object.entries(a.kind_labels).map(([k, label]) => '<label class="ask-check"><input type="checkbox" data-kind="' + esc(k) + '"' + (a.kinds[k] ? ' checked' : '') + '><span>' + esc(label) + '</span></label>').join('');
    alertsBox.innerHTML =
      '<button type="button" class="ask-textbtn ask-back">' + icon('arrow-left-linear') + 'Back to chat</button>' +
      '<h3 id="ask-alerts-title" class="ask-alerts-h" tabindex="-1">Water alerts</h3>' +
      '<p class="ask-alerts-lede">One email a morning when something new happens on the waters you follow. Nothing new, no email.</p>' +
      (a.sending ? '' : '<p class="ask-alerts-warn">Alert emails are not switched on yet. Your choices are saved, and emails start once they are.</p>') +
      (a.stopped ? '<p class="ask-alerts-warn">You stopped these emails from a link in one. Save any change here to turn them back on.</p>' : '') +
      '<div class="ask-field"><label class="ask-label" for="ask-email">Send to</label>' + (a.email_editable
        ? '<div class="ask-row"><input id="ask-email" type="email" autocomplete="email" value="' + esc(a.email || '') + '" placeholder="you@example.com"><button type="button" class="ask-mini ask-email-save">Save</button></div>'
        : '<p id="ask-email" class="ask-email">' + esc(a.email || 'The email on your Eddy pass') + '</p><p class="ask-fine">To change it, use <button type="button" class="ask-textbtn ask-manage">Manage subscription</button>.</p>') + '</div>' +
      '<div class="ask-field"><p class="ask-label">Following ' + a.waters.length + ' of ' + a.max + '</p>' + (a.waters.length
        ? '<ul class="ask-follow-list">' + a.waters.map(w => '<li><span><strong>' + esc(w.name) + '</strong>' + (w.detail ? '<small>' + esc(w.detail) + '</small>' : '') + '</span><button type="button" class="ask-mini ask-unfollow" data-key="' + esc(w.key) + '" aria-label="Stop following ' + esc(w.name) + '">Remove</button></li>').join('') + '</ul>'
        : '<p class="ask-fine">None yet. Add one below, or use “Follow this water” on any water page.</p>') + '</div>' +
      '<form class="ask-field ask-add"><label class="ask-label" for="ask-add">Add a water</label><div class="ask-row"><input id="ask-add" list="ask-waters" autocomplete="off" placeholder="River, lake or pond"' + (a.waters.length >= a.max ? ' disabled' : '') + '><button type="submit" class="ask-mini">Add</button></div>' +
        '<datalist id="ask-waters">' + options().map(o => '<option value="' + esc(o.label) + '"></option>').join('') + '</datalist></form>' +
      '<fieldset class="ask-field ask-kinds"><legend class="ask-label">Email me about</legend>' + kinds + '</fieldset>' +
      '<p><button type="button" class="ask-mini ask-sample"' + (a.sending && a.waters.length ? '' : ' disabled') + '>Email me a sample now</button></p>' +
      '<p class="ask-alerts-msg' + (isError ? ' bad' : '') + '" role="status">' + esc(note || '') + '</p>' +
      (a.last_sent_on ? '<p class="ask-fine">Last alert email: ' + esc(a.last_sent_on) + '.</p>' : '');
  }
  const alertsNote = (text, bad) => { const el = alertsBox.querySelector('.ask-alerts-msg'); if (el) { el.textContent = text; el.classList.toggle('bad', !!bad); } };
  async function saveAlerts(patch, done) {
    try {
      alerts = await alertsCall('POST', 'alerts', patch);
      if (!alertsBox.hidden) renderAlerts(done);
      paintFollow();
      return true;
    } catch (e) {
      if (!alertsBox.hidden) alertsNote(e.message, true);
      return false;
    }
  }
  async function openAlerts(note) {
    if (!alertsOK()) return;
    panel.classList.add('show-alerts');
    alertsBox.hidden = false;
    alertsBtn.setAttribute('aria-pressed', 'true');
    if (!alerts) alertsBox.innerHTML = '<p class="ask-alerts-lede">Loading your alerts…</p>';
    try { await loadAlerts(true); renderAlerts(note); }
    catch (e) { alertsBox.innerHTML = '<button type="button" class="ask-textbtn ask-back">' + icon('arrow-left-linear') + 'Back to chat</button><p class="ask-alerts-msg bad" role="status">' + esc(e.message) + '</p>'; }
    alertsBox.querySelector('h3')?.focus({preventScroll: true});
  }
  function closeAlerts() {
    panel.classList.remove('show-alerts');
    alertsBox.hidden = true;
    alertsBtn.setAttribute('aria-pressed', 'false');
    input.focus({preventScroll: true});
  }
  alertsBox.addEventListener('submit', async e => {
    e.preventDefault();
    const field = alertsBox.querySelector('#ask-add'), text = field.value.trim().toLowerCase();
    if (!text) return;
    const pick = options().find(o => o.label.toLowerCase() === text) || options().find(o => o.label.toLowerCase().startsWith(text));
    if (!pick) { alertsNote('Pick a water from the list.', true); return; }
    if (alerts.waters.some(w => w.key === pick.key)) { alertsNote('You already follow ' + pick.label + '.'); return; }
    await saveAlerts({waters: [...alerts.waters.map(w => w.key), pick.key]}, 'Following ' + pick.label.replace(/ \(ODFW stocking\)$/, '') + '.');
    alertsBox.querySelector('#ask-add')?.focus();
  });
  alertsBox.addEventListener('change', e => {
    const box = e.target.closest('input[data-kind]');
    if (!box) return;
    const kinds = Object.fromEntries([...alertsBox.querySelectorAll('input[data-kind]')].map(x => [x.dataset.kind, x.checked]));
    saveAlerts({kinds}, 'Saved.');
  });
  alertsBox.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'ask-email') { e.preventDefault(); alertsBox.querySelector('.ask-email-save')?.click(); }
  });
  async function alertsClick(e) {
    if (e.target.closest('.ask-back')) { closeAlerts(); return true; }
    const un = e.target.closest('.ask-unfollow');
    if (un) { un.disabled = true; await saveAlerts({waters: alerts.waters.map(w => w.key).filter(k => k !== un.dataset.key)}, 'Removed.'); return true; }
    if (e.target.closest('.ask-email-save')) { await saveAlerts({email: alertsBox.querySelector('#ask-email').value.trim()}, 'Saved. Alerts go to this address.'); return true; }
    const sample = e.target.closest('.ask-sample');
    if (sample) {
      sample.disabled = true;
      try { const out = await alertsCall('POST', 'alerts/test', {}); alertsNote('Sent a sample to ' + out.sent_to + '. It can take a minute to arrive.'); }
      catch (err) { alertsNote(err.message, true); }
      sample.disabled = false;
      return true;
    }
    return false;
  }

  // The "Follow this water" button in a water page's header.
  function paintFollow() {
    const slot = document.querySelector('.d-follow[data-follow]');
    if (!slot) return;
    const id = slot.dataset.follow;
    if (alertsOK()) {
      const on = !!alerts?.waters.some(w => w.key === id);
      slot.innerHTML = '<button type="button" class="follow-btn' + (on ? ' on' : '') + '" aria-pressed="' + on + '">' + icon(on ? 'check-circle-linear' : 'calendar-linear') + '<span>' + (on ? 'Following: alerts on' : 'Follow this water') + '</span></button>';
      if (!alerts) loadAlerts().then(() => { if (alerts.waters.some(w => w.key === id)) paintFollow(); }, () => {});
    } else if (selling) {
      slot.innerHTML = '<button type="button" class="follow-btn" data-offer>' + icon('calendar-linear') + '<span>Get alerts for this water</span></button>';
    } else slot.innerHTML = '';
  }
  document.addEventListener('orff:render', paintFollow);
  document.addEventListener('click', async e => {
    const btn = e.target.closest('.follow-btn');
    if (!btn) return;
    if (btn.hasAttribute('data-offer')) { show(); open(); offer(true); return; }
    const id = btn.closest('[data-follow]')?.dataset.follow;
    if (!id || btn.disabled) return;
    btn.disabled = true;
    try {
      await loadAlerts();
      const keys = alerts.waters.map(w => w.key);
      const on = keys.includes(id);
      if (!on && keys.length >= alerts.max) { show(); open(); openAlerts('You follow ' + alerts.max + ' waters, the most alerts allow. Remove one to add this one.'); return; }
      const ok = await saveAlerts({waters: on ? keys.filter(k => k !== id) : [...keys, id]});
      // Without an address yet (the owner), open Alerts so one can be added.
      if (ok && !on && !alerts.email) { show(); open(); openAlerts('Following. Add the address to send alerts to.'); }
    } catch (err) {
      btn.title = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------- Rendering ---------- */
  function bubble(role, html) {
    const el = document.createElement('div');
    el.className = 'ask-msg ' + (role === 'user' ? 'from-user' : 'from-guide');
    el.innerHTML = '<span class="sr-only">' + (role === 'user' ? 'You said:' : 'Eddy said:') + ' </span><div class="ask-body">' + html + '</div>';
    log.append(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  function suggestions() {
    const here = byId.get(pageWater());
    const qs = [
      here && 'How is ' + here.name + ' (' + here.reach + ') looking right now?',
      'Where is the best trout fishing this week?',
      'Are coho still moving past Bonneville?',
      'Which waters have stocking coming up?',
      !here && 'What’s the best bet for steelhead right now?'
    ].filter(Boolean).slice(0, 4);
    return '<div class="ask-suggest">' + qs.map(q => '<button type="button" class="ask-chip" data-q="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div>';
  }
  function renderAll() {
    log.innerHTML = '';
    const intro = bubble('guide', '<p>I’m Eddy. Ask me how a river looks this morning, where fish are moving or what ODFW is stocking. I know the ' + waters.length + ' guide waters in detail, plus ODFW’s stocking schedule and weekly reports for the rest of Oregon. I answer only from that data and say when something is missing.</p>');
    intro.classList.add('ask-intro');
    if (!history.length) intro.insertAdjacentHTML('beforeend', suggestions());
    for (const m of history) bubble(m.role, m.role === 'user' ? '<p>' + esc(m.content).replace(/\n/g, '<br>') + '</p>' : format(m.content));
    reset.hidden = !history.length;
    log.scrollTop = log.scrollHeight;
  }
  const scrollDown = () => { if (log.scrollHeight - log.scrollTop - log.clientHeight < 140) log.scrollTop = log.scrollHeight; };

  /* ---------- Asking ---------- */
  async function ask(question) {
    question = question.trim().slice(0, MAX);
    if (!question || busy) return;
    log.querySelector('.ask-suggest')?.remove();
    history.push({role: 'user', content: question});
    bubble('user', '<p>' + esc(question).replace(/\n/g, '<br>') + '</p>');
    const out = bubble('guide', '<p class="ask-typing" aria-hidden="true"><span></span><span></span><span></span></p>');
    out.classList.add('pending');
    const body = out.querySelector('.ask-body');
    input.value = ''; grow();
    busy = new AbortController();
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Eddy is answering.';
    reset.hidden = false;
    let text = '', end = null;
    try {
      const res = await fetch(endpoint, {method: 'POST', headers: {'content-type': 'application/json', ...proof()}, body: JSON.stringify({messages: history, page: pageWater()}), signal: busy.signal});
      setPass(res.headers.get('x-eddy-pass'));
      const left = res.headers.get('x-eddy-remaining');
      if (left != null && plan) { plan.remaining = Number(left); renderPlan(); }
      if (!res.ok || !res.body) {
        end = await res.json().catch(() => null) || {type: 'error', message: 'Eddy could not answer just now. Try again shortly.'};
      } else {
        const reader = res.body.getReader(), decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const {value, done} = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, {stream: true});
          let i;
          while ((i = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, i); buffer = buffer.slice(i + 1);
            if (!line.trim()) continue;
            let msg; try { msg = JSON.parse(line); } catch { continue; }
            if (msg.type === 'text') { text += msg.text; out.classList.remove('pending'); body.innerHTML = format(text); scrollDown(); }
            else end = msg;
          }
        }
      }
    } catch (e) {
      end = e.name === 'AbortError' ? {type: 'stopped'} : {type: 'error', message: 'Could not reach Eddy. Check your connection and try again.'};
    }
    out.classList.remove('pending');
    busy = null;
    form.removeAttribute('aria-busy');
    if (end?.type === 'done' && text.trim()) {
      if (end.stop === 'max_tokens') { text += '\n\n(The answer was cut short. Ask a narrower question for the rest.)'; body.innerHTML = format(text); }
      history.push({role: 'assistant', content: text});
      store.save(history);
      status.textContent = 'Eddy answered: ' + body.innerText;
    } else {
      // A failed or refused turn is taken back out of the conversation, so the next question starts clean.
      history.pop();
      store.save(history);
      if (end?.type === 'paywall') {
        // Keep the question so it is waiting after checkout.
        ss.set(PENDING, question);
        if (plan) { plan.remaining = 0; renderPlan(); }
        out.classList.add('ask-paywall');
        body.innerHTML = paywallHTML(end);
        status.textContent = (end.message || '') + ' Get an Eddy pass to keep asking.';
      } else {
        const note = end?.type === 'refusal' || end?.type === 'limit' ? end.message : end?.type === 'stopped' ? 'Stopped.' : end?.message || 'Eddy did not answer. Try again.';
        out.classList.add('ask-error');
        body.innerHTML = (text.trim() ? format(text) : '') + '<p class="ask-error-note">' + esc(note) + '</p>' +
          (['refusal', 'stopped', 'limit'].includes(end?.type) ? '' : '<button type="button" class="ask-retry" data-q="' + esc(question) + '">Try again</button>');
        status.textContent = note;
      }
      log.scrollTop = log.scrollHeight;
    }
    if (panel.contains(document.activeElement) || document.activeElement === document.body) input.focus({preventScroll: true});
  }

  /* ---------- Open, close and controls ---------- */
  let rendered = false;
  function open() {
    if (!panel.hidden) return;
    // The log is drawn once and kept, so an answer still streaming survives closing and reopening.
    // An empty chat is redrawn so its suggestions fit the page the visitor is on now.
    if (!rendered || (!history.length && !busy)) { renderAll(); rendered = true; }
    panel.hidden = false;
    launch.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('ask-open');
    requestAnimationFrame(() => panel.classList.add('in'));
    input.focus({preventScroll: true});
    if (Date.now() - planAt > 60000) fetchStatus().then(offer); else offer();
  }
  // A visitor with no questions left (or none before launch) sees the offer as soon as Eddy opens, not after typing.
  // force: show it anyway (the "Get Eddy" link, or "Get alerts" on a water page).
  async function offer(force) {
    if (force === true && !plan) await fetchStatus();   // so the offer lists every pass option
    const card0 = log.querySelector('.ask-paywall');
    if (force === true && card0) { card0.scrollIntoView({block: 'nearest'}); card0.querySelector('.ask-buy')?.focus({preventScroll: true}); return; }
    if (force !== true && (!plan || plan.access !== 'free' || plan.remaining !== 0 || busy || card0)) return;
    const card = bubble('guide', paywallHTML({paid_per_day: plan?.paid_per_day,
      message: plan?.expired ? 'Your Eddy pass has ended.' : plan?.access === 'free' && plan.remaining === 0 ? (plan.limit === 0 ? 'Eddy is for Eddy pass holders.' : 'You’ve used today’s free questions.') : 'Get an Eddy pass.'}));
    card.classList.add('ask-paywall');
  }
  function close(returnFocus = true) {
    if (panel.hidden) return;
    panel.classList.remove('in');
    panel.hidden = true;
    launch.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('ask-open');
    if (returnFocus) launch.focus({preventScroll: true});
  }
  function grow() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 132) + 'px'; }
  function show() { if (!shown) { shown = true; document.body.append(launch, panel); } }

  launch.addEventListener('click', open);
  panel.querySelector('.ask-close').addEventListener('click', () => close());
  reset.addEventListener('click', () => { busy?.abort(); history = []; store.save(history); renderAll(); input.focus(); });
  form.addEventListener('submit', e => { e.preventDefault(); ask(input.value); });
  input.addEventListener('input', grow);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(input.value); } });
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); if (!alertsBox.hidden) closeAlerts(); else close(); } });
  alertsBtn.addEventListener('click', () => { if (alertsBox.hidden) openAlerts(); else closeAlerts(); });
  panel.addEventListener('click', async e => {
    if (!alertsBox.hidden && alertsBox.contains(e.target) && await alertsClick(e)) return;
    if (e.target.closest('.ask-alerts-open')) { openAlerts(); return; }
    if (e.target.closest('.ask-offer')) { offer(true); return; }
    const buy = e.target.closest('.ask-buy');
    if (buy) { checkout(buy); return; }
    const mg = e.target.closest('.ask-manage');
    if (mg) { manage(mg); return; }
    const copy = e.target.closest('.ask-copy');
    if (copy) {
      navigator.clipboard?.writeText(copy.dataset.link).then(() => { copy.textContent = 'Copied. Paste it on your other device.'; }, () => { window.prompt('Copy your personal Eddy link:', copy.dataset.link); });
      return;
    }
    const retry = e.target.closest('.ask-retry');
    if (retry) {
      // Take the failed exchange off the screen; ask() adds the question back.
      const failed = retry.closest('.ask-msg');
      if (failed.previousElementSibling?.classList.contains('from-user')) failed.previousElementSibling.remove();
      failed.remove();
      ask(retry.dataset.q);
      return;
    }
    const chip = e.target.closest('.ask-chip');
    if (chip) { ask(chip.dataset.q); return; }
    // On a phone the panel covers the page, so following a water link closes it.
    if (e.target.closest('a[data-internal]') && small.matches) close(false);
  });

  /* ---------- Start ---------- */
  (async () => {
    if (paidSession) {
      show(); open();
      if (/^cs_[A-Za-z0-9_]+$/.test(paidSession) && await redeem(paidSession)) {
        await fetchStatus();
        welcome();
        const waiting = ss.get(PENDING);
        if (waiting) { ss.set(PENDING, null); input.value = waiting; grow(); }
      }
      return;
    }
    if (code || pass) {
      // Eddy appears for the owner or a pass holder only once the endpoint confirms, so a stale code shows nothing.
      const s = await fetchStatus();
      if (s?.ok && (s.access !== 'free' || selling)) show();
      else if (selling) show();
    } else if (selling) {
      // Selling: the button shows for everyone; the endpoint is first contacted when the panel opens.
      show();
    }
    if (cancelled != null && shown) { open(); bubble('guide', '<p>Checkout was cancelled, and you weren’t charged.</p>'); }
    paintFollow();
  })();
})();
