/**
 * Parser de linhas do transcript .jsonl do Claude Code.
 *
 * ############################################################################
 * # ATENCAO — NUNCA use regex/grep sobre a linha crua para achar o tipo.     #
 * # Schemas de ferramentas embutidos no conteudo contem "type":"string",     #
 * # "type":"object" etc. Numa amostra real de 200KB: 94 falsos positivos     #
 * # contra 3 ocorrencias reais de "type":"assistant".                        #
 * # Sempre JSON.parse na linha e leia o .type de TOPO.                       #
 * ############################################################################
 */

/** Tipos que carregam significado conversacional. Todo o resto e metadado. */
export const SEMANTIC_TYPES = new Set(['assistant', 'user', 'system']);

/**
 * Tipos anexados DEPOIS do fato. A ultima linha fisica do arquivo costuma ser
 * um destes, e ela nao diz nada sobre o estado da sessao.
 */
export const METADATA_TYPES = new Set([
  'atis-latch', 'bridge-session', 'ai-title', 'last-prompt', 'mode',
  'permission-mode', 'queue-operation', 'pr-link', 'cost-state',
  'attachment', 'file-history-snapshot', 'file-history-delta',
]);

/** Parse tolerante: linha invalida vira null em vez de derrubar o tailer. */
export function parseLine(raw) {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw; // BOM defensivo
  const trimmed = text.trim();                                     // \r defensivo
  if (!trimmed || trimmed[0] !== '{') return null;
  try {
    const obj = JSON.parse(trimmed);
    return obj && typeof obj.type === 'string' ? obj : null;
  } catch {
    return null;
  }
}

/** Linhas de sistema/companion que nao sao fala real do usuario. */
export function isNoise(entry) {
  return entry.isMeta === true || entry.turnCompanion === true;
}

/** O registro conta para derivar estado? */
export function isSemantic(entry) {
  return SEMANTIC_TYPES.has(entry.type) && !isNoise(entry);
}

/** Blocos de conteudo de uma mensagem, sempre como array. */
export function contentBlocks(entry) {
  const content = entry?.message?.content;
  if (Array.isArray(content)) return content;
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  return [];
}

/** Prompt humano de verdade (nao tool_result, nao injecao de sistema). */
export function isHumanPrompt(entry) {
  if (entry.type !== 'user' || isNoise(entry)) return false;
  if (entry.origin?.kind === 'human') return true;
  // fallback: content string cru e sem tool_result
  return typeof entry.message?.content === 'string';
}

/** Extrai texto legivel de uma entrada user humana, sem as tags de comando. */
export function humanPromptText(entry) {
  const raw = typeof entry.message?.content === 'string'
    ? entry.message.content
    : contentBlocks(entry).filter(b => b.type === 'text').map(b => b.text).join('\n');
  if (!raw) return '';
  return raw
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, '')
    .replace(/<command-name>([\s\S]*?)<\/command-name>/g, '$1')
    .replace(/<command-args>[\s\S]*?<\/command-args>/g, '')
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .trim();
}

/** Resumo curto do input de uma ferramenta, para o card. */
export function summarizeToolInput(name, input) {
  if (!input || typeof input !== 'object') return '';
  const pick = (...keys) => {
    for (const k of keys) if (typeof input[k] === 'string' && input[k]) return input[k];
    return '';
  };
  let s = '';
  switch (name) {
    case 'Bash':      s = pick('command'); break;
    case 'Read': case 'Write': case 'Edit': case 'NotebookEdit':
                      s = pick('file_path', 'notebook_path'); break;
    case 'Grep':      s = pick('pattern'); break;
    case 'Glob':      s = pick('pattern'); break;
    case 'Task': case 'Agent':
                      s = pick('description', 'prompt'); break;
    case 'WebFetch':  s = pick('url'); break;
    case 'WebSearch': s = pick('query'); break;
    case 'Skill':     s = pick('skill'); break;
    default:          s = pick('description', 'command', 'file_path', 'pattern', 'query', 'url');
  }
  s = String(s).replace(/\s+/g, ' ').trim();
  return s.length > 120 ? s.slice(0, 117) + '...' : s;
}
