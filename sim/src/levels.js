import { LEVEL_BASE, LEVEL_RATIO } from './rules.js';

/** Renda vitalicia minima para o nivel n. */
export function levelThreshold(n) {
  return LEVEL_BASE * Math.pow(LEVEL_RATIO, n);
}

/** Maior nivel n com R >= L(n); abaixo de L(0) e nivel 0. */
export function levelFromIncome(R) {
  if (!(R >= LEVEL_BASE)) return 0;
  let n = Math.floor(Math.log(R / LEVEL_BASE) / Math.log(LEVEL_RATIO));
  // corrige erro de ponto flutuante nas bordas
  while (levelThreshold(n + 1) <= R) n++;
  while (n > 0 && levelThreshold(n) > R) n--;
  return n;
}
