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
- Reuso do `evo_session_manager` (projeto irmão, uma pasta acima) é por cópia/adaptação, sem dependência entre repos. Formato dos dados: `docs/formato-dados-claude.md`.
- O jogo guarda o próprio save (o session manager não tem histórico).
- Ociosidade não pune: sem uso, a aldeia só dorme.

## Design (preferências do usuário)
- Nada de emoji como ícone: ícones vêm do pacote Tiny Swords (`Icons/`).
- Fontes com identidade de jogo medieval, nunca genéricas (Inter/Roboto/system). Hoje: Jacquard 12 (títulos), Pixelify Sans (texto), Silkscreen (números, porque no Pixelify o 5 parece S). Arte: Tiny Swords (Pixel Frog), vista de cima, estilo RTS cartunesco.
- Evitar o visual genérico da skill frontend-design: cada decisão visual deve ter relação com o jogo.

## Layout
- `ingest/`: parsers e acumulador de tokens copiados do session manager (`npm test` em `ingest/`).
- `sim/`: motor de simulação puro (sem I/O): estado, eventos da ingestão, decisor, níveis/eras. Fonte da verdade dos números: `sim/src/rules.js` e `sim/src/content.js` (`npm test` em `sim/`).
- `server/`: junta ingestão + motor + save (`game.js`, sem timers) e expõe HTTP/SSE (`http.js`); `index.js` liga os timers. `npm start` na raiz sobe em http://127.0.0.1:4100. `npm test` na raiz roda tudo.
- `web/`: front em HTML/CSS/JS puro (sem build), num PALCO FIXO de 1340x800 (tablet deitado) escalado para a tela. `index.html`/`style.css`/`app.js` (HUD e SSE de /api/stream).
- `web/world/`: a aldeia vista de cima com a arte Tiny Swords, como NUCLEO QUE EVOLUI por 11 estagios (nao mostra os 86 predios do motor). `stages.js` (estagios por nivel, posicoes fixas, floresta, autotile; puro e testado), `nav.js` (grade de 16 px + busca de caminho; puro e testado), `assets.js` (carregador das tiras de sprites), `actors.js` (aldeoes: ciclo de coleta; soldados e monges), `scene.js` (camera fixa 1:1 no palco 1340x800, terreno, espuma, chegada de elementos com poeira, noite). `web/world-dev.html` esta DESATUALIZADA (usava a API antiga da cena): nao usar.
- `web/ui/skins.js`: recompõe os papeis/madeira/fitas do pacote em paineis de qualquer tamanho.
- `web/assets/`: sprites do Tiny Swords. FORA DO GIT (licenca proibe redistribuir): ver `docs/ASSETS.md`.
- `web/ui/`: `skins.js` (paineis 9-fatias), `format.js` (numeros em portugues), `card.js` (cartao PNG de compartilhar).
- `web/sw.js` + `web/manifest.webmanifest` + `web/icons/` (icones PROPRIOS gerados por `scripts/make-icons.mjs`, nunca derivados do Tiny Swords) + `web/fonts/` (woff2 OFL + licencas): PWA e modo offline. `server/src/net.js` lista os enderecos de rede.
- `README.md` na raiz explica como rodar e usar no tablet.
- `server/src/store.js`: armazenamento do save (envelope+checksum, migracoes, recuperacao, backups, travas, instancia unica). Para mudar o formato do motor, incremente `STATE_VERSION` e acrescente a migracao em `MIGRATIONS`: nunca descarte saves.
- `data/`: save do jogo (`save.json`, `.prev`, `backups/`, `server.lock`) (`save.json`), fora do git.
- `docs/`: conceito, decisões, progresso, stack.
