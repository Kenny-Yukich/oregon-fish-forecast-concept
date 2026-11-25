# Oregon Fish Forecast, version two

The site's design. The page itself is the repository's root `index.html`; its code lives in this folder (`v2/assets`, `v2/vendor`). The earlier classic design was retired on Nov 25, 2026; `classic/` now only forwards its old addresses here (see [Old addresses](#old-addresses)).

Online: **https://kenny-yukich.github.io/oregon-fish-forecast-concept/** (the old `/v2/` address forwards there, keeping any `#/water/…` route).

## Same data, every morning

The page reads the shared data files (`data/*.js`) and score formula (`assets/member-preview.js`), the same ones Eddy's server runs, so the daily data workflow updates both and both show the same scores. Nothing here copies or freezes the data.

## Direction

- **Idea:** "Where are you fishing?" The homepage asks one question and answers it three ways: a search box, this week's short list, and Eddy. A forest-ink field almanac: big Fraunces headlines, mono numbers for anything from a source, cream paper sections.
- **Hero:** on paper, the question and a search box beside the supplied river illustration, with a "See this week's best waters" link under the box that scrolls to the short list. Typing suggests matching waters (arrow keys and Enter choose one); Enter alone opens the directory searched for those words, or the water itself when only one matches. A Three.js shader animates only the river: a mask is built from the artwork's own blue, and the water is redrawn with flowing foam in the same flat style. Pointer or touch sends a ripple. The static artwork stays underneath as the poster. When Eddy is available to the visitor, an "Ask Eddy" card sits on the artwork with a sample question to tap ("Where can I bank fish near Bend this weekend?"), and the floating button waits until the card has scrolled away. The page holds room for the card from its first frame, so nothing jumps when it arrives; ask.js gives the room back (`html.no-eddy`) when the visitor will not see Eddy. On a phone the floating button steps aside while scrolling down, and the footer leaves room for it.
- **Homepage:** the hero, this week's best waters, then the live wire of counts and gauges. The short list is the five top scores, each with its reach, the score and the fish it is for ("72/100 for trout", from the species the formula scores), one concrete reason underneath ("Steady flow at the Madras gauge, 52°F") and, when it matters, the latest report's date and any rules note. Every seven-day count on the wire names the day it runs to, since each dam reports on its own schedule.
- **Pages:** everything else has its own address, so the homepage stays short: `#/waters` (the full directory with search and filters; `#/waters?q=<words>` opens it searched), `#/map` (the water map, below), `#/counts` (Bonneville, The Dalles and Willamette Falls), `#/stocking` (ODFW stocking this week, then the whole schedule, below), `#/reports` (what anglers are posting, from `data/angler.js`; `#/anglers` still works) and `#/method` (how a score is built, and the principles). The navigation sits on paper or on forest ink, whichever the page opens with.
- **Water pages:** `#/water/<id>` open with a decision strip under the name: the target species, the first documented access point with directions, and the key rule (an ODFW closure or restriction in effect, else a recorded notice, else a trip-day check), with a jump to the rest of the notices. Then the report, notices, this morning's gauge reading against its 7-day median, dam counts, stocking, season and methods, score breakdown (led by how sure the score is and what ground the report covers), access with editable driving origin and a link to the water on the map, and sources.
- **Water map (`#/map`):** a satellite base (Esri World Imagery with place labels) or the USGS topo base, with the USGS National Map stream and lake layer on top (it can be switched off), one pin per guide water from `data/map.js` (forest for rivers, blue for lakes), All/Rivers/Lakes filters and a keyboard-friendly list beside the map. Choosing a water shows its score, species and directions, and a river with a USGS gauge traces its channel about 25 km up and downstream from the gauge with the USGS NLDI service (a gold line, which can run past the named reach; the card says so if it fails). `#/map?water=<id>` opens on a water, and the address follows the choice. Pins mark the general area of a reach, not an access point. Leaflet 1.9.4, `v2/assets/map.js` and `data/map.js` load only when the map opens: their addresses sit in `index.html`'s `<template id="map-assets">`, so they are stamped like every other file but never fetched on other pages. Tiles and river lines are requested by the visitor's browser only on the map page.
- **Stocking schedule (`#/stocking`):** under this week's total, "When is my lake stocked?" lists every water on ODFW's plan (about a year ahead) and the past 8 weeks, grouped this week, next week, then by month, with search, Coming up/Recent/All and a zone filter (ODFW's six regions). Guide waters link to their pages. `#/stocking?q=<words>&weeks=past|all` opens it searched and scrolled to the list; alert emails for waters outside the guide link this way.

## After changing CSS or JavaScript

Run `node scripts/stamp-assets.mjs`. It stamps each stylesheet and script address in `index.html` (including the map files in its `<template>`) with a hash of the file's contents (`v2/assets/app.js?v=…`). Browsers keep these files for a while, so without a new stamp a returning visitor can get the new page with an old stylesheet or script. The "Site check" workflow fails a pull request whose stamps are out of date. Files in `data/` are not stamped.

## Motion and fallbacks

- GSAP 3.12.5 + ScrollTrigger. **Lenis** is the only smooth-scroll engine (Locomotive Scroll is not installed).
- Headings reveal word by word; the unsplit text stays in an `sr-only` span and the animated words are `aria-hidden`.
- `prefers-reduced-motion: reduce`: no Lenis, no scroll-triggered motion, no shader, no marquee animation. Final states render immediately.
- No JavaScript: the hero, artwork and footer render, with a note linking `waters.json`.
- The shader pauses offscreen and in hidden tabs, caps pixel ratio at 1.5, handles context loss, and is skipped on `file://` (ES modules need a server). The page still works from `file://` without it.

## Assets

- Artwork: the two supplied Oregon Fish Forecast WebP files, used unchanged from `assets/`.
- Icons: Solar by 480 Design via Iconify (`@iconify-json/solar`), CC BY 4.0, inlined in `assets/icons.js`.
- Map: Leaflet 1.9.4 (BSD-2-Clause), vendored in `vendor/leaflet`.
- Fonts: Fraunces, Instrument Sans, JetBrains Mono from Google Fonts, with system fallbacks.
- Libraries are vendored in `vendor/` (see `vendor/README.md`).
- No people, avatars, testimonials or partner logos are shown.

## Checked

Rendered in headless Chromium at 1440, 820 and 390 wide: hero shader, homepage search (suggestions, keyboard, no match), the "Ask Eddy" card against a stand-in endpoint, each page by deep link and from the menu, directory search/filter/empty state/reset and Back, mobile menu, water pages, reduced motion and JavaScript disabled. No console errors. The shader was checked with a software GPU, so it is worth a look on a real phone.

The map and schedule (Nov 25, 2026) were checked at 1440, 1280 and 390 wide, with and without motion: all 62 pins, the filters and base switch, choosing from the list, a river trace, opening the map from a water page, a filtered-out water reappearing when chosen, the schedule searched from the address and the box, its filters, empty state and reset, and every classic address forwarding. Tiles and NLDI were stand-ins (the checking environment could not reach them), so the live satellite, topo and stream tiles and the river trace are worth a look on the published site.

## Old addresses

`classic/` and `v2/` are forwarding pages. `classic/` maps each old route to its new one: `#/water/<id>` stays the same (its `?section=` is dropped), `#/map?water=<id>` and `#/stocking?q=…&weeks=…` keep their settings, `#/waters?q=…` keeps the search, `#/approach` and `#/sources` go to `#/method`, and anything else goes to the homepage. The classic code (its stylesheet, app, station-reading loader and this-browser trends) was removed; the map moved to `v2/assets/map.js` and Leaflet to `v2/vendor/leaflet`.
