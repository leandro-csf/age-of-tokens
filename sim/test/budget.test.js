import test from 'node:test';
import assert from 'node:assert/strict';
import { ERAS, eraBudget, RESOURCES, BASE_POP_CAP, HOUSE_POP, START_VILLAGERS } from '../src/index.js';

test('conteudo de cada era custa entre 60% e 80% da renda da era', () => {
  ERAS.forEach((_, e) => {
    const b = eraBudget(e);
    assert.ok(b.ratio >= 0.6 && b.ratio <= 0.8, `era ${e}: ${(b.ratio * 100).toFixed(1)}%`);
  });
});

test('nenhum recurso gasta mais que a renda dele na era', () => {
  ERAS.forEach((_, e) => {
    const b = eraBudget(e);
    for (const r of RESOURCES) assert.ok(b.perResource[r] <= 1, `era ${e} ${r}: ${b.perResource[r].toFixed(2)}`);
  });
});

test('populacao planejada cabe na capacidade planejada em cada era', () => {
  let houses = 0, units = START_VILLAGERS;
  const unitCounts = {};
  ERAS.forEach((era, e) => {
    for (const b of era.buildings) if (b.id === 'casa') houses += b.count;
    for (const u of era.units) unitCounts[u.id] = (unitCounts[u.id] || 0) + u.count;
    // aldeoes iniciais contam dentro do alvo de aldeao, nao somam
    units = Object.values(unitCounts).reduce((n, v) => n + v, 0);
    const cap = BASE_POP_CAP + HOUSE_POP * houses;
    assert.ok(units <= cap, `era ${e}: ${units} unidades > cap ${cap}`);
  });
});

test('requisitos de avanco batem com o conteudo anterior', () => {
  // predios distintos acumulados ate o fim de cada era
  const types = new Set();
  const pops = [];
  let pop = 0;
  ERAS.forEach(era => {
    era.buildings.forEach(b => types.add(b.id));
    pop += era.units.reduce((n, u) => n + u.count, 0);
    if (era.advance) {
      assert.ok(types.size >= era.advance.minTypes, `${era.id}: tipos ${types.size} < ${era.advance.minTypes}`);
      assert.ok(pop >= era.advance.minPop, `${era.id}: pop ${pop} < ${era.advance.minPop}`);
    }
    pops.push(pop);
  });
});

test('ids de predio, unidade e tech sao coerentes', () => {
  const techIds = ERAS.flatMap(e => e.techs.map(t => t.id));
  assert.equal(new Set(techIds).size, techIds.length);
  for (const era of ERAS) {
    for (const t of era.techs) assert.ok(RESOURCES.includes(t.bonus));
    for (const it of [...era.buildings, ...era.units, ...era.techs]) {
      for (const r of Object.keys(it.cost)) assert.ok(RESOURCES.includes(r), `${it.id}: recurso ${r}`);
    }
  }
});
