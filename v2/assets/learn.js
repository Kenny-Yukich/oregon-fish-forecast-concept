/* Oregon Fish Forecast, version two: "Learn to fish".
   Path one, "Your first trout": six short lessons with quick quizzes, then a real stocked water from ODFW's
   plan to try it on. The reward is a trip, not points, so the path counts trips instead of daily streaks.
   app.js draws the page at #/learn and hands in its helpers (ctx). Progress stays in this browser only. */
(() => {
  'use strict';

  // Each lesson teaches a few points, then asks questions. A wrong answer is explained and asked again at the end,
  // so a lesson is done only when every question has been answered right once.
  const LESSONS = [
    {
      id: 'legal', title: 'Get legal', minutes: 2,
      teach: [
        'Anyone 12 or older needs an Oregon fishing license. Kids under 12 fish free.',
        'Buy it online through MyODFW or at most sporting goods stores. Carry it while you fish: paper, or on your phone in the MyODFW app.',
        'Trout need no tag. The Combined Angling Tag is for salmon, steelhead, sturgeon and halibut.',
        'ODFW sets a few free fishing days each year when no license is needed. Check this year’s dates before counting on one.'
      ],
      links: [['https://myodfw.com/', 'Buy a license on MyODFW']],
      quiz: [
        {q: 'Your friend is 14. Do they need a license to fish for trout?', options: ['Yes, a youth license', 'No, only adults need one', 'Only if they keep a fish'], a: 0,
          why: 'Anyone 12 or older needs a license, and ages 12 to 17 get a youth license.'},
        {q: 'You’re after stocked rainbow trout at a pond. Do you need the Combined Angling Tag?', options: ['Yes, for every fish', 'No, trout don’t need it', 'Only on weekends'], a: 1,
          why: 'The tag is for salmon, steelhead, sturgeon and halibut. A license covers trout.'},
        {q: 'Where does your license need to be while you fish?', options: ['At home, somewhere safe', 'With you, on paper or in the MyODFW app', 'In your car at the trailhead'], a: 1,
          why: 'Carry it while fishing. A phone in the MyODFW app counts.'}
      ]
    },
    {
      id: 'water', title: 'Pick the right water', minutes: 2,
      teach: [
        'For a first trout, pick a lake or pond that ODFW stocks. Hatchery trout are hungry, plentiful and not shy.',
        'The stocking plan lists “legals”: trout big enough to keep, usually around 8 inches or more.',
        'Go within a week or two of a stocking, before the fish spread out or get caught.',
        'Save rivers for later. Many have bait bans, wild-fish rules and stretch-by-stretch seasons.'
      ],
      quiz: [
        {q: 'Which is the best first trip?', options: ['A pond on ODFW’s stocking plan this week', 'A remote wild-trout river', 'A coastal jetty in winter'], a: 0,
          why: 'Freshly stocked ponds give a beginner the best odds and the simplest rules.'},
        {q: 'ODFW’s stocking plan lists “legals.” What are they?', options: ['Fish you must release', 'Trout big enough to keep, around 8 inches or more', 'Baby trout for next year'], a: 1,
          why: 'Legals are catchable-size trout, planted for anglers to catch and keep.'},
        {q: 'When are stocked trout easiest to catch?', options: ['A week or two after they’re released', 'Six months later', 'Only at midnight'], a: 0,
          why: 'Right after a release, the fish are many, close to shore and eager.'}
      ]
    },
    {
      id: 'fish', title: 'Know your fish', minutes: 3,
      teach: [
        '<b>Rainbow trout:</b> silver, with small black spots on the back and tail and a pink band down the side. Stocked fish often have worn, rounded fins.',
        '<b>Cutthroat trout:</b> a red-orange slash under the lower jaw.',
        '<b>Brook trout:</b> wavy, worm-like light marks on a dark back, and white front edges on the lower fins.',
        '<b>Bull trout:</b> pale yellow or cream spots on a dark olive body, and no black spots on the back fin. They are protected in most Oregon waters: release one right away, in the water if you can.',
        'Not sure what you caught? Let it go.'
      ],
      quiz: [
        {q: 'A fish with pale cream spots on a dark olive body and no black spots on its back fin. What is it, and what do you do?', options: ['A rainbow trout. Keep it.', 'A bull trout. Release it right away.', 'A brook trout. Keep it.'], a: 1,
          why: 'Those are bull trout marks. Bull trout are protected in most Oregon waters.'},
        {q: 'You see a red-orange slash under the fish’s jaw. What did you catch?', options: ['A cutthroat trout', 'A bull trout', 'A kokanee'], a: 0,
          why: 'The slash under the jaw gives the cutthroat its name.'},
        {q: 'Silver, small black spots and a pink band down its side. What is it?', options: ['A brook trout', 'A rainbow trout', 'A bull trout'], a: 1,
          why: 'That’s a rainbow, the trout ODFW stocks most.'},
        {q: 'You can’t tell what species you caught. What should you do?', options: ['Keep it and look it up at home', 'Release it', 'Keep it if it’s big'], a: 1,
          why: 'When in doubt, let it go. Keeping a protected fish can mean a citation.'}
      ]
    },
    {
      id: 'rig', title: 'Rig a bobber', minutes: 3,
      teach: [
        'Gear: a light spinning rod about 5 to 6 feet long, with 4 to 6 pound line.',
        'From the bottom up: a small hook (size 8 or 10), one or two small split shot about a foot above it, and a bobber 2 to 4 feet above the hook.',
        'Bait: a piece of nightcrawler or a pea-size ball of floating dough bait.',
        'Where the rules say artificial flies and lures only, bait is out. Cast and slowly reel a small spinner instead.',
        'Stocked trout cruise near shore, docks and drop-offs. You rarely need a long cast.'
      ],
      quiz: [
        {q: 'Your bobber dips and goes under. What now?', options: ['Wait five more minutes', 'Lift the rod tip steadily and start reeling', 'Throw the rod back as hard as you can'], a: 1,
          why: 'A steady lift sets the hook. A huge yank can break light line or pull the hook out.'},
        {q: 'What does the split shot do?', options: ['It scares fish away', 'It sinks the bait and keeps the line straight under the bobber', 'It’s just for show'], a: 1,
          why: 'The weight holds the bait down at the depth you set with the bobber.'},
        {q: 'The rules for this water say “artificial flies and lures only.” What can you fish with?', options: ['Worms', 'Floating dough bait', 'A small spinner'], a: 2,
          why: 'Worms and dough bait are bait. A spinner is a lure.'}
      ]
    },
    {
      id: 'knot', title: 'Tie one knot', minutes: 2,
      teach: [
        'One knot gets you a long way: the improved clinch knot, for tying line to a hook, swivel or lure.',
        '1. Pass the line through the hook’s eye and pull about 6 inches through.',
        '2. Wrap the loose end around the main line 5 to 7 times.',
        '3. Pass the loose end through the small loop next to the eye, then back through the big loop you just made.',
        '4. Wet the knot, pull it tight slowly, and trim the end.'
      ],
      links: [['https://www.animatedknots.com/improved-clinch-knot', 'Watch it tied step by step']],
      quiz: [
        {q: 'How many times do you wrap the loose end around the main line?', options: ['Once', '5 to 7 times', '20 times'], a: 1,
          why: 'Five to seven wraps hold well in light trout line.'},
        {q: 'Why wet the knot before pulling it tight?', options: ['Friction heat weakens dry line', 'It makes the knot easier to see', 'Fish like the smell'], a: 0,
          why: 'Cinching dry line heats and weakens it. A wet knot slides tight cleanly.'},
        {q: 'After the wraps, where does the loose end go?', options: ['Straight into your tackle box', 'Through the small loop by the eye, then back through the big loop', 'Around the hook point'], a: 1,
          why: 'That second pass through the big loop is what makes it “improved.”'}
      ]
    },
    {
      id: 'rules', title: 'Rules at the water', minutes: 2,
      teach: [
        'Limits are set by zone and by water. Many Oregon lakes and ponds allow 5 trout a day, but yours may differ: look up your exact water.',
        'ODFW also posts in-season changes. On this site, each water page leads with the key rule.',
        'Keep only what you’ll eat, and handle fish you release with wet hands.',
        'Pack out old line and hooks. Birds and wildlife get tangled in it.',
        'Give other anglers room on the bank. Wear a life jacket on boats and docks, especially in cold water.'
      ],
      linksFromCtx: true,
      quiz: [
        {q: 'Where do you find the daily limit for your water?', options: ['Ask whoever’s nearby', 'ODFW’s regulations for that zone, plus any in-season update', 'It’s the same everywhere'], a: 1,
          why: 'Limits vary by zone and water, and ODFW changes some during the season.'},
        {q: 'You snapped off a tangle of old line. What do you do with it?', options: ['Leave it on the bank', 'Toss it in the water', 'Pack it out'], a: 2,
          why: 'Loose line traps birds and wildlife. Take it home or to a line recycling bin.'},
        {q: 'Someone’s already fishing your favorite spot on the dock. What’s good form?', options: ['Cast right over their line', 'Give them room and fish nearby', 'Ask them to leave'], a: 1,
          why: 'First come, first served. Leave enough space that your lines won’t cross.'}
      ]
    }
  ];

  const state = {open: null, phase: 'teach', queue: [], idx: 0, answered: null, misses: 0};

  function load(ctx) {
    const done = new Set(String(ctx.store.get('learn.done', '')).split(',').filter(id => LESSONS.some(l => l.id === id)));
    const trips = Math.max(0, parseInt(ctx.store.get('learn.trips', '0'), 10) || 0);
    const first = ctx.store.get('learn.first', '') === '1';
    return {done, trips, first};
  }
  const nextOpen = p => LESSONS.find(l => !p.done.has(l.id))?.id || 'go';

  /* ---------- Page ---------- */
  function html(ctx) {
    const p = load(ctx);
    if (!state.open) state.open = nextOpen(p);
    return '<section class="section paper-2 learn" id="learn" aria-labelledby="learn-h"><div class="inner">' +
      '<div class="section-head"><div><p class="eyebrow">Learn to fish · Path one</p><h1 id="learn-h" class="display h-section" data-split tabindex="-1">Your first <em>trout.</em></h1></div>' +
      '<p class="lede" data-reveal>Six short lessons, about 15 minutes in all, then a freshly stocked water to try it on. No account needed: your progress stays in this browser.</p></div>' +
      '<div class="learn-grid"><nav class="path-wrap" aria-label="Lessons in this path"><div id="path">' + pathHTML(ctx, p) + '</div></nav>' +
      '<div class="lesson" id="lesson">' + lessonHTML(ctx, p) + '</div></div>' +
      '<p class="small learn-note">These lessons cover the basics, not every rule. Rules change each year and differ by water: check ODFW’s current regulations, and the key rule on each water page, before every trip.</p>' +
      '</div></section>';
  }

  function pathHTML(ctx, p) {
    const done = p.done.size, total = LESSONS.length;
    const steps = LESSONS.map((l, i) => {
      const isDone = p.done.has(l.id), isOpen = state.open === l.id;
      return '<li class="step' + (isDone ? ' done' : '') + (isOpen ? ' open' : '') + '"><button type="button" class="step-btn" data-lesson="' + l.id + '"' + (isOpen ? ' aria-current="step"' : '') + '>' +
        '<span class="step-dot" aria-hidden="true">' + (isDone ? ctx.icon('check-circle-linear') || '✓' : i + 1) + '</span>' +
        '<span class="step-text"><strong>' + ctx.esc(l.title) + '</strong><small>' + l.minutes + ' min · ' + (isDone ? 'Done' : isOpen ? 'Up now' : 'Not started') + '</small></span>' +
        '<span class="sr-only">' + (isDone ? ', done' : '') + '</span></button></li>';
    }).join('');
    const goOpen = state.open === 'go', ready = done === total;
    const go = '<li class="step go' + (goOpen ? ' open' : '') + (p.trips ? ' done' : '') + '"><button type="button" class="step-btn" data-lesson="go"' + (goOpen ? ' aria-current="step"' : '') + '>' +
      '<span class="step-dot" aria-hidden="true">' + (ctx.icon('map-point-linear') || '★') + '</span>' +
      '<span class="step-text"><strong>Go fishing</strong><small>' + (p.trips ? p.trips + (p.trips === 1 ? ' trip' : ' trips') + ' logged' : ready ? 'You’re ready' : 'Open any time') + '</small></span></button></li>';
    return '<div class="path-meter"><div class="meter" role="progressbar" aria-label="Lessons done" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + done + '"><span style="width:' + (done / total * 100) + '%"></span></div>' +
      '<p class="small"><b class="num">' + done + '/' + total + '</b> lessons done' + (p.trips ? ' · <b class="num">' + p.trips + '</b> ' + (p.trips === 1 ? 'trip' : 'trips') : '') + (p.first ? ' · First trout caught' : '') + '</p></div>' +
      '<ol class="path">' + steps + go + '</ol>';
  }

  function lessonHTML(ctx, p) {
    if (state.open === 'go') return goHTML(ctx, p);
    const l = LESSONS.find(x => x.id === state.open);
    const n = LESSONS.indexOf(l) + 1;
    const head = '<p class="eyebrow">Lesson ' + n + ' of ' + LESSONS.length + ' · ' + l.minutes + ' min</p><h2 class="lesson-h" id="lesson-h" tabindex="-1">' + ctx.esc(l.title) + '</h2>';
    if (state.phase === 'teach') {
      const links = (l.linksFromCtx ? [[ctx.regsUrl, 'ODFW’s current regulations']] : l.links || []);
      return head + '<ul class="teach">' + l.teach.map(t => '<li>' + t + '</li>').join('') + '</ul>' +
        (links.length ? '<p class="small">' + links.map(([u, t]) => ctx.ext(u, t)).join(' · ') + '</p>' : '') +
        '<div class="lesson-actions"><button type="button" class="btn btn-ink" data-act="quiz">' + (p.done.has(l.id) ? 'Take the quiz again' : 'Start the quiz') + '</button></div>';
    }
    if (state.phase === 'done') {
      const next = LESSONS[n] || null;
      return head + '<div class="lesson-done"><p class="done-mark" aria-hidden="true">' + (ctx.icon('check-circle-linear') || '✓') + '</p>' +
        '<p class="done-h">Lesson done' + (state.misses ? '' : ', no misses') + '.</p>' +
        '<p>' + (next ? 'Next up: ' + ctx.esc(next.title) + '.' : 'That’s every lesson. Time to find some fish.') + '</p></div>' +
        '<div class="lesson-actions"><button type="button" class="btn btn-ink" data-lesson="' + (next ? next.id : 'go') + '">' + (next ? 'Next lesson' : 'Find a stocked water') + '</button>' +
        '<button type="button" class="btn btn-line" data-act="teach">Review the notes</button></div>';
    }
    const item = l.quiz[state.queue[state.idx]], answered = state.answered;
    const left = state.queue.length - state.idx;
    return head + '<p class="small quiz-count">' + left + (left === 1 ? ' question' : ' questions') + ' left</p>' +
      '<fieldset class="quiz"><legend class="quiz-q">' + item.q + '</legend><div class="choices">' +
      item.options.map((o, i) => {
        const cls = answered == null ? '' : i === item.a ? ' right' : i === answered ? ' wrong' : ' faded';
        return '<button type="button" class="choice' + cls + '" data-choice="' + i + '"' + (answered != null ? ' aria-disabled="true"' : '') + '>' + ctx.esc(o) + '</button>';
      }).join('') + '</div></fieldset>' +
      '<div class="feedback" role="status">' + (answered == null ? '' :
        '<p class="fb ' + (answered === item.a ? 'ok' : 'miss') + '"><b>' + (answered === item.a ? 'Right.' : 'Not quite. This one comes back at the end.') + '</b> ' + ctx.esc(item.why) + '</p>') + '</div>' +
      (answered != null ? '<div class="lesson-actions"><button type="button" class="btn btn-ink" data-act="next" id="next-q">Continue</button></div>' : '');
  }

  // The last step: real waters from ODFW's stocking plan for this week and the next two, guide waters first.
  function goHTML(ctx, p) {
    const t = ctx.today(), mon = ctx.mondayOf(t);
    const end = new Date(mon + 'T12:00:00Z'); end.setUTCDate(end.getUTCDate() + 20);
    const until = end.toISOString().slice(0, 10);
    const rows = (window.ORFF_STOCKING?.rows || []).filter(r => r.week_start >= mon && r.week_start <= until && r.total > 0)
      .map(r => ({r, g: ctx.guideFor(r.waterbody)}))
      .sort((a, b) => a.r.week_start.localeCompare(b.r.week_start) || (!!b.g - !!a.g) || b.r.total - a.r.total);
    const shown = rows.slice(0, 8);
    const list = shown.length ? '<ul class="stock-list go-list">' + shown.map(({r, g}) => {
      const when = r.week_start === mon ? 'This week' : 'Week of ' + ctx.fmtDate(r.week_start);
      const name = g ? '<a href="#/water/' + ctx.esc(g.id) + '"><strong>' + ctx.esc(r.waterbody) + '</strong></a>' : '<strong>' + ctx.esc(r.waterbody) + '</strong>';
      const map = g ? '' : ' · ' + ctx.ext('https://www.google.com/maps/search/?' + new URLSearchParams({api: '1', query: r.waterbody + ', Oregon'}), 'Find it on a map');
      return '<li>' + name + '<span class="num">' + ctx.num(r.total) + ' trout</span><small>' + when + ' · ' + ctx.esc(r.zone) + (g ? ' · In the guide, with access and rules' : '') + map + '</small></li>';
    }).join('') + '</ul>' + (rows.length > shown.length ? '<p class="small"><a class="link" href="#/stocking">See all ' + rows.length + ' planned stockings</a></p>' : '')
      : '<p>' + (window.ORFF_STOCKING ? 'ODFW has no trout stockings planned in the next three weeks. ' : 'The stocking schedule did not load. ') +
        ctx.ext(window.ORFF_STOCKING?.source || 'https://myodfw.com/fishing/species/trout/stocking-schedule', 'Check ODFW’s schedule') + '</p>';
    const remaining = LESSONS.filter(l => !p.done.has(l.id)).length;
    return '<p class="eyebrow">Step 7 · Go fishing</p><h2 class="lesson-h" id="lesson-h" tabindex="-1">Try it on a fresh stocking.</h2>' +
      (remaining ? '<p class="small">' + remaining + (remaining === 1 ? ' lesson' : ' lessons') + ' still to go, but you can look ahead.</p>' : '') +
      '<p>ODFW plans these trout releases over the next three weeks. Plans can change, so check the schedule the day before you go.</p>' + list +
      '<div class="trip-log"><h3>Log your trips</h3><p class="small">This path counts trips, not days in a row. Fishing is seasonal, and a trip is the point.</p>' +
      '<div class="lesson-actions"><button type="button" class="btn btn-ink" data-act="trip">I went fishing</button>' +
      '<button type="button" class="btn btn-line" data-act="first" aria-pressed="' + p.first + '">' + (p.first ? 'First trout caught ' + (ctx.icon('check-circle-linear') || '✓') : 'I caught my first trout') + '</button></div>' +
      '<p class="small" role="status" id="trip-status">' + (p.trips ? 'Trips logged: ' + p.trips + '.' : '') + '</p></div>';
  }

  /* ---------- Behaviour ---------- */
  function bind(root, ctx) {
    const lesson = root.querySelector('#lesson'), path = root.querySelector('#path');
    if (!lesson || !path) return;
    const redraw = (focus, scroll) => {
      const p = load(ctx);
      path.innerHTML = pathHTML(ctx, p);
      lesson.innerHTML = lessonHTML(ctx, p);
      if (ctx.motionOK()) ctx.gsap.from(lesson.children, {y: 12, opacity: 0, duration: .45, stagger: .04, ease: 'power3.out', clearProps: 'all'});
      if (scroll && lesson.getBoundingClientRect().top < 0 || scroll && lesson.getBoundingClientRect().top > innerHeight * .6) ctx.scrollTo(lesson);
      const el = focus === 'first-choice' ? lesson.querySelector('.choice') : focus === 'next' ? lesson.querySelector('#next-q') : lesson.querySelector('#lesson-h');
      el?.focus({preventScroll: true});
    };
    const open = id => {
      state.open = id; state.phase = 'teach'; state.answered = null;
      redraw('heading', true);
    };
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-lesson],[data-act],[data-choice]');
      if (!t || !root.contains(t)) return;
      if (t.dataset.lesson) return open(t.dataset.lesson);
      const l = LESSONS.find(x => x.id === state.open);
      if (t.dataset.choice != null) {
        if (state.answered != null || !l) return;
        const i = +t.dataset.choice, qi = state.queue[state.idx];
        state.answered = i;
        if (i !== l.quiz[qi].a) { state.queue.push(qi); state.misses++; }
        return redraw('next');
      }
      const act = t.dataset.act;
      if (act === 'quiz' && l) {
        state.phase = 'quiz'; state.queue = l.quiz.map((_, i) => i); state.idx = 0; state.answered = null; state.misses = 0;
        return redraw('first-choice');
      }
      if (act === 'teach') { state.phase = 'teach'; return redraw('heading'); }
      if (act === 'next' && l) {
        state.idx++; state.answered = null;
        if (state.idx >= state.queue.length) {
          const p = load(ctx); p.done.add(l.id);
          ctx.store.set('learn.done', [...p.done].join(','));
          state.phase = 'done';
          return redraw('heading');
        }
        return redraw('first-choice');
      }
      if (act === 'trip') {
        const n = load(ctx).trips + 1;
        ctx.store.set('learn.trips', String(n));
        redraw('none');
        const s = lesson.querySelector('#trip-status');
        if (s) s.textContent = 'Trip ' + n + ' logged. ' + (n === 1 ? 'Nice work getting out there.' : 'Keep it up.');
        return;
      }
      if (act === 'first') {
        ctx.store.set('learn.first', load(ctx).first ? '' : '1');
        redraw('none');
      }
    });
  }

  window.ORFF_LEARN = {html, bind, lessons: LESSONS};
})();
