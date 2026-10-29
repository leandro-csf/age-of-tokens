import fs from 'node:fs';
import { createIngest } from '../../ingest/src/services/ingest.js';
import { emptyState, saveState } from '../../ingest/src/services/state.js';
import { newState, applyEvent, step, summary } from '../../sim/src/index.js';

/*
 * Junta ingestao + motor + save. Nao tem timers: quem chama decide quando
 * fazer poll/step/save (ver index.js), o que deixa tudo testavel.
 *
 * O save e UM arquivo com o estado da ingestao (offsets, ids ja contados) e o
 * do motor (recursos, predios...), gravado de forma atomica. Os eventos da
 * ingestao sao aplicados ao motor no mesmo instante em que o offset avanca
 * (callback onEvent, sincrono), entao qualquer save enxerga os dois lados
 * coerentes: nada e contado duas vezes nem se perde numa queda.
 */

const SAVE_VERSION = 1;

export function loadSave(file) {
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (j?.version === SAVE_VERSION && j.sim && j.ingest) return j;
  } catch { /* sem save ou corrompido: comeca do zero */ }
  return null;
}

export function createGame({ projectsDir, saveFile, baseline = 'now' }) {
  const saved = loadSave(saveFile);
  const ingestState = saved ? { ...emptyState(), ...saved.ingest } : emptyState();
  let sim = saved?.sim ?? newState();
  let dirty = false;
  const listeners = new Set();

  function emit(type, data) {
    for (const fn of listeners) {
      try { fn({ type, data }); } catch { /* ouvinte ruim nao derruba o jogo */ }
    }
  }

  function view() {
    return {
      summary: summary(sim),
      res: sim.res,
      raw: sim.raw,
      focus: sim.focus,
      work: sim.work,
      techs: sim.techs.length,
      tick: sim.tick,
    };
  }

  const ing = createIngest({
    projectsDir,
    state: ingestState,
    baseline,
    onEvent: ev => {
      sim = applyEvent(sim, ev);
      dirty = true;
      emit('ingest', ev);
    },
  });

  return {
    /** Le o que o Claude Code gravou desde a ultima vez e aplica ao motor. */
    async pollOnce() {
      const { events, dirty: d } = await ing.poll();
      if (d) dirty = true;
      if (events.length) emit('state', view());
      return events;
    },

    /** Um passo do decisor da aldeia. Devolve a acao (ou { type: 'idle' }). */
    stepOnce() {
      const r = step(sim);
      sim = r.state;
      if (r.action.type !== 'idle') {
        dirty = true;
        emit('action', r.action);
        emit('state', view());
      }
      return r.action;
    },

    /** Grava o save se algo mudou. Devolve true se gravou. */
    save() {
      if (!dirty) return false;
      saveState(saveFile, { version: SAVE_VERSION, savedAt: Date.now(), ingest: ingestState, sim });
      dirty = false;
      return true;
    },

    view,
    snapshot: () => ({ ...view(), state: sim }),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
