#!/usr/bin/env node
/* 本地静态服务器：给 tools/test_suite.mjs 的默认 BASE_URL=3311 用。
   用法：node tools/serve.mjs [port]   /   PORT=3311 node tools/serve.mjs
   仅绑定 127.0.0.1，禁用缓存，防止路径穿越。 */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || process.argv[2] || 3311);
const host = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end('method not allowed');
      return;
    }
    const raw = (req.url || '/').split('?')[0].split('#')[0];
    let rel;
    try { rel = decodeURIComponent(raw); } catch (e) { res.writeHead(400); res.end('bad request'); return; }
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(root, '.' + rel);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    const st = await stat(file).catch(() => null);
    if (!st || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('not found: ' + rel);
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(file).on('error', () => { try { res.destroy(); } catch (e) {} }).pipe(res);
  } catch (e) {
    try { res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('internal error'); } catch (err) {}
  }
});

server.on('error', (e) => {
  console.error('[serve] ' + (e && e.message ? e.message : e));
  process.exit(1);
});
server.listen(port, host, () => {
  console.log('[serve] ' + root);
  console.log('[serve] http://' + host + ':' + port + '/  （Ctrl-C 停止）');
});
