import { A, frame } from './assets.js';

/*
 * Habitantes da ilha. Aldeoes (peao) fazem o ciclo de RTS: pegar a ferramenta, ir ao
 * recurso, trabalhar (cortar/minerar/cacar/construir), voltar CARREGANDO e depositar.
 * Soldados, arqueiros, lanceiros e monges patrulham e treinam. Tudo a 10 fps (como o pacote).
 */

const FPS = 10;
const SPEED = { pawn: 112, warrior: 88, archer: 88, lancer: 150, monk: 74 };
const CAP = { pawn: 26, warrior: 8, archer: 6, lancer: 4, monk: 3 };
const KIND = {
  aldeao: 'pawn', espadachim: 'warrior', campeao: 'warrior', arcabuzeiro: 'warrior',
  arqueiro: 'archer', besteiro: 'archer', cavaleiro_leve: 'lancer', cavaleiro: 'lancer', paladino: 'lancer', monge: 'monk',
};

// Para cada oficio: ferramenta na mao ao ir, animacao de trabalho, carga na volta, golpes e recurso do jogo.
const JOBS = {
  wood: { tool: ' Axe', work: 'pawnDoAxe', carry: ' Wood', swings: 5 },
  gold: { tool: ' Pickaxe', work: 'pawnDoPickaxe', carry: ' Gold', swings: 4 },
  stone: { tool: ' Pickaxe', work: 'pawnDoPickaxe', carry: ' Gold', swings: 4 },
  food: { tool: ' Knife', work: 'pawnDoKnife', carry: ' Meat', swings: 4 },
  build: { tool: ' Hammer', work: 'pawnDoHammer', carry: '', swings: 8 },
};

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

export function createCrowd(ref) {
  // ref.nav e trocado pela cena quando a vila muda (novos predios = novos obstaculos)
  const folks = [];

  function spawn(kind, x, y) {
    folks.push({ kind, x, y, path: [], state: 'idle', wait: rnd(0, 2), t: rnd(0, 5), dir: 1, job: null, carry: '', speed: SPEED[kind] * rnd(0.9, 1.1), swing: 0 });
  }

  /** Ajusta a quantidade de cada tipo ao que o jogo informa. */
  function sync(units, door, caps = CAP) {
    const want = {};
    for (const [id, n] of Object.entries(units || {})) { const k = KIND[id]; if (k) want[k] = (want[k] || 0) + n; }
    for (const kind of Object.keys(CAP)) {
      const target = Math.min(want[kind] || 0, caps[kind] ?? CAP[kind]);
      let have = folks.filter(f => f.kind === kind).length;
      while (have < target) { spawn(kind, door.x + rnd(-60, 60), door.y + rnd(0, 40)); have++; }
      while (have > target) { folks.splice(folks.findIndex(f => f.kind === kind), 1); have--; }
    }
  }

  // ---------- escolha de trabalho ----------
  function chooseJob(f, w) {
    const options = [];
    if (w.sites.length) options.push(['build', 3]);
    if (w.trees.length) options.push(['wood', w.focus === 'wood' ? 5 : 2]);
    if (w.mines.length) { options.push(['gold', w.focus === 'gold' ? 5 : 2]); options.push(['stone', w.focus === 'stone' ? 5 : 1]); }
    if (w.pastures.length) options.push(['food', w.focus === 'food' ? 5 : 2]);
    if (!options.length) return null;
    const total = options.reduce((n, o) => n + o[1], 0);
    let r = Math.random() * total;
    for (const [job, wt] of options) { if ((r -= wt) < 0) return job; }
    return options[0][0];
  }

  function targetFor(job, w) {
    switch (job) {
      // look = x do que ele vai trabalhar: ao chegar, o aldeao vira o rosto para la
      case 'build': { const s = pick(w.sites); return { x: s.x + rnd(-40, 40), y: s.y + 26, look: s.x }; }
      case 'wood': { const t = pick(w.trees); return { x: t.x + (Math.random() < 0.5 ? -38 : 38), y: t.y + 6, look: t.x }; }
      case 'gold': case 'stone': { const m = pick(w.mines); return { x: m.x + rnd(-70, 70), y: m.y + rnd(18, 40), look: m.x }; }
      case 'food': { const p = pick(w.pastures); return { x: p.x + rnd(-60, 60), y: p.y + 14, look: p.x }; }
      default: return null;
    }
  }

  function depositFor(job, f, w) {
    if (job === 'wood' && w.sawmills.length) {
      const s = w.sawmills.reduce((b, c) => (Math.hypot(c.x - f.x, c.y - f.y) < Math.hypot(b.x - f.x, b.y - f.y) ? c : b));
      return { x: s.x + 20, y: s.y + 28 };
    }
    return w.door;
  }

  function go(f, x, y) {
    f.path = ref.nav.find(f.x, f.y, x, y);
    return f.path.length > 0;
  }

  // ---------- maquina de estados ----------
  function updatePawn(f, dt, w) {
    switch (f.state) {
      case 'idle': {
        f.wait -= dt;
        if (f.wait > 0 || !w.awake) return;
        const job = chooseJob(f, w);
        const tgt = job && targetFor(job, w);
        if (job && tgt && go(f, tgt.x, tgt.y)) { f.job = job; f.look = tgt.look; f.state = 'goto'; f.carry = ''; } else f.wait = rnd(1, 3);
        return;
      }
      case 'goto': if (move(f, dt)) { f.state = 'work'; f.t = 0; f.swing = 0; if (f.look !== undefined && Math.abs(f.look - f.x) > 4) f.dir = f.look > f.x ? 1 : -1; } return;
      case 'work': {
        const J = JOBS[f.job], s = A[J.work];
        f.swing = f.t * FPS / s.n;
        if (f.swing >= J.swings) {
          f.state = 'return';
          f.carry = J.carry;
          const d = depositFor(f.job, f, w);
          if (!go(f, d.x, d.y)) { f.state = 'idle'; f.wait = 1; f.carry = ''; }
        }
        return;
      }
      case 'return': if (move(f, dt)) { f.carry = ''; f.state = 'idle'; f.wait = rnd(0.2, 1.2); f.job = null; } return;
    }
  }

  function updateSoldier(f, dt, w) {
    if (f.state === 'idle') {
      f.wait -= dt;
      if (f.wait > 0) return;
      const posts = (f.kind === 'monk' ? w.monkPosts : w.soldierPosts);
      if (Math.random() < 0.4 && f.kind !== 'monk') { f.state = 'train'; f.t = 0; f.wait = rnd(1.2, 2.5); return; }
      if (posts.length && w.awake !== false) {
        const p = pick(posts);
        if (go(f, p.x + rnd(-70, 70), p.y + rnd(10, 60))) { f.state = 'goto'; return; }
      }
      f.wait = rnd(2, 5);
    } else if (f.state === 'goto') {
      if (move(f, dt)) { f.state = 'idle'; f.wait = rnd(2, 6); }
    } else if (f.state === 'train') {
      f.wait -= dt;
      if (f.wait <= 0) { f.state = 'idle'; f.wait = rnd(2, 5); }
    }
  }

  /** Anda um passo ao longo do caminho; true ao chegar. */
  function move(f, dt) {
    if (!f.path.length) return true;
    const p = f.path[0];
    const dx = p.x - f.x, dy = p.y - f.y, d = Math.hypot(dx, dy), step = f.speed * dt;
    if (dx) f.dir = dx > 0 ? 1 : -1;
    if (d <= step) { f.x = p.x; f.y = p.y; f.path.shift(); return !f.path.length; }
    f.x += (dx / d) * step; f.y += (dy / d) * step;
    return false;
  }

  function update(dt, w) {
    for (const f of folks) { f.t += dt; (f.kind === 'pawn' ? updatePawn : updateSoldier)(f, dt, w); }
  }

  // ---------- desenho ----------
  function sheetOf(f) {
    const moving = f.state === 'goto' || f.state === 'return';
    switch (f.kind) {
      case 'pawn': {
        if (f.state === 'work') return { s: A[JOBS[f.job].work], anchor: [96, 132] };
        const tool = f.state === 'goto' ? JOBS[f.job].tool : f.state === 'return' ? f.carry : '';
        return { s: A[(moving ? 'pawnRun' : 'pawnIdle') + tool], anchor: [96, 132] };
      }
      case 'warrior': return { s: f.state === 'train' ? A.warriorAtk : moving ? A.warriorRun : A.warriorIdle, anchor: [96, 132] };
      case 'archer': return { s: f.state === 'train' ? A.archerShoot : moving ? A.archerRun : A.archerIdle, anchor: [96, 132] };
      case 'lancer': return { s: moving ? A.lancerRun : A.lancerIdle, anchor: [160, 190] };
      case 'monk': return { s: moving ? A.monkRun : A.monkIdle, anchor: [96, 132] };
    }
  }

  function drawables(ctx, push, boost = 1) {
    for (const f of folks) {
      push(f.y, () => {
        const { s, anchor } = sheetOf(f);
        if (!s) return;
        const flip = f.dir < 0;
        // ancorado nos pes; `boost` aumenta as unidades quando a camera esta longe (como nos RTS)
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(boost, boost);
        frame(ctx, s, f.t * FPS, -(flip ? s.fw - anchor[0] : anchor[0]), -anchor[1], flip);
        ctx.restore();
      });
    }
  }

  return { sync, update, drawables, folks, spawn, count: () => folks.length };
}
