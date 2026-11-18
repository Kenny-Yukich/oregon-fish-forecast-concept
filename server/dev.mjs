// Runs the whole site locally with Eddy's endpoint switched on.
//   cd server && npm install && ANTHROPIC_API_KEY=... npm start   (then open http://localhost:8787)
// Serves the repository root as static files, answers POST /api/ask, and serves an assets/ask-config.js that
// points the chat at that endpoint (the committed one leaves the chat hidden until a host is configured).
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createAskHandler, anthropicClient} from './ask.mjs';
import {contextCache, localSource} from './context.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.PORT || 8787);
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8'};

if (!process.env.ANTHROPIC_API_KEY) console.warn('ANTHROPIC_API_KEY is not set: the site loads, but the Eddy chat stays hidden.');
const handleAsk = createAskHandler({getContext: contextCache(localSource(root)), client: anthropicClient(), ready: !!process.env.ANTHROPIC_API_KEY});

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:' + port);
    if (url.pathname === '/api/ask') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const abort = new AbortController();
      res.on('close', () => { if (!res.writableFinished) abort.abort(); });
      const request = new Request(url, {method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks), signal: abort.signal});
      const response = await handleAsk(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) for await (const chunk of response.body) res.write(chunk);
      return res.end();
    }
    if (url.pathname === '/assets/ask-config.js') {
      res.writeHead(200, {'content-type': TYPES['.js'], 'cache-control': 'no-store'});
      return res.end("window.ORFF_ASK = {endpoint: '/api/ask'};\n");
    }
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (path.endsWith('/')) path += 'index.html';
    const file = join(root, path);
    if (!file.startsWith(root) || /[/\\]\.|node_modules/.test(path)) { res.writeHead(404); return res.end('Not found'); }
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {'content-type': TYPES[extname(file)] || 'application/octet-stream'});
    res.end(await readFile(file));
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
}).listen(port, () => console.log('Oregon Fish Forecast with Eddy: http://localhost:' + port));
