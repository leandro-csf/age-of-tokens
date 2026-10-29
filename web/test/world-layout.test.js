import test from 'node:test';
import assert from 'node:assert/strict';
import { ERAS } from '../../sim/src/index.js';
import {
  layoutAll, visible, extent, expandPlan, treeField, grassTile, TOWN, FOOT, TILE, ISLAND, MINE_SITES, WALL, CENTER,
} from '../world/layout.js';

const plan = ERAS.map(e => e.buildings.map(b => ({ id: b.id, count: b.count })));
const placed = layoutAll(plan);
const rect = b => { const [w, h] = FOOT[b.id]; return { x0: b.x - w / 2, x1: b.x + w / 2, y0: b.y - h, y1: b.y }; };
const town = placed.filter(b => FOOT[b.id]);

test('86 predios do plano mais o centro urbano', () => {
  assert.equal(expandPlan(plan).length, 86);
  assert.equal(placed.length, 87);
  assert.equal(placed[0].id, 'centro');
});

test('predios da vila nao se sobrepoem e ficam dentro da zona da vila', () => {
  for (let i = 0; i < town.length; i++) {
    const a = rect(town[i]);
    assert.ok(a.x0 >= TOWN.x0 && a.x1 <= TOWN.x1 && a.y0 >= TOWN.y0 && a.y1 <= TOWN.y1 || town[i].id === 'centro', `${town[i].id}#${town[i].k} fora da zona`);
    for (let j = i + 1; j < town.length; j++) {
      const b = rect(town[j]);
      const hit = a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
      assert.ok(!hit, `${town[i].id}#${town[i].k} sobrepoe ${town[j].id}#${town[j].k}`);
    }
  }
});

test('deixa corredor de pelo menos 40 px entre predios (os aldeoes passam)', () => {
  for (let i = 0; i < town.length; i++) {
    for (let j = i + 1; j < town.length; j++) {
      const a = rect(town[i]), b = rect(town[j]);
      const gapX = Math.max(b.x0 - a.x1, a.x0 - b.x1), gapY = Math.max(b.y0 - a.y1, a.y0 - b.y1);
      assert.ok(Math.max(gapX, gapY) >= 40, `${town[i].id}#${town[i].k} e ${town[j].id}#${town[j].k} colados`);
    }
  }
});

test('a posicao de cada predio nao depende da ordem em que foi construido', () => {
  const a = visible(placed, { casa: 3, fazenda: 1 });
  const more = visible(placed, { casa: 5, fazenda: 1 });
  for (const p of a) assert.ok(more.some(m => m.id === p.id && m.k === p.k && m.x === p.x && m.y === p.y));
});

test('layout e deterministico', () => {
  assert.deepEqual(layoutAll(plan), placed);
});

test('os primeiros predios ficam perto do centro; os ultimos mais longe', () => {
  const dist = b => Math.hypot(b.x - CENTER.x, (b.y - CENTER.y) * 1.7);
  const casas = placed.filter(b => b.id === 'casa');
  assert.ok(dist(casas[0]) < dist(casas[casas.length - 1]));
});

test('muralha e torres ficam no anel; minas nas jazidas', () => {
  for (const m of placed.filter(b => b.id === 'muralha')) {
    const onEdge = Math.abs(m.x - WALL.x0) < 1 || Math.abs(m.x - WALL.x1) < 1 || Math.abs(m.y - WALL.y0) < 1 || Math.abs(m.y - WALL.y1) < 1;
    assert.ok(onEdge, 'muralha fora do anel');
  }
  assert.equal(placed.filter(b => b.id === 'torre').length, 4);
  const minas = placed.filter(b => b.id === 'mina');
  assert.equal(minas.length, 3);
  minas.forEach((m, i) => assert.deepEqual([m.x, m.y], [MINE_SITES[i].x, MINE_SITES[i].y]));
});

test('as primeiras pecas da muralha se espalham pelo anel', () => {
  const [w1, w2, w3, w4] = placed.filter(b => b.id === 'muralha');
  const spread = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  assert.ok(spread(w1, w2) > 400 && spread(w2, w3) > 400 && spread(w1, w4) > 200);
});

test('todos os predios estao sobre a ilha', () => {
  for (const b of placed) {
    assert.ok(b.x > ISLAND.x0 * TILE && b.x < (ISLAND.x1 + 1) * TILE, b.id + ' x');
    assert.ok(b.y > ISLAND.y0 * TILE && b.y < (ISLAND.y1 + 1) * TILE, b.id + ' y');
  }
});

test('arvores ficam na beira da ilha, fora da vila, e sao deterministicas', () => {
  const t = treeField();
  assert.ok(t.length > 120 && t.length < 500, 'quantidade ' + t.length);
  for (const a of t) {
    assert.ok(a.x > ISLAND.x0 * TILE && a.x < (ISLAND.x1 + 1) * TILE);
    assert.ok(a.x < TOWN.x0 || a.x > TOWN.x1 || a.y < TOWN.y0 || a.y > TOWN.y1, 'arvore dentro da vila');
  }
  assert.deepEqual(treeField(), t);
});

test('extent cobre todos os predios visiveis', () => {
  const vis = visible(placed, { casa: 10, fazenda: 3 });
  const e = extent(vis);
  for (const b of vis) assert.ok(b.x >= e.x0 && b.x <= e.x1 && b.y <= e.y1 && b.y >= e.y0);
});

test('autotile da grama: cantos, bordas e centro', () => {
  assert.deepEqual(grassTile(ISLAND.x0, ISLAND.y0), [0, 0]);
  assert.deepEqual(grassTile(ISLAND.x1, ISLAND.y0), [2, 0]);
  assert.deepEqual(grassTile(ISLAND.x0, ISLAND.y1), [0, 2]);
  assert.deepEqual(grassTile(ISLAND.x1, ISLAND.y1), [2, 2]);
  assert.deepEqual(grassTile(10, ISLAND.y0), [1, 0]);
  assert.deepEqual(grassTile(ISLAND.x0, 10), [0, 1]);
  assert.deepEqual(grassTile(10, 10), [1, 1]);
  assert.equal(grassTile(ISLAND.x0 - 1, 10), null);
});
