import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createGame } from '../src/game.js';
import { createHttp } from '../src/http.js';

async function boot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aot-http-'));
  const projects = path.join(root, 'projects');
  const web = path.join(root, 'web');
  fs.mkdirSync(projects, { recursive: true });
  fs.mkdirSync(web, { recursive: true });
  fs.writeFileSync(path.join(web, 'index.html'), '<h1>aldeia</h1>');
  fs.writeFileSync(path.join(root, 'segredo.txt'), 'nao pode vazar');
  const game = createGame({ projectsDir: projects, saveFile: path.join(root, 'save.json') });
  const server = createHttp(game, { webDir: web });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { game, server, base, projects, close: () => server.closeAllConnections?.() || server.close() };
}

function get(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, res => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('health, state e arquivos estaticos', async () => {
  const s = await boot();
  try {
    assert.deepEqual(JSON.parse((await get(s.base + '/api/health')).body), { ok: true });
    const st = JSON.parse((await get(s.base + '/api/state')).body);
    assert.equal(st.summary.era, 'Era das Trevas');
    assert.equal(st.state.version, 1);
    const index = await get(s.base + '/');
    assert.equal(index.status, 200);
    assert.match(index.headers['content-type'], /text\/html/);
    assert.equal(index.body, '<h1>aldeia</h1>');
  } finally { s.close(); }
});

test('/api/content traz nomes, eras e constantes de nivel', async () => {
  const s = await boot();
  try {
    const c = JSON.parse((await get(s.base + '/api/content')).body);
    assert.equal(c.level.base, 5000);
    assert.equal(c.level.ratio, 1.25);
    assert.equal(c.eras.length, 4);
    assert.equal(c.totalTechs, 16);
    assert.equal(c.eras[0].nextAtLevel, 10);
    assert.equal(c.eras[3].nextAtLevel, null);
    assert.equal(c.names.casa, 'Casa');
    assert.equal(c.names.arado, 'Arado');
    assert.equal(c.names.feudal, 'Era Feudal');
  } finally { s.close(); }
});

test('somente GET; rota de API desconhecida da 404', async () => {
  const s = await boot();
  try {
    assert.equal((await get(s.base + '/api/state', 'POST')).status, 405);
    assert.equal((await get(s.base + '/api/state', 'DELETE')).status, 405);
    assert.equal((await get(s.base + '/api/nada')).status, 404);
    assert.equal((await get(s.base + '/nao-existe.js')).status, 404);
  } finally { s.close(); }
});

test('nao deixa sair de web/ (path traversal)', async () => {
  const s = await boot();
  try {
    for (const p of ['/../segredo.txt', '/%2e%2e/segredo.txt', '/..%2fsegredo.txt']) {
      const r = await get(s.base + p);
      assert.ok(r.status === 403 || r.status === 404, `${p} -> ${r.status}`);
      assert.ok(!r.body.includes('nao pode vazar'), p);
    }
  } finally { s.close(); }
});

test('SSE: manda o snapshot ao conectar e depois os eventos da ingestao', async () => {
  const s = await boot();
  try {
    const dir = path.join(s.projects, 'proj-a');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 's1.jsonl');
    fs.writeFileSync(file, '');
    await s.game.pollOnce(); // registra o arquivo (baseline now)

    const body = await new Promise((resolve, reject) => {
      let buf = '';
      let triggered = false;
      const timer = setTimeout(() => { req.destroy(); reject(new Error('timeout SSE: ' + buf)); }, 4000);
      const req = http.get(s.base + '/api/stream', res => {
        assert.match(res.headers['content-type'], /text\/event-stream/);
        res.on('data', async c => {
          buf += c;
          if (buf.includes('event: snapshot') && !triggered) {
            triggered = true;
            fs.appendFileSync(file, JSON.stringify({
              type: 'assistant', sessionId: 's1', timestamp: '2026-10-29T10:00:00Z',
              message: { id: 'sse1', model: 'claude-sonnet-5', content: [], usage: { output_tokens: 700 } },
            }) + '\n');
            await s.game.pollOnce();
          }
          // 'state' sai por ultimo, quando o poll termina
          if (buf.includes('event: ingest') && buf.includes('event: state')) { clearTimeout(timer); req.destroy(); resolve(buf); }
        });
      });
      req.on('error', e => { if (e.code !== 'ECONNRESET') reject(e); });
    });

    assert.ok(body.indexOf('event: snapshot') < body.indexOf('event: ingest'));
    assert.match(body, /"output":700/);
    assert.match(body, /event: state/);
  } finally { s.close(); }
});
