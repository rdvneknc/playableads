// Portrait 720×1280 or landscape 720 tall (width follows the screen, 1280–1560).
// `applyLayout` runs before the game is created; importers see the live values.
export let GAME_WIDTH = 720;
export let GAME_HEIGHT = 1280;
export let LANDSCAPE = false;

export const FONT_TITLE = 'OWTitle, Georgia, "Times New Roman", serif';
export const FONT = 'OWUi, "Arial Black", Arial, sans-serif';

export const AD = {
  // TODO: Ottoman Wars store links
  storeUrl: 'https://play.google.com/store/apps/details?id=com.example.ottomanwars',
  iosStoreUrl: 'https://apps.apple.com/app/id0000000000',
  idleHintMs: 3000,
  idleEndMs: 30000,
  autoRoundMs: 2600, // next round starts by itself if the player doesn't tap
};

export const TEXT = {
  gold: 'AKÇE',
  place: 'ASKERLERİNİ SEÇ VE YERLEŞTİR',
  placeHint: 'Kartı sürükle, kareye bırak',
  fight: 'SAVAŞ!',
  attack: 'SALDIR!',
  round: (n) => `${n}. TUR · SALDIR!`,
  yourTurn: 'SENİN TURUN',
  enemyTurn: 'DÜŞMAN TURU',
  needUnit: 'En az 1 asker yerleştir',
  noGold: 'Yeterli akçe yok',
  victory: 'ZAFER!',
  defeat: 'YENİLDİN',
  victoryLine: 'Kale düştü! Şimdi asıl savaş başlıyor.',
  defeatLine: 'Ordunu güçlendir, tekrar dene!',
  playNow: 'HEMEN OYNA',
  retry: 'TEKRAR DENE',
};

export const BUDGET = 100;

// Unit types. `art`: texture key; `h`: display height at the front row (px).
export const UNITS = {
  yeniceri: { name: 'YENİÇERİ', art: 'yeniceri', cost: 30, hp: 110, atk: 48, range: 1, speed: 1, h: 190, kind: 'melee', face: 0.47 },
  azap: { name: 'AZAP', art: 'azap', cost: 25, hp: 65, atk: 34, range: 3, speed: 1, h: 186, kind: 'ranged', face: 0.36 },
  tufekci: { name: 'TÜFEKÇİ', art: 'tufekci', cost: 35, hp: 70, atk: 52, range: 3, speed: 1, h: 192, kind: 'gun', face: 0.34 },
  akinci: { name: 'AKINCI', art: 'akinci', cost: 40, hp: 95, atk: 42, range: 1, speed: 2, h: 222, kind: 'cavalry', face: 0.44 },
  tatar: { name: 'TATAR', art: 'tatar', cost: 40, hp: 80, atk: 30, range: 2, speed: 2, h: 226, kind: 'horsearcher', face: 0.44 },
  top: { name: 'TOP', art: 'top', cost: 50, hp: 90, atk: 46, range: 5, speed: 0, h: 168, kind: 'cannon', face: 0.17 },
};

// Enemy line-up: row 0 = back, 2 = front; col 0..5 left → right.
export const ENEMY = [
  { type: 'yeniceri', row: 2, col: 4 },
  { type: 'tufekci', row: 1, col: 5 },
  { type: 'akinci', row: 0, col: 4 },
];
export const ENEMY_MULT = { hp: 0.72, atk: 0.76 };

export const BOARD = {
  cols: 6,
  rows: 3,
  playerCols: [0, 1], // where the player may place units
  // row centre y and scale, back → front (set by applyLayout)
  rowY: [],
  rowS: [],
  colW: 0,
};

// Screen positions for everything that isn't on the board.
export const L = {};

export function applyLayout(landscape, aspect = 16 / 9) {
  LANDSCAPE = landscape;
  if (!landscape) {
    GAME_WIDTH = 720;
    GAME_HEIGHT = 1280;
    Object.assign(BOARD, { rowY: [640, 762, 902], rowS: [0.8, 0.93, 1.08], colW: 106 });
    const cardW = 112;
    Object.assign(L, {
      bg: 'bg',
      cardY: 1052,
      cardW,
      cardX: [0, 1, 2, 3, 4, 5].map((i) => 360 + (i - 2.5) * (cardW + 4)),
      fight: { x: 360, y: 1210, w: 400 },
      attack: { x: 360, y: 1120, w: 400 },
      bannerY: 470,
      gold: { x: 360, y: 66 },
      instr: { x: 360, y: 152, size: 30 },
      logo: { x: 360, y: 330, s: 0.72 },
      castle: { x: 606, y: 585, w: 250 },
      tents: [
        [78, 560, 0.78],
        [196, 520, 0.5],
      ],
      hintY: 965,
      pan: [560, 540],
      end: { logoY: 220, logoS: 0.95, titleY: 470, titleSize: 92, unitsY: 820, unitH: 1, lineY: 880, ctaY: 1010, ctaW: 500, retry: [360, 1135], raysY: 520 },
    });
    return;
  }
  GAME_HEIGHT = 720;
  GAME_WIDTH = Math.round(Math.min(1560, Math.max(1280, 720 * aspect)));
  const cx = GAME_WIDTH / 2;
  Object.assign(BOARD, { rowY: [330, 436, 560], rowS: [0.66, 0.76, 0.88], colW: 176 });
  const cardW = 84;
  Object.assign(L, {
    bg: 'zemin-yatay',
    cardY: 664,
    cardW,
    cardX: [0, 1, 2, 3, 4, 5].map((i) => cx - 130 + (i - 2.5) * (cardW + 6)),
    fight: { x: cx + 372, y: 664, w: 300 },
    attack: { x: cx, y: 664, w: 340 },
    bannerY: 190,
    gold: { x: GAME_WIDTH - 180, y: 52 },
    instr: { x: cx, y: 46, size: 28 },
    logo: { x: 118, y: 92, s: 0.42 },
    castle: { x: cx + 520, y: 352, w: 230 },
    tents: [
      [cx - 545, 352, 0.72],
      [cx - 440, 318, 0.46],
    ],
    hintY: 596,
    pan: [cx + 380, 320],
    end: { logoY: 128, logoS: 0.62, titleY: 300, titleSize: 76, unitsY: 535, unitH: 0.72, lineY: 572, ctaY: 650, ctaW: 400, retry: [cx + 330, 650], raysY: 330 },
  });
}

applyLayout(true);
