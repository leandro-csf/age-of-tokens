import {
  layoutAll, visible, island, isStreet, accessCell, TOWN_CENTER,
} from './layout.js';
import { getSprite, hash, GROUND_H, hasPainter } from './art.js';

/*
 * Controlador do canvas da aldeia. O estado vem de fora (update/setAwake); aqui so
 * se desenha e se anima. Resolucao logica baixa + zoom INTEIRO (4x,3x,2x,1x) para o
 * pixel ficar nitido; a camera recua um degrau quando a aldeia deixa de caber.
 */

const SCALES = [4, 3, 2, 1];
const MAX_RISE = 40;            // folga acima da ilha para as torres mais altas
const FRAME_MS = 1000 / 30;
const RISE_MS = Number(new URLSearchParams(location.search).get('rise')) || 1500; // ?rise=8000 alonga a obra (depuracao)
const PAN_FIT = 1.7;            // ilha pode ser ate 1,7x mais larga que a tela: a camera passeia de lado a lado
const PAN_PERIOD_S = 55;

// unidade do jogo -> figurinha. Maquinas de cerco ficam "dentro do castelo" (sem sprite).
const KIND = {
  aldeao: 'villager', espadachim: 'soldier', campeao: 'soldier', arcabuzeiro: 'soldier',
  arqueiro: 'archer', besteiro: 'archer', cavaleiro_leve: 'rider', cavaleiro: 'rider',
  paladino: 'rider', monge: 'monk',
};
const KIND_CAP = { villager: 30, soldier: 10, archer: 10, rider: 6, monk: 4 }; // so uma amostra: a ilha e pequena
const SPEED = { villager: 1.1, soldier: 0.9, archer: 0.9, rider: 2.0, monk: 0.8 };
const FOCUS_BUILDINGS = { food: ['fazenda'], wood: ['serraria'], stone: ['mina'], gold: ['mina', 'mercado'] };

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export function createVillage(canvas, content) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const frame = canvas.parentElement; // painel de altura fixa; o canvas fica centrado dentro dele

  const placed = layoutAll(content.plan);
  let built = {};
  let units = {};
  let focus = 'food';
  let awake = false;
  let nightAmt = 1;           // 0 = dia, 1 = noite (anima suavemente)
  let first = true;
  const rising = new Map();   // "id:k" -> inicio da animacao de construcao
  const walkers = [];
  const puffs = [];
  let vis = [TOWN_CENTER];
  let isl = island(vis);
  let cam = { s: 2, w: 0, h: 0, x: 0, y: 0 };
  let ground = null;          // camada estatica do terreno, refeita quando a ilha muda
  let trees = [];
  let dirty = true;
  let drawMs = 0;             // custo medio de um quadro (para checar desempenho)
  let lastT = 0;
  let acc = 0;

  // ---------- camera ----------
  function extents(i) {
    return {
      minX: (i.x0 - (i.y1 + 1)) * 6, maxX: (i.x1 - i.y0 + 1) * 6 + 6,
      minY: (i.x0 + i.y0) * 3 - GROUND_H - MAX_RISE, maxY: (i.x1 + i.y1 + 1) * 3 + 6,
    };
  }

  function layoutCamera() {
    const cssW = frame.clientWidth || 320;
    const cssH = frame.clientHeight || 300;
    const e = extents(isl);
    const spanX = e.maxX - e.minX, spanY = e.maxY - e.minY;
    const s = SCALES.find(k => spanX * k <= cssW * PAN_FIT && spanY * k <= cssH) || 1;
    const w = Math.ceil(cssW / s), h = Math.ceil(cssH / s);
    // quanto a ilha excede a largura da tela, em px logicos (>0 => a camera passeia)
    const overflow = Math.max(0, spanX + 8 - w);
    cam = { s, w, h, x: Math.floor((w - spanX) / 2) - e.minX, y: Math.floor((h - spanY) / 2) - e.minY, pan: overflow / 2 };
    canvas.width = w; canvas.height = h;
    canvas.style.width = w * s + 'px'; canvas.style.height = h * s + 'px';
    ctx.imageSmoothingEnabled = false;
    buildGround();
    buildTrees();
    dirty = true;
    // redimensionar o canvas o limpa: redesenha ja, sem esperar o proximo quadro (evita piscar)
    drawScene(0, performance.now());
  }

  const sx = (gx, gy) => cam.x + (gx - gy) * 6;       // x do canto sup. esq. do losango da celula
  const sy = (gx, gy) => cam.y + (gx + gy) * 3 - GROUND_H;

  // O terreno e pre-desenhado num canvas que cobre a ilha INTEIRA (nao so a tela): quando a
  // camera passeia, a parte que estava fora da tela precisa existir.
  let groundLeft = 0;
  function buildGround() {
    const e = extents(isl);
    groundLeft = Math.min(0, cam.x + e.minX - 8);
    const right = Math.max(cam.w, cam.x + e.maxX + 8);
    ground = document.createElement('canvas');
    ground.width = right - groundLeft; ground.height = cam.h;
    const g = ground.getContext('2d');
    g.imageSmoothingEnabled = false;
    for (let d = isl.x0 + isl.y0; d <= isl.x1 + isl.y1; d++) {
      for (let gx = Math.max(isl.x0, d - isl.y1); gx <= Math.min(isl.x1, d - isl.y0); gx++) {
        const gy = d - gx;
        const h = hash(gx + 100, gy + 100);
        const sp = getSprite(isStreet(gx, gy) ? 'street' : (h & 1 ? 'grassA' : 'grassB'), { variant: (h >>> 3) % 4 });
        g.drawImage(sp.cv, sx(gx, gy) - sp.ax - groundLeft, cam.y + (gx + gy) * 3 - sp.ay);
      }
    }
  }

  function covered(gx, gy) {
    return vis.some(b => gx >= b.gx && gx < b.gx + b.n && gy >= b.gy && gy < b.gy + b.n);
  }

  function buildTrees() {
    trees = [];
    for (let gx = isl.x0; gx <= isl.x1; gx++) {
      for (let gy = isl.y0; gy <= isl.y1; gy++) {
        if (isStreet(gx, gy) || covered(gx, gy)) continue;
        const h = hash(gx * 31 + 7, gy * 17 + 3) % 100;
        const id = h < 22 ? 'pine' : h < 36 ? 'oak' : h < 50 ? 'bush' : null;
        if (id) trees.push({ id, gx, gy });
      }
    }
  }

  // ---------- caminhos ----------
  const inIsland = (x, y) => x >= isl.x0 && x <= isl.x1 && y >= isl.y0 && y <= isl.y1;
  function bfs(from, to) {
    const key = (x, y) => x + ',' + y;
    const prev = new Map([[key(...from), null]]);
    const q = [from];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === to[0] && y === to[1]) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (prev.has(k) || !inIsland(nx, ny) || !isStreet(nx, ny)) continue;
        prev.set(k, [x, y]);
        q.push([nx, ny]);
      }
    }
    if (!prev.has(key(...to))) return [];
    const path = [];
    for (let c = to; c; c = prev.get(key(...c))) path.push(c);
    return path.reverse().slice(1);
  }

  const access = new Map();
  function accessOf(b) {
    const k = `${b.id}:${b.k}`;
    if (!access.has(k)) access.set(k, accessCell(b));
    return access.get(k);
  }
  function randomStreet() {
    for (let i = 0; i < 40; i++) {
      const x = isl.x0 + Math.floor(Math.random() * (isl.x1 - isl.x0 + 1));
      const y = isl.y0 + Math.floor(Math.random() * (isl.y1 - isl.y0 + 1));
      if (isStreet(x, y)) return [x, y];
    }
    return accessOf(TOWN_CENTER);
  }

  // ---------- caminhantes ----------
  function spawn(kind, atRandom) {
    const [cx, cy] = atRandom ? randomStreet() : accessOf(TOWN_CENTER);
    walkers.push({
      kind, u: cx + 0.5, v: cy + 0.5, cell: [cx, cy], path: [], wait: rnd(0, 2), working: false,
      jx: rnd(-0.22, 0.22), jy: rnd(-0.22, 0.22), dir: Math.random() < 0.5 ? 1 : -1, anim: Math.random() * 10,
      speed: SPEED[kind] * rnd(0.85, 1.15),
    });
  }

  function reconcileWalkers(atRandom) {
    const want = {};
    for (const [id, n] of Object.entries(units)) {
      const kind = KIND[id];
      if (kind) want[kind] = (want[kind] || 0) + n;
    }
    for (const kind of Object.keys(KIND_CAP)) {
      const target = Math.min(want[kind] || 0, KIND_CAP[kind]);
      let have = walkers.filter(w => w.kind === kind).length;
      while (have < target) { spawn(kind, atRandom); have++; }
      while (have > target) { walkers.splice(walkers.findIndex(w => w.kind === kind), 1); have--; }
    }
  }

  function chooseTarget(w) {
    const bs = vis.filter(b => b.id !== 'centro');
    const byIds = ids => bs.filter(b => ids.includes(b.id));
    let b = null;
    if (w.kind === 'villager') {
      const r = Math.random();
      if (r < 0.6) b = pick(byIds(FOCUS_BUILDINGS[focus] || []));
      if (!b && r < 0.9 && bs.length) b = pick(bs);
      if (!b) b = TOWN_CENTER;
    } else if (w.kind === 'monk') {
      b = pick(byIds(['mosteiro', 'catedral']).concat([TOWN_CENTER]));
    } else if (Math.random() < 0.5) {
      b = pick(byIds(['quartel', 'torre', 'castelo', 'muralha']).concat([TOWN_CENTER]));
    }
    const target = b ? accessOf(b) : randomStreet();
    w.path = bfs(w.cell, target);
    w.working = !!b && w.kind === 'villager';
  }

  function stepWalker(w, dt) {
    w.anim += dt;
    if (!w.path.length) {
      w.wait -= dt;
      if (w.wait > 0) return;
      // de noite quem nao e guarda dorme onde esta
      if (!awake && (w.kind === 'villager' || w.kind === 'monk')) { w.wait = 2; w.working = false; return; }
      chooseTarget(w);
      w.wait = w.working ? rnd(1.5, 4) : rnd(0.3, 1.5);
      if (!w.path.length) w.working = false;
      return;
    }
    const [nx, ny] = w.path[0];
    const tu = nx + 0.5 + w.jx, tv = ny + 0.5 + w.jy;
    const du = tu - w.u, dv = tv - w.v, dist = Math.hypot(du, dv);
    const speed = w.speed * (awake ? 1 : 0.5);
    const stepLen = speed * dt;
    w.dir = Math.sign(du - dv) || w.dir; // vira conforme o movimento na tela (x da tela = u - v)
    if (dist <= stepLen) { w.u = tu; w.v = tv; w.cell = [nx, ny]; w.path.shift(); }
    else { w.u += (du / dist) * stepLen; w.v += (dv / dist) * stepLen; }
  }

  // ---------- desenho de figurinhas ----------
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

  function drawWalker(w, x, y) {
    const step = Math.floor(w.anim * (w.kind === 'rider' ? 10 : 6)) % 2;
    const moving = w.path.length > 0;
    const bob = moving && step ? 1 : 0;
    const d = w.dir;
    R(x - 3, y, 7, 1, 'rgba(0,0,0,.28)'); // sombra
    if (w.kind === 'rider') {
      R(x - 4, y - 6 - bob, 9, 3, '#7a4f28'); R(x - 4, y - 3, 1, 3 - (step ? 1 : 0), '#5a3a1e'); R(x + 3, y - 3, 1, 3, '#5a3a1e');
      R(x + (d > 0 ? 3 : -5), y - 8 - bob, 2, 3, '#7a4f28');
      R(x - 1, y - 11 - bob, 3, 2, '#e8b88a'); R(x - 2, y - 9 - bob, 4, 3, '#3f6fb0'); R(x - 1, y - 12 - bob, 3, 1, '#9aa3a8');
      R(x + (d > 0 ? 2 : -3), y - 15 - bob, 1, 7, '#5a3a1e');
      return;
    }
    const legL = moving && step ? 2 : 3;
    R(x - 1, y - 3, 1, legL, '#4a3322'); R(x + 1, y - 3, 1, moving && step ? 3 : 2, '#4a3322');
    const by = y - 6 - bob;
    if (w.kind === 'monk') {
      R(x - 2, by, 5, 6, '#7a4a9a'); R(x - 1, by - 2, 3, 2, '#e8b88a'); R(x - 1, by - 3, 3, 1, '#4a2f62');
      return;
    }
    const tunic = w.kind === 'soldier' ? '#b8402c' : w.kind === 'archer' ? '#4f8a46' : '#4f7d8c';
    R(x - 2, by, 5, 3, tunic); R(x - 2, by + 2, 5, 1, 'rgba(0,0,0,.2)');
    R(x - 1, by - 2, 3, 2, '#e8b88a');
    if (w.kind === 'soldier') { R(x - 1, by - 3, 3, 1, '#9aa3a8'); R(x + (d > 0 ? 3 : -3), by - 5, 1, 8, '#5a3a1e'); R(x + (d > 0 ? 3 : -3), by - 6, 1, 1, '#c3ccd0'); }
    else if (w.kind === 'archer') { R(x - 1, by - 3, 3, 1, '#2f5f35'); R(x + (d > 0 ? 3 : -4), by - 1, 1, 5, '#8a5a2b'); }
    else {
      R(x - 1, by - 3, 3, 1, '#6b4a2a');
      if (w.working && !moving) { // martela: o braço sobe e desce
        const up = Math.floor(w.anim * 5) % 2;
        R(x + (d > 0 ? 2 : -3), by - (up ? 3 : 0), 1, 3, '#8a5a2b'); R(x + (d > 0 ? 2 : -4), by - (up ? 4 : 1), 3, 1, '#c3ccd0');
      }
    }
  }

  // ---------- particulas ----------
  function puff(x, y, kind) {
    puffs.push({ x, y, age: 0, kind, dx: kind === 'dust' ? rnd(-6, 6) : rnd(-0.6, 0.6) });
  }

  // ---------- quadro ----------
  function drawScene(dt, now) {
    const bg = ctx.createLinearGradient(0, 0, 0, cam.h);
    bg.addColorStop(0, '#26402f'); bg.addColorStop(1, '#1b2e22');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cam.w, cam.h);
    ctx.save();
    // passeio da camera: so quando a ilha nao cabe inteira na tela
    ctx.translate(cam.pan ? Math.round(Math.sin(now / 1000 / PAN_PERIOD_S * Math.PI * 2) * cam.pan) : 0, 0);
    ctx.drawImage(ground, groundLeft, 0);

    const items = [];
    for (const t of trees) {
      if (covered(t.gx, t.gy)) continue;
      items.push({ d: t.gx + t.gy + 0.4, draw: () => { const s = getSprite(t.id); ctx.drawImage(s.cv, sx(t.gx, t.gy) - s.ax, sy(t.gx, t.gy) - s.ay); } });
    }
    const lit = nightAmt > 0.5;
    for (const b of vis) {
      const key = `${b.id}:${b.k}`;
      const t0 = rising.get(key);
      const p = t0 === undefined ? 1 : Math.min(1, (now - t0) / RISE_MS);
      if (p >= 1 && t0 !== undefined) rising.delete(key);
      items.push({
        d: b.gx + b.n - 1 + b.gy + b.n - 1 + 0.5,
        draw: () => {
          const s = getSprite(hasPainter(b.id) ? b.id : 'casa', { lit, variant: b.k % 3 });
          const x = cam.x + (b.gx - (b.gy + b.n - 1)) * 6 - s.ax;
          const y = cam.y + (b.gx + b.gy) * 3 - GROUND_H - s.ay;
          if (p >= 1) { ctx.drawImage(s.cv, x, y); return; }
          const e = 1 - Math.pow(1 - p, 2);
          const cut = Math.floor(s.h * (1 - e));
          if (s.h - cut > 0) ctx.drawImage(s.cv, 0, cut, s.w, s.h - cut, x, y + cut, s.w, s.h - cut);
        },
      });
      if (p < 1 && Math.random() < dt * 14) puff(cam.x + (b.gx - b.gy) * 6 + 6 + rnd(-5 * b.n, 5 * b.n), sy(b.gx, b.gy) + 3 * b.n + 3, 'dust');
      if (awake) {
        const ox = cam.x + (b.gx - (b.gy + b.n - 1)) * 6, oy = sy(b.gx, b.gy);
        if (b.id === 'ferraria' && Math.random() < dt * 1.4) puff(ox + 9, oy - 13, 'smoke');
        else if (b.id === 'casa' && b.k % 2 === 0 && Math.random() < dt * 0.3) puff(ox + 9, oy - 9, 'smoke');
      }
    }
    for (const w of walkers) {
      const x = cam.x + (w.u - w.v) * 6 + 6, y = cam.y + (w.u + w.v) * 3 - GROUND_H;
      items.push({ d: w.u + w.v - 0.9, draw: () => drawWalker(w, Math.round(x), Math.round(y)) });
    }
    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.draw();

    for (let i = puffs.length - 1; i >= 0; i--) {
      const q = puffs[i];
      q.age += dt;
      const life = q.kind === 'dust' ? 0.7 : 2.2;
      if (q.age > life) { puffs.splice(i, 1); continue; }
      const f = q.age / life;
      const alpha = (1 - f) * (q.kind === 'dust' ? 0.8 : 0.55);
      const sz = q.kind === 'dust' ? 2 : 1 + Math.floor(f * 3);
      ctx.fillStyle = q.kind === 'dust' ? `rgba(214,190,140,${alpha})` : `rgba(210,205,200,${alpha})`;
      const px = q.x + q.dx * (q.kind === 'dust' ? f : f * 2);
      const py = q.y - (q.kind === 'dust' ? f * 7 : f * 14);
      ctx.fillRect(Math.round(px), Math.round(py), sz, sz);
    }

    ctx.restore();

    if (nightAmt > 0.01) {
      ctx.fillStyle = `rgba(14,20,56,${0.38 * nightAmt})`;
      ctx.fillRect(0, 0, cam.w, cam.h);
    }
  }

  function frameTick(t) {
    requestAnimationFrame(frameTick);
    if (document.hidden) { lastT = t; return; }
    const elapsed = t - lastT;
    if (elapsed < FRAME_MS) return;
    lastT = t;
    const dt = Math.min(elapsed, 120) / 1000;
    nightAmt += ((awake ? 0 : 1) - nightAmt) * Math.min(1, dt * 1.6);
    const t0 = performance.now();
    for (const w of walkers) stepWalker(w, dt);
    drawScene(dt, t);
    drawMs += (performance.now() - t0 - drawMs) * 0.1;
  }

  // ---------- API ----------
  function syncBuildings() {
    vis = visible(placed, built);
    isl = island(vis);
  }

  const ro = new ResizeObserver(() => layoutCamera());
  ro.observe(frame);
  syncBuildings();
  layoutCamera();
  requestAnimationFrame(frameTick);

  return {
    /** view = { built, units, focus } vindos do servidor. */
    update(view) {
      focus = view.focus || focus;
      units = view.units || units;
      const nb = view.built || {};
      const now = performance.now();
      let grew = false;
      for (const [id, n] of Object.entries(nb)) {
        const prev = built[id] || 0;
        if (n > prev) {
          grew = true;
          if (!first) for (let k = prev; k < n; k++) rising.set(`${id}:${k}`, now);
        }
      }
      if (JSON.stringify(nb) !== JSON.stringify(built)) {
        built = { ...nb };
        syncBuildings();
        layoutCamera();
      }
      reconcileWalkers(first);
      first = false;
      return grew;
    },
    setAwake(v) { awake = v; },
    /** Roda n quadros sincronos e devolve o custo medio em ms (medicao de desempenho). */
    bench(n = 120) {
      const t0 = performance.now();
      for (let i = 0; i < n; i++) { for (const w of walkers) stepWalker(w, 0.033); drawScene(0.033, t0 + i * 33); }
      return (performance.now() - t0) / n;
    },
    get info() { return { rising: rising.size, treesOutside: trees.filter(t => !inIsland(t.gx, t.gy)).length, trees: trees.length, offStreet: walkers.filter(w => !isStreet(Math.floor(w.u), Math.floor(w.v))).length, drawMs: Math.round(drawMs * 100) / 100, scale: cam.s, pan: cam.pan, island: isl, buildings: vis.length, walkers: walkers.length, awake, nightAmt }; },
  };
}
