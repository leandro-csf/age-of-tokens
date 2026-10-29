import { ERAS } from './content.js';
import { levelFromIncome } from './levels.js';
import {
  RESOURCES, TOKENS_PER_UNIT, TECH_BONUS, modelMult,
  BASE_POP_CAP, HOUSE_POP, START_VILLAGERS, WORK_PER_BUILD, LOOT_PER_FACTOR, PRESTIGE_LEVEL, PRESTIGE_BONUS,
} from './rules.js';

/*
 * Motor puro: nenhuma funcao toca disco, rede ou relogio. Cada funcao publica
 * recebe um estado e devolve um NOVO estado (o de entrada nunca e alterado).
 * O estado e JSON puro, entao serializa direto para o save.
 */

export function newState() {
  const zero = () => Object.fromEntries(RESOURCES.map(r => [r, 0]));
  return {
    version: 2,
    prestige: 0,      // quantas aldeias ja viraram lenda
    legacy: 0,        // renda das aldeias anteriores (a renda vitalicia = legacy + renda desta aldeia)
    era: 0,
    res: zero(),      // estoque (gasta)
    earned: zero(),   // renda DESTA aldeia por recurso (zera no prestigio; o nivel vem daqui)
    raw: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, thinking: 0 },
    built: {},        // predios por id
    units: { aldeao: START_VILLAGERS },
    techs: [],
    work: 0,          // pontos de obra disponiveis
    wonder: false,
    sessions: 0,
    subagents: 0,
    tick: 0,
    focus: 'food',    // recurso para onde os aldeoes estao indo (so visual)
  };
}

// ---------- derivados ----------

export function income(state) {
  return RESOURCES.reduce((n, r) => n + state.earned[r], 0);
}
/** Renda de todas as aldeias, a atual e as que viraram lenda: a medida para comparar jogadores. */
export function lifetimeIncome(state) {
  return (state.legacy || 0) + income(state);
}
/** Multiplicador de producao dos prestigios. */
export const prestigeMult = state => 1 + PRESTIGE_BONUS * (state.prestige || 0);
export function pop(state) {
  return Object.values(state.units).reduce((n, v) => n + v, 0);
}
export function popCap(state) {
  return BASE_POP_CAP + HOUSE_POP * (state.built.casa || 0);
}
export function level(state) {
  return levelFromIncome(income(state));
}
export function summary(state) {
  return {
    era: ERAS[state.era].name, eraIndex: state.era, level: level(state), income: income(state),
    pop: pop(state), popCap: popCap(state), buildings: Object.values(state.built).reduce((n, v) => n + v, 0),
    wonder: state.wonder,
    prestige: state.prestige || 0,
    lifetimeIncome: lifetimeIncome(state),
    prestigeBonus: PRESTIGE_BONUS * (state.prestige || 0),
  };
}

export function costOf(item, eraIndex) {
  const f = ERAS[eraIndex].factor;
  return Object.fromEntries(Object.entries(item.cost).map(([r, v]) => [r, v * f]));
}

function canAfford(res, cost) {
  return Object.entries(cost).every(([r, v]) => res[r] >= v);
}
function pay(res, cost) {
  for (const [r, v] of Object.entries(cost)) res[r] -= v;
}

// ---------- eventos da ingestao ----------

function techCount(state, resource) {
  let n = 0;
  for (const e of ERAS) for (const t of e.techs) if (t.bonus === resource && state.techs.includes(t.id)) n++;
  return n;
}

function earn(s, resource, amount) {
  s.res[resource] += amount;
  s.earned[resource] += amount;
}

/** Aplica um evento da ingestao (tokens, tool, session:new, subagent:new). */
export function applyEvent(prev, ev) {
  const s = structuredClone(prev);
  switch (ev?.type) {
    case 'tokens': {
      const m = modelMult(ev.model);
      const input = ev.input || 0, output = ev.output || 0, cacheRead = ev.cacheRead || 0;
      const cacheCreation = ev.cacheCreation || 0, thinking = ev.thinking || 0;
      s.raw.input += input; s.raw.output += output; s.raw.cacheRead += cacheRead;
      s.raw.cacheCreation += cacheCreation; s.raw.thinking += thinking;
      const base = {
        food: output / TOKENS_PER_UNIT.food,
        wood: cacheRead / TOKENS_PER_UNIT.wood,
        stone: (input + cacheCreation) / TOKENS_PER_UNIT.stone,
        gold: thinking / TOKENS_PER_UNIT.gold,
      };
      const pm = prestigeMult(s);
      for (const r of RESOURCES) earn(s, r, base[r] * m * pm * (1 + TECH_BONUS * techCount(s, r)));
      break;
    }
    case 'tool':
      s.work += ev.count ?? 1;
      break;
    case 'session:new':
      s.sessions++;
      // imigrante gratis, se houver vaga
      if (pop(s) < popCap(s)) s.units.aldeao = (s.units.aldeao || 0) + 1;
      break;
    case 'subagent:new': {
      s.subagents++;
      const loot = LOOT_PER_FACTOR * ERAS[s.era].factor * prestigeMult(s);
      earn(s, 'food', loot);
      earn(s, 'wood', loot);
      break;
    }
    default:
      break;
  }
  return s;
}

// ---------- decisor ----------

/** Entradas de plano de uma lista (buildings|units) com alvo acumulado por id, ate a era dada. */
function planList(kind, era) {
  const run = {};
  const out = [];
  for (let e = 0; e <= era; e++) {
    for (const item of ERAS[e][kind]) {
      run[item.id] = (run[item.id] || 0) + item.count;
      out.push({ ...item, era: e, target: run[item.id] });
    }
  }
  return out;
}

function nextUnmet(state, kind, only) {
  const have = kind === 'buildings' ? state.built : state.units;
  return planList(kind, state.era).find(it => (!only || it.id === only) && (have[it.id] || 0) < it.target);
}

function nextTech(state) {
  for (let e = 0; e <= state.era; e++) {
    const t = ERAS[e].techs.find(t => !state.techs.includes(t.id));
    if (t) return { ...t, era: e };
  }
  return null;
}

function workCost(entry) {
  return WORK_PER_BUILD * (entry.era + 1);
}

function tryBuild(s, entry) {
  if (!entry) return null;
  const cost = costOf(entry, entry.era);
  const w = workCost(entry);
  if (s.work < w || !canAfford(s.res, cost)) return null;
  pay(s.res, cost);
  s.work -= w;
  s.built[entry.id] = (s.built[entry.id] || 0) + 1;
  if (entry.id === 'maravilha') s.wonder = true;
  return { type: 'build', id: entry.id };
}

function tryTrain(s) {
  const entry = nextUnmet(s, 'units');
  if (!entry || pop(s) >= popCap(s)) return null;
  const cost = costOf(entry, entry.era);
  if (!canAfford(s.res, cost)) return null;
  pay(s.res, cost);
  s.units[entry.id] = (s.units[entry.id] || 0) + 1;
  return { type: 'train', id: entry.id };
}

function tryResearch(s) {
  const tech = nextTech(s);
  if (!tech) return null;
  const cost = costOf(tech, tech.era);
  if (!canAfford(s.res, cost)) return null;
  pay(s.res, cost);
  s.techs.push(tech.id);
  return { type: 'research', id: tech.id };
}

function tryAdvance(s) {
  const adv = ERAS[s.era].advance;
  if (!adv) return null;
  const buildings = Object.values(s.built).reduce((n, v) => n + v, 0);
  const types = Object.values(s.built).filter(v => v > 0).length;
  if (level(s) < adv.minLevel || buildings < adv.minBuildings || types < adv.minTypes || pop(s) < adv.minPop) return null;
  const cost = Object.fromEntries(Object.entries(adv.cost).map(([r, v]) => [r, v * ERAS[s.era].factor]));
  if (!canAfford(s.res, cost)) return null;
  pay(s.res, cost);
  s.era++;
  return { type: 'advance', id: ERAS[s.era].id };
}

/** Recurso mais escasso frente ao proximo gasto (so animacao: para onde os aldeoes vao). */
function pickFocus(s) {
  const wants = [nextUnmet(s, 'buildings'), nextUnmet(s, 'units'), nextTech(s)].filter(Boolean);
  let best = 'food', bestRatio = Infinity;
  for (const r of RESOURCES) {
    let need = 0;
    for (const w of wants) need = Math.max(need, costOf(w, w.era)[r] || 0);
    if (need === 0) continue;
    const ratio = s.res[r] / need;
    if (ratio < bestRatio) { bestRatio = ratio; best = r; }
  }
  return best;
}

/**
 * Um passo do decisor: executa NO MAXIMO uma acao. Ordem fixa (a primeira que
 * se aplica e e paga vence), identica para todos os jogadores:
 *  1 populacao no teto -> casa   2 treinar   3 (foco visual)   4 pesquisar
 *  5 avancar de era              6 proximo predio
 * Nos passos 1, 2 e 6 so a PROXIMA entrada da lista conta: se nao da para
 * pagar, a aldeia economiza em vez de pular para algo mais barato.
 */
export function step(prev) {
  // a aldeia que cumpriu a lenda vira lenda antes de qualquer outra coisa
  if (canPrestige(prev)) { const next = prestige(prev); return { state: next, action: { type: 'prestige', id: next.prestige } }; }
  const s = structuredClone(prev);
  s.tick++;
  s.focus = pickFocus(s);

  let action = null;
  if (pop(s) >= popCap(s)) action = tryBuild(s, nextUnmet(s, 'buildings', 'casa'));
  action ??= tryTrain(s);
  action ??= tryResearch(s);
  action ??= tryAdvance(s);
  action ??= tryBuild(s, nextUnmet(s, 'buildings'));
  return { state: s, action: action || { type: 'idle' } };
}

/** A aldeia pode virar lenda? Maravilha erguida E nivel da aldeia 40. */
export function canPrestige(state) {
  return state.wonder === true && level(state) >= PRESTIGE_LEVEL;
}

/**
 * A aldeia vira lenda e nasce outra. Zera recursos, predios, unidades, pesquisas, era e o nivel;
 * guarda os totais de tokens, sessoes, subagentes, os prestigios e a renda vitalicia (em `legacy`).
 */
export function prestige(prev) {
  const s = newState();
  s.prestige = (prev.prestige || 0) + 1;
  s.legacy = lifetimeIncome(prev);
  s.raw = { ...prev.raw };
  s.sessions = prev.sessions;
  s.subagents = prev.subagents;
  s.tick = prev.tick;
  return s;
}
