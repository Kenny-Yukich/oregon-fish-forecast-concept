# Oregon Fish Forecast

## Site layout

- **Homepage (`index.html`):** the version-two design, kept short: "Where are you fishing?" with a search box and a link to this week's best waters, the short list, then the live ticker, with a river shader on the supplied artwork. The directory, water map, fish counts, stocking (this week and the whole schedule), angler reports and the score method each have their own page (`#/waters`, `#/map`, `#/counts`, `#/stocking`, `#/reports`, `#/method`). Its code is in `v2/`; see [v2/README.md](v2/README.md).
- **Shared:** `data/` (refreshed daily by the workflow), `assets/` (artwork, the score formula and Eddy's settings) and `scripts/` (data fetchers).
- **Old addresses:** the classic design was retired on Nov 25, 2026. `classic/` and the old `/v2/` address only forward to the same page on the homepage, so bookmarks, earlier alert emails and Eddy answers keep working.
- **One address:** the site lives at **oregonfishforecast.com**. `orfishforecast.com` forwards there (`_redirects`, read by Netlify), keeping the path and any `#/water/…` route, so Eddy passes and saved settings stay in one place.
- **Eddy, the AI fishing assistant (`server/`, `v2/assets/ask.js`):** an "Ask Eddy" chat panel where visitors ask about the guide waters and Claude Haiku 5.5 answers from the site's own data, plus water alerts by email for pass holders ("Follow this water" on a water page). It needs a small server endpoint, so it stays hidden on GitHub Pages until one is deployed. See [server/README.md](server/README.md).

GitHub Pages address: **https://kenny-yukich.github.io/oregon-fish-forecast-concept/**

This separate public repository serves the static site from the root of its main branch. It does not deploy to, modify, or replace the original Oregon Fish Forecast app. The site asks search engines not to index it.

Only the site, local artwork/data and documentation are published. Local checks, editor configuration, credentials and skill files are excluded.

## Included

- All 24 supplied Oregon records, preserving actual species, methods, access, alerts, report dates, coverage, sources and October 12 editorial review dates.
- Two waters added Nov 18, 2026: **Lava Lake** (Big Lava Lake at Lava Lake Campground) and the **Deschutes River at Tumalo State Park**, researched from ODFW's 2026 regulations and Bend-area guides, the Forest Service and Oregon State Parks. Neither has a dated report or live gauge yet, so both show as not scored. ODFW lists Big Lava Lake as "LAVA LK, B" in its stocking schedule.
- Two more added Nov 19, 2026: **Howard Prairie Reservoir** (Howard Prairie Resort and Klum Landing) and **Fourmile Lake** (Fourmile Lake Campground and Day Use Area), from ODFW's 2026 regulations and Southwest/Southeast Zone guides, Jackson County Parks, ODFW's 2020 Howard Prairie drawdown notice and the Forest Service. Neither has a dated report or a live lake-level feed yet, so both show as not scored.
- Nine more added Nov 24, 2026, taken from the busiest waters on ODFW's stocking schedule that the guide did not cover: **Lost Creek Reservoir**, the **Rogue River above Lost Creek**, **Dexter Reservoir**, **Dorena Reservoir**, **Applegate Reservoir**, the **Alton Baker Canoe Canal**, the **McKenzie River above Leaburg Dam**, the **North Santiam River** (Stayton Bridge to Lyons-Mehama) and the **Columbia River at Buoy 10** (Hammond and Astoria). Researched from ODFW's 2026 regulations, its in-season updates and its Southwest, Willamette and Lane County guides, the Oregon State Marine Board's Nov 18 Opportunities and Access Report (ramp status and lake fill levels), Oregon State Parks, Jackson County Parks and the OHA fish advisories.
  - None has a dated catch report. Lost Creek, Dexter and Dorena show a low-confidence score from their Oct 5 stockings and the Alton Baker Canal from its Nov 9 stocking; the other five show as not scored. Lost Creek (16%), Dorena (0%) and Applegate (5%) were at very low water on Nov 18, which the score does not see; it is shown as a notice on each page.
  - The McKenzie page shares the Vida gauge with the Leaburg Landing page, and the North Santiam page adds the Mehama flow gauge (readings appear after the next daily run). The four reservoirs, the upper Rogue, the canal and the estuary have no live feed; each page says so.
  - Map pins are USGS lake and gauge sites, or the general area of a park or campground, and are not access points. The Alton Baker Canal is filed as a lake because it is still, stocked water.
  - ODFW stocks the McKenzie above Leaburg Dam and the North Santiam only from late April and mid-May, and the North Santiam's trout season is closed from Nov 1 to May 21, so those two pages say what is open now (hatchery steelhead, hatchery Chinook and coho) and what is not.
- Batch 1 of the major-waters expansion, added Nov 24, 2026 (Rogue and South Coast): the **Rogue River at Grants Pass** and **above Gold Beach** (Lobster Creek and Quosatana), the **Chetco**, **Elk** and **Sixes** rivers, the **North Umpqua at Glide**, the **South Umpqua at Roseburg**, **Coquille River tidewater** and **Coos Bay**. Researched from ODFW's 2026 regulations (including the Rogue-South Coast steelhead validation), its 2026 fall coastal salmon seasons and in-season updates, its Medford, Roseburg and South Coast "50 places" guides, and the Marine Board's Nov 18 report.
  - None has a dated catch report, so none is scored by report; the seven with a live USGS gauge show conditions only and stay unscored until a report, stocking or count arrives. The Elk's USGS station had no current readings and Coos Bay is tidal, so neither has a feed.
  - Rules that matter right now are notices on each page: North Umpqua steelhead closed through Nov 30, the South Umpqua closed until Dec 1, wild fall Chinook closed on the Elk and Coquille, the Chetco, Sixes and Coos wild Chinook limits, and the steelhead validation needed from Dec 1.
  - The North Umpqua page links the Winchester Dam count. A new region, "South coast", groups the coastal rivers. Map pins are USGS gauge sites or the general area of a park; the Gold Beach, Roseburg and Coquille pins are approximate.
- Batch 2 of the major-waters expansion, added Nov 24, 2026 (north coast and Willamette): the **Nehalem**, **Trask**, **Nestucca**, **Alsea** and **Siuslaw** rivers and **Foster**, **Green Peter** and **Fern Ridge** reservoirs. Researched from ODFW's 2026 regulations, its 2026 fall coastal salmon seasons and in-season updates, its Northwest and Willamette easy-angling guides and Lane County guide, the Northwest Zone weekly report, and the Marine Board's Nov 18 report.
  - None has a dated catch report or a dated stocking in the last 60 days, so all eight show as not scored; the five rivers show live USGS flow and temperature. Foster and Green Peter have stockings planned for spring 2027; Fern Ridge, the coast rivers and the three reservoirs have no live lake-level feed.
  - Rules that matter right now are notices on each page: wild Chinook limits and the Dec. 1 to 31 Chinook closure on the Nehalem, Trask and Nestucca, no wild coho on the Alsea and Siuslaw, and the very low water the Marine Board lists at Foster (11%), Green Peter (below zero) and Fern Ridge (about 1%), with their ramps closed or dry.
  - A new region, "Central coast", already used by the Siletz, now also holds the Alsea and Siuslaw. Map pins are USGS gauge or lake sites.
- Batch 3 of the major-waters expansion, added Nov 24, 2026 (Central Oregon and the Cascades): **Crane Prairie**, **Wickiup**, **Davis**, **East** and **Paulina** lakes, **Cultus Lake**, **Crescent Lake** and **Lake of the Woods**. Researched from ODFW's 2026 regulations, its "50 places within 90 minutes of Bend" and Southeast Zone guides, its Central and Southeast Zone weekly reports, Recreation.gov (Crescent Lake) and the Marine Board's Nov 18 report.
  - None has a dated catch report, a gauge feed, or a stocking in the last 60 days, so all eight show as not scored. East Lake, Paulina Lake, Cultus Lake and Lake of the Woods are on ODFW's 2027 stocking schedule.
  - What matters in late November is on each page as a notice: Crane Prairie and Wickiup are closed to angling until Apr. 22 (the 2026 season is Apr. 22 to Oct. 31), the Paulina Lake Road to East Lake is closed for winter, Davis Lake is fly fishing only with trout catch and release, East and Paulina lakes are catch and release for tiger trout, and Crescent Lake is at 9% full with a 24 inch lake trout minimum. Crescent Lake also carries a note that Recreation.gov lists a late-April-to-October season the regulations do not.
  - Map pins are USGS lake sites where one exists (Crane Prairie, Cultus and Lake of the Woods are approximate). Region "Central Oregon" now also holds East and Paulina lakes.
- Angler posts filed under "not in the guide yet" before a lake got its page are hidden from that homepage list (Eddy sees them pointed at the new page) until they age out after 30 days.
- Hash navigation for the directory, map and every water; search by water/reach/region/species; river/lake and region filters; result counts and resettable empty state.
- Editable Portland origin saved only in this browser. All 22 driving links use the exact documented map query. No estimated drive durations and no routes to the two unverified gauge locations.
- No popularity rankings or invented community statistics.
- Monitoring coverage entries for every water, read every morning where a feed exists (see [River and reservoir conditions](#river-and-reservoir-conditions)). Operator references, historical references and coverage gaps stay labeled as such. Not every water has a working live feed.
- Nearby, upstream, downstream and mainstem/tributary differences are stated explicitly. No station substitutes for a public access point or on-site safety assessment.

## Access details

Records can list several `access_points` (label, type, note, map query, source). When there is more than one, the "Getting there" card lists each with its own directions, and the decision strip at the top of the water page names the first.

## Water map

Open `#/map` from the main navigation, or **See it on the map** on any water page. Inspired by TroutRoute's map, in this site's style:

- A satellite base (Esri World Imagery with place labels) or the USGS topo base, with the USGS National Map hydrography layer on top so every stream and lake shows in blue. The hydrography layer can be switched off.
- One pin per water from `data/map.js`, forest for rivers and blue for lakes. Pins mark the approximate area of each reach. They are not access points, and directions still use only documented access points.
- Choosing a river with a USGS gauge traces its channel about 25 km up and downstream from that gauge using the USGS NLDI service, drawn as a gold line. The trace can run past the named reach, and the page says so. If it fails, the card says the line is unavailable.
- Rivers, Lakes and All filters, a keyboard-friendly list beside the map, a card for the chosen water (score, species, directions), and deep links such as `#/map?water=rogue-river-touvelle`.
- Leaflet 1.9.4 is vendored in `v2/vendor/leaflet` (BSD-2-Clause, license included) and loads with `v2/assets/map.js` and `data/map.js` only when the map opens. Tiles and river lines are fetched by the visitor's browser only on the map page.

Verification used stand-in tiles and river-line responses, because the editing environment could not reach the tile or USGS hosts. Check the live tile and NLDI services on the published site, especially that the USGS hydrography tiles draw as a transparent overlay.

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

- **What it shows:** this week's total and waters first, then ODFW's planned weekly trout stockings across Oregon. ODFW publishes about a year ahead, so the schedule groups it into this week, next week, coming up (by month) and the past 8 weeks, with search by water or zone and a zone filter. `#/stocking?q=<words>` opens it searched.
- **Guide waters:** waters in the guide link to their pages and get a **When was it stocked?** section. `data/stocking-match.js` maps ODFW's names to guide waters.
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

## Weather

- **Weather:** `scripts/fetch-weather.mjs` runs in the daily workflow and reads the National Weather Service forecast (api.weather.gov) at each water's map position in `data/map.js`: the next four forecast periods and any active NWS alerts, written to `data/weather.js`. Gridpoints are cached in that file, so the points lookup only runs when a position moves, and waters on the same grid share one forecast request. A water that fails keeps its last entry for up to 48 hours. Water pages show a **Weather** card in the sidebar, with alerts first and a link to the NWS forecast for that spot; the card is hidden when there is no current data. The map position is the general area of the reach, not an access point. Weather is not part of the score.

## Angler posts

`data/angler.js` holds word-of-mouth reports from public social media, shown on the Reports page ("What anglers are posting"), in each water's latest report and as the latest angler report date in the directory.

- **Sources:** three public Facebook groups (Oregon Fishing; Oregon Fishing Network; Rogue River, Chetco River, Elk River, & Sixes River Fishing Reports) and TikTok (#oregonfishing plus the getrightkell and outdoorguy35 profiles). The lists are at the top of `scripts/fetch-angler.mjs`.
- **How it updates:** `.github/workflows/angler-posts.yml` runs `scripts/fetch-angler.mjs` once a week, on Monday mornings (7:11 am Pacific during daylight time, 6:11 am in winter), separate from the daily data. It collects the posts since the last successful run with Apify, including one day of overlap and up to the full 30-day report window after missed weeks. It skips posts it has already read (`data/angler-seen.json`) and has Claude pick out real fishing reports and write a one-line summary for each. Photo-only posts with no text cannot be read and are skipped. Results are merged into `data/angler.js`, and posts older than 30 days drop off. Missing credentials, either platform failing, or a reading error fail the run and preserve both existing data files and the last successful check date. It can also be run by hand from the Actions tab ("Weekly angler posts"). Pull requests run offline collector tests and syntax checks, with no API charges.
- **Setup:** the workflow needs two repository secrets (Settings, Secrets and variables, Actions): `APIFY_TOKEN` from the Apify console (Settings, API & Integrations) and `ANTHROPIC_API_KEY` from console.anthropic.com. The workflow verifies both are present before collection and reports a missing secret as an error. A refresh is complete only after collection succeeds and `data/angler.js` records the new `checked_on` date.
- **Cost:** Apify charges per post collected. Each run is capped at $2 for Facebook and $1 for TikTok, so four or five weekly runs cost at most about $15 a month, and a normal week should be well under the caps. Claude reads one or two batches a week, likely under a few dollars a month.
- **Started:** Oct 15, 2026, with a hand-run collection back to Sept 15 (578 Facebook posts and 48 TikTok videos from that month). The homepage count is the number of posts read from the last 30 days.
- **Written up generically:** a short summary, the date and a link to the source post. No names, handles or photos.
- **Location honesty:** each entry says when a post was on a different section of the river or did not say where.
- **Oregon only:** new social reports must identify an Oregon water. Washington waters and uncertain locations are excluded, including from the "not in the guide yet" list. Shared Columbia reports must be relevant to an Oregon reach.
- **Scores:** a catch post on the water's own reach (or with the section unstated), from the last 14 days, can raise the score through an "Angler posts" input (15% for rivers, 20% for lakes). It is kept only when it raises the score, never lowers it, never creates a score where there was none, never overrides a rules hold and never raises confidence. Posts from other sections, conditions notes and secondhand mentions are shown but never scored.
- **Display:** posts show for 30 days.
- **Not in the guide yet:** `elsewhere` lists other waters anglers talked about, by number of posts, as a guide to which locations to add next.

## River and reservoir conditions

`scripts/fetch-conditions.mjs` runs every morning and writes `data/conditions.js` from four keyless sources. Each one fails on its own, so one outage never blanks the rest.

- **USGS:** 30 days of flow and water temperature for every USGS gauge in `data/monitoring.js`.
- **NOAA National Water Prediction Service:** supplies Reclamation's PRVO gauge below Bowman Dam (Crooked River), which USGS does not carry. NOAA river forecasts (Northwest River Forecast Center) cover the Lower Deschutes at Moody, Umpqua, McKenzie, Wilson, Siletz, Rogue and Clackamas.
- **US Army Corps of Engineers (CWMS):** Detroit Lake pool, the planned rule-curve level and outflow.
- **Reclamation Hydromet:** Haystack and Henry Hagg pool levels and the Bowman water temperature. Reclamation often refuses cloud requests, so this is optional.

**How the score uses it.** Flow is checked against its 30-day median first: a river at less than half, or more than two and a half times, its recent normal reads as off normal even when the last week has been steady. A NOAA forecast that more than doubles the flow in three days also lowers the score.

## Automatic reports and rules

`data/auto-reports.js` is written by `scripts/fetch-reports.mjs`, which runs every morning in the daily data workflow.

- **WDFW creel report:** finds the newest weekly Columbia River creel PDF and has Claude summarize it for the Oregon guide's Columbia River reach (period, report end date, one-sentence summary with numbers, which section of the river it covers, and a positive, mixed, negative or neutral signal). When this report is newer than a water's own report, water pages show it as the latest report and the score uses it for report tone and freshness. The report's coverage explains where its catch checks apply to the Columbia River.
- **ODFW regulation updates:** reads ODFW's in-season regulation updates page and has Claude list the rule changes in effect or starting within 14 days for each Oregon guide water. They show under **Before you go** as "ODFW regulation update" notices. They never withhold a score; an active closure or restriction adds a score note.
- **Cost:** Claude only runs when a source changes: a new PDF address, or a new hash of the ODFW page text. Both are stored in the file, so most days make no Claude call and a normal week makes about two.
- **Failures:** a source that fails keeps its previous data and is tried again the next day. The step is allowed to fail without stopping the daily data commit. It needs the `ANTHROPIC_API_KEY` repository secret; without it the file is left alone. Pull requests only check that the script parses.

## ODFW weekly zone reports

`scripts/fetch-odfw-reports.mjs` runs every morning in the daily data workflow and writes `data/odfw-reports.js`: ODFW's weekly fishing report for each of its eight zones (Northwest, Southwest, Willamette, Central, Northeast, Southeast, Columbia and Marine), in ODFW's own words. No API key or AI is involved.

- Most report pages carry no date, so each zone records `changed_on`, the first day its exact text was read, plus any date written in the report.
- A zone that fails keeps its previous text, and the step is allowed to fail without stopping the daily data commit.
- Only Eddy reads this file; the pages do not show it yet. It lets Eddy speak to waters outside the guide.

## Fishing scores

- **Field checks.** `data/field-checks.js` holds first-hand trip checks by the site owner. A check moves that water's score up or down for 14 days (25% weight). Its wording stays in the background: the score breakdown only shows "Field check", a one-word result and the date.
- **Caps.** A score needs three inputs, and on a river a live flow reading, to reach Excellent; otherwise it is capped at Good. A flow that falls below half its 7-day median reads "Dropping sharply".
- **Irrigation switches.** `data/flow-seasons.js` lists rivers whose flow changes sharply when irrigation season starts (April to mid-May) or ends (October to mid-November): the Crooked below Bowman Dam and the Deschutes below Bend. In those windows the page and short-list card carry a note, and a river with no live flow reading is capped at Fair.

Every visitor sees the scores for free. Eddy, the AI assistant, can be sold as a pass ($4.99 a month or $39.99 a year) that also brings morning email alerts for the waters a guest follows (see server/README.md). Selling is switched on and opens to the public once the Eddy project has a live Stripe key. The formula lives in `assets/member-preview.js` and both designs use it.

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
  - A notice withholds the score unless the record lists the species that can still be scored (`score_species`, used for trout on both Lower Deschutes reaches, where steelhead and coho are restricted) or the notice has an end date that has passed (`score_notice_until`).
  - Either way, the notice stays visible.
- **Missing inputs.** Missing inputs are skipped and lower confidence, and unverified rule notices lower it too. A water needs at least one input besides gauge readings to be scored.
- **Undated reports.** Crooked River below Opal Springs has no dated fishing report; missing report inputs remain unavailable.
- **Where scores appear.** The homepage short list shows the top five. In the directory, each row shows its score, with a **Best score** sort. Water pages show the score with a breakdown of every input and its source.
- **Not yet tested against catches.** The formula has not been checked against catch results. Scores are shown without a label on the site.

Old classic `#/membership` links go to the water directory.

## Verification

See **Checked** in [v2/README.md](v2/README.md) for what was rendered and tested, and `scripts/check-data.mjs` for the offline data checks (every water has a map position and a monitoring entry, and no dataset names an unknown water).
