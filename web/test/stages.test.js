import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVEL_MIN, STAGE_NAMES, LAST_STAGE, stageFor, ELEMENTS, elementsAt, rectOf, footOf, CROWD, crowdCaps,
  treeField, grassTile, LAND, ISLAND, TILE, depositAt, STAGE_W, STAGE_H,
} from '../world/stages.js';
import { createNav } from '../world/nav.js';

test('11 estagios com nome, e os limiares de era batem com as regras (10, 20, 30)', () => {
  assert.equal(LEVEL_MIN.length, 11);
  assert.equal(STAGE_NAMES.length, 11);
  assert.equal(stageFor(0), 0);
  assert.equal(stageFor(2), 0);
  assert.equal(stageFor(3), 1);
  assert.equal(stageFor(10), 3);   // Feudal
  assert.equal(stageFor(20), 6);   // Castelos
  assert.equal(stageFor(30), 9);   // Imperial
  assert.equal(stageFor(40), LAST_STAGE);
  assert.equal(stageFor(999), LAST_STAGE);
  assert.deepEqual([...LEVEL_MIN].sort((a, b) => a - b), LEVEL_MIN);
});

test('o estagio nunca regride quando o nivel sobe', () => {
  let prev = 0;
  for (let l = 0; l <= 50; l++) { const s = stageFor(l); assert.ok(s >= prev); prev = s; }
});

test('ids unicos e cada elemento aparece uma vez (sem lacuna entre from e until)', () => {
  const ids = ELEMENTS.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const e of ELEMENTS) {
    assert.ok(e.from >= 0 && e.from <= LAST_STAGE);
    if (e.until !== undefined) assert.ok(e.until > e.from && e.until <= LAST_STAGE + 1);
  }
});

test('cada estagio acrescenta algo visivel (nenhum estagio repetido)', () => {
  for (let s = 1; s <= LAST_STAGE; s++) {
    const before = elementsAt(s - 1).map(e => e.id).join(), now = elementsAt(s).map(e => e.id).join();
    assert.notEqual(before, now, `estagio ${s} igual ao anterior`);
  }
});

test('poucos elementos por estagio (a tela nao enche)', () => {
  for (let s = 0; s <= LAST_STAGE; s++) assert.ok(elementsAt(s).length <= 14, `estagio ${s}: ${elementsAt(s).length}`);
});

test('em nenhum estagio os elementos se sobrepoem, e todos ficam em terra firme', () => {
  for (let s = 0; s <= LAST_STAGE; s++) {
    const els = elementsAt(s).filter(e => footOf(e));
    els.forEach((a, i) => {
      const r = rectOf(a);
      assert.ok(r.x0 >= LAND.x0 && r.x1 <= LAND.x1 && r.y0 >= LAND.y0 - 4 && r.y1 <= LAND.y1, `${a.id} fora da ilha no estagio ${s}`);
      for (const b of els.slice(i + 1)) {
        const q = rectOf(b);
        const gap = Math.max(q.x0 - r.x1, r.x0 - q.x1, q.y0 - r.y1, r.y0 - q.y1);
        assert.ok(gap >= 24, `${a.id} e ${b.id} colados (${Math.round(gap)} px) no estagio ${s}`);
      }
    });
  }
});

test('multidao so cresce e nunca passa dos limites', () => {
  for (const arr of Object.values(CROWD)) {
    assert.equal(arr.length, 11);
    for (let i = 1; i < arr.length; i++) assert.ok(arr[i] >= arr[i - 1]);
  }
  assert.equal(crowdCaps(10).pawn, 14);
  assert.equal(crowdCaps(0).warrior, 0);
});

test('arvores na borda da ilha, deterministicas', () => {
  const t = treeField();
  assert.ok(t.length >= 15 && t.length <= 70, 'quantidade ' + t.length);   // rala de proposito
  assert.deepEqual(treeField(), t);
  for (const a of t) assert.ok(a.x > LAND.x0 && a.x < LAND.x1 && a.y > LAND.y0 && a.y < LAND.y1 + TILE);
});

test('autotile da grama', () => {
  assert.deepEqual(grassTile(ISLAND.x0, ISLAND.y0), [0, 0]);
  assert.deepEqual(grassTile(ISLAND.x1, ISLAND.y1), [2, 2]);
  assert.deepEqual(grassTile(8, 6), [1, 1]);
  assert.equal(grassTile(ISLAND.x0 - 1, 6), null);
});

test('a ilha cabe no palco 1340x800', () => {
  assert.ok(LAND.x1 < STAGE_W && LAND.y1 <= STAGE_H);
});

test('em todo estagio, todo elemento e alcancavel a pe a partir do deposito', () => {
  for (let s = 0; s <= LAST_STAGE; s++) {
    const els = elementsAt(s);
    const nav = createNav({
      width: STAGE_W, height: STAGE_H, rects: els.map(rectOf).filter(Boolean), inflate: 4,
      landRect: { x0: LAND.x0 + 24, y0: LAND.y0 + 24, x1: LAND.x1 - 24, y1: LAND.y1 - 24 },
    });
    const d = depositAt(s);
    assert.ok(nav.free(d.x, d.y) || nav.nearestFree(d.x, d.y), `deposito bloqueado no estagio ${s}`);
    for (const e of els) {
      const p = nav.find(d.x, d.y, e.x, e.y + 30);
      assert.ok(p.length >= 1, `${e.id} inalcancavel no estagio ${s}`);
    }
    // e a borda da floresta
    for (const [x, y] of [[LAND.x0 + 70, 420], [LAND.x1 - 70, 420], [672, LAND.y0 + 70], [672, LAND.y1 - 50]]) {
      assert.ok(nav.find(d.x, d.y, x, y).length >= 1, `borda ${x},${y} inalcancavel no estagio ${s}`);
    }
  }
});
