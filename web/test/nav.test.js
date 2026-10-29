import test from 'node:test';
import assert from 'node:assert/strict';
import { createNav, CELL } from '../world/nav.js';
import { ERAS } from '../../sim/src/index.js';
import { layoutAll, visible, FOOT, TILE, WORLD_W, WORLD_H, ISLAND, CENTER } from '../world/layout.js';

const rectOf = b => { const [w, h] = FOOT[b.id]; return { x0: b.x - w / 2, x1: b.x + w / 2, y0: b.y - h, y1: b.y }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('caminho contorna um predio no meio', () => {
  const nav = createNav({ width: 640, height: 640, rects: [{ x0: 200, y0: 100, x1: 440, y1: 540 }], inflate: 0 });
  const p = nav.find(60, 320, 580, 320);
  assert.ok(p.length >= 2, 'tem que desviar');
  // nenhum ponto cai dentro do obstaculo
  for (const pt of p) assert.ok(!(pt.x > 200 && pt.x < 440 && pt.y > 100 && pt.y < 540), 'ponto dentro do predio');
});

test('sem obstaculo o caminho e uma reta (suavizado)', () => {
  const nav = createNav({ width: 640, height: 640 });
  const p = nav.find(40, 40, 600, 500);
  assert.equal(p.length, 1);
});

test('destino bloqueado leva a celula livre mais proxima', () => {
  const nav = createNav({ width: 640, height: 640, rects: [{ x0: 200, y0: 200, x1: 300, y1: 300 }], inflate: 0 });
  const p = nav.find(40, 40, 250, 250);
  assert.ok(p.length >= 1);
  const last = p[p.length - 1];
  assert.ok(nav.free(last.x, last.y));
});

test('ilha fechada por muro nao tem caminho', () => {
  const nav = createNav({ width: 640, height: 640, rects: [{ x0: 300, y0: 0, x1: 340, y1: 640 }], inflate: 0 });
  assert.deepEqual(nav.find(40, 320, 600, 320), []);
});

test('fora da terra firme e bloqueado', () => {
  const nav = createNav({ width: 640, height: 640, landRect: { x0: 100, y0: 100, x1: 500, y1: 500 } });
  assert.equal(nav.free(50, 50), false);
  assert.equal(nav.free(300, 300), true);
});

test('na aldeia completa, do castelo a cada predio, a cada arvore da borda e a cada mina existe caminho', () => {
  const plan = ERAS.map(e => e.buildings.map(b => ({ id: b.id, count: b.count })));
  const vis = visible(layoutAll(plan), Object.fromEntries(ERAS.flatMap(e => e.buildings).map(b => [b.id, 999])));
  const rects = vis.filter(b => FOOT[b.id]).map(rectOf);
  const nav = createNav({
    width: WORLD_W * TILE, height: WORLD_H * TILE, rects, inflate: 4,
    landRect: { x0: ISLAND.x0 * TILE + 24, y0: ISLAND.y0 * TILE + 24, x1: (ISLAND.x1 + 1) * TILE - 24, y1: (ISLAND.y1 + 1) * TILE - 24 },
  });
  const from = { x: CENTER.x, y: CENTER.y + 120 };
  let unreachable = 0;
  for (const b of vis) {
    if (b.id === 'muralha') continue;
    const p = nav.find(from.x, from.y, b.x, b.y + 30);
    if (!p.length) unreachable++;
  }
  assert.equal(unreachable, 0, `${unreachable} predios sem caminho a partir do castelo`);
  // pontos da borda da ilha (onde ficam as arvores)
  for (const [x, y] of [[ISLAND.x0 * TILE + 60, 600], [(ISLAND.x1 + 1) * TILE - 60, 700], [1400, ISLAND.y0 * TILE + 60], [1300, (ISLAND.y1 + 1) * TILE - 60]]) {
    assert.ok(nav.find(from.x, from.y, x, y).length >= 1, `sem caminho para ${x},${y}`);
  }
});

test('o caminho tem comprimento razoavel (sem voltas absurdas)', () => {
  const nav = createNav({ width: 1280, height: 640, rects: [{ x0: 500, y0: 200, x1: 700, y1: 440 }], inflate: 6 });
  const p = nav.find(40, 320, 1240, 320);
  let len = 0, prev = { x: 40, y: 320 };
  for (const pt of p) { len += dist(prev, pt); prev = pt; }
  assert.ok(len < 1200 * 1.5, 'caminho longo demais: ' + Math.round(len));
});
