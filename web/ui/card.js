import { compact } from './format.js';

/*
 * Cartao para compartilhar: uma imagem PNG 1200x630 com a aldeia (de dia) e os numeros que
 * permitem comparar com outros jogadores: era, nivel, estagio, renda vitalicia e tokens crus.
 */

export const CARD_W = 1200;
export const CARD_H = 630;

/** Os textos do cartao (puro: da para testar sem navegador). */
export function cardLines({ view, stageName, date = new Date() }) {
  const s = view.summary;
  return {
    title: 'Age of Tokens',
    subtitle: `${s.era} · Nível ${s.level} · ${stageName}`,
    tokens: `${compact(view.raw.output)} de saída · ${compact(view.raw.cacheRead)} de cache`,
    income: `Renda vitalícia ${compact(s.income)}`,
    date: date.toLocaleDateString('pt-BR'),
    filename: `aldeia-nivel-${s.level}.png`,
  };
}

/** Desenha o cartao e devolve o PNG. `world` e um canvas (instantaneo da cena em plena luz). */
export async function makeCard({ world, lines }) {
  // as fontes precisam estar carregadas antes de desenhar texto no canvas
  await Promise.all([
    document.fonts.load('64px "Jacquard 12"'), document.fonts.load('700 30px "Pixelify Sans"'),
    document.fonts.load('24px "Silkscreen"'), document.fonts.load('700 22px "Silkscreen"'),
  ]);
  const cv = document.createElement('canvas');
  cv.width = CARD_W; cv.height = CARD_H;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';

  c.fillStyle = '#14323c';
  c.fillRect(0, 0, CARD_W, CARD_H);
  // a cena cobre a largura toda e corta um pouco em cima e embaixo
  const k = CARD_W / world.width, h = world.height * k;
  c.drawImage(world, 0, (CARD_H - h) / 2, CARD_W, h);

  // faixa escura embaixo para o texto ler bem
  const g = c.createLinearGradient(0, CARD_H - 210, 0, CARD_H);
  g.addColorStop(0, 'rgba(10,28,36,0)');
  g.addColorStop(0.55, 'rgba(10,28,36,0.82)');
  g.addColorStop(1, 'rgba(10,28,36,0.94)');
  c.fillStyle = g;
  c.fillRect(0, CARD_H - 210, CARD_W, 210);

  c.textBaseline = 'alphabetic';
  const shadowed = (text, x, y, font, color, align = 'left') => {
    c.font = font; c.textAlign = align;
    c.fillStyle = '#0a1c24'; c.fillText(text, x + 3, y + 3);
    c.fillStyle = color; c.fillText(text, x, y);
  };
  shadowed(lines.title, 40, 548, '64px "Jacquard 12"', '#f6f1de');
  shadowed(lines.subtitle, 40, 596, '700 30px "Pixelify Sans"', '#e8b84a');
  shadowed(lines.tokens, CARD_W - 40, 548, '24px "Silkscreen"', '#8fe0cc', 'right');
  shadowed(lines.income, CARD_W - 40, 590, '22px "Silkscreen"', '#f3e6c4', 'right');
  // data no canto, sobre uma tarja escura (por cima das arvores a letra some)
  c.fillStyle = 'rgba(10,28,36,0.78)';
  c.fillRect(CARD_W - 190, 14, 176, 36);
  shadowed(lines.date, CARD_W - 30, 41, '18px "Silkscreen"', '#f3e6c4', 'right');

  // moldura
  c.lineWidth = 8; c.strokeStyle = '#3b2a1a';
  c.strokeRect(4, 4, CARD_W - 8, CARD_H - 8);
  return new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('nao gerou o PNG'))), 'image/png'));
}

/** Compartilha pelo sistema (tablet) ou baixa o arquivo (computador). Devolve 'compartilhado' | 'baixado'. */
export async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Minha aldeia no Age of Tokens' }); return 'compartilhado'; }
    catch (err) { if (err?.name === 'AbortError') return 'cancelado'; /* outro erro: cai para o download */ }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'baixado';
}
