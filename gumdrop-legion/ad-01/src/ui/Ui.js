import Phaser from 'phaser';
import { FONT } from '../config.js';

// Shared UI helpers: gradient candy text, logo, glossy buttons.

export function candyText(scene, x, y, str, size, { colors = ['#ffffff', '#ffe36b', '#ff9a1f'], stroke = '#5a1d7a', thick = 0.16, shadow = true } = {}) {
  const t = scene.add
    .text(x, y, str, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color: '#ffffff',
      stroke,
      strokeThickness: Math.round(size * thick),
      padding: { x: 10, y: 10 },
      align: 'center',
    })
    .setOrigin(0.5);
  const g = t.context.createLinearGradient(0, 0, 0, t.height);
  g.addColorStop(0.18, colors[0]);
  g.addColorStop(0.55, colors[1]);
  g.addColorStop(0.9, colors[2]);
  t.setFill(g);
  if (shadow) t.setShadow(0, Math.round(size * 0.08), 'rgba(60,10,90,0.45)', 0, true, false);
  return t;
}

export function makeLogo(scene, x, y, scale = 1) {
  const c = scene.add.container(x, y);
  // ribbon behind LEGION
  const rib = scene.add.graphics();
  const rw = 330;
  rib.fillStyle(0x2a6fd6, 1);
  rib.fillTriangle(-rw / 2 - 40, 52, -rw / 2 + 10, 28, -rw / 2 + 10, 100);
  rib.fillTriangle(rw / 2 + 40, 52, rw / 2 - 10, 28, rw / 2 - 10, 100);
  rib.fillStyle(0x3d9bff, 1);
  rib.fillRoundedRect(-rw / 2, 30, rw, 64, 14);
  rib.fillStyle(0xffffff, 0.25);
  rib.fillRoundedRect(-rw / 2 + 10, 36, rw - 20, 18, 9);
  rib.lineStyle(5, 0xffffff, 1);
  rib.strokeRoundedRect(-rw / 2, 30, rw, 64, 14);

  const top = candyText(scene, 0, -30, 'GUMDROP', 96, { colors: ['#ffffff', '#ff8cc6', '#ff3d8b'], stroke: '#6b1458', thick: 0.15 });
  const bottom = candyText(scene, 0, 62, 'LEGION', 52, { colors: ['#ffffff', '#fff1a8', '#ffc94d'], stroke: '#123d8a', thick: 0.18 });
  bottom.setLetterSpacing?.(6);
  const drop = scene.add.image(top.width / 2 - 26, -84, 'p-face').setScale(0.36).setAngle(14);
  c.add([rib, top, bottom, drop]);
  c.setScale(scale);
  scene.tweens.add({ targets: drop, angle: -6, y: -92, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  return c;
}

// Glossy pill button. Returns a container with .setEnabled / pulse helpers.
export function makeButton(scene, x, y, label, { w = 400, h = 104, color = 0x35d07f, dark = 0x17924f, size = 50, onTap } = {}) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.25);
  g.fillRoundedRect(-w / 2 + 4, -h / 2 + 12, w, h, h / 2);
  g.fillStyle(dark, 1);
  g.fillRoundedRect(-w / 2, -h / 2 + 8, w, h, h / 2);
  g.fillStyle(color, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  g.fillStyle(0xffffff, 0.3);
  g.fillRoundedRect(-w / 2 + 18, -h / 2 + 8, w - 36, h * 0.36, h * 0.18);
  g.lineStyle(5, 0xffffff, 0.95);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  const t = candyText(scene, 0, -2, label, size, { colors: ['#ffffff', '#ffffff', '#e8fff0'], stroke: Phaser.Display.Color.IntegerToColor(dark).rgba, thick: 0.14, shadow: false });
  c.add([g, t]);
  c.setSize(w, h + 10).setInteractive({ useHandCursor: true });
  c.on('pointerdown', (p, lx, ly, e) => {
    e?.stopPropagation();
    scene.tweens.add({ targets: c, scale: c.scale * 0.92, duration: 70, yoyo: true });
    onTap?.();
  });

  // light sweep, clipped to the pill (mask lives in world space at the button's position)
  const shine = scene.add.rectangle(0, y, 46, h * 1.8, 0xffffff, 0.32).setAngle(20).setDepth(0);
  const maskG = scene.make.graphics({ add: false });
  maskG.fillStyle(0xffffff);
  maskG.fillRoundedRect(x - w / 2, y - h / 2, w, h, h / 2);
  shine.setMask(maskG.createGeometryMask());
  shine.setVisible(false);
  c.shine = shine;
  c.sweep = () => {
    shine.setDepth((c.shineDepth ?? c.depth ?? 0) + 1).setVisible(true);
    shine.x = x - w / 2 - 60;
    scene.tweens.add({ targets: shine, x: x + w / 2 + 60, duration: 650, ease: 'Sine.InOut', onComplete: () => shine.setVisible(false) });
  };
  c.once('destroy', () => {
    shine.destroy();
    maskG.destroy();
  });
  return c;
}
