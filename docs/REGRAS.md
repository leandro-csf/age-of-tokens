# Regras da aldeia (rascunho v1)

Todos os numeros sao chutes calibrados com o uso real de 2026-08-25 a 2026-10-29 (35 dias com uso). Ficam em um unico arquivo de config para ajuste (a criar).

## 1. Tokens -> recursos

| Token | Recurso | Taxa |
|---|---|---|
| output | Comida | 1 por 100 |
| cache read | Madeira | 1 por 20.000 |
| input + cache creation | Pedra | 1 por 2.000 |
| thinking | Ouro (pesquisa) | 1 por 50 |

Multiplicador por modelo (so na producao): Opus 1,5x, Sonnet 1x, Haiku 0,5x. Motivo da taxa de cache: cache read e ~200x o output; sem peso ele dominaria tudo.

Referencia de uso (mesma taxa aplicada ao historico do desenvolvedor, usada so para dimensionar a curva): ~5k/dia na mediana, ~13k/dia na media, 60-90k nos dias pesados recentes (27-29/10).

## 2. Outros eventos

- `tool` -> 1 ponto de obra (gasto pelo decisor para construir).
- `session:new` -> 1 imigrante gratis + bonus unico de moral.
- `subagent:new` -> um explorador sai em missao e volta com pequeno saque de recursos.
- Sessao viva so ANIMA (aldeoes visivelmente trabalhando); nao altera producao. Liveness ainda nao portado.
- Ocioso: a aldeia dorme, sem perda.

## 3. Simulacao

Tokens enchem um estoque. A aldeia gasta o estoque no proprio ritmo (uma acao a cada 2-5 s de jogo), para a animacao seguir suave mesmo quando chegam milhares de tokens de uma vez. O tempo de jogo nao depende de tokens; so o estoque depende.

## 4. Decisor automatico (primeira regra que casar vence)

1. Populacao no teto -> construir casa.
2. Comida suficiente e vaga livre -> treinar aldeao.
3. Recurso basico abaixo do minimo -> redirecionar aldeoes para ele.
4. Ouro suficiente -> pesquisar a proxima tecnologia.
5. Requisitos da era cumpridos -> subir de era.
6. Caso contrario -> proximo predio da lista da era.

## 5. Progressao fixa e comparavel

Principio: a curva e IGUAL para todos os jogadores, sem calibracao por usuario. Assim "minha aldeia esta no nivel X" e comparavel entre pessoas, mesmo sem servidor. Quem gasta mais token evolui mais rapido; isso e o ponto, nao um defeito.

Metrica unica: **renda acumulada vitalicia** R (soma dos quatro recursos ganhos, nao do estoque). Nunca zera, nem no prestigio.

**Nivel da aldeia** n: limiar L(n) = 5.000 x 1,25^n. Um nivel novo a cada ~25% de renda a mais, entao quem gasta pouco ganha metas frequentes e quem gasta muito nao esgota a curva.

**Eras** sao marcos nos niveis:

| Era | Nivel | R necessaria | Perfil pesado (~75k/dia) | Perfil medio (~13k/dia) | Perfil leve (~5k/dia) |
|---|---|---|---|---|---|
| Trevas | 0 | 0 | inicio | inicio | inicio |
| Feudal | 10 | ~47 mil | <1 dia | ~4 dias | ~9 dias |
| Castelos | 20 | ~433 mil | ~6 dias | ~33 dias | ~3 meses |
| Imperial | 30 | ~4,0 milhoes | ~54 dias | ~10 meses | ~2,2 anos |

Os perfis sao de referencia (medidos no historico do desenvolvedor: media e dias pesados). Os limiares NAO se ajustam a eles.

Alem da renda, subir de era exige predios e populacao minimos (a definir).

## 6. Depois do Imperial: prestigio

Ao fechar o Imperial (nivel 30) o jogador pode "lendar" a aldeia: nova aldeia em outro bioma, contador de prestigio +1 e bonus permanente pequeno (a definir). A curva de niveis continua a mesma, em R vitalicia, entao os niveis seguem acima de 30 (L(40) ~ 37 milhoes) e o heavy nunca fica sem meta.

## 7. Comparacao entre jogadores

A identidade comparavel e: **nivel, era, prestigio e renda vitalicia**, exibidos junto com os **tokens crus** gastos (a UI mostra output e cache read reais para dar a nocao de volume). Compartilhar sera por cartao exportavel (imagem/texto), sem servidor. Antitrapaca fica fora do escopo por enquanto (os dados sao locais e editaveis).

## Em aberto

- Lista de predios, unidades e tecnologias por era.
- Minimos de populacao/predios por era.
- Valor do bonus de prestigio e dos bonus de sessao nova/explorador.
- Como o save do jogo se separa do save da ingestao.
- Formato do cartao exportavel e se algum dia havera ranking online.
