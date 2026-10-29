import { ERAS } from './content.js';
import { RESOURCES, INCOME_SHARE } from './rules.js';
import { levelThreshold } from './levels.js';

/** Renda ganha DENTRO da era e (niveis 10e .. 10(e+1); a ultima vai de 30 a 40). */
export function eraIncome(e) {
  const from = e === 0 ? 0 : levelThreshold(10 * e);
  return levelThreshold(10 * (e + 1)) - from;
}

/** Custo total do conteudo da era (predios + unidades + techs + avanco), ja com fator. Por recurso. */
export function eraSpend(e) {
  const era = ERAS[e];
  const total = Object.fromEntries(RESOURCES.map(r => [r, 0]));
  const add = (cost, n) => { for (const r of RESOURCES) total[r] += (cost[r] || 0) * n * era.factor; };
  for (const b of era.buildings) add(b.cost, b.count);
  for (const u of era.units) add(u.cost, u.count);
  for (const t of era.techs) add(t.cost, 1);
  if (era.advance) add(era.advance.cost, 1);
  return total;
}

/** Relatorio de orcamento: gasto total / renda e gasto por recurso / renda desse recurso. */
export function eraBudget(e) {
  const spend = eraSpend(e);
  const income = eraIncome(e);
  const sum = RESOURCES.reduce((n, r) => n + spend[r], 0);
  const perResource = Object.fromEntries(RESOURCES.map(r => [r, spend[r] / (income * INCOME_SHARE[r])]));
  return { income, spend, ratio: sum / income, perResource };
}
