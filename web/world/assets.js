// Carregador dos sprites do Tiny Swords (web/assets/, fora do git: ver docs/ASSETS.md).
// Cada tira horizontal vira { img, fw, fh, n } (n = numero de quadros).

const ROOT = 'assets/tiny-swords/Tiny Swords (Free Pack)/';
export const A = {};              // nome -> { img, fw, fh, n }
export const COLORS = ['Blue', 'Red', 'Purple', 'Yellow', 'Black'];

function load(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('nao carregou: ' + path));
    img.src = encodeURI(ROOT + path);
  });
}

// [nome, caminho, largura do quadro, altura do quadro]  (0 = imagem inteira, 1 quadro)
function manifest() {
  const m = [];
  const add = (name, path, fw = 0, fh = 0) => m.push([name, path, fw, fh]);

  // 5 cores de grama = 5 biomas (o prestigio troca de bioma)
  for (let i = 1; i <= 5; i++) add('tilemap' + i, `Terrain/Tileset/Tilemap_color${i}.png`);
  add('foam', 'Terrain/Tileset/Water Foam.png', 192, 192);
  add('waterBg', 'Terrain/Tileset/Water Background color.png');
  add('shadow', 'Terrain/Tileset/Shadow.png');

  for (const [i, h] of [[1, 256], [2, 256], [3, 192], [4, 192]]) add('tree' + i, `Terrain/Resources/Wood/Trees/Tree${i}.png`, 192, h);
  for (let i = 1; i <= 4; i++) add('stump' + i, `Terrain/Resources/Wood/Trees/Stump ${i}.png`);
  for (let i = 1; i <= 6; i++) add('gold' + i, `Terrain/Resources/Gold/Gold Stones/Gold Stone ${i}.png`);
  add('sheepGrass', 'Terrain/Resources/Meat/Sheep/Sheep_Grass.png', 128, 128);
  add('sheepIdle', 'Terrain/Resources/Meat/Sheep/Sheep_Idle.png', 128, 128);
  add('sheepMove', 'Terrain/Resources/Meat/Sheep/Sheep_Move.png', 128, 128);
  add('woodRes', 'Terrain/Resources/Wood/Wood Resource/Wood Resource.png');
  add('meatRes', 'Terrain/Resources/Meat/Meat Resource/Meat Resource.png');
  for (let i = 1; i <= 4; i++) add('bush' + i, `Terrain/Decorations/Bushes/Bushe${i}.png`, 128, 128);
  for (let i = 1; i <= 4; i++) add('rock' + i, `Terrain/Decorations/Rocks/Rock${i}.png`);

  for (let i = 1; i <= 4; i++) add('waterRocks' + i, `Terrain/Decorations/Rocks in the Water/Water Rocks_0${i}.png`, 64, 64);
  add('duck', 'Terrain/Decorations/Rubber Duck/Rubber duck.png', 32, 32);
  for (let i = 1; i <= 8; i++) add('cloud' + i, `Terrain/Decorations/Clouds/Clouds_0${i}.png`);

  for (const c of COLORS) {
    for (const b of ['House1', 'House2', 'House3', 'Barracks', 'Archery', 'Tower', 'Monastery', 'Castle']) add(`${b}_${c}`, `Buildings/${c} Buildings/${b}.png`);
  }

  // peao azul: parado/correndo com cada carga, e os oficios
  const U = 'Units/Blue Units/';
  for (const v of ['', ' Axe', ' Gold', ' Hammer', ' Knife', ' Meat', ' Pickaxe', ' Wood']) {
    add('pawnIdle' + v, `${U}Pawn/Pawn_Idle${v}.png`, 192, 192);
    add('pawnRun' + v, `${U}Pawn/Pawn_Run${v}.png`, 192, 192);
  }
  for (const v of ['Axe', 'Pickaxe', 'Hammer', 'Knife']) add('pawnDo' + v, `${U}Pawn/Pawn_Interact ${v}.png`, 192, 192);

  add('warriorIdle', U + 'Warrior/Warrior_Idle.png', 192, 192);
  add('warriorRun', U + 'Warrior/Warrior_Run.png', 192, 192);
  add('warriorAtk', U + 'Warrior/Warrior_Attack1.png', 192, 192);
  add('archerIdle', U + 'Archer/Archer_Idle.png', 192, 192);
  add('archerRun', U + 'Archer/Archer_Run.png', 192, 192);
  add('archerShoot', U + 'Archer/Archer_Shoot.png', 192, 192);
  add('lancerIdle', U + 'Lancer/Lancer_Idle.png', 320, 320);
  add('lancerRun', U + 'Lancer/Lancer_Run.png', 320, 320);
  add('monkIdle', U + 'Monk/Idle.png', 192, 192);
  add('monkRun', U + 'Monk/Run.png', 192, 192);
  add('monkHeal', U + 'Monk/Heal.png', 192, 192);

  add('dust1', 'Particle FX/Dust_01.png', 64, 64);
  add('dust2', 'Particle FX/Dust_02.png', 64, 64);
  add('fire1', 'Particle FX/Fire_01.png', 64, 64);
  add('fire2', 'Particle FX/Fire_02.png', 64, 64);
  add('fire3', 'Particle FX/Fire_03.png', 64, 64);
  return m;
}

/** Carrega tudo em paralelo. onProgress(feitos, total). */
export async function loadAssets(onProgress) {
  const m = manifest();
  let done = 0;
  await Promise.all(m.map(async ([name, path, fw, fh]) => {
    const img = await load(path);
    A[name] = { img, fw: fw || img.width, fh: fh || img.height, n: fw ? Math.round(img.width / fw) : 1 };
    onProgress?.(++done, m.length);
  }));
  return A;
}

/** Desenha o quadro `frame` (modulo n) da tira `s` com o canto superior esquerdo em (x, y). */
export function frame(ctx, s, f, x, y, flip = false) {
  const i = ((Math.floor(f) % s.n) + s.n) % s.n;
  if (!flip) { ctx.drawImage(s.img, i * s.fw, 0, s.fw, s.fh, x, y, s.fw, s.fh); return; }
  ctx.save();
  ctx.translate(x + s.fw, y);
  ctx.scale(-1, 1);
  ctx.drawImage(s.img, i * s.fw, 0, s.fw, s.fh, 0, 0, s.fw, s.fh);
  ctx.restore();
}
