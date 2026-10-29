# Decisões

## 2026-10-29
- Uma aldeia global (todos os projetos alimentam a mesma). Motivo: simples e dá sensação clara de progresso.
- Pixel art isométrico, canvas 2D, portrait de celular, PWA.
- Ociosidade só faz a aldeia dormir, sem perda. Motivo: relaxante, sem irritar.
- Repo novo e independente; reuso do evo_session_manager por cópia/adaptação. Stack definida aos poucos.
- Persistência própria (save + checkpoint de offsets e message.id já contados), porque o session manager não guarda histórico.

## 2026-10-29 (ingestao)
- Ingestao propria no repo: tailer incremental lendo ~/.claude/projects, sem depender do session manager rodando. Motivo: repo independente e contagem exata com historico no proprio save.
- Tailer reescrito (nao copiado): guarda so `committed`, o offset apos a ultima linha completa. Linha parcial e relida, sem decoder/buffer em memoria. Motivo: offset persistivel e sem duplicar bytes.
- Dedupe por message.id com anel de 500 ids persistido no save (sobrevive a reinicio no meio de uma resposta).
- Baseline configuravel: `now` (ignora historico) ou `history` (conta tudo). Padrao do CLI: `now`. DECIDIDO (2026-10-29): comeca do zero, o historico existente nao credita a aldeia.
- Escala medida (historico completo, 2026-10-29): 263 arquivos, 13.164 respostas, ~11,9M output, ~2,36 bilhoes cache read, ~3M thinking, 17.536 tool_use; leitura total em ~7 s. Cache read e ~200x o output, entao a economia precisa de pesos por tipo de token.

## 2026-10-29 (regras)
- Pesos: output->comida (1/100), cache read->madeira (1/20k), input+cache creation->pedra (1/2k), thinking->ouro (1/50); Opus 1,5x, Haiku 0,5x. Motivo: cache read e ~200x o output.
- Ritmo: Imperial em ~1 mes de uso tipico (limiares de renda acumulada 10k / 100k / 400k), calibrado no historico real (media ~13k/dia).
- Pos-Imperial: prestigio (nova aldeia em outro bioma, bonus permanente), o jogo nao acaba.
- Sessao viva so anima, sem efeito na producao.
- Detalhes em docs/REGRAS.md.

## 2026-10-29 (progressao comparavel)
- Revisao: o usuario apontou que desenvolvedores gastam bem mais tokens e que o valor esta em comparar aldeias entre jogadores. Decisao: curva FIXA, sem auto-calibrar nem perfil. Substitui os limiares 10k/100k/400k e o "Imperial em ~1 mes".
- Metrica: renda acumulada vitalicia R; nivel n com L(n)=5000x1,25^n; eras nos niveis 10/20/30 (~47k / ~433k / ~4M). Prestigio nao zera R.
- Pesos mantidos; UI mostra tokens crus ao lado da renda.

## 2026-10-29 (conteudo por era)
- Limiares de era confirmados pelo usuario (nivel 10/20/30, L(n)=5000x1,25^n).
- Conteudo por era em docs/CONTEUDO.md. Custos escalam por fator de era (x1/x9/x85/x800) para o conteudo custar ~75% da renda da era.
- Techs dao +5% de producao por recurso por era (max +20%); arvore e ordem de compra identicas para todos, preservando a comparabilidade.
- Unidades militares so decoram e contam para populacao (por ora). Maravilha no Imperial libera o prestigio.

## 2026-10-29 (M1: motor de simulacao)
- `sim/` e puro: toda funcao recebe um estado e devolve um novo (structuredClone); estado e JSON puro e serializa direto para o save.
- Decisor: no maximo uma acao por `step`, ordem fixa (casa se pop no teto, treinar, pesquisar, avancar de era, proximo predio). Em casa/treino/predio so conta a PROXIMA entrada da lista; sem recurso ela economiza em vez de pular para algo mais barato (determinismo e comparabilidade).
- Construir custa pontos de obra: 10 x (era do predio + 1). Sem eventos `tool` a aldeia so treina e pesquisa.
- Saque de subagente: 10 x fator da era, em comida e madeira (alto demais seria injusto: 191 subagentes no historico). Imigrante de sessao nova: +1 aldeao se houver vaga.
- "Bonus de moral" da sessao nova ficou de fora do M1 (sem efeito definido).
- Prestigio: so `canPrestige` (Maravilha construida). A transicao (reset, bioma, bonus, escala de custos pos-prestigio) fica para depois, porque a renda vitalicia ja passa do nivel 30 e os custos precisam de nova regra.
- Valores de conteudo das eras 2-4 fechados em sim/src/content.js; orcamentos: 76,5% / 71,1% / 78,5% / 74,7% da renda de cada era.

## 2026-10-29 (M2: servidor local)
- Um unico arquivo de save (`data/save.json`) com o estado da ingestao e o do motor, gravado de forma atomica. Os eventos da ingestao entram no motor no mesmo instante em que o offset avanca (onEvent sincrono), entao qualquer save e coerente: nada conta duas vezes nem se perde numa queda.
- Servidor sem dependencias (`node:http`), porta 4100 (o session manager usa 4000/5175), `127.0.0.1` por padrao; abrir para a rede local fica para o M5. API so GET: /api/health, /api/state, /api/stream (SSE: snapshot, ingest, action, state, heartbeat) e arquivos estaticos de `web/` com protecao contra path traversal.
- Logica em `createGame` (sem timers) e timers so em `index.js`: poll da ingestao a cada 2 s (encadeado), passo do decisor a cada 3 s (`STEP_MS`), save a cada 5 s se houver mudanca e ao receber SIGINT/SIGTERM. O decisor faz uma acao por passo, entao ao religar depois de dias a aldeia "digere" o acumulado aos poucos.
- Save de versao diferente ou corrompido e ignorado (comeca do zero). Ainda nao ha migracao de save entre versoes do motor.
- Verificado ao vivo contra o ~/.claude real (so leitura): tokens e tool_use desta propria sessao chegaram ao estado e ao SSE.

## 2026-10-29 (M3: primeira tela)
- Direcao visual: noite de aldeia medieval em pixel art. Fundo fuligem com grade de 8px, paineis com cantos serrilhados (borda de box-shadow), pergaminho no texto, ambar de tocha como destaque, turquesa para tokens.
- Fontes: Jacquard 12 (blackletter em pixel) nos titulos e na era; Pixelify Sans no texto; Silkscreen nos numeros (digitos inequivocos: no Pixelify o 5 parece S e o 8 parece 5). Carregadas do Google Fonts em tempo de execucao; PENDENTE vendorizar para funcionar offline no PWA (M5).
- Icones: sem emoji. 11 sprites 10x10 desenhados a mao em `web/pixel.js` (comida, madeira, pedra, ouro, aldeao, martelo, casa, livro, token, sol, lua), renderizados em SVG crispEdges. Ceu e morros sao gerados por codigo (faixas e degraus).
- Estado da aldeia: "trabalha" (sol, ceu de dia) se chegaram tokens ha menos de 90 s ou houve obra/treino ha menos de 10 s; senao "dorme" (lua, ceu de noite); "sem sinal" se o SSE cai. Recurso em foco do decisor ganha borda ambar e um aldeao.
- Cronica agrega rajadas de tokens em uma linha (1,5 s) para nao inundar. Numeros rolam ate o valor novo (rAF) e respeitam prefers-reduced-motion.
- Servidor ganhou `/api/content` (nomes id->nome, eras, constantes de nivel, total de techs) e `SAVE_FILE` para apontar um save alternativo (usado para demonstracao).
- Verificado no navegador embutido em 375x812 com um save de demonstracao e eventos injetados: layout cabe, sem erros no console, modo dia e noite. Nao testado em celular real nem em Safari/Firefox.

## 2026-10-29 (M4: aldeia isometrica)
- Canvas 2D em resolucao logica baixa com zoom INTEIRO (4x/3x/2x/1x) para o pixel ficar nitido; a camera recua um degrau quando a ilha nao cabe. Se a ilha e ate 1,7x mais larga que a tela, fica no zoom maior e a camera passeia de lado a lado (periodo de 55 s) em vez de encolher tudo.
- Tile 12x6 (2:1). Mapa em quarteiroes de 2x2 celulas separados por ruas de 1 celula; centro urbano no quarteirao (0,0). Cada predio tem lote FIXO e deterministico (o n-esimo de cada tipo cai sempre no mesmo lugar, sem depender da ordem de construcao do decisor); predios 2x2 (castelo, catedral, Maravilha) ocupam um quarteirao inteiro. O servidor expoe a ordem canonica em `/api/content.plan`, e `/api/state` e o evento `state` agora trazem `built` e `units`.
- Arte toda gerada por codigo (nenhum arquivo de imagem): caixa isometrica com telhado em empena, contorno escuro de 1px, janelas que acendem a noite. Ilha como "fatia de terra" com laterais de terra. Arvores e arbustos ocupam so celulas livres e somem quando chega um predio.
- Aldeoes: BFS nas ruas, velocidade por tipo, sprites procedurais (aldeao, soldado, arqueiro, cavaleiro, monge); aldeoes vao ao predio do recurso em foco (fazenda, serraria, mina) e martelam ao chegar. Maquinas de cerco (trebuchet, canhao) ficam "dentro do castelo", sem sprite. Mostra so uma amostra (30/10/10/6/4 por tipo), porque a ilha e pequena.
- Predio novo sobe do chao em 1,5 s com poeira. De noite a cena escurece com transicao suave, janelas acendem e aldeoes/monges dormem onde estao; so a guarda patrulha, mais devagar. Fumaca na ferraria e em parte das casas quando acordada.
- Desempenho medido: ~0,5 ms/quadro com 52 predios e ~1 ms com 87 predios e 60 figuras, a 30 fps.
- Bugs achados na verificacao visual: o terreno era pre-desenhado do tamanho da tela e cortava a ilha quando a camera passeava (agora cobre a ilha inteira); redimensionar o canvas o limpava ate o proximo quadro (agora redesenha na hora).

## 2026-10-29 (arte: Tiny Swords)
- O usuario achou o visual isometrico gerado por codigo muito longe do Age of Empires e pediu arte de verdade. Pesquisa de pacotes livres: nenhum cobre isometrico + aldeoes animados + predios + recursos; os melhores pagos nao tem unidades. Escolha do usuario: **Tiny Swords (Free Pack)**, de Pixel Frog.
- Consequencia assumida: o mapa deixa de ser isometrico e passa a ser **visto de cima (3/4)**, estilo RTS cartunesco (mais Warcraft que Age of Empires). Em troca vem o ciclo de coleta de verdade: peao corta, minera, constroi, carrega madeira/ouro/carne.
- Os arquivos NAO entram no git (a licenca proibe redistribuir): `web/assets/` esta no `.gitignore` e `docs/ASSETS.md` explica como obter de novo e traz o inventario de tamanhos de quadro. Baixado da pagina oficial, zip integro, sem executaveis; so o Free Pack (o Enemy Pack pago nao foi pego).
- O mapa isometrico atual (`web/village/art.js`, `village.js`) fica no historico do git e sera substituido quando o novo estiver funcionando.

## 2026-10-29 (Tiny Swords: palco e camera)
- Dispositivo alvo: **tablet deitado de 1340x800**. O palco logico e fixo em 1340x800 (escalado para caber em qualquer tela); o layout deixa de ser portrait de celular e passa a ser paisagem estilo RTS.
- Camera: tamanho nativo (1:1) enquanto a aldeia e pequena (cabem ~21x12 tiles de 64 px) e recuo suave (animado) para 0,5x quando cresce, mostrando a ilha inteira com o mar ao redor (mundo de 42x25 tiles = 2688x1600 px cabe em 1340x800 a 0,5x).
- Mapeamento dos predios aprovado: casa=House1-3; fazenda=pasto com ovelhas e arbustos; serraria=casa com toras e tocos; mina=pedras de ouro; quartel=Barracks; torre=Tower (nos cantos da muralha); castelo=Castle; mosteiro=Monastery; ferraria/mercado/universidade=casas em outras cores de faccao; catedral=Monastery roxo; muralha=pedras em fileira (anel); maravilha=Castle dourado. Aldeao=Pawn; soldado=Warrior; arqueiro/besteiro=Archer; cavaleiro/paladino=Lancer; monge=Monk; cerco sem sprite.

## 2026-10-29 (M4b: mundo Tiny Swords e nova interface)
- Substituiu por completo a aldeia isometrica por codigo (removidos `web/village/*`, `web/pixel.js`, `web/dev-sprites.html`; ficam no historico do git). Mundo visto de cima: 42x25 tiles de 64 px = 2688x1600 px; ilha de grama 36x21 cercada de agua com espuma animada.
- Palco de 1340x800 (tablet deitado) escalado por CSS. Camera: 1:1 enquanto a vila cabe e 0,5x depois (a ilha inteira cabe a 0,5x), com transicao suave. Jazidas de ouro nos cantos nao entram no enquadramento.
- Layout: lote FIXO por predio (n-esimo de cada tipo sempre no mesmo lugar). Predios grandes (castelo, catedral, mosteiro, quarteis, Maravilha) tem lugar reservado antes; o resto preenche do centro para fora, mais largo que alto. Corredor minimo de 40 px entre predios (os aldeoes passam). Muralha em anel retangular com as pecas espalhadas (ordem por inversao de bits); torres nos 4 cantos; minas em 3 jazidas; floresta de 2 tiles na borda. Teste cobre: sem sobreposicao, determinismo, alcancabilidade de todo predio a partir do castelo.
- Navegacao: grade de 16 px com obstaculos retangulares, BFS de 8 vizinhos e suavizacao por linha de visada (uma grade de 32 px prendia os aldeoes: os corredores de 30 px nao tinham celula livre).
- Aldeoes (Pawn): ciclo completo ir-trabalhar-carregar-depositar com as animacoes do pacote (cortar, minerar, cacar, construir; correr com madeira/ouro/carne); o recurso em foco do decisor pesa mais na escolha do oficio; obras em andamento atraem martelo. Soldados treinam e patrulham, monges ficam perto do mosteiro/catedral. Sem uso (aldeia dormindo) os aldeoes param e a cena escurece.
- Obras: o predio "sobe" do chao em 3,2 s com poeira. Sem sprite de andaime no pacote.
- HUD: faixas finas no topo e na base para deixar a ilha livre. Fita azul com a era, papel creme para recursos (icones tora/carne/moeda do pacote e pedra), mesa de madeira para o nivel, papel ardosia com filigrana para a cronica (some depois de 12 s sem novidade). Paineis 9-fatias recompostos em tempo de execucao a partir de folhas com pecas separadas (medidas conferidas peca por peca).
- Sem os sprites (clone novo), a pagina mostra instrucoes de como baixar em vez de quebrar.
- Limites conhecidos: verificado so no navegador embutido, com requestAnimationFrame limitado (usei `advance()` e `snapCamera()` para simular tempo); HUD avaliado em capturas reduzidas (60%); sem som; ancoras dos sprites dos aldeoes ajustadas a olho; unidades "cerco" nao existem no pacote.

## 2026-10-29 (ajustes de arte, rodada 1)
- Pedidos do usuario: tamanho/legibilidade, aldeoes e animacoes, predios/muralha/terreno. Camera mantida (1:1 e depois 0,5x).
- Legibilidade: HUD com fontes ~15-20% maiores (numeros 22 px, rotulos 14 px, crônica 16 px) e rotulos curtos (Pop., Pesq.) para nao se atropelarem; fita da era e barra de recursos reajustadas. Unidades crescem ate 35% quando a camera esta longe (`1 + (1 - zoom) * 0,7`), como nos RTS.
- Aldeoes: viram o rosto para o que estao trabalhando (arvore, mina, pasto, obra) em vez de olhar para onde andavam.
- Muralha: a rampa do tileset (grama + face de pedra) virou placa chapada sem relevo; trocada por torreoes pequenos escuros (Tower Black a 60%) ao longo do anel.
- Terreno: sombra suave sob cada predio (Shadow.png, que so ocupa o miolo 79x80 da imagem 192x192), arbustos animados e pedras espalhados pela vila (somem quando um predio e construido em cima, via `underBuilding`), nuvens translucidas que derivam, pedras que balancam no mar e o patinho de borracha.
- Depuracao: `scene.flags` liga/desliga camadas (clouds, shadows, wall, decor), `scene.lookAt(x, y, zoom)` para inspecionar de perto.
- Licao: capturas do painel em segundo plano podem mostrar um quadro antigo; sempre chamar `drawNow()` e conferir de perto (zoom 1) antes de concluir que algo esta errado.
