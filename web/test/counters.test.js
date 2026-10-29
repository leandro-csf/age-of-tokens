import test from 'node:test';
import assert from 'node:assert/strict';
import { createCounters } from '../ui/counters.js';

function setup() {
  const els = {};
  let t = 1000;
  const counters = createCounters({ find: id => (els[id] ??= { textContent: '–' }), now: () => t });
  return { els, counters, advance: ms => { t += ms; } };
}

test('REGRESSAO: o primeiro valor aparece na tela SEM nenhum quadro de animacao', () => {
  const { els, counters } = setup();
  counters.set('v-food', 8021);
  assert.equal(els['v-food'].textContent, '8.021');   // antes ficava em "0" porque so o rAF desenhava
});

test('REGRESSAO: com o navegador sem quadros, o valor novo chega pela rede de seguranca', () => {
  const { els, counters, advance } = setup();
  counters.set('v-wood', 100);
  counters.set('v-wood', 26_100_000);                 // chega o valor novo; ninguem chamou frame()
  assert.equal(els['v-wood'].textContent, '100');     // ainda animando (nada pintou)
  advance(1000);
  counters.settle();
  assert.equal(els['v-wood'].textContent, '26,1 mi');
});

test('com quadros rodando, a rede de seguranca nao interfere na animacao', () => {
  const { els, counters, advance } = setup();
  counters.set('v-gold', 0);
  counters.set('v-gold', 1000);
  counters.frame();
  advance(100);
  counters.settle();                                   // quadro recente: nao salta
  const parcial = els['v-gold'].textContent;
  assert.notEqual(parcial, '1.000');
  for (let i = 0; i < 80; i++) counters.frame();
  assert.equal(els['v-gold'].textContent, '1.000');
});

test('animacao termina exatamente no alvo', () => {
  const { els, counters } = setup();
  counters.set('t-output', 0);
  counters.set('t-output', 12_500);
  for (let i = 0; i < 100; i++) counters.frame();
  assert.equal(els['t-output'].textContent, '12,5 mil');
});

test('varios contadores independentes', () => {
  const { els, counters, advance } = setup();
  counters.set('a', 1); counters.set('b', 2);
  counters.set('a', 50); counters.set('b', 70);
  advance(1000); counters.settle();
  assert.equal(els.a.textContent, '50');
  assert.equal(els.b.textContent, '70');
});
