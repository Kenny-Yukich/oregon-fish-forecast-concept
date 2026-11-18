# Ask the guide

A chat panel on the homepage ("Ask the guide") where visitors ask about the 24 guide waters. Claude Haiku 5.5 answers from the same data the pages show: scores and their inputs, dated reports, gauge readings and NOAA forecasts, dam counts, ODFW stocking, NWS weather, ODFW rule changes and angler posts.

## How it fits together

- **`context.mjs`** runs the site's own data files and score formula (`data/*.js`, `assets/member-preview.js`) in a sandbox and writes them out as about 75K characters of plain text (about 20K tokens), one block per water plus statewide counts, stocking and "not in the guide yet". Field-check wording stays out, as on the site. The text is rebuilt every 15 minutes and whenever the Pacific date changes; a failed rebuild keeps the last copy.
- **`ask.mjs`** is the endpoint: `POST` a conversation, get the answer streamed back as newline-delimited JSON. It is a web-standard `(Request) => Response` handler.
  - Model `claude-haiku-5-5`, effort `low`, adaptive thinking (the model's default), up to 3,000 output tokens.
  - The instructions and site data go in the system prompt and are cached, so repeat questions within five minutes read the data at a tenth of the price.
  - The browser can send only its conversation (alternating turns, questions up to 800 characters, the last 12 turns kept) and the guide water it is viewing. It cannot add instructions or data.
  - Limits: 20 questions per visitor per 10 minutes and 600 an hour overall, per server instance. Requests from other websites are refused unless listed.
  - A refusal or an API error becomes a short message in the chat; nothing is retried automatically except once by the SDK.
- **`v2/assets/ask.js`** is the chat panel. It shows only when `assets/ask-config.js` names an endpoint, so the static GitHub Pages site shows no chat until one is deployed. The conversation is kept for the browser tab only.

## Run it locally

```bash
cd server && npm ci
```

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Then open http://localhost:8787. The local server serves the whole site and points the chat at its own `/api/ask`.

## Tests

- `npm test`: offline tests with a stand-in client (no API calls).
- `node try.mjs`: asks Haiku 5.5 eight sample questions (trout this week, a water page, counts with a follow-up, stocking, a bag-limit question it should not answer, a drive time it should not estimate, a Washington river and an off-topic request) and prints the answers, timings, token use and cost. Needs `ANTHROPIC_API_KEY`.
- `.github/workflows/ask-guide.yml` runs both. The live questions run on pushes to branches other than `main` and on manual runs, using the `ANTHROPIC_API_KEY` repository secret; the answers appear in the run summary. Pull requests run offline only.

## Cost

Haiku 5.5 costs $0.10 per million input tokens and $0.50 per million output tokens for prompts up to 100K tokens. A question reads about 20K tokens of site data: about $0.002 the first time and about $0.0003 when the cached copy is used, plus a few hundred output tokens (about $0.0002). A thousand questions a month is roughly $0.50 to $2. Set a monthly spend limit on the API key's workspace in the Claude Console as a backstop.

## Putting it online

GitHub Pages only serves files, so the endpoint needs a host that runs code and keeps the API key secret. Any host that takes a web-standard handler works. Once it is up, put its URL in `assets/ask-config.js` and add the site's origin to the allowed origins.

Settings the endpoint reads on a host:

- `ANTHROPIC_API_KEY`: the key, stored as a secret on the host.
- `ORFF_SITE_URL`: where to read the data files, for example `https://kenny-yukich.github.io/oregon-fish-forecast-concept/`, so answers follow the daily data commits without a redeploy.
- `ORFF_ALLOWED_ORIGINS`: comma-separated sites allowed to call it, for example `https://kenny-yukich.github.io`.
