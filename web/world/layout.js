// Layout do mundo visto de cima (Tiny Swords). Puro: sem DOM, roda no navegador e nos testes.
//
// Unidades: pixels do mundo (tile = 64). Um sprite e ancorado no centro da BASE (x, y).
// O mundo e uma ilha retangular de grama cercada de agua. Cada predio do jogo tem uma
// posicao FIXA e deterministica: o n-esimo de cada tipo cai sempre no mesmo lugar,
// qualquer que seja a ordem em que o decisor os construiu.

export const TILE = 64;
export const WORLD_W = 42;           // tiles
export const WORLD_H = 25;
export const ISLAND = { x0: 3, y0: 2, x1: 38, y1: 22 };   // tiles de grama, inclusive
export const CENTER = { x: 21 * TILE, y: 12.5 * TILE };

// Zona onde a vila cresce (dentro da faixa de floresta e do anel de muralha), em px.
export const TOWN = { x0: 5 * TILE, y0: 4 * TILE, x1: 37 * TILE, y1: 21 * TILE };
// Anel da muralha: um retangulo logo fora da vila.
export const WALL = { x0: 4.55 * TILE, y0: 3.55 * TILE, x1: 37.45 * TILE, y1: 21.45 * TILE };

// Pegada no chao (largura x altura, px) de cada tipo, usada para nao sobrepor.
export const FOOT = {
  centro: [300, 150], casa: [104, 84], fazenda: [128, 100], serraria: [104, 84],
  quartel: [176, 120], ferraria: [104, 84], mercado: [104, 84], universidade: [104, 84],
  mosteiro: [160, 110], castelo: [310, 160], catedral: [160, 110], maravilha: [380, 195], mina: [150, 100],
};
const MARGIN = 42;                    // folga entre pegadas: por ali os aldeoes passam (corredor livre >= 2 celulas de 16 px)
const RING = new Set(['muralha', 'torre']);   // vao no anel da muralha, nao na vila
const MINES = new Set(['mina']);              // vao nas jazidas de ouro

/** Sequencia canonica { id, k } em ordem de era (a mesma do conteudo do motor). */
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

const hash = (a, b = 0) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; };
export { hash };

// ---------- jazidas de ouro e arvores ----------
// Tres jazidas na borda da floresta; "mina k" cai na jazida k, com 2 pedras cada.
export const MINE_SITES = [
  { x: 33.6 * TILE, y: 6.2 * TILE },
  { x: 7.4 * TILE, y: 19.4 * TILE },
  { x: 35.4 * TILE, y: 17.6 * TILE },
];

const inIsland = (tx, ty) => tx >= ISLAND.x0 && tx <= ISLAND.x1 && ty >= ISLAND.y0 && ty <= ISLAND.y1;
const inTown = (px, py) => px >= TOWN.x0 - 64 && px <= TOWN.x1 + 64 && py >= TOWN.y0 - 64 && py <= TOWN.y1 + 64;

/** Arvores: faixa de 2 tiles na beira da ilha, fora da muralha. Deterministico. */
export function treeField() {
  const out = [];
  for (let ty = ISLAND.y0; ty <= ISLAND.y1; ty++) {
    for (let tx = ISLAND.x0; tx <= ISLAND.x1; tx++) {
      const rim = Math.min(tx - ISLAND.x0, ISLAND.x1 - tx, ty - ISLAND.y0, ISLAND.y1 - ty);
      if (rim > 1) continue;
      const h = hash(tx + 7, ty + 13);
      if (h % 100 > (rim === 0 ? 78 : 58)) continue;
      const x = tx * TILE + 14 + ((h >>> 8) % 36);
      const y = ty * TILE + 40 + ((h >>> 16) % 24);
      if (MINE_SITES.some(m => Math.abs(m.x - x) < 120 && Math.abs(m.y - y) < 90)) continue;
      out.push({ x, y, type: 1 + ((h >>> 4) % 4), phase: (h >>> 12) % 8, stump: (h >>> 20) % 9 === 0 });
    }
  }
  // quem esta mais acima desenha antes (ordem por y)
  return out.sort((a, b) => a.y - b.y);
}

// ---------- predios ----------
const overlaps = (a, b) => a.x0 < b.x1 + MARGIN && a.x1 + MARGIN > b.x0 && a.y0 < b.y1 + MARGIN && a.y1 + MARGIN > b.y0;
const rectOf = (id, x, y) => { const [w, h] = FOOT[id]; return { x0: x - w / 2, x1: x + w / 2, y0: y - h, y1: y }; };

// Predios grandes tem lugar reservado ANTES do resto (senao, ultimos da fila, nao achariam vaga).
// Escolhidos para compor a vila: Maravilha ao norte, castelo a oeste, catedral a leste, quarteis ao sul.
export const RESERVED = {
  'maravilha:0': [CENTER.x, TOWN.y0 + 215],
  'castelo:0': [TOWN.x0 + 176, CENTER.y + 25],
  'catedral:0': [TOWN.x1 - 92, CENTER.y - 10],
  'mosteiro:0': [CENTER.x - 480, TOWN.y1 - 8],
  'quartel:0': [CENTER.x + 330, TOWN.y1 - 8],
  'quartel:1': [CENTER.x + 610, TOWN.y1 - 8],
};

/** Pontos candidatos da vila, do centro para fora (mais largo que alto: a tela e paisagem). */
function townLattice() {
  const pts = [];
  for (let y = TOWN.y0 + 40; y <= TOWN.y1; y += 16) {
    for (let x = TOWN.x0 + 40; x <= TOWN.x1 - 40; x += 16) {
      const dx = x - CENTER.x, dy = (y - CENTER.y) * 1.7;
      pts.push({ x, y, d: dx * dx + dy * dy });
    }
  }
  return pts.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
}

/** Posicao de cada ponto do anel de muralha (0..n-1), espalhada: o 1o fica no meio de um lado, etc. */
function wallPoint(i, n) {
  // ordem por inversao de bits: as pecas iniciais ja se espalham pelo anel
  let r = 0;
  for (let b = 0, v = i, bits = Math.ceil(Math.log2(Math.max(2, n))); b < bits; b++, v >>= 1) r = (r << 1) | (v & 1);
  const t = ((r % n) + 0.5) / n;
  const w = WALL.x1 - WALL.x0, h = WALL.y1 - WALL.y0, per = 2 * (w + h);
  let d = t * per;
  if (d < w) return { x: WALL.x0 + d, y: WALL.y0 };
  d -= w; if (d < h) return { x: WALL.x1, y: WALL.y0 + d };
  d -= h; if (d < w) return { x: WALL.x1 - d, y: WALL.y1 };
  d -= w; return { x: WALL.x0, y: WALL.y1 - d };
}

export const TOWERS = [
  { x: WALL.x0, y: WALL.y0 + 14 }, { x: WALL.x1, y: WALL.y0 + 14 },
  { x: WALL.x1, y: WALL.y1 + 14 }, { x: WALL.x0, y: WALL.y1 + 14 },
];

/**
 * Todos os predios do plano com posicao fixa.
 * Devolve [{ id, k, x, y }] (x,y = centro da base). O centro urbano entra primeiro, fixo.
 */
export function layoutAll(plan) {
  const seq = expandPlan(plan);
  const wallCount = seq.filter(s => s.id === 'muralha').length;
  const placedRects = [];
  const out = [];
  const centro = { id: 'centro', k: 0, x: CENTER.x, y: CENTER.y + 55 };
  out.push(centro);
  placedRects.push(rectOf('centro', centro.x, centro.y));
  for (const [key, [x, y]] of Object.entries(RESERVED)) placedRects.push(rectOf(key.split(':')[0], x, y));
  for (const m of MINE_SITES) placedRects.push(rectOf('mina', m.x, m.y));   // as jazidas tambem ocupam lugar
  const lattice = townLattice();

  for (const { id, k } of seq) {
    if (id === 'muralha') { const p = wallPoint(k, wallCount); out.push({ id, k, x: p.x, y: p.y }); continue; }
    if (id === 'torre') { const p = TOWERS[k % TOWERS.length]; out.push({ id, k, x: p.x, y: p.y }); continue; }
    if (MINES.has(id)) { const p = MINE_SITES[k % MINE_SITES.length]; out.push({ id, k, x: p.x, y: p.y }); continue; }
    const fixed = RESERVED[`${id}:${k}`];
    if (fixed) { out.push({ id, k, x: fixed[0], y: fixed[1] }); continue; }
    let placed = null;
    for (const c of lattice) {
      const r = rectOf(id, c.x, c.y);
      if (r.x0 < TOWN.x0 || r.x1 > TOWN.x1 || r.y0 < TOWN.y0 || r.y1 > TOWN.y1) continue;
      if (placedRects.some(o => overlaps(r, o))) continue;
      placed = { id, k, x: c.x, y: c.y, rect: r };
      break;
    }
    if (!placed) throw new Error(`sem espaco para ${id}#${k}`);
    placedRects.push(placed.rect);
    out.push({ id: placed.id, k: placed.k, x: placed.x, y: placed.y });
  }
  return out;
}

/** Predios existentes: os `built[id]` primeiros de cada tipo, mais o centro urbano. */
export function visible(placed, built) {
  return placed.filter(b => b.id === 'centro' || b.k < (built[b.id] || 0));
}

/** Caixa que cobre os predios visiveis (para a camera), em px do mundo. */
export function extent(buildings) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of buildings) {
    // jazidas sao recurso nos cantos da ilha, nao a vila: nao entram no enquadramento da camera
    if (b.id === 'mina') continue;
    const [w, h] = FOOT[b.id] || [64, 64];
    x0 = Math.min(x0, b.x - w / 2); x1 = Math.max(x1, b.x + w / 2);
    y0 = Math.min(y0, b.y - h - 90); y1 = Math.max(y1, b.y);
  }
  return { x0, y0, x1, y1 };
}

// ---------- decoracao do chao: arbustos e pedras nos vaos da vila ----------
/**
 * Pontos de decoracao espalhados pela zona da vila. A cena esconde os que ficam sob um predio
 * existente (o arbusto "some" quando a obra comeca em cima), entao a vila vazia nao fica pelada.
 * Longe do anel de muralha. Deterministico.
 */
export function decorField() {
  const out = [];
  for (let y = TOWN.y0 + 30; y <= TOWN.y1 - 10; y += 80) {
    for (let x = TOWN.x0 + 30; x <= TOWN.x1 - 30; x += 80) {
      const h = hash(x * 3 + 1, y * 5 + 2);
      if (h % 100 > 30) continue;
      const px = x + ((h >>> 8) % 40) - 20, py = y + ((h >>> 16) % 40) - 20;
      if (px < WALL.x0 + 70 || px > WALL.x1 - 70 || py < WALL.y0 + 70 || py > WALL.y1 - 40) continue;
      if (MINE_SITES.some(m => Math.abs(m.x - px) < 160 && Math.abs(m.y - py) < 120)) continue;
      out.push({ x: px, y: py, kind: (h >>> 4) % 5 < 3 ? 'bush' : 'rock', v: (h >>> 12) % 4 });
    }
  }
  return out.sort((a, b) => a.y - b.y);
}

/** O ponto (x, y) esta sob (ou colado em) algum dos predios `buildings`? */
export function underBuilding(p, buildings, margin = 44) {
  return buildings.some(b => {
    const f = FOOT[b.id];
    if (!f) return false;
    return p.x > b.x - f[0] / 2 - margin && p.x < b.x + f[0] / 2 + margin && p.y > b.y - f[1] - margin && p.y < b.y + margin / 2;
  });
}

// ---------- mar: pedras e o patinho ----------
export const SEA_ROCKS = [
  { x: 1.3 * TILE, y: 6.5 * TILE, v: 0 }, { x: 1.8 * TILE, y: 18 * TILE, v: 1 },
  { x: 40.4 * TILE, y: 9 * TILE, v: 2 }, { x: 40.9 * TILE, y: 20 * TILE, v: 3 },
  { x: 14 * TILE, y: 23.9 * TILE, v: 1 }, { x: 30 * TILE, y: 0.9 * TILE, v: 2 },
];
export const DUCK = { x: 1.1 * TILE, y: 12.5 * TILE };

// ---------- terreno: autotile da grama (blocos 3x3 de Tilemap_color1) ----------
/** [coluna, linha] do tile da grama em (tx, ty) no tileset, ou null se for agua. */
export function grassTile(tx, ty) {
  if (!inIsland(tx, ty)) return null;
  const col = tx === ISLAND.x0 ? 0 : tx === ISLAND.x1 ? 2 : 1;
  const row = ty === ISLAND.y0 ? 0 : ty === ISLAND.y1 ? 2 : 1;
  return [col, row];
}

export const isLand = (px, py) => inIsland(Math.floor(px / TILE), Math.floor(py / TILE));
export { inTown };
