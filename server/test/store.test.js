import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createStore, acquireLock, interpret, migrate, backupsToKeep, incomeOf, FORMAT, STATE_VERSION, MIGRATIONS,
  NewerVersionError, StaleWriterError, RegressionError, LockedError,
} from '../src/store.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'aot-store-'));
const payload = (income = 100, extra = {}) => ({ version: STATE_VERSION, ingest: { files: {} }, sim: { earned: { food: income }, res: {} }, ...extra });
const H = 3600e3;
const clock = (start = new Date(2026, 9, 29, 12, 0).getTime()) => { let t = start; const f = () => t; f.advance = ms => { t += ms; }; return f; };

// ---------- envelope e checksum ----------
test('grava e le de volta com envelope, sequencia e checksum', () => {
  const dir = tmp(), file = path.join(dir, 'save.json');
  const a = createStore(file);
  assert.equal(a.load(), null);
  assert.equal(a.report.status, 'new');
  a.save(payload(500));
  const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(disk.format, FORMAT);
  assert.equal(disk.seq, 1);
  assert.match(disk.checksum, /^[0-9a-f]{64}$/);

  const b = createStore(file);
  const got = b.load();
  assert.equal(incomeOf(got), 500);
  assert.equal(b.report.status, 'ok');
  assert.equal(b.seq, 1);
});

test('checksum alterado: o arquivo e rejeitado (nao carrega dado adulterado)', () => {
  const dir = tmp(), file = path.join(dir, 'save.json');
  const a = createStore(file); a.load(); a.save(payload(100)); a.save(payload(200));   // agora existe .prev (100)
  const disk = JSON.parse(fs.readFileSync(file, 'utf8'));
  disk.payload.sim.earned.food = 999999;                                               // adulterou sem refazer o checksum
  fs.writeFileSync(file, JSON.stringify(disk));
  const b = createStore(file);
  const got = b.load();
  assert.equal(b.report.status, 'recovered');
  assert.equal(b.report.source, 'save.json.prev');
  assert.equal(incomeOf(got), 100);
});

// ---------- recuperacao em cascata ----------
test('arquivo truncado: recupera do .prev', () => {
  const dir = tmp(), file = path.join(dir, 'save.json');
  const a = createStore(file); a.load(); a.save(payload(100)); a.save(payload(300));
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').slice(0, 40));   // cortado no meio
  const b = createStore(file);
  assert.equal(incomeOf(b.load()), 100);
  assert.equal(b.report.status, 'recovered');
  assert.equal(b.report.skipped[0].file, 'save.json');
});

test('principal e .prev ruins: recupera do backup mais novo', () => {
  const dir = tmp(), file = path.join(dir, 'save.json');
  const now = clock();
  const a = createStore(file, { now }); a.load();
  a.save(payload(100));                         // cria o 1o backup
  now.advance(2 * H); a.save(payload(200));     // 2o backup
  fs.writeFileSync(file, 'lixo'); fs.writeFileSync(file + '.prev', 'lixo');
  const b = createStore(file, { now });
  assert.equal(incomeOf(b.load()), 200);
  assert.match(b.report.source, /^save-\d{8}-\d{4}\.json$/);
});

test('nada serve: guarda os arquivos de lado (quarentena) e comeca novo, sem apagar nada', () => {
  const dir = tmp(), file = path.join(dir, 'save.json');
  fs.writeFileSync(file, '{truncado');
  fs.writeFileSync(file + '.prev', 'tambem ruim');
  const s = createStore(file);
  assert.equal(s.load(), null);
  assert.equal(s.report.status, 'unrecoverable');
  assert.ok(fs.existsSync(path.join(s.report.quarantine, 'save.json')));
  assert.ok(fs.existsSync(path.join(s.report.quarantine, 'save.json.prev')));
  assert.equal(s.report.failures.length, 2);
});

// ---------- migracao ----------
test('formato antigo (sem envelope) e migrado e o original e guardado', () => {
  const dir = tmp(), file = path.join(dir, 'save.json');
  const legacy = { version: 1, savedAt: 123, ingest: { files: { a: 1 } }, sim: { earned: { food: 4242 } } };
  fs.writeFileSync(file, JSON.stringify(legacy));
  const s = createStore(file);
  const got = s.load();
  assert.equal(incomeOf(got), 4242);
  assert.equal(s.report.status, 'upgraded');
  assert.equal(s.report.legacy, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(file + '.pre-upgrade.bak', 'utf8')), legacy);
  s.save(got);                                                        // a proxima gravacao ja sai no formato novo
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).format, FORMAT);
});

test('cadeia de migracoes v1 -> v2 -> v3, passo a passo', () => {
  const migrations = {
    1: p => { p.sim.earned.gold = 7; return p; },
    2: p => { p.novoCampo = 'v3'; return p; },
  };
  const m = migrate(payload(10, { version: 1 }), 3, migrations);
  assert.equal(m.payload.version, 3);
  assert.equal(m.from, 1);
  assert.equal(m.payload.sim.earned.gold, 7);
  assert.equal(m.payload.novoCampo, 'v3');
  assert.equal(payload(10).version, STATE_VERSION, 'nao altera o original');
});

test('migracao ausente: erro claro (nao inventa)', () => {
  assert.throws(() => migrate(payload(1, { version: 1 }), 3, { 1: p => p }), /sem migracao da versao 2/);
});

test('o store carrega um save v1 num programa v2 usando a migracao', () => {
  const dir = tmp(), file = path.join(dir, 'save.json');
  createStore(file, { stateVersion: 1 }).save(payload(321, { version: 1 }));
  const s = createStore(file, { stateVersion: 2, migrations: { 1: p => { p.migrado = true; return p; } } });
  const got = s.load();
  assert.equal(got.version, 2);
  assert.equal(got.migrado, true);
  assert.equal(s.report.migratedFrom, 1);
  assert.equal(s.report.status, 'upgraded');
  assert.ok(fs.existsSync(file + '.pre-migration-v1.bak'), 'cada migracao guarda a sua copia');
});

test('save de versao FUTURA: lanca erro, nao altera e nao cai para um backup mais velho', () => {
  const dir = tmp(), file = path.join(dir, 'save.json');
  const a = createStore(file); a.load(); a.save(payload(100));                       // um .prev/backup "mais velho" existe
  a.save(payload(200));
  // um save de verdade da versao 9: gravado por um programa "v9" (checksum correto) e lido por um "v1"
  const dir2 = tmp(), f2 = path.join(dir2, 'save.json');
  createStore(f2, { stateVersion: 9 }).save(payload(900, { version: 9 }));
  const antes = fs.readFileSync(f2, 'utf8');
  fs.copyFileSync(f2, file);
  const b = createStore(file);
  assert.throws(() => b.load(), NewerVersionError);
  assert.equal(fs.readFileSync(file, 'utf8'), antes, 'o save futuro nao pode ser tocado');
});

test('interpret: formato do envelope mais novo tambem e recusado', () => {
  assert.throws(() => interpret({ format: FORMAT + 1, payload: {} }), NewerVersionError);
  assert.throws(() => interpret({ nada: true }), /formato desconhecido/);
});

// ---------- travas de gravacao ----------
test('escritor ATRASADO e recusado (outro processo gravou depois)', () => {
  const dir = tmp(), file = path.join(dir, 'save.json');
  const a = createStore(file); a.load(); a.save(payload(100));
  const b = createStore(file); b.load();                 // b e a veem a mesma gravacao 1
  a.save(payload(150));                                  // a grava a 2
  assert.throws(() => b.save(payload(150)), StaleWriterError);
  assert.equal(incomeOf(createStore(file).load()), 150);
});

test('renda menor que a do disco: recusa (a renda vitalicia nunca diminui)', () => {
  const dir = tmp(), file = path.join(dir, 'save.json');
  const a = createStore(file); a.load(); a.save(payload(1000));
  assert.throws(() => a.save(payload(900)), RegressionError);
  assert.equal(incomeOf(createStore(file).load()), 1000);
});

test('force permite recomecar de proposito', () => {
  const dir = tmp(), file = path.join(dir, 'save.json');
  const a = createStore(file); a.load(); a.save(payload(1000));
  a.save(payload(5), { force: true });
  assert.equal(incomeOf(createStore(file).load()), 5);
});

test('gravacao atomica: nao deixa .tmp para tras e o .prev guarda o save anterior', () => {
  const dir = tmp(), file = path.join(dir, 'save.json');
  const a = createStore(file); a.load(); a.save(payload(10)); a.save(payload(20));
  assert.ok(!fs.existsSync(file + '.tmp'));
  assert.equal(incomeOf(interpret(JSON.parse(fs.readFileSync(file + '.prev', 'utf8'))).payload), 10);
});

// ---------- backups ----------
test('backup a cada hora, nao a cada gravacao', () => {
  const dir = tmp(), file = path.join(dir, 'save.json');
  const now = clock();
  const a = createStore(file, { now }); a.load();
  a.save(payload(1)); a.save(payload(2)); a.save(payload(3));
  assert.equal(a.listBackups().length, 1);
  now.advance(61 * 60e3); a.save(payload(4));
  assert.equal(a.listBackups().length, 2);
});

test('poda: 24 h inteiras + 1 por dia nos 7 dias seguintes; o resto cai', () => {
  const now = new Date(2026, 9, 29, 12, 0).getTime();
  const name = d => { const p = n => String(n).padStart(2, '0'); return `save-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`; };
  const at = h => name(new Date(now - h * H));
  const names = [at(0), at(1), at(10), at(23), at(30), at(31), at(55), at(56), at(200), at(24 * 9 * 1)];
  const keep = backupsToKeep(names, now);
  for (const h of [0, 1, 10, 23]) assert.ok(keep.has(at(h)), `devia manter ${h}h`);
  // 30 h e 31 h atras caem no mesmo dia do backup de 23 h, que ja cobre esse dia: os dois saem
  assert.ok(!keep.has(at(30)) && !keep.has(at(31)), 'dia ja coberto pelas ultimas 24 h');
  // 55 h e 56 h atras sao o mesmo dia ainda sem cobertura: fica so o mais novo
  assert.ok(keep.has(at(55)) && !keep.has(at(56)), 'um backup por dia nos dias mais velhos');
  assert.ok(!keep.has(at(24 * 9)), 'mais velho que 8 dias cai');
  assert.ok(!keep.has(at(200)), 'mais velho que 8 dias cai');
});

test('o diretorio de backups e podado de verdade ao gravar', () => {
  const dir = tmp(), file = path.join(dir, 'save.json');
  const now = clock();
  const a = createStore(file, { now }); a.load();
  for (let i = 0; i < 40; i++) { a.save(payload(i + 1)); now.advance(61 * 60e3); }   // 40 horas
  const n = a.listBackups().length;
  assert.ok(n >= 24 && n <= 28, `devia ter ~25 backups, tem ${n}`);
});

// ---------- instancia unica ----------
test('trava: o segundo servidor e recusado enquanto o primeiro esta vivo', () => {
  const lock = path.join(tmp(), 'server.lock');
  const a = acquireLock(lock, { port: 4100, pid: 111, isAlive: () => true });
  assert.throws(() => acquireLock(lock, { port: 4101, pid: 222, isAlive: () => true }), e => e instanceof LockedError && e.info.pid === 111 && e.info.port === 4100);
  a.release();
  assert.ok(!fs.existsSync(lock));
});

test('trava velha (dono morto) e assumida', () => {
  const lock = path.join(tmp(), 'server.lock');
  acquireLock(lock, { port: 4100, pid: 111, isAlive: () => true });
  const b = acquireLock(lock, { port: 4100, pid: 222, isAlive: () => false });
  assert.equal(JSON.parse(fs.readFileSync(lock, 'utf8')).pid, 222);
  b.release();
});

test('release so remove a trava propria', () => {
  const lock = path.join(tmp(), 'server.lock');
  const a = acquireLock(lock, { port: 1, pid: 111 });
  fs.writeFileSync(lock, JSON.stringify({ pid: 999, port: 2 }));     // outro processo assumiu
  a.release();
  assert.ok(fs.existsSync(lock), 'nao pode apagar a trava de outro');
});

test('trava com o proprio PID (reinicio rapido) nao trava a si mesmo', () => {
  const lock = path.join(tmp(), 'server.lock');
  acquireLock(lock, { port: 1, pid: 111, isAlive: () => true });
  assert.doesNotThrow(() => acquireLock(lock, { port: 1, pid: 111, isAlive: () => true }));
});

// ---------- a migracao real v1 -> v2 (prestigio) ----------
test('REAL: um save v1 (aldeia sem prestigio) migra para v2 sem perder nada', () => {
  const dir = tmp(), file = path.join(dir, 'save.json');
  const antigo = { version: 1, savedAt: 1, ingest: { files: { a: 1 } }, sim: { version: 1, era: 2, earned: { food: 5000, wood: 100 }, res: { food: 7 }, built: { casa: 3 }, raw: { output: 99 } } };
  fs.writeFileSync(file, JSON.stringify(antigo));
  const s = createStore(file);
  const got = s.load();
  assert.equal(got.version, 2);
  assert.equal(got.sim.version, 2);
  assert.equal(got.sim.prestige, 0);
  assert.equal(got.sim.legacy, 0);
  // tudo o que existia continua igual
  assert.equal(got.sim.era, 2);
  assert.deepEqual(got.sim.earned, { food: 5000, wood: 100 });
  assert.deepEqual(got.sim.built, { casa: 3 });
  assert.equal(got.sim.raw.output, 99);
  assert.deepEqual(got.ingest, { files: { a: 1 } });
  assert.deepEqual(JSON.parse(fs.readFileSync(file + '.pre-upgrade.bak', 'utf8')), antigo);
});

test('a migracao nao sobrescreve um prestigio ja existente', () => {
  const p = { version: 1, sim: { prestige: 3, legacy: 1e6 } };
  const m = MIGRATIONS[1](structuredClone(p));
  assert.equal(m.sim.prestige, 3);
  assert.equal(m.sim.legacy, 1e6);
});

test('duas atualizacoes seguidas guardam duas copias (formato antigo e migracao de versao)', () => {
  const dir = tmp(), file = path.join(dir, 'save.json');
  const antigo = { version: 1, savedAt: 1, ingest: {}, sim: { earned: { food: 10 } } };
  fs.writeFileSync(file, JSON.stringify(antigo));
  createStore(file, { stateVersion: 1 }).load();                       // 1a: formato antigo (sem envelope)
  assert.ok(fs.existsSync(file + '.pre-upgrade.bak'));
  const s1 = createStore(file, { stateVersion: 1 }); const p1 = s1.load(); s1.save(p1);   // vira envelope v1
  const s2 = createStore(file, { stateVersion: 2, migrations: { 1: p => p } }); s2.load();  // 2a: migracao v1 -> v2
  assert.ok(fs.existsSync(file + '.pre-migration-v1.bak'));
  assert.deepEqual(JSON.parse(fs.readFileSync(file + '.pre-upgrade.bak', 'utf8')), antigo, 'a copia original nao foi sobrescrita');
});
