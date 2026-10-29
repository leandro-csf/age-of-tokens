import { sprite, skyline } from './pixel.js';

const $ = id => document.getElementById(id);
const nf = new Intl.NumberFormat('pt-BR');
const AWAKE_MS = 90_000;   // sem tokens ha mais que isso -> a aldeia dorme
const ACTING_MS = 10_000;  // fazendo obra/treino recentemente conta como acordada
const LOG_MAX = 60;

let content = null;
let view = null;
let night = null;
let connected = false;
let lastIngest = 0;
let lastAction = 0;

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
const counters = new Map(); // id -> { el, cur, target, fmt }
function counter(id, fmt = compact) {
  if (!counters.has(id)) counters.set(id, { el: $(id), cur: 0, target: 0, fmt, shown: null });
  return counters.get(id);
}
function setTarget(id, value, fmt) {
  const c = counter(id, fmt);
  if (c.shown === null) c.cur = value; // primeiro valor: sem rolar do zero
  c.target = value;
}
function tick() {
  for (const c of counters.values()) {
    const d = c.target - c.cur;
    c.cur = Math.abs(d) < 0.5 ? c.target : c.cur + d * 0.18;
    const text = c.fmt(c.cur);
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
  $('income').textContent = `renda ${compact(s.income)}`;
  const { lo, hi } = levelBounds(s.level);
  const pct = Math.max(0, Math.min(100, ((s.income - lo) / (hi - lo)) * 100));
  $('bar-fill').style.width = pct + '%';
  $('bar').setAttribute('aria-valuenow', Math.round(pct));
  $('bar-note').textContent = `faltam ${compact(hi - s.income)} para o nível ${s.level + 1}`;

  for (const r of ['food', 'wood', 'stone', 'gold']) {
    setTarget('v-' + r, view.res[r]);
    document.querySelector(`.res[data-res="${r}"]`).classList.toggle('focus', view.focus === r);
  }

  $('s-pop').textContent = `${s.pop}/${s.popCap}`;
  $('s-build').textContent = nf.format(s.buildings);
  $('s-tech').textContent = `${view.techs}/${content.totalTechs}`;
  $('s-work').textContent = nf.format(view.work);

  setTarget('t-output', view.raw.output);
  setTarget('t-cacheRead', view.raw.cacheRead);
  setTarget('t-in', view.raw.input + view.raw.cacheCreation);
  setTarget('t-thinking', view.raw.thinking);
}

function renderStatus() {
  const now = Date.now();
  const awake = connected && (now - lastIngest < AWAKE_MS || now - lastAction < ACTING_MS);
  const hero = $('hero');
  hero.classList.toggle('offline', !connected);
  hero.classList.toggle('awake', awake);
  $('status-text').textContent = !connected ? 'Sem sinal do servidor' : awake ? 'A aldeia trabalha' : 'A aldeia dorme';

  const wantNight = !awake;
  if (wantNight !== night) {
    night = wantNight;
    hero.classList.toggle('night', night);
    $('sky').innerHTML = skyline({ night });
    $('astro').innerHTML = sprite(night ? 'moon' : 'sun', 5);
  }
}

// ---------- cronica ----------
function log(icon, text, cls = '') {
  const ol = $('log');
  ol.querySelector('.empty')?.remove();
  const li = document.createElement('li');
  if (cls) li.className = cls;
  li.innerHTML = `${sprite(icon, 2)}<span></span><span class="t">${hhmm()}</span>`;
  li.children[1].textContent = text;
  ol.prepend(li);
  while (ol.children.length > LOG_MAX) ol.lastChild.remove();
}

// tokens chegam em rajadas: junta numa linha so
let burst = null;
function addTokens(ev) {
  if (!burst) {
    burst = { out: 0, cache: 0, n: 0 };
    setTimeout(() => {
      log('token', `+${compact(burst.out)} de saída, +${compact(burst.cache)} de cache (${burst.n} resp.)`, 'tok');
      burst = null;
    }, 1500);
  }
  burst.out += ev.output; burst.cache += ev.cacheRead; burst.n++;
}

const ACTIONS = {
  build: id => ['house', `Construída: ${nameOf(id)}`],
  train: id => ['villager', `Treinado: ${nameOf(id)}`],
  research: id => ['book', `Pesquisa concluída: ${nameOf(id)}`],
  advance: id => ['sun', `Nova era: ${nameOf(id)}`],
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
    else if (ev.type === 'session:new') log('villager', 'Nova sessão: um imigrante chegou');
    else if (ev.type === 'subagent:new') log('sun', 'Um explorador partiu em missão');
    renderStatus();
  });
  es.addEventListener('action', e => {
    const a = JSON.parse(e.data);
    lastAction = Date.now();
    const [icon, text] = (ACTIONS[a.type] || (() => ['hammer', a.type]))(a.id);
    log(icon, text, a.type === 'advance' ? 'big' : '');
    if (a.type === 'advance') {
      const hero = $('hero');
      hero.classList.remove('flash'); void hero.offsetWidth; hero.classList.add('flash');
    }
    renderStatus();
  });
}

// ---------- inicio ----------
function paintStaticSprites() {
  document.querySelectorAll('[data-sprite]').forEach(el => {
    el.innerHTML = sprite(el.dataset.sprite, Number(el.dataset.px) || 3);
  });
}

async function start() {
  paintStaticSprites();
  renderStatus();
  try {
    content = await (await fetch('/api/content')).json();
  } catch {
    $('status-text').textContent = 'Sem sinal do servidor';
    return setTimeout(start, 3000);
  }
  requestAnimationFrame(tick);
  setInterval(renderStatus, 2000);
  connect();
}
start();
