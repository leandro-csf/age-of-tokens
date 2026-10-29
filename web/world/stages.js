// A aldeia como NUCLEO QUE EVOLUI por estagios, em vez de mostrar os 86 predios do motor.
// Puro (sem DOM): roda no navegador e nos testes.
//
// O estagio vem do NIVEL da aldeia (medida fixa e comparavel entre jogadores). A simulacao por
// baixo continua construindo tudo; a tela mostra so os marcos. Unidades: px do palco 1340x800.
// Cada elemento tem `from` (primeiro estagio em que existe) e, opcionalmente, `until` (deixa de
// existir naquele estagio: a fogueira some quando o castelo chega). x,y = centro da BASE.

export const TILE = 64;
export const STAGE_W = 1340;
export const STAGE_H = 800;
export const ISLAND = { x0: 2, y0: 2, x1: 18, y1: 11 };                 // tiles de grama, inclusive (17 x 10)
export const LAND = { x0: 2 * TILE, y0: 2 * TILE, x1: 19 * TILE, y1: 12 * TILE };
export const CENTER = { x: 672, y: 420 };

export const LEVEL_MIN = [0, 3, 6, 10, 14, 18, 20, 24, 28, 30, 35];
export const STAGE_NAMES = [
  'Acampamento', 'Primeira casa', 'Aldeia', 'Vila vigiada', 'Quartel', 'Arqueiros',
  'Castelo', 'Mosteiro', 'Fortaleza', 'Castelo dourado', 'Maravilha',
];
export const LAST_STAGE = LEVEL_MIN.length - 1;

/** Estagio (0..10) para um nivel de aldeia. */
export function stageFor(level) {
  let s = 0;
  for (let i = 0; i < LEVEL_MIN.length; i++) if (level >= LEVEL_MIN[i]) s = i;
  return s;
}

// Pegada no chao (largura x altura, px): usada para nao sobrepor e para os aldeoes contornarem.
export const FOOT = {
  fogueira: [56, 44], casa: [104, 84], pasto: [150, 100], torre: [100, 90], ouro: [130, 90],
  quartel: [150, 100], arqueria: [150, 100], castelo: [260, 150], mosteiro: [135, 95], catedral: [135, 95],
};

// sprite: nome no pacote ('House1'...), cor da faccao, scale; kind: como a cena desenha.
export const ELEMENTS = [
  { id: 'fogueira', kind: 'fogueira', x: 672, y: 480, from: 0, until: 6 },
  { id: 'casa1', kind: 'casa', sprite: 'House1', color: 'Blue', x: 530, y: 585, from: 1 },
  { id: 'casa2', kind: 'casa', sprite: 'House2', color: 'Blue', x: 390, y: 600, from: 2 },
  { id: 'pasto', kind: 'pasto', x: 830, y: 615, from: 0 },
  { id: 'casa3', kind: 'casa', sprite: 'House3', color: 'Blue', x: 665, y: 610, from: 3 },
  { id: 'torre1', kind: 'torre', sprite: 'Tower', color: 'Blue', x: 330, y: 480, from: 3 },
  { id: 'ouro', kind: 'ouro', x: 1030, y: 628, from: 3 },
  { id: 'quartel', kind: 'predio', sprite: 'Barracks', color: 'Blue', x: 978, y: 345, scale: 0.85, from: 4 },
  { id: 'arqueria', kind: 'predio', sprite: 'Archery', color: 'Blue', x: 366, y: 345, scale: 0.85, from: 5 },
  { id: 'castelo', kind: 'predio', sprite: 'Castle', color: 'Blue', x: 672, y: 380, from: 6, until: 9 },
  { id: 'mosteiro', kind: 'predio', sprite: 'Monastery', color: 'Blue', x: 1010, y: 505, scale: 0.9, from: 7, until: 10 },
  { id: 'torre2', kind: 'torre', sprite: 'Tower', color: 'Blue', x: 470, y: 455, scale: 0.8, foot: [80, 72], from: 8 },
  { id: 'torre3', kind: 'torre', sprite: 'Tower', color: 'Blue', x: 874, y: 455, scale: 0.8, foot: [80, 72], from: 8 },
  { id: 'castelo_ouro', kind: 'predio', sprite: 'Castle', color: 'Yellow', x: 672, y: 380, from: 9 },
  { id: 'catedral', kind: 'predio', sprite: 'Monastery', color: 'Purple', x: 1010, y: 505, scale: 0.9, from: 10 },
  { id: 'braseiro1', kind: 'braseiro', x: 470, y: 455, from: 10 },
  { id: 'braseiro2', kind: 'braseiro', x: 874, y: 455, from: 10 },
];

// pegada de cada elemento (alguns usam a de outro tipo)
const FOOT_OF = { casa1: 'casa', casa2: 'casa', casa3: 'casa', torre1: 'torre', torre2: 'torre', torre3: 'torre', castelo_ouro: 'castelo', braseiro1: null, braseiro2: null };
export function footOf(e) {
  if (e.foot) return e.foot;
  const key = e.id in FOOT_OF ? FOOT_OF[e.id] : e.id;
  return key ? FOOT[key] : null;
}

// a ilha cresceu: abre 12% na horizontal em torno do centro e desce 30 px (as coordenadas acima sao o desenho base)
const SPREAD = 1.12, DROP = 30;
for (const e of ELEMENTS) { e.x = Math.round(672 + (e.x - 672) * SPREAD); e.y += DROP; }

export const elementsAt = stage => ELEMENTS.filter(e => e.from <= stage && (e.until === undefined || stage < e.until));
export const rectOf = e => { const f = footOf(e); return f && { x0: e.x - f[0] / 2, x1: e.x + f[0] / 2, y0: e.y - f[1], y1: e.y }; };

// Quantas figuras de cada tipo o estagio mostra (o jogo pode ter mais; a tela so mostra uma amostra).
export const CROWD = {
  pawn:    [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14],
  warrior: [0, 0, 0, 0, 2, 2, 4, 4, 5, 6, 6],
  archer:  [0, 0, 0, 0, 0, 2, 2, 3, 3, 4, 4],
  lancer:  [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 3],
  monk:    [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2],
};
export const crowdCaps = stage => Object.fromEntries(Object.entries(CROWD).map(([k, v]) => [k, v[stage]]));

/** Onde os aldeoes depositam a carga: perto da fogueira ate o castelo, depois na porta dele. */
export const depositAt = stage => (stage < 6 ? { x: 672, y: 515 + 30 } : { x: 672, y: 405 + 30 });

// ---------- arvores: faixa de 2 tiles na borda da ilha ----------
export const hash = (a, b = 0) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; };

export function treeField() {
  const out = [];
  for (let ty = ISLAND.y0; ty <= ISLAND.y1; ty++) {
    for (let tx = ISLAND.x0; tx <= ISLAND.x1; tx++) {
      const dl = tx - ISLAND.x0, dr = ISLAND.x1 - tx, dt = ty - ISLAND.y0, db = ISLAND.y1 - ty;
      const rim = Math.min(dl, dr, dt, db);
      if (rim > 1) continue;
      // so a faixa da borda, rala; a 2a faixa so aparece de vez em quando nas laterais.
      // Pinheiros tem 256 px de altura e escondem o que estiver atras: o meio da borda de baixo fica livre.
      let chance = rim === 0 ? 48 : (Math.min(dl, dr) === 1 ? 14 : 0);
      if (db === 0 && dl > 3 && dr > 3) chance = 0;
      const h = hash(tx + 7, ty + 13);
      if (h % 100 >= chance) continue;
      const x = tx * TILE + 14 + ((h >>> 8) % 36);
      const y = ty * TILE + 40 + ((h >>> 16) % 24);
      out.push({ x, y, type: 1 + ((h >>> 4) % 4), phase: (h >>> 12) % 8, stump: (h >>> 20) % 9 === 0 });
    }
  }
  return out.sort((a, b) => a.y - b.y);
}

/** Tile da grama no tileset (bloco 3x3 de Tilemap_color1), ou null para agua. */
export function grassTile(tx, ty) {
  if (tx < ISLAND.x0 || tx > ISLAND.x1 || ty < ISLAND.y0 || ty > ISLAND.y1) return null;
  return [tx === ISLAND.x0 ? 0 : tx === ISLAND.x1 ? 2 : 1, ty === ISLAND.y0 ? 0 : ty === ISLAND.y1 ? 2 : 1];
}

// ---------- mar ----------
export const SEA_ROCKS = [
  { x: 70, y: 240, v: 0 }, { x: 80, y: 610, v: 1 }, { x: 1262, y: 290, v: 2 },
  { x: 1272, y: 640, v: 3 }, { x: 380, y: 788, v: 1 }, { x: 930, y: 60, v: 2 },
];
export const DUCK = { x: 60, y: 430 };
