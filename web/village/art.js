// Arte da aldeia: sprites isometricos gerados por codigo (nenhum arquivo de imagem).
//
// Tile de 12x6 px (proporcao 2:1). Um predio e uma "caixa" isometrica (paredes
// esquerda/direita + topo) com telhado opcional em empena, mais detalhes pixel a
// pixel. Cada sprite e desenhado uma vez num canvas fora da tela e recebe contorno
// escuro de 1px. O ponto de ancoragem (ax, ay) e o canto superior esquerdo do
// losango do chao dentro do sprite.

export const TILE_W = 12;
export const TILE_H = 6;
export const GROUND_H = 3; // espessura da "fatia" de terra da ilha

const OUTLINE = [26, 17, 11, 255];
const PAD = 2;

// ---------- geometria do losango n x n ----------
const profiles = new Map();
function profile(n) {
  if (profiles.has(n)) return profiles.get(n);
  const W = 12 * n, rows = 6 * n;
  const t = new Array(W).fill(Infinity), b = new Array(W).fill(-1);
  for (let r = 0; r < rows; r++) {
    const hw = r < 3 * n ? 2 * (r + 1) : 2 * (6 * n - r);
    for (let x = 6 * n - hw; x < 6 * n + hw; x++) { t[x] = Math.min(t[x], r); b[x] = Math.max(b[x], r); }
  }
  const p = { W, rows, t, b };
  profiles.set(n, p);
  return p;
}

// ---------- primitivas ----------
function rect(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(x, y, w, h); }

/**
 * Caixa isometrica. (ox, oy) = canto sup. esq. do losango do CHAO. Colunas de 1px:
 * topo (ou telhado, com `peak` de altura no meio) e parede (esquerda/direita).
 */
function box(c, n, H, col, ox = 0, oy = 0) {
  const p = profile(n), peak = col.peak || 0;
  for (let x = 0; x < p.W; x++) {
    const left = x < p.W / 2;
    const pk = peak ? Math.round(peak * (1 - Math.abs(x - (p.W / 2 - 0.5)) / (p.W / 2))) : 0;
    const top = col.roofL ? (left ? col.roofL : col.roofR) : col.top;
    rect(c, ox + x, oy - H + p.t[x] - pk, 1, p.b[x] - p.t[x] + 1 + pk, top);
    if (col.eave) rect(c, ox + x, oy - H + p.b[x], 1, 1, col.eave);
    rect(c, ox + x, oy - H + p.b[x] + 1, 1, H, left ? col.left : col.right);
  }
}

/** y da base da parede na coluna x (para pregar portas e janelas na parede certa). */
const wallBottom = (n, x) => profile(n).b[x];

function outline(cv) {
  const ctx = cv.getContext('2d');
  const { width: w, height: h } = cv;
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  dst.data.set(src.data);
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src.data[(y * w + x) * 4 + 3]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (a(x, y) === 0 && (a(x - 1, y) > 0 || a(x + 1, y) > 0 || a(x, y - 1) > 0 || a(x, y + 1) > 0)) {
        dst.data.set(OUTLINE, (y * w + x) * 4);
      }
    }
  }
  ctx.putImageData(dst, 0, 0);
}

function sprite(n, rise, draw) {
  const cv = document.createElement('canvas');
  cv.width = 12 * n + 2 * PAD;
  cv.height = rise + 6 * n + 2 * PAD;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.translate(PAD, PAD + rise);
  draw(c);
  outline(cv);
  return { cv, ax: PAD, ay: PAD + rise, w: cv.width, h: cv.height };
}

// ---------- paleta ----------
const WALL = {
  cream: { left: '#d4c29a', right: '#a8946c', top: '#e8d9b0' },
  stone: { left: '#a3abb0', right: '#7c868c', top: '#c3ccd0' },
  dark: { left: '#6a5f58', right: '#4b423d', top: '#7b6f67' },
  wood: { left: '#a56f3c', right: '#7c5028', top: '#c08a52' },
  white: { left: '#ece6d0', right: '#c4bda4', top: '#f6f1de' },
  gold: { left: '#e6b43c', right: '#b88a22', top: '#f7d36a' },
};
const ROOF = {
  red: { roofL: '#cc5a3c', roofR: '#9c422b', eave: '#6e2c1c' },
  rust: { roofL: '#b8743a', roofR: '#8e552a', eave: '#5e3818' },
  slate: { roofL: '#667f98', roofR: '#4a6279', eave: '#33465a' },
  moss: { roofL: '#6a9460', roofR: '#4e7447', eave: '#35502f' },
  purple: { roofL: '#8e62ac', roofR: '#6c4888', eave: '#4a2f62' },
  blue: { roofL: '#5283ba', roofR: '#3c6592', eave: '#284666' },
  charcoal: { roofL: '#4a423e', roofR: '#34302d', eave: '#221f1d' },
  rock: { roofL: '#8a949a', roofR: '#656f75', eave: '#4a5358' },
};
const DOOR = '#4a2f17';
const win = lit => (lit ? '#ffe08a' : '#4a3d33');
const FLAG = '#c8402c';

function door(c, n, x0, w, h) { rect(c, x0, wallBottom(n, x0) - h + 1, w, h, DOOR); }
function flag(c, x, y, h = 7) { rect(c, x, y - h, 1, h, '#3a2a1c'); rect(c, x + 1, y - h, 3, 2, FLAG); rect(c, x + 1, y - h + 2, 2, 1, '#9c2f20'); }
function crenels(c, n, H, color, step = 2) {
  // merlões: levanta 1px a cada `step` colunas ao longo do topo
  const p = profile(n);
  for (let x = 0; x < p.W; x += step * 2) rect(c, x, -H + p.t[x] - 1, step, 1, color);
}

// ---------- predios ----------
// cada painter(c, lit, v) desenha em coordenadas do chao (0,0 = canto sup. esq. do losango)
const PAINTERS = {
  centro: { n: 2, rise: 30, draw(c, lit) {
    box(c, 2, 8, { ...WALL.cream, ...ROOF.red, peak: 7 });
    // portal e janelas
    rect(c, 15, wallBottom(2, 15) - 5, 4, 6, DOOR); rect(c, 16, wallBottom(2, 15) - 6, 2, 1, DOOR);
    rect(c, 4, 9, 2, 2, win(lit)); rect(c, 8, 11, 2, 2, win(lit)); rect(c, 21, 10, 2, 2, win(lit));
    rect(c, 12, -22, 1, 2, '#6a5a4a');
    flag(c, 12, -15, 9);
  } },

  casa: { n: 1, rise: 15, draw(c, lit, v) {
    const roofs = [ROOF.red, ROOF.rust, ROOF.slate];
    box(c, 1, 4, { ...WALL.cream, ...roofs[v % 3], peak: 3 });
    door(c, 1, 8, 2, 3);
    rect(c, 2, 2, 2, 2, win(lit));
    rect(c, 8, -8, 2, 3, '#7a7068'); rect(c, 8, -9, 2, 1, '#4b423d'); // chamine
  } },

  fazenda: { n: 1, rise: 6, draw(c) {
    box(c, 1, 1, { left: '#6e4a28', right: '#563a20', top: '#8a6638' });
    // fileiras de planta
    for (let x = 2; x < 10; x++) {
      for (let y = 0; y < 6; y++) {
        const inside = profile(1).t[x] <= y && y <= profile(1).b[x];
        if (inside && (x + y * 2) % 4 === 0) rect(c, x, y - 1, 1, 1, '#79b04a');
      }
    }
    rect(c, 9, 0, 3, 2, '#e3c25a'); rect(c, 9, -1, 3, 1, '#f4dc7a'); // fardo de feno
  } },

  serraria: { n: 1, rise: 12, draw(c) {
    box(c, 1, 3, { left: '#c08a52', right: '#946236', top: '#d8a468', ...ROOF.rust, peak: 2 });
    door(c, 1, 8, 2, 2);
    // pilha de toras na frente, com o miolo claro visivel
    rect(c, 0, 5, 5, 1, '#c08a52'); rect(c, 0, 4, 5, 1, '#a56f3c'); rect(c, 1, 3, 3, 1, '#c08a52');
    rect(c, 0, 4, 1, 2, '#f0c88a'); rect(c, 4, 4, 1, 2, '#f0c88a');
    rect(c, 3, 1, 1, 2, '#c3ccd0'); rect(c, 2, 1, 3, 1, '#c3ccd0'); // serra na parede
  } },

  mina: { n: 1, rise: 14, draw(c) {
    box(c, 1, 2, { left: '#6f787d', right: '#555e63', top: '#8a949a', ...ROOF.rock, peak: 6 });
    rect(c, 7, wallBottom(1, 7) - 3, 3, 4, '#1c1a18'); rect(c, 6, wallBottom(1, 7) - 3, 1, 4, '#8a5a2b'); rect(c, 10, wallBottom(1, 7) - 3, 1, 4, '#8a5a2b');
    rect(c, 3, -3, 1, 1, '#f4c93a'); rect(c, 5, -6, 1, 1, '#f4c93a'); rect(c, 4, 0, 1, 1, '#7fd0f0');
  } },

  quartel: { n: 1, rise: 20, draw(c, lit) {
    box(c, 1, 6, { ...WALL.stone, ...ROOF.slate, peak: 3 });
    door(c, 1, 8, 2, 4); rect(c, 2, 3, 2, 2, win(lit));
    flag(c, 5, -9, 6);
  } },

  ferraria: { n: 1, rise: 17, draw(c, lit) {
    box(c, 1, 4, { ...WALL.dark, ...ROOF.charcoal, peak: 2 });
    rect(c, 7, wallBottom(1, 7) - 2, 3, 3, '#ff9a3a'); rect(c, 8, wallBottom(1, 7) - 1, 1, 1, '#ffe08a'); // forja acesa
    rect(c, 2, 2, 2, 2, win(lit));
    rect(c, 8, -12, 2, 6, '#6b625c'); rect(c, 8, -13, 2, 1, '#3a3430');
  } },

  mercado: { n: 1, rise: 11, draw(c) {
    box(c, 1, 3, { ...WALL.wood });
    // toldo listrado sobre o topo
    const p = profile(1);
    for (let x = 0; x < 12; x++) {
      rect(c, x, -3 + p.t[x] - 1, 1, p.b[x] - p.t[x] + 2, x % 4 < 2 ? '#d0503a' : '#ece6d0');
    }
    rect(c, 1, 1, 1, 4, '#4a2f17'); rect(c, 10, 2, 1, 4, '#4a2f17');
    rect(c, 5, 3, 2, 2, '#e3a43a'); rect(c, 4, 4, 1, 1, '#c8402c');
  } },

  torre: { n: 1, rise: 24, draw(c, lit) {
    box(c, 1, 12, { ...WALL.stone });
    crenels(c, 1, 12, '#c3ccd0');
    rect(c, 8, wallBottom(1, 8) - 3, 2, 4, DOOR);
    rect(c, 2, -4, 1, 3, win(lit) === '#ffe08a' ? '#ffe08a' : '#2a2420');
    rect(c, 9, -2, 1, 3, '#2a2420');
    flag(c, 6, -13, 7);
  } },

  muralha: { n: 1, rise: 7, draw(c) {
    // mureta baixa e mais escura: vinte trechos juntos nao podem virar um bloco cinza
    box(c, 1, 3, { left: '#8a8f8f', right: '#666c6c', top: '#a9aeae' });
    crenels(c, 1, 3, '#a9aeae');
    rect(c, 5, 2, 1, 1, '#2a2420');
  } },

  universidade: { n: 1, rise: 19, draw(c, lit) {
    box(c, 1, 6, { ...WALL.white, ...ROOF.blue, peak: 3 });
    for (let x = 7; x <= 10; x += 3) rect(c, x, wallBottom(1, x) - 5, 1, 5, '#a8a18a');
    door(c, 1, 8, 2, 3); rect(c, 2, 3, 2, 3, win(lit));
    rect(c, 5, -11, 3, 2, '#ece6d0'); rect(c, 6, -12, 1, 1, '#c8932a'); // livro
  } },

  mosteiro: { n: 1, rise: 20, draw(c, lit) {
    box(c, 1, 5, { ...WALL.white, ...ROOF.purple, peak: 3 });
    door(c, 1, 8, 2, 3); rect(c, 2, 3, 2, 2, win(lit));
    rect(c, 5, -13, 1, 5, '#e6b43c'); rect(c, 4, -11, 3, 1, '#e6b43c'); // cruz
  } },

  castelo: { n: 2, rise: 38, draw(c, lit) {
    box(c, 2, 10, { ...WALL.stone });
    crenels(c, 2, 10, '#c3ccd0');
    rect(c, 15, wallBottom(2, 15) - 6, 4, 7, '#2a2420'); rect(c, 16, wallBottom(2, 15) - 7, 2, 1, '#2a2420'); // portao
    rect(c, 4, 5, 1, 3, '#2a2420'); rect(c, 9, 8, 1, 3, win(lit)); rect(c, 21, 7, 1, 3, win(lit)); rect(c, 19, 12, 1, 3, '#2a2420');
    // torre de menagem no meio do topo
    box(c, 1, 9, { ...WALL.stone, left: '#b4bcc1', right: '#8d979d' }, 6, -10 + 3);
    crenels(c, 1, 9, '#d6dde0');
    flag(c, 12, -17, 8);
  } },

  catedral: { n: 2, rise: 46, draw(c, lit) {
    box(c, 2, 9, { ...WALL.white, ...ROOF.slate, peak: 4 });
    rect(c, 15, wallBottom(2, 15) - 6, 4, 7, '#3a2418'); rect(c, 16, wallBottom(2, 15) - 7, 2, 1, '#3a2418');
    rect(c, 4, 6, 2, 3, win(lit)); rect(c, 9, 9, 2, 3, win(lit)); rect(c, 21, 8, 2, 3, win(lit));
    // duas torres com chapeu pontudo
    for (const sx of [4, 17]) {
      rect(c, sx, -20, 5, 12, '#ece6d0'); rect(c, sx, -20, 1, 12, '#c4bda4'); rect(c, sx + 4, -20, 1, 12, '#c4bda4');
      rect(c, sx + 1, -17, 1, 2, win(lit));                                           // frestas
      rect(c, sx - 1, -22, 7, 2, '#667f98'); rect(c, sx, -24, 5, 2, '#667f98');         // chapeu pontudo
      rect(c, sx + 1, -26, 3, 2, '#4a6279'); rect(c, sx + 2, -29, 1, 3, '#4a6279');
      rect(c, sx + 2, -32, 1, 3, '#e6b43c');
    }
  } },

  maravilha: { n: 2, rise: 34, draw(c, lit) {
    box(c, 2, 4, { ...WALL.stone });
    box(c, 2, 6, { ...WALL.gold, left: '#d9a634', right: '#a97c1c' }, 0, -4 + 0);
    box(c, 1, 8, { ...WALL.gold }, 6, -10 + 3);
    box(c, 1, 5, { ...WALL.gold, top: '#fbe38a', left: '#f0c24a', right: '#c8932a' }, 6, -18 + 3 + 0);
    rect(c, 11, -22, 2, 2, '#ffffff');           // brilho no pico
    rect(c, 12, -28, 1, 5, '#fbe38a');           // agulha dourada
    if (lit) { rect(c, 11, -12, 1, 1, '#ffffff'); rect(c, 14, -7, 1, 1, '#ffffff'); }
    rect(c, 15, wallBottom(2, 15) - 4, 4, 5, '#4a2f17');
  } },
};

// ---------- arvores e decoracao ----------
const DECOR = {
  pine: { n: 1, rise: 14, draw(c) {
    rect(c, 5, 1, 2, 3, '#5a3a1e');
    for (let i = 0; i < 4; i++) rect(c, 6 - (i + 1) - (i > 1 ? 0 : 0), -8 + i * 3, 2 * (i + 1) + 0, 3, i % 2 ? '#2f5f35' : '#3a7340');
    rect(c, 5, -9, 2, 1, '#4d8a4d');
  } },
  oak: { n: 1, rise: 12, draw(c) {
    rect(c, 5, 1, 2, 3, '#5a3a1e');
    rect(c, 2, -6, 8, 6, '#3f7a3f'); rect(c, 3, -8, 6, 2, '#4d8a4d'); rect(c, 3, -2, 6, 2, '#2f5f35');
    rect(c, 4, -6, 2, 1, '#6ba85f');
  } },
  bush: { n: 1, rise: 5, draw(c) {
    rect(c, 3, 0, 6, 3, '#3a7340'); rect(c, 4, -1, 4, 1, '#4d8a4d'); rect(c, 6, 1, 1, 1, '#d0503a');
  } },
  // tiles do chao (caixa baixa com lateral de terra)
  grassA: { n: 1, rise: GROUND_H, ground: true, top: '#5b8f43', specks: ['#6ba85f', '#4a7a37'] },
  grassB: { n: 1, rise: GROUND_H, ground: true, top: '#558a3f', specks: ['#4a7a37', '#78b268'] },
  street: { n: 1, rise: GROUND_H, ground: true, top: '#b9996a', specks: ['#a28357', '#cdb184'] },
};

const cache = new Map();
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; };
export { hash };

/** Sprite (com cache). Para predios, `lit` acende as janelas; `variant` troca a cor do telhado. */
export function getSprite(id, { lit = false, variant = 0 } = {}) {
  const key = `${id}|${lit ? 1 : 0}|${variant}`;
  if (cache.has(key)) return cache.get(key);
  let s;
  if (PAINTERS[id]) {
    const sp = PAINTERS[id];
    s = sprite(sp.n, sp.rise, c => sp.draw(c, lit, variant));
  } else if (DECOR[id]?.ground) {
    const d = DECOR[id];
    s = sprite(1, d.rise, c => {
      box(c, 1, GROUND_H, { top: d.top, left: '#7a5530', right: '#5e4123' });
      const p = profile(1);
      let k = 0;
      for (let y = 0; y < 6; y++) for (let x = 0; x < 12; x++) {
        if (p.t[x] <= y && y <= p.b[x] && hash(x * 7 + variant, y * 13 + variant) % 11 === 0) {
          rect(c, x, y - GROUND_H, 1, 1, d.specks[k++ % 2]);
        }
      }
      // fio claro na borda de cima das paredes (a "borda de grama")
      for (let x = 0; x < 12; x++) rect(c, x, p.b[x] - GROUND_H, 1, 1, d.top);
    });
  } else {
    const d = DECOR[id];
    s = sprite(d.n, d.rise, c => d.draw(c));
  }
  cache.set(key, s);
  return s;
}

export const BUILDING_IDS = Object.keys(PAINTERS);
export const hasPainter = id => id in PAINTERS;
