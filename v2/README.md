# Oregon Fish Forecast, version two

The current homepage design. The page itself is the repository's root `index.html`; its code lives in this folder (`v2/assets`, `v2/vendor`). The earlier design is kept at `classic/`.

Online: **https://kenny-yukich.github.io/oregon-fish-forecast-concept/** (the old `/v2/` address forwards there, keeping any `#/water/…` route).

## Same data, every morning

The homepage reads the shared data files (`data/*.js`) and score formula (`assets/member-preview.js`), the same ones the classic site uses, so the daily data workflow updates both and both show the same scores. Nothing here copies or freezes the data.

## Direction

- **Idea:** "Where are you fishing?" The homepage asks one question and answers it three ways: a search box, this week's short list, and Eddy. A forest-ink field almanac: big Fraunces headlines, mono numbers for anything from a source, cream paper sections.
- **Hero:** on paper, the question and a search box beside the supplied river illustration. Typing suggests matching waters (arrow keys and Enter choose one); Enter alone opens the directory searched for those words, or the water itself when only one matches. A Three.js shader animates only the river: a mask is built from the artwork's own blue, and the water is redrawn with flowing foam in the same flat style. Pointer or touch sends a ripple. The static artwork stays underneath as the poster. When Eddy is available to the visitor, an "Ask Eddy" card sits on the artwork and the floating button waits until the card has scrolled away.
- **Homepage:** the hero, the live wire of counts and gauges, and this week's short list: the five top scores as rows, each with its reach, the one input that says most about it today (in the score formula's own words) and any rules note.
- **Pages:** everything else has its own address, so the homepage stays short: `#/waters` (the full directory with search and filters; `#/waters?q=<words>` opens it searched), `#/counts` (Bonneville, The Dalles and Willamette Falls), `#/stocking` (ODFW stocking this week), `#/reports` (what anglers are posting, from `data/angler.js`; `#/anglers` still works) and `#/method` (how a score is built, and the principles). The navigation sits on paper or on forest ink, whichever the page opens with.
- **Water pages:** `#/water/<id>` with report, notices, this morning's gauge reading against its 7-day median, dam counts, stocking, season and methods, score breakdown, access with editable driving origin, and sources.
- Map and full stocking schedule link to the classic site at `classic/`.

## After changing CSS or JavaScript

Run `node scripts/stamp-assets.mjs`. It stamps each stylesheet and script address in `index.html` and `classic/index.html` with a hash of the file's contents (`v2/assets/app.js?v=…`). Browsers keep these files for a while, so without a new stamp a returning visitor can get the new page with an old stylesheet or script. The "Site check" workflow fails a pull request whose stamps are out of date. Files in `data/` are not stamped.

## Motion and fallbacks

- GSAP 3.12.5 + ScrollTrigger. **Lenis** is the only smooth-scroll engine (Locomotive Scroll is not installed).
- Headings reveal word by word; the unsplit text stays in an `sr-only` span and the animated words are `aria-hidden`.
- `prefers-reduced-motion: reduce`: no Lenis, no scroll-triggered motion, no shader, no marquee animation. Final states render immediately.
- No JavaScript: the hero, artwork and footer render, with a note linking the classic site and `waters.json`.
- The shader pauses offscreen and in hidden tabs, caps pixel ratio at 1.5, handles context loss, and is skipped on `file://` (ES modules need a server). The page still works from `file://` without it.

## Assets

- Artwork: the two supplied Oregon Fish Forecast WebP files, used unchanged from `assets/`.
- Icons: Solar by 480 Design via Iconify (`@iconify-json/solar`), CC BY 4.0, inlined in `assets/icons.js`.
- Fonts: Fraunces, Instrument Sans, JetBrains Mono from Google Fonts, with system fallbacks.
- Libraries are vendored in `vendor/` (see `vendor/README.md`).
- No people, avatars, testimonials or partner logos are shown.

## Checked

Rendered in headless Chromium at 1440, 820 and 390 wide: hero shader, homepage search (suggestions, keyboard, no match), the "Ask Eddy" card against a stand-in endpoint, each page by deep link and from the menu, directory search/filter/empty state/reset and Back, mobile menu, water pages, reduced motion and JavaScript disabled. No console errors. The shader was checked with a software GPU, so it is worth a look on a real phone.
