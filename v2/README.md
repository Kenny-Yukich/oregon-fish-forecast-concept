# Oregon Fish Forecast, version two

The current homepage design. The page itself is the repository's root `index.html`; its code lives in this folder (`v2/assets`, `v2/vendor`). The earlier design is kept at `classic/`.

Online: **https://kenny-yukich.github.io/oregon-fish-forecast-concept/** (the old `/v2/` address forwards there, keeping any `#/water/…` route).

## Same data, every morning

The homepage reads the shared data files (`data/*.js`) and score formula (`assets/member-preview.js`), the same ones the classic site uses, so the daily data workflow updates both and both show the same scores. Nothing here copies or freezes the data.

## Direction

- **Idea:** "Read the river before you drive." A forest-ink field almanac: big Fraunces headlines, mono numbers for anything from a source, cream paper sections.
- **Hero:** the supplied river illustration. A Three.js shader animates only the river: a mask is built from the artwork's own blue, and the water is redrawn with flowing foam in the same flat style. Pointer or touch sends a ripple. The static artwork stays underneath as the poster.
- **Sections:** live wire of counts and gauges, this week's short list (top scores), what anglers are posting (from `data/angler.js`), fish counts from Bonneville, The Dalles and Willamette Falls, the full directory with search and filters, ODFW stocking this week, how a score is built (one pinned, scrubbed sequence), principles.
- **Water pages:** `#/water/<id>` with report, notices, this morning's gauge reading against its 7-day median, dam counts, stocking, season and methods, score breakdown, access with editable driving origin, and sources.
- Map and full stocking schedule link to the classic site at `classic/`.

## Motion and fallbacks

- GSAP 3.12.5 + ScrollTrigger. **Lenis** is the only smooth-scroll engine (Locomotive Scroll is not installed).
- Headings reveal word by word; the unsplit text stays in an `sr-only` span and the animated words are `aria-hidden`.
- `prefers-reduced-motion: reduce`: no Lenis, no scrubbing or pinning, no shader, no marquee animation. Final states render immediately.
- No JavaScript: the hero, artwork and footer render, with a note linking the classic site and `waters.json`.
- The shader pauses offscreen and in hidden tabs, caps pixel ratio at 1.5, handles context loss, and is skipped on `file://` (ES modules need a server). The page still works from `file://` without it.

## Assets

- Artwork: the two supplied Oregon Fish Forecast WebP files, used unchanged from `assets/`.
- Icons: Solar by 480 Design via Iconify (`@iconify-json/solar`), CC BY 4.0, inlined in `assets/icons.js`.
- Fonts: Fraunces, Instrument Sans, JetBrains Mono from Google Fonts, with system fallbacks.
- Libraries are vendored in `vendor/` (see `vendor/README.md`).
- No people, avatars, testimonials or partner logos are shown.

## Checked

Rendered in headless Chromium at 1440 and 390 wide: hero shader, deep links to each section, directory search/filter/empty state/reset, mobile menu, water pages, reduced motion and JavaScript disabled. No console errors. The shader was checked with a software GPU, so it is worth a look on a real phone.
