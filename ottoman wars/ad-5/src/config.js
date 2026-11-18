// Ottoman Wars — Ad 5 "Av ve Sefer": hunt deer, cook in the kazan, feed the soldiers,
// collect their akçe, grow the army, and march on the enemy outposts one by one
// until the enemy headquarters falls.
// World: x right (east), z toward the camera (south); the enemy is to the north (-Z).

export const AD = {
  // TODO: Ottoman Wars store links
  storeUrl: 'https://play.google.com/store/apps/details?id=com.example.ottomanwars',
  iosStoreUrl: 'https://apps.apple.com/app/id0000000000',
};

export const TEXT = {
  title: 'OTTOMAN WARS',
  drag: 'SÜRÜKLE',
  hungry: 'Karnımız aç, Ağa!',
  tips: {
    hunt: 'Geyik avla, eti topla.',
    meat: 'Etleri kazanın yanındaki alana götür.',
    bowls: 'Yemekleri al.',
    serve: 'Yemekleri masadaki askerlere götür.',
    coins: 'Masanın yanındaki akçeleri topla.',
    pay: 'Akçeleri alana bırak.',
    attack: 'SALDIR alanında bekle, ordu saldırsın!',
    wait: 'Askerler yemeğini yiyor...',
  },
  feed: 'ASKERLERİ DOYUR',
  attack: 'SALDIR',
  attackOn: (n) => `${n}. KARAKOLA SALDIR`,
  attackHq: 'MERKEZE SALDIR',
  armyFull: 'ORDU HAZIR!',
  victoryOutpost: 'KARAKOL DÜŞTÜ!',
  defeat: 'ORDU GERİ ÇEKİLDİ',
  needCannon: 'KAPI SAĞLAM! TOP LAZIM',
  loot: (n) => `+${n} GANİMET`,
  newSoldiers: 'YENİ ASKERLER!',
  victory: 'ZAFER!',
  victoryLine: 'Düşman merkezi düştü. Sıra sende!',
  buildArmy: 'ORDUNU KUR',
  playNow: 'ŞİMDİ OYNA',
  full: 'DOLU',
  zoneMeat: 'ET',
  zoneFood: 'YEMEK',
  zoneCoins: 'AKÇE',
};

// purchases: label on the plot, card over it, quest line
export const INFO = {
  ordu10: { short: 'ORDU 10', name: 'ORDU: 10 YENİÇERİ', desc: 'Ordu 6 → 10 asker', quest: 'ORDUYU BÜYÜT' },
  avci: { short: 'AVCI', name: 'AVCI', desc: 'Geyik avlar, eti kazana taşır', quest: 'AVCI TUT' },
  garson: { short: 'GARSON', name: 'GARSON', desc: 'Yemekleri masaya taşır', quest: 'GARSON TUT' },
  azap: { short: 'AZAP', name: 'AZAP ÇADIRI', desc: '+4 azap okçusu', quest: 'AZAP ÇADIRI' },
  tufek: { short: 'TÜFEK', name: 'TÜFEKHANE', desc: '+2 tüfekli yeniçeri', quest: 'TÜFEKHANE' },
  top: { short: 'TOP', name: 'DÖKÜMHANE', desc: 'Orduya bir top', quest: 'DÖKÜMHANE' },
};

export const FONT_TITLE = 'OWTitle, Georgia, "Times New Roman", serif';
export const FONT_UI = 'OWUi, "Arial Black", Arial, sans-serif';

export const ECON = {
  akcePerSoldier: 2,
};

export const PLAYER = {
  speed: 6.4,
  stackMax: 5,
  pickEvery: 0.12,
  dropEvery: 0.16,
  payEvery: 0.07,
  reach: 2.0,
  shootRange: 6,
  shootEvery: 0.42,
};

export const WORKER = { speed: 4.6, carry: 3, shootEvery: 0.6 };

export const KITCHEN = {
  cook: 0.6, // s per bowl
  pileMax: 12, // bowls waiting at the food zone
  eat: 1.1,
  arriveEvery: 0.7,
};

export const DEER = { count: 5, hp: 2, walk: 1.3, run: 5.5, respawn: 2.2 };

export const MAP = {
  start: [-1.0, 7.4],
  kazan: [0, 0],
  meatZone: [-3.0, 1.6], // drop meat here: it goes into the kazan
  foodZone: [3.2, 1.6], // bowls come out here
  counter: [8.0, -1.2], // the long table (along X)
  seats: [
    [6.2, -2.65],
    [7.4, -2.65],
    [8.6, -2.65],
    [9.8, -2.65],
  ],
  coinZone: [12.4, -0.2], // the akçe pile next to the table
  line: [11.6, -4.0],
  lineStep: [0.8, -0.5],
  arrive: [19, -7],
  meadow: { x: -2, z: 15, rx: 8, rz: 5 }, // the deer meadow south of the camp
  banner: [-6.4, -9.5],
  // formation slots by unit kind (front row is the most northern)
  ranks: { jan: [0, -14.6], azap: [0, -11.2], tuf: [0, -9.9], top: [5.4, -11.4] },
  attackPad: [0, -18.2],
  upgradePad: [-7.2, -5.6],
  avciPad: [-6.8, 6.4],
  garsonPad: [7.2, 2.8],
  buildings: { ordu10: [-11.6, -12.5], azap: [-12.2, -7.6], tufek: [-12.4, -2.4], top: [-11.6, 3.2] },
  bounds: { x0: -15, x1: 15, z0: -19.5, z1: 21 },
};

// unit stats (hp, damage per second, attack range, speed)
export const UNITS = {
  jan: { hp: 10, dps: 3.0, range: 1.25, speed: 4.6 },
  azap: { hp: 5, dps: 1.8, range: 9, speed: 4.2, shot: 0.9 },
  tuf: { hp: 6, dps: 4.0, range: 11, speed: 4.2, shot: 1.6 },
  top: { hp: 40, dps: 6.5, range: 15, speed: 3.2, shot: 2.4, splash: 2.2 },
  enemy: { hp: 9, dps: 2.4, range: 1.25, speed: 4.2, aggro: 13 },
};

// army size after each upgrade
export const ARMY = {
  base: { jan: 6, azap: 0, tuf: 0, top: 0 },
  ordu10: { jan: 10 },
  azap: { azap: 4 },
  tufek: { tuf: 2 },
  top: { top: 1 },
};

// the upgrade plot shows the next army upgrade once its outpost requirement is met
export const UPGRADES = [
  { id: 'ordu10', cost: 5, after: 0 },
  { id: 'azap', cost: 12, after: 1 },
  { id: 'tufek', cost: 14, after: 3 },
  { id: 'top', cost: 16, after: 3 },
];
export const WORKERS = [
  { id: 'avci', cost: 6, at: MAP.avciPad },
  { id: 'garson', cost: 6, at: MAP.garsonPad },
];

// enemy positions, north of the camp. building hp; `wall`: soldiers must pass through its gap.
export const OUTPOSTS = [
  {
    name: '1. KARAKOL',
    power: 1.0, // enemy soldier strength (hp and damage)
    loot: 6,
    z: -27,
    tents: [[-4.5, -30], [4.2, -30.5]],
    towers: [{ x: 2.6, z: -26.5, hp: 14, dps: 1.3 }],
    soldiers: [[-1.2, -24.5], [1.2, -24.5]],
  },
  {
    name: '2. KARAKOL',
    power: 1.6, // enemy soldier strength (hp and damage)
    loot: 8,
    z: -42,
    wall: { z: -38.5, gap: 3.4, len: 22, kind: 'palisade' },
    tents: [[-5, -44], [0, -45.5], [5, -44]],
    towers: [{ x: -3.5, z: -40.5, hp: 20, dps: 1.5 }],
    soldiers: [[-3, -36.5], [-1.5, -36], [0, -36.5], [1.5, -36], [3, -36.5]],
  },
  {
    name: '3. KARAKOL',
    power: 1.35, // enemy soldier strength (hp and damage)
    loot: 10,
    z: -57,
    wall: { z: -53.5, gap: 3.4, len: 24, kind: 'palisade' },
    tents: [[-6, -59], [-2, -60.5], [2, -60.5], [6, -59]],
    towers: [
      { x: -5, z: -55.5, hp: 22, dps: 1.6 },
      { x: 5, z: -55.5, hp: 22, dps: 1.6 },
    ],
    soldiers: [[-4.2, -51.5], [-3, -51], [-1.8, -51.5], [-0.6, -51], [0.6, -51.5], [1.8, -51], [3, -51.5], [4.2, -51]],
  },
  {
    name: 'DÜŞMAN MERKEZİ',
    power: 1.15, // enemy soldier strength (hp and damage)
    hq: true,
    z: -75,
    wall: { z: -69, gap: 2.6, len: 30, kind: 'stone', gate: { hp: 30, soft: 0.03 } },
    keep: { x: 0, z: -77, hp: 45, soft: 0.3 },
    tents: [[-8, -76], [8, -76]],
    towers: [
      { x: -8.5, z: -69.6, hp: 30, dps: 2.6, y: 3.6 },
      { x: 8.5, z: -69.6, hp: 30, dps: 2.6, y: 3.6 },
    ],
    // inside the walls: they come out when the gate falls
    soldiers: [[-4, -72], [-2.6, -72.5], [-1.2, -72], [1.2, -72], [2.6, -72.5], [4, -72], [-3.3, -73.8], [-1.6, -74], [1.6, -74], [3.3, -73.8]],
  },
];

export const COLORS = {
  cookRobe: 0xf3ead6,
  apron: 0x8a5a34,
  sash: 0xc0242c,
  turban: 0xf4f1ea,
  skin: 0xe2ad84,
  beard: 0x3a2412,
  boot: 0x5a2e16,
  janCoat: 0xb3302a,
  janUnder: 0x2c4f8a,
  janSash: 0xe0a83a,
  bork: 0xf5f1e6,
  hamalVest: 0x6a4a2c,
  hamalShirt: 0xe8dcc0,
  hamalPants: 0x4f6a3a,
  semer: 0x9a3a24,
  enemyCoat: 0x2f6fd6,
  enemyDark: 0x1c3f86,
  enemyHelm: 0xaeb8c4,
  steel: 0xc9d1da,
  gold: 0xe8b33a,
  wood: 0x8a5a30,
  coin: 0xffcf3a,
  red: 0xc8202a,
  sack: 0xc9ad78,
  copper: 0xb8652a,
  stew: 0xc86a2a,
  meat: 0xa8452e,
};
