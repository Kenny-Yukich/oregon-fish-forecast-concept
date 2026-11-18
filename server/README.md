# Eddy, the AI fishing assistant

An "Ask Eddy" chat panel on the homepage and water pages where visitors ask about the 24 guide waters. Eddy runs on Claude Haiku 5.5 and answers from the same data the pages show: scores and their inputs, dated reports, gauge readings and NOAA forecasts, dam counts, ODFW stocking, NWS weather, ODFW rule changes and angler posts.

## How it fits together

- **`context.mjs`** runs the site's own data files and score formula (`data/*.js`, `assets/member-preview.js`) in a sandbox and writes them out as about 110K characters of plain text (about 47K tokens for Haiku 5.5): one block per guide water, statewide dam counts, the last and next planned stocking for every water on ODFW's schedule (about 255), ODFW's weekly report for each zone (`data/odfw-reports.js`, optional) and "not in the guide yet". Field-check wording stays out, as on the site. The text is rebuilt every 15 minutes and whenever the Pacific date changes; a failed rebuild keeps the last copy.
- **`ask.mjs`** is the endpoint: `POST` a conversation, get the answer streamed back as newline-delimited JSON. It is a web-standard `(Request) => Response` handler.
  - Model `claude-haiku-5-5`, effort `low`, adaptive thinking (the model's default), up to 3,000 output tokens.
  - The instructions and site data go in the system prompt and are cached, so repeat questions within five minutes read the data at a tenth of the price.
  - The browser can send only its conversation (alternating turns, questions up to 800 characters, the last 12 turns kept) and the guide water it is viewing. It cannot add instructions or data.
  - Limits: 20 questions per visitor per 10 minutes and 600 an hour overall, per server instance. Requests from other websites are refused unless listed.
  - A refusal or an API error becomes a short message in the chat; nothing is retried automatically except once by the SDK.
- **`v2/assets/ask.js`** is the chat panel. On page load it sends a `GET` to the endpoint named in `assets/ask-config.js` and shows the "Ask Eddy" button only when the endpoint answers that it is ready (deployed, with an API key). Until then the site shows no chat at all. The readiness check never calls Claude. The conversation is kept for the browser tab only.

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
- `node try.mjs`: asks Haiku 5.5 twelve sample questions in eleven conversations (trout this week, a water page, counts with a follow-up, stocking, a bag-limit question it should not answer, a drive time it should not estimate, a Washington river, an off-topic request, "Who are you?", Lava Lake (a new guide page) and Malheur Reservoir (ODFW zone report only)) and prints the answers, timings, token use and cost. Needs `ANTHROPIC_API_KEY`.
- `.github/workflows/ask-guide.yml` runs both. The live questions run on pushes to branches other than `main` and on manual runs, using the `ANTHROPIC_API_KEY` repository secret; the answers appear in the run summary. Pull requests run offline only.

## Cost

Haiku 5.5 costs $0.10 per million input tokens and $0.50 per million output tokens for prompts up to 100K tokens; cached reads cost a tenth and cache writes 1.25 times the input price. Each question reads about 32K tokens of instructions and site data:

- The first question in a five-minute window writes the cache: about $0.004.
- Questions within five minutes of another read the cache: about $0.0003.
- Answers run 100 to 1,300 output tokens, thinking included: $0.0001 to $0.0007.

The first live check (Nov 18, 2026) asked 9 questions for $0.0086 in total. A thousand questions a month would cost roughly $0.50 if they cluster and up to about $5 if each one arrives alone. Set a monthly spend limit on the API key's workspace in the Claude Console as a backstop.

Speed in that check: the first text appeared in about 0.4 seconds when the cache was warm and 4.4 seconds on the first, uncached question.

## Putting it online

GitHub Pages only serves files, so Eddy's endpoint runs on its own Netlify project, **oregon-fish-forecast-eddy** (https://oregon-fish-forecast-eddy.netlify.app). It is separate from the oregonfishforecast.com project. The website itself stays on GitHub Pages and calls `https://oregon-fish-forecast-eddy.netlify.app/api/ask`.

- `netlify.toml`, `netlify/functions/eddy.mjs` and `public/` (a placeholder page) are the Netlify project. Deploy with this folder (`server/`) as the base directory.
- Production deploys are public so site visitors can reach Eddy; deploy previews need a Netlify team login.
- `assets/ask-config.js` already points at `https://oregon-fish-forecast-eddy.netlify.app/api/ask`. The chat appears by itself once that address is deployed and has its key.
- To deploy: in the Netlify project, Project configuration, Build & deploy, link this GitHub repository with branch `main` and base directory `server`, and leave the build command empty. Netlify then redeploys whenever `main` changes.

Settings the function reads (Netlify project, Project configuration, Environment variables, scope Functions):

- `ANTHROPIC_API_KEY` (required, mark it secret): the key Eddy uses. Redeploy after adding or changing it.
- `ORFF_SITE_URL` (optional): where to read the data files. Defaults to `https://kenny-yukich.github.io/oregon-fish-forecast-concept/`, so answers follow the daily data commits without a redeploy.
- `ORFF_ALLOWED_ORIGINS` (optional): comma-separated sites allowed to call Eddy. Defaults to `https://oregonfishforecast.com`, `https://www.oregonfishforecast.com` and `https://kenny-yukich.github.io`, the two places this repository's `main` branch is published.
