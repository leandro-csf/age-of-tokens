# Progresso

## Feito
- [x] Fase 0: estrutura, docs, parsers copiados (line, cost, todo).
- [x] Ingestao: `ingest/src/services/{tailer,ingest,state}.js` + `src/cli.js`. Eventos: session:new, subagent:new, tokens, tool. Offsets e ids persistidos em save atomico. 14 testes passando (`npm test` em `ingest/`). Validado so-leitura no historico real.

## Proximo
- [x] Decidido: aldeia comeca do zero (baseline `now`); historico existente nao conta.
- [x] Rascunho das regras v1 em docs/REGRAS.md (pesos, eras, decisor, prestigio).
- [ ] Preencher o que REGRAS.md deixa em aberto: predios/unidades/techs por era e minimos por era.
- [ ] Implementar o motor de simulacao (modulo puro, testavel) lendo os eventos da ingestao.
- [ ] Detectar fim de sessao / sessao ativa (liveness do session manager ainda nao portado) para aldeoes animados.
- [ ] Modelo de save do jogo (separado do save da ingestao) e como a ingestao alimenta a simulacao.
