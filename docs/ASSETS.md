# Assets de arte: Tiny Swords

Pacote escolhido em 2026-10-29: **Tiny Swords (Free Pack)**, de Pixel Frog.
Fonte: https://pixelfrog-assets.itch.io/tiny-swords  (arquivo "Tiny Swords (Free Pack).zip", 3,3 MB, 428 PNG/Aseprite uteis).

## Licenca (ler a pagina antes de publicar)
- Uso comercial e pessoal permitido, com modificacoes. Credito opcional, mas vamos dar: "Arte: Tiny Swords por Pixel Frog".
- **Proibido redistribuir, revender ou reempacotar os arquivos**, mesmo modificados. Por isso `web/assets/` esta no `.gitignore`: os PNGs NAO entram no repositorio.
- A pagina nao fala de uso para treino de IA. Existe tambem um Enemy Pack pago, que NAO baixamos.

## Como obter de novo (o repo nao traz os arquivos)
1. Abra a pagina acima, clique em Download, escolha "No thanks, just take me to the downloads" (valor zero) e baixe `Tiny Swords (Free Pack).zip`.
2. Extraia para `web/assets/tiny-swords/` de modo que exista `web/assets/tiny-swords/Tiny Swords (Free Pack)/Units/Blue Units/Pawn/...`.
3. `web/assets/tiny-swords-preview.html` e `ui-preview.html` (so locais, dentro da pasta ignorada) animam tudo para conferir.

## Tileset (Tilemap_color1, grade 9x6 de 64 px)
Grama plana: bloco 3x3 em (0..2, 0..2) = cantos/bordas/centro; coluna 3 = faixas verticais; linha 3 = faixas horizontais; (3,3) = tile isolado; (0,4),(0,5),(3,4),(3,5) = escadas. Platô elevado em (5..8, 0..5) com penhasco de pedra nas linhas 4-5. Usamos so o bloco 3x3 para a ilha retangular.

## Interface (medidas das pecas, conferidas na imagem)
Papers (RegularPaper/SpecialPaper 320x320), WoodTable e Banner (448x448): 3x3 pecas separadas por vaos, recompostas em `web/ui/skins.js`. Ribbons: BigRibbons 5 cores x 103 px; SmallRibbons 5 cores (linhas de ~60 px). Icons 01-12: 01 martelo, 02 tora, 03 moeda, 04 carne, 05 espada, 06 escudo, 07 verde, 08 seta laranja, 09 X vermelho, 10 engrenagem, 11 info, 12 notas musicais.

## Convencoes
- Grade do mapa: **64x64 px**. Animacao a **10 fps** (quadros lado a lado em uma tira horizontal, 1 linha).
- Cinco cores de faccao nos predios e unidades: Blue, Red, Purple, Yellow, Black.
- Vista: de cima em 3/4 (NAO isometrica). Unidades tem uma so direcao (lado) e espelham para a outra.

## Inventario (tamanho do quadro e numero de quadros)

### Unidades (por cor, em `Units/<Cor> Units/`)
- **Pawn** (aldeao), quadro 192x192:
  - Idle 8, Run 6; variantes carregando: `Idle|Run` + Axe, Gold, Hammer, Knife, Meat, Pickaxe, Wood.
  - Oficios: `Interact Axe` 6 (corta), `Interact Pickaxe` 6 (minera), `Interact Hammer` 3 (constroi), `Interact Knife` 4.
- **Warrior** 192x192: Idle 8, Run 6, Attack1 4, Attack2 4, Guard 6.
- **Archer** 192x192: Idle 6, Run 4, Shoot 8; `Arrow` 64x64.
- **Lancer** 320x320 (5 direcoes: Down, DownRight, Right, UpRight, Up): Idle 12, Run 6, Attack 3 por direcao, Defence 6 por direcao.
- **Monk** 192x192: Idle 6, Run 4, Heal 11, Heal_Effect 11.
- Nao ha cavalaria nem maquinas de cerco.

### Predios (por cor, em `Buildings/<Cor> Buildings/`), imagens estaticas
Archery 192x256, Barracks 192x256, Castle 320x256, House1/2/3 128x192, Monastery 192x320, Tower 128x256.
Nao ha: fazenda, serraria, mina, mercado, ferraria, universidade, catedral, muralha, maravilha.

### Recursos e natureza (`Terrain/`)
- Arvores `Tree1`, `Tree2` 192x256 e `Tree3`, `Tree4` 192x192, todas com 8 quadros (balanco); `Stump 1-4` 192x256 (tocos, estaticos).
- Ouro: `Gold Stone 1-6` 128x128 (+ `_Highlight` 6 quadros), `Gold_Resource` 128x128.
- Carne: `Sheep_Grass` 12 quadros, `Sheep_Idle` 6, `Sheep_Move` 4 (128x128); `Meat Resource` 64x64.
- Madeira: `Wood Resource` 64x64. Ferramentas `Tool_01-04` 64x64.
- Decoracao: `Bushe1-4` 128x128 x 8 quadros, `Rock1-4` 64x64, `Water Rocks_01-04` (16 quadros de 64), `Clouds_01-08` 576x256, patinho de borracha.
- Terreno: `Tilemap_color1-5` 576x384 (9x6 tiles de 64; 5 cores de grama), `Shadow` 192x192, `Water Background color` 64x64, `Water Foam` 3072x192 (16 quadros de 192).

### Efeitos (`Particle FX/`)
Dust_01 (8 quadros de 64), Dust_02 (10), Fire_01 (8), Fire_02 (10), Fire_03 (12), Explosion_01 (8 de 192), Explosion_02 (10), Water Splash (9 de 192).

### Interface (`UI Elements/UI Elements/`)
Banner 448x448 (esticavel), Banner_Slots, BigBar/SmallBar (base + fill), botoes grandes/pequenos/minusculos azuis e vermelhos (normal e pressionado), cursores, 21+ avatares humanos 256x256, fitas e papeis (esticaveis).
