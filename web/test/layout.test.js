import test from 'node:test';
import assert from 'node:assert/strict';
import { ERAS } from '../../sim/src/index.js';
import {
  layoutAll, visible, island, isStreet, accessCell, blockOrder, expandPlan, TOWN_CENTER, BLOCK,
} from '../village/layout.js';

const plan = ERAS.map(e => e.buildings.map(b => ({ id: b.id, count: b.count })));
const placed = layoutAll(plan);

const cells = b => {
  const out = [];
  for (let x = 0; x < b.n; x++) for (let y = 0; y < b.n; y++) out.push(`${b.gx + x},${b.gy + y}`);
  return out;
};

test('o plano expande para 86 predios (mesmo total do motor)', () => {
  assert.equal(expandPlan(plan).length, 86);
  assert.equal(placed.length, 86);
});

test('nenhum lote se sobrepoe, nem ao centro urbano, e nenhum cai em rua', () => {
  const seen = new Set(cells(TOWN_CENTER));
  for (const b of placed) {
    for (const c of cells(b)) {
      assert.ok(!seen.has(c), `${b.id}#${b.k} sobrepoe em ${c}`);
      seen.add(c);
    }
    for (let x = 0; x < b.n; x++) for (let y = 0; y < b.n; y++) {
      assert.ok(!isStreet(b.gx + x, b.gy + y), `${b.id}#${b.k} em rua`);
    }
  }
});

test('o lote de cada predio nao depende da ordem de construcao', () => {
  const a = visible(placed, { casa: 3, fazenda: 1 }).filter(b => b.id !== 'centro');
  const b = visible(placed, { fazenda: 1, casa: 3 }).filter(b => b.id !== 'centro');
  assert.deepEqual(a.map(x => `${x.id}${x.k}@${x.gx},${x.gy}`).sort(), b.map(x => `${x.id}${x.k}@${x.gx},${x.gy}`).sort());
  // construir mais nao muda onde os anteriores estao
  const more = visible(placed, { casa: 5, fazenda: 1 });
  for (const p of a) assert.ok(more.some(m => m.id === p.id && m.k === p.k && m.gx === p.gx && m.gy === p.gy));
});

test('predios grandes ocupam um quarteirao inteiro sozinhos', () => {
  for (const b of placed.filter(b => b.n === 2)) {
    const same = placed.filter(o => o !== b && o.bx === b.bx && o.by === b.by);
    assert.equal(same.length, 0, `${b.id} divide quarteirao`);
  }
});

test('quarteiroes: 4 lotes pequenos cada, em aneis a partir do centro', () => {
  const blocks = blockOrder(24);
  assert.equal(new Set(blocks.map(b => b.join())).size, 24);
  assert.ok(!blocks.some(([x, y]) => x === 0 && y === 0));
  assert.equal(blocks.slice(0, 8).every(([x, y]) => Math.max(Math.abs(x), Math.abs(y)) === 1), true);
});

test('ilha so cresce e cobre todos os predios visiveis', () => {
  let prev = island(visible(placed, {}));
  assert.equal(BLOCK * 0 - 2, prev.x0);
  for (const n of [1, 5, 10, 25, 50, 86]) {
    // constroi n predios na ordem do plano
    const built = {};
    placed.slice(0, n).forEach(b => (built[b.id] = (built[b.id] || 0) + 1));
    const vis = visible(placed, built);
    const isl = island(vis);
    assert.ok(isl.x0 <= prev.x0 && isl.x1 >= prev.x1 && isl.y0 <= prev.y0 && isl.y1 >= prev.y1);
    for (const b of vis) assert.ok(b.gx >= isl.x0 && b.gx + b.n - 1 <= isl.x1 && b.gy >= isl.y0 && b.gy + b.n - 1 <= isl.y1);
    prev = isl;
  }
});

test('todo predio tem uma rua de acesso encostada nele', () => {
  for (const b of [TOWN_CENTER, ...placed]) {
    const [x, y] = accessCell(b);
    assert.ok(isStreet(x, y), `${b.id}#${b.k}`);
    const touches = x >= b.gx - 1 && x <= b.gx + b.n && y >= b.gy - 1 && y <= b.gy + b.n;
    assert.ok(touches, `${b.id}#${b.k} acesso longe`);
  }
});
