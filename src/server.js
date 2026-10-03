import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { createRunner } from './runner.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
export function createServer(options = {}) {
  const runIsolated = createRunner(options);
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; worker-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    res.setHeader('Cache-Control', 'no-store');
    const json = (status, data) => { if (res.destroyed) return; res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path === '/api/health' && req.method === 'GET') return json(200, { ok: true, service: 'turjuman', execution: 'isolated-worker' });
      if (path === '/api/run' && req.method === 'POST') {
        if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') return json(415, { error: 'Expected application/json' });
        if (Number(req.headers['content-length']) > 100000) return json(413, { error: 'Request too large' });
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 100000) return json(413, { error: 'Request too large' });
          chunks.push(chunk);
        }
        let body;
        try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch { return json(400, { error: 'Invalid JSON' }); }
        if (!body || typeof body.source !== 'string') return json(400, { error: 'source must be a string' });
        if (body.source.length > 20000) return json(413, { error: 'Source exceeds 20000 characters' });
        const controller = new AbortController();
        const disconnect = () => { if (!res.writableEnded) controller.abort(); };
        res.once('close', disconnect);
        try { return json(200, await runIsolated(body.source, controller.signal)); }
        finally { res.off('close', disconnect); }
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(405, { error: 'Method not allowed' });
      const base = path.startsWith('/src/language/') ? resolve(root, 'src/language') : resolve(root, 'web');
      const relative = path.startsWith('/src/language/') ? path.slice('/src/language/'.length) : path === '/' ? 'index.html' : path.slice(1);
      const file = resolve(base, decodeURIComponent(relative));
      if (!file.startsWith(base + sep) || !mime[extname(file)]) return json(404, { error: 'Not found' });
      const content = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (!res.headersSent) json(error.status ?? (error.code === 'ENOENT' ? 404 : 400), { error: error.status ? error.message : 'Unable to process request' });
      else res.end();
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 5000;
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1');
  createServer().listen(port, host, () => console.log(`Turjuman listening on ${host}:${port}`));
}
