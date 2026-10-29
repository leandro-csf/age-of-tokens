// Planta urbana da aldeia. Puro (sem DOM): roda no navegador e nos testes do Node.
//
// O mapa e uma grade de celulas. Quarteiroes de 2x2 celulas separados por ruas de
// 1 celula (rua = celula cujo x OU y e congruente a 2 mod 3). O centro urbano (2x2)
// ocupa o quarteirao (0,0). Cada predio tem um lote FIXO e deterministico: o
// n-esimo predio de um tipo sempre cai no mesmo lugar, nao importa a ordem em que o
// decisor os construiu. Os predios grandes (2x2) ocupam um quarteirao inteiro.

export const BLOCK = 3;
export const BIG = new Set(['castelo', 'catedral', 'maravilha']);
const SLOT_ORDER = [[0, 0], [1, 1], [1, 0], [0, 1]];

const mod = (a, m) => ((a % m) + m) % m;
export const footprint = id => (BIG.has(id) ? 2 : 1);
export const isStreet = (gx, gy) => mod(gx, BLOCK) === 2 || mod(gy, BLOCK) === 2;

/** Quarteiroes em aneis ao redor do centro, cada anel em ordem angular. (0,0) e o centro urbano. */
export function blockOrder(count) {
  const out = [];
  for (let ring = 1; out.length < count; ring++) {
    const ring_ = [];
    for (let bx = -ring; bx <= ring; bx++) {
      for (let by = -ring; by <= ring; by++) {
        if (Math.max(Math.abs(bx), Math.abs(by)) === ring) ring_.push([bx, by]);
      }
    }
    ring_.sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
    out.push(...ring_);
  }
  return out.slice(0, count);
}

/** plan = por era, lista de { id, count } (mesma ordem do conteudo). Expande em { id, k }. */
export function expandPlan(plan) {
  const seen = {};
  const seq = [];
  for (const era of plan) {
    for (const { id, count } of era) {
      for (let i = 0; i < count; i++) {
        seen[id] = seen[id] ?? 0;
        seq.push({ id, k: seen[id]++ });
      }
    }
  }
  return seq;
}

/** Posicao (celula do canto, tamanho) de TODOS os predios do plano. */
export function layoutAll(plan) {
  const seq = expandPlan(plan);
  const blocks = blockOrder(seq.length + 4);
  let bi = 0;
  let small = null;
  let used = 0;
  const placed = [];
  for (const { id, k } of seq) {
    const n = footprint(id);
    if (n === 2) {
      const [bx, by] = blocks[bi++];
      placed.push({ id, k, n, gx: BLOCK * bx, gy: BLOCK * by, bx, by });
    } else {
      if (!small || used === 4) { small = blocks[bi++]; used = 0; }
      const [sx, sy] = SLOT_ORDER[used++];
      placed.push({ id, k, n: 1, gx: BLOCK * small[0] + sx, gy: BLOCK * small[1] + sy, bx: small[0], by: small[1] });
    }
  }
  return placed;
}

export const TOWN_CENTER = { id: 'centro', k: 0, n: 2, gx: 0, gy: 0, bx: 0, by: 0 };

/** Predios que ja existem: os `built[id]` primeiros de cada tipo, mais o centro urbano. */
export function visible(placed, built) {
  return [TOWN_CENTER, ...placed.filter(b => b.k < (built[b.id] || 0))];
}

/** Ilha: caixa de celulas que cobre os quarteiroes ocupados, as ruas externas e 1 celula de grama. */
export function island(buildings) {
  let minB = 0, maxB = 0, minC = 0, maxC = 0;
  for (const b of buildings) {
    minB = Math.min(minB, b.bx); maxB = Math.max(maxB, b.bx);
    minC = Math.min(minC, b.by); maxC = Math.max(maxC, b.by);
  }
  return {
    x0: BLOCK * minB - 2, x1: BLOCK * maxB + 3,
    y0: BLOCK * minC - 2, y1: BLOCK * maxC + 3,
  };
}

/** Celula de rua de onde se "acessa" um predio (para aldeoes irem trabalhar nele). */
export function accessCell(b) {
  const cells = [];
  for (let i = -1; i <= b.n; i++) {
    cells.push([b.gx + i, b.gy - 1], [b.gx + i, b.gy + b.n], [b.gx - 1, b.gy + i], [b.gx + b.n, b.gy + i]);
  }
  // prefere a rua do lado de frente (maior x+y), que e a que o jogador enxerga
  return cells.filter(([x, y]) => isStreet(x, y)).sort((a, c) => (c[0] + c[1]) - (a[0] + a[1]))[0] || [2, 2];
}
