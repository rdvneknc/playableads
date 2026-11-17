// Ottoman Wars — Ad 4 "Son Kazan": feed the hungry Janissaries, hire a porter,
// light a second cauldron, roll the cannon out and open the mountain pass.
// World: x right (east), z toward the camera (south); the pass is to the north (-Z).

export const AD = {
  // TODO: Ottoman Wars store links
  storeUrl: 'https://play.google.com/store/apps/details?id=com.example.ottomanwars',
  iosStoreUrl: 'https://apps.apple.com/app/id0000000000',
};

export const TEXT = {
  title: 'OTTOMAN WARS',
  drag: 'SÜRÜKLE',
  hungry: 'Kazan boş... karnımız aç!',
  tips: {
    sack: 'Erzak arabasından çuvalları al.',
    kazan: 'Çuvalları kazana at!',
    wait: 'Askerler yemeğini alıyor...',
    pay: 'Akçeleri bırakmak için alana gir.',
    fire: 'Topun başına geç ve ATEŞLE!',
  },
  feed: 'ASKERLERİ DOYUR',
  fed: 'doydu',
  fire: 'ATEŞLE!',
  openPass: 'GEÇİDİ AÇ',
  newSoldiers: 'YENİ ASKERLER!',
  victory: 'GEÇİT AÇILDI!',
  victoryLine: 'Karargahını kur, ordunu büyüt!',
  buildArmy: 'ORDUNU KUR',
  playNow: 'ŞİMDİ OYNA',
  full: 'DOLU',
};

// purchases: card over the plot + quest panel
export const INFO = {
  hamal: { short: 'HAMAL', name: 'HAMAL', desc: 'Erzağı kazana o taşır', quest: 'HAMAL TUT' },
  kazan2: { short: 'KAZAN', name: 'ÇİFT KAZAN', desc: 'İki tas aynı anda dolar', quest: 'ÇİFT KAZAN' },
  cannon: { short: 'TOPÇU', name: 'TOPÇU MEVZİSİ', desc: 'Top mevziye çekilir', quest: 'TOPÇU MEVZİSİ' },
};

export const FONT_TITLE = 'OWTitle, Georgia, "Times New Roman", serif';
export const FONT_UI = 'OWUi, "Arial Black", Arial, sans-serif';

// economy: 1 sack → 1 ration, 1 ration → 2 akçe
export const ECON = {
  akcePerRation: 2,
  waves: [3, 4, 6], // hungry soldiers: at the start, after the porter, after the second cauldron
};

export const PLAYER = {
  speed: 6.4,
  stackMax: 3,
  pickEvery: 0.16,
  dropEvery: 0.26,
  payEvery: 0.075,
  reach: 2.1,
};

export const HAMAL = { speed: 4.6, carry: 2, pickEvery: 0.3, dropEvery: 0.3 };

export const KITCHEN = {
  cook: 0.62, // s per ration per cauldron
  pileMax: 6, // sacks spilled next to the cart
  pileEvery: 0.45, // s per sack tumbling out of the cart
  eat: 0.9,
};

export const MAP = {
  start: [0.7, 2.3],
  pile: [-1.6, 3.9], // sacks by the overturned cart
  cart: [-3.7, 5.1],
  kazans: [
    [-0.6, -0.5],
    [2.7, -0.5],
  ],
  counter: [1.0, -3.0], // the serving table (long along X)
  seats: [
    [-0.3, -4.45],
    [1.0, -4.45],
    [2.3, -4.45],
  ],
  line: [3.9, -5.0], // waiting line starts here and runs north-east
  lineStep: [0.8, -0.45],
  arrive: [9, 10],
  hamalTent: [-7.8, -1.8],
  banner: [-4.4, -9.8],
  covered: [6.4, -7.4], // cannon under a tarp
  mevzi: [4.4, -15.2],
  ranks: -12.6, // first rank under the banner
  front: -22.5, // first rank in front of the pass
  pass: -31, // the palisade across the pass
  tower: [0, -36],
  cliffGap: 7,
};

export const PADS = [
  { id: 'hamal', kind: 'hamal', x: -5.3, z: 0.6, need: { gold: 6 } },
  { id: 'kazan2', kind: 'kazan2', x: MAP.kazans[1][0], z: MAP.kazans[1][1] + 0.1, need: { gold: 8 } },
  { id: 'cannon', kind: 'cannon', x: MAP.mevzi[0], z: MAP.mevzi[1], need: { gold: 12 } },
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
};
