import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newState, step, applyEvent, canPrestige, prestige, level, income, lifetimeIncome, prestigeMult, summary,
  levelThreshold, PRESTIGE_LEVEL, PRESTIGE_BONUS, START_VILLAGERS,
} from '../src/index.js';

const tokens = (o = {}) => ({ type: 'tokens', model: 'claude-sonnet-5', input: 0, output: 0, cacheRead: 0, cacheCreation: 0, thinking: 0, ...o });
const withIncome = (s, R) => ({ ...s, earned: { food: R, wood: 0, stone: 0, gold: 0 } });

/** Uma aldeia que cumpriu tudo: Maravilha erguida e nivel 40. */
function legendary(extra = {}) {
  const s = withIncome(newState(), levelThreshold(PRESTIGE_LEVEL) * 1.01);
  return { ...s, wonder: true, era: 3, built: { casa: 38, maravilha: 1, castelo: 1 }, techs: ['arado', 'machado'], res: { food: 500, wood: 400, stone: 300, gold: 200 }, work: 99, units: { aldeao: 60, espadachim: 15 }, ...extra };
}

test('canPrestige exige a Maravilha E o nivel 40 (so um dos dois nao basta)', () => {
  assert.equal(canPrestige(newState()), false);
  assert.equal(canPrestige({ ...newState(), wonder: true }), false, 'Maravilha sem nivel');
  assert.equal(canPrestige(withIncome(newState(), levelThreshold(40) * 2)), false, 'nivel sem Maravilha');
  assert.equal(canPrestige(withIncome({ ...newState(), wonder: true }, levelThreshold(40) - 1)), false, 'nivel 39');
  assert.equal(canPrestige(legendary()), true);
});

test('prestigio: zera a aldeia (recursos, predios, unidades, pesquisas, era, obra, nivel)', () => {
  const p = prestige(legendary());
  assert.equal(p.era, 0);
  assert.deepEqual(p.res, { food: 0, wood: 0, stone: 0, gold: 0 });
  assert.deepEqual(p.earned, { food: 0, wood: 0, stone: 0, gold: 0 });
  assert.deepEqual(p.built, {});
  assert.deepEqual(p.units, { aldeao: START_VILLAGERS });
  assert.deepEqual(p.techs, []);
  assert.equal(p.work, 0);
  assert.equal(p.wonder, false);
  assert.equal(level(p), 0);
});

test('prestigio: guarda tokens crus, sessoes, subagentes e conta o prestigio', () => {
  const antes = legendary({ raw: { input: 1, output: 2e7, cacheRead: 3e9, cacheCreation: 4, thinking: 5 }, sessions: 40, subagents: 90 });
  const p = prestige(antes);
  assert.deepEqual(p.raw, antes.raw);
  assert.equal(p.sessions, 40);
  assert.equal(p.subagents, 90);
  assert.equal(p.prestige, 1);
  assert.equal(prestige(p).prestige, 2);
});

test('a renda vitalicia nao cai nem pula no prestigio: continua somando', () => {
  const antes = legendary();
  const p = prestige(antes);
  assert.equal(lifetimeIncome(p), lifetimeIncome(antes));
  assert.equal(p.legacy, income(antes));
  const depois = applyEvent(p, tokens({ output: 10000 }));
  assert.ok(lifetimeIncome(depois) > lifetimeIncome(antes));
  // e acumula entre varios prestigios
  const dois = prestige(withIncome({ ...depois, wonder: true }, levelThreshold(40) * 1.1));
  assert.ok(lifetimeIncome(dois) >= lifetimeIncome(depois));
});

test('o nivel e da aldeia ATUAL: o nivel vitalicio alto nao libera eras da nova aldeia', () => {
  let s = prestige(legendary());
  s = { ...s, res: { food: 1e9, wood: 1e9, stone: 1e9, gold: 1e9 }, work: 1e6, units: { aldeao: 60 }, built: { casa: 10, fazenda: 3, serraria: 1, mina: 1 }, techs: ['arado', 'machado', 'picareta', 'prospeccao'] };
  assert.equal(level(s), 0);
  assert.ok(lifetimeIncome(s) > levelThreshold(30), 'a renda vitalicia e alta');
  for (let i = 0; i < 50; i++) { const r = step(s); s = r.state; assert.notEqual(r.action.type, 'advance', 'nao pode avancar de era sem o nivel desta aldeia'); }
  assert.equal(s.era, 0);
});

test('bonus: +10% de producao por prestigio, em tokens e no saque de explorador', () => {
  const out = n => { let s = newState(); s.prestige = n; return applyEvent(s, tokens({ output: 100_000 })).earned.food; };
  assert.equal(out(0), 1000);
  assert.ok(Math.abs(out(1) - 1100) < 1e-9);
  assert.ok(Math.abs(out(3) - 1300) < 1e-9);
  assert.equal(prestigeMult({ prestige: 2 }), 1 + 2 * PRESTIGE_BONUS);
  const loot = n => { let s = newState(); s.prestige = n; return applyEvent(s, { type: 'subagent:new' }).res.food; };
  assert.ok(Math.abs(loot(2) - loot(0) * 1.2) < 1e-9);
});

test('a aldeia seguinte e mais rapida: os mesmos niveis custam menos tokens', () => {
  const tokensToLevel = (prest, lvl) => {
    let s = newState(); s.prestige = prest; let n = 0;
    while (level(s) < lvl) { s = applyEvent(s, tokens({ output: 50_000, cacheRead: 1e8 })); n++; }
    return n;
  };
  const a = tokensToLevel(0, 20), b = tokensToLevel(1, 20), c = tokensToLevel(3, 20);
  assert.ok(b < a && c < b, `${a} > ${b} > ${c}`);
  assert.ok(Math.abs(b / a - 1 / 1.1) < 0.02, 'cerca de 1/1,1');
  assert.ok(Math.abs(c / a - 1 / 1.3) < 0.02, 'cerca de 1/1,3');
});

test('step: a aldeia lendaria vira lenda ANTES de qualquer outra acao', () => {
  const r = step(legendary({ res: { food: 1e9, wood: 1e9, stone: 1e9, gold: 1e9 } }));
  assert.deepEqual(r.action, { type: 'prestige', id: 1 });
  assert.equal(r.state.prestige, 1);
  assert.equal(r.state.era, 0);
  assert.equal(step(r.state).state.prestige, 1, 'nao vira lenda de novo logo em seguida');
});

test('o prestigio e puro: nao altera o estado de entrada', () => {
  const s = legendary();
  const frozen = JSON.stringify(s);
  prestige(s);
  step(s);
  assert.equal(JSON.stringify(s), frozen);
});

test('summary expoe prestigio, renda vitalicia e bonus para a tela', () => {
  const s = prestige(legendary());
  const m = summary(applyEvent(s, tokens({ output: 1000 })));
  assert.equal(m.prestige, 1);
  assert.ok(m.lifetimeIncome > m.income);
  assert.ok(Math.abs(m.prestigeBonus - 0.1) < 1e-9);
  assert.equal(m.level, 0);
});
