export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

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
  gold: 'ALTIN',
  place: 'ASKERLERİNİ SEÇ VE YERLEŞTİR',
  placeHint: 'Kartı sürükle, kareye bırak',
  fight: 'SAVAŞ!',
  attack: 'SALDIR!',
  round: (n) => `${n}. TUR · SALDIR!`,
  yourTurn: 'SENİN TURUN',
  enemyTurn: 'DÜŞMAN TURU',
  needUnit: 'En az 1 asker yerleştir',
  noGold: 'Yeterli altın yok',
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
  yeniceri: { name: 'YENİÇERİ', art: 'yeniceri', cost: 30, hp: 110, atk: 48, range: 1, speed: 1, h: 190, kind: 'melee' },
  azap: { name: 'AZAP', art: 'azap', cost: 25, hp: 65, atk: 34, range: 3, speed: 1, h: 186, kind: 'ranged' },
  akinci: { name: 'AKINCI', art: 'akinci', cost: 40, hp: 95, atk: 42, range: 1, speed: 2, h: 222, kind: 'cavalry' },
};

// Enemy line-up: row 0 = back, 2 = front; col 0..5 left → right.
export const ENEMY = [
  { type: 'yeniceri', row: 2, col: 4 },
  { type: 'azap', row: 1, col: 5 },
  { type: 'akinci', row: 0, col: 4 },
];
export const ENEMY_MULT = { hp: 0.85, atk: 0.85 };

export const BOARD = {
  cols: 6,
  rows: 3,
  playerCols: [0, 1], // where the player may place units
  // row centre y and scale, back → front
  rowY: [640, 762, 902],
  rowS: [0.8, 0.93, 1.08],
  colW: 106, // at scale 1
};
