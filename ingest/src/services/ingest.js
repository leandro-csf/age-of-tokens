import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { contentBlocks } from '../parsers/line.parser.js';
import { createCursor, readDelta, statOrNull } from './tailer.js';

/**
 * Transforma o que o Claude Code grava em ~/.claude/projects em eventos de jogo.
 *
 * Eventos (onEvent / retorno de poll):
 *  - session:new   { sessionId, slug }       sessao inedita apos o baseline
 *  - subagent:new  { sessionId, agentId }
 *  - tokens        { sessionId, subagent, model, ts, input, output, cacheRead, cacheCreation, thinking }
 *  - tool          { sessionId, subagent, name, ts }
 *
 * `state` e mutavel e serializavel (ver state.js): offsets por arquivo, sessoes
 * conhecidas e um anel de ids ja contados. O chamador persiste quando poll()
 * devolve `dirty`.
 *
 * baseline (so na primeira execucao, state.initialized === false):
 *  - 'now'     : ignora o historico, conta so o que acontecer daqui pra frente
 *  - 'history' : conta tudo que ja existe em disco
 */
export function createIngest({ projectsDir = config.claude.projectsDir, state, baseline = 'now', onEvent }) {
  const cursors = new Map();
  const known = new Set(state.knownSessions);
  const ring = state.recentIds;
  const ringSet = new Set(ring);

  function firstSeen(id) {
    if (ringSet.has(id)) return false;
    ringSet.add(id);
    ring.push(id);
    if (ring.length > config.state.dedupRingSize) ringSet.delete(ring.shift());
    return true;
  }

  function scan() {
    const out = [];
    let slugs = [];
    try { slugs = fs.readdirSync(projectsDir, { withFileTypes: true }); } catch { return out; }
    for (const s of slugs) {
      if (!s.isDirectory()) continue;
      const dir = path.join(projectsDir, s.name);
      let items = [];
      try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const it of items) {
        if (it.isFile() && it.name.endsWith('.jsonl')) {
          out.push({ path: path.join(dir, it.name), sessionId: it.name.slice(0, -6), slug: s.name, subagent: false });
        } else if (it.isDirectory()) {
          const subDir = path.join(dir, it.name, 'subagents');
          let subs = [];
          try { subs = fs.readdirSync(subDir); } catch { continue; }
          for (const f of subs) {
            if (f.endsWith('.jsonl')) {
              out.push({ path: path.join(subDir, f), sessionId: it.name, slug: s.name, subagent: true, agentId: f.slice(0, -6) });
            }
          }
        }
      }
    }
    return out;
  }

  function handle(file, entry, emit) {
    if (entry.type !== 'assistant') return;
    const base = { sessionId: file.sessionId, subagent: file.subagent, ts: entry.timestamp || null };

    const usage = entry.message?.usage;
    const id = entry.message?.id || entry.requestId;
    // Cada bloco de uma resposta e uma linha propria repetindo o mesmo usage.
    if (usage && id && firstSeen(id)) {
      emit({
        type: 'tokens', ...base, model: entry.message.model || null,
        input: usage.input_tokens || 0,
        output: usage.output_tokens || 0,
        cacheRead: usage.cache_read_input_tokens || 0,
        cacheCreation: usage.cache_creation_input_tokens || 0,
        thinking: usage.output_tokens_details?.thinking_tokens || 0,
      });
    }
    for (const b of contentBlocks(entry)) {
      if (b.type === 'tool_use' && b.id && firstSeen(`tu:${b.id}`)) {
        emit({ type: 'tool', ...base, name: b.name || 'unknown' });
      }
    }
  }

  async function poll() {
    const events = [];
    const emit = e => { events.push(e); onEvent?.(e); };
    const files = scan();
    let dirty = false;

    if (!state.initialized) {
      for (const f of files) {
        const st = baseline === 'now' ? await statOrNull(f.path) : null;
        state.files[f.path] = { offset: st ? st.size : 0 };
        known.add(f.sessionId);
      }
      state.initialized = true;
      dirty = true;
    }

    for (const f of files) {
      let rec = state.files[f.path];
      if (!rec) {
        rec = state.files[f.path] = { offset: 0 };
        dirty = true;
        if (f.subagent) {
          emit({ type: 'subagent:new', sessionId: f.sessionId, agentId: f.agentId });
        } else {
          // so o arquivo principal marca a sessao como conhecida; a ordem do
          // readdir pode listar o subagente antes dele
          if (!known.has(f.sessionId)) emit({ type: 'session:new', sessionId: f.sessionId, slug: f.slug });
          known.add(f.sessionId);
        }
      }
      let cursor = cursors.get(f.path);
      if (!cursor) cursors.set(f.path, cursor = createCursor(f.path, rec.offset));

      const { entries } = await readDelta(cursor);
      for (const entry of entries) handle(f, entry, emit);
      if (cursor.committed !== rec.offset) { rec.offset = cursor.committed; dirty = true; }
    }

    state.knownSessions = [...known];
    return { events, dirty };
  }

  return { poll, scan, state };
}
