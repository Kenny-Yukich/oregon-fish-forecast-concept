# Oregon Fish Forecast — comparison concept

Open **index.html**. All site code, editorial data and artwork are local; no install or server is required. Keep the assets and data folders beside the entry file.

## Online comparison

GitHub Pages address: **https://kenny-yukich.github.io/oregon-fish-forecast-concept/**

This separate public repository serves the static site from the root of its main branch. It does not deploy to, modify, or replace the original Oregon Fish Forecast app. The comparison asks search engines not to index it.

Only the site, local artwork/data and documentation are published. Local checks, editor configuration, credentials and skill files are excluded.

The design uses forest ink from the supplied fish artwork, serif headings, quiet surfaces and a comparison table as the main utility. Mobile table scrolling stays inside its own region, with water/reach names pinned. Detail pages keep the selected reach visible.

## Included

- All 24 supplied records, preserving actual species, methods, access, alerts, report dates, coverage, sources and October 12 editorial review dates.
- Hash navigation for directory, every water and approach/sources; search by water/reach/region/species; river/lake filters; result counts and resettable empty state.
- Editable Portland origin saved only in this browser. All 22 driving links use the exact documented map query. No estimated drive durations and no routes to the two unverified gauge locations.
- Local seven-day trending from actual water-page opens, deduplicated within 30 minutes. No seeded popularity or invented community statistics.
- Monitoring coverage entries for every water. Sixteen USGS station connections can request actual latest observations individually. Three operator references, two historical references and three unresolved coverage gaps remain honestly labeled. Not every water has a working live feed.
- Nearby, upstream, downstream and mainstem/tributary differences are stated explicitly. No station substitutes for a public access point or on-site safety assessment.

## Readings

Choose a water and use **Load station readings**. A request goes directly to the public USGS API; the rest of the website remains usable offline. There is no automatic background polling.

Measurements retain their units, original timestamp, station and provisional/approval status. Observations older than six hours are marked older; observations over seven days old are withheld. Missing values are never converted to zero. No weather or numerical fishing score is inferred.

The public USGS response for the Madras gauge was retrieved successfully during verification on October 13, 2026. Not all station feeds or browser network/CORS behavior have been verified. Public API availability and rate limits can affect requests.

Source: [USGS modernized API migration documentation](https://api.waterdata.usgs.gov/docs/ogcapi/migration/). Each monitoring entry links to its official station or operator source. Editorial records remain a separate October 12 snapshot.

## Connecting community trends

Current trends are explicitly **this browser**, not community data. The code is ready to emit a water_view event with water_id and entry_point if a future host supplies a consented gtag integration and explicitly enables ORFF_ANALYTICS_CONSENT. No analytics account, SDK, tracking ID or remote analytics collection is installed here.

For community trends, aggregate distinct consenting sessions per water over a rolling seven-day window on a server or scheduled analytics export. Return only public aggregate results to the frontend. Keep analytics credentials server-side; exclude bots/internal traffic and deduplicate repeat visits. Do not send raw search queries or driving origins. Only label results “Community” after a real aggregate feed is connected.

## Verification

Lightweight JavaScript and static checks cover all detail routes, source fidelity, the two blocked driving routes, filter/search/empty-state logic, changed origins, trend deduplication and missing/stale reading handling. No original-site modification was performed. Responsive sizing and keyboard controls received static review; rendered desktop/phone verification remains outstanding.
