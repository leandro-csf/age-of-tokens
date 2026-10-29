// Uso: node src/cli.js [--history]   (so leitura em ~/.claude; save em ../data/ingest-state.json)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { createIngest } from './services/ingest.js';
import { loadState, saveState } from './services/state.js';

const stateFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data/ingest-state.json');
const state = loadState(stateFile);
const ing = createIngest({
  state,
  baseline: process.argv.includes('--history') ? 'history' : 'now',
  onEvent: e => console.log(JSON.stringify(e)),
});

async function tick() {
  const { dirty } = await ing.poll();
  if (dirty) saveState(stateFile, state);
}

await tick();
console.log(`ingestao ativa (${state.initialized ? 'save: ' + stateFile : ''}), poll ${config.read.pollMs} ms`);
setInterval(() => tick().catch(err => console.error(err)), config.read.pollMs);
