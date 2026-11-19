// Eddy on Netlify: /api/ask answers questions (../../ask.mjs); /api/eddy/checkout, /redeem and /portal sell and
// manage Eddy passes through Stripe (../../access.mjs).
// Settings (Netlify project > Environment variables, scope Functions; mark keys secret):
//   ANTHROPIC_API_KEY      required
//   STRIPE_SECRET_KEY      turns on Eddy passes ($4.99/month); an sk_test_ key uses Stripe's test mode
//   EDDY_ACCESS_CODE       optional: a new owner code, replacing the default below
//   EDDY_FREE_PER_DAY      optional: free questions a day for visitors (defaults to 0 before launch, 3 after)
//   ORFF_SITE_URL          where to read the data files; defaults to the GitHub Pages site
//   ORFF_ALLOWED_ORIGINS   sites allowed to call Eddy; defaults to oregonfishforecast.com and the GitHub Pages origin
// The owner's code (from the unlock link, ?eddy=<code>) is free and unlimited. Only its SHA-256 is kept here.
// Daily question counts are kept in the "eddy-usage" Netlify Blobs store.
import {getStore} from '@netlify/blobs';
import {eddyFromEnv} from '../../ask.mjs';
import {blobUsage} from '../../access.mjs';

// Launch switch: false keeps free questions at 0 (only the owner and pass holders can ask). Flip it together with
// sell: true in assets/ask-config.js.
const LAUNCHED = false;
const DEFAULT_ACCESS_HASH = '4dc8eb75a7d3d3bf8e49de60f33c4486ebfc97592944cb5341c0cf370900907f';
const env = name => globalThis.Netlify?.env.get(name) ?? process.env[name];
let eddy = null;

export default async request => {
  eddy ||= eddyFromEnv({
    ANTHROPIC_API_KEY: env('ANTHROPIC_API_KEY'),
    ORFF_SITE_URL: env('ORFF_SITE_URL') || 'https://kenny-yukich.github.io/oregon-fish-forecast-concept/',
    ORFF_ALLOWED_ORIGINS: env('ORFF_ALLOWED_ORIGINS') || 'https://oregonfishforecast.com,https://www.oregonfishforecast.com,https://kenny-yukich.github.io',
    EDDY_ACCESS_CODE: env('EDDY_ACCESS_CODE'),
    EDDY_ACCESS_HASH: env('EDDY_ACCESS_HASH') || DEFAULT_ACCESS_HASH,
    STRIPE_SECRET_KEY: env('STRIPE_SECRET_KEY'),
    STRIPE_PRICE_ID: env('STRIPE_PRICE_ID'),
    EDDY_PASS_SECRET: env('EDDY_PASS_SECRET'),
    // Free questions stay off until launch (LAUNCHED above); an EDDY_FREE_PER_DAY setting on Netlify overrides.
    EDDY_FREE_PER_DAY: env('EDDY_FREE_PER_DAY') ?? String(LAUNCHED ? 3 : 0)
  }, {usage: blobUsage(() => getStore({name: 'eddy-usage', consistency: 'strong'}))});
  return new URL(request.url).pathname.startsWith('/api/eddy/') ? eddy.billing(request) : eddy.ask(request);
};

export const config = {path: ['/api/ask', '/api/eddy/checkout', '/api/eddy/redeem', '/api/eddy/portal'], method: ['GET', 'POST', 'OPTIONS']};
