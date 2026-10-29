// Formatacao de numeros grandes em portugues: 12.345 -> "12.345", 26.100.000 -> "26,1 mi".
const nf = new Intl.NumberFormat('pt-BR');

export function compact(n) {
  n = Math.floor(n);
  const f = (v, s) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: v < 100 ? 1 : 0 })} ${s}`;
  if (n < 10_000) return nf.format(n);
  if (n < 1e6) return f(n / 1e3, 'mil');
  if (n < 1e9) return f(n / 1e6, 'mi');
  if (n < 1e12) return f(n / 1e9, 'bi');
  return f(n / 1e12, 'tri');
}
