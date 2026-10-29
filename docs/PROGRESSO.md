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
- [x] M3 Primeira versao rodavel: `web/` em portrait (recursos, nivel/era com barra, aldeia, tokens crus, cronica). `npm start` e abrir http://127.0.0.1:4100. Verificado em 375x812.
- [x] M4 Aldeia visual: `web/village/` (canvas isometrico pixel art, 14 tipos de predio + centro urbano, aldeoes com caminho nas ruas, obras que sobem, dia/noite, camera com zoom inteiro). 62 testes (7 novos, do layout). Verificado em 375x812.
- [ ] M5 PWA no celular: acesso pela rede local, instalavel, cartao exportavel.

## Pendencias herdadas do M1
- Transicao de prestigio (reset, bioma, bonus, escala de custos pos-prestigio).
- Efeito do "bonus de moral" da sessao nova.
- Migracao de save entre versoes do motor (hoje save de outra versao e descartado).

## Pendencias herdadas do M3
- Vendorizar as fontes (Jacquard 12, Pixelify Sans, Silkscreen) para funcionar offline: entra no M5.
- Testar em celular real e em outros navegadores.
- A aldeia ainda nao e desenhada: so contadores. O canvas isometrico e o M4.

## Pendencias herdadas do M4
- Verificado so no navegador embutido e com `requestAnimationFrame` limitado (painel em segundo plano); ver em celular real e em Safari/Firefox, incluindo a fluidez a 30 fps.
- A arte e minha primeira passada: vale revisar com o olho do usuario (cores, proporcoes, muralhas, aldeoes).
- Sem som e sem toque na cena (por decisao: o jogo nao tem input).
- Prestigio (nova aldeia em outro bioma) ainda sem visual.
