import fs from 'node:fs';
import { parseLine } from '../parsers/line.parser.js';
import { config } from '../config.js';

/**
 * Cursor de leitura incremental com offset PERSISTIVEL.
 *
 * Diferente do tailer do session manager (que le a janela final do arquivo),
 * o jogo precisa de contagem exata desde um ponto salvo. Por isso o cursor so
 * guarda `committed`: o offset logo apos a ultima linha COMPLETA ja processada.
 * Linha pela metade nao avanca o offset — e relida inteira na proxima vez.
 * Isso dispensa StringDecoder e buffer parcial: '\n' (0x0A) nunca aparece no
 * meio de um caractere UTF-8 multibyte, entao cortar no ultimo 0x0A e seguro.
 *
 * Nunca abre para escrita (flags 'r').
 */
export function createCursor(filePath, committed = 0) {
  return { path: filePath, committed };
}

function readRange(filePath, start, end) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const stream = fs.createReadStream(filePath, { flags: 'r', start, end });
    stream.on('data', c => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export async function statOrNull(filePath) {
  try { return await fs.promises.stat(filePath); } catch { return null; }
}

/** Le as linhas completas novas desde `cursor.committed` e avanca o cursor. */
export async function readDelta(cursor) {
  const st = await statOrNull(cursor.path);
  if (!st) return { entries: [], gone: true };

  // Arquivo encolheu (substituido/compactado): recomeca do zero.
  let reset = false;
  if (st.size < cursor.committed) { cursor.committed = 0; reset = true; }
  if (st.size === cursor.committed) return { entries: [], reset };

  let window = config.read.chunkBytes;
  while (true) {
    const end = Math.min(st.size, cursor.committed + window) - 1;
    const buf = await readRange(cursor.path, cursor.committed, end);
    const nl = buf.lastIndexOf(0x0a);
    if (nl === -1) {
      // sem quebra de linha: ou linha incompleta no fim, ou linha gigante
      if (end + 1 >= st.size) return { entries: [], reset };
      window *= 2;
      continue;
    }
    const text = buf.subarray(0, nl + 1).toString('utf8');
    cursor.committed += nl + 1;
    const entries = [];
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      const entry = parseLine(line);
      if (entry) entries.push(entry);
    }
    return { entries, reset };
  }
}
