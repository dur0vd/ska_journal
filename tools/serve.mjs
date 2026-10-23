// Локальный сервер для просмотра сайта: npm run serve -> http://localhost:8080
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { safeAttachmentName } from '../assets/content-policy.js';
import { EMPTY_JOURNAL } from '../assets/journal-core.js';
import { handleJournal } from './journal-api.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf' };

// Журнал в локальном файле: для проверки ввода баллов без GitHub.
export function fileStore(file) {
  return {
    read() {
      const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      return { data: text ? JSON.parse(text) : structuredClone(EMPTY_JOURNAL), version: text };
    },
    write(data, version) {
      const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      if (now !== version) throw Object.assign(new Error('Конфликт версий'), { conflict: true });
      fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    },
  };
}

// journal: хранилище для /api/journal (необязательно).
export function createServer(directory = root, { journal } = {}) {
  return http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (journal && req.url.split('?')[0] === '/api/journal') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const r = await handleJournal(new Request('http://localhost/api/journal', { method: req.method, headers, body }), { store: journal, origins: ['http://' + req.headers.host] });
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(Buffer.from(await r.arrayBuffer()));
  }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end('405'); }
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end('400'); }
  if (/[\\\u0000]/.test(p) || p.split('/').includes('..')) { res.writeHead(404); return res.end('404'); }
  if (p === '/') p = '/index.html';
  const publicFile = /^\/[a-z0-9-]+\.html$/.test(p) || /^\/(assets|files|img)\//.test(p);
  if (!publicFile || (p.startsWith('/files/') && !safeAttachmentName(p))) { res.writeHead(404); return res.end('404'); }
  const file = path.resolve(directory, '.' + p);
  if (!file.startsWith(path.resolve(directory) + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); return res.end('404');
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer(root, { journal: fileStore(path.join(root, 'data/journal.json')) })
    .listen(8080, '127.0.0.1', () => console.log('http://127.0.0.1:8080'));
}
