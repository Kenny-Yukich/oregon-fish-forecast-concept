# Oregon Fish Forecast

## Site layout

- **Homepage (`index.html`):** the version-two design: motion-led, with a river shader on the supplied artwork. Its code is in `v2/`; see [v2/README.md](v2/README.md).
- **Classic site (`classic/`):** the earlier design, with the directory table, water map, full stocking schedule, approach page and membership proposal. The homepage links to it for those pages.
- **Shared:** `data/` (refreshed daily by the workflow), `assets/` (artwork, the score formula and the classic site's code) and `scripts/` (data fetchers).
- The old `/v2/` address forwards to the homepage.

GitHub Pages address: **https://kenny-yukich.github.io/oregon-fish-forecast-concept/** (classic: `/classic/`)

This separate public repository serves the static site from the root of its main branch. It does not deploy to, modify, or replace the original Oregon Fish Forecast app. The site asks search engines not to index it.

Only the site, local artwork/data and documentation are published. Local checks, editor configuration, credentials and skill files are excluded.

## Classic site

The notes below describe the classic site in `classic/`. Open **classic/index.html**; keep the `assets` and `data` folders at the repository root beside it.

The design uses forest ink from the supplied fish artwork, serif headings, quiet surfaces and a comparison table as the main utility. Mobile table scrolling stays inside its own region, with water/reach names pinned. Detail pages keep the selected reach visible.

## Included

- All 24 supplied Oregon records, preserving actual species, methods, access, alerts, report dates, coverage, sources and October 12 editorial review dates.
- Hash navigation for directory, every water and approach/sources; search by water/reach/region/species; river/lake filters; result counts and resettable empty state.
- Editable Portland origin saved only in this browser. All 22 driving links use the exact documented map query. No estimated drive durations and no routes to the two unverified gauge locations.
- Local seven-day trending from actual water-page opens, deduplicated within 30 minutes. No seeded popularity or invented community statistics.
- Monitoring coverage entries for every water. Sixteen USGS station connections can request actual latest observations individually. Three operator references, two historical references and three unresolved coverage gaps remain honestly labeled. Not every water has a working live feed.
- Nearby, upstream, downstream and mainstem/tributary differences are stated explicitly. No station substitutes for a public access point or on-site safety assessment.
- A future membership page at **$4.99 USD/month**, with river scores as the proposed paid feature. All 17 river entries link to the plan; no computed scores, payment collection or member accounts are simulated.

## Southwest Washington rivers

Seven Kelso and Longview area reaches were added on October 14, 2026: the Cowlitz (Kelso to Castle Rock, and Barrier Dam to Blue Creek), Coweeman, Toutle, Kalama (Modrow Bridge), Lewis (Woodland to Merwin Dam) and Elochoman. They use the same record format and the same honesty rules as the Oregon waters.

- WDFW and most source sites could not be opened directly from the editing environment, so these records were built from search excerpts of the linked sources. Every Washington rules alert is therefore labeled **Needs a trip-day check** until someone confirms it at the source.
- Coweeman, Toutle and Elochoman have no verified public fishing access, so they get no driving link. Coweeman's score is withheld while it is reported closed through October 31.
- Records can now list several `access_points` (label, type, note, map query, source). When there is more than one, the access sidebar lists each with its own directions, the way TroutRoute lists access points by river. Detail pages also open with a short strip of facts: species count, verified access points, monitoring type and notice count.
- Five of the reaches have USGS gauges connected (Castle Rock, below Mayfield Dam, Tower Road, Italian Creek, Ariel). Coweeman and Elochoman are listed as coverage gaps.

## Water map

Open `#/map` from the main navigation, or **Map** in any water's section bar. Inspired by TroutRoute's map, in this site's style:

- A satellite base (Esri World Imagery with place labels) or the USGS topo base, with the USGS National Map hydrography layer on top so every stream and lake shows in blue. The hydrography layer can be switched off.
- One pin per water from `data/map.js`, forest for rivers and blue for lakes. Pins mark the approximate area of each reach. They are not access points, and directions still use only documented access points.
- Choosing a river with a USGS gauge traces its channel about 25 km up and downstream from that gauge using the USGS NLDI service, drawn as a gold line. The trace can run past the named reach, and the page says so. If it fails, the card says the line is unavailable.
- Rivers, Lakes and All filters, a keyboard-friendly list beside the map, and deep links such as `#/map?water=lewis-river-woodland`.
- Leaflet 1.9.4 is vendored in `assets/vendor/leaflet` (BSD-2-Clause, license included). Tiles and river lines are fetched by the visitor's browser only on the map page.

Verification used mocked tiles and river-line responses, because the editing environment could not reach the tile or USGS hosts. Check the live tile and NLDI services on the published site, especially that the USGS hydrography tiles draw as a transparent overlay.

## Fish counts and catch checks

- **Catch checks.** The Columbia at Chinook Landing now shows ODFW's Troutdale numbers from the Oct 8 report (139 boats, 272 anglers, 54 coho and 12 jacks kept, 74 Chinook and 27 jacks released), plus the coho rule change on Oct 16.
- **Dam and trap counts.** Water pages near a count site get an **Are fish in the system?** section, which says whether the site is above or below the water. `data/count-stations.js` holds the stations and those relationships:
  - Bonneville Dam: Columbia at Chinook Landing, Lower Deschutes at Moody.
  - The Dalles Dam: both Lower Deschutes reaches.
  - Willamette Falls: Willamette at Cathedral Park, McKenzie at Leaburg.
  - Sherars Falls, Leaburg Dam and Winchester Dam: these link to ODFW's own counts.
- **Daily refresh.** `.github/workflows/daily-data.yml` runs `scripts/fetch-counts.mjs` every morning (about 6:41 am Pacific). It pulls this year's and last year's daily counts for Bonneville, The Dalles and Willamette Falls from Columbia River DART, works out 7-day, year-to-date and same-date-last-year totals, and commits `data/counts.js` only when the numbers change. A failed fetch keeps the previous numbers. It can also be run by hand from the Actions tab, and pull requests that change the fetcher run a test fetch without committing.
- Until the first run, count panels show links to the official counts instead of numbers.
- **Live ladder video.** A station can carry a `live` link to a public video feed of its fish ladder. Only Winchester Dam has one so far (the Umpqua Fishery Enhancement Derby's stream at umpquafish.com). Feeds are linked, not embedded, and only listed once confirmed to exist.

Counts show adult fish moving upstream past a point. They are run timing, not catch rates, and the site says so wherever they appear.

## Trout stocking

Open `#/stocking` from the main navigation.

- **What it shows:** ODFW's planned weekly trout stockings across Oregon. ODFW publishes about a year ahead, so the page groups it into this week, next week, coming up (by month) and the past 8 weeks, with search by water or zone, a zone filter and a map link for each water.
- **Guide waters:** waters in the guide link to their field notes and get a **When was it stocked?** section. `data/stocking-match.js` maps ODFW's names to guide waters.
- **Directory:** the directory shows **Stocked this week: N Oregon waters**, and matched rows in the table show their next or latest stocking.
- **How it updates:** `scripts/fetch-stocking.mjs` runs in the same daily workflow as the fish counts.
  - It asks the schedule for one zone and date range at a time, using the schedule's own filter form, and splits each zone by week until every slice fits on one 50-row page. Splits fall between a Sunday and a Monday, since stocking weeks run Monday to Friday. Each response is checked against the filter it asked for.
    - Why: on Oct 14, 2026, paging the full schedule repeated 101 rows and skipped 53, and the print view stops at 500 of the roughly 1,000 stockings ODFW plans through October 2027. The print view also rejects the filters.
    - As a safety net it also reads the print view and plain pages and merges anything the slices missed, naming those rows in the log.
      - On Oct 14, 2026 it added 3 of 1,132 rows: Smith Lake and Bolan Lake, which ODFW lists with no zone (so no zone slice can return them), and a 12-day Faraday Lake stocking.
      - The safety net only sees the print view's first 500 rows and the plain pages, so a zone-less or unusually long stocking outside those could still be missed.
    - If the filters stop working, it falls back to the print view and paging and logs that rows may be missing.
  - It turns ODFW's shorthand names into readable ones ("EMPIRE LK, UPR" becomes "Upper Empire Lake") and keeps the original as `odfw_name`.
  - It keeps each row for 8 weeks after ODFW removes it from the page.
- These are ODFW's planned stockings, not confirmed releases, and the page says so.

## Member preview

On the **Membership** page, **See the member preview** turns on the proposed paid scores across the guide. A banner on every page says it's a preview and has **Exit preview**. The setting is kept in that browser only.

- **River scores.** Each river gets a 0–100 score with a label (Excellent, Good, Fair or Slow) and a confidence rating, built by `assets/member-preview.js` from inputs already on the site:
  - Report tone, 30%.
  - Run strength from dam counts against last year, 25%. A plain "Salmon" target counts Chinook and coho.
  - River conditions, 20%: flow trend against the 7-day median, plus water temperature for cold-water species. These are read daily from each USGS gauge by `scripts/fetch-conditions.mjs` into `data/conditions.js`, and readings older than 36 hours are ignored.
  - Report freshness, 15%.
  - Recent stocking, 10%.
- **Lake scores.**
  - ODFW stocking, 40%: a stocking in the last 60 days or one due within two weeks.
  - Report tone, 35%.
  - Report freshness, 25%.
  - A lake ODFW isn't stocking scores on its report alone, with lower confidence.
- **Rules notices.**
  - A notice withholds the score unless the record lists the species that can still be scored (`score_species`, used for trout on both Lower Deschutes reaches, where steelhead and coho are restricted) or the notice has an end date that has passed (`score_notice_until`, used for the Coweeman closure through Oct 31).
  - Either way, the notice stays visible.
- **Missing inputs.** Missing inputs are skipped and lower confidence, and unverified rule notices lower it too. A water needs at least one input besides gauge readings to be scored.
- **Unscored on Oct 14, 2026.** Crooked River below Opal Springs and the Elochoman, which have no dated report. Coweeman is held until its closure ends.
- **Where scores appear.** In the directory, a score shows under each water's name, with a **Best score first** sort. Water pages show the score with a breakdown of every input and its source.
- **Not validated.** The formula has not been checked against catch results, and every score is tagged **Preview**.

## Proposed membership

Open `#/membership` from the main navigation. The concept proposes paid scores for specific river reaches and target species, explanations of their inputs and limitations, and score comparison within the directory. Price and benefits are a proposal, not an active subscription offer. The free guide keeps water records, access, reports, available station readings, restrictions and sources.

No scoring method has been validated or connected. River details say **Not calculated yet**; both Lower Deschutes reaches instead show **Rules review pending**, retain their original restriction notices and dates, and explain that payment would not override those restrictions. Lakes and reservoirs do not receive river-score labels. Membership links remember the originating reach so visitors can return to it.

## Readings

Choose a water and use **Load station readings**. A request goes directly to the public USGS API; the rest of the website remains usable offline. There is no automatic background polling.

Measurements retain their units, original timestamp, station and provisional/approval status. Observations older than six hours are marked older; observations over seven days old are withheld. Missing values are never converted to zero. No weather or numerical fishing score is inferred.

The public USGS response for the Madras gauge was retrieved successfully during verification on October 13, 2026. Not all station feeds or browser network/CORS behavior have been verified. Public API availability and rate limits can affect requests.

Source: [USGS modernized API migration documentation](https://api.waterdata.usgs.gov/docs/ogcapi/migration/). Each monitoring entry links to its official station or operator source. Editorial records remain a separate October 12 snapshot.

## Connecting community trends

Current trends are explicitly **this browser**, not community data. The code is ready to emit a water_view event with water_id and entry_point if a future host supplies a consented gtag integration and explicitly enables ORFF_ANALYTICS_CONSENT. No analytics account, SDK, tracking ID or remote analytics collection is installed here.

For community trends, aggregate distinct consenting sessions per water over a rolling seven-day window on a server or scheduled analytics export. Return only public aggregate results to the frontend. Keep analytics credentials server-side; exclude bots/internal traffic and deduplicate repeat visits. Do not send raw search queries or driving origins. Only label results “Community” after a real aggregate feed is connected.

## Verification

Lightweight JavaScript and static checks cover all detail routes, source fidelity, the two blocked driving routes, filter/search/empty-state logic, changed origins, trend deduplication, missing/stale reading handling, membership navigation, all 17 river-score states and both Lower Deschutes notices. No original-site modification was performed. Responsive sizing and keyboard controls received static review; rendered desktop/phone verification remains outstanding.
