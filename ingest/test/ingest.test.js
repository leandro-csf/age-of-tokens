import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createIngest } from '../src/services/ingest.js';
import { emptyState, loadState, saveState } from '../src/services/state.js';

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aot-'));
  const dir = path.join(root, 'proj-a');
  fs.mkdirSync(dir, { recursive: true });
  return { root, dir };
}

const asst = (msgId, blockIdx, extra = {}) => JSON.stringify({
  type: 'assistant', sessionId: 's1', timestamp: '2026-10-29T10:00:00Z', requestId: 'r-' + msgId,
  message: {
    id: msgId, model: 'claude-x',
    content: extra.content || [{ type: 'text', text: 'oi' }],
    usage: { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 5000, output_tokens_details: { thinking_tokens: 40 } },
  },
  apiBlockIndex: blockIdx,
}) + '\n';

const sum = (events, key) => events.filter(e => e.type === 'tokens').reduce((n, e) => n + e[key], 0);

test('baseline now ignora o historico e conta so o que vem depois', async () => {
  const { root, dir } = setup();
  const file = path.join(dir, 's1.jsonl');
  fs.writeFileSync(file, asst('m1', 0));
  const state = emptyState();
  const ing = createIngest({ projectsDir: root, state, baseline: 'now' });

  assert.equal((await ing.poll()).events.length, 0);
  fs.appendFileSync(file, asst('m2', 0));
  const { events } = await ing.poll();
  assert.equal(sum(events, 'output'), 100);
});

test('baseline history conta tudo que ja existe', async () => {
  const { root, dir } = setup();
  fs.writeFileSync(path.join(dir, 's1.jsonl'), asst('m1', 0) + asst('m2', 0));
  const ing = createIngest({ projectsDir: root, state: emptyState(), baseline: 'history' });
  const { events } = await ing.poll();
  assert.equal(sum(events, 'output'), 200);
  assert.equal(events.filter(e => e.type === 'session:new').length, 0);
});

test('blocos da mesma resposta contam tokens uma vez so', async () => {
  const { root, dir } = setup();
  const file = path.join(dir, 's1.jsonl');
  fs.writeFileSync(file, '');
  const ing = createIngest({ projectsDir: root, state: emptyState(), baseline: 'now' });
  await ing.poll();
  fs.appendFileSync(file, asst('m1', 0) + asst('m1', 1) + asst('m1', 2));
  const { events } = await ing.poll();
  assert.equal(events.filter(e => e.type === 'tokens').length, 1);
  assert.equal(sum(events, 'thinking'), 40);
});

test('linha escrita pela metade nao duplica nem se perde', async () => {
  const { root, dir } = setup();
  const file = path.join(dir, 's1.jsonl');
  fs.writeFileSync(file, '');
  const ing = createIngest({ projectsDir: root, state: emptyState(), baseline: 'now' });
  await ing.poll();
  const line = asst('m1', 0);
  fs.appendFileSync(file, line.slice(0, 40));
  assert.equal((await ing.poll()).events.length, 0);
  fs.appendFileSync(file, line.slice(40));
  assert.equal(sum((await ing.poll()).events, 'output'), 100);
  assert.equal((await ing.poll()).events.length, 0);
});

test('caractere multibyte e linha parcial no meio do emoji', async () => {
  const { root, dir } = setup();
  const file = path.join(dir, 's1.jsonl');
  fs.writeFileSync(file, '');
  const ing = createIngest({ projectsDir: root, state: emptyState(), baseline: 'now' });
  await ing.poll();
  const buf = Buffer.from(asst('m1', 0, { content: [{ type: 'text', text: 'olá 🏰 aldeia' }] }));
  const cut = buf.indexOf(0xf0) + 2; // corta no meio do emoji de 4 bytes
  fs.appendFileSync(file, buf.subarray(0, cut));
  await ing.poll();
  fs.appendFileSync(file, buf.subarray(cut));
  assert.equal(sum((await ing.poll()).events, 'output'), 100);
});

test('sessao nova gera session:new; subagente gera subagent:new', async () => {
  const { root, dir } = setup();
  const ing = createIngest({ projectsDir: root, state: emptyState(), baseline: 'now' });
  await ing.poll();
  fs.writeFileSync(path.join(dir, 's2.jsonl'), asst('m9', 0));
  fs.mkdirSync(path.join(dir, 's2', 'subagents'), { recursive: true });
  fs.writeFileSync(path.join(dir, 's2', 'subagents', 'agent-a1.jsonl'), asst('m10', 0));
  const { events } = await ing.poll();
  assert.equal(events.filter(e => e.type === 'session:new').length, 1);
  assert.equal(events.filter(e => e.type === 'subagent:new').length, 1);
  assert.equal(events.filter(e => e.type === 'tokens' && e.subagent).length, 1);
});

test('tool_use vira evento tool, contado uma vez', async () => {
  const { root, dir } = setup();
  const file = path.join(dir, 's1.jsonl');
  fs.writeFileSync(file, '');
  const ing = createIngest({ projectsDir: root, state: emptyState(), baseline: 'now' });
  await ing.poll();
  fs.appendFileSync(file, asst('m1', 0, { content: [{ type: 'tool_use', id: 'tu1', name: 'Edit', input: {} }] }));
  const { events } = await ing.poll();
  assert.deepEqual(events.filter(e => e.type === 'tool').map(e => e.name), ['Edit']);
});

test('retomar do save nao reconta o que ja foi lido', async () => {
  const { root, dir } = setup();
  const file = path.join(dir, 's1.jsonl');
  const saveFile = path.join(root, 'data', 'state.json');
  fs.writeFileSync(file, '');
  let ing = createIngest({ projectsDir: root, state: loadState(saveFile), baseline: 'now' });
  let r = await ing.poll();
  saveState(saveFile, ing.state);
  fs.appendFileSync(file, asst('m1', 0) + asst('m1', 1));
  r = await ing.poll();
  assert.equal(sum(r.events, 'output'), 100);
  saveState(saveFile, ing.state);

  // "reinicia o jogo": novo ingest, mesmo save. O bloco 1 de m1 nao pode contar de novo.
  ing = createIngest({ projectsDir: root, state: loadState(saveFile), baseline: 'now' });
  fs.appendFileSync(file, asst('m1', 2) + asst('m2', 0));
  r = await ing.poll();
  assert.equal(sum(r.events, 'output'), 100); // so m2
});

test('arquivo que encolhe e relido do zero', async () => {
  const { root, dir } = setup();
  const file = path.join(dir, 's1.jsonl');
  fs.writeFileSync(file, asst('m1', 0) + asst('m2', 0));
  const ing = createIngest({ projectsDir: root, state: emptyState(), baseline: 'now' });
  await ing.poll();
  fs.writeFileSync(file, asst('m3', 0));
  assert.equal(sum((await ing.poll()).events, 'output'), 100);
});
