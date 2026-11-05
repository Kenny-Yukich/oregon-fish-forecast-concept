import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const collector = new URL('./fetch-angler.mjs', import.meta.url);
const fixture = fileURLToPath(new URL('./test-fixtures/angler-fetch.mjs', import.meta.url));
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

test('missing credentials fail the CLI and preserve both published data files', t => {
  const result = runCollector(t, {}, false);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /APIFY_TOKEN.*ANTHROPIC_API_KEY/);
  assert.equal(result.dataBytes, result.initialData);
  assert.equal(result.seenBytes, result.initialSeen);
  assert.deepEqual(result.requests, []);
});
