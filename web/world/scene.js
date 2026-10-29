import { A, frame } from './assets.js';
import { createNav } from './nav.js';
import { createCrowd } from './actors.js';
import {
  STAGE_W, STAGE_H, TILE, ISLAND, LAND, STAGE_NAMES, SEA_ROCKS, DUCK,
  stageFor, elementsAt, rectOf, crowdCaps, depositAt, treeField, grassTile,
} from './stages.js';

/*
 * A cena: uma ilha pequena, vista de cima, onde um nucleo evolui por estagios (ver stages.js).
 * Camera fixa no palco 1340x800 de um tablet deitado, em tamanho nativo (1:1).
 */

export { STAGE_W, STAGE_H };
const FOAM_FPS = 6;
const BUILD_MS = 3200;       // quanto leva a chegada de um elemento novo (o aldeao martela enquanto isso)

export function createScene(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = STAGE_W; canvas.height = STAGE_H;
  ctx.imageSmoothingEnabled = false;

  const trees = treeField();
  const aliveTrees = trees.filter(t => !t.stump);
  const flags = { clouds: true, shadows: true };   // depuracao
  const rising = new Map();      // id do elemento -> instante em que comecou a aparecer
  const navRef = { nav: null };
  const crowd = createCrowd(navRef);
  const puffs = [];
  const clouds = [0, 1, 2, 3].map(i => ({ x: i * 420 - 300, y: 120 + ((i * 331) % 560), v: 1 + (i * 3) % 8, speed: 12 + (i * 5) % 10 }));
  const edgeTiles = [];

  let stage = 0;
  let units = {};
  let focus = 'food';
  let awake = false;
  let night = 1;
  let first = true;
  let ground = null, land = null;
  let drawMs = 0;
  const t0 = performance.now();
  const api = { onStage: null };

  // ---------- terreno pre-desenhado ----------
  function buildGround() {
    const mk = () => { const g = document.createElement('canvas'); g.width = 21 * TILE; g.height = 13 * TILE; const c = g.getContext('2d'); c.imageSmoothingEnabled = false; return [g, c]; };
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
    ground = w; land = l;
  }

  // ---------- navegacao ----------
  const els = () => elementsAt(stage);
  function buildNav() {
    navRef.nav = createNav({
      width: STAGE_W, height: STAGE_H, rects: els().map(rectOf).filter(Boolean), inflate: 4,
      landRect: { x0: LAND.x0 + 24, y0: LAND.y0 + 24, x1: LAND.x1 - 24, y1: LAND.y1 - 24 },
    });
  }

  const progress = e => {
    const s = rising.get(e.id);
    return s === undefined ? 1 : Math.min(1, (performance.now() - s) / BUILD_MS);
  };

  // ---------- desenho dos elementos ----------
  const items = [];
  const push = (y, fn) => items.push({ y, fn });

  function shadow(x, y, w, p) {
    if (!flags.shadows) return;
    ctx.globalAlpha = 0.32 * Math.min(1, p * 2);
    ctx.drawImage(A.shadow.img, x - w / 2, y - w * 0.27, w, w * 0.5);
    ctx.globalAlpha = 1;
  }

  function drawSprite(e) {
    const s = A[`${e.sprite}_${e.color}`], sc = e.scale || 1;
    const w = s.fw * sc, h = s.fh * sc, p = progress(e), r = rectOf(e);
    shadow(e.x, e.y, (r ? r.x1 - r.x0 : w * 0.6) * 1.35, p);
    if (p >= 1) { ctx.drawImage(s.img, e.x - w / 2, e.y - h + 6, w, h); return; }
    // chegada: o elemento "sobe" do chao, de baixo para cima
    const k = 1 - Math.pow(1 - p, 2), cut = Math.floor(s.fh * (1 - k));
    if (s.fh - cut > 0) ctx.drawImage(s.img, 0, cut, s.fw, s.fh - cut, e.x - w / 2, e.y - h + 6 + cut * sc, w, (s.fh - cut) * sc);
  }

  function drawElement(e, t) {
    switch (e.kind) {
      case 'fogueira': {
        ctx.drawImage(A.woodRes.img, e.x - 44, e.y - 26);
        ctx.drawImage(A.woodRes.img, e.x + 8, e.y - 20);
        const f = A.fire3, i = Math.floor(t * 10) % f.n;
        ctx.drawImage(f.img, i * f.fw, 0, f.fw, f.fh, e.x - 48, e.y - 96, f.fw * 1.5, f.fh * 1.5);
        break;
      }
      case 'pasto': {
        frame(ctx, A.bush2, t * 6, e.x - 72, e.y - 124);
        frame(ctx, A.sheepGrass, t * 8, e.x - 78, e.y - 108);
        frame(ctx, A.sheepGrass, t * 8 + 5, e.x - 12, e.y - 100, true);
        break;
      }
      case 'ouro': {
        [[-50, 8, 4], [38, -4, 2], [-4, 32, 6]].forEach(([dx, dy, n]) => ctx.drawImage(A['gold' + n].img, e.x + dx - 64, e.y + dy - 118));
        break;
      }
      case 'braseiro': frame(ctx, A.fire2, t * 10, e.x - 32, e.y - 218); break;
      default: drawSprite(e);
    }
  }

  // ---------- simulacao (aldeoes, obras, noite) ----------
  function tick(dt) {
    night += ((awake ? 0 : 1) - night) * Math.min(1, dt * 1.5);
    const live = els();
    const pos = ids => live.filter(e => ids.includes(e.id)).map(e => ({ x: e.x, y: e.y }));
    const sites = live.filter(e => progress(e) < 1);
    for (const [id, s] of rising) if (performance.now() - s >= BUILD_MS) rising.delete(id);
    // pontos de ronda espalhados diante do castelo (um so ponto amontoava todo mundo na porta)
    const center = [{ x: 560, y: 550 }, { x: 790, y: 550 }, { x: 672, y: 575 }, { x: 600, y: 500 }, { x: 750, y: 500 }];
    crowd.update(dt, {
      awake, focus, door: depositAt(stage), sites,
      trees: aliveTrees, mines: pos(['ouro']), pastures: pos(['pasto']), sawmills: [],
      soldierPosts: [...pos(['quartel', 'castelo', 'castelo_ouro', 'torre1', 'torre2', 'torre3']), ...center],
      monkPosts: [...pos(['mosteiro', 'catedral']), ...center],
    });
    for (const e of sites) if (Math.random() < dt * 9) puffs.push({ x: e.x + (Math.random() - 0.5) * 90, y: e.y - 8, age: 0 });
    for (let i = puffs.length - 1; i >= 0; i--) { puffs[i].age += dt; if (puffs[i].age > 0.8) puffs.splice(i, 1); }
  }

  function drawScene(now) {
    const t = (now - t0) / 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(ground, 0, 0);
    // espuma animada: um quadro de 192x192 centrado em cada tile da borda, por baixo da grama
    for (const [tx, ty] of edgeTiles) frame(ctx, A.foam, t * FOAM_FPS + (tx * 3 + ty) * 0.35, tx * TILE + TILE / 2 - 96, ty * TILE + TILE / 2 - 96);
    ctx.drawImage(land, 0, 0);
    for (const r of SEA_ROCKS) frame(ctx, A['waterRocks' + (1 + r.v)], t * 6 + r.v * 3, r.x - 32, r.y - 32);
    frame(ctx, A.duck, t * 3, DUCK.x - 16, DUCK.y - 16 + Math.sin(t * 1.8) * 2.5);

    items.length = 0;
    crowd.drawables(ctx, push, 1);
    for (const tr of trees) {
      push(tr.y, () => {
        if (tr.stump) { const s = A['stump' + (1 + tr.type % 4)]; ctx.drawImage(s.img, tr.x - 96, tr.y - 232); return; }
        const s = A['tree' + tr.type];
        frame(ctx, s, t * 6 + tr.phase, tr.x - 96, tr.y - s.fh + 14);
      });
    }
    for (const e of els()) push(e.y, () => drawElement(e, t));
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.fn();

    for (const q of puffs) frame(ctx, A.dust1, q.age * 10, q.x - 32, q.y - 48);

    // nuvens: translucidas, derivam para a direita
    if (flags.clouds) {
      ctx.globalAlpha = 0.5;
      for (const c of clouds) ctx.drawImage(A['cloud' + c.v].img, c.x, c.y);
      ctx.globalAlpha = 1;
    }
    if (night > 0.01) { ctx.fillStyle = `rgba(14,20,56,${0.42 * night})`; ctx.fillRect(0, 0, STAGE_W, STAGE_H); }
  }

  buildGround();
  buildNav();

  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const m = performance.now();
    tick(dt);
    for (const c of clouds) { c.x += c.speed * dt; if (c.x > STAGE_W + 300) c.x = -700; }
    drawScene(now);
    drawMs += (performance.now() - m - drawMs) * 0.1;
  }
  requestAnimationFrame(loop);

  // getters precisam ser copiados como getters (Object.assign congelaria o valor da criacao)
  const methods = {
    /** view = { summary: { level, ... }, units, focus } vindo do servidor. */
    update(view) {
      focus = view.focus || focus;
      units = view.units || units;
      const next = stageFor(view.summary?.level ?? 0);
      if (next !== stage) {
        const before = new Set(els().map(e => e.id));
        const prev = stage;
        stage = next;
        // so anima a chegada se nao for o carregamento inicial
        if (!first) {
          const now = performance.now();
          for (const e of els()) if (!before.has(e.id)) rising.set(e.id, now);
          api.onStage?.(stage, STAGE_NAMES[stage], prev);
        }
        buildNav();
      }
      crowd.sync(units, depositAt(stage), crowdCaps(stage));
      first = false;
    },
    setAwake(v) { awake = v; },
    get stage() { return stage; },
    flags,
    advance(sec, step = 0.05) { for (let s = 0; s < sec; s += step) { tick(step); for (const c of clouds) c.x += c.speed * step; } },
    drawNow() { drawScene(performance.now()); },
    bench(n = 60) { const s0 = performance.now(); for (let i = 0; i < n; i++) drawScene(s0 + i * 33); return (performance.now() - s0) / n; },
    get info() { return { stage, name: STAGE_NAMES[stage], folks: crowd.count(), rising: rising.size, night, drawMs: Math.round(drawMs * 100) / 100 }; },
  };
  Object.defineProperties(api, Object.getOwnPropertyDescriptors(methods));
  return api;
}
