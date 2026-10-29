import { loadAssets } from './world/assets.js';
import { createScene } from './world/scene.js';
import { loadSkins, paintAll } from './ui/skins.js';

const $ = id => document.getElementById(id);
const nf = new Intl.NumberFormat('pt-BR');
const AWAKE_MS = 90_000;   // sem tokens ha mais que isso -> a aldeia dorme
const ACTING_MS = 10_000;  // obra/treino recente conta como acordada
const LOG_MAX = 5;
const UI = 'assets/tiny-swords/Tiny Swords (Free Pack)/UI Elements/UI Elements/';
const icon = n => encodeURI(`${UI}Icons/${n}.png`);

let content = null;
let scene = null;
let view = null;
let connected = false;
let lastIngest = 0;
let lastAction = 0;
let quietTimer = 0;
const LOG_VISIBLE_MS = 12_000;

// ---------- palco 1340x800 escalado para a tela ----------
function fit() {
  const k = Math.min(innerWidth / 1340, innerHeight / 800);
  $('stage').style.setProperty('--k', k);
}
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
const hhmm = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const nameOf = id => content?.names?.[id] ?? id;

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
  const st = $('status');
  st.classList.toggle('offline', !connected);
  st.classList.toggle('awake', awake);
  $('status-text').textContent = !connected ? 'Sem sinal do servidor' : awake ? 'A aldeia trabalha' : 'A aldeia dorme';
  scene?.setAwake(awake);
}

// ---------- cronica ----------
function log(iconName, text, cls = '') {
  const ol = $('log');
  ol.querySelector('.empty')?.remove();
  const li = document.createElement('li');
  if (cls) li.className = cls;
  li.innerHTML = `<img src="${icon(iconName)}" alt=""><span></span>`;
  li.querySelector('span').textContent = `${hhmm()}  ${text}`;
  ol.prepend(li);
  while (ol.children.length > LOG_MAX) ol.lastChild.remove();
  // aparece com a novidade e some depois de um tempo
  $('log-box').classList.remove('quiet');
  clearTimeout(quietTimer);
  quietTimer = setTimeout(() => $('log-box').classList.add('quiet'), LOG_VISIBLE_MS);
}

// tokens chegam em rajadas: junta numa linha so
let burst = null;
function addTokens(ev) {
  if (!burst) {
    burst = { out: 0, cache: 0, n: 0 };
    setTimeout(() => {
      log('Icon_07', `+${compact(burst.out)} saída, +${compact(burst.cache)} cache`, 'tok');
      burst = null;
    }, 1500);
  }
  burst.out += ev.output; burst.cache += ev.cacheRead; burst.n++;
}

const ACTIONS = {
  build: id => ['Icon_01', `Construída: ${nameOf(id)}`],
  train: id => ['Icon_05', `Treinado: ${nameOf(id)}`],
  research: id => ['Icon_11', `Pesquisa: ${nameOf(id)}`],
  advance: id => ['Icon_06', `Nova era: ${nameOf(id)}`],
};

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
    if (ev.type === 'tokens') addTokens(ev);
    else if (ev.type === 'session:new') log('Icon_12', 'Nova sessão: um imigrante chegou');
    else if (ev.type === 'subagent:new') log('Icon_08', 'Um explorador partiu em missão');
    renderStatus();
  });
  es.addEventListener('action', e => {
    const a = JSON.parse(e.data);
    lastAction = Date.now();
    const [ic, text] = (ACTIONS[a.type] || (() => ['Icon_01', a.type]))(a.id);
    log(ic, text, a.type === 'advance' ? 'big' : '');
    if (a.type === 'advance') {
      const stage = $('stage');
      stage.classList.remove('flash'); void stage.offsetWidth; stage.classList.add('flash');
    }
    renderStatus();
  });
}

// ---------- inicio ----------
async function start() {
  $('status-text').textContent = 'Carregando';
  try {
    await Promise.all([loadSkins(), loadAssets(), document.fonts?.ready]);
  } catch (err) {
    console.error(err);
    $('missing').hidden = false;
    return;
  }
  document.querySelectorAll('img[data-icon]').forEach(el => { el.src = icon(el.dataset.icon); });
  document.querySelectorAll('img[data-rock]').forEach(el => { el.src = encodeURI('assets/tiny-swords/Tiny Swords (Free Pack)/Terrain/Decorations/Rocks/Rock1.png'); });
  paintAll();
  $('log-box').classList.add('quiet');

  try {
    content = await (await fetch('/api/content')).json();
  } catch {
    $('status-text').textContent = 'Sem sinal do servidor';
    return setTimeout(start, 3000);
  }
  scene = createScene($('world'), content);
  window.__scene = scene; // depuracao no console
  requestAnimationFrame(tick);
  setInterval(renderStatus, 2000);
  connect();
}
start();
