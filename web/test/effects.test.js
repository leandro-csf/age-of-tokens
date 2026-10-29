import test from 'node:test';
import assert from 'node:assert/strict';
import { createSheep, stepSheep, burst, sparkle, stepParticles, fireflyField, SHEEP_RX, SHEEP_RY, SHEEP_SPEED } from '../world/effects.js';
import { LAND } from '../world/stages.js';

// gerador pseudo-aleatorio fixo: os testes nao dependem de sorte
const seeded = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

test('ovelhas: ficam sempre perto da origem, por muito tempo', () => {
  const rng = seeded(7);
  const flock = createSheep([{ x: 800, y: 620 }, { x: 860, y: 625 }], rng);
  for (let i = 0; i < 20_000; i++) {      // ~5,5 min de jogo a 60 quadros por segundo
    for (const s of flock) {
      stepSheep(s, 1 / 60, rng);
      assert.ok(Math.abs(s.x - s.hx) <= SHEEP_RX + 0.5 && Math.abs(s.y - s.hy) <= SHEEP_RY + 0.5, `ovelha fugiu: ${s.x},${s.y}`);
    }
  }
});

test('ovelhas: alternam entre pastar e andar, e andam na velocidade certa', () => {
  const rng = seeded(3);
  const [s] = createSheep([{ x: 500, y: 500 }], rng);
  const estados = new Set(); let andou = 0, prev = { x: s.x, y: s.y };
  for (let i = 0; i < 6000; i++) {
    stepSheep(s, 1 / 60, rng);
    estados.add(s.state);
    if (s.state === 'walk') { andou += Math.hypot(s.x - prev.x, s.y - prev.y); }
    prev = { x: s.x, y: s.y };
  }
  assert.deepEqual([...estados].sort(), ['graze', 'walk']);
  assert.ok(andou > 20, 'andou de fato');
  // nunca anda mais depressa que SHEEP_SPEED por quadro
  const t = createSheep([{ x: 0, y: 0 }], seeded(1))[0]; t.state = 'walk'; t.tx = 1000; t.ty = 0;
  stepSheep(t, 1, seeded(1));
  assert.ok(Math.abs(t.x - SHEEP_SPEED) < 1e-9);
});

test('ovelhas: viram o rosto para onde andam', () => {
  const s = createSheep([{ x: 100, y: 100 }], seeded(1))[0];
  s.state = 'walk'; s.tx = 50; s.ty = 100;
  stepSheep(s, 0.1, seeded(1));
  assert.equal(s.dir, -1);
  s.tx = 400;
  stepSheep(s, 0.1, seeded(1));
  assert.equal(s.dir, 1);
});

test('explosao: n particulas saindo do centro, em todas as direcoes, e somem sozinhas', () => {
  const list = burst(100, 672, 420, seeded(5));
  assert.equal(list.length, 100);
  assert.ok(list.every(p => p.x === 672 && p.y === 420 && p.life > 1 && p.age === 0));
  assert.ok(list.some(p => p.vx > 100) && list.some(p => p.vx < -100) && list.some(p => p.vy > 50) && list.some(p => p.vy < -50), 'todas as direcoes');
  assert.ok(list.some(p => p.gold) && list.some(p => !p.gold));
  for (let i = 0; i < 200; i++) stepParticles(list, 0.05);   // 10 s
  assert.equal(list.length, 0);
});

test('faiscas: nascem perto do ponto e sobem', () => {
  const p = sparkle(672, 300, seeded(9));
  assert.ok(Math.abs(p.x - 672) <= 115 && Math.abs(p.y - 300) <= 35);
  assert.ok(p.vy < 0);
  const y0 = p.y; stepParticles([p], 0.5);
  assert.ok(p.y < y0, 'sobe');
});

test('stepParticles remove so as que acabaram', () => {
  const list = [{ x: 0, y: 0, vx: 0, vy: 0, life: 1, age: 0 }, { x: 0, y: 0, vx: 0, vy: 0, life: 5, age: 0 }];
  stepParticles(list, 2);
  assert.equal(list.length, 1);
  assert.equal(list[0].life, 5);
});

test('vaga-lumes: deterministicos e sempre dentro da ilha', () => {
  const f = fireflyField(22);
  assert.equal(f.length, 22);
  assert.deepEqual(fireflyField(22), f);
  for (const p of f) assert.ok(p.x > LAND.x0 && p.x < LAND.x1 && p.y > LAND.y0 && p.y < LAND.y1);
  assert.ok(new Set(f.map(p => `${p.x},${p.y}`)).size > 18, 'espalhados, nao empilhados');
});
