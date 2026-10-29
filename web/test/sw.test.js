import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

// Roda o sw.js de verdade num ambiente simulado (cache e rede falsos): nao da para registrar um
// service worker no Node, mas da para provar o que ele FAZ em cada evento.
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = fs.readFileSync(path.join(web, 'sw.js'), 'utf8');
const ORIGIN = 'http://localhost:4100';
const keyOf = r => (typeof r === 'string' ? r : r.url);

function makeEnv() {
  const handlers = {};
  const stores = new Map();            // nome do cache -> Map(url -> { status, body })
  const net = { online: true, hits: [], routes: {} };
  const mkResponse = rec => new Response(rec.body, { status: rec.status });

  const cacheOf = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      async add(url) { const res = await fetchMock(ORIGIN + url); if (!res.ok) throw new Error('falhou ' + url); m.set(ORIGIN + url, { status: res.status, body: await res.clone().text() }); },
      async put(req, res) { m.set(keyOf(req), { status: res.status, body: await res.clone().text() }); },
      async match(req) { const r = m.get(keyOf(req)); return r ? mkResponse(r) : undefined; },
      async keys() { return [...m.keys()].map(url => ({ url })); },
    };
  };
  const caches = {
    open: async name => cacheOf(name),
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    match: async req => { for (const m of stores.values()) { const r = m.get(keyOf(req) .startsWith('http') ? keyOf(req) : ORIGIN + keyOf(req)); if (r) return mkResponse(r); } },
  };
  async function fetchMock(req) {
    const url = keyOf(req);
    net.hits.push(url);
    if (!net.online) throw new TypeError('offline');
    const route = net.routes[url.replace(ORIGIN, '')];
    return route === undefined ? new Response('ok:' + url, { status: 200 }) : new Response(route.body, { status: route.status ?? 200 });
  }
  const state = { skipped: false, claimed: false };
  const self = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting: async () => { state.skipped = true; },
    clients: { claim: async () => { state.claimed = true; } },
  };
  vm.runInNewContext(code, { self, caches, fetch: fetchMock, Response, URL, location: { origin: ORIGIN }, Promise, console });
  return { handlers, stores, net, state };
}

async function fire(env, type, ev = {}) {
  const waits = [];
  let responded;
  const event = { ...ev, waitUntil: p => waits.push(p), respondWith: p => { responded = Promise.resolve(p); } };
  env.handlers[type](event);
  await Promise.all(waits);
  return { intercepted: responded !== undefined, response: responded && (await responded) };
}

const req = (p, extra = {}) => ({ url: ORIGIN + p, method: 'GET', mode: 'cors', ...extra });

test('instalacao: guarda a casca inteira e assume o controle', async () => {
  const env = makeEnv();
  await fire(env, 'install');
  const shell = env.stores.get('aot-shell-v1');
  assert.ok(shell.has(ORIGIN + '/index.html') && shell.has(ORIGIN + '/app.js') && shell.has(ORIGIN + '/fonts/fonts.css'));
  assert.ok(shell.size >= 15);
  assert.equal(env.state.skipped, true);
});

test('instalacao tolera um arquivo ausente (nao derruba tudo)', async () => {
  const env = makeEnv();
  env.net.routes['/ui/card.js'] = { status: 404, body: 'x' };
  await fire(env, 'install');
  const shell = env.stores.get('aot-shell-v1');
  assert.ok(shell.has(ORIGIN + '/index.html'));
  assert.ok(!shell.has(ORIGIN + '/ui/card.js'));
});

test('ativacao: apaga cache de versao velha e mantem os sprites', async () => {
  const env = makeEnv();
  env.stores.set('aot-shell-v0', new Map());
  env.stores.set('aot-sprites', new Map([[ORIGIN + '/assets/a.png', { status: 200, body: 'png' }]]));
  await fire(env, 'activate');
  assert.ok(!env.stores.has('aot-shell-v0'));
  assert.ok(env.stores.has('aot-sprites'));
  assert.equal(env.state.claimed, true);
});

test('a API ao vivo e o stream NUNCA sao interceptados nem guardados', async () => {
  const env = makeEnv();
  for (const p of ['/api/state', '/api/stream', '/api/health']) {
    const r = await fire(env, 'fetch', { request: req(p) });
    assert.equal(r.intercepted, false, p);
  }
  assert.equal([...env.stores.keys()].length, 0);
});

test('so intercepta GET da mesma origem', async () => {
  const env = makeEnv();
  assert.equal((await fire(env, 'fetch', { request: req('/app.js', { method: 'POST' }) })).intercepted, false);
  assert.equal((await fire(env, 'fetch', { request: { url: 'https://outro.site/x.js', method: 'GET', mode: 'cors' } })).intercepted, false);
});

test('sprites: cache primeiro, e funcionam offline depois de vistos uma vez', async () => {
  const env = makeEnv();
  env.net.routes['/assets/tiny-swords/a.png'] = { body: 'PNG1' };
  const first = await fire(env, 'fetch', { request: req('/assets/tiny-swords/a.png') });
  assert.equal(await first.response.text(), 'PNG1');
  env.net.online = false;
  env.net.hits.length = 0;
  const second = await fire(env, 'fetch', { request: req('/assets/tiny-swords/a.png') });
  assert.equal(await second.response.text(), 'PNG1');
  assert.equal(env.net.hits.length, 0, 'nao devia nem tentar a rede');
});

test('/api/content: rede primeiro, cai para o cache sem rede', async () => {
  const env = makeEnv();
  env.net.routes['/api/content'] = { body: '{"eras":4}' };
  assert.equal(await (await fire(env, 'fetch', { request: req('/api/content') })).response.text(), '{"eras":4}');
  env.net.online = false;
  assert.equal(await (await fire(env, 'fetch', { request: req('/api/content') })).response.text(), '{"eras":4}');
});

test('abrir o app sem rede: a navegacao cai para o index.html guardado', async () => {
  const env = makeEnv();
  env.net.routes['/index.html'] = { body: '<html>casca</html>' };
  await fire(env, 'install');
  env.net.online = false;
  const r = await fire(env, 'fetch', { request: req('/', { mode: 'navigate' }) });
  assert.equal(r.intercepted, true);
  assert.match(await r.response.text(), /casca|ok:/);
});

test('arquivos da casca: serve o guardado e atualiza em segundo plano', async () => {
  const env = makeEnv();
  env.net.routes['/style.css'] = { body: 'v1' };
  await fire(env, 'install');
  env.net.routes['/style.css'] = { body: 'v2' };
  const r = await fire(env, 'fetch', { request: req('/style.css') });
  assert.equal(await r.response.text(), 'v1', 'serve o guardado na hora');
  await new Promise(res => setTimeout(res, 20));   // deixa a atualizacao terminar
  assert.equal((await env.stores.get('aot-shell-v1').get(ORIGIN + '/style.css')).body, 'v2');
});
