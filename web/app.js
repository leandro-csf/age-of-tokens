import { loadAssets } from './world/assets.js';
import { createScene } from './world/scene.js';
import { loadSkins, paintAll } from './ui/skins.js';

const $ = id => document.getElementById(id);
const nf = new Intl.NumberFormat('pt-BR');
const AWAKE_MS = 90_000;   // sem tokens ha mais que isso -> a aldeia dorme
const ACTING_MS = 10_000;  // obra/treino recente conta como acordada
const TOAST_MS = 7_000;
const UI = 'assets/tiny-swords/Tiny Swords (Free Pack)/UI Elements/UI Elements/';
const icon = n => encodeURI(`${UI}Icons/${n}.png`);

let content = null;
let scene = null;
let view = null;
let connected = false;
let lastIngest = 0;
let lastAction = 0;
let toastTimer = 0;

// ---------- palco 1340x800 escalado para a tela ----------
function fit() { $('stage').style.setProperty('--k', Math.min(innerWidth / 1340, innerHeight / 800)); }
addEventListener('resize', fit);
fit();

// ---------- formatacao ----------
function compact(n) {
  n = Math.floor(n);
  const f = (v, s) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: v < 100 ? 1 : 0 })} ${s}`;
  if (n < 10_000) return nf.format(n);
  if (n < 1e6) return f(n / 1e3, 'mil');
  if (n < 1e9) return f(n / 1e6, 'mi');
  if (n < 1e12) return f(n / 1e9, 'bi');
  return f(n / 1e12, 'tri');
}

// ---------- numeros que rolam ate o valor ----------
const counters = new Map();
function setTarget(id, value) {
  if (!counters.has(id)) counters.set(id, { el: $(id), cur: value, target: value, shown: null });
  counters.get(id).target = value;
}
function tick() {
  for (const c of counters.values()) {
    const d = c.target - c.cur;
    c.cur = Math.abs(d) < 0.5 ? c.target : c.cur + d * 0.18;
    const text = compact(c.cur);
    if (text !== c.shown) { c.el.textContent = text; c.shown = text; }
  }
  requestAnimationFrame(tick);
}

// ---------- render ----------
function levelBounds(level) {
  const { base, ratio } = content.level;
  return { lo: level === 0 ? 0 : base * ratio ** level, hi: base * ratio ** (level + 1) };
}

function render() {
  if (!view || !content) return;
  const s = view.summary;
  $('era').textContent = s.era;
  const next = content.eras[s.eraIndex + 1];
  $('era-next').textContent = s.wonder
    ? 'Maravilha erguida: a aldeia pode virar lenda'
    : next ? `Rumo à ${next.name} no nível ${content.eras[s.eraIndex].nextAtLevel}` : 'Erga a Maravilha para virar lenda';

  $('level').textContent = s.level;
  const { lo, hi } = levelBounds(s.level);
  const pct = Math.max(0, Math.min(100, ((s.income - lo) / (hi - lo)) * 100));
  $('bar-fill').style.width = pct + '%';
  $('bar').setAttribute('aria-valuenow', Math.round(pct));
  $('bar-note').textContent = `renda ${compact(s.income)} · faltam ${compact(hi - s.income)}`;

  for (const r of ['food', 'wood', 'stone', 'gold']) {
    setTarget('v-' + r, view.res[r]);
    document.querySelector(`.chip[data-res="${r}"]`).classList.toggle('focus', view.focus === r);
  }
  $('s-pop').textContent = `${s.pop}/${s.popCap}`;
  $('s-build').textContent = nf.format(s.buildings);
  $('s-tech').textContent = `${view.techs}/${content.totalTechs}`;
  $('s-work').textContent = compact(view.work);
  setTarget('t-output', view.raw.output);
  setTarget('t-cacheRead', view.raw.cacheRead);
  setTarget('t-in', view.raw.input + view.raw.cacheCreation);
  setTarget('t-thinking', view.raw.thinking);

  scene?.update(view);
}

function renderStatus() {
  const now = Date.now();
  const awake = connected && (now - lastIngest < AWAKE_MS || now - lastAction < ACTING_MS);
  $('conn').hidden = connected;
  scene?.setAwake(awake);
}

// ---------- aviso de marcos ----------
function toast(iconName, text, cls = '') {
  const ol = $('log');
  const li = document.createElement('li');
  if (cls) li.className = cls;
  li.innerHTML = `<img src="${icon(iconName)}" alt=""><span></span>`;
  li.querySelector('span').textContent = text;
  ol.prepend(li);
  while (ol.children.length > 2) ol.lastChild.remove();
  $('toast').classList.remove('quiet');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.add('quiet'), TOAST_MS);
}

// ---------- detalhes ao tocar ----------
function toggleDetails(force) {
  const d = $('details');
  const open = force ?? d.hidden;
  d.hidden = !open;
  $('res-bar').setAttribute('aria-expanded', String(open));
  if (open) paintAll(d.parentElement);   // o painel foi medido escondido; repinta agora que tem tamanho
}
$('res-bar').addEventListener('click', () => toggleDetails());
$('details').addEventListener('click', () => toggleDetails(false));
addEventListener('keydown', e => { if (e.key === 'd' || e.key === 'D') toggleDetails(); if (e.key === 'Escape') toggleDetails(false); });

// ---------- stream ----------
function connect() {
  const es = new EventSource('/api/stream');
  es.onopen = () => { connected = true; renderStatus(); };
  es.onerror = () => { connected = false; renderStatus(); };

  es.addEventListener('snapshot', e => { view = JSON.parse(e.data); render(); renderStatus(); });
  es.addEventListener('state', e => { view = JSON.parse(e.data); render(); });
  es.addEventListener('ingest', e => {
    const ev = JSON.parse(e.data);
    lastIngest = Date.now();
    if (ev.type === 'session:new') toast('Icon_12', 'Nova sessão: um imigrante chegou');
    else if (ev.type === 'subagent:new') toast('Icon_08', 'Um explorador partiu em missão');
    renderStatus();
  });
  es.addEventListener('action', e => {
    const a = JSON.parse(e.data);
    lastAction = Date.now();
    if (a.type === 'advance') {
      toast('Icon_06', `Nova era: ${content?.names?.[a.id] ?? a.id}`, 'big');
      const stage = $('stage');
      stage.classList.remove('flash'); void stage.offsetWidth; stage.classList.add('flash');
    }
    renderStatus();
  });
}

// ---------- inicio ----------
async function start() {
  try {
    await Promise.all([loadSkins(), loadAssets(), document.fonts?.ready]);
  } catch (err) {
    console.error(err);
    $('missing').hidden = false;
    return;
  }
  document.querySelectorAll('img[data-icon]').forEach(el => { el.src = icon(el.dataset.icon); });
  document.querySelectorAll('img[data-rock]').forEach(el => { el.src = encodeURI('assets/tiny-swords/Tiny Swords (Free Pack)/Terrain/Decorations/Rocks/Rock1.png'); });
  $('details').hidden = false; paintAll(); $('details').hidden = true;   // pinta tudo com tamanho real
  $('toast').classList.add('quiet');

  try {
    content = await (await fetch('/api/content')).json();
  } catch {
    $('conn').hidden = false;
    return setTimeout(start, 3000);
  }
  scene = createScene($('world'));
  scene.onStage = (stage, name) => toast('Icon_06', `Sua aldeia evoluiu: ${name}`, 'big');
  window.__scene = scene; // depuracao no console
  requestAnimationFrame(tick);
  setInterval(renderStatus, 2000);
  connect();
}
start();
