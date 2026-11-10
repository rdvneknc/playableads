import Phaser from 'phaser';
import { FONT, FONT_TITLE } from '../config.js';

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

function crescent(g, x, y, r, color) {
  g.fillStyle(color, 1);
  g.fillCircle(x, y, r);
  g.fillStyle(0x000000, 1);
}

export function makeLogo(scene, x, y, scale = 1) {
  const c = scene.add.container(x, y);
  // emblem: crescent + star on a red shield
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35);
  g.fillCircle(3, -96, 46);
  g.fillStyle(0xb3121f, 1);
  g.fillCircle(0, -100, 46);
  g.lineStyle(5, 0xe9b949, 1);
  g.strokeCircle(0, -100, 46);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(-6, -100, 26);
  g.fillStyle(0xb3121f, 1);
  g.fillCircle(2, -100, 21);
  // star
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 4.5 : 11;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    pts.push({ x: 20 + Math.cos(a) * r, y: -100 + Math.sin(a) * r });
  }
  g.fillStyle(0xffffff, 1);
  g.fillPoints(pts, true);
  // ornamental lines
  g.lineStyle(3, 0xe9b949, 0.9);
  g.lineBetween(-200, 56, -60, 56);
  g.lineBetween(60, 56, 200, 56);
  g.fillStyle(0xe9b949, 1);
  g.fillTriangle(-56, 56, -66, 50, -66, 62);
  g.fillTriangle(56, 56, 66, 50, 66, 62);
  const top = goldText(scene, 0, -18, 'OTTOMAN', 84);
  const bottom = goldText(scene, 0, 56, 'WARS', 50, { colors: ['#ffffff', '#ffd0c4', '#d23a2a'], stroke: '#2a0606' });
  c.add([g, top, bottom]);
  c.setScale(scale);
  void crescent;
  return c;
}

// Ornate button: colour body, gold frame, label.
export function makeButton(scene, x, y, label, { w = 400, h = 110, color = 0x2f9a45, dark = 0x17582a, size = 48, onTap } = {}) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const draw = (body, bodyDark) => {
    g.clear();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-w / 2 + 4, -h / 2 + 10, w, h, 22);
    g.fillStyle(0x8a5a12, 1);
    g.fillRoundedRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 26);
    g.fillStyle(0xf0c75a, 1);
    g.fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 24);
    g.fillStyle(bodyDark, 1);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 20);
    g.fillStyle(body, 1);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 14, 20);
    g.fillStyle(0xffffff, 0.22);
    g.fillRoundedRect(-w / 2 + 16, -h / 2 + 9, w - 32, h * 0.3, 12);
  };
  draw(color, dark);
  const t = scene.add
    .text(0, -4, label, { fontFamily: FONT, fontSize: `${size}px`, color: '#ffffff', stroke: Phaser.Display.Color.IntegerToColor(dark).rgba, strokeThickness: 8 })
    .setOrigin(0.5);
  t.setShadow(0, 3, 'rgba(0,0,0,0.35)', 2, true, false);
  c.add([g, t]);
  c.label = t;
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.enabled = true;
  c.setEnabled = (on) => {
    c.enabled = on;
    draw(on ? color : 0x6f6a60, on ? dark : 0x45413a);
    t.setAlpha(on ? 1 : 0.7);
  };
  c.on('pointerdown', (p, lx, ly, e) => {
    e?.stopPropagation();
    scene.tweens.add({ targets: c, scaleX: 0.93, scaleY: 0.93, duration: 70, yoyo: true });
    onTap?.(c.enabled);
  });
  return c;
}

// Ribbon banner with text (round / turn announcements).
export function banner(scene, y, text, { color = 0xb3121f, depth = 4000, hold = 900 } = {}) {
  const c = scene.add.container(360, y).setDepth(depth);
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
