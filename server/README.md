# Eddy, the AI fishing assistant

An "Ask Eddy" chat panel on the homepage and water pages where visitors ask about the guide waters (46 as of Nov. 24, 2026). Eddy runs on Claude Haiku 5.5 and answers from the same data the pages show: scores and their inputs, dated reports, gauge readings and NOAA forecasts, dam counts, ODFW stocking, NWS weather, ODFW rule changes and angler posts. When that data has no answer (a water the guide does not cover in full, a rule or closure it does not list, a ramp or road status), Eddy can run a [limited web search of official sites](#web-search) and says which part of an answer came from the web.

## How it fits together

- **`context.mjs`** runs the site's own data files and score formula (`data/*.js`, `assets/member-preview.js`) in a sandbox and writes them out as plain text in two levels:
  - **Cached for every question:** a short summary of each guide water (score and its biggest input, latest report, first notice, in-season rules, gauge, stocking, angler posts, season, access), statewide dam counts, the last and next planned stocking for every water on ODFW's schedule (about 255), ODFW's weekly report for each zone (`data/odfw-reports.js`, optional) and "not in the guide yet". About 72K characters with 37 guide waters on Nov 24, 2026 (roughly 30K tokens); each guide water adds about 1,000 characters, so the guide can grow well past 100 waters and stay under Haiku 5.5's 100K-token price step.
  - **Sent with a question:** the full block (every notice, season rules, methods, access points, gauge, counts, weather) for the water page the visitor is on and the guide waters their latest two questions name, at most 4 (`detailIds` in `ask.mjs`). It goes in the visitor's turn inside `<site_detail>` tags, so the cached part stays the same for everyone; visitor text cannot add those tags.
  - Field-check wording stays out, as on the site. The text is rebuilt every 15 minutes and whenever the Pacific date changes; a failed rebuild keeps the last copy.
- **`ask.mjs`** is the endpoint: `POST` a conversation, get the answer streamed back as newline-delimited JSON. It is a web-standard `(Request) => Response` handler.
  - Model `claude-haiku-5-5`, effort `low`, adaptive thinking (the model's default), up to 3,000 output tokens.
  - The instructions and site data go in the system prompt and are cached, so repeat questions within five minutes read the data at a tenth of the price.
  - The browser can send only its conversation (alternating turns, questions up to 800 characters, the last 12 turns kept) and the guide water it is viewing. It cannot add instructions or data.
  - Limits: 20 questions per visitor per 10 minutes and 600 an hour overall, per server instance. Requests from other websites are refused unless listed.
  - A refusal or an API error becomes a short message in the chat; nothing is retried automatically except once by the SDK.
- **`v2/assets/ask.js`** is the chat panel. On page load it sends a `GET` to the endpoint named in `assets/ask-config.js` and shows the "Ask Eddy" button only when the endpoint answers that it is ready (deployed, with an API key). Until then the site shows no chat at all. The readiness check never calls Claude. The conversation is kept for the browser tab only. On the homepage the same check also fills the "Ask Eddy" card on the hero artwork; a question typed there opens the panel and asks it.

## Web search

Eddy's own data is the answer; the web is the fallback. `ask.mjs` offers Claude the server-side `web_search_20250305` tool (the basic version, with no dynamic filtering and no code execution), which Haiku 5.5 supports.

- **Official sites only.** The search is limited to `SEARCH_DOMAINS` (subdomains are covered): myodfw.com, dfw.state.or.us, oregon.gov (which includes Oregon State Parks), eregulations.com, usgs.gov, weather.gov, noaa.gov, fs.usda.gov, blm.gov, usace.army.mil, usbr.gov, nps.gov and recreation.gov. County and city park sites are not on the list; add them with `EDDY_SEARCH_DOMAINS`. Results are also biased to Oregon.
- **Two searches a question,** and a paused search turn is resumed at most twice. A **site-wide daily cap** (default 300 searches per Pacific day, `EDDY_SEARCHES_PER_DAY`) is checked before each question; once it is spent, questions are answered without the tool and nobody is turned away. The count lives in the same usage store as question counts (Netlify Blobs on the Eddy project), so it holds across server instances.
- **When it searches** is set in `SEARCH_INSTRUCTIONS`: only when the site data does not answer, never for a score, gauge reading, dam count, stocking or angler post, with web facts kept apart from the site's scores and dated reports, a named source site and the page date when it has one, and the usual "check ODFW's current regulations" line. Web pages are treated as untrusted text, so an instruction inside one is ignored.
- **In the panel.** A short "Checking official sites..." shows while a search runs. The pages an answer cited appear under it as "From the web: ..." links (https only, up to five, once each) and stay with the answer in the saved conversation. A visitor sees nothing of the search except those links.
- **Cost.** $10 per 1,000 searches, plus the tokens of the results Claude reads (the basic tool loads every result into context, a few thousand tokens a search, about a tenth of a cent at Haiku prices). A question that searches twice costs roughly $0.02 to $0.03; at the default cap the most search costs in a day is about $3 plus tokens. Set a spend limit on the API key's workspace as a backstop.
- **Settings:** `EDDY_WEB_SEARCH=off` turns it off (on by default), `EDDY_SEARCH_DOMAINS` (comma-separated bare domains, optionally with a path such as `oregon.gov/fishing`) replaces the list, `EDDY_SEARCHES_PER_DAY` sets the cap (0 = off).
- **Not changed:** the cached site data, the question limits and the two-level data (summary plus detail). Search results never enter the saved conversation, only Eddy's answer and its source links do.

## Eddy passes (paid access)

Guests can buy an Eddy pass through Stripe: **$4.99 a month** or **$39.99 a year** (33% off). A pass gives up to **50 questions a day** and [water alerts](#water-alerts). Visitors without a pass get **3 free questions a day** (and the whole site at most 300 free questions a day), then an offer of a pass. The owner's code stays free and unlimited. The rules live in `access.mjs`; the numbers are in its `PLAN`.

- **Launch (switched on, waiting for the live Stripe key).** `netlify/eddy-env.mjs` has `LAUNCHED = true` and `assets/ask-config.js` has `sell: true`. Both take effect only when the Netlify project's `STRIPE_SECRET_KEY` is a live key (`sk_live_...` or a restricted `rk_live_...`): then every visitor sees "Ask Eddy", gets 3 free questions a day, then the pass offer, and water pages show "Get alerts for this water". With a test key (`sk_test_...`) free questions stay at 0 and the site keeps Eddy hidden from the public, so nobody meets a test-mode checkout. A Netlify setting `EDDY_FREE_PER_DAY` overrides the number either way.
- **Going live:** in Stripe, switch to live mode, finish activating the account, copy the live secret key, and replace `STRIPE_SECRET_KEY` on the Eddy Netlify project with it. Turn on the Customer portal in live mode too (Stripe keeps test and live settings apart). Redeploy the Eddy project. Passes bought in test mode stop working once the key changes, because passes are signed with a secret derived from the key.
- **Closing it again:** `LAUNCHED = false` (no free questions) or `sell: false` (no public button), or both.
- **Testing with a test key:** open the site once with `?eddy_shop=1` in your browser (and `?eddy=off` first, so your owner code does not skip the paywall). `?eddy_shop=0` stops. Pay with card 4242 4242 4242 4242.
- **Buying:** the offer shows both prices. Each button calls `/api/eddy/checkout` with `plan: "month"` or `"year"`, which opens Stripe Checkout for that subscription. Stripe sends the guest back with `?eddy_paid=<checkout id>`; `/api/eddy/redeem` checks the payment with Stripe and returns a signed pass, saved in the browser. The welcome message offers a personal link (`?eddy_pass=<pass>`) to use Eddy on other devices.
- **Renewal and cancelling:** a pass carries its paid-through date, or a date a month out on a yearly plan, so a refunded yearly pass stops within a month. After that, Eddy asks Stripe whether the subscription is still active and quietly renews the pass, or treats the guest as a free visitor once it has ended. "Manage subscription" opens Stripe's customer portal (`/api/eddy/portal`); turn the portal on once in the Stripe dashboard (Settings, Billing, Customer portal).
- **What is stored:** nothing about guests except daily question counts, in the `eddy-usage` Netlify Blobs store, keyed by subscription or by a hash of the connection's address. Stripe holds the customer and subscription.
- **Settings:** `STRIPE_SECRET_KEY` (required to sell), `STRIPE_PRICE_ID` and `STRIPE_PRICE_ID_YEARLY` (optional, sell existing Stripe prices instead of the built-in ones), `EDDY_PASS_SECRET` (optional, signs passes; defaults to a secret derived from the Stripe key, so changing the Stripe key signs guests out until their next visit renews them).

## Water alerts

Pass holders (and the owner) follow up to 20 waters and get **one email a morning** when something new happens on them. Nothing new, no email. The rules live in `alerts.mjs`.

- **What can be followed:** the guide waters, from the "Follow this water" button in a water page's header or the Alerts view in the Eddy panel, and every other water on ODFW's stocking schedule (about 255), from the Alerts view.
- **What counts as news** (each can be turned off in the Alerts view):
  - ODFW plans trout for the water this week or next.
  - The site's score turns Good, or Excellent.
  - The NOAA river forecast shows a big rise coming (at least 1.5 times the current flow): a blowout heads-up.
  - A new ODFW in-season rule, or a notice on the water's page.
  - A National Weather Service alert covering the water.
  - ODFW's weekly zone report has new text that names the water.
- **Once only:** each follower keeps a list of what they were sent. Nothing is sent twice, and a fact that comes back (a score that slips under Good and climbs back) is sent again only after it has been gone a week. A newly followed water starts quiet: what is already true is not news. Turning a kind on later does not send old news either.
- **When:** `netlify/functions/eddy-alerts.mjs` is a Netlify scheduled function at 16:05 UTC (8:05 am Pacific in winter, 9:05 am in summer), after the daily data job has published. It runs only on the published deploy; "Run now" in the Netlify dashboard (Functions, eddy-alerts) runs it by hand. A follower already handled that day is skipped, so a second run sends nothing twice. If sending fails, nothing is marked sent and the next run tries again.
- **Where it goes:** pass holders get alerts at the email on their Stripe subscription (they change it under Manage subscription). The owner types an address in the Alerts view. "Email me a sample now" sends everything current on the followed waters, three times a day at most.
- **Stopping:** every email has a "Stop these emails" link and a one-click unsubscribe header. The link opens a page with a button (a mail scanner opening the link stops nothing). Saving alerts again in Eddy turns them back on. Cancelled subscriptions stop getting alerts at their next Stripe check.
- **What is stored:** one record per follower in the `eddy-alerts` Netlify Blobs store: the subscription id (or "owner"), the email address, the followed waters, the alert kinds and what was already sent.
- **Email service:** alerts are sent through [Resend](https://resend.com) (free for up to 3,000 emails a month, 100 a day). Without `RESEND_API_KEY` everything works except sending: choices are saved and the Alerts view says emails are not switched on yet.
  1. Create a Resend account and add the domain `oregonfishforecast.com` (Domains, Add domain). Resend lists a few DNS records; add them where the domain's DNS is managed, then press Verify.
  2. Create an API key (API Keys, permission "Sending access") and add it to the Eddy Netlify project as `RESEND_API_KEY` (secret, scope Functions). Redeploy.
  3. Alerts come from `Eddy at Oregon Fish Forecast <alerts@oregonfishforecast.com>`. `EDDY_ALERTS_FROM` changes the sender. Before the domain is verified, Resend only sends to your own Resend login address from `onboarding@resend.dev`, which is enough to try a sample.
- **Settings:** `RESEND_API_KEY`, `EDDY_ALERTS_FROM` (optional), `ORFF_PUBLIC_URL` (optional, the site the emails link to; default `https://oregonfishforecast.com/`), `EDDY_STOP_URL` (optional, this endpoint's stop page).

## The owner's access

The owner's unlock link makes Eddy free and unlimited in a browser. Before launch (or with a test Stripe key) it is also the only way, besides a pass or `?eddy_shop=1`, to see Eddy at all:

- **Unlock a browser:** open the site once with `?eddy=<access code>` added, for example `https://oregonfishforecast.com/?eddy=<code>`. The code is saved in that browser (each site address keeps its own copy), removed from the address bar, and Eddy appears. `?eddy=off` locks the browser again.
- **Everyone else**, until the public launch takes effect, sees no chat. With `sell: false` and `private: true` in `assets/ask-config.js` their browser never contacts Eddy; with `sell: true` it makes one status check per tab (which never calls Claude) to learn whether passes are on sale with a live key.
- **The endpoint checks the code** on every request (`x-eddy-key` header). Without a code, a pass or a free question left, it refuses before reading the question, loading data or calling Claude, so a stranger or a bot costs nothing beyond the free questions (at most 300 a day site-wide).
- **Changing the code:** add a secret `EDDY_ACCESS_CODE` in the Netlify project's environment variables and redeploy. It replaces the default, whose SHA-256 is in `netlify/eddy-env.mjs` (the repository holds only that hash, never the code). Browsers holding the old code forget it on their next visit.
- The local server (`dev.mjs`) has no code, so the chat and alerts work there without one (alert emails need `RESEND_API_KEY`).

## Run it locally

```bash
cd server && npm ci
```

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Then open http://localhost:8787. The local server serves the whole site and points the chat at its own `/api/ask`.

## Tests

- `npm test`: offline tests with stand-ins for Claude, Stripe and the email service (no API calls).
- `TRY_SEARCH=1 node try.mjs` adds the limited web search and three more questions: a rule the data lacks (should search and cite), and two that must not search (one the data answers, one asking for a score "from the web"). It fails the run if either of those searches. Off by default, so CI never spends on searches. Needs a key; I could not run it in the environment where the search was written, so the first live run is the real test of the search path.
- `node try.mjs`: asks Haiku 5.5 twelve sample questions in eleven conversations (trout this week, a water page, counts with a follow-up, stocking, a bag-limit question it should not answer, a drive time it should not estimate, a Washington river, an off-topic request, "Who are you?", Lava Lake (a new guide page) and Malheur Reservoir (ODFW zone report only)) and prints the answers, timings, token use and cost. Needs `ANTHROPIC_API_KEY`.
- `.github/workflows/ask-guide.yml` runs both. The live questions run on pushes to branches other than `main` and on manual runs, using the `ANTHROPIC_API_KEY` repository secret; the answers appear in the run summary. Pull requests run offline only.

## Cost

Haiku 5.5 costs $0.10 per million input tokens and $0.50 per million output tokens for prompts up to 100K tokens, and five times that ($0.50 / $2.50) above it; cached reads cost a tenth and cache writes 1.25 times the input price. Each question reads about 32K tokens of cached instructions and site data, plus up to a few thousand uncached tokens of detail for the waters it is about (figures below are from the Nov 18 check, before the two-level split):

- The first question in a five-minute window writes the cache: about $0.004.
- Questions within five minutes of another read the cache: about $0.0003.
- Answers run 100 to 1,300 output tokens, thinking included: $0.0001 to $0.0007.

The first live check (Nov 18, 2026) asked 9 questions for $0.0086 in total. A thousand questions a month would cost roughly $0.50 if they cluster and up to about $5 if each one arrives alone. Set a monthly spend limit on the API key's workspace in the Claude Console as a backstop.

Speed in that check: the first text appeared in about 0.4 seconds when the cache was warm and 4.4 seconds on the first, uncached question.

## Putting it online

GitHub Pages only serves files, so Eddy's endpoint runs on its own Netlify project, **oregon-fish-forecast-eddy** (https://oregon-fish-forecast-eddy.netlify.app). It is separate from the oregonfishforecast.com project. The website itself stays on GitHub Pages and calls `https://oregon-fish-forecast-eddy.netlify.app/api/ask`.

- `netlify.toml`, `netlify/eddy-env.mjs` (settings), `netlify/functions/eddy.mjs` (the routes), `netlify/functions/eddy-alerts.mjs` (the morning alert run) and `public/` (a placeholder page) are the Netlify project. Deploy with this folder (`server/`) as the base directory.
- Production deploys are public so site visitors can reach Eddy; deploy previews need a Netlify team login.
- `assets/ask-config.js` already points at `https://oregon-fish-forecast-eddy.netlify.app/api/ask`. The chat appears by itself once that address is deployed and has its key.
- To deploy: in the Netlify project, Project configuration, Build & deploy, link this GitHub repository with branch `main` and base directory `server`, and leave the build command empty. Netlify then redeploys whenever `main` changes.

Settings the function reads (Netlify project, Project configuration, Environment variables, scope Functions):

- `ANTHROPIC_API_KEY` (required, mark it secret): the key Eddy uses. Redeploy after adding or changing it.
- `ORFF_SITE_URL` (optional): where to read the data files. Defaults to `https://kenny-yukich.github.io/oregon-fish-forecast-concept/`, so answers follow the daily data commits without a redeploy.
- `ORFF_ALLOWED_ORIGINS` (optional): comma-separated sites allowed to call Eddy. Defaults to `oregonfishforecast.com` and `orfishforecast.com` (each with and without `www`) and `https://kenny-yukich.github.io`, the places this repository's `main` branch is published (`SITE_ORIGINS` in `netlify/eddy-env.mjs`). A site address that is not listed shows no Eddy. Setting this variable replaces the whole list. The owner's code and a guest's pass are saved per address, which is why `orfishforecast.com` forwards to `oregonfishforecast.com` (the `_redirects` file at the repository root); the short domain stays on this list in case the forward is ever removed.
