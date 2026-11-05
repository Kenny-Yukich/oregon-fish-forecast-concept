import {appendFileSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const dir = process.env.ORFF_TEST_DIR;
const scenario = JSON.parse(readFileSync(join(dir, 'scenario.json'), 'utf8'));
const log = join(dir, 'requests.jsonl');
writeFileSync(log, '');
Date.now = () => Date.parse('2026-11-05T20:00:00Z');

globalThis.fetch = async (input, options = {}) => {
  const url = String(input);
  const body = options.body ? JSON.parse(options.body) : null;
  appendFileSync(log, JSON.stringify({url, body}) + '\n');
  if (url.startsWith('https://api.apify.com/v2/acts/')) {
    const platform = url.includes('facebook') ? 'facebook' : 'tiktok';
    if (scenario.fail === platform) return Response.json({error: 'fixture failure'}, {status: 503});
    return Response.json({data: {id: platform, status: 'SUCCEEDED', defaultDatasetId: platform}});
  }
  if (url.startsWith('https://api.apify.com/v2/datasets/')) {
    const platform = url.includes('/facebook/') ? 'facebook' : 'tiktok';
    return Response.json(scenario[platform] || []);
  }
  if (url === 'https://api.anthropic.com/v1/messages') {
    if (scenario.fail === 'anthropic') return Response.json({error: 'fixture failure'}, {status: 400});
    return Response.json({stop_reason: 'end_turn', content: [{type: 'text', text: JSON.stringify({reports: scenario.reports || []})}]});
  }
  throw new Error('Unexpected network request blocked by test fixture');
};
