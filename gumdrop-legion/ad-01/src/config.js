export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

export const FONT = 'VSDisplay, "Arial Black", Arial, sans-serif';

export const AD = {
  // Sample game — point these at the real store pages when it ships.
  storeUrl: 'https://play.google.com/store/apps/details?id=com.example.gumdroplegion',
  iosStoreUrl: 'https://apps.apple.com/app/id0000000000',
  idleHintMs: 2500,
  idleEndMs: 25000,
};

// Pseudo-3D camera. World x: -1..1 is the road; z: distance ahead of the camera.
export const CAM = {
  horizonY: 360,
  heightF: 6400, // screenY = horizon + heightF / z
  widthF: 3000, // screenX = centre + x * widthF / z
  nearZ: 7.2,
  farZ: 150,
  crowdZ: 10.5, // where the player's crowd stands (relative to camera)
};

export const RUN = {
  speed: 10, // world units per second
  roadHalf: 1,
  startCount: 8,
  maxSprites: 140, // more units than this are counted but not drawn individually
};

// Level layout (z = distance from the start line). Scripted for a ~25 s ad.
export const LEVEL = {
  gates: [
    { z: 34, left: { op: '+', v: 10 }, right: { op: 'x', v: 2 } },
    { z: 70, left: { op: '-', v: 6 }, right: { op: 'x', v: 3 } },
    { z: 132, left: { op: 'x', v: 2 }, right: { op: '+', v: 25 } },
  ],
  enemies: [{ z: 100, count: 18 }],
  bossZ: 172,
  bossHp: 45,
  length: 176,
};

export const COLORS = {
  skyTop: 0x6fc8ff,
  skyBottom: 0xffd3ec,
  grassA: 0x8fe8c1,
  grassB: 0x7fdcb3,
  roadA: 0xfff1f7,
  roadB: 0xffe1ee,
  curbA: 0xff4f7b,
  curbB: 0xffffff,
  player: 0x3d9bff,
  enemy: 0x9be22e,
  gold: 0xffd34d,
  pink: 0xff5fa2,
  good: 0x2fb4ff,
  bad: 0xff4d6d,
};
