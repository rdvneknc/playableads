// Ottoman Wars — Ad 3: idle-arcade camp builder → desert siege defence.
// World: x right, z toward the camera; the enemy comes from -Z (north).

export const AD = {
  // TODO: Ottoman Wars store links
  storeUrl: 'https://play.google.com/store/apps/details?id=com.example.ottomanwars',
  iosStoreUrl: 'https://apps.apple.com/app/id0000000000',
  attackAt: 150, // s of play: the main army arrives no matter what
};

export const TEXT = {
  title: 'OTTOMAN WARS',
  subtitle: 'BUILD YOUR FORTRESS, PASHA!',
  drag: 'DRAG TO MOVE',
  tips: {
    stone: 'Pasha! Collect stones from the quarry.',
    wood: 'Gather wood from the palm grove.',
    gold: 'Sell stone and wood at the market for akçe!',
    coins: 'Pick up your akçe at the market!',
    wallL: 'Build the walls before the enemy comes!',
    market: 'A market! Sell stone and wood for akçe.',
    hire1: 'Hire a worker, he will carry stones for you.',
    wallR: 'Close the walls on the right!',
    archersL: 'Put archers on the walls!',
    catapult1: 'A catapult will crush their ranks!',
    archersR: 'More archers for the right wall!',
    quarryUp: 'Upgrade the quarry: more diggers!',
    hire2: 'Hire a carrier for the palm grove!',
    wallUp: 'Make the walls taller and stronger!',
    catapult2: 'Build a second catapult!',
    battle: 'We are ready! Step on the banner to start the battle.',
    scouts: 'Scouts! Our archers will handle them.',
  },
  incoming: 'ENEMIES INCOMING!',
  scouts: 'ENEMY SCOUTS!',
  enemyIn: 'ENEMY ARMY',
  victory: 'VICTORY!',
  victoryLine: 'The fortress stands. Your empire awaits!',
  defeat: 'DEFEAT',
  defeatLine: 'Build stronger defences and try again!',
  playNow: 'PLAY NOW',
  retry: 'TRY AGAIN',
  sell: 'SELL',
  full: 'MAX',
  pads: {
    wall: 'WALL',
    market: 'MARKET',
    hire: 'WORKER',
    archers: 'ARCHERS',
    catapult: 'CATAPULT',
    quarryUp: 'QUARRY +',
    wallUp: 'WALLS LV2',
    battle: 'BATTLE!',
  },
};

export const FONT_TITLE = 'OWTitle, Georgia, "Times New Roman", serif';
export const FONT_UI = 'OWUi, "Arial Black", Arial, sans-serif';

export const PLAYER = {
  speed: 6.6,
  stackMax: 12,
  pickEvery: 0.11, // s per item picked up
  dropEvery: 0.08, // s per item delivered
  reach: 2.0,
};

export const WORKER = { speed: 4.6, carry: 6 };

export const PRODUCE = {
  stoneEvery: 1.25, // s per stone per digger
  woodEvery: 1.4, // s per log per cutter
  pileMax: 14,
  sellEvery: 0.16, // market turns one item into coins
  coinsPerItem: 2,
  coinPileMax: 60,
};

export const MAP = {
  start: [0, 7],
  quarry: { x: -12.5, z: 6.5, pile: [-9.2, 6] },
  grove: { x: 12.5, z: 7, pile: [9.2, 6] },
  market: { x: 0, z: 14.2, sell: [-1.7, 10.9], coins: [2.4, 10.9] },
  sage: [-3, 3],
  wallZ: -6,
  enemyFrom: -52,
};

/*
 * Build / upgrade pads. `after` = all listed ids must be built first.
 * need: one of stone / wood / gold.
 */
export const PADS = [
  { id: 'wallL', kind: 'wall', x: -8, z: -3.4, need: { stone: 14 } },
  { id: 'market', kind: 'market', x: 0, z: 10.9, need: { wood: 10 }, after: ['wallL'] },
  { id: 'hire1', kind: 'hire', x: -5.5, z: 9.6, need: { gold: 16 }, after: ['market'] },
  { id: 'wallR', kind: 'wall', x: 8, z: -3.4, need: { stone: 18 }, after: ['hire1'] },
  { id: 'archersL', kind: 'archers', x: -12, z: -3, need: { gold: 22 }, after: ['wallR'] },
  { id: 'catapult1', kind: 'catapult', x: -4.5, z: 0.8, need: { wood: 16 }, after: ['wallR'] },
  { id: 'quarryUp', kind: 'quarryUp', x: -13, z: 1.8, need: { gold: 18 }, after: ['archersL'] },
  { id: 'archersR', kind: 'archers', x: 12, z: -3, need: { gold: 24 }, after: ['archersL', 'catapult1'] },
  { id: 'hire2', kind: 'hire', x: 5.5, z: 9.6, need: { gold: 20 }, after: ['catapult1'] },
  { id: 'wallUp', kind: 'wallUp', x: 0, z: -2.8, need: { stone: 26 }, after: ['archersR'] },
  { id: 'catapult2', kind: 'catapult', x: 4.5, z: 0.8, need: { wood: 20 }, after: ['hire2', 'archersR'] },
];

// the battle banner appears once these stand
export const BATTLE_READY = ['wallL', 'wallR', 'archersL', 'catapult1'];
export const BATTLE_PAD = { x: 0, z: 4.6 };

export const RAID = {
  scouts: 9, // small raid right after the first archers
  count: 90,
  speed: 3.8,
  enemyHp: 2, // arrows deal 1, boulders crush
  wallHp: 120,
  wallHpUp: 220,
  hitDps: 0.8,
  catapultEvery: 2.2,
  catapultRadius: 2.4,
  arrowEvery: 0.95, // per archer
};

export const COLORS = {
  sand: 0xead2a2,
  sandDark: 0xdcbd88,
  sandLight: 0xf4e4c0,
  rock: 0xb07a4c,
  rockDark: 0x8a5a36,
  pashaRobe: 0xf2e2b8,
  pashaGold: 0xd9a63a,
  pashaSleeve: 0x2f7a3e,
  sash: 0xc0242c,
  turban: 0xf4f1ea,
  skin: 0xe2ad84,
  beard: 0xe9e6df,
  boot: 0x5a2e16,
  workTunic: 0x5f8a4e,
  workPants: 0x7a6040,
  workCap: 0x9c9384,
  wrap: 0x8fb08a,
  crewCoat: 0x2f8f8f,
  sageCloak: 0x9a6a2e,
  sageRobe: 0x2f9a4a,
  enemyCoat: 0x2f6fd6,
  enemyDark: 0x1c3f86,
  enemyHelm: 0xaeb8c4,
  steel: 0xc9d1da,
  gold: 0xe8b33a,
  wood: 0x8a5a30,
  woodDark: 0x5d3a1e,
  log: 0xa0703a,
  stone: 0xe6cfa0,
  coin: 0xffcf3a,
  red: 0xc8202a,
};
