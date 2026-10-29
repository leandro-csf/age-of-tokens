// Uso: npm start (na raiz)   |   PORT=4100 HOST=0.0.0.0 STEP_MS=3000 CLAUDE_HOME=... SAVE_FILE=... node server/src/index.js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../ingest/src/config.js';
import { createGame } from './game.js';
import { createHttp } from './http.js';
import { lanAddresses, isLoopbackOnly } from './net.js';
import { acquireLock, LockedError, NewerVersionError } from './store.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const port = Number(process.env.PORT) || 4100;
// Aberto na rede local por padrao (decisao do usuario: o tablet acessa pelo Wi-Fi). HOST=127.0.0.1 fecha de novo.
const host = process.env.HOST || '0.0.0.0';
const stepMs = Number(process.env.STEP_MS) || 3000;
const saveMs = 5000;

const saveFile = process.env.SAVE_FILE || path.join(root, 'data', 'save.json');

// So um servidor por pasta de dados: dois processos gravando o mesmo save se atropelariam.
let lock;
try {
  lock = acquireLock(path.join(path.dirname(saveFile), 'server.lock'), { port });
} catch (err) {
  if (err instanceof LockedError) { console.error(`
${err.message}
  (o outro esta em http://localhost:${err.info.port})
`); process.exit(1); }
  throw err;
}
process.on('exit', () => lock.release());

let game;
try {
  game = createGame({
    projectsDir: config.claude.projectsDir,
    saveFile,
    baseline: process.argv.includes('--history') ? 'history' : 'now',
  });
} catch (err) {
  if (err instanceof NewerVersionError) { console.error(`
${err.message}
`); lock.release(); process.exit(1); }
  throw err;
}

// poll encadeado (nunca dois ao mesmo tempo, mesmo se uma leitura demorar)
async function pollLoop() {
  try { await game.pollOnce(); } catch (err) { console.error('poll:', err.message); }
  setTimeout(pollLoop, config.read.pollMs);
}
pollLoop();

setInterval(() => { try { game.stepOnce(); } catch (err) { console.error('step:', err.message); } }, stepMs);
setInterval(() => {
  try { game.save(); } catch (err) {
    console.error(game.saveInfo().halted
      ? `
ATENCAO: gravacao PARADA por seguranca. ${err.message}
  O jogo segue no ar, mas nada mais sera salvo. Feche os outros servidores e reinicie.
`
      : 'save: ' + err.message);
  }
}, saveMs);

const server = createHttp(game, { webDir: path.join(root, 'web') });
function describeSave(i) {
  const when = i.savedAt ? new Date(i.savedAt).toLocaleString('pt-BR') : '?';
  switch (i.status) {
    case 'ok': return `save: carregado (gravacao ${i.seq}, salvo em ${when}, renda ${Math.round(i.income)})`;
    case 'upgraded': return `save: formato antigo atualizado (copia do original em ${path.basename(saveFile)}.pre-upgrade.bak)`;
    case 'recovered': return `AVISO: o save principal nao serviu; recuperado de ${i.source} (gravacao ${i.seq}, renda ${Math.round(i.income)})`;
    case 'unrecoverable': return `AVISO: nenhum save utilizavel; os arquivos foram guardados em ${i.quarantine}. Comecando um jogo novo.`;
    default: return 'save: jogo novo';
  }
}

server.listen(port, host, () => {
  console.log(`Age of Tokens (lendo ${config.claude.projectsDir})`);
  console.log(`  ${describeSave(game.saveInfo())}`);
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
  lock.release();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
