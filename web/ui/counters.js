import { compact } from './format.js';

/*
 * Contadores do HUD: numeros que "rolam" ate o valor novo.
 *
 * REGRA: o valor e escrito NA HORA, sem depender de animacao. O requestAnimationFrame e pausado
 * quando a pagina nao esta sendo renderizada (aba em segundo plano, janela coberta, economia de
 * energia); antes, os contadores so eram desenhados la dentro e ficavam em "0" mesmo com o
 * servidor certo. A animacao e so enfeite; o valor final tem rede de seguranca por temporizador.
 */
export function createCounters({ find, now = () => performance.now(), staleMs = 700 }) {
  const all = new Map();
  let lastFrame = -Infinity;

  const paint = c => {
    const text = compact(c.cur);
    if (text !== c.shown) { c.el.textContent = text; c.shown = text; }
  };

  return {
    /** Define o valor-alvo. A primeira vez ja aparece na tela, sem esperar quadro nenhum. */
    set(id, value) {
      let c = all.get(id);
      if (!c) { c = { el: find(id), cur: value, target: value, shown: null }; all.set(id, c); paint(c); }
      c.target = value;
    },
    /** Um quadro de animacao: anda uma fracao do caminho ate o alvo. */
    frame() {
      lastFrame = now();
      for (const c of all.values()) {
        const d = c.target - c.cur;
        c.cur = Math.abs(d) < 0.5 ? c.target : c.cur + d * 0.18;
        paint(c);
      }
    },
    /** Rede de seguranca (chamar de um setInterval): sem quadros recentes, salta para o valor final. */
    settle() {
      if (now() - lastFrame < staleMs) return;
      for (const c of all.values()) { c.cur = c.target; paint(c); }
    },
  };
}
