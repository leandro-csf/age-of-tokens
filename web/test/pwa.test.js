import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compact } from '../ui/format.js';
import { cardLines } from '../ui/card.js';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(web, p), 'utf8');
const pngSize = p => { const b = fs.readFileSync(path.join(web, p)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('manifesto: campos essenciais e icones existentes com o tamanho declarado', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.name, 'Age of Tokens');
  assert.equal(m.orientation, 'landscape');
  assert.equal(m.start_url, '/');
  assert.ok(m.display_override.includes('fullscreen'));
  const sizes = m.icons.map(i => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  assert.ok(m.icons.some(i => i.purpose === 'maskable'));
  for (const i of m.icons) {
    const [w, h] = i.sizes.split('x').map(Number);
    assert.deepEqual(pngSize(i.src.replace(/^\//, '')), [w, h], i.src);
  }
});

test('service worker: tudo que ele pre-guarda existe no disco', () => {
  const sw = read('sw.js');
  const block = sw.slice(sw.indexOf('const SHELL = ['), sw.indexOf('];', sw.indexOf('const SHELL = [')));
  const paths = [...block.matchAll(/'(\/[^']*)'/g)].map(m => m[1]);
  assert.ok(paths.length >= 15);
  for (const p of paths) {
    const file = p === '/' ? 'index.html' : p.slice(1);
    assert.ok(fs.existsSync(path.join(web, file)), `${p} nao existe`);
  }
});

test('service worker nunca guarda a API ao vivo', () => {
  const sw = read('sw.js');
  assert.match(sw, /pathname\.startsWith\('\/api\/'\)\) return;/);
  assert.ok(!sw.includes("'/api/state'") && !sw.includes("'/api/stream'"));
});

test('index.html usa fontes locais e nao chama o Google Fonts', () => {
  const html = read('index.html');
  assert.ok(html.includes('fonts/fonts.css'));
  assert.ok(!html.includes('googleapis') && !html.includes('gstatic'));
  assert.ok(html.includes('manifest.webmanifest'));
});

test('fonts.css aponta para arquivos woff2 que existem, e as licencas acompanham', () => {
  const css = read('fonts/fonts.css');
  const files = [...css.matchAll(/url\('([^']+)'\)/g)].map(m => m[1]);
  assert.equal(files.length, 4);
  for (const f of files) {
    const b = fs.readFileSync(path.join(web, 'fonts', f));
    assert.equal(b.subarray(0, 4).toString(), 'wOF2', f);
  }
  for (const l of ['jacquard12', 'pixelifysans', 'silkscreen']) assert.ok(fs.existsSync(path.join(web, `fonts/licenses/OFL-${l}.txt`)));
});

test('compact: formata numeros grandes em portugues', () => {
  assert.equal(compact(0), '0');
  assert.equal(compact(8021), '8.021');
  assert.equal(compact(12_500), '12,5 mil');
  assert.equal(compact(26_100_000), '26,1 mi');
  assert.equal(compact(5_100_000_000), '5,1 bi');
  assert.equal(compact(2_000_000_000_000), '2 tri');
});

test('cartao: textos com era, nivel, estagio e tokens crus', () => {
  const view = { summary: { era: 'Era dos Castelos', level: 24, income: 1_180_000 }, raw: { output: 26_100_000, cacheRead: 5_100_000_000 } };
  const l = cardLines({ view, stageName: 'Mosteiro', date: new Date(2026, 9, 29) });
  assert.equal(l.title, 'Age of Tokens');
  assert.equal(l.subtitle, 'Era dos Castelos · Nível 24 · Mosteiro');
  assert.equal(l.tokens, '26,1 mi de saída · 5,1 bi de cache');
  assert.equal(l.income, 'Renda vitalícia 1,2 mi');
  assert.equal(l.filename, 'aldeia-nivel-24.png');
  assert.match(l.date, /29\/10\/2026/);
});

test('cartao: aldeia lendaria mostra a lenda e a renda vitalicia (de todas as aldeias)', () => {
  const view = { summary: { era: 'Era Feudal', level: 12, income: 80_000, lifetimeIncome: 42_000_000, prestige: 2 }, raw: { output: 5e7, cacheRead: 9e9 } };
  const l = cardLines({ view, stageName: 'Vila vigiada', date: new Date(2026, 9, 29) });
  assert.equal(l.subtitle, 'Era Feudal · Nível 12 · Vila vigiada · Lenda ×2');
  assert.equal(l.income, 'Renda vitalícia 42 mi');
});

test('o aplicativo nao guarda fonte nem sprite do pacote no git (so os icones proprios)', () => {
  const ignore = fs.readFileSync(path.join(web, '../.gitignore'), 'utf8');
  assert.match(ignore, /web\/assets\//);
  for (const f of fs.readdirSync(path.join(web, 'icons'))) assert.match(f, /\.png$/);
});
