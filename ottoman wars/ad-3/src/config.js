// Ottoman Wars — Ad 3: idle-arcade town builder → siege defence.
// World: x right (east), z toward the south; the enemy marches in from the north (-Z).

export const AD = {
  // TODO: Ottoman Wars store links
  storeUrl: 'https://play.google.com/store/apps/details?id=com.example.ottomanwars',
  iosStoreUrl: 'https://apps.apple.com/app/id0000000000',
  attackAt: 170, // s of play: the enemy army arrives no matter what
};

export const TEXT = {
  title: 'OTTOMAN WARS',
  subtitle: 'BUILD YOUR FORTRESS, PASHA!',
  drag: 'DRAG TO MOVE',
  tips: {
    wood: 'Pick up logs at the woodcutter.',
    stone: 'Pick up stone blocks at the quarry.',
    gold: 'Collect the taxes from your houses.',
    house1: 'Build a house. Citizens will pay taxes!',
    towerL: 'Raise a tower on the wall for our archers.',
    house2: 'More houses, more akçe!',
    woodUp: 'Hire a second woodcutter.',
    stoneWalls: 'Replace the wooden palisade with stone walls!',
    cannonL: 'Place a cannon behind the walls.',
    towerR: 'A second tower guards the right side.',
    house3: 'Another house for more taxes.',
    quarryUp: 'Hire a second stonecutter.',
    cannonR: 'A second cannon. Let them come!',
    battle: 'We are ready! Stand on the banner to face the enemy.',
    scouts: 'Enemy scouts! Our archers will greet them.',
  },
  incoming: 'ENEMY ARMY!',
  scouts: 'SCOUTS!',
  enemyIn: 'ENEMY ARMY',
  victory: 'VICTORY!',
  victoryLine: 'The fortress stands. Your empire awaits!',
  defeat: 'DEFEAT',
  defeatLine: 'Build stronger defences and try again!',
  playNow: 'PLAY NOW',
  retry: 'TRY AGAIN',
  full: 'MAX',
  battle: 'BATTLE!',
};

// what each build is — shown on a card over its plot
export const INFO = {
  house: { short: 'HOUSE', name: 'HOUSE', desc: 'Citizens pay akçe taxes' },
  tower: { short: 'TOWER', name: 'WATCHTOWER', desc: 'Two archers shoot from the wall' },
  stoneWalls: { short: 'WALLS', name: 'STONE WALLS', desc: 'Much stronger than wood' },
  cannon: { short: 'CANNON', name: 'CANNON', desc: 'Blasts enemy ranks apart' },
  woodUp: { short: '+WORKER', name: 'WOODCUTTER', desc: '+1 worker, twice the logs' },
  quarryUp: { short: '+WORKER', name: 'STONECUTTER', desc: '+1 worker, twice the stone' },
};

export const FONT_TITLE = 'OWTitle, Georgia, "Times New Roman", serif';
export const FONT_UI = 'OWUi, "Arial Black", Arial, sans-serif';

export const PLAYER = {
  speed: 6.4,
  stackMax: 10,
  pickEvery: 0.16,
  dropEvery: 0.11,
  reach: 2.1,
};

export const PRODUCE = {
  woodEvery: 2.6, // s per log per woodcutter
  stoneEvery: 2.9, // s per block per stonecutter
  pileMax: 10,
  taxEvery: 4.2, // s per tax payment per house
  taxAmount: 2,
  taxMax: 12,
};

export const MAP = {
  half: 15, // the fortress square
  gateHalf: 3.2,
  start: [0, 4.5],
  wood: { hut: [-11.2, 11.2], pile: [-7.6, 11.6], workers: [[-12.6, 8.2], [-9.4, 13.4]] },
  quarry: { rock: [11.4, 11.4], pile: [7.6, 11.6], workers: [[10.0, 8.6], [12.8, 9.0]] },
  hall: [0, -1.5],
  sage: [3.6, 3.4],
  enemyFrom: -62,
  battle: [0, -6.6],
};

/*
 * Plots, in suggested order. `after` = ids that must be finished first.
 * need: stone | wood | gold
 */
export const PADS = [
  { id: 'house1', kind: 'house', x: -7, z: 6, need: { wood: 6 } },
  { id: 'towerL', kind: 'tower', x: -8.5, z: -11.6, at: [-8.5, -15], need: { stone: 8 }, after: ['house1'] },
  { id: 'quarryUp', kind: 'quarryUp', x: 12, z: 4.6, need: { gold: 8 }, after: ['towerL'] },
  { id: 'house2', kind: 'house', x: 0, z: 9.8, need: { wood: 8 }, after: ['towerL'] },
  { id: 'stoneWalls', kind: 'stoneWalls', x: 0, z: -10.6, need: { stone: 16 }, after: ['quarryUp'] },
  { id: 'woodUp', kind: 'woodUp', x: -12, z: 4.6, need: { gold: 10 }, after: ['house2'] },
  { id: 'cannonL', kind: 'cannon', x: -5.5, z: -8.4, need: { gold: 14 }, after: ['stoneWalls'] },
  { id: 'house3', kind: 'house', x: 7, z: 6, need: { wood: 10 }, after: ['woodUp'] },
  { id: 'towerR', kind: 'tower', x: 8.5, z: -11.6, at: [8.5, -15], need: { stone: 12 }, after: ['cannonL'] },
  { id: 'cannonR', kind: 'cannon', x: 5.5, z: -8.4, need: { gold: 18 }, after: ['towerR'] },
];

export const BATTLE_READY = ['towerL', 'stoneWalls', 'cannonL'];

export const RAID = {
  scouts: 8,
  count: 52,
  speed: 3.6,
  enemyHp: 2,
  wallHp: 80,
  wallHpStone: 200,
  hitDps: 0.8,
  cannonEvery: 2.4,
  cannonRadius: 2.6,
  arrowEvery: 1.0,
};

export const COLORS = {
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
  stone: 0xe6dcc6,
  coin: 0xffcf3a,
  red: 0xc8202a,
  rock: 0xd6cbb2,
};
