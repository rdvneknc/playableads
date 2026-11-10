export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const AD = {
  // Store link opened by the CTA (end card + Play Now).
  storeUrl: 'https://play.google.com/store/apps/details?id=com.soccerallstars',
  iosStoreUrl: 'https://apps.apple.com/app/id0000000000',
  matchDurationSec: 30,
};

// Landscape pitch: player defends LEFT, attacks RIGHT. Bot is the opposite.
export const PITCH = {
  left: 72,
  right: GAME_WIDTH - 72,
  top: 36,
  bottom: GAME_HEIGHT - 88, // room for controls
  centerRadius: 70,
  get cx() {
    return (this.left + this.right) / 2;
  },
  get midY() {
    return (this.top + this.bottom) / 2;
  },
  get midX() {
    return this.cx;
  },
};

export const GOAL = {
  halfWidth: 70, // half of the mouth height (posts are above/below center)
  depth: 56,
  postRadius: 7,
  netRestitution: 0.05,
  netDamping: 7,
  netFriction: 0.25,
};

export const PHYSICS = {
  stepMs: 1000 / 120,
  maxStepsPerFrame: 10,
  wallRestitution: 0.55,
};

export const ACTOR = {
  size: 72,
  radius: 30,
  speed: 280,
  accel: 2500,
  decel: 2600,
  turnRate: 11,
  dribbleTurnRate: 3.2,
  dribbleSpeedFactor: 0.94,
  knockbackDamping: 4.2,
};

export const BALL = {
  size: 38,
  radius: 16,
  friction: 1.7,
  superFriction: 0.3,
  maxSpeed: 2300,
  stopSpeed: 6,
};

export const DRIBBLE = {
  gap: 3,
  spring: 22,
  loseDistance: 46,
  protectMs: 420,
  pickupSpeed: 820,
  touchSlack: 4,
};

export const SHOT = {
  speed: 1350,
  superSpeed: 1950,
  reach: 30,
  shooterLockMs: 260,
  shootCooldownMs: 300,
  superCooldownMs: 8000, // also used as bot boost cooldown
  superMaxMs: 1400,
  superEndSpeed: 520,
  superKnockback: 620,
  superStunMs: 420,
};

export const SHOULDER = {
  range: 200,
  chargeSpeed: 560,
  chargeMs: 480,
  contactSlack: 6,
  force: 1050,
  stunMs: 560,
  cooldownMs: 8000,
  ballPop: 700,
};

export const MATCH = {
  goalResetMs: 2500,
  kickoffMs: 900,
};

export const BOT = {
  reactionMs: 220,
  shootDistance: 360,
  pressDistance: 160,
  aimError: 0.14,
  shoulderChance: 0.35,
  boostChaseDist: 220,
  boostAttackDist: 380,
};

// Bot sustained speed buff (uses the shared "super" cooldown slot)
export const BOOST = {
  durationMs: 4000,
  speedMult: 2,
  cooldownMs: 8000,
};

// Player short forward burst (same cooldown slot)
export const DASH = {
  speed: 980,
  durationMs: 210,
  cooldownMs: 8000,
};

export const COLORS = {
  line: 0xffffff,
  playerRing: 0xb8ff4a,
  botRing: 0xff6b6b,
  goalBlue: 0x3da9ff,
  goalBlueDeep: 0x1e7fd0,
  goalBlueHi: 0xb7e9ff,
  goalRed: 0xff5a3d,
  goalRedDeep: 0xd32f2f,
  goalRedHi: 0xffb39a,
};

export const FONT = 'Arial Black, Arial, sans-serif';
