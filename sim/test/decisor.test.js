import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, step, pop, popCap, level, applyEvent, canPrestige } from '../src/index.js';

function rich(extra = {}) {
  const s = newState();
  s.res = { food: 1e6, wood: 1e6, stone: 1e6, gold: 1e6 };
  s.work = 1e6;
  return Object.assign(s, extra);
}

test('com tudo pago, treina aldeao antes de pesquisar ou construir', () => {
  const { action, state } = step(rich());
  assert.deepEqual(action, { type: 'train', id: 'aldeao' });
  assert.equal(state.units.aldeao, 4);
});

test('populacao no teto -> constroi casa', () => {
  const s = rich();
  s.units.aldeao = popCap(s);
  const { action, state } = step(s);
  assert.deepEqual(action, { type: 'build', id: 'casa' });
  assert.equal(popCap(state), 20);
});

test('sem pontos de obra nao constroi; com eles, sim', () => {
  const s = rich({ work: 0 });
  s.units.aldeao = popCap(s);
  s.techs = ['arado', 'machado', 'picareta', 'prospeccao']; // tira a pesquisa do caminho
  assert.equal(step(s).action.type, 'idle');
  s.work = 10;
  assert.deepEqual(step(s).action, { type: 'build', id: 'casa' });
});

test('gasta recursos e pontos de obra de verdade', () => {
  const s = rich();
  s.units.aldeao = popCap(s);
  const { state } = step(s);
  assert.equal(state.res.wood, 1e6 - 400);
  assert.equal(state.work, 1e6 - 10);
});

test('economiza em vez de pular para algo mais barato', () => {
  const s = newState();
  s.units.aldeao = popCap(s);
  s.techs = ['arado', 'machado', 'picareta', 'prospeccao'];
  s.work = 1000;
  s.res.wood = 300; // casa custa 400; serraria nem entra na conta
  assert.equal(step(s).action.type, 'idle');
});

test('pesquisa a proxima tech quando ha ouro', () => {
  const s = newState();
  s.units.aldeao = popCap(s); // sem treino possivel
  s.res.gold = 500;
  const { action, state } = step(s);
  assert.deepEqual(action, { type: 'research', id: 'arado' });
  assert.deepEqual(state.techs, ['arado']);
});

test('nao avanca de era sem nivel, predios e populacao', () => {
  const s = rich();
  s.units.aldeao = 25; s.built = { casa: 10, fazenda: 3 }; // 13 predios, pop 25 mas nivel 0
  s.techs = ['arado', 'machado', 'picareta', 'prospeccao'];
  s.units.aldeao = 60;
  assert.notEqual(step(s).action.type, 'advance');
});

test('avanca de era quando tudo bate e cobra o custo', () => {
  const s = rich();
  s.earned = { food: 50000, wood: 0, stone: 0, gold: 0 }; // nivel 10
  assert.ok(level(s) >= 10);
  s.units.aldeao = 60;
  s.built = { casa: 10, fazenda: 8, serraria: 4, mina: 3 };
  s.techs = ['arado', 'machado', 'picareta', 'prospeccao'];
  const { action, state } = step(s);
  assert.deepEqual(action, { type: 'advance', id: 'feudal' });
  assert.equal(state.era, 1);
  assert.equal(state.res.food, 1e6 - 6000);
  assert.equal(state.res.gold, 1e6 - 3000);
});

test('determinismo: mesmos eventos, mesmo estado final', () => {
  const run = () => {
    let s = newState();
    for (let i = 0; i < 200; i++) {
      s = applyEvent(s, { type: 'tokens', model: 'opus', output: 20000, cacheRead: 400000, input: 3000, thinking: 900 });
      s = applyEvent(s, { type: 'tool' });
      s = step(s).state;
    }
    return JSON.stringify(s);
  };
  assert.equal(run(), run());
});

test('step nao altera o estado de entrada e conta ticks', () => {
  const s = rich();
  const frozen = JSON.stringify(s);
  const { state } = step(s);
  assert.equal(JSON.stringify(s), frozen);
  assert.equal(state.tick, 1);
});

test('canPrestige so depois da Maravilha', () => {
  assert.equal(canPrestige(newState()), false);
  assert.equal(canPrestige({ ...newState(), wonder: true }), true);
});

test('invariantes: estoque e populacao nunca ficam negativos nem passam do teto', () => {
  let s = newState();
  for (let i = 0; i < 3000; i++) {
    s = applyEvent(s, { type: 'tokens', model: 'sonnet', output: 3000, cacheRead: 60000, input: 500, thinking: 200 });
    if (i % 3 === 0) s = applyEvent(s, { type: 'tool' });
    if (i % 50 === 0) s = applyEvent(s, { type: 'session:new' });
    s = step(s).state;
    for (const v of Object.values(s.res)) assert.ok(v >= 0);
    assert.ok(pop(s) <= popCap(s));
  }
});
