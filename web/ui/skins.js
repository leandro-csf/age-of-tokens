// Molduras de interface do Tiny Swords. As folhas de papel/madeira vem em 9 pecas separadas por
// vaos (cantos, bordas e centro); aqui elas sao recompostas, em tempo de execucao, num painel de
// QUALQUER tamanho. Medidas (px) conferidas peca por peca na imagem original.

const ROOT = 'assets/tiny-swords/Tiny Swords (Free Pack)/UI Elements/UI Elements/';
const imgs = {};

function load(p) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('nao carregou: ' + p));
    i.src = encodeURI(ROOT + p);
  });
}

// cols/rows: faixas ocupadas por cada coluna/linha de pecas. cut: quanto de cada canto usar.
const SKINS = {
  paper:   { file: 'Papers/RegularPaper.png',  cols: [[12, 63], [128, 191], [256, 307]], rows: [[20, 63], [128, 191], [256, 300]], cut: { l: 26, r: 26, t: 26, b: 28 } },
  slate:   { file: 'Papers/SpecialPaper.png',  cols: [[9, 63], [128, 191], [256, 310]],  rows: [[20, 63], [128, 191], [256, 298]], cut: { l: 30, r: 30, t: 30, b: 30 } },
  wood:    { file: 'Wood Table/WoodTable.png', cols: [[44, 127], [192, 255], [320, 403]], rows: [[43, 127], [192, 255], [320, 422]], cut: { l: 30, r: 30, t: 30, b: 34 } },
};
// Fitas: 3 pecas na horizontal (ponta, miolo, ponta); uma linha por cor.
const RIBBON = {
  file: 'Ribbons/SmallRibbons.png', cols: [[2, 63], [128, 191], [256, 317]],
  rows: { blue: [4, 63], red: [132, 191], yellow: [260, 319], purple: [388, 447], black: [516, 575] },
};

export async function loadSkins() {
  const files = new Set([...Object.values(SKINS).map(s => s.file), RIBBON.file]);
  await Promise.all([...files].map(async f => { imgs[f] = await load(f); }));
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

/** Painel de w x h recomposto a partir das 9 pecas da folha `skin`. */
export function panel(skin, w, h) {
  const s = SKINS[skin], img = imgs[s.file];
  const [c, g] = canvas(w, h);
  const L = Math.min(s.cut.l, w >> 1), R = Math.min(s.cut.r, w >> 1), T = Math.min(s.cut.t, h >> 1), B = Math.min(s.cut.b, h >> 1);
  const [c0, c1, c2] = s.cols, [r0, r1, r2] = s.rows;
  const xs = [[c0[0], L, 0, L], [c1[0], c1[1] - c1[0] + 1, L, w - L - R], [c2[1] - R + 1, R, w - R, R]];
  const ys = [[r0[0], T, 0, T], [r1[0], r1[1] - r1[0] + 1, T, h - T - B], [r2[1] - B + 1, B, h - B, B]];
  // o miolo e esticado; so se desenham as pecas com tamanho positivo
  for (const [sy, sh, dy, dh] of ys) {
    for (const [sx, sw, dx, dw] of xs) {
      if (dw > 0 && dh > 0) g.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }
  }
  return c;
}

/** Fita horizontal de largura w e cor `color` (altura fixa da arte). */
export function ribbon(color, w) {
  const img = imgs[RIBBON.file], [y0, y1] = RIBBON.rows[color], h = y1 - y0 + 1;
  const [c, g] = canvas(w, h);
  const [l, m, r] = RIBBON.cols;
  const lw = l[1] - l[0] + 1, rw = r[1] - r[0] + 1;
  g.drawImage(img, l[0], y0, lw, h, 0, 0, lw, h);
  g.drawImage(img, m[0], y0, m[1] - m[0] + 1, h, lw, 0, w - lw - rw, h);
  g.drawImage(img, r[0], y0, rw, h, w - rw, 0, rw, h);
  return c;
}

/** Pinta o fundo de um elemento com o painel do tamanho dele. */
export function paint(el, skin) {
  const w = el.offsetWidth, h = el.offsetHeight;
  if (!w || !h) return;
  const c = skin.startsWith('ribbon-') ? ribbon(skin.slice(7), w) : panel(skin, w, h);
  el.style.backgroundImage = `url(${c.toDataURL()})`;
  el.style.backgroundSize = `${c.width}px ${c.height}px`;
}

export function paintAll(root = document) {
  root.querySelectorAll('[data-skin]').forEach(el => paint(el, el.dataset.skin));
}
