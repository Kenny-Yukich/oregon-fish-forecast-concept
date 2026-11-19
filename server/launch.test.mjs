// The launch switch: free questions open to the public only with a live Stripe key.
import test from 'node:test';
import assert from 'node:assert/strict';
import {netlifySettings, LAUNCHED} from './netlify/eddy-env.mjs';
import {createAskHandler} from './ask.mjs';

const getter = vars => name => vars[name];

test('launched with a live Stripe key: 3 free questions a day', () => {
  assert.equal(LAUNCHED, true);
  assert.equal(netlifySettings(getter({STRIPE_SECRET_KEY: 'sk_live_abc'})).EDDY_FREE_PER_DAY, '3');
  assert.equal(netlifySettings(getter({STRIPE_SECRET_KEY: 'rk_live_abc'})).EDDY_FREE_PER_DAY, '3');
});

test('a test key, no key, or the switch off keeps free questions at 0', () => {
  assert.equal(netlifySettings(getter({STRIPE_SECRET_KEY: 'sk_test_abc'})).EDDY_FREE_PER_DAY, '0');
  assert.equal(netlifySettings(getter({})).EDDY_FREE_PER_DAY, '0');
  assert.equal(netlifySettings(getter({STRIPE_SECRET_KEY: 'sk_live_abc'}), {launched: false}).EDDY_FREE_PER_DAY, '0');
});

test('EDDY_FREE_PER_DAY on Netlify overrides either way', () => {
  assert.equal(netlifySettings(getter({STRIPE_SECRET_KEY: 'sk_test_abc', EDDY_FREE_PER_DAY: '5'})).EDDY_FREE_PER_DAY, '5');
  assert.equal(netlifySettings(getter({STRIPE_SECRET_KEY: 'sk_live_abc', EDDY_FREE_PER_DAY: '0'})).EDDY_FREE_PER_DAY, '0');
});

test('the key is also read under the misspelled name STRIP_SECRET_KEY, and the right name wins', () => {
  const s = netlifySettings(getter({STRIP_SECRET_KEY: 'sk_live_typo'}));
  assert.equal(s.STRIPE_SECRET_KEY, 'sk_live_typo');
  assert.equal(s.EDDY_FREE_PER_DAY, '3');
  assert.equal(netlifySettings(getter({STRIPE_SECRET_KEY: 'sk_live_right', STRIP_SECRET_KEY: 'sk_test_old'})).STRIPE_SECRET_KEY, 'sk_live_right');
});

test('Eddy answers from every address the site is served at, and from nowhere else', async () => {
  const origins = netlifySettings(getter({})).ORFF_ALLOWED_ORIGINS.split(',');
  const handler = createAskHandler({getContext: async () => 'data', client: {}, allowedOrigins: origins, onUsage: () => {}});
  const status = origin => handler(new Request('https://eddy.example/api/ask', {method: 'GET', headers: {origin}}));
  for (const site of ['https://oregonfishforecast.com', 'https://www.oregonfishforecast.com', 'https://orfishforecast.com', 'https://www.orfishforecast.com', 'https://kenny-yukich.github.io']) {
    const res = await status(site);
    assert.equal(res.status, 200, site);
    assert.equal(res.headers.get('access-control-allow-origin'), site);
  }
  assert.equal((await status('https://orfishforecast.com.example.net')).status, 403);
  // A list set on Netlify replaces the default.
  assert.equal(netlifySettings(getter({ORFF_ALLOWED_ORIGINS: 'https://one.example'})).ORFF_ALLOWED_ORIGINS, 'https://one.example');
});
