// Eddy as Netlify runs it: settings from the project's environment variables, counts and alert followers in
// Netlify Blobs. Shared by the request function (functions/eddy.mjs) and the morning alert run
// (functions/eddy-alerts.mjs). See server/README.md for every setting.
import {getStore} from '@netlify/blobs';
import {eddyFromEnv} from '../ask.mjs';
import {blobUsage} from '../access.mjs';
import {blobAlertStore} from '../alerts.mjs';

// Launch switch: false keeps free questions at 0 (only the owner and pass holders can ask). Flip it together with
// sell: true in assets/ask-config.js.
const LAUNCHED = false;
const DEFAULT_ACCESS_HASH = '4dc8eb75a7d3d3bf8e49de60f33c4486ebfc97592944cb5341c0cf370900907f';
const env = name => globalThis.Netlify?.env.get(name) ?? process.env[name];
let eddy = null;

export function netlifyEddy() {
  return eddy ||= eddyFromEnv({
    ANTHROPIC_API_KEY: env('ANTHROPIC_API_KEY'),
    ORFF_SITE_URL: env('ORFF_SITE_URL') || 'https://kenny-yukich.github.io/oregon-fish-forecast-concept/',
    ORFF_ALLOWED_ORIGINS: env('ORFF_ALLOWED_ORIGINS') || 'https://oregonfishforecast.com,https://www.oregonfishforecast.com,https://kenny-yukich.github.io',
    EDDY_ACCESS_CODE: env('EDDY_ACCESS_CODE'),
    EDDY_ACCESS_HASH: env('EDDY_ACCESS_HASH') || DEFAULT_ACCESS_HASH,
    STRIPE_SECRET_KEY: env('STRIPE_SECRET_KEY'),
    STRIPE_PRICE_ID: env('STRIPE_PRICE_ID'),
    STRIPE_PRICE_ID_YEARLY: env('STRIPE_PRICE_ID_YEARLY'),
    EDDY_PASS_SECRET: env('EDDY_PASS_SECRET'),
    // Free questions stay off until launch (LAUNCHED above); an EDDY_FREE_PER_DAY setting on Netlify overrides.
    EDDY_FREE_PER_DAY: env('EDDY_FREE_PER_DAY') ?? String(LAUNCHED ? 3 : 0),
    RESEND_API_KEY: env('RESEND_API_KEY'),
    EDDY_ALERTS_FROM: env('EDDY_ALERTS_FROM'),
    ORFF_PUBLIC_URL: env('ORFF_PUBLIC_URL'),
    EDDY_STOP_URL: env('EDDY_STOP_URL')
  }, {
    usage: blobUsage(() => getStore({name: 'eddy-usage', consistency: 'strong'})),
    alertStore: blobAlertStore(() => getStore({name: 'eddy-alerts', consistency: 'strong'}))
  });
}
