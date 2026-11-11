import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { IntroScene } from './scenes/IntroScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';

// Both orientations: the logical size follows the screen (1280×720 landscape,
// 720×1280 portrait). Scenes listen for 'orientation' and re-lay themselves out.
const isPortrait = () => window.innerHeight > window.innerWidth;
// Portrait is 720 wide and grows taller on long phones (up to 1560) so it fills the screen.
const sizeFor = (portrait) => {
  if (!portrait) return [GAME_WIDTH, GAME_HEIGHT];
  const aspect = window.innerHeight / Math.max(1, window.innerWidth);
  return [GAME_HEIGHT, Math.round(Math.min(1560, Math.max(GAME_WIDTH, GAME_HEIGHT * aspect)))];
};
let portrait = isPortrait();
const [startW, startH] = sizeFor(portrait);

const game = new Phaser.Game({
  // ?canvas forces the Canvas renderer (handy for headless testing)
  type: /[?&]canvas\b/.test(location.search) ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#4db352',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: startW,
    height: startH,
    parent: 'game-container',
    expandParent: true,
    resizeInterval: 250,
  },
  input: { activePointers: 4 },
  render: { antialias: true, roundPixels: false },
  fps: { smoothStep: true },
  scene: [PreloadScene, IntroScene, GameScene, UIScene],
});

function checkOrientation() {
  const now = isPortrait();
  if (now === portrait) {
    // same orientation, different phone shape (e.g. browser bars) — keep the portrait height in step
    const [w, h] = sizeFor(portrait);
    if (portrait && Math.abs(h - game.scale.height) > 40) {
      game.scale.setGameSize(w, h);
      game.events.emit('orientation', portrait);
    }
    return;
  }
  portrait = now;
  const [w, h] = sizeFor(portrait);
  game.scale.setGameSize(w, h);
  game.events.emit('orientation', portrait);
}

function refreshScale() {
  // iOS/Android need a beat after orientationchange before sizes settle
  checkOrientation();
  requestAnimationFrame(() => {
    checkOrientation();
    game.scale.refresh();
    setTimeout(() => {
      checkOrientation();
      game.scale.refresh();
    }, 120);
    setTimeout(() => {
      checkOrientation();
      game.scale.refresh();
    }, 400);
  });
}

// MRAID (AppLovin, ironSource, Unity…): without this many SDKs lock the ad to the
// orientation it opened in, so turning the phone does nothing.
function setupMraid() {
  const m = window.mraid;
  if (!m) return;
  const apply = () => {
    try {
      m.setOrientationProperties?.({ allowOrientationChange: true, forceOrientation: 'none' });
    } catch {
      /* older SDKs */
    }
    refreshScale();
  };
  if (m.getState?.() === 'loading') m.addEventListener('ready', apply);
  else apply();
  m.addEventListener?.('sizeChange', refreshScale);
  m.addEventListener?.('viewableChange', (viewable) => {
    if (viewable) game.resume();
    else game.pause();
  });
}
setupMraid();

window.addEventListener('orientationchange', refreshScale);
window.addEventListener('resize', refreshScale);
window.visualViewport?.addEventListener('resize', refreshScale);
window.visualViewport?.addEventListener('scroll', refreshScale);

if (import.meta.env.DEV) window.__game = game;
