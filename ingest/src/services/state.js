import fs from 'node:fs';
import path from 'node:path';

export function emptyState() {
  return { version: 1, initialized: false, files: {}, knownSessions: [], recentIds: [] };
}

export function loadState(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8'));
    return s?.version === 1 ? { ...emptyState(), ...s } : emptyState();
  } catch {
    return emptyState();
  }
}

/** Escrita atomica (tmp + rename): queda no meio nao corrompe o save. */
export function saveState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, file);
}
