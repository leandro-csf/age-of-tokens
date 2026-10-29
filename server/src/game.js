import { createIngest } from '../../ingest/src/services/ingest.js';
import { emptyState } from '../../ingest/src/services/state.js';
import { newState, applyEvent, step, summary } from '../../sim/src/index.js';
import { createStore, STATE_VERSION, StaleWriterError, RegressionError } from './store.js';

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

export function createGame({ projectsDir, saveFile, baseline = 'now', store = createStore(saveFile) }) {
  // Lanca NewerVersionError se o save e de uma versao mais nova (nada e sobrescrito).
  const saved = store.load();
  const ingestState = saved ? { ...emptyState(), ...saved.ingest } : emptyState();
  let sim = saved?.sim ?? newState();
  let dirty = false;
  let halted = null;           // motivo, se uma trava de seguranca parou as gravacoes
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
      built: sim.built,   // predios por id (a tela desenha a aldeia com isso)
      units: sim.units,   // unidades por id
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

    /**
     * Grava o save se algo mudou. Devolve true se gravou.
     * Se uma trava de seguranca recusar (outro processo gravou depois, ou a renda do disco e maior),
     * as gravacoes PARAM (o jogo segue servindo) e o erro e lancado uma vez.
     */
    save() {
      if (!dirty || halted) return false;
      try {
        store.save({ version: STATE_VERSION, ingest: ingestState, sim });
      } catch (err) {
        if (err instanceof StaleWriterError || err instanceof RegressionError) halted = err.message;
        throw err;
      }
      dirty = false;
      return true;
    },

    /** Situacao do armazenamento (como carregou, numero de gravacao, se parou). */
    saveInfo: () => ({ ...store.report, seq: store.seq, halted }),

    view,
    snapshot: () => ({ ...view(), state: sim }),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
