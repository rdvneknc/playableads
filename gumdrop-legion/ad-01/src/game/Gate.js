import Phaser from 'phaser';
import { FONT, COLORS } from '../config.js';
import { project, depthFor, REF_S } from '../world/World.js';

const PANEL_W = 0.86; // world units
const PANEL_H = 0.5;
const POST_H = 0.72;

export function applyOp(count, { op, v }) {
  if (op === '+') return count + v;
  if (op === '-') return Math.max(0, count - v);
  if (op === 'x') return count * v;
  return count;
}

const good = (o) => o.op !== '-';
const label = (o) => (o.op === 'x' ? `×${o.v}` : `${o.op}${o.v}`);

// One gate half, drawn once at the crowd's reference scale and then scaled as a billboard.
function buildHalf(scene, opt) {
  const c = scene.add.container(0, 0);
  const w = PANEL_W * REF_S;
  const h = PANEL_H * REF_S;
  const ph = POST_H * REF_S;
  const color = good(opt) ? COLORS.good : COLORS.bad;
  const g = scene.add.graphics();

  // translucent panel (bottom edge sits at y = -ph + h)
  const top = -ph;
  g.fillStyle(color, 0.55);
  g.fillRoundedRect(-w / 2, top, w, h, 18);
  g.fillStyle(0xffffff, 0.22);
  g.fillRoundedRect(-w / 2 + 10, top + 8, w - 20, h * 0.28, 12);
  g.lineStyle(6, 0xffffff, 0.95);
  g.strokeRoundedRect(-w / 2, top, w, h, 18);

  // candy posts
  const postW = 16;
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(x - postW / 2, top - 12, postW, ph + 12, 8);
    g.fillStyle(good(opt) ? 0x1f7fd1 : 0xd12a4a, 1);
    for (let y = top - 6; y < 0; y += 26) g.fillRect(x - postW / 2, y, postW, 11);
    g.fillStyle(COLORS.gold, 1);
    g.fillCircle(x, top - 14, 12);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(x - 4, top - 18, 4);
  }

  const t = scene.add
    .text(0, top + h / 2, label(opt), {
      fontFamily: FONT,
      fontSize: '84px',
      color: '#ffffff',
      stroke: good(opt) ? '#0b4f93' : '#8a1430',
      strokeThickness: 12,
    })
    .setOrigin(0.5);
  t.setShadow(0, 5, 'rgba(0,0,0,0.3)', 4, true, false);
  c.add([g, t]);
  c.panel = g;
  return c;
}

export class GatePair {
  constructor(scene, def) {
    this.scene = scene;
    this.z = def.z;
    this.defs = { left: def.left, right: def.right };
    this.used = false;
    this.left = buildHalf(scene, def.left);
    this.right = buildHalf(scene, def.right);
    this.halves = [this.left, this.right];
  }

  update(dist) {
    const zr = this.z - dist;
    const visible = zr > 2 && zr < 140;
    this.halves.forEach((h, i) => {
      if (h.gone) return;
      h.setVisible(visible);
      if (!visible) return;
      const p = project(i === 0 ? -0.5 : 0.5, zr);
      h.setPosition(p.x, p.y);
      h.setScale((p.s / REF_S) * (h.pop || 1));
      h.setDepth(depthFor(zr) + 0.2);
      h.setAlpha(Phaser.Math.Clamp((140 - zr) / 30, 0, 1) * (h.dim ?? 1));
    });
    return zr;
  }

  // Player passed; side is 'left' | 'right'. Returns the option taken.
  trigger(side) {
    this.used = true;
    const taken = side === 'left' ? this.left : this.right;
    const other = side === 'left' ? this.right : this.left;
    taken.gone = true;
    this.scene.tweens.add({
      targets: taken,
      scale: taken.scale * 1.35,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.Out',
      onComplete: () => taken.setVisible(false),
    });
    other.dim = 0.35;
    return this.defs[side];
  }

  destroy() {
    this.halves.forEach((h) => h.destroy());
  }
}

export { label as gateLabel, good as gateIsGood };
