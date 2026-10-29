# Progresso

## Feito
- [x] Fase 0: estrutura, docs, parsers copiados (line, cost, todo).
- [x] Ingestao: `ingest/src/services/{tailer,ingest,state}.js` + `src/cli.js`. Eventos: session:new, subagent:new, tokens, tool. Offsets e ids persistidos em save atomico. 14 testes passando (`npm test` em `ingest/`). Validado so-leitura no historico real.

## Proximo
- [x] Decidido: aldeia comeca do zero (baseline `now`); historico existente nao conta.
- [x] Regras v1 em docs/REGRAS.md; progressao revisada para curva fixa e comparavel (niveis geometricos + eras + prestigio).
- [x] Conteudo por era em docs/CONTEUDO.md (predios, unidades, techs, custos, requisitos de avanco).
- [ ] Detectar fim de sessao / sessao ativa (liveness do session manager ainda nao portado) para aldeoes animados.
- [ ] Modelo de save do jogo (separado do save da ingestao) e como a ingestao alimenta a simulacao.

## Roteiro ate rodar (marcos)
- [x] M1 Motor: `sim/` puro e testavel (estoque, decisor, niveis/eras, custos). 29 testes, incluindo jornada completa ate a Maravilha e teste de orcamento por era.
- [x] M2 Servidor local: `server/` junta ingestao + motor + save; `npm start` sobe em http://127.0.0.1:4100; /api/state e /api/stream (SSE). 54 testes no total (`npm test` na raiz). Validado ao vivo.
- [ ] M3 Primeira versao rodavel: pagina minima em portrait (contadores de recursos, nivel/era, tokens crus, log de eventos). Ja da para abrir no navegador e ver a aldeia subir com uso real.
- [ ] M4 Aldeia visual: canvas isometrico pixel art com aldeoes e predios animados.
- [ ] M5 PWA no celular: acesso pela rede local, instalavel, cartao exportavel.

## Pendencias herdadas do M1
- Transicao de prestigio (reset, bioma, bonus, escala de custos pos-prestigio).
- Efeito do "bonus de moral" da sessao nova.
- Migracao de save entre versoes do motor (hoje save de outra versao e descartado).
