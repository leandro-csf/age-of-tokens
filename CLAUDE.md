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

## Layout
- `ingest/`: parsers e acumulador de tokens copiados do session manager (`npm test` em `ingest/`).
- `docs/`: conceito, decisões, progresso, stack.
