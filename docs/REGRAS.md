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

Calibracao (mesma taxa aplicada ao historico): renda total de ~5k/dia na mediana, ~13k/dia na media, e 60-90k nos dias pesados recentes (27-29/10).

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

## 5. Eras

Limiar por renda acumulada (soma dos quatro recursos ganhos, nao do estoque):

| Era | Renda acumulada | Tempo de uso tipico (~13k/dia) |
|---|---|---|
| Trevas | 0 | inicio |
| Feudal | 10.000 | ~1 dia |
| Castelos | 100.000 | ~1 semana |
| Imperial | 400.000 | ~1 mes |

Alem da renda, subir de era exige predios e populacao minimos (a definir), para a aldeia "merecer" a era.

## 6. Depois do Imperial: prestigio

Ao fechar o Imperial, a aldeia vira lenda e uma nova nasce em outro bioma (visual novo), com bonus permanente pequeno (a definir, ex.: +10% de producao por prestigio). O jogo nao acaba.

## Em aberto

- Lista de predios, unidades e tecnologias por era.
- Minimos de populacao/predios por era.
- Valor do bonus de prestigio e dos bonus de sessao nova/explorador.
- Como o save do jogo se separa do save da ingestao.
