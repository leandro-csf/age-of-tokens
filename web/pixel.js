// Sprites 10x10 desenhados a mao. Cada letra e uma cor da paleta do sprite; '.' e transparente.
// Renderizados como SVG com shape-rendering crispEdges (pixel exato em qualquer escala).

export const SPRITES = {
  // trigo (comida)
  food: {
    pal: { y: '#f0c85a', Y: '#c98f2a', g: '#6f8f3a', G: '#4d6a2a' },
    rows: [
      '....yy....',
      '...yYyy...',
      '.yy.yy.yy.',
      '.yYyyyyYy.',
      '..yyyyyy..',
      '.yYyyyyYy.',
      '..y.gg.y..',
      '....gG....',
      '....gG....',
      '...gGGg...',
    ],
  },
  // tora cortada (madeira)
  wood: {
    pal: { d: '#4a2f17', B: '#d6a566', r: '#a8743a' },
    rows: [
      '..dddddd..',
      '.dBBBBBBd.',
      'dBBrrrrBBd',
      'dBrBBBBrBd',
      'dBrBrrBrBd',
      'dBrBrrBrBd',
      'dBrBBBBrBd',
      'dBBrrrrBBd',
      '.dBBBBBBd.',
      '..dddddd..',
    ],
  },
  // rocha (pedra)
  stone: {
    pal: { d: '#3d4448', l: '#c4cfd3', L: '#9aa8ad', s: '#7b898e' },
    rows: [
      '..........',
      '...dddd...',
      '..dllLLd..',
      '.dlLLLLLd.',
      '.dlLLLsLLd',
      'dlLLLLLLLd',
      'dLLsLLLLLd',
      'dLLLLLLsLd',
      '.dssssssd.',
      '..dddddd..',
    ],
  },
  // moeda (ouro)
  gold: {
    pal: { d: '#6b4a10', Y: '#f4c93a', y: '#fbe38a', o: '#c8932a' },
    rows: [
      '...dddd...',
      '..dYYYYd..',
      '.dYyyYYYd.',
      'dYyYYYYYYd',
      'dYyYooYYYd',
      'dYYYooYYYd',
      'dYYYYYYoYd',
      '.dYYYYooo.',
      '..dooooo..',
      '...dddd...',
    ],
  },
  // aldeao
  villager: {
    pal: { h: '#5a3a1e', s: '#e8b88a', e: '#2b1d12', c: '#4f7d8c', C: '#35606e', b: '#6b4a2a' },
    rows: [
      '...hhhh...',
      '..hhhhhh..',
      '..sseess..',
      '...ssss...',
      '..cccccc..',
      '.scccCccs.',
      '.scccCccs.',
      '..cCCCCc..',
      '..bb..bb..',
      '..bb..bb..',
    ],
  },
  // martelo (pontos de obra)
  hammer: {
    pal: { h: '#8d99a0', H: '#c4cfd3', w: '#8a5a2b', W: '#5d3a1a' },
    rows: [
      '..........',
      '.hhhhhh...',
      '.hHHHHhh..',
      '.hHHHHHhh.',
      '.hhhhhhh..',
      '....wW....',
      '...wW.....',
      '..wW......',
      '.wW.......',
      '.W........',
    ],
  },
  // casa (predios)
  house: {
    pal: { r: '#b5482f', R: '#8a3320', w: '#e3d3a8', W: '#b8a678', d: '#4a2f17' },
    rows: [
      '....rr....',
      '...rRRr...',
      '..rrRRrr..',
      '.rrrRRrrr.',
      'rrrrRRrrrr',
      '.wwwwwwww.',
      '.wWwwddww.',
      '.wwwwddww.',
      '.wWwwddWw.',
      '.WWWWWWWW.',
    ],
  },
  // livro (pesquisa)
  book: {
    pal: { b: '#7a3b8c', B: '#4f2360', p: '#efe3c2', g: '#e0a63a' },
    rows: [
      '..........',
      '.bbbbbbbb.',
      'bBppppppBb',
      'bBpggggpBb',
      'bBppppppBb',
      'bBpggggpBb',
      'bBppppppBb',
      'bBBBBBBBBb',
      '.bbbbbbbb.',
      '..........',
    ],
  },
  // rubi de token (diamante)
  token: {
    pal: { t: '#5fd0b8', T: '#2f8f7c', d: '#17493f', w: '#c9fff1' },
    rows: [
      '..........',
      '...dddd...',
      '..dtwwtd..',
      '.dtwttttd.',
      'dtwtttTTTd',
      '.dtttTTTd.',
      '..dtTTTd..',
      '...dTTd...',
      '....dd....',
      '..........',
    ],
  },
  sun: {
    pal: { y: '#ffd95a', Y: '#f2a93a', o: '#ffeeaa' },
    rows: [
      '....yy....',
      '.y..yy..y.',
      '..yyyyyy..',
      '..yooyyy..',
      'yyyooYyyyy',
      'yyyyyYyyyy',
      '..yyYYyy..',
      '..yyyyyy..',
      '.y..yy..y.',
      '....yy....',
    ],
  },
  moon: {
    pal: { m: '#e9e3c8', M: '#b9b293', d: '#7d775f' },
    rows: [
      '...mmmm...',
      '..mmmM....',
      '.mmmM.....',
      '.mmMd.....',
      'mmmM......',
      'mmmM......',
      '.mmMd...M.',
      '.mmmMMMMd.',
      '..mmmmMd..',
      '...mmdd...',
    ],
  },
};

const cache = new Map();

/** SVG inline de um sprite, em `px` pixels de tela por pixel de arte. */
export function sprite(name, px = 3) {
  const key = name + px;
  if (cache.has(key)) return cache.get(key);
  const s = SPRITES[name];
  let rects = '';
  s.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') { x++; continue; }
      let run = 1;
      while (x + run < row.length && row[x + run] === ch) run++;
      rects += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${s.pal[ch]}"/>`;
      x += run;
    }
  });
  const svg = `<svg class="px" viewBox="0 0 10 10" width="${10 * px}" height="${10 * px}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  cache.set(key, svg);
  return svg;
}

/** Paisagem do topo: ceu em faixas, morros em degraus e o astro do momento. Gerado, nao desenhado. */
export function skyline({ night }) {
  const W = 96, H = 28;
  const bands = night
    ? ['#0d0f1c', '#121528', '#181a33', '#1f2140', '#272a4d', '#30335a']
    : ['#2b4a6e', '#3a6188', '#52799c', '#7b97ad', '#b5a98c', '#d9a35c'];
  let out = '';
  const bandH = Math.ceil(H / bands.length);
  bands.forEach((c, i) => { out += `<rect x="0" y="${i * bandH}" width="${W}" height="${bandH}" fill="${c}"/>`; });
  if (night) {
    for (const [x, y] of [[6, 3], [19, 8], [31, 2], [44, 6], [58, 3], [71, 9], [84, 4], [90, 10], [12, 12], [66, 13]]) {
      out += `<rect x="${x}" y="${y}" width="1" height="1" fill="#e9e3c8" opacity=".7"/>`;
    }
  }
  const hill = (base, amp, phase, color) => {
    for (let x = 0; x < W; x++) {
      const h = Math.round(base + amp * Math.sin(x / 9 + phase) + amp * 0.5 * Math.sin(x / 4.3 + phase * 2));
      out += `<rect x="${x}" y="${H - h}" width="1" height="${h}" fill="${color}"/>`;
    }
  };
  hill(8, 2.4, 0.4, night ? '#1d2236' : '#5b6f55');
  hill(5, 1.8, 2.1, night ? '#141826' : '#3f5239');
  hill(2.5, 1, 4.2, night ? '#0b0d16' : '#2a3926');
  return `<svg class="skyline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" shape-rendering="crispEdges" aria-hidden="true">${out}</svg>`;
}
