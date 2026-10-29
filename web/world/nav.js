// Navegacao dos aldeoes: grade de celulas de 32 px com obstaculos retangulares e busca em
// largura com 8 vizinhos, seguida de suavizacao por linha de visada. Puro (sem DOM).

export const CELL = 16;

export function createNav({ width, height, rects = [], inflate = 4, landRect }) {
  const cols = Math.ceil(width / CELL), rows = Math.ceil(height / CELL);
  const blocked = new Uint8Array(cols * rows);
  const idx = (cx, cy) => cy * cols + cx;
  const inside = (cx, cy) => cx >= 0 && cy >= 0 && cx < cols && cy < rows;

  // fora da terra firme: bloqueado
  if (landRect) {
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      const x = cx * CELL + CELL / 2, y = cy * CELL + CELL / 2;
      if (x < landRect.x0 || x > landRect.x1 || y < landRect.y0 || y > landRect.y1) blocked[idx(cx, cy)] = 1;
    }
  }
  for (const r of rects) {
    const x0 = Math.floor((r.x0 - inflate) / CELL), x1 = Math.floor((r.x1 + inflate) / CELL);
    const y0 = Math.floor((r.y0 - inflate) / CELL), y1 = Math.floor((r.y1 + inflate) / CELL);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (inside(cx, cy)) blocked[idx(cx, cy)] = 1;
  }

  const cell = (x, y) => [Math.floor(x / CELL), Math.floor(y / CELL)];
  const free = (cx, cy) => inside(cx, cy) && !blocked[idx(cx, cy)];
  const center = (cx, cy) => ({ x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 });

  /** Celula livre mais proxima (espiral) de (x, y); null se nao houver. */
  function nearestFree(x, y, maxR = 8) {
    const [cx, cy] = cell(x, y);
    if (free(cx, cy)) return [cx, cy];
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = Infinity;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !free(cx + dx, cy + dy)) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = [cx + dx, cy + dy]; }
      }
      if (best) return best;
    }
    return null;
  }

  function los(a, b) {
    // linha de visada por amostragem: nenhuma celula bloqueada no caminho
    const dx = b.x - a.x, dy = b.y - a.y, n = Math.ceil(Math.hypot(dx, dy) / (CELL / 3));
    for (let i = 1; i < n; i++) {
      const [cx, cy] = cell(a.x + (dx * i) / n, a.y + (dy * i) / n);
      if (!free(cx, cy)) return false;
    }
    return true;
  }

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  /** Caminho [{x,y}, ...] de (x0,y0) ate perto de (x1,y1), ou [] se nao houver. */
  function find(x0, y0, x1, y1) {
    const s = nearestFree(x0, y0), g = nearestFree(x1, y1);
    if (!s || !g) return [];
    const start = idx(...s), goal = idx(...g);
    const prev = new Int32Array(cols * rows).fill(-2);
    prev[start] = -1;
    const q = [start];
    for (let h = 0; h < q.length && prev[goal] === -2; h++) {
      const cur = q[h], cx = cur % cols, cy = (cur / cols) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!free(nx, ny) || prev[idx(nx, ny)] !== -2) continue;
        if (dx && dy && (!free(cx + dx, cy) || !free(cx, cy + dy))) continue; // nao corta quina
        prev[idx(nx, ny)] = cur;
        q.push(idx(nx, ny));
      }
    }
    if (prev[goal] === -2) return [];
    const cells = [];
    for (let c = goal; c !== -1; c = prev[c]) cells.push(center(c % cols, (c / cols) | 0));
    cells.reverse();
    // suaviza: pula pontos intermediarios enquanto houver linha de visada
    const out = [];
    let a = { x: x0, y: y0 }, i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !los(a, cells[j])) j--;
      out.push(cells[j]);
      a = cells[j];
      i = j + 1;
    }
    return out;
  }

  return { find, free: (x, y) => free(...cell(x, y)), nearestFree, cols, rows };
}
