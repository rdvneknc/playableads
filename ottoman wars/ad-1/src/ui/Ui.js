import Phaser from 'phaser';
import { FONT, FONT_TITLE, GAME_WIDTH } from '../config.js';

export function goldText(scene, x, y, str, size, { title = true, colors = ['#fff6cf', '#f3c64a', '#a8650f'], stroke = '#2a1405', thick = 0.12 } = {}) {
  const t = scene.add
    .text(x, y, str, {
      fontFamily: title ? FONT_TITLE : FONT,
      fontSize: `${size}px`,
      color: '#f3c64a',
      stroke,
      strokeThickness: Math.max(3, Math.round(size * thick)),
      padding: { x: 10, y: 10 },
      align: 'center',
    })
    .setOrigin(0.5);
  const g = t.context.createLinearGradient(0, 0, 0, t.height);
  g.addColorStop(0.2, colors[0]);
  g.addColorStop(0.55, colors[1]);
  g.addColorStop(0.9, colors[2]);
  t.setFill(g);
  t.setShadow(0, Math.round(size * 0.07), 'rgba(0,0,0,0.6)', 6, true, false);
  return t;
}

export function makeLogo(scene, x, y, scale = 1) {
  const img = scene.add.image(x, y, 'logo');
  img.setScale((460 / img.width) * scale);
  return img;
}

// Button built on the game's own green/gold plate; label drawn in code.
export function makeButton(scene, x, y, label, { w = 420, size = 46, tint = null, onTap } = {}) {
  const c = scene.add.container(x, y);
  const plate = scene.add.image(0, 0, 'buton');
  plate.setScale(w / plate.width);
  if (tint) plate.setTint(tint);
  const h = plate.displayHeight;
  const t = scene.add
    .text(0, -2, label, { fontFamily: FONT, fontSize: `${size}px`, color: '#fff3cf', stroke: '#1e2a12', strokeThickness: 7 })
    .setOrigin(0.5);
  t.setShadow(0, 3, 'rgba(0,0,0,0.45)', 3, true, false);
  c.add([plate, t]);
  c.label = t;
  c.setSize(w * 0.92, h * 0.8).setInteractive({ useHandCursor: true });
  c.enabled = true;
  c.setEnabled = (on) => {
    c.enabled = on;
    plate.setTint(on ? tint ?? 0xffffff : 0x8a8a8a);
    t.setAlpha(on ? 1 : 0.65);
  };
  c.on('pointerdown', (p, lx, ly, e) => {
    e?.stopPropagation();
    scene.tweens.add({ targets: c, scaleX: c.scaleX * 0.93, scaleY: c.scaleY * 0.93, duration: 70, yoyo: true });
    onTap?.(c.enabled);
  });
  return c;
}

// Ribbon banner with text (round / turn announcements).
export function banner(scene, y, text, { color = 0xb3121f, depth = 4000, hold = 900 } = {}) {
  const c = scene.add.container(GAME_WIDTH / 2, y).setDepth(depth);
  const w = 520;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35);
  g.fillRect(-w / 2 + 6, -38 + 8, w, 76);
  g.fillStyle(Phaser.Display.Color.IntegerToColor(color).darken(25).color, 1);
  g.fillTriangle(-w / 2 - 50, 0, -w / 2 + 10, -38, -w / 2 + 10, 38);
  g.fillTriangle(w / 2 + 50, 0, w / 2 - 10, -38, w / 2 - 10, 38);
  g.fillStyle(color, 1);
  g.fillRect(-w / 2, -38, w, 76);
  g.lineStyle(4, 0xf0c75a, 1);
  g.lineBetween(-w / 2, -32, w / 2, -32);
  g.lineBetween(-w / 2, 32, w / 2, 32);
  const t = goldText(scene, 0, -2, text, 44, { colors: ['#ffffff', '#ffe9a8', '#f3c64a'] });
  c.add([g, t]);
  c.setScale(0.2, 0.2).setAlpha(0);
  scene.tweens.add({ targets: c, scaleX: 1, scaleY: 1, alpha: 1, duration: 260, ease: 'Back.Out' });
  return new Promise((resolve) => {
    scene.time.delayedCall(260 + hold, () => {
      scene.tweens.add({ targets: c, alpha: 0, scaleY: 0.2, duration: 200, onComplete: () => (c.destroy(), resolve()) });
    });
  });
}
