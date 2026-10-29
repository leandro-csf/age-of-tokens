import { A, frame } from './assets.js';
import { createNav } from './nav.js';
import { createCrowd } from './actors.js';
import {
  TILE, WORLD_W, WORLD_H, ISLAND, CENTER, FOOT, layoutAll, visible, extent, treeField, grassTile, hash,
} from './layout.js';

/*
 * A cena: ilha de grama cercada de agua, vista de cima (3/4), no palco logico 1340x800
 * de um tablet deitado. A camera comeca em tamanho nativo (1:1) e recua com uma
 * transicao suave quando a aldeia cresce, ate mostrar a ilha inteira (0,5x).
 */

export const STAGE_W = 1340;
export const STAGE_H = 800;
const ZOOMS = [1, 0.5];
const FOAM_FPS = 6;
const TREE_FPS = 6;
const BUILD_MS = 3200;           // quanto leva uma obra (o aldeao martela enquanto isso)
const DOOR = { x: CENTER.x, y: CENTER.y + 55 + 30 };

// Qual sprite desenha cada tipo de predio. [sprite, cor, escala]
const LOOK = {
  centro: ['Castle', 'Blue', 1], castelo: ['Castle', 'Red', 1.08], maravilha: ['Castle', 'Yellow', 1.32],
  mosteiro: ['Monastery', 'Blue', 1], catedral: ['Monastery', 'Purple', 1.18],
  quartel: ['Barracks', 'Blue', 1], torre: ['Tower', 'Blue', 1],
  ferraria: ['House1', 'Black', 1], mercado: ['House3', 'Yellow', 1], universidade: ['House2', 'Purple', 1],
  serraria: ['House2', 'Blue', 1],
};
const HOUSES = ['House1', 'House3', 'House2'];

export function createScene(canvas, content) {
  const ctx = canvas.getContext('2d');
  canvas.width = STAGE_W; canvas.height = STAGE_H;
  const placed = layoutAll(content.plan);
  const trees = treeField();
  let built = {};
  let units = {};
  let focus = 'food';
  let awake = false;
  let vis = visible(placed, built);
  const cam = { x: CENTER.x, y: CENTER.y, z: 1 };
  let target = { ...cam };
  let ground = null;
  let t0 = performance.now();
  let drawMs = 0;
  let night = 1;
  let first = true;
  const rising = new Map();      // "id:k" -> instante em que a obra comecou
  const navRef = { nav: null };
  const crowd = createCrowd(navRef);
  const puffs = [];
  const aliveTrees = trees.filter(t => !t.stump);

  // ---------- terreno pre-desenhado: agua (fundo) e terra (grama), com a espuma animada entre as duas ----------
  let land = null;
  const edgeTiles = [];
  function buildGround() {
    const mk = () => { const g = document.createElement('canvas'); g.width = WORLD_W * TILE; g.height = WORLD_H * TILE; const c = g.getContext('2d'); c.imageSmoothingEnabled = false; return [g, c]; };
    const [w, wc] = mk();
    wc.fillStyle = wc.createPattern(A.waterBg.img, 'repeat');
    wc.fillRect(0, 0, w.width, w.height);
    const [l, lc] = mk();
    for (let ty = ISLAND.y0; ty <= ISLAND.y1; ty++) {
      for (let tx = ISLAND.x0; tx <= ISLAND.x1; tx++) {
        const [col, row] = grassTile(tx, ty);
        lc.drawImage(A.tilemap.img, col * TILE, row * TILE, TILE, TILE, tx * TILE, ty * TILE, TILE, TILE);
        if (tx === ISLAND.x0 || tx === ISLAND.x1 || ty === ISLAND.y0 || ty === ISLAND.y1) edgeTiles.push([tx, ty]);
      }
    }
    land = l;
    return w;
  }

  function buildNav() {
    const rects = vis.filter(b => FOOT[b.id]).map(b => { const [w, h] = FOOT[b.id]; return { x0: b.x - w / 2, x1: b.x + w / 2, y0: b.y - h, y1: b.y }; });
    navRef.nav = createNav({
      width: WORLD_W * TILE, height: WORLD_H * TILE, rects, inflate: 4,
      landRect: { x0: ISLAND.x0 * TILE + 24, y0: ISLAND.y0 * TILE + 24, x1: (ISLAND.x1 + 1) * TILE - 24, y1: (ISLAND.y1 + 1) * TILE - 24 },
    });
  }

  // ---------- camera ----------
  function aim() {
    const e = extent(vis);
    const w = e.x1 - e.x0 + 140, h = e.y1 - e.y0 + 70;
    const z = ZOOMS.find(k => w * k <= STAGE_W && h * k <= STAGE_H) ?? ZOOMS[ZOOMS.length - 1];
    if (z === 1) target = { x: (e.x0 + e.x1) / 2, y: (e.y0 + e.y1) / 2 + 30, z };
    else target = { x: WORLD_W * TILE / 2, y: WORLD_H * TILE / 2, z };
  }

  // ---------- desenho de entidades ----------
  const items = [];
  const push = (y, fn) => items.push({ y, fn });

  function progress(b) {
    const t0 = rising.get(`${b.id}:${b.k}`);
    return t0 === undefined ? 1 : Math.min(1, (performance.now() - t0) / BUILD_MS);
  }

  function drawBuilding(b, t) {
    const [kind, color, sc] = b.id === 'casa' ? [HOUSES[b.k % 3], 'Blue', 1] : (LOOK[b.id] || ['House1', 'Blue', 1]);
    const s = A[`${kind}_${color}`];
    if (!s) return;
    const w = s.fw * sc, h = s.fh * sc;
    const p = progress(b, t);
    if (p >= 1) { ctx.drawImage(s.img, b.x - w / 2, b.y - h + 6, w, h); }
    else {
      // obra: a construcao "sobe" do chao, de baixo para cima
      const e = 1 - Math.pow(1 - p, 2), cut = Math.floor(s.fh * (1 - e));
      if (s.fh - cut > 0) ctx.drawImage(s.img, 0, cut, s.fw, s.fh - cut, b.x - w / 2, b.y - h + 6 + cut * sc, w, (s.fh - cut) * sc);
    }
    if (b.id === 'ferraria') frame(ctx, A.fire2, t * 10, b.x + 18, b.y - 78);
  }

  function drawExtras(b, t) {
    if (b.id === 'serraria') {
      ctx.drawImage(A.woodRes.img, b.x + 38, b.y - 30);
      ctx.drawImage(A.woodRes.img, b.x + 54, b.y - 20);
      ctx.drawImage(A.stump1.img, b.x - 120, b.y - 120, 96, 128);
    }
  }

  function drawFarm(b, t) {
    // pasto: arbustos e duas ovelhas pastando
    const s = A['bush' + (1 + b.k % 4)];
    frame(ctx, s, t * 6 + b.k, b.x - 64, b.y - 118);
    frame(ctx, A.sheepGrass, t * 8 + b.k * 3, b.x - 70, b.y - 104);
    frame(ctx, A.sheepGrass, t * 8 + b.k * 5 + 4, b.x - 16, b.y - 96, true);
  }

  function drawMine(b) {
    const offs = [[-46, 6, 4], [40, -4, 2], [-2, 30, 6]];
    offs.forEach(([dx, dy, type], i) => {
      const s = A['gold' + (1 + ((type + b.k) % 6))];
      ctx.drawImage(s.img, b.x + dx - 64, b.y + dy - 118);
    });
  }

  function drawWall(b) {
    const s = A['rock' + (1 + b.k % 4)];
    ctx.drawImage(s.img, b.x - 32, b.y - 58);
    ctx.drawImage(A['rock' + (1 + (b.k + 2) % 4)].img, b.x - 8, b.y - 46);
  }

  /** Avanca a simulacao (aldeoes, obras, noite) em dt segundos. Separado do desenho para poder ser testado. */
  function tick(dt) {
    // habitantes: o que existe agora no mapa e o que ha para fazer
    night += ((awake ? 0 : 1) - night) * Math.min(1, dt * 1.5);
    const posts = id => vis.filter(b => id.includes(b.id));
    const sites = [];
    for (const b of vis) { if (progress(b) < 1) sites.push(b); }
    for (const [key, t0] of rising) { if (performance.now() - t0 >= BUILD_MS) rising.delete(key); }
    crowd.update(dt, {
      awake, focus, door: DOOR, sites,
      trees: aliveTrees, mines: posts(['mina']), pastures: posts(['fazenda']), sawmills: posts(['serraria']),
      soldierPosts: [...posts(['quartel', 'torre']), { x: CENTER.x, y: CENTER.y + 100 }],
      monkPosts: [...posts(['mosteiro', 'catedral']), { x: CENTER.x - 60, y: CENTER.y + 110 }],
    });
    for (const b of sites) if (Math.random() < dt * 9) puffs.push({ x: b.x + (Math.random() - 0.5) * 90, y: b.y - 8, age: 0 });

  }

  function drawScene(now) {
    const t = (now - t0) / 1000;
    // camera: aproxima do alvo (suave)
    const k = 1 - Math.exp(-3.2 * Math.min(0.1, (drawScene.dt || 0.016)));
    cam.x += (target.x - cam.x) * k; cam.y += (target.y - cam.y) * k; cam.z += (target.z - cam.z) * k;
    if (Math.abs(target.z - cam.z) < 0.002) cam.z = target.z;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#4a93a6';
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    const z = cam.z;
    ctx.setTransform(z, 0, 0, z, STAGE_W / 2 - cam.x * z, STAGE_H / 2 - cam.y * z);
    ctx.imageSmoothingEnabled = z !== 1;
    ctx.imageSmoothingQuality = 'high';

    // agua, espuma animada (um quadro de 192x192 centrado em cada tile da borda) e a terra por cima
    ctx.drawImage(ground, 0, 0);
    const fr = t * FOAM_FPS;
    for (const [tx, ty] of edgeTiles) frame(ctx, A.foam, fr + (tx * 3 + ty) * 0.35, tx * TILE + TILE / 2 - 96, ty * TILE + TILE / 2 - 96);
    ctx.drawImage(land, 0, 0);

    const dt = Math.min(0.1, drawScene.dt || 0.016);
    tick(dt);

    items.length = 0;
    crowd.drawables(ctx, push);
    for (const tr of trees) {
      push(tr.y, () => {
        if (tr.stump) { const s = A['stump' + (1 + tr.type % 4)]; ctx.drawImage(s.img, tr.x - 96, tr.y - 232); return; }
        const s = A['tree' + tr.type];
        frame(ctx, s, fr + tr.phase, tr.x - 96, tr.y - s.fh + 14);
      });
    }
    for (const b of vis) {
      if (b.id === 'muralha') push(b.y, () => drawWall(b));
      else if (b.id === 'mina') push(b.y, () => drawMine(b));
      else if (b.id === 'fazenda') push(b.y - 40, () => drawFarm(b, t));
      else push(b.y, () => { drawBuilding(b, t); drawExtras(b, t); });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.fn();
    for (let i = puffs.length - 1; i >= 0; i--) {
      const q = puffs[i];
      q.age += dt;
      if (q.age > 0.8) { puffs.splice(i, 1); continue; }
      frame(ctx, A.dust1, q.age * 10, q.x - 32, q.y - 48);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (night > 0.01) { ctx.fillStyle = `rgba(14,20,56,${0.42 * night})`; ctx.fillRect(0, 0, STAGE_W, STAGE_H); }
  }

  ground = buildGround();
  aim();
  buildNav();
  cam.x = target.x; cam.y = target.y; cam.z = target.z;

  let raf = 0, last = performance.now();
  function loop(now) {
    raf = requestAnimationFrame(loop);
    drawScene.dt = (now - last) / 1000; last = now;
    const m0 = performance.now();
    drawScene(now);
    drawMs += (performance.now() - m0 - drawMs) * 0.1;
  }
  raf = requestAnimationFrame(loop);

  return {
    update(view) {
      focus = view.focus || focus;
      units = view.units || units;
      const nb = view.built || {};
      if (JSON.stringify(nb) !== JSON.stringify(built)) {
        const now = performance.now();
        if (!first) for (const [id, n] of Object.entries(nb)) for (let k = built[id] || 0; k < n; k++) rising.set(`${id}:${k}`, now);
        built = { ...nb }; vis = visible(placed, built); aim(); buildNav();
      }
      crowd.sync(units, DOOR);
      first = false;
    },
    setAwake(v) { awake = v; },
    bench(n = 60) { const s0 = performance.now(); for (let i = 0; i < n; i++) drawScene(s0 + i * 33); return (performance.now() - s0) / n; },
    get info() { return { folks: crowd.count(), rising: rising.size, night, zoom: cam.z, target: target.z, buildings: vis.length, drawMs: Math.round(drawMs * 100) / 100 }; },
    drawNow() { drawScene(performance.now()); },
    /** Salta a camera direto para o enquadramento alvo (testes). */
    snapCamera() { cam.x = target.x; cam.y = target.y; cam.z = target.z; },
    /** Avanca `sec` segundos de simulacao sem desenhar (testes e demonstracoes). */
    advance(sec, step = 0.05) { for (let t = 0; t < sec; t += step) tick(step); },
  };
}
