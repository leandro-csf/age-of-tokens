// Conteudo por era (docs/CONTEUDO.md). Custos em unidades BASE; o custo real e
// base x fator da era do item (ver costOf em engine.js).
//
// buildings/units: `count` e quantos desta entrada comprar NESTA era; o alvo e
// acumulado por id ao longo das eras. techs: unicas, +5% do recurso `bonus`.
// advance: custo e requisitos para ir DESTA era para a proxima (pago com o fator desta era).

export const ERAS = [
  {
    id: 'trevas', name: 'Era das Trevas', factor: 1,
    buildings: [
      { id: 'casa', name: 'Casa', cost: { wood: 400 }, count: 10 },
      { id: 'fazenda', name: 'Fazenda', cost: { wood: 600 }, count: 8 },
      { id: 'serraria', name: 'Serraria', cost: { wood: 800 }, count: 4 },
      { id: 'mina', name: 'Acampamento de mineracao', cost: { wood: 800, stone: 400 }, count: 3 },
    ],
    units: [
      { id: 'aldeao', name: 'Aldeao', cost: { food: 100 }, count: 60 },
    ],
    techs: [
      { id: 'arado', name: 'Arado', cost: { gold: 500 }, bonus: 'food' },
      { id: 'machado', name: 'Machado de pedra', cost: { gold: 1000 }, bonus: 'wood' },
      { id: 'picareta', name: 'Picareta', cost: { gold: 1500 }, bonus: 'stone' },
      { id: 'prospeccao', name: 'Prospeccao', cost: { gold: 2000 }, bonus: 'gold' },
    ],
    advance: { cost: { food: 6000, gold: 3000 }, minLevel: 10, minBuildings: 6, minTypes: 0, minPop: 20 },
  },
  {
    id: 'feudal', name: 'Era Feudal', factor: 9,
    buildings: [
      { id: 'casa', name: 'Casa', cost: { wood: 400 }, count: 8 },
      { id: 'quartel', name: 'Quartel', cost: { wood: 1200 }, count: 2 },
      { id: 'ferraria', name: 'Ferraria', cost: { wood: 1500, stone: 300 }, count: 1 },
      { id: 'mercado', name: 'Mercado', cost: { wood: 1600, gold: 400 }, count: 1 },
      { id: 'torre', name: 'Torre de vigia', cost: { wood: 400, stone: 250 }, count: 4 },
    ],
    units: [
      { id: 'espadachim', name: 'Espadachim', cost: { food: 120 }, count: 15 },
      { id: 'arqueiro', name: 'Arqueiro', cost: { food: 120 }, count: 15 },
      { id: 'cavaleiro_leve', name: 'Cavaleiro leve', cost: { food: 200 }, count: 15 },
    ],
    techs: [
      { id: 'colheita_pesada', name: 'Colheita pesada', cost: { gold: 300 }, bonus: 'food' },
      { id: 'serra_de_arco', name: 'Serra de arco', cost: { gold: 600 }, bonus: 'wood' },
      { id: 'mineracao_profunda', name: 'Mineracao profunda', cost: { gold: 900 }, bonus: 'stone' },
      { id: 'ensaio_de_metais', name: 'Ensaio de metais', cost: { gold: 1200 }, bonus: 'gold' },
    ],
    advance: { cost: { food: 6000, gold: 3000 }, minLevel: 20, minBuildings: 0, minTypes: 4, minPop: 60 },
  },
  {
    id: 'castelos', name: 'Era dos Castelos', factor: 85,
    buildings: [
      { id: 'casa', name: 'Casa', cost: { wood: 400 }, count: 10 },
      { id: 'castelo', name: 'Castelo', cost: { wood: 2500, stone: 1200 }, count: 1 },
      { id: 'universidade', name: 'Universidade', cost: { wood: 2000, gold: 400 }, count: 1 },
      { id: 'mosteiro', name: 'Mosteiro', cost: { wood: 1800, gold: 300 }, count: 1 },
      { id: 'muralha', name: 'Trecho de muralha', cost: { wood: 50, stone: 60 }, count: 20 },
    ],
    units: [
      { id: 'besteiro', name: 'Besteiro', cost: { food: 100 }, count: 20 },
      { id: 'cavaleiro', name: 'Cavaleiro', cost: { food: 180 }, count: 18 },
      { id: 'monge', name: 'Monge', cost: { food: 150, gold: 80 }, count: 5 },
      { id: 'trebuchet', name: 'Trebuchet', cost: { food: 400, gold: 100 }, count: 3 },
    ],
    techs: [
      { id: 'rotacao_de_culturas', name: 'Rotacao de culturas', cost: { gold: 200 }, bonus: 'food' },
      { id: 'serraria_mecanica', name: 'Serraria mecanica', cost: { gold: 400 }, bonus: 'wood' },
      { id: 'explosivos', name: 'Explosivos', cost: { gold: 600 }, bonus: 'stone' },
      { id: 'cunhagem_real', name: 'Cunhagem real', cost: { gold: 800 }, bonus: 'gold' },
    ],
    advance: { cost: { food: 6000, gold: 3000 }, minLevel: 30, minBuildings: 0, minTypes: 8, minPop: 150 },
  },
  {
    id: 'imperial', name: 'Era Imperial', factor: 800,
    buildings: [
      { id: 'casa', name: 'Casa', cost: { wood: 400 }, count: 10 },
      { id: 'catedral', name: 'Catedral', cost: { wood: 3000, stone: 900, gold: 600 }, count: 1 },
      { id: 'maravilha', name: 'Maravilha', cost: { wood: 3000, stone: 1500, gold: 1500, food: 2000 }, count: 1 },
    ],
    units: [
      { id: 'campeao', name: 'Campeao', cost: { food: 220 }, count: 15 },
      { id: 'arcabuzeiro', name: 'Arcabuzeiro', cost: { food: 200, gold: 50 }, count: 15 },
      { id: 'canhao', name: 'Canhao', cost: { food: 400, gold: 150 }, count: 4 },
      { id: 'paladino', name: 'Paladino', cost: { food: 300, gold: 60 }, count: 10 },
    ],
    techs: [
      { id: 'agricultura_imperial', name: 'Agricultura imperial', cost: { gold: 200 }, bonus: 'food' },
      { id: 'engenharia', name: 'Engenharia', cost: { gold: 400 }, bonus: 'wood' },
      { id: 'mineracao_polvora', name: 'Mineracao com polvora', cost: { gold: 600 }, bonus: 'stone' },
      { id: 'banco_real', name: 'Banco real', cost: { gold: 800 }, bonus: 'gold' },
    ],
    advance: null,
  },
];
