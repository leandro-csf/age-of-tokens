// Efeitos e bichos da cena. Puro (sem DOM): a logica roda no navegador e nos testes.
import { LAND, hash } from './stages.js';

// ---------- ovelhas que passeiam pelo pasto ----------
export const SHEEP_RX = 56;      // quanto se afastam do ponto de origem (px)
export const SHEEP_RY = 16;
export const SHEEP_SPEED = 22;   // px/s: devagar, como quem pasta

export function createSheep(homes, rng = Math.random) {
  return homes.map((h, i) => ({
    hx: h.x, hy: h.y, x: h.x, y: h.y, tx: h.x, ty: h.y,
    state: 'graze', t: 1 + rng() * 4, dir: i % 2 ? -1 : 1, phase: i * 3,
  }));
}

/** Pasta um tempo; sorteia um ponto perto da origem; anda ate la; volta a pastar. */
export function stepSheep(s, dt, rng = Math.random) {
  if (s.state === 'graze') {
    s.t -= dt;
    if (s.t <= 0) {
      s.tx = s.hx + (rng() * 2 - 1) * SHEEP_RX;
      s.ty = s.hy + (rng() * 2 - 1) * SHEEP_RY;
      s.state = 'walk';
    }
    return;
  }
  const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), step = SHEEP_SPEED * dt;
  if (dx) s.dir = dx > 0 ? 1 : -1;
  if (d <= step) { s.x = s.tx; s.y = s.ty; s.state = 'graze'; s.t = 3 + rng() * 4; }
  else { s.x += (dx / d) * step; s.y += (dy / d) * step; }
}

// ---------- particulas (faiscas, fumaca) ----------
/** Explosao dourada radial (a cerimonia da lenda). */
export function burst(n, cx, cy, rng = Math.random) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, sp = 80 + rng() * 260;
    out.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 40, life: 1.2 + rng() * 1.2, age: 0, gold: rng() < 0.7 });
  }
  return out;
}

/** Faisca que sobe devagar perto de (cx, cy): o brilho do castelo dourado. */
export function sparkle(cx, cy, rng = Math.random) {
  return { x: cx + (rng() - 0.5) * 230, y: cy + (rng() - 0.5) * 70, vx: (rng() - 0.5) * 10, vy: -(20 + rng() * 30), life: 1.4 + rng(), age: 0, gold: rng() < 0.75 };
}

/** Avanca as particulas e remove as que acabaram. `lift` negativo = sobem. */
export function stepParticles(list, dt, lift = -20) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.age += dt;
    if (p.age >= p.life) { list.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.985; p.vy = p.vy * 0.985 + lift * dt;
  }
}

// ---------- vaga-lumes (so de noite) ----------
/** Posicoes fixas e deterministicas sobre a ilha. */
export function fireflyField(n = 22) {
  const out = [];
  const w = LAND.x1 - LAND.x0 - 160, h = LAND.y1 - LAND.y0 - 160;
  for (let i = 0; i < n; i++) {
    const a = hash(i * 7 + 1, 91), b = hash(i * 13 + 5, 17);
    out.push({ x: LAND.x0 + 80 + (a % w), y: LAND.y0 + 80 + (b % h), phase: (a % 628) / 100 });
  }
  return out;
}
