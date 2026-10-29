import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGame, loadSave } from '../src/game.js';

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aot-srv-'));
  const projects = path.join(root, 'projects');
  const dir = path.join(projects, 'proj-a');
  fs.mkdirSync(dir, { recursive: true });
  return { root, projects, dir, file: path.join(dir, 's1.jsonl'), saveFile: path.join(root, 'data', 'save.json') };
}

const asst = (msgId, o = {}) => JSON.stringify({
  type: 'assistant', sessionId: 's1', timestamp: '2026-10-29T10:00:00Z',
  message: {
    id: msgId, model: 'claude-sonnet-5', content: o.content || [{ type: 'text', text: 'oi' }],
    usage: { input_tokens: 0, output_tokens: o.output ?? 1000, cache_read_input_tokens: 0, output_tokens_details: { thinking_tokens: 0 } },
  },
}) + '\n';

test('baseline now: ignora o que ja existe e aplica o que chega depois', async () => {
  const t = setup();
  fs.writeFileSync(t.file, asst('m1'));
  const game = createGame({ projectsDir: t.projects, saveFile: t.saveFile });
  await game.pollOnce();
  assert.equal(game.view().res.food, 0);
  fs.appendFileSync(t.file, asst('m2'));
  await game.pollOnce();
  assert.equal(game.view().res.food, 10); // 1000 output / 100
  assert.equal(game.view().raw.output, 1000);
});

test('ouvintes recebem os eventos da ingestao e as acoes do decisor', async () => {
  const t = setup();
  fs.writeFileSync(t.file, '');
  const game = createGame({ projectsDir: t.projects, saveFile: t.saveFile });
  await game.pollOnce();
  const seen = [];
  game.subscribe(e => seen.push(e.type));
  fs.appendFileSync(t.file, asst('m1', { output: 100000 }) + asst('m2', { content: [{ type: 'tool_use', id: 't1', name: 'Edit', input: {} }] }));
  await game.pollOnce();
  assert.ok(seen.includes('ingest'));
  assert.ok(seen.includes('state'));
  const action = game.stepOnce();
  assert.equal(action.type, 'train'); // 1000 comida de sobra para um aldeao
  assert.ok(seen.includes('action'));
});

test('sem recurso o decisor fica ocioso e nao marca o save como sujo', () => {
  const t = setup();
  const game = createGame({ projectsDir: t.projects, saveFile: t.saveFile });
  assert.equal(game.stepOnce().type, 'idle');
  assert.equal(game.save(), false);
  assert.equal(fs.existsSync(t.saveFile), false);
});

test('save e retomada: nada e contado duas vezes nem se perde', async () => {
  const t = setup();
  fs.writeFileSync(t.file, '');
  let game = createGame({ projectsDir: t.projects, saveFile: t.saveFile });
  await game.pollOnce();
  fs.appendFileSync(t.file, asst('m1') + asst('m1'));
  await game.pollOnce();
  assert.equal(game.view().raw.output, 1000); // bloco duplicado conta uma vez
  assert.equal(game.save(), true);

  // "reinicia o servidor": o jogo novo le o mesmo save
  game = createGame({ projectsDir: t.projects, saveFile: t.saveFile });
  assert.equal(game.view().raw.output, 1000);
  fs.appendFileSync(t.file, asst('m1') + asst('m2', { output: 500 }));
  await game.pollOnce();
  assert.equal(game.view().raw.output, 1500); // so m2 entrou
});

test('eventos que chegam com o servidor desligado entram na proxima subida', async () => {
  const t = setup();
  fs.writeFileSync(t.file, '');
  let game = createGame({ projectsDir: t.projects, saveFile: t.saveFile });
  await game.pollOnce();
  game.save(); // nada mudou ainda... forca o primeiro save abaixo
  fs.appendFileSync(t.file, asst('m1'));
  await game.pollOnce();
  game.save();
  fs.appendFileSync(t.file, asst('m2') + asst('m3')); // servidor "desligado"
  game = createGame({ projectsDir: t.projects, saveFile: t.saveFile });
  await game.pollOnce();
  assert.equal(game.view().raw.output, 3000);
});

test('save corrompido ou de outra versao e ignorado', () => {
  const t = setup();
  fs.mkdirSync(path.dirname(t.saveFile), { recursive: true });
  fs.writeFileSync(t.saveFile, '{nao e json');
  assert.equal(loadSave(t.saveFile), null);
  fs.writeFileSync(t.saveFile, JSON.stringify({ version: 99, sim: {}, ingest: {} }));
  assert.equal(loadSave(t.saveFile), null);
  const game = createGame({ projectsDir: t.projects, saveFile: t.saveFile });
  assert.equal(game.view().summary.era, 'Era das Trevas');
});

test('ouvinte que lanca erro nao derruba o jogo', async () => {
  const t = setup();
  fs.writeFileSync(t.file, '');
  const game = createGame({ projectsDir: t.projects, saveFile: t.saveFile });
  await game.pollOnce();
  game.subscribe(() => { throw new Error('ouvinte ruim'); });
  fs.appendFileSync(t.file, asst('m1'));
  await game.pollOnce();
  assert.equal(game.view().raw.output, 1000);
});
