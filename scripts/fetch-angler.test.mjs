import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const collector = new URL('./fetch-angler.mjs', import.meta.url);
const fixture = new URL('./test-fixtures/angler-fetch.mjs', import.meta.url).href;
const oldData = {
  checked_on: '2026-10-15', window_start: '2026-09-15',
  reviewed: {facebook_posts: 1, tiktok_videos: 0}, sources: [],
  waters: {}, elsewhere: [], elsewhere_posts: [],
  read_log: [{date: '2026-10-15', facebook_posts: 1, tiktok_videos: 0}]
};

function runCollector(t, scenario = {}, credentials = true) {
  const dir = mkdtempSync(join(tmpdir(), 'orff-angler-'));
  t.after(() => {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert.ok(dir.startsWith(join(tmpdir(), 'orff-angler-')));
    rmSync(dir, {recursive: true, force: true});
  });
  mkdirSync(join(dir, 'scripts'));
  mkdirSync(join(dir, 'data'));
  copyFileSync(collector, join(dir, 'scripts/fetch-angler.mjs'));
  // Stand in for the external SDK, while sending its request through the same
  // intercepted network boundary as Apify. No npm install or live API is used.
  if (!scenario.withoutSdk) {
    const sdk = join(dir, 'node_modules/@anthropic-ai/sdk');
    mkdirSync(sdk, {recursive: true});
    writeFileSync(join(sdk, 'package.json'), JSON.stringify({type: 'module', exports: './index.mjs'}));
    writeFileSync(join(sdk, 'index.mjs'), `
    export default class Anthropic {
      static APIError = class extends Error {};
      beta = {messages: {create: async body => {
        const response = await fetch('https://api.anthropic.com/v1/messages', {method: 'POST', body: JSON.stringify(body)});
        if (!response.ok) throw new Anthropic.APIError('API ' + response.status);
        return response.json();
      }}};
    }
    `);
  }
  const initialData = 'window.ORFF_ANGLER = ' + JSON.stringify(scenario.current || oldData) + ';\n';
  const initialSeen = JSON.stringify(scenario.seen || {'https://example.test/seen': '2026-10-15'}) + '\n';
  writeFileSync(join(dir, 'data/angler.js'), initialData);
  writeFileSync(join(dir, 'data/angler-seen.json'), initialSeen);
  writeFileSync(join(dir, 'data/waters.js'), 'window.ORFF_DATA = ' + JSON.stringify({waters: [{id: 'test-river', name: 'Test River', reach: 'Lower river', region: 'Oregon', kind: 'river', planning: {target_species: ['Trout']}}]}) + ';');
  writeFileSync(join(dir, 'scenario.json'), JSON.stringify(scenario));
  const result = spawnSync(process.execPath, ['--import', fixture, join(dir, 'scripts/fetch-angler.mjs')], {
    cwd: dir, encoding: 'utf8', timeout: 10000,
    env: {...process.env, APIFY_TOKEN: credentials ? 'fixture-apify' : '', ANTHROPIC_API_KEY: credentials ? 'fixture-anthropic' : '', STRICT: '', ORFF_TEST_DIR: dir}
  });
  assert.ifError(result.error);
  const dataBytes = readFileSync(join(dir, 'data/angler.js'), 'utf8');
  const seenBytes = readFileSync(join(dir, 'data/angler-seen.json'), 'utf8');
  const win = {};
  new Function('window', dataBytes)(win);
  const requests = readFileSync(join(dir, 'requests.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  return {...result, dataBytes, seenBytes, initialData, initialSeen, data: win.ORFF_ANGLER, seen: JSON.parse(seenBytes), requests};
}

test('missing credentials fail before loading the SDK and preserve both published data files', t => {
  const result = runCollector(t, {withoutSdk: true}, false);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /APIFY_TOKEN.*ANTHROPIC_API_KEY/);
  assert.equal(result.dataBytes, result.initialData);
  assert.equal(result.seenBytes, result.initialSeen);
  assert.deepEqual(result.requests, []);
});

for (const platform of ['facebook', 'tiktok']) {
  test(`a failed ${platform} collection cannot publish a partial check`, t => {
    const result = runCollector(t, {fail: platform});
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /failed/i);
    assert.equal(result.dataBytes, result.initialData);
    assert.equal(result.seenBytes, result.initialSeen);
    assert.ok(!result.requests.some(r => r.url.includes('anthropic.com')));
  });
}

test('catch-up requests reach the retention window without raising either spending cap', t => {
  const result = runCollector(t, {current: {...oldData, checked_on: '2026-09-01'}});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const facebook = result.requests.find(r => r.url.includes('/acts/apify~facebook'));
  const tiktok = result.requests.find(r => r.url.includes('/acts/clockworks~tiktok'));
  assert.equal(facebook.body.onlyPostsNewerThan, '30 days');
  assert.equal(tiktok.body.oldestPostDateUnified, '30 days');
  assert.equal(new URL(facebook.url).searchParams.get('maxTotalChargeUsd'), '2');
  assert.equal(new URL(tiktok.url).searchParams.get('maxTotalChargeUsd'), '1');
});

test('two successful empty sources record a completed check without needing the SDK', t => {
  const result = runCollector(t, {withoutSdk: true});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.data.checked_on, '2026-11-05');
  assert.equal(result.data.window_start, '2026-10-06');
  assert.deepEqual(result.data.reviewed, {facebook_posts: 1, tiktok_videos: 0});
  assert.equal(result.seenBytes, result.initialSeen);
  assert.ok(!result.requests.some(r => r.url.includes('anthropic.com')));
});

const facebookPost = {url: 'https://www.facebook.com/groups/fixture/posts/new', time: '2026-10-18T18:00:00Z', text: 'Caught trout on the lower Test River.'};
const tiktokPost = {webVideoUrl: 'https://www.tiktok.com/@fixture/video/new', createTimeISO: '2026-11-04T18:00:00Z', text: 'Trout biting on the lower Test River today.'};
const reports = [
  {url: facebookPost.url, water_id: 'test-river', elsewhere_water: '', kind: 'catch', where: '', note: 'Trout were caught on the lower river.', signal: 'positive', scoring: true},
  {url: tiktokPost.webVideoUrl, water_id: 'test-river', elsewhere_water: '', kind: 'catch', where: '', note: 'An angler reported trout biting on the lower river.', signal: 'positive', scoring: true}
];

test('a completed catch-up keeps source dates, adds missed reports once, and expires old data', t => {
  const existing = {url: 'https://example.test/seen', date: '2026-10-14', platform: 'Facebook', kind: 'catch', where: '', note: 'An earlier catch.', signal: 'positive', scoring: true};
  const result = runCollector(t, {
    current: {...oldData, waters: {'test-river': [existing, {...existing, url: 'https://example.test/expired', date: '2026-10-01'}]},
      read_log: [...oldData.read_log, {date: '2026-10-01', facebook_posts: 50, tiktok_videos: 20}],
      elsewhere_posts: [{date: '2026-10-01', water: 'Old lake', note: 'An old report.', url: 'https://example.test/expired-elsewhere'}]},
    seen: {'https://example.test/seen': '2026-10-15', 'https://example.test/expired': '2026-09-01'},
    facebook: [facebookPost, facebookPost, {...facebookPost, url: existing.url}, {...facebookPost, url: 'https://example.test/too-old', time: '2026-09-30T18:00:00Z'}],
    tiktok: [tiktokPost], reports
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.data.checked_on, '2026-11-05');
  assert.equal(result.data.window_start, '2026-10-06');
  assert.deepEqual(result.data.waters['test-river'].map(p => [p.url, p.date]), [
    [tiktokPost.webVideoUrl, '2026-11-04'], [facebookPost.url, '2026-10-18'], [existing.url, '2026-10-14']
  ]);
  assert.equal(result.data.waters['test-river'][1].note, reports[0].note);
  assert.equal(result.data.waters['test-river'][1].scoring, true);
  assert.deepEqual(result.data.reviewed, {facebook_posts: 2, tiktok_videos: 1});
  assert.deepEqual(result.data.elsewhere_posts, []);
  assert.deepEqual(result.data.elsewhere, []);
  assert.equal(result.seen[facebookPost.url], '2026-11-05');
  assert.equal(result.seen[tiktokPost.webVideoUrl], '2026-11-05');
  assert.equal(result.seen['https://example.test/expired'], undefined);
  const request = result.requests.find(r => r.url.includes('/acts/apify~facebook'));
  assert.equal(request.body.onlyPostsNewerThan, '22 days');
  const reading = result.requests.find(r => r.url.includes('anthropic.com'));
  const sentPosts = JSON.parse(reading.body.messages[0].content.replace(/^Posts as JSON:\n/, ''));
  assert.deepEqual(sentPosts.map(p => p.url), [facebookPost.url, tiktokPost.webVideoUrl]);
});

test('a failed report-reading service preserves both data files after collection', t => {
  const result = runCollector(t, {facebook: [facebookPost], tiktok: [tiktokPost], fail: 'anthropic'});
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /Reading posts failed/);
  assert.equal(result.dataBytes, result.initialData);
  assert.equal(result.seenBytes, result.initialSeen);
});
