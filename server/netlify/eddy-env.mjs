// Eddy as Netlify runs it: settings from the project's environment variables, counts and alert followers in
// Netlify Blobs. Shared by the request function (functions/eddy.mjs) and the morning alert run
// (functions/eddy-alerts.mjs). See server/README.md for every setting.
import {getStore} from '@netlify/blobs';
import {eddyFromEnv} from '../ask.mjs';
import {blobUsage} from '../access.mjs';
import {blobAlertStore} from '../alerts.mjs';

// Launch switch. true opens Eddy to the public: 3 free questions a day, then the pass offer. It takes effect only
// with a live Stripe key (sk_live_ or rk_live_). With a test key free questions stay at 0, and the site keeps Eddy
// hidden from the public (assets/ask-config.js, sell: true), so no visitor meets a test-mode checkout. Setting it
// back to false (or sell: false) closes Eddy to the public again. EDDY_FREE_PER_DAY on Netlify overrides the number.
export const LAUNCHED = true;
const DEFAULT_ACCESS_HASH = '4dc8eb75a7d3d3bf8e49de60f33c4486ebfc97592944cb5341c0cf370900907f';
const env = name => globalThis.Netlify?.env.get(name) ?? process.env[name];
let eddy = null;

// The settings eddyFromEnv reads, from a getter for the project's environment variables.
export function netlifySettings(get, {launched = LAUNCHED} = {}) {
  const live = /^(sk|rk)_live_/.test(get('STRIPE_SECRET_KEY') || '');
  return {
    ANTHROPIC_API_KEY: get('ANTHROPIC_API_KEY'),
    ORFF_SITE_URL: get('ORFF_SITE_URL') || 'https://kenny-yukich.github.io/oregon-fish-forecast-concept/',
    ORFF_ALLOWED_ORIGINS: get('ORFF_ALLOWED_ORIGINS') || 'https://oregonfishforecast.com,https://www.oregonfishforecast.com,https://kenny-yukich.github.io',
    EDDY_ACCESS_CODE: get('EDDY_ACCESS_CODE'),
    EDDY_ACCESS_HASH: get('EDDY_ACCESS_HASH') || DEFAULT_ACCESS_HASH,
    STRIPE_SECRET_KEY: get('STRIPE_SECRET_KEY'),
    STRIPE_PRICE_ID: get('STRIPE_PRICE_ID'),
    STRIPE_PRICE_ID_YEARLY: get('STRIPE_PRICE_ID_YEARLY'),
    EDDY_PASS_SECRET: get('EDDY_PASS_SECRET'),
    // 3 free questions a day once launched with a live Stripe key; 0 otherwise.
    EDDY_FREE_PER_DAY: get('EDDY_FREE_PER_DAY') ?? String(launched && live ? 3 : 0),
    RESEND_API_KEY: get('RESEND_API_KEY'),
    EDDY_ALERTS_FROM: get('EDDY_ALERTS_FROM'),
    ORFF_PUBLIC_URL: get('ORFF_PUBLIC_URL'),
    EDDY_STOP_URL: get('EDDY_STOP_URL')
  };
}

export function netlifyEddy() {
  return eddy ||= eddyFromEnv(netlifySettings(env), {
    usage: blobUsage(() => getStore({name: 'eddy-usage', consistency: 'strong'})),
    alertStore: blobAlertStore(() => getStore({name: 'eddy-alerts', consistency: 'strong'}))
  });
}
