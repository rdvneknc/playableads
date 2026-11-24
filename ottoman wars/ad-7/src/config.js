// Ottoman Wars — Ad 7 "Sınır Karakolu": a small frontier camp on the Anatolian steppe.
// Workers bring stone from the quarry, the commander carries it to the counter for akçe,
// builds archer towers, bears drop meat, meat recruits Yeniçeri, a giant bear attacks,
// and finally the camp is rebuilt as a stone fortress — with the enemy castle on the horizon.
// World: x right (east), z toward the camera (south); the bears come from the north (-Z).

export const AD = {
  // TODO: Ottoman Wars store links
  storeUrl: 'https://play.google.com/store/apps/details?id=com.example.ottomanwars',
  iosStoreUrl: 'https://apps.apple.com/app/id0000000000',
};

export const TEXT = {
  drag: 'SÜRÜKLE',
  playNow: 'HEMEN OYNA',
  obj: {
    bears: 'Ayıları kovala!',
    pile: 'Taşları topla',
    counter: 'Taşları tezgâha götür',
    coins: 'Akçeleri al',
    tower: 'Okçu kulesi kur',
    meat: 'Etleri topla',
    recruit: 'Yeniçeri topla',
    boss: 'Dev ayıyı yen!',
    loot: 'Ganimeti topla',
    fort: 'Kampı KALEYE çevir!',
  },
  boss: 'DEV AYI GELİYOR!',
  built: 'Kule kuruldu!',
  newSoldier: 'Yeniçeri katıldı!',
  fortBuild: 'KALE KURULUYOR!',
  next: 'SIRADAKİ HEDEF',
  nextSub: 'DÜŞMAN KALESİ',
  endTitle: 'Kaleni kur, düşmanı fethet!',
  endSub: 'Karakolunu büyüt, ordunu topla, kuşatmaya başla.',
  full: 'DOLU',
};

// the camp (wooden palisade); gaps: north gate and east quarry gate
export const CAMP = { x0: -7.5, x1: 7.5, z0: -7, z1: 7, gate: 1.7, eastGate: [-5, -2] };

export const SPOTS = {
  hero: [0, 2.5],
  pile: [5.6, -3.5],
  counter: [3.6, 1.6],
  coins: [5.6, 1.6],
  rack: [-5.2, -4.2],
  recruit: [-4.4, 2.8],
  tent: [-5.2, 5.4],
  fort: [0, 0.6],
  quarry: [13, -12],
  rally: [0, -10.5],
};

// purchase pads: where, what it builds, price
export const PADS = {
  tower1: { at: [-2.6, -4.4], cost: 18, tower: [-3.6, -5.8], icon: 'tower' },
  recruit: { at: SPOTS.recruit, cost: 2, icon: 'soldier', meat: true },
  tower2: { at: [2.4, -4.4], cost: 27, tower: [3.4, -5.8], icon: 'tower' },
  fort: { at: SPOTS.fort, cost: 40, icon: 'hammer' },
};

export const ECON = {
  stoneCoins: 3, // akçe per stone
  pileStart: 18,
  pileMax: 24,
  carryMax: 14,
  workers: 4,
  workerTrip: 0.9, // seconds of digging at the quarry
  meatPerBear: 2,
  bossLoot: 40,
  maxSoldiers: 6,
};

export const HERO = { speed: 6.2, dmg: 5, rate: 0.7, range: 2.2, scale: 1.2 };
export const BEAR = { hp: 10, dmg: 2, rate: 1.25, speed: 2.4, aggro: 7, scale: 1.0 };
export const BOSS = { hp: 85, dmg: 5, rate: 1.4, speed: 1.9, scale: 1.75 };
export const SOLDIER = { hp: 16, dmg: 2.2, rate: 0.9, speed: 3.6 };
export const TOWER = { range: 12, dmg: 2.6, rate: 0.85 };

// where bears come from, and the far enemy castle shown at the end
export const BEAR_SPAWNS = [
  [-14, -28],
  [-4, -30],
  [8, -28],
  [-20, -18],
];
export const ENEMY_CASTLE = { x: 0, z: -62 };
