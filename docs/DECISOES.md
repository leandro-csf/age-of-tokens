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

## 2026-10-29 (aldeia como nucleo que evolui)
- Pedido do usuario: achava informacao demais na tela e perguntou se o pacote tem "uma casa que evolui". Resposta honesta: o Tiny Swords NAO tem cadeia de melhorias (so 3 casas, Barracks, Archery, Tower, Monastery e Castle, em 5 cores); a evolucao e conceito nosso, feito trocando/acrescentando sprites por estagio. Os prints eram fieis: o excesso vinha de ate 87 predios + ~47 figuras + HUD com 20+ numeros.
- Decisao (usuario): "um nucleo que evolui" + HUD "so o essencial". A simulacao NAO muda (decisor, 86 predios, custos); so o que se desenha.
- Estagios por NIVEL (medida fixa e comparavel): limiares 0, 3, 6, 10, 14, 18, 20, 24, 28, 30, 35 (as eras batem com 10/20/30): Acampamento, Primeira casa, Aldeia, Vila vigiada, Quartel, Arqueiros, Castelo, Mosteiro, Fortaleza, Castelo dourado, Maravilha. Cada estagio acrescenta algo; elementos tem `from`/`until` (a fogueira some quando o castelo chega; castelo azul vira dourado; mosteiro vira catedral roxa). No maximo ~14 elementos por estagio. Multidao limitada por estagio (3 a 14 aldeoes, ate 6 guerreiros, 4 arqueiros, 3 lanceiros, 2 monges).
- Mundo: uma ilha de 15x9 tiles no meio do mar, camera fixa 1:1 no palco 1340x800 (sem zoom). Removidos o mundo de 42x25 tiles, o layout de 86 predios (`layout.js`) e seus testes; `nav.js` fica. A chegada de cada elemento novo e animada (sobe do chao com poeira, aldeoes martelando) e gera o aviso "Sua aldeia evoluiu: <estagio>".
- HUD essencial: fita com a era, caixa do nivel com barra, e os 4 recursos. Tokens crus, populacao, predios, pesquisas e obra ficam num painel que abre ao tocar nos recursos (ou tecla D; Esc fecha). A cronica virou um aviso curto (7 s) so para marcos: evolucao de estagio, nova era, nova sessao, explorador. Aviso "Sem sinal do servidor" so quando o SSE cai.
- Consequencia assumida: o decisor continua gastando recurso em predios que a tela nao mostra; os numeros de recurso oscilam por causa disso. Os avisos "Construida: Casa" etc. foram removidos (nao correspondem a nada visivel).
- Bugs achados na verificacao: floresta de 256 px de altura escondia as casas da fileira da frente (tirei as arvores do meio da borda de baixo); `Object.assign` congelava os getters `info`/`stage` da cena; seletor `#conn` por id vencia `[hidden]`.
- Estagio 10 ("Maravilha") ainda e modesto visualmente (castelo dourado + catedral + braseiros): vale um efeito maior.

## 2026-10-29 (mapa maior e mais limpo)
- Pedido do usuario: mapa um pouco maior e menos vegetacao.
- Ilha de 15x9 para 17x10 tiles (LAND 128..1216 x 128..768 no palco 1340x800); elementos abertos 12% na horizontal em torno do centro e 30 px mais baixos (mais respiro entre os predios; testes de sobreposicao e alcancabilidade continuam passando).
- Floresta bem mais rala: so a faixa da borda, com ~48% de chance por tile (antes 82%), a 2a faixa so de vez em quando nas laterais (14%) e nada no meio da borda de baixo. Sao ~25-40 arvores em vez de ~70. Pedras do mar reposicionadas para fora da ilha nova.
- Nota de verificacao: o painel do navegador embutido as vezes recorta a captura em vez de reduzir; emular uma janela 800x478 faz o palco escalar (k=0,597) e a captura mostrar tudo.

## 2026-10-29 (M5: tablet, PWA, fontes offline, cartao)
- Rede: o servidor escuta em 0.0.0.0 por padrao (decisao do usuario: "sempre aberto na rede") e imprime os enderecos reais, escondendo adaptadores virtuais (Hyper-V, WSL, Docker). API continua so GET (POST devolve 405). Aviso explicito no console e no README de que qualquer aparelho da rede ve os totais. `HOST=127.0.0.1` fecha.
- Fontes: Jacquard 12, Pixelify Sans e Silkscreen baixadas do Google Fonts (subconjunto latin, 4 woff2, 46 KB) para `web/fonts/`, com os OFL.txt de cada uma (diretorio `ofl/` do repositorio google/fonts) e `LICENSES.md`. O index.html nao chama mais o Google Fonts (teste garante).
- Icones do PWA: castelo em pixel art DESENHADO em `scripts/make-icons.mjs` (codificador PNG proprio, sem dependencias), nao o Tiny Swords: os icones vao para o git e a licenca do pacote proibe redistribuir derivados. 192, 512, maskable 512 e apple-touch.
- Manifesto: tela cheia + paisagem; service worker: casca em stale-while-revalidate, sprites cache-first (cache fora da versao), `/api/content` rede-primeiro, resto de `/api/*` NUNCA interceptado, navegacao offline cai no index.html guardado.
- LIMITE HONESTO: PWA instalavel e service worker exigem contexto seguro. Em http://192.168.x.x (o caso do tablet na rede local) o navegador nao registra o service worker, entao nao ha instalacao nem modo offline por la; o jogo roda normalmente e o botao de tela cheia (Fullscreen API) funciona. Caminhos para o PWA completo, no README: HTTPS por tunel (Tailscale Serve / Cloudflare Tunnel) ou a flag `unsafely-treat-insecure-origin-as-secure` no Chrome do tablet.
- Verificacao: o navegador embutido deste ambiente RECUSA registrar service workers (erro "unknown error when fetching the script" com o sw.js servido corretamente: 200, JS, sintaxe valida), entao o registro real nao foi provado. A logica foi provada rodando o sw.js num ambiente simulado (9 testes: instalacao, tolerancia a arquivo ausente, limpeza de versoes velhas, API nunca guardada, so GET da mesma origem, sprites offline, content, navegacao offline, stale-while-revalidate).
- Cartao de compartilhar: PNG 1200x630 com a cena em plena luz do dia (`scene.snapshot()` zera a noite so para a captura), era, nivel, estagio, renda vitalicia e tokens crus, data com tarja escura; usa `navigator.share` com arquivo (tablet) e cai para download. Botao dentro do painel de detalhes. ~960 KB.
- Tela cheia: botao no canto (so aparece se a API existir e o app nao estiver ja em tela cheia/standalone), tenta travar a orientacao em paisagem.

## 2026-10-29 (incidente: "os numeros voltaram a zero" ao abrir no PC)
- Sintoma relatado: com o jogo aberto no tablet, ao abrir no PC os numeros apareceram zerados e parecia que o progresso tinha sido perdido.
- Investigacao: o save NAO perdeu nada. Um unico servidor desde 16:46, `data/save.json` regravado a cada poucos segundos. Teste de queda forcada do servidor (Stop-Process -Force, como fechar o terminal) e reinicio: a renda foi de 1.690 para 1.729, ou seja, continuou do ponto certo.
- Causa real (reproduzida): os contadores do HUD (recursos e tokens) so eram desenhados dentro do `requestAnimationFrame`, que o navegador pausa quando a pagina nao esta sendo renderizada (aba em segundo plano, janela coberta/minimizada, economia de energia). Sem quadros, ficavam no "0" do HTML mesmo com o servidor certo (no painel de teste: 0 quadros em 1,5 s, tela em 0, servidor com comida 85 e saida 42.048; pop e era, que nao passam pelo rAF, estavam certos).
- Correcao: logica extraida para `web/ui/counters.js`. O valor e escrito NA HORA (sem animacao) e um temporizador (a cada 400 ms) salta para o valor final se nao ha quadros recentes. Marcadores iniciais trocados de "0" para "–" para carregar nao parecer progresso zerado. Verificado no mesmo cenario que reproduzia (0 quadros): a tela mostra os valores do servidor.
- Testes de regressao (5): primeiro valor aparece sem nenhum quadro; valor novo chega so pela rede de seguranca; a rede de seguranca nao atrapalha a animacao quando ha quadros; animacao termina no alvo; varios contadores.
- service worker: VERSION v1 -> v2 (descarta a casca antiga com o contador defeituoso) e inclui `ui/counters.js` e `ui/format.js`.
- SQLite NAO era a correcao deste incidente: o armazenamento em arquivo ja sobrevive a queda do processo. Fica como opcao de robustez, nao de urgencia.

## 2026-10-29 (robustez do save, sem SQLite)
- Decisao do usuario: continuar com arquivo JSON, sem SQLite. Para um estado de ~65 KB, arquivo + gravacao atomica + backups da a mesma durabilidade; SQLite so compensaria se um dia quisermos historico consultavel (grafico por dia, ranking), e entao troca-se so `server/src/store.js`.
- Novo `server/src/store.js` (substitui `loadSave` e `saveState` no servidor):
  - ENVELOPE `{ format: 2, seq, savedAt, checksum, payload }` com SHA-256 do conteudo: detecta truncado/alterado. Saves do formato antigo (sem envelope) sao lidos e migrados; o original e copiado para `save.json.pre-upgrade.bak` antes da primeira regravacao.
  - MIGRACAO por cadeia (`MIGRATIONS[n]` leva v n para n+1). Hoje so existe a v1 (cadeia vazia, testada com migracoes de mentira). Save de versao (ou formato) MAIS NOVO: lanca `NewerVersionError`, o servidor nao sobe e o arquivo nao e tocado; nunca cai para um backup mais velho. Antes, um save de outra versao era descartado em silencio.
  - RECUPERACAO em cascata: `save.json` -> `save.json.prev` -> backups mais novos primeiro. Se nada serve, os arquivos vao para `data/corrupt-<data>/` (nao se apaga nada) e comeca-se um jogo novo com aviso. A origem usada aparece no console e em `/api/health` (`save.status`: new | ok | upgraded | recovered | unrecoverable).
  - GRAVACAO atomica com fsync (tmp + rename) e `.prev` = ultimo save bom.
  - BACKUPS em `data/backups/save-AAAAMMDD-HHMM.json`: 1 por hora, mantendo 24 h inteiras + 1 por dia nos dias seguintes ate 8 dias.
  - TRAVAS de gravacao: recusa se o numero de gravacao do disco e MAIOR que o deste processo (`StaleWriterError`: outro servidor gravou depois) ou se a renda vitalicia do disco e maior (`RegressionError`: ela nunca diminui). Ao disparar, as gravacoes PARAM (o jogo segue no ar), com aviso alto no console e `ok:false` no health.
  - INSTANCIA UNICA: `data/server.lock` (PID + porta). Segundo servidor na mesma pasta e recusado com mensagem clara; trava de processo morto e assumida sozinha; `release` so apaga a trava propria.
- Verificacao com processos reais, em copia do save: migracao do formato antigo, segundo servidor recusado, regravacao no formato novo com .prev e backup, arquivo truncado + queda forcada -> reinicio assumiu a trava velha e recuperou do .prev com aviso. Depois aplicado ao save real (renda 9.398, atualizado para o envelope).
- Perda maxima numa queda: ate ~5 s (intervalo de gravacao). Nao cobre disco com defeito nem pasta `data/` apagada: para isso, copiar `data/backups/` para outra pasta/nuvem (nao automatizado).

## 2026-10-29 (prestigio: a aldeia vira lenda)
- Decisoes (recomendadas, ajustaveis por constante): automatico (o jogo nao tem decisoes), gatilho = Maravilha erguida E nivel da aldeia 40; bonus +10% de producao por prestigio (aditivo, sem teto); 5 biomas = as 5 cores de grama do pacote (prestigio mod 5).
- Revisao da regra de nivel: o nivel passa a ser o da ALDEIA ATUAL (`earned` zera no prestigio). Motivo: com o nivel vitalicio, a nova aldeia nasceria no nivel 40 e destravaria todas as eras e estagios de uma vez. A renda vitalicia = `legacy` (soma das aldeias anteriores) + renda da atual; e ela que cresce sempre e serve para comparar jogadores. A placa mostra "Lenda xN +B% prod." e o painel de detalhes mostra a vitalicia e o bonus.
- Motor (`sim`): `canPrestige`, `prestige()` (puro), `lifetimeIncome`, `prestigeMult`; `step()` faz o prestigio ANTES de qualquer outra acao (acao `{type:'prestige', id:n}`). Estado v2 acrescenta `prestige` e `legacy`.
- Save: `STATE_VERSION` 1 -> 2 com a primeira migracao REAL (`MIGRATIONS[1]` acrescenta `prestige: 0` e `legacy: 0`; nada se perde). Aplicada ao save real no mesmo dia (sequencia de gravacao 87 preservada). Cada tipo de atualizacao guarda a propria copia: `.pre-upgrade.bak` (formato antigo) e `.pre-migration-vN.bak` (migracao de versao) — corrigido depois de perceber que a 2a migracao nao teria copia propria.
- Cena: `createScene(canvas, { biomes })`; ao mudar o prestigio, reconstroi o chao no bioma novo, limpa obras/poeira, volta ao estagio do nivel novo SEM animar chegada de elementos e dispara `onPrestige` (aviso "Sua aldeia virou lenda (xN)!" + flash). `/api/content` ganhou `prestige: { level, bonus, biomes }`.
- Cartao: o subtitulo ganha "Lenda xN" e a renda mostrada e a vitalicia.
- Verificado: 14 testes novos no motor (gatilho, o que zera e o que fica, renda vitalicia monotona, nivel da aldeia atual nao libera eras, bonus nos tokens e no saque, aldeia seguinte mais rapida, step faz o prestigio primeiro, pureza), jornada completa ate a lenda, 4 testes de migracao v1->v2 e de copias; e ao vivo no navegador com um save "lendario": o decisor virou a lenda sozinho com a pagina aberta (Maravilha/nivel 40 -> Acampamento/nivel 0, outro bioma, vitalicia 38 mi preservada, aviso e flash).
- Limites: a cerimonia e simples (flash + aviso), sem animacao propria; o bioma 5 (verde-azulado) tem pouco contraste com o mar; nao ha "hall da fama" das aldeias lendarias; o bonus nao tem teto (a partir de varios prestigios o jogo acelera sem limite).
