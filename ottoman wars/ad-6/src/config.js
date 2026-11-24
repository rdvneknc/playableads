// Ottoman Wars — Ad 6 "Kuşatma": a raid on a walled enemy town, the way the real game plays it.
// Pick a unit card, tap the open ground to send troops in, break the walls with the cannon,
// raze the town, then call the Paşa for the last push. Three crescents = victory.
// World: x right (east), z toward the camera (south); the town lies to the north (-Z).

export const AD = {
  // TODO: Ottoman Wars store links
  storeUrl: 'https://play.google.com/store/apps/details?id=com.example.ottomanwars',
  iosStoreUrl: 'https://apps.apple.com/app/id0000000000',
};

export const TEXT = {
  start: 'SAVAŞ BAŞLADI!',
  goal: 'Kaleyi fethet, 3 hilali topla!',
  tapHere: 'Askerleri indirmek için dokun',
  needCannon: 'Surları TOP ile yık!',
  callPasha: 'PAŞA’YI ÇAĞIR!',
  ability: 'ALLAH ALLAH!',
  palaceDown: 'SARAY DÜŞTÜ!',
  victory: 'ZAFER!',
  defeat: 'ORDUN TÜKENDİ',
  loot: 'Ganimet',
  destroyed: 'Yıkım',
  retreat: 'Geri Çekil',
  playNow: 'HEMEN OYNA',
  endWin: 'Kale senin, Paşam!',
  endWinSub: 'Daha büyük kaleler seni bekliyor.',
  endLose: 'Ordunu güçlendir!',
  endLoseSub: 'Yeniçerilerini topla ve tekrar saldır.',
  enemy: 'Bizans Karakolu',
  player: 'Osmanlı',
};

// building kit scale: one wall piece is 2 m in the model → 3.6 m in the game
export const BS = 1.8;
export const PITCH = 5 * BS; // corner tower to corner tower

// the fortress grid (corner towers sit on every grid point)
export const GRID = { x0: -13.5, z0: -22.5, cols: 3, rows: 2 };

// buildings: type, x, z, (yaw). Loot is in akçe.
export const BUILDINGS = [
  // back row
  { type: 'house', x: -11.2, z: -20.2 },
  { type: 'house', x: -6.8, z: -15.6, ry: -0.3 },
  { type: 'palace', x: 0, z: -18 },
  { type: 'archer', x: 6.8, z: -20.4 },
  { type: 'gold', x: 11.2, z: -15.8 },
  // front row
  { type: 'archer', x: -11.6, z: -11.4 },
  { type: 'house', x: -6.6, z: -7.0, ry: 0.2 },
  { type: 'cannon', x: -1.6, z: -9.0 },
  { type: 'house', x: 2.4, z: -11.6, ry: -0.2 },
  { type: 'gold', x: 7.0, z: -7.4 },
  { type: 'house', x: 11.6, z: -11.0 },
  // outside the walls
  { type: 'windmill', x: -19.5, z: -9.5 },
  { type: 'house', x: -18.6, z: -2.2, ry: 0.5 },
  { type: 'tent', x: 18.2, z: -4.2 },
  { type: 'tent', x: 20.5, z: -10.5 },
  { type: 'house', x: 18.8, z: -16.5, ry: -0.5 },
];

export const BTYPES = {
  house: { hp: 50, r: 1.5, loot: 18000 },
  gold: { hp: 90, r: 1.5, loot: 60000 },
  palace: { hp: 220, r: 2.3, loot: 120000 },
  archer: { hp: 90, r: 1.0, loot: 12000, def: { range: 10.5, dmg: 1.7, rate: 0.85 } },
  cannon: { hp: 110, r: 1.2, loot: 15000, def: { range: 11, dmg: 5, rate: 2.0, splash: 1.8 } },
  windmill: { hp: 70, r: 1.4, loot: 15000 },
  tent: { hp: 40, r: 1.5, loot: 10000 },
  wall: { hp: 70 },
  corner: { hp: 120 },
};

// attackers (deploy = soldiers per tap, stock = soldiers in the card)
export const UNITS = {
  jan: { hp: 12, dmg: 3.2, rate: 0.8, range: 0.8, speed: 3.6, deploy: 5, stock: 30, wallMul: 1 },
  tuf: { hp: 7, dmg: 4, rate: 1.2, range: 6.5, speed: 3.1, deploy: 3, stock: 12, wallMul: 0.6 },
  top: { hp: 40, dmg: 18, rate: 2.0, range: 8, speed: 2.2, deploy: 1, stock: 2, wallMul: 2.2 },
  pasha: { hp: 140, dmg: 12, rate: 0.7, range: 1.1, speed: 3.8, deploy: 1, stock: 1, wallMul: 2.5, splash: 1.6 },
};

export const DEFENDERS = {
  hp: 12,
  dmg: 1.8,
  rate: 0.9,
  speed: 2.5,
  // front guard outside the walls, palace guard inside its yard
  groups: [
    { x: 0, z: -1.5, n: 4, aggro: 8 },
    { x: 0, z: -14.6, n: 5, aggro: 7 },
  ],
};

export const ABILITY = { radius: 8, dmg: 70, rage: 6, rageMul: 1.7 };

// keep troops out of the walled town and off the map edge
export const DEPLOY = { x0: -15.6, x1: 15.6, z0: -24.6, z1: -2.4, bound: 30 };

export const TIMER = 180;
