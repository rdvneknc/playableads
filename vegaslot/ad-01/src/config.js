// Portrait playable canvas — typical for slot ads on mobile.
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

// Embedded display face (Inter Display Black, OFL) with safe fallbacks.
export const FONT = 'VSDisplay, "Arial Black", Arial, sans-serif';
export const FONT_UI = 'VSDisplay, Arial, sans-serif';

export const AD = {
  storeUrl: 'https://play.google.com/store/apps/details?id=com.vegaslot',
  // TODO: replace with the real App Store id before shipping.
  iosStoreUrl: 'https://apps.apple.com/app/id0000000000',
  maxSpins: 3,
  idleHintMs: 2600, // show the tap hint after this much inactivity
  idleEndMs: 22000, // no input for this long → show the end card
  disclaimer: 'For entertainment only · No real money gambling · 18+',
};

export const SLOT = {
  reelCount: 3,
  rowsVisible: 3,
  symbolKeys: ['sym-bull', 'sym-fox', 'sym-lion', 'sym-panda', 'sym-tiger', 'sym-wolf'],
  wildKey: 'sym-lion',
  symbolSize: 150,
  reelSpeed: 3000, // px/s at full speed
  reelStaggerMs: 110,
  autoStopMs: [1700, 2150], // auto stop time per reel (from spin start); the last reel follows the others
  lastReelGapMs: 380, // last reel stops this long after the others land (no tease)
  anticipationMs: 1500, // extra spin on the last reel when two match
  minSpinMs: 380, // a tap can't stop a reel earlier than this
  windowW: 520,
  windowH: 470,
};

export const PAYOUT = {
  lineMult: 5, // 3 of a kind
  jackpotMult: 40, // 3 wilds
};

export const COLORS = {
  bg: 0x0a0614,
  bgDeep: 0x0a0418,
  bgMid: 0x24103f,
  panel: 0x1c0c36,
  panelHi: 0x3a1a66,
  gold: 0xffd56a,
  goldDeep: 0xc4922a,
  magenta: 0xff2d9b,
  cyan: 0x4df0ff,
  win: 0xffe566,
  green: 0x2fd35f,
};
