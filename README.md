# Oregon Fish Forecast — comparison concept

Open **index.html**. All site code, editorial data and artwork are local; no install or server is required. Keep the assets and data folders beside the entry file.

## Online comparison

GitHub Pages address: **https://kenny-yukich.github.io/oregon-fish-forecast-concept/**

This separate public repository serves the static site from the root of its main branch. It does not deploy to, modify, or replace the original Oregon Fish Forecast app. The comparison asks search engines not to index it.

Only the site, local artwork/data and documentation are published. Local checks, editor configuration, credentials and skill files are excluded.

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

- **What it shows:** ODFW's planned weekly trout stockings across Oregon. It's grouped into this week, next week, later and the past 8 weeks, with search by water or zone, a zone filter and a map link for each water.
- **Guide waters:** waters in the guide link to their field notes and get a **When was it stocked?** section. `data/stocking-match.js` maps ODFW's names to guide waters.
- **Directory:** the directory shows **Stocked this week: N Oregon waters**, and matched rows in the table show their next or latest stocking.
- **How it updates:** `scripts/fetch-stocking.mjs` runs in the same daily workflow as the fish counts.
  - It reads ODFW's print view of the schedule, which lists every row. If that fails, it falls back to paging the main schedule.
  - It turns ODFW's shorthand names into readable ones ("EMPIRE LK, UPR" becomes "Upper Empire Lake") and keeps the original as `odfw_name`.
  - It keeps each row for 8 weeks after ODFW removes it from the page.
- These are ODFW's planned stockings, not confirmed releases, and the page says so.

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
