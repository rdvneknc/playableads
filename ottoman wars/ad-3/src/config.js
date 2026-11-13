// Ottoman Wars — Ad 3: idle-arcade camp builder → desert siege defence.
// World: x right, z toward the camera; the enemy comes from -Z (north).

export const AD = {
  // TODO: Ottoman Wars store links
  storeUrl: 'https://play.google.com/store/apps/details?id=com.example.ottomanwars',
  iosStoreUrl: 'https://apps.apple.com/app/id0000000000',
  attackAtMs: 52000, // the raid comes anyway if the player dawdles
};

export const TEXT = {
  title: 'OTTOMAN WARS',
  subtitle: 'BUILD YOUR FORTRESS, PASHA!',
  drag: 'DRAG TO MOVE',
  tips: {
    stone: 'Pasha! Collect stones from the quarry.',
    wall: 'Build the walls before the enemy comes!',
    gold: 'Collect akçe from the treasury.',
    hire: 'Hire a worker to carry stones for you.',
    wall2: 'Finish the walls!',
    catapult: 'A catapult will crush their army!',
    tower: 'Archers! Build the tower!',
    ready: 'Our fortress is ready. Let them come!',
  },
  incoming: 'ENEMIES INCOMING!',
  defend: 'DEFEND!',
  victory: 'VICTORY!',
  victoryLine: 'The fortress stands. Your empire awaits!',
  defeat: 'DEFEAT',
  defeatLine: 'Build stronger defences and try again!',
  playNow: 'PLAY NOW',
  retry: 'TRY AGAIN',
  pads: { wall: 'WALL', hire: 'WORKER', catapult: 'CATAPULT', tower: 'ARCHERS' },
  full: 'MAX',
};

export const FONT_TITLE = 'OWTitle, Georgia, "Times New Roman", serif';
export const FONT_UI = 'OWUi, "Arial Black", Arial, sans-serif';

export const PLAYER = {
  speed: 7.2,
  stackMax: 14,
  pickEvery: 0.055, // s per item picked up
  dropEvery: 0.045, // s per item delivered
  reach: 2.2, // pickup / pad radius
};

export const WORKER = { speed: 5.2, carry: 6 };

export const PRODUCE = {
  stoneEvery: 0.3, // s per stone at the quarry pile (two diggers)
  goldEvery: 0.28,
  pileMax: 26,
};

// Camp layout (world units)
export const MAP = {
  start: [0, 7],
  quarry: { x: -10, z: 9, pile: [-7, 8.5] },
  treasury: { x: 10, z: 9, pile: [7, 8.5] },
  sage: [2.5, 4.5],
  wallZ: -4.5,
  gate: 0, // gate in the middle of the wall line
  enemyFrom: -50,
};

// Build pads, in tutorial order. need: { stone } or { gold }
export const PADS = [
  { id: 'wallL', kind: 'wall', x: -6.5, z: -1.6, need: { stone: 12 }, tip: 'wall' },
  { id: 'hire', kind: 'hire', x: 0, z: 11.5, need: { gold: 12 }, tip: 'hire', after: 'wallL' },
  { id: 'wallR', kind: 'wall', x: 6.5, z: -1.6, need: { stone: 14 }, tip: 'wall2', after: 'hire' },
  { id: 'catapult', kind: 'catapult', x: -5.5, z: 3.2, need: { stone: 18 }, tip: 'catapult', after: 'wallR' },
  { id: 'tower', kind: 'tower', x: 5.5, z: 3.2, need: { gold: 16 }, tip: 'tower', after: 'catapult' },
];

export const RAID = {
  count: 54,
  speed: 3.6,
  wallHp: 100,
  hitDps: 1.4, // per enemy touching the wall
  catapultEvery: 1.5,
  catapultRadius: 2.7,
  arrowEvery: 0.42,
};

export const COLORS = {
  sand: 0xead2a2,
  sandDark: 0xdcbd88,
  sandLight: 0xf4e4c0,
  rock: 0xb07a4c,
  rockDark: 0x8a5a36,
  // pasha
  pashaRobe: 0xf2e2b8,
  pashaGold: 0xd9a63a,
  pashaSleeve: 0x2f7a3e,
  sash: 0xc0242c,
  turban: 0xf4f1ea,
  skin: 0xe2ad84,
  beard: 0xe9e6df,
  boot: 0x5a2e16,
  // workers
  workTunic: 0x5f8a4e,
  workPants: 0x7a6040,
  workCap: 0x9c9384,
  wrap: 0x8fb08a,
  // crew
  crewCoat: 0x2f8f8f,
  // sage
  sageCloak: 0x9a6a2e,
  sageRobe: 0x2f9a4a,
  // enemy
  enemyCoat: 0x2f6fd6,
  enemyDark: 0x1c3f86,
  enemyHelm: 0xaeb8c4,
  steel: 0xc9d1da,
  gold: 0xe8b33a,
  wood: 0x8a5a30,
  woodDark: 0x5d3a1e,
  stone: 0xe6cfa0,
  coin: 0xffcf3a,
  red: 0xc8202a,
};
