import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, step, applyEvent, levelThreshold, level, ERAS, INCOME_SHARE, TOKENS_PER_UNIT, canPrestige } from '../src/index.js';

/** Evento de tokens que rende exatamente `amount` de renda na proporcao observada (modelo sonnet, sem techs). */
function incomeEvent(amount) {
  return {
    type: 'tokens', model: 'claude-sonnet-5',
    output: amount * INCOME_SHARE.food * TOKENS_PER_UNIT.food,
    cacheRead: amount * INCOME_SHARE.wood * TOKENS_PER_UNIT.wood,
    input: amount * INCOME_SHARE.stone * TOKENS_PER_UNIT.stone,
    thinking: amount * INCOME_SHARE.gold * TOKENS_PER_UNIT.gold,
  };
}

function settle(s, maxSteps = 5000, acts = null) {
  for (let i = 0; i < maxSteps; i++) {
    const r = step(s);
    s = r.state;
    acts?.push(r.action);
    if (r.action.type === 'idle') return s;
  }
  throw new Error('decisor nao assentou');
}

test('jornada completa: da Era das Trevas a Maravilha e a LENDA, com renda no ritmo da curva', () => {
  let s = newState();
  const log = [];
  const acts = [];
  for (let e = 0; e < ERAS.length; e++) {
    const target = levelThreshold(10 * (e + 1)) * 1.02; // passa o nivel da proxima era
    const have = Object.values(s.earned).reduce((n, v) => n + v, 0);
    // entrega a renda em fatias, deixando a aldeia gastar entre elas
    const slices = 40;
    for (let k = 0; k < slices; k++) {
      s = applyEvent(s, incomeEvent((target - have) / slices));
      s = applyEvent(s, { type: 'tool', count: 50 * (e + 1) });
      s = settle(s, 5000, acts);
      if (s.prestige > 0) break;      // virou lenda: a jornada acabou (o resto da renda seria da aldeia nova)
    }
    log.push({ era: e, got: s.era, level: level(s) });
    if (s.prestige > 0) break;
    if (e < ERAS.length - 1) assert.equal(s.era, e + 1, `nao avancou da era ${e}: ${JSON.stringify(log)}`);
  }
  // a Maravilha foi erguida e, ao chegar no nivel 40, a aldeia virou lenda e nasceu outra
  assert.ok(acts.some(a => a.type === 'build' && a.id === 'maravilha'), 'Maravilha nao construida');
  const iLenda = acts.findIndex(a => a.type === 'prestige');
  assert.ok(iLenda > acts.findIndex(a => a.type === 'build' && a.id === 'maravilha'), 'a lenda vem depois da Maravilha');
  assert.equal(s.prestige, 1);
  assert.equal(s.era, 0);
  assert.equal(s.wonder, false);
  assert.ok(level(s) < 10, 'a nova aldeia comeca do nivel 0');
  assert.ok(s.legacy >= levelThreshold(40), 'a renda da primeira aldeia virou legado');
});

test('aldeia sem uso de tool nao constroi nada (so treina e pesquisa)', () => {
  let s = newState();
  s = applyEvent(s, incomeEvent(40000));
  s = settle(s);
  assert.equal(Object.keys(s.built).length, 0);
  assert.ok(s.units.aldeao > 3);
});

test('eventos da mesma fatia em ordem diferente levam ao mesmo resultado', () => {
  const evs = [incomeEvent(9000), { type: 'tool', count: 200 }, incomeEvent(7000), { type: 'tool', count: 30 }];
  const run = order => settle(order.reduce((s, i) => applyEvent(s, evs[i]), newState()));
  assert.equal(JSON.stringify(run([0, 1, 2, 3])), JSON.stringify(run([3, 2, 1, 0])));
});
