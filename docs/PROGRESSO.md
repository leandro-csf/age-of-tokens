# Progresso

## Feito
- [x] Fase 0: estrutura, docs, parsers copiados (line, cost, todo).
- [x] Ingestao: `ingest/src/services/{tailer,ingest,state}.js` + `src/cli.js`. Eventos: session:new, subagent:new, tokens, tool. Offsets e ids persistidos em save atomico. 14 testes passando (`npm test` em `ingest/`). Validado so-leitura no historico real.

## Proximo
- [x] Decidido: aldeia comeca do zero (baseline `now`); historico existente nao conta.
- [x] Regras v1 em docs/REGRAS.md; progressao revisada para curva fixa e comparavel (niveis geometricos + eras + prestigio).
- [x] Conteudo por era em docs/CONTEUDO.md (predios, unidades, techs, custos, requisitos de avanco).
- [ ] Implementar o motor de simulacao (modulo puro, testavel) lendo os eventos da ingestao.
- [ ] Detectar fim de sessao / sessao ativa (liveness do session manager ainda nao portado) para aldeoes animados.
- [ ] Modelo de save do jogo (separado do save da ingestao) e como a ingestao alimenta a simulacao.

## Roteiro ate rodar (marcos)
- [ ] M1 Motor: `sim/` puro e testavel (estoque, decisor, niveis/eras, custos). Sem I/O.
- [ ] M2 Servidor local: `server/` junta ingestao + motor + save do jogo; um comando (`npm start`) e porta definida; expoe estado e eventos por SSE.
- [ ] M3 Primeira versao rodavel: pagina minima em portrait (contadores de recursos, nivel/era, tokens crus, log de eventos). Ja da para abrir no navegador e ver a aldeia subir com uso real.
- [ ] M4 Aldeia visual: canvas isometrico pixel art com aldeoes e predios animados.
- [ ] M5 PWA no celular: acesso pela rede local, instalavel, cartao exportavel.
