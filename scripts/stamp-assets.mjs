#!/usr/bin/env node
/* Stamps each stylesheet and script address in the site's pages with a short hash of that file's contents,
   for example v2/assets/app.js?v=1a2b3c4d5e. A browser that kept an older copy of a file then asks for the new one
   by its new address, so a fresh page can never be drawn with a stale stylesheet or script (which is what a phone
   showed on Nov 19, 2026: the new homepage markup with the old CSS and JavaScript).

   After changing any CSS or JavaScript the pages load:   node scripts/stamp-assets.mjs
   Check only, as the "Site check" workflow does:         node scripts/stamp-assets.mjs --check

   Files in data/ are left alone: the daily workflow rewrites them every morning, and a slightly late reading
   does not break the page. Addresses on other sites are left alone too. */
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The page's <template id="map-assets"> is stamped too: app.js loads the map files from those addresses.
const PAGES = ['index.html'];
const check = process.argv.includes('--check');
// Hash the text with Unix line endings, so a Windows checkout and the workflow agree.
const stamp = file => createHash('sha256').update(readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 10);

let stale = 0, changed = 0;
for (const page of PAGES) {
  const file = join(root, page), html = readFileSync(file, 'utf8');
  const out = html.replace(/(<(?:script|link)\b[^>]*?\b(?:src|href)=")([^"?#]+\.(?:js|css))(\?v=[^"#]*)?(")/g, (all, pre, url, old, post) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) return all;
    const target = resolve(dirname(file), url), inside = relative(root, target);
    if (inside.startsWith('..') || inside.split(sep)[0] === 'data' || !existsSync(target)) return all;
    const next = '?v=' + stamp(target);
    if (old !== next) { stale++; if (check) console.error(page + ': ' + url + ' is stamped ' + (old || 'with nothing') + ', should be ' + next); }
    return pre + url + next + post;
  });
  if (out !== html && !check) { writeFileSync(file, out); changed++; }
}
if (check) {
  if (stale) { console.error('\n' + stale + ' stale stamp' + (stale === 1 ? '' : 's') + '. Run: node scripts/stamp-assets.mjs'); process.exit(1); }
  console.log('Every stylesheet and script address is stamped with its current contents.');
} else {
  console.log(changed ? 'Stamped ' + stale + ' address' + (stale === 1 ? '' : 'es') + ' in ' + changed + ' page' + (changed === 1 ? '' : 's') + '.' : 'Stamps were already current.');
}
