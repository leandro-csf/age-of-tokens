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

## M4b: aldeia com Tiny Swords (feito, para revisar com o olho do usuario)
- [x] Pacote baixado (fora do git), inventariado e documentado em docs/ASSETS.md.
- [x] Mapeamento dos 14 predios para os sprites do pacote (aprovado).
- [x] Carregador de sprites e animacao por quadros (`web/world/assets.js`).
- [x] Mundo visto de cima: ilha com agua e espuma, predios, arvores, jazidas, pastos, muralha e torres.
- [x] Ciclo de coleta dos aldeoes com as animacoes do pacote; soldados e monges; poeira nas obras; noite.
- [x] HUD em paisagem com a interface do pacote.
- [x] Testes: layout do mundo (12) e navegacao (7). Total 74 testes na raiz.
- [ ] Ver em tablet real 1340x800 (e a camera animando de verdade, nao so no `snapCamera`).
- [ ] Revisar com o usuario: proporcoes, ancoras dos aldeoes, muralha (pecas pequenas), HUD, textos.
- [ ] Vendorizar as fontes (Jacquard 12, Pixelify Sans, Silkscreen) para funcionar offline.
- [ ] Prestigio (nova aldeia em outro bioma) ainda sem visual; tilemap tem 5 cores de grama e plato elevado para isso.
- [ ] Sem som.

## Pendencias herdadas do M4
- Verificado so no navegador embutido e com `requestAnimationFrame` limitado (painel em segundo plano); ver em celular real e em Safari/Firefox, incluindo a fluidez a 30 fps.
- A arte e minha primeira passada: vale revisar com o olho do usuario (cores, proporcoes, muralhas, aldeoes).
- Sem som e sem toque na cena (por decisao: o jogo nao tem input).
- Prestigio (nova aldeia em outro bioma) ainda sem visual.

## M4b: refazer a aldeia com Tiny Swords (em andamento)
- [x] Pacote escolhido, baixado (fora do git), inventariado e conferido visualmente: peao com cortar/minerar/construir e cargas, predios, arvores, ouro, ovelhas, terreno, agua com espuma, efeitos e UI.
- [x] Decidir mapeamento dos 14 predios do jogo para os 8 do pacote (faltam fazenda, serraria, mina, mercado, ferraria, universidade, catedral, muralha, maravilha) e a escala de exibicao.
- [ ] Carregador de sprite sheets + sistema de animacao por quadros.
- [ ] Mundo visto de cima: ilha de grama com agua e espuma, predios, arvores, minas de ouro, ovelhas.
- [ ] Ciclo de coleta: peao vai ao recurso, trabalha, volta carregando e deposita.
- [ ] Unidades militares (guerreiro, arqueiro, lanceiro, monge) e efeitos (poeira, fogo).
- [ ] HUD e molduras com a interface do pacote (faixas, mesa de madeira, botoes, barras).

## Nucleo que evolui (feito, para revisar com o usuario)
- [x] 11 estagios por nivel (`web/world/stages.js`), cena de camera fixa, chegada animada de cada elemento, aviso de evolucao.
- [x] HUD so o essencial; detalhes ao tocar nos recursos (ou D).
- [x] Testes de estagios (11) e navegacao; 72 testes na raiz.
- [ ] Ver em tablet real; revisar proporcoes com o usuario.
- [ ] Reforcar o estagio 10 (Maravilha) e talvez dar mais vida ao estagio 0.
- [ ] `web/world-dev.html` ficou desatualizada (API antiga): atualizar ou remover.
