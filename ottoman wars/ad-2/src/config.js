// Ottoman Wars — Ad 2: 3D army runner.
// World axes: the army marches toward -Z, the road spans x ∈ [-ROAD.half, ROAD.half].

export const AD = {
  // TODO: Ottoman Wars store links
  storeUrl: 'https://play.google.com/store/apps/details?id=com.example.ottomanwars',
  iosStoreUrl: 'https://apps.apple.com/app/id0000000000',
  idleHintMs: 2500,
  maxSessionMs: 70000,
};

export const TEXT = {
  title: 'OTTOMAN WARS',
  swipe: 'KAYDIR, ORDUNU YÖNET!',
  victory: 'ZAFER!',
  victoryLine: 'Kale düştü! Fetih seni bekliyor.',
  defeat: 'YENİLDİN',
  defeatLine: 'Daha büyük bir ordu kur, tekrar dene!',
  playNow: 'HEMEN OYNA',
  retry: 'TEKRAR DENE',
  akinci: 'AKINCI',
  siege: 'KAPIYI KIR!',
  charge: 'HÜCUM!',
  army: 'ORDU',
};

export const FONT_TITLE = 'OWTitle, Georgia, "Times New Roman", serif';
export const FONT_UI = 'OWUi, "Arial Black", Arial, sans-serif';

export const ROAD = { half: 4.7, width: 9.4 };

export const ARMY = {
  start: 6,
  speed: 13, // units / s
  steer: 16, // how fast the army centre follows the finger (1/s)
  spacing: 0.7, // formation spacing
  maxVisible: 260, // more than this are counted but not drawn
  riderSpacing: 1.2,
};

/*
 * The level, by distance along the road (world z = -d).
 *  gate:   two panels; op = '+', '-', 'x', '/'; kind 'rider' adds akıncı cavalry
 *  squad:  enemy soldiers waiting on the road
 *  spikes: wooden stake barricades; side = which half is blocked
 */
export const LEVEL = [
  { d: 42, type: 'gate', left: { op: 'x', n: 2 }, right: { op: '+', n: 12 } },
  { d: 88, type: 'squad', n: 8, x: 0 },
  { d: 128, type: 'gate', left: { op: '+', n: 25 }, right: { op: '-', n: 5 } },
  { d: 168, type: 'spikes', side: 'right' },
  { d: 200, type: 'gate', left: { op: 'x', n: 2 }, right: { op: '+', n: 10, kind: 'rider' } },
  { d: 246, type: 'spikes', side: 'left' },
  { d: 278, type: 'gate', left: { op: '+', n: 30 }, right: { op: 'x', n: 3 } },
  { d: 322, type: 'squad', n: 30, x: 0 },
  { d: 360, type: 'gate', left: { op: '/', n: 2 }, right: { op: '+', n: 40 } },
];

export const FINALE = {
  armyD: 420, // enemy army waiting in front of the fortress
  armyN: 45,
  castleD: 452, // fortress gate line
  gateHp: 80,
};

export const COLORS = {
  sky: 0x8ec5ff,
  horizon: 0xffd9a0,
  fog: 0xf3d5a8,
  grass: 0x8cbf4f,
  grassDark: 0x679c3a,
  road: 0xcbb69a,
  // Ottoman army
  coat: 0xc8202a,
  coatDark: 0x8d1018,
  gold: 0xe8b33a,
  hat: 0xf4efe4,
  skin: 0xe9b48a,
  trousers: 0x2d3a6a,
  boot: 0x5a2a12,
  steel: 0xc9d1da,
  // enemy
  enemyCoat: 0x2f6fd6,
  enemyDark: 0x1c3f86,
  enemyHelm: 0xaeb8c4,
  // horse
  horse: 0x7a4a25,
  horseDark: 0x3d2412,
  saddle: 0xb81c26,
  // gates
  good: 0x2fa8ff,
  bad: 0xff3a4a,
};
