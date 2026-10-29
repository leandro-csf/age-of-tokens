import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { ERAS, LEVEL_BASE, LEVEL_RATIO } from '../../sim/src/index.js';

// Nomes e marcos para a tela (ela so recebe ids nos eventos). Estatico: calculado uma vez.
const CONTENT = {
  level: { base: LEVEL_BASE, ratio: LEVEL_RATIO },
  eras: ERAS.map(e => ({ id: e.id, name: e.name, nextAtLevel: e.advance?.minLevel ?? null })),
  totalTechs: ERAS.reduce((n, e) => n + e.techs.length, 0),
  names: Object.fromEntries(
    ERAS.flatMap(e => [...e.buildings, ...e.units, ...e.techs]).map(i => [i.id, i.name])
      .concat(ERAS.map(e => [e.id, e.name])),
  ),
};

/*
 * API somente leitura + arquivos estaticos do front (web/). Nenhuma rota
 * altera nada: a unica fonte de mudanca e o que o Claude Code grava em disco.
 *
 *   GET /api/health   { ok: true }
 *   GET /api/state    snapshot completo (resumo + estado do motor)
 *   GET /api/content  nomes (id -> nome), eras e constantes de nivel para a tela
 *   GET /api/stream   SSE: snapshot, ingest, action, state, heartbeat
 *   GET /*            arquivos de web/ (index.html por padrao)
 */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
};

const HEARTBEAT_MS = 15_000;

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function sse(res, type, data) {
  res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}

function serveStatic(webDir, urlPath, res) {
  const rel = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
  const file = path.resolve(webDir, '.' + rel);
  // impede sair de web/ (../ ou caminho absoluto)
  if (file !== webDir && !file.startsWith(webDir + path.sep)) return sendJson(res, 403, { error: 'proibido' });
  fs.readFile(file, (err, buf) => {
    if (err) return sendJson(res, 404, { error: 'nao encontrado' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

export function createHttp(game, { webDir = path.resolve('web') } = {}) {
  const root = path.resolve(webDir);

  return http.createServer((req, res) => {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'somente GET' });
    let pathname;
    try { pathname = new URL(req.url, 'http://x').pathname; } catch { return sendJson(res, 400, { error: 'url invalida' }); }

    if (pathname === '/api/health') return sendJson(res, 200, { ok: true });
    if (pathname === '/api/state') return sendJson(res, 200, game.snapshot());
    if (pathname === '/api/content') return sendJson(res, 200, CONTENT);

    if (pathname === '/api/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      sse(res, 'snapshot', game.snapshot());
      const off = game.subscribe(({ type, data }) => sse(res, type, data));
      const beat = setInterval(() => res.write(`: heartbeat\n\n`), HEARTBEAT_MS);
      beat.unref();
      req.on('close', () => { clearInterval(beat); off(); });
      return;
    }

    if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'rota desconhecida' });
    try { return serveStatic(root, pathname, res); } catch { return sendJson(res, 400, { error: 'caminho invalido' }); }
  });
}
