import { loadAssets } from './world/assets.js';
import { createScene } from './world/scene.js';
import { loadSkins, paintAll, paint } from './ui/skins.js';
import { compact } from './ui/format.js';
import { createCounters } from './ui/counters.js';
import { cardLines, makeCard, shareOrDownload } from './ui/card.js';

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

// ---------- numeros que rolam ate o valor (logica e regra em ui/counters.js) ----------
const counters = createCounters({ find: $ });
const setTarget = (id, value) => counters.set(id, value);
function tick() { counters.frame(); requestAnimationFrame(tick); }
setInterval(() => counters.settle(), 400);   // rede de seguranca: sem quadros de animacao, salta para o valor final

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
    ? `Maravilha erguida: vira lenda no nível ${content.prestige.level}`
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
  $('s-life').textContent = compact(s.lifetimeIncome ?? s.income);
  $('s-bonus').textContent = `+${Math.round((s.prestigeBonus ?? 0) * 100)}%`;
  const legend = $('legend');
  legend.hidden = !s.prestige;
  if (s.prestige) { $('legend-n').textContent = s.prestige; $('legend-bonus').textContent = `+${Math.round(s.prestigeBonus * 100)}% prod.`; }
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

// ---------- compartilhar ----------
$('share').addEventListener('click', async e => {
  e.stopPropagation();                       // nao fecha o painel de detalhes
  if (!view || !scene) return;
  const btn = $('share');
  btn.disabled = true;
  try {
    const lines = cardLines({ view, stageName: scene.info.name });
    const blob = await makeCard({ world: scene.snapshot(), lines });
    const how = await shareOrDownload(blob, lines.filename);
    if (how !== 'cancelado') toast('Icon_03', how === 'baixado' ? 'Cartão da aldeia salvo' : 'Cartão da aldeia compartilhado');
  } catch (err) {
    console.error(err);
    toast('Icon_09', 'Não consegui gerar o cartão');
  } finally { btn.disabled = false; }
});

// ---------- tela cheia ----------
function setupFullscreen() {
  const btn = $('fs');
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  if (!document.documentElement.requestFullscreen || standalone) return;   // ja esta em tela cheia, ou o aparelho nao suporta
  btn.hidden = false;
  btn.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        screen.orientation?.lock?.('landscape').catch(() => {});   // nem todo aparelho deixa travar
      }
    } catch (err) { console.warn('tela cheia:', err.message); }
  });
}

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
    if (a.type === 'prestige') { /* a cena avisa pelo onPrestige, quando o estado novo chega */ }
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
  $('details').hidden = false; $('legend').hidden = false; paintAll(); $('details').hidden = true; $('legend').hidden = true;   // pinta tudo com tamanho real
  $('toast').classList.add('quiet');

  try {
    content = await (await fetch('/api/content')).json();
  } catch {
    $('conn').hidden = false;
    return setTimeout(start, 3000);
  }
  setupFullscreen();
  // offline: so em contexto seguro (localhost ou HTTPS). Em http://192.168.x.x o navegador nao registra.
  if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('/sw.js').catch(err => console.warn('service worker:', err.message));
  scene = createScene($('world'), { biomes: content.prestige.biomes });
  scene.onStage = (stage, name) => toast('Icon_06', `Sua aldeia evoluiu: ${name}`, 'big');
  scene.onPrestige = n => {
    toast('Icon_06', `Sua aldeia virou lenda (×${n})!`, 'big');
    const b = $('banner');
    $('banner-text').textContent = `Lenda ×${n}`;
    b.hidden = false; paint(b, 'ribbon-yellow');
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    setTimeout(() => { b.hidden = true; }, 5600);
    const stage = $('stage');
    stage.classList.remove('flash'); void stage.offsetWidth; stage.classList.add('flash');
  };
  window.__scene = scene; // depuracao no console
  requestAnimationFrame(tick);
  setInterval(renderStatus, 2000);
  connect();
}
start();
