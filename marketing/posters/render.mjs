// Renders marketing/posters/posters.html to print PDFs (18 x 24 in) and preview PNGs.
//   node marketing/posters/render.mjs
// Needs Playwright with Chromium (not a dependency of this repository). The page loads its fonts from
// Google Fonts, so the machine needs internet access; HTTPS_PROXY is used when set.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const POSTERS = [
  ['p1', '01-read-the-river'],
  ['p2', '02-are-the-fish-in'],
  ['p3', '03-ask-eddy'],
  ['p4', '04-trout-are-coming'],
];

const types = { '.html': 'text/html', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.css': 'text/css', '.js': 'text/javascript' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  const file = join(root, path);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }).end(body); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/marketing/posters/posters.html`;

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
const browser = await chromium.launch(proxy ? { proxy: { server: proxy, bypass: '127.0.0.1,localhost' } } : {});
try {
  await mkdir(join(here, 'png'), { recursive: true });
  await mkdir(join(here, 'pdf'), { recursive: true });

  // Preview PNGs at 2400 x 3200.
  const page = await browser.newPage({ viewport: { width: 1300, height: 1700 }, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__postersReady === true, null, { timeout: 60000 });
  const fontsOk = await page.evaluate(() => ['Fraunces', 'Instrument Sans', 'JetBrains Mono'].every(f => document.fonts.check(`20px "${f}"`)));
  if (!fontsOk) throw new Error('Brand fonts did not load; check the connection to Google Fonts.');
  for (const [id, name] of POSTERS) {
    await page.locator('#' + id).screenshot({ path: join(here, 'png', name + '.png') });
    console.log('png', name);
  }

  // Print PDFs: one 18 x 24 in page per poster. 1200 CSS px x 1.44 = 1728 px = 18 in.
  await page.emulateMedia({ media: 'print' });
  for (const [i, [, name]] of POSTERS.entries()) {
    await page.pdf({ path: join(here, 'pdf', name + '-18x24.pdf'), width: '18in', height: '24in', scale: 1.44, printBackground: true, pageRanges: String(i + 1), margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    console.log('pdf', name);
  }
} finally {
  await browser.close();
  server.close();
}
