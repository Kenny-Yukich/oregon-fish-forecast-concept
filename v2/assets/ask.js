/* Eddy: the AI fishing assistant, a chat panel where visitors ask about the guide waters. Answers come from Claude Haiku on the
   server (server/ask.mjs), grounded in the same data files this page reads. The panel only appears when
   assets/ask-config.js names an endpoint, so the static site never shows a chat that cannot answer.
   The conversation is kept for this tab only (sessionStorage).
   Eddy is private: when assets/ask-config.js says so, a browser needs the access code, which the owner's unlock
   link (?eddy=<code>) saves in this browser. Without it the page never contacts Eddy. ?eddy=off forgets the code. */
(() => {
  'use strict';
  const config = window.ORFF_ASK || {};
  const endpoint = config.endpoint;
  if (!endpoint) return;
  const CODE = 'orff-eddy.code';
  const params = new URLSearchParams(location.search);
  if (params.has('eddy')) {
    const value = (params.get('eddy') || '').trim();
    try { if (!value || value === 'off') localStorage.removeItem(CODE); else localStorage.setItem(CODE, value); } catch {}
    // Take the code out of the address bar so it is not bookmarked or shared by accident.
    params.delete('eddy');
    const rest = params.toString();
    window.history.replaceState(window.history.state, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
  }
  let code = null;
  try { code = localStorage.getItem(CODE); } catch {}
  if (config.private && !code) return;
  const access = code ? {'x-eddy-key': code} : {};
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
      '<div class="ask-head-actions"><button type="button" class="ask-reset" hidden>New chat</button>' +
      '<button type="button" class="ask-close" aria-label="Close Eddy">' + icon('close-circle-linear') + '</button></div></header>' +
    '<div class="ask-log" data-lenis-prevent tabindex="-1"></div>' +
    '<p class="sr-only" aria-live="polite" data-ask-status></p>' +
    '<form class="ask-form" novalidate>' +
      '<label class="sr-only" for="ask-input">Your question</label>' +
      '<textarea id="ask-input" rows="1" maxlength="' + MAX + '" placeholder="Ask Eddy about a river or lake" autocomplete="off"></textarea>' +
      '<button type="submit" class="ask-send" aria-label="Send question">' + icon('arrow-right-linear') + '</button>' +
    '</form>' +
    '<p class="ask-note">Eddy is an AI built on Claude. It answers from this morning’s reports, gauges, counts and stocking on this site, and it can be wrong. Check ODFW’s current rules before you fish.</p>';
  // Eddy appears only once its endpoint says it is ready, so the page never shows a chat that cannot answer
  // (for example before the Netlify project is deployed, or while it has no API key).
  fetch(endpoint, {method: 'GET', cache: 'no-store', headers: access}).then(r => {
    // A refused code (mistyped, or replaced by the owner) is forgotten so this browser stops asking.
    if (r.status === 401) { try { localStorage.removeItem(CODE); } catch {} }
    return r.ok ? r.json() : null;
  }).catch(() => null)
    .then(status => { if (status?.ok) document.body.append(launch, panel); });

  const log = panel.querySelector('.ask-log'), form = panel.querySelector('form'), input = panel.querySelector('textarea');
  const send = panel.querySelector('.ask-send'), reset = panel.querySelector('.ask-reset'), status = panel.querySelector('[data-ask-status]');
  let history = store.load(), busy = null;

  /* ---------- Rendering ---------- */
  function bubble(role, html) {
    const el = document.createElement('div');
    el.className = 'ask-msg ' + (role === 'user' ? 'from-user' : 'from-guide');
    el.innerHTML = '<span class="sr-only">' + (role === 'user' ? 'You said:' : 'Eddy said:') + ' </span><div class="ask-body">' + html + '</div>';
    log.append(el);
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
    log.scrollTop = log.scrollHeight;
    input.value = ''; grow();
    busy = new AbortController();
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Eddy is answering.';
    reset.hidden = false;
    let text = '', end = null;
    try {
      const res = await fetch(endpoint, {method: 'POST', headers: {'content-type': 'application/json', ...access}, body: JSON.stringify({messages: history, page: pageWater()}), signal: busy.signal});
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
      // A failed turn is taken back out of the conversation, so the next question starts clean.
      history.pop();
      store.save(history);
      const note = end?.type === 'refusal' ? end.message : end?.type === 'stopped' ? 'Stopped.' : end?.message || 'Eddy did not answer. Try again.';
      out.classList.add('ask-error');
      body.innerHTML = (text.trim() ? format(text) : '') + '<p class="ask-error-note">' + esc(note) + '</p>' +
        (end?.type === 'refusal' || end?.type === 'stopped' ? '' : '<button type="button" class="ask-retry" data-q="' + esc(question) + '">Try again</button>');
      status.textContent = note;
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

  launch.addEventListener('click', open);
  panel.querySelector('.ask-close').addEventListener('click', () => close());
  reset.addEventListener('click', () => { busy?.abort(); history = []; store.save(history); renderAll(); input.focus(); });
  form.addEventListener('submit', e => { e.preventDefault(); ask(input.value); });
  input.addEventListener('input', grow);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(input.value); } });
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  log.addEventListener('click', e => {
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
})();
