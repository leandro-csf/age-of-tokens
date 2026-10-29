import { config } from '../config.js';

/**
 * Acumulador de tokens com deduplicacao.
 *
 * Cada bloco de conteudo de uma resposta vira uma linha `assistant` propria,
 * com o MESMO message.id e apiBlockIndex 0,1,2... Somar `usage` sem deduplicar
 * por message.id triplica os tokens.
 */
export function createTokenAccumulator() {
  const seen = new Set();
  const ring = [];
  return {
    totals: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, thinking: 0 },

    add(entry) {
      const usage = entry?.message?.usage;
      const id = entry?.message?.id || entry?.requestId;
      if (!usage || !id || seen.has(id)) return false;

      seen.add(id);
      ring.push(id);
      // message.id so se repete em linhas adjacentes: ring pequeno basta
      if (ring.length > config.state.dedupRingSize) seen.delete(ring.shift());

      this.totals.input        += usage.input_tokens || 0;
      this.totals.output       += usage.output_tokens || 0;
      this.totals.cacheRead    += usage.cache_read_input_tokens || 0;
      this.totals.cacheCreation += usage.cache_creation_input_tokens || 0;
      this.totals.thinking     += usage.output_tokens_details?.thinking_tokens || 0;
      return true;
    },
  };
}

/** Custo em USD so existe na linha type:"cost-state" — nao ha custo por linha. */
export function parseCostState(entry) {
  if (entry.type !== 'cost-state') return null;
  return {
    totalCostUSD: entry.totalCostUSD || 0,
    totalDurationMs: entry.totalDuration || 0,
    totalApiDurationMs: entry.totalAPIDuration || 0,
    linesAdded: entry.totalLinesAdded || 0,
    linesRemoved: entry.totalLinesRemoved || 0,
    startTime: entry.startTime || null,
    modelUsage: entry.modelUsage || {},
  };
}
