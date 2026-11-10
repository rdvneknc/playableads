import Phaser from 'phaser';

// Floating joystick: appears under the finger anywhere inside `zone`,
// glides back to its home spot on release. Supports multi-touch (tracks one pointer).
export class VirtualJoystick extends Phaser.Events.EventEmitter {
  constructor(scene, x, y, { radius = 95, knobRadius = 36, deadZone = 10, zone, isBlocked = () => false } = {}) {
    super();
    this.scene = scene;
    this.homeX = x;
    this.homeY = y;
    this.radius = radius;
    this.knobRadius = knobRadius;
    this.deadZone = deadZone;
    this.zone = zone;
    this.isBlocked = isBlocked;
    this.pointerId = null;
    this.force = new Phaser.Math.Vector2(0, 0);

    this.base = this.createBase(x, y);
    this.knob = this.createKnob(x, y);
    this.setIdleLook();

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('gameout', this.reset, this);
    scene.events.once('shutdown', this.destroy, this);
  }

  createBase(x, y) {
    const c = this.scene.add.container(x, y).setDepth(100);
    const g = this.scene.add.graphics();
    const r = this.radius;
    g.fillStyle(0x000000, 0.12);
    g.fillCircle(0, 4, r);
    g.fillStyle(0xffffff, 0.14);
    g.fillCircle(0, 0, r);
    g.lineStyle(3, 0xffffff, 0.55);
    g.strokeCircle(0, 0, r);
    g.lineStyle(10, 0xffffff, 0.08);
    g.strokeCircle(0, 0, r * 0.72);
    g.fillStyle(0xffffff, 0.5);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const ax = Math.cos(a) * (r - 14);
      const ay = Math.sin(a) * (r - 14);
      const px = -Math.sin(a) * 7;
      const py = Math.cos(a) * 7;
      g.fillTriangle(ax + Math.cos(a) * 7, ay + Math.sin(a) * 7, ax + px, ay + py, ax - px, ay - py);
    }
    c.add(g);
    return c;
  }

  createKnob(x, y) {
    const k = this.knobRadius;
    const c = this.scene.add.container(x, y).setDepth(101);
    const g = this.scene.add.graphics();
    g.fillStyle(0x000000, 0.25);
    g.fillCircle(2, 4, k);
    g.fillStyle(0xff6a18, 1);
    g.fillCircle(0, 0, k);
    g.fillStyle(0xff8a3d, 1);
    g.fillCircle(-k * 0.15, -k * 0.18, k * 0.78);
    g.fillStyle(0xffe0b8, 0.85);
    g.fillEllipse(-k * 0.28, -k * 0.35, k * 0.55, k * 0.28);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(-k * 0.32, -k * 0.38, k * 0.12);
    g.lineStyle(3, 0xffffff, 0.35);
    g.strokeCircle(0, 0, k - 1);
    c.add(g);
    return c;
  }

  setIdleLook() {
    this.base.setAlpha(0.75);
    this.knob.setAlpha(0.9).setScale(1);
  }

  get active() {
    return this.pointerId !== null;
  }

  onDown(pointer) {
    if (this.isBlocked() || this.active) return;
    if (!this.zone.contains(pointer.x, pointer.y)) return;

    this.pointerId = pointer.id;
    this.scene.tweens.killTweensOf([this.base, this.knob]);

    const { width, height } = this.scene.scale;
    const m = this.radius * 0.8;
    const bx = Phaser.Math.Clamp(pointer.x, m, width - m);
    const by = Phaser.Math.Clamp(pointer.y, m, height - m);
    this.base.setPosition(bx, by).setAlpha(1);
    this.knob.setPosition(bx, by).setAlpha(1).setScale(1.06);
    this.updateKnob(pointer.x, pointer.y);
    this.emit('start');
  }

  onMove(pointer) {
    if (pointer.id !== this.pointerId) return;
    this.updateKnob(pointer.x, pointer.y);
  }

  onUp(pointer) {
    if (pointer.id !== this.pointerId) return;
    this.reset();
  }

  reset() {
    this.pointerId = null;
    this.force.set(0, 0);
    this.setIdleLook();
    this.scene.tweens.add({
      targets: [this.base, this.knob],
      x: this.homeX,
      y: this.homeY,
      duration: 160,
      ease: 'Quad.Out',
    });
  }

  updateKnob(px, py) {
    const dx = px - this.base.x;
    const dy = py - this.base.y;
    const dist = Math.hypot(dx, dy);
    const max = this.radius - this.knobRadius * 0.2;
    const clamped = Math.min(dist, max);
    const angle = Math.atan2(dy, dx);

    this.knob.setPosition(this.base.x + Math.cos(angle) * clamped, this.base.y + Math.sin(angle) * clamped);

    if (dist < this.deadZone) {
      this.force.set(0, 0);
      return;
    }
    // Ease-in curve: small thumb movements give finer control
    const t = (clamped - this.deadZone) / (max - this.deadZone);
    const mag = Phaser.Math.Clamp(0.25 + 0.75 * t, 0, 1);
    this.force.set(Math.cos(angle) * mag, Math.sin(angle) * mag);
  }

  getForce() {
    return this.force;
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    this.scene.input.off('gameout', this.reset, this);
    this.removeAllListeners();
  }
}
