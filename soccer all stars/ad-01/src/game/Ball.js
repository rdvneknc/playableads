import { BALL, SHOT } from '../config.js';

export class Ball {
  constructor(scene, clock, x, y) {
    this.scene = scene;
    this.clock = clock;
    this.radius = BALL.radius;
    this.spawn = { x, y };

    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;

    this.owner = null;
    this.ownedSince = 0;
    this.locks = new Map(); // actor → time until which it can't touch the ball
    this.superShot = null; // { token, until, by }
    this.superToken = 0;

    this.createView();
  }

  createView() {
    const scene = this.scene;
    this.shadow = scene.add.ellipse(this.x + 3, this.y + 6, BALL.size * 0.95, BALL.size * 0.8, 0x000000, 0.28).setDepth(4);

    this.glow = scene.add.image(this.x, this.y, 'glow').setDepth(5).setBlendMode('ADD').setVisible(false);

    this.sprite = scene.add.image(this.x, this.y, 'ball').setDisplaySize(BALL.size, BALL.size).setDepth(6);
    this.baseScale = this.sprite.scaleX;

    this.flame = scene.add.particles(0, 0, 'flame', {
      speed: { min: 30, max: 110 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.6, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint: [0xffee88, 0xffaa22, 0xff5500],
      lifespan: 320,
      frequency: 12,
      quantity: 2,
      blendMode: 'ADD',
      emitting: false,
    });
    this.flame.setDepth(5);
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  isLockedFor(actor) {
    return (this.locks.get(actor) ?? 0) > this.clock.now;
  }

  lockFor(actor, ms) {
    this.locks.set(actor, this.clock.now + ms);
  }

  setOwner(actor) {
    if (this.owner === actor) return;
    this.owner = actor;
    this.ownedSince = this.clock.now;
    if (actor) this.endSuperShot();
  }

  kick(dirX, dirY, power, by, isSuper) {
    this.setOwner(null);
    this.vx = dirX * power;
    this.vy = dirY * power;
    this.lockFor(by, SHOT.shooterLockMs);
    if (isSuper) this.startSuperShot(by);
    else this.endSuperShot();
  }

  startSuperShot(by) {
    this.superToken += 1;
    this.superShot = { token: this.superToken, until: this.clock.now + SHOT.superMaxMs, by };
    this.sprite.setTint(0xffa040);
    this.glow.setVisible(true);
    this.flame.startFollow(this.sprite);
    this.flame.start();
  }

  endSuperShot(token) {
    if (!this.superShot) return;
    if (token !== undefined && token !== this.superShot.token) return;
    this.superShot = null;
    this.sprite.clearTint();
    this.glow.setVisible(false);
    this.flame.stop();
  }

  applyFriction(dt) {
    if (this.owner) return;
    const k = this.superShot ? BALL.superFriction : BALL.friction;
    const f = Math.exp(-k * dt);
    this.vx *= f;
    this.vy *= f;

    const s = this.speed;
    if (s > BALL.maxSpeed) {
      this.vx *= BALL.maxSpeed / s;
      this.vy *= BALL.maxSpeed / s;
    } else if (s < BALL.stopSpeed) {
      this.vx = this.vy = 0;
    }

    if (this.superShot && (this.clock.now > this.superShot.until || s < SHOT.superEndSpeed)) {
      this.endSuperShot();
    }
  }

  resetToSpawn() {
    this.x = this.spawn.x;
    this.y = this.spawn.y;
    this.vx = this.vy = 0;
    this.setOwner(null);
    this.locks.clear();
    this.endSuperShot();
  }

  syncView(dt) {
    this.sprite.setPosition(this.x, this.y);
    this.shadow.setPosition(this.x + 3, this.y + 6);

    const s = this.speed;
    if (s > 1) {
      const dir = this.vx >= 0 ? 1 : -1;
      this.sprite.rotation += dir * (s * dt) / this.radius;
    }

    if (this.superShot) {
      const pulse = 1 + Math.sin(this.clock.now * 0.03) * 0.08;
      this.glow.setPosition(this.x, this.y).setScale(pulse * 1.25);
      this.sprite.setScale(this.baseScale * 1.1);
    } else {
      this.sprite.setScale(this.baseScale);
    }
  }
}
