# Stack (a decidir aos poucos)

Definido (M2): servidor `node:http` sem dependências, porta 4100, só GET; SSE para o front; save único e atômico em `data/save.json` (ingestão + motor juntos).
Definido: JS ESM (como o session manager), Node para ingestão (tailer próprio em `ingest/`, sem dependências), canvas 2D, PWA.

Em aberto:
- Engine/lib de canvas (própria vs. alguma leve) e bundler (Vite?).
- Origem dos assets de pixel art.
- Como o PWA no celular alcança a máquina (rede local, porta, segurança).
