// The launch switch: free questions open to the public only with a live Stripe key.
import test from 'node:test';
import assert from 'node:assert/strict';
import {netlifySettings, LAUNCHED} from './netlify/eddy-env.mjs';

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
