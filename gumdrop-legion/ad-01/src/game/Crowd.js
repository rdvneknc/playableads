import Phaser from 'phaser';
import { CAM, RUN, FONT } from '../config.js';
import { project, depthFor } from '../world/World.js';

const GOLDEN = 2.39996323;
const UNIT = 0.13; // world size of one gumdrop

// A blob of units in a sunflower formation. Positions are in world space;
// `baseZ` is the crowd centre's distance from the camera.
export class Crowd {
  constructor(scene, { count, keys, baseZ = CAM.crowdZ, facing = 'back' }) {
    this.scene = scene;
    this.keys = keys;
    this.baseZ = baseZ;
    this.facing = facing;
    this.count = 0;
    this.x = 0;
    this.members = [];
    this.time = 0;
    this.hop = 1;
    this.label = this.makeLabel();
    this.add(count, true);
  }

  makeLabel() {
    const c = this.scene.add.container(0, 0).setDepth(1500);
    const bg = this.scene.add.graphics();
    const t = this.scene.add
      .text(0, -2, '0', { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#1d3d8f', strokeThickness: 7 })
      .setOrigin(0.5);
    c.add([bg, t]);
    c.bg = bg;
    c.text = t;
    return c;
  }

  setLabelStyle(fill, stroke) {
    this.labelFill = fill;
    this.label.text.setStroke(stroke, 7);
    this.drawLabel();
  }

  drawLabel() {
    const { bg, text } = this.label;
    const w = Math.max(64, text.width + 30);
    bg.clear();
    bg.fillStyle(0x000000, 0.25);
    bg.fillRoundedRect(-w / 2 + 2, -26 + 4, w, 52, 26);
    bg.fillStyle(this.labelFill ?? 0x3d9bff, 1);
    bg.fillRoundedRect(-w / 2, -26, w, 52, 26);
    bg.fillStyle(0xffffff, 0.25);
    bg.fillRoundedRect(-w / 2 + 8, -22, w - 16, 18, 9);
    bg.lineStyle(4, 0xffffff, 1);
    bg.strokeRoundedRect(-w / 2, -26, w, 52, 26);
    // pointer tail
    bg.fillStyle(this.labelFill ?? 0x3d9bff, 1);
    bg.fillTriangle(-10, 24, 10, 24, 0, 38);
  }

  spacing() {
    const n = Math.max(1, Math.min(this.count, RUN.maxSprites));
    return 0.068 * Math.pow(Math.min(1, 45 / n), 0.18);
  }

  radius() {
    const n = Math.min(this.count, RUN.maxSprites);
    return this.spacing() * Math.sqrt(n) + UNIT / 2;
  }

  slot(i) {
    const r = this.spacing() * Math.sqrt(i + 0.35);
    const a = i * GOLDEN;
    return { ox: Math.cos(a) * r, oz: Math.sin(a) * r * 2.3 };
  }

  add(n, instant = false) {
    this.count += n;
    const want = Math.min(this.count, RUN.maxSprites);
    while (this.members.length < want) {
      const i = this.members.length;
      const key = this.keys[i % this.keys.length];
      const shadow = this.scene.add.image(0, 0, 'shadow').setOrigin(0.5, 0.5);
      const spr = this.scene.add.image(0, 0, key).setOrigin(0.5, 0.94);
      const m = { spr, shadow, phase: Math.random() * Math.PI * 2, x: this.x, z: this.baseZ, pop: instant ? 1 : 0 };
      if (!instant) {
        // spawn from the crowd centre and pop in
        m.x = this.x + (Math.random() - 0.5) * 0.05;
        m.z = this.baseZ;
        this.scene.tweens.add({ targets: m, pop: 1, duration: 280, ease: 'Back.Out' });
      }
      this.members.push(m);
    }
    this.layoutSlots();
    this.refreshLabel(n > 0 && !instant);
  }

  // Remove n units; returns the screen positions of the removed sprites (for FX).
  remove(n, { fx = true } = {}) {
    n = Math.min(n, this.count);
    this.count -= n;
    const want = Math.min(this.count, RUN.maxSprites);
    const removed = [];
    while (this.members.length > want) {
      const m = this.members.pop();
      removed.push({ x: m.spr.x, y: m.spr.y - m.spr.displayHeight * 0.4, s: m.spr.displayWidth });
      if (fx) {
        this.scene.tweens.add({
          targets: m.spr,
          scaleX: m.spr.scaleX * 1.6,
          scaleY: m.spr.scaleY * 0.2,
          alpha: 0,
          duration: 160,
          onComplete: () => m.spr.destroy(),
        });
        m.shadow.destroy();
      } else {
        m.spr.destroy();
        m.shadow.destroy();
      }
    }
    this.layoutSlots();
    this.refreshLabel(false);
    return removed;
  }

  // Detach one sprite (e.g. to fling it at the boss); count drops by one.
  takeOne() {
    if (this.count <= 0) return null;
    this.count -= 1;
    let spr = null;
    if (this.members.length > Math.min(this.count, RUN.maxSprites)) {
      const m = this.members.pop();
      m.shadow.destroy();
      spr = m.spr;
    }
    this.layoutSlots();
    this.refreshLabel(false);
    return spr;
  }

  layoutSlots() {
    this.members.forEach((m, i) => Object.assign(m, this.slot(i)));
  }

  refreshLabel(bump) {
    this.label.text.setText(String(Math.max(0, this.count)));
    this.drawLabel();
    this.label.setVisible(this.count > 0);
    if (bump) {
      this.scene.tweens.killTweensOf(this.label);
      this.label.setScale(1.35);
      this.scene.tweens.add({ targets: this.label, scale: 1, duration: 260, ease: 'Back.Out' });
    }
  }

  frontZ() {
    let z = Infinity;
    this.members.forEach((m) => (z = Math.min(z, m.z)));
    return this.members.length ? z : this.baseZ;
  }

  backZ() {
    let z = -Infinity;
    this.members.forEach((m) => (z = Math.max(z, m.z)));
    return this.members.length ? z : this.baseZ;
  }

  update(dt, { running = true, follow = 12 } = {}) {
    this.time += dt;
    const k = 1 - Math.exp(-follow * dt);
    let topY = Infinity;
    let topX = 0;
    this.members.forEach((m, i) => {
      m.x += (this.x + m.ox - m.x) * k;
      m.z += (this.baseZ + m.oz - m.z) * k;
      const p = project(m.x, m.z);
      const size = UNIT * p.s;
      const hopT = Math.abs(Math.sin(this.time * (running ? 11 : 4) + m.phase));
      const lift = hopT * size * (running ? 0.32 : 0.1) * this.hop;
      const squash = 1 + (1 - hopT) * (running ? 0.12 : 0.05);
      const base = (size / m.spr.width) * m.pop;
      m.spr.setPosition(p.x, p.y - lift);
      m.spr.setScale(base / Math.sqrt(squash), base * squash * (1 - (1 - hopT) * 0.12));
      m.spr.setDepth(depthFor(m.z));
      m.shadow.setPosition(p.x, p.y);
      m.shadow.setScale((size * 1.1 * m.pop) / m.shadow.width * (1 - hopT * 0.25));
      m.shadow.setDepth(depthFor(m.z) - 0.5);
      if (m.spr.y - m.spr.displayHeight < topY) {
        topY = m.spr.y - m.spr.displayHeight;
        topX = p.x;
      }
      if (i === 0) topX = p.x;
    });
    if (this.members.length) {
      const c = project(this.x, this.baseZ);
      this.label.setPosition(c.x, Math.min(topY, c.y - 60) - 40);
      this.label.setVisible(this.count > 0);
    } else {
      this.label.setVisible(false);
    }
  }

  destroy() {
    this.members.forEach((m) => {
      m.spr.destroy();
      m.shadow.destroy();
    });
    this.members = [];
    this.label.destroy();
  }
}
