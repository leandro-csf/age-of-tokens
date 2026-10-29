// Uso: npm start (na raiz)   |   PORT=4100 HOST=0.0.0.0 STEP_MS=3000 CLAUDE_HOME=... SAVE_FILE=... node server/src/index.js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../ingest/src/config.js';
import { createGame } from './game.js';
import { createHttp } from './http.js';
import { lanAddresses, isLoopbackOnly } from './net.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const port = Number(process.env.PORT) || 4100;
// Aberto na rede local por padrao (decisao do usuario: o tablet acessa pelo Wi-Fi). HOST=127.0.0.1 fecha de novo.
const host = process.env.HOST || '0.0.0.0';
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
server.listen(port, host, () => {
  console.log(`Age of Tokens (lendo ${config.claude.projectsDir})`);
  console.log(`  neste computador:  http://localhost:${port}`);
  if (isLoopbackOnly(host)) {
    console.log('  rede local:        desligada (HOST aponta so para esta maquina)');
    return;
  }
  const all = lanAddresses();
  const lan = all.filter(a => !a.virtual).length ? all.filter(a => !a.virtual) : all;   // virtuais so se nao houver outra
  if (lan.length) for (const a of lan) console.log(`  no tablet (mesma rede): http://${a.address}:${port}   [${a.name}]`);
  else console.log('  rede local:        nenhum endereco de rede encontrado');
  console.log('  aviso: qualquer aparelho na sua rede ve seus totais de tokens (API so de leitura). Para fechar: HOST=127.0.0.1');
});

function shutdown() {
  try { game.save(); } catch (err) { console.error('save final:', err.message); }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
