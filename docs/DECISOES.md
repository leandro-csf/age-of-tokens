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
