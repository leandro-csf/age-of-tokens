// Gera os icones do PWA (web/icons/*.png): um castelo em pixel art DESENHADO AQUI, sem usar o
// Tiny Swords (a licenca do pacote proibe redistribuir arquivos derivados, e estes vao para o git).
// Uso: node scripts/make-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web/icons');
fs.mkdirSync(out, { recursive: true });

// ---------- PNG minimo (RGBA, sem filtro) ----------
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- o desenho: 32x32 "pixels" ----------
const W = 32;
const C = {
  water: '#4a93a6', foam: '#9fd3da', grass: '#6aa84f', grassD: '#4d7f3a', stone: '#aab2b7', stoneD: '#7c868c', stoneL: '#d4dadd',
  roof: '#4f7fb5', roofD: '#355f8d', door: '#3a2a1c', gold: '#e8b84a', goldD: '#b88a22', ink: '#1a110b', win: '#2b3a44',
};
const px = Array.from({ length: W }, () => Array(W).fill(C.water));
const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < W) px[y][x] = c; };
const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };

// ilha
rect(3, 22, 26, 6, C.grass); rect(5, 21, 22, 1, C.grass); rect(5, 28, 22, 1, C.grassD); rect(3, 27, 26, 1, C.grassD);
rect(2, 23, 1, 4, C.foam); rect(29, 23, 1, 4, C.foam); rect(4, 29, 24, 1, C.foam);
// torres laterais e torre central
for (const x of [6, 21]) {
  rect(x, 12, 6, 10, C.stone); rect(x, 12, 1, 10, C.stoneL); rect(x + 5, 12, 1, 10, C.stoneD);
  rect(x - 1, 10, 8, 2, C.roof); rect(x, 8, 6, 2, C.roof); rect(x + 1, 6, 4, 2, C.roof); rect(x + 2, 5, 2, 1, C.roofD);
  rect(x + 2, 15, 2, 3, C.win);
}
rect(11, 11, 10, 11, C.stone); rect(11, 11, 1, 11, C.stoneL); rect(20, 11, 1, 11, C.stoneD);
for (const x of [11, 13, 15, 17, 19]) rect(x, 9, 1, 2, C.stone);       // ameias
rect(11, 11, 10, 1, C.stoneD);
rect(14, 16, 4, 6, C.door); rect(15, 15, 2, 1, C.door);
rect(12, 13, 1, 2, C.win); rect(19, 13, 1, 2, C.win);
// bandeira dourada
rect(15, 2, 1, 7, C.ink); rect(16, 2, 4, 3, C.gold); rect(16, 4, 3, 1, C.goldD);

function render(size, { scale, offset, bg }) {
  const buf = Buffer.alloc(size * size * 4);
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [br, bgc, bb] = hex(bg);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const gx = Math.floor((x - offset) / scale), gy = Math.floor((y - offset) / scale);
      const inside = gx >= 0 && gy >= 0 && gx < W && gy < W;
      const [r, g, b] = inside ? hex(px[gy][gx]) : [br, bgc, bb];
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
    }
  }
  return png(size, size, buf);
}

const files = {
  'icon-192.png': render(192, { scale: 6, offset: 0, bg: C.water }),
  'icon-512.png': render(512, { scale: 16, offset: 0, bg: C.water }),
  // maskable: o desenho fica na "zona segura" central (80%); o resto e agua, que o sistema pode cortar
  'icon-maskable-512.png': render(512, { scale: 12, offset: 64, bg: C.water }),
  'apple-touch-icon.png': render(180, { scale: 5.625, offset: 0, bg: C.water }),
};
for (const [name, data] of Object.entries(files)) {
  fs.writeFileSync(path.join(out, name), data);
  console.log(name.padEnd(24), data.length, 'bytes');
}
