import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/*
 * Armazenamento do save: um arquivo JSON, mas a prova de queda, de corrupcao e de dois
 * escritores. Em camadas:
 *
 *  - ENVELOPE com checksum (SHA-256): detecta arquivo truncado ou adulterado.
 *  - MIGRACAO: o conteudo tem `version`; uma cadeia de funcoes v1->v2->... leva saves velhos
 *    ao formato atual. Save de versao MAIS NOVA que o programa nunca e sobrescrito.
 *  - RECUPERACAO em cascata: save.json -> save.json.prev -> backups mais novos primeiro.
 *  - BACKUPS rotativos (1 por hora nas ultimas 24 h, 1 por dia nos ultimos 7 dias).
 *  - TRAVA contra regressao: a renda vitalicia nunca diminui, e um escritor "atrasado" (numero
 *    de gravacao mais velho que o do disco) e recusado.
 *  - TRAVA de instancia unica (server.lock).
 */

export const FORMAT = 2;          // formato do envelope no disco
export const STATE_VERSION = 1;   // versao do CONTEUDO (payload.version)

/** Migracoes do conteudo: chave n = funcao que leva a versao n para n+1. (vazia: so existe a v1) */
export const MIGRATIONS = {};

export class NewerVersionError extends Error {
  constructor(found, supported, file) {
    super(`o save ${file || ''} e de uma versao mais nova (${found}) que a suportada aqui (${supported}). Nada foi alterado: atualize o programa.`.replace('save  e', 'save e'));
    this.name = 'NewerVersionError';
  }
}
export class StaleWriterError extends Error {
  constructor(disk, ours) { super(`outro processo gravou o save depois (gravacao ${disk} no disco, ${ours} aqui). Gravacao recusada para nao apagar o progresso.`); this.name = 'StaleWriterError'; }
}
export class RegressionError extends Error {
  constructor(disk, ours) { super(`o save em disco tem renda ${Math.round(disk)}, maior que a deste processo (${Math.round(ours)}). Gravacao recusada.`); this.name = 'RegressionError'; }
}
export class LockedError extends Error {
  constructor(info) { super(`ja existe um servidor rodando (PID ${info.pid}, porta ${info.port}). Feche-o antes de abrir outro.`); this.name = 'LockedError'; this.info = info; }
}

const sha = payload => crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
export const incomeOf = payload => Object.values(payload?.sim?.earned ?? {}).reduce((n, v) => n + v, 0);

class InvalidSave extends Error {}

/** Interpreta o JSON lido do disco: devolve { payload, seq, savedAt, legacy } ou lanca InvalidSave. */
export function interpret(obj, file = '') {
  if (obj && obj.format === FORMAT) {
    if (!obj.payload || typeof obj.payload !== 'object') throw new InvalidSave('sem conteudo');
    if (obj.checksum !== sha(obj.payload)) throw new InvalidSave('checksum nao confere (arquivo truncado ou alterado)');
    return { payload: obj.payload, seq: obj.seq || 0, savedAt: obj.savedAt, legacy: false };
  }
  if (obj && obj.format > FORMAT) throw new NewerVersionError(`formato ${obj.format}`, `formato ${FORMAT}`, file);
  // formato antigo (antes do envelope): { version, savedAt, ingest, sim } direto na raiz
  if (obj && obj.format === undefined && obj.sim && obj.ingest && typeof obj.version === 'number') {
    return { payload: { version: obj.version, ingest: obj.ingest, sim: obj.sim }, seq: 0, savedAt: obj.savedAt, legacy: true };
  }
  throw new InvalidSave('formato desconhecido');
}

/** Aplica a cadeia de migracoes ate `target`. Devolve { payload, from }. */
export function migrate(payload, target = STATE_VERSION, migrations = MIGRATIONS, file = '') {
  const from = payload.version;
  if (from > target) throw new NewerVersionError(from, target, file);
  let p = payload;
  while (p.version < target) {
    const step = migrations[p.version];
    if (!step) throw new InvalidSave(`sem migracao da versao ${p.version}`);
    const next = step(structuredClone(p));
    next.version = p.version + 1;
    p = next;
  }
  return { payload: p, from };
}

const pad = n => String(n).padStart(2, '0');
const stamp = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
const BACKUP_RE = /^save-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})\.json$/;
const backupDate = name => { const m = BACKUP_RE.exec(name); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null; };

/** Quais backups manter: todos das ultimas 24 h + o mais novo de cada dia nos ultimos 7 dias. */
export function backupsToKeep(names, nowMs) {
  const items = names.map(n => ({ n, t: backupDate(n)?.getTime() })).filter(x => x.t !== undefined && !Number.isNaN(x.t)).sort((a, b) => b.t - a.t);
  const keep = new Set();
  const seenDays = new Set();
  for (const { n, t } of items) {
    const age = nowMs - t;
    if (age <= 24 * 3600e3) { keep.add(n); seenDays.add(new Date(t).toDateString()); continue; }
    const day = new Date(t).toDateString();
    if (age <= 8 * 24 * 3600e3 && !seenDays.has(day)) { keep.add(n); seenDays.add(day); }
  }
  return keep;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return undefined; }
}

export function createStore(file, { migrations = MIGRATIONS, stateVersion = STATE_VERSION, now = Date.now, backupEveryMs = 3600e3 } = {}) {
  const dir = path.dirname(file);
  const prevFile = `${file}.prev`;
  const backupDir = path.join(dir, 'backups');
  let seq = 0;
  let report = { status: 'new' };

  const listBackups = () => {
    try { return fs.readdirSync(backupDir).filter(n => BACKUP_RE.test(n)).sort().reverse(); } catch { return []; }
  };

  function tryRead(candidate) {
    const raw = readJson(candidate);
    if (raw === undefined) throw new InvalidSave('ilegivel (JSON invalido ou ausente)');
    const it = interpret(raw, path.basename(candidate));
    const m = migrate(it.payload, stateVersion, migrations, path.basename(candidate));
    return { ...it, payload: m.payload, migratedFrom: m.from !== stateVersion ? m.from : null };
  }

  return {
    get report() { return report; },
    get seq() { return seq; },

    /**
     * Carrega o melhor save disponivel (cascata). Devolve o conteudo ou null (jogo novo).
     * Lanca NewerVersionError se o save e de uma versao mais nova (nunca sobrescreve).
     */
    load() {
      const candidates = [file, prevFile, ...listBackups().map(n => path.join(backupDir, n))].filter(f => fs.existsSync(f));
      if (!candidates.length) { report = { status: 'new' }; return null; }
      const failures = [];
      for (const c of candidates) {
        try {
          const r = tryRead(c);
          seq = r.seq;
          const upgraded = r.legacy || r.migratedFrom !== null;
          const first = c === file;
          if (first && upgraded) {
            // guarda o original antes de a gravacao seguinte reescrever no formato novo
            const bak = `${file}.pre-upgrade.bak`;
            if (!fs.existsSync(bak)) fs.copyFileSync(file, bak);
          }
          report = {
            status: first ? (upgraded ? 'upgraded' : 'ok') : 'recovered',
            source: path.basename(c), seq, savedAt: r.savedAt ?? null, income: incomeOf(r.payload),
            ...(r.legacy ? { legacy: true } : {}), ...(r.migratedFrom !== null ? { migratedFrom: r.migratedFrom } : {}),
            ...(failures.length ? { skipped: failures } : {}),
          };
          return r.payload;
        } catch (e) {
          if (e instanceof NewerVersionError) throw e;   // nunca cair para um save mais antigo
          failures.push({ file: path.basename(c), reason: e.message });
        }
      }
      // havia arquivos, mas nenhum serve: poe de lado (para inspecao) e comeca um jogo novo
      const q = path.join(dir, `corrupt-${stamp(new Date(now()))}`);
      fs.mkdirSync(q, { recursive: true });
      for (const c of candidates) { try { fs.copyFileSync(c, path.join(q, path.basename(c))); } catch { /* segue */ } }
      report = { status: 'unrecoverable', quarantine: q, failures };
      return null;
    },

    /** Grava de forma atomica, com as travas. Devolve { seq }. `force` ignora a trava de renda (jogo novo de proposito). */
    save(payload, { force = false } = {}) {
      fs.mkdirSync(dir, { recursive: true });
      // trava: o que ha no disco agora e mais novo/maior que o que vamos gravar?
      let diskValid = false;
      const diskRaw = readJson(file);
      if (diskRaw !== undefined) {
        try {
          const d = interpret(diskRaw);
          diskValid = true;
          if (d.seq > seq) throw new StaleWriterError(d.seq, seq);
          if (!force && incomeOf(d.payload) > incomeOf(payload) + 1e-6) throw new RegressionError(incomeOf(d.payload), incomeOf(payload));
        } catch (e) { if (e instanceof StaleWriterError || e instanceof RegressionError) throw e; }
      }
      const nextSeq = seq + 1;
      const envelope = { format: FORMAT, seq: nextSeq, savedAt: now(), checksum: sha(payload), payload };
      const tmp = `${file}.tmp`;
      const fd = fs.openSync(tmp, 'w');
      try { fs.writeSync(fd, JSON.stringify(envelope)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      if (diskValid) fs.copyFileSync(file, prevFile);   // o ultimo save BOM vira o .prev
      fs.renameSync(tmp, file);
      seq = nextSeq;
      report = { ...report, status: report.status === 'new' ? 'ok' : report.status, seq };
      this.backupIfDue();
      return { seq };
    },

    /** Copia o save atual para backups/ se o ultimo backup tem mais de `backupEveryMs`, e poda os velhos. */
    backupIfDue() {
      const nowMs = now();
      const names = listBackups();
      const last = names.length ? backupDate(names[0])?.getTime() : undefined;
      if (last === undefined || nowMs - last >= backupEveryMs) {
        fs.mkdirSync(backupDir, { recursive: true });
        fs.copyFileSync(file, path.join(backupDir, `save-${stamp(new Date(nowMs))}.json`));
      }
      const all = listBackups();
      const keep = backupsToKeep(all, nowMs);
      for (const n of all) if (!keep.has(n)) { try { fs.unlinkSync(path.join(backupDir, n)); } catch { /* segue */ } }
    },

    listBackups,
  };
}

// ---------- trava de instancia unica ----------
const defaultIsAlive = pid => {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
};

/**
 * Cria `lockFile` (so um servidor por pasta de dados). Se ja existe e o processo dono esta vivo,
 * lanca LockedError; se o dono morreu (trava velha), assume. Devolve { release }.
 */
export function acquireLock(lockFile, { port, pid = process.pid, isAlive = defaultIsAlive, now = Date.now } = {}) {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  const info = { pid, port, startedAt: now() };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(lockFile, JSON.stringify(info), { flag: 'wx' });
      return {
        info,
        release() { try { if (readJson(lockFile)?.pid === pid) fs.unlinkSync(lockFile); } catch { /* ja sumiu */ } },
      };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const cur = readJson(lockFile);
      if (cur && cur.pid !== pid && isAlive(cur.pid)) throw new LockedError(cur);
      try { fs.unlinkSync(lockFile); } catch { /* corrida com outro: tenta de novo */ }   // trava velha: assume
    }
  }
  throw new Error('nao consegui criar a trava ' + lockFile);
}
