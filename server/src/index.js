// Uso: npm start (na raiz)   |   PORT=4100 HOST=127.0.0.1 STEP_MS=3000 CLAUDE_HOME=... SAVE_FILE=... node server/src/index.js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../ingest/src/config.js';
import { createGame } from './game.js';
import { createHttp } from './http.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const port = Number(process.env.PORT) || 4100;
// So esta maquina por padrao. Abrir para o celular na rede local e assunto do M5.
const host = process.env.HOST || '127.0.0.1';
const stepMs = Number(process.env.STEP_MS) || 3000;
const saveMs = 5000;

const game = createGame({
  projectsDir: config.claude.projectsDir,
  saveFile: process.env.SAVE_FILE || path.join(root, 'data', 'save.json'),
  baseline: process.argv.includes('--history') ? 'history' : 'now',
});

// poll encadeado (nunca dois ao mesmo tempo, mesmo se uma leitura demorar)
async function pollLoop() {
  try { await game.pollOnce(); } catch (err) { console.error('poll:', err.message); }
  setTimeout(pollLoop, config.read.pollMs);
}
pollLoop();

setInterval(() => { try { game.stepOnce(); } catch (err) { console.error('step:', err.message); } }, stepMs);
setInterval(() => { try { game.save(); } catch (err) { console.error('save:', err.message); } }, saveMs);

const server = createHttp(game, { webDir: path.join(root, 'web') });
server.listen(port, host, () => console.log(`Age of Tokens em http://${host}:${port}  (lendo ${config.claude.projectsDir})`));

function shutdown() {
  try { game.save(); } catch (err) { console.error('save final:', err.message); }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
