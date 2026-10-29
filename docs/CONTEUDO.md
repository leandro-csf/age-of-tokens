# Conteudo por era (rascunho v1)

Complementa REGRAS.md. Custos em recursos do jogo (nao em tokens). Gastar recurso NAO reduz a renda acumulada R (ela conta so o que foi ganho), entao o nivel nunca regride.

## Escala de custos

Renda por era (de REGRAS.md): Trevas 0-47k, Feudal 47k-433k, Castelos 433k-4M, Imperial 4M-37M (niveis 30-40). A renda de cada era e ~8-9x a anterior, entao os custos usam um fator por era sobre os custos base da Era das Trevas:

| Era | Fator de custo |
|---|---|
| Trevas | x1 |
| Feudal | x9 |
| Castelos | x85 |
| Imperial | x800 |

Meta de orcamento: o conteudo de cada era custa ~75% da renda dela, para o decisor sempre ter algo a comprar sem esgotar tudo de uma vez. Isso vira um teste automatico no motor (soma dos custos da era <= 80% da renda da era, e >= 60%).

Divisao tipica da renda observada: comida ~37%, madeira ~36%, ouro ~18%, pedra ~9%. Pedra sobra de proposito (vira defesa/prestigio em eras tardias).

## Era das Trevas (fator x1)

Predios (custo base, maximo):
- Casa: 400 madeira, +5 populacao, max 10
- Fazenda: 600 madeira, max 8
- Serraria: 800 madeira, max 4
- Acampamento de mineracao: 800 madeira + 400 pedra, max 3

Unidades: Aldeao (100 comida), populacao maxima 60 nesta era. Explorador (so por subagente, nao comprado).

Techs (ouro, +5% de producao do recurso): Arado (comida) 500, Machado de pedra (madeira) 1.000, Picareta (pedra) 1.500, Prospeccao (ouro) 2.000.

Avancar para Feudal: 6.000 comida + 3.000 ouro. Requisitos: renda R >= nivel 10, >= 6 predios, populacao >= 20.

Orcamento: madeira ~14,4k, comida ~12k, ouro ~8k, pedra ~1,2k; total ~35,6k de ~47k de renda (76%).

## Era Feudal (x9)

Novos predios: Quartel, Ferraria, Mercado, Torre de vigia (alem de mais casas/fazendas/serrarias/minas, teto maior).
Novas unidades: Espadachim, Arqueiro, Cavaleiro leve (aparecem como moradores da aldeia/guarnicao).
Techs (+5% cada): Colheita pesada (comida), Serra de arco (madeira), Mineracao profunda (pedra), Ensaio de metais (ouro).
Avancar para Castelos: 54k comida + 27k ouro. Requisitos: R >= nivel 20, >= 4 tipos de predio, populacao >= 60.

## Era dos Castelos (x85)

Novos predios: Castelo, Universidade, Mosteiro, Muralha.
Novas unidades: Besteiro, Cavaleiro, Monge, Trebuchet.
Techs (+5% cada): Rotacao de culturas, Serraria mecanica, Explosivos, Cunhagem real.
Avancar para Imperial: 510k comida + 255k ouro. Requisitos: R >= nivel 30, >= 8 tipos de predio, populacao >= 150.

## Era Imperial (x800)

Novos predios: Catedral e Maravilha (capstone: fechar a Maravilha libera o prestigio).
Novas unidades: Campeao, Arcabuzeiro, Canhao, Paladino.
Techs (+5% cada): Agricultura imperial, Engenharia, Mineracao com polvora, Banco real.
Maravilha: custo equivalente a ~10% da renda do nivel 30 ao 40; ao termina-la, a aldeia pode ser lendada (prestigio).

Bonus acumulado maximo de techs: +20% por recurso (5% por era). Todos os jogadores seguem a mesma arvore e a mesma ordem de compra do decisor, entao a comparacao entre aldeias continua valida.

## Em aberto

- Nomes e arte final de predios/unidades (depende do estilo pixel art).
- Se unidades militares fazem algo alem de visual (hoje so decoram e contam para requisito de populacao).
- Valores exatos do bonus de prestigio, do imigrante de sessao nova e do saque do explorador.
- Ordem de compra do decisor dentro de cada era (precisa ser deterministica para comparabilidade).
