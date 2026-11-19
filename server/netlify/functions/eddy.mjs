// Eddy on Netlify:
//   /api/ask                                  answers questions (../../ask.mjs)
//   /api/eddy/checkout, /redeem, /portal      sell and manage Eddy passes through Stripe (../../access.mjs)
//   /api/eddy/alerts, /alerts/test, /stop     water alerts for pass holders (../../alerts.mjs)
// Settings (Netlify project > Environment variables, scope Functions; mark keys secret):
//   ANTHROPIC_API_KEY      required
//   STRIPE_SECRET_KEY      turns on Eddy passes ($4.99/month or $39.99/year); an sk_test_ key uses Stripe's test mode
//   RESEND_API_KEY         sends alert emails (resend.com)
//   EDDY_ALERTS_FROM       optional: the alert sender, on a domain verified in Resend
//   EDDY_ACCESS_CODE       optional: a new owner code, replacing the default in ../eddy-env.mjs
//   EDDY_FREE_PER_DAY      optional: free questions a day for visitors (defaults to 0 before launch, 3 after)
//   ORFF_SITE_URL          where to read the data files; defaults to the GitHub Pages site
//   ORFF_ALLOWED_ORIGINS   sites allowed to call Eddy; defaults to oregonfishforecast.com, orfishforecast.com and the GitHub Pages origin
// The owner's code (from the unlock link, ?eddy=<code>) is free and unlimited. Only its SHA-256 is kept in the repository.
// Daily question counts live in the "eddy-usage" Netlify Blobs store, alert followers in "eddy-alerts".
import {netlifyEddy} from '../eddy-env.mjs';

export default async request => {
  const eddy = netlifyEddy();
  const path = new URL(request.url).pathname;
  if (/^\/api\/eddy\/(alerts|stop)/.test(path)) return eddy.alerts(request);
  return path.startsWith('/api/eddy/') ? eddy.billing(request) : eddy.ask(request);
};

export const config = {
  path: ['/api/ask', '/api/eddy/checkout', '/api/eddy/redeem', '/api/eddy/portal', '/api/eddy/alerts', '/api/eddy/alerts/test', '/api/eddy/stop'],
  method: ['GET', 'POST', 'OPTIONS']
};
