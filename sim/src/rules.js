// Constantes das regras (docs/REGRAS.md). Mudar aqui muda o jogo para todos.

export const RESOURCES = ['food', 'wood', 'stone', 'gold'];

// Tokens -> recursos: quantos tokens valem 1 unidade do recurso.
export const TOKENS_PER_UNIT = {
  food: 100,     // output
  wood: 20000,   // cache read
  stone: 2000,   // input + cache creation
  gold: 50,      // thinking
};

export const MODEL_MULT = { opus: 1.5, sonnet: 1, haiku: 0.5 };

export function modelMult(model) {
  const m = String(model || '').toLowerCase();
  if (m.includes('opus')) return MODEL_MULT.opus;
  if (m.includes('haiku')) return MODEL_MULT.haiku;
  return MODEL_MULT.sonnet; // sonnet e qualquer desconhecido
}

// Cada tech da +5% de producao do seu recurso.
export const TECH_BONUS = 0.05;

// Nivel da aldeia: L(n) = LEVEL_BASE * LEVEL_RATIO^n, sobre a renda vitalicia.
export const LEVEL_BASE = 5000;
export const LEVEL_RATIO = 1.25;

// Aldeia: capacidade base (centro urbano) e por casa.
export const BASE_POP_CAP = 15;
export const HOUSE_POP = 5;
export const START_VILLAGERS = 3;

// Pontos de obra por construcao: WORK_PER_BUILD * (era do predio + 1).
export const WORK_PER_BUILD = 10;

// Saque de um explorador (subagente): LOOT_PER_FACTOR * fator da era, em comida e madeira.
export const LOOT_PER_FACTOR = 10;

// Participacao observada de cada recurso na renda (usada so para dimensionar custos).
export const INCOME_SHARE = { food: 0.37, wood: 0.36, stone: 0.09, gold: 0.18 };

// ---------- prestigio ----------
// Ao erguer a Maravilha E chegar ao nivel da aldeia 40, a aldeia vira lenda: nasce outra, do zero,
// com um bonus PERMANENTE de producao. O nivel e sempre o da aldeia ATUAL (a mesma escada 0-40 se
// repete); a renda vitalicia (soma de todas as aldeias) segue crescendo para comparar jogadores.
export const PRESTIGE_LEVEL = 40;
export const PRESTIGE_BONUS = 0.10;   // +10% de producao por prestigio (aditivo)
export const BIOMES = 5;              // 5 cores de grama no pacote de arte: bioma = prestigio mod 5
