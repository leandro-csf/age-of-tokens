# Age of Tokens

Jogo idle estilo Age of Empires: uma aldeia global evolui sozinha (sem decisão humana) conforme o usuário gasta tokens do Claude ou abre sessões novas. Pixel art isométrico, canvas 2D, portrait de celular/tablet (PWA).

## Retomar contexto
1. Leia `docs/PROGRESSO.md` (estado atual e próximo passo) e `docs/DECISOES.md`.
2. Conceito em `docs/CONCEITO.md`; stack em aberto em `docs/STACK.md`.
3. Ao terminar um passo, atualize `docs/PROGRESSO.md`; decisões novas vão em `docs/DECISOES.md` com data e motivo.

## Regras
- Fonte de dados: `~/.claude` (CLAUDE_HOME). SOMENTE LEITURA, nunca escrever lá.
- Sempre `JSON.parse` da linha e ler o `.type` do topo; nunca regex na linha crua.
- Deduplicar tokens por `message.id` (cada bloco de conteúdo repete o mesmo usage).
- Reuso do `C:\Users\EVO\Documents\evo_session_manager` é por cópia/adaptação, sem dependência entre repos. Formato dos dados: `docs/formato-dados-claude.md`.
- O jogo guarda o próprio save (o session manager não tem histórico).
- Ociosidade não pune: sem uso, a aldeia só dorme.

## Design (preferências do usuário)
- Nada de emoji como ícone: ícones são pixel art própria (`web/pixel.js`).
- Fontes com identidade de jogo medieval, nunca genéricas (Inter/Roboto/system). Hoje: Jacquard 12 (títulos), Pixelify Sans (texto), Silkscreen (números, porque no Pixelify o 5 parece S).
- Evitar o visual genérico da skill frontend-design: cada decisão visual deve ter relação com o jogo.

## Layout
- `ingest/`: parsers e acumulador de tokens copiados do session manager (`npm test` em `ingest/`).
- `sim/`: motor de simulação puro (sem I/O): estado, eventos da ingestão, decisor, níveis/eras. Fonte da verdade dos números: `sim/src/rules.js` e `sim/src/content.js` (`npm test` em `sim/`).
- `server/`: junta ingestão + motor + save (`game.js`, sem timers) e expõe HTTP/SSE (`http.js`); `index.js` liga os timers. `npm start` na raiz sobe em http://127.0.0.1:4100. `npm test` na raiz roda tudo.
- `web/`: front em HTML/CSS/JS puro (sem build): `index.html`, `style.css`, `app.js` (SSE de /api/stream), `pixel.js` (sprites 10x10 e paisagem geradas em SVG).
- `data/`: save do jogo (`save.json`), fora do git.
- `docs/`: conceito, decisões, progresso, stack.
