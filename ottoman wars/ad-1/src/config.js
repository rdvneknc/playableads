// Landscape, 720 tall; the width follows the screen (1280–1560). `applyLayout`
// runs before the game is created and importers see the live values.
export let GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const LANDSCAPE = true;

export const FONT_TITLE = 'OWTitle, Georgia, "Times New Roman", serif';
export const FONT = 'OWUi, "Arial Black", Arial, sans-serif';

export const AD = {
  // TODO: Ottoman Wars store links
  storeUrl: 'https://play.google.com/store/apps/details?id=com.example.ottomanwars',
  iosStoreUrl: 'https://apps.apple.com/app/id0000000000',
  idleHintMs: 3000,
  idleEndMs: 35000,
  autoRoundMs: 2200, // next round starts by itself if the player doesn't tap
  maxRounds: 8,
};

export const TEXT = {
  gold: 'AKÇE',
  place: 'ORDUNU KUR: ASKER SEÇ, KAREYE YERLEŞTİR',
  placeHint: 'Kartı sürükle, kendi bölgene bırak',
  fight: 'SAVAŞ!',
  attack: 'SALDIR!',
  round: (n) => `${n}. TUR`,
  needUnit: 'En az 1 asker yerleştir',
  noGold: 'Yeterli akçe yok',
  victory: 'ZAFER!',
  defeat: 'YENİLDİN',
  victoryLine: 'Kale düştü! Asıl savaş şimdi başlıyor.',
  defeatLine: 'Ordunu güçlendir, tekrar dene!',
  playNow: 'HEMEN OYNA',
  retry: 'TEKRAR DENE',
  stats: { hp: 'Can', atk: 'Saldırı', def: 'Zırh', range: 'Menzil', move: 'Hareket' },
  charge: 'HÜCUM!',
  crit: 'ETKİLİ!',
  counter: 'KARŞI SALDIRI',
  castle: 'KALE',
};

export const BUDGET = 150;
export const CASTLE_HP = 260;

/*
 * Unit design (all deterministic, no dice):
 *   damage = atk × 100 / (100 + effective armour) × modifiers, rounded
 *   - armour piercing (musket) halves the target's armour
 *   - counters: a unit's `bonus` lists target kinds it deals +50% to
 *   - charge: cavalry that moved 2+ tiles this turn hits for +50%
 *   - ranged units in melee contact can't shoot; they strike back at 50%
 *   - arrows lose 25% beyond half of their range
 *   - a melee unit that survives a melee hit strikes back at 50% (once per turn)
 *   - turn order each round = initiative (high first); ties go to the player
 *   - musketeers must stand still to fire; the cannon never moves and can't fire point-blank
 *   - siege: the cannon deals ×2 to castles; splash 50% to units next to its target
 */
export const UNITS = {
  yeniceri: {
    name: 'YENİÇERİ', art: 'yeniceri', kind: 'melee', cost: 30,
    hp: 130, atk: 42, def: 40, range: 1, move: 2, init: 5,
    bonus: ['cavalry', 'horsearcher'], h: 190, face: 0.47,
    tip: 'Ağır zırh, atlılara karşı güçlü',
  },
  azap: {
    name: 'AZAP', art: 'azap', kind: 'ranged', cost: 20,
    hp: 60, atk: 28, def: 5, range: 4, move: 2, init: 6,
    bonus: [], h: 186, face: 0.36,
    tip: 'Ucuz okçu, uzaktan vurur',
  },
  tufekci: {
    name: 'TÜFEKÇİ', art: 'tufekci', kind: 'gun', cost: 35,
    hp: 70, atk: 50, def: 10, range: 3, move: 1, init: 3, pierce: true,
    bonus: ['melee'], h: 192, face: 0.34,
    tip: 'Zırh deler, ateş için durmalı',
  },
  akinci: {
    name: 'AKINCI', art: 'akinci', kind: 'cavalry', cost: 40,
    hp: 105, atk: 38, def: 20, range: 1, move: 4, init: 9,
    bonus: ['ranged', 'gun', 'cannon'], h: 222, face: 0.44,
    tip: 'Hızlı hücum, okçu ve topu ezer',
  },
  tatar: {
    name: 'TATAR', art: 'tatar', kind: 'horsearcher', cost: 35,
    hp: 80, atk: 25, def: 10, range: 3, move: 3, init: 8,
    bonus: ['gun', 'cannon'], h: 226, face: 0.44,
    tip: 'Hem koşar hem ok atar',
  },
  top: {
    name: 'TOP', art: 'top', kind: 'cannon', cost: 50,
    hp: 90, atk: 58, def: 25, range: 7, minRange: 2, move: 0, init: 1, splash: 0.5, siege: 2,
    bonus: [], h: 168, face: 0.17,
    tip: 'Uzun menzil, alan hasarı, kale yıkar',
  },
};

// Enemy army (worth 155 akçe). row 0 = back … 4 = front; cols 0..9 left → right.
export const ENEMY = [
  { type: 'akinci', row: 0, col: 8 },
  { type: 'yeniceri', row: 1, col: 7 },
  { type: 'azap', row: 2, col: 8 },
  { type: 'yeniceri', row: 3, col: 7 },
  { type: 'tufekci', row: 4, col: 8 },
];
export const ENEMY_MULT = { hp: 0.8, atk: 0.85 };

export const BOARD = {
  cols: 10,
  rows: 5,
  playerCols: [0, 1, 2],
  enemyCols: [7, 8, 9],
  rowY: [332, 386, 446, 514, 590],
  rowS: [0.5, 0.555, 0.615, 0.685, 0.765],
  colW: 140,
};

// Screen positions for everything that isn't on the board.
export const L = {};

export function applyLayout(aspect = 16 / 9) {
  GAME_WIDTH = Math.round(Math.min(1560, Math.max(1280, 720 * aspect)));
  const cx = GAME_WIDTH / 2;
  const cardW = 80;
  Object.assign(L, {
    bg: 'zemin-yatay',
    cardY: 664,
    cardW,
    cardX: [0, 1, 2, 3, 4, 5].map((i) => cx - 150 + (i - 2.5) * (cardW + 6)),
    fight: { x: cx + 380, y: 666, w: 280 },
    attack: { x: cx + 380, y: 666, w: 280 },
    bannerY: 190,
    gold: { x: GAME_WIDTH - 170, y: 50 },
    instr: { x: cx, y: 44, size: 26 },
    info: { x: cx, y: 112 },
    logo: { x: 112, y: 84, s: 0.38 },
    castles: {
      p: { x: cx - 478, y: 372, w: 210 },
      e: { x: cx + 478, y: 372, w: 210 },
    },
    hintY: 604,
    end: { logoY: 128, logoS: 0.62, titleY: 300, titleSize: 76, unitsY: 535, unitH: 0.72, lineY: 572, ctaY: 650, ctaW: 400, retry: [cx + 330, 650], raysY: 330 },
  });
}

applyLayout();
