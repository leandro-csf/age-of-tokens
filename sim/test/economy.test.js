import test from 'node:test';
import assert from 'node:assert/strict';
import { newState, applyEvent, income, levelFromIncome, levelThreshold } from '../src/index.js';

const tokens = (o = {}) => ({ type: 'tokens', model: 'claude-sonnet-5-5', input: 0, output: 0, cacheRead: 0, cacheCreation: 0, thinking: 0, ...o });

test('limiares de nivel: L(10)~46,6k, L(20)~433k, L(30)~4,0M', () => {
  assert.equal(Math.round(levelThreshold(10)), 46566);
  assert.equal(Math.round(levelThreshold(20)) / 1000 | 0, 433);
  assert.ok(Math.abs(levelThreshold(30) - 4.04e6) < 2e4);
});

test('levelFromIncome respeita as bordas', () => {
  assert.equal(levelFromIncome(0), 0);
  assert.equal(levelFromIncome(4999), 0);
  assert.equal(levelFromIncome(levelThreshold(10)), 10);
  assert.equal(levelFromIncome(levelThreshold(10) - 1), 9);
  assert.equal(levelFromIncome(levelThreshold(30)), 30);
});

test('pesos: output->comida, cache read->madeira, input+cache creation->pedra, thinking->ouro', () => {
  const s = applyEvent(newState(), tokens({ output: 1000, cacheRead: 40000, input: 1000, cacheCreation: 3000, thinking: 100 }));
  assert.equal(s.res.food, 10);
  assert.equal(s.res.wood, 2);
  assert.equal(s.res.stone, 2);
  assert.equal(s.res.gold, 2);
  assert.equal(s.raw.output, 1000);
  assert.equal(s.raw.cacheRead, 40000);
});

test('multiplicador de modelo: opus 1,5x, haiku 0,5x, desconhecido 1x', () => {
  const food = model => applyEvent(newState(), tokens({ model, output: 10000 })).res.food;
  assert.equal(food('claude-opus-5-5'), 150);
  assert.equal(food('claude-haiku-5-5'), 50);
  assert.equal(food('claude-sonnet-5'), 100);
  assert.equal(food(null), 100);
});

test('tech da +5% so do seu recurso e so no que vem depois', () => {
  let s = applyEvent(newState(), tokens({ output: 10000 }));
  s.techs.push('arado'); // +5% comida
  s = applyEvent(s, tokens({ output: 10000, cacheRead: 20000 }));
  assert.equal(s.res.food, 100 + 105);
  assert.equal(s.res.wood, 1);
});

test('renda vitalicia nunca diminui ao gastar o estoque', () => {
  let s = applyEvent(newState(), tokens({ output: 100000 }));
  const before = income(s);
  s.res.food = 0; // gasto
  assert.equal(income(s), before);
});

test('o estado de entrada nunca e alterado (pureza)', () => {
  const s0 = newState();
  const frozen = JSON.stringify(s0);
  applyEvent(s0, tokens({ output: 5000 }));
  applyEvent(s0, { type: 'tool' });
  assert.equal(JSON.stringify(s0), frozen);
});

test('tool soma pontos de obra; evento desconhecido e ignorado', () => {
  let s = applyEvent(newState(), { type: 'tool' });
  s = applyEvent(s, { type: 'tool', count: 9 });
  s = applyEvent(s, { type: 'qualquer-coisa' });
  assert.equal(s.work, 10);
});

test('sessao nova traz imigrante so se houver vaga; subagente traz saque', () => {
  let s = applyEvent(newState(), { type: 'session:new' });
  assert.equal(s.units.aldeao, 4);
  s.units.aldeao = 15; // no teto (cap 15)
  s = applyEvent(s, { type: 'session:new' });
  assert.equal(s.units.aldeao, 15);
  assert.equal(s.sessions, 2);
  s = applyEvent(newState(), { type: 'subagent:new' });
  assert.equal(s.res.food, 10);
  assert.equal(s.res.wood, 10);
  assert.equal(s.subagents, 1);
});
