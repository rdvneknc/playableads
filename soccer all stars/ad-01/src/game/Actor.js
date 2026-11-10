import Phaser from 'phaser';
import { ACTOR, BOOST, DASH, SHOT, SHOULDER, FONT } from '../config.js';
import { Cooldown } from './Cooldown.js';

const DEAD_ZONE = 0.12;

// A puck-style footballer. The same class drives the human player and the bot;
// only the source of `intent` differs.
export class Actor {
  constructor(scene, clock, { team, x, y, texture, ringColor, heading, label }) {
    this.scene = scene;
    this.clock = clock;
    this.team = team;
    this.radius = ACTOR.radius;
    this.spawn = { x, y, heading };

    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.kx = 0; // knockback velocity (decays separately from steering)
    this.ky = 0;
    this.heading = heading;
    this.enabled = true;

    this.intent = { mx: 0, my: 0 };
    this.stunUntil = 0;
    this.charge = null;
    this.dash = null;
    this.boostUntil = 0;
    this.boostMult = 1;
    this.ringColor = ringColor;

    this.cooldowns = {
      shoot: new Cooldown(clock, SHOT.shootCooldownMs),
      super: new Cooldown(clock, DASH.cooldownMs),
      shoulder: new Cooldown(clock, SHOULDER.cooldownMs),
    };

    this.createView(texture, ringColor, label);
  }

  createView(texture, ringColor, label) {
    const scene = this.scene;
    const size = ACTOR.size;

    this.shadow = scene.add.ellipse(this.x + 4, this.y + 8, size * 0.98, size * 0.9, 0x000000, 0.25).setDepth(3);

    this.view = scene.add.container(this.x, this.y).setDepth(5);
    // Soft team disc under the sprite so mixed models stay readable
    this.badge = scene.add.circle(0, 0, size * 0.52, ringColor, 0.35);
    this.ring = scene.add.circle(0, 0, size * 0.58, 0xffffff, 0).setStrokeStyle(6, ringColor, 1);

    this.pointer = scene.add.graphics();
    this.pointer.fillStyle(ringColor, 1);
    this.pointer.fillTriangle(size * 0.66, 0, size * 0.56, -11, size * 0.56, 11);

    this.sprite = scene.add.image(0, 0, texture).setDisplaySize(size, size);
    this.view.add([this.badge, this.ring, this.pointer, this.sprite]);
    this.spriteScale = this.sprite.scaleX;

    if (label) {
      this.label = scene.add
        .text(this.x, this.y + 58, label, {
          fontFamily: FONT,
          fontSize: '17px',
          color: '#ffffff',
          stroke: '#7a1010',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(7);
    }
  }

  get stunned() {
    return this.clock.now < this.stunUntil;
  }

  get charging() {
    return this.charge !== null;
  }

  get dashing() {
    return this.dash !== null;
  }

  get boosting() {
    return this.clock.now < this.boostUntil;
  }

  get speed() {
    return Math.hypot(this.vx + this.kx, this.vy + this.ky);
  }

  activateBoost(durationMs = BOOST.durationMs, mult = BOOST.speedMult) {
    this.boostUntil = this.clock.now + durationMs;
    this.boostMult = mult;
  }

  startDash(dirX, dirY) {
    const len = Math.hypot(dirX, dirY) || 1;
    this.dash = {
      dx: dirX / len,
      dy: dirY / len,
      until: this.clock.now + DASH.durationMs,
    };
    this.heading = Math.atan2(dirY, dirX);
    this.charge = null;
    this.cooldowns.super.trigger();
  }

  get dirX() {
    return Math.cos(this.heading);
  }

  get dirY() {
    return Math.sin(this.heading);
  }

  distanceTo(other) {
    return Math.hypot(other.x - this.x, other.y - this.y);
  }

  resetMotion() {
    this.vx = this.vy = this.kx = this.ky = 0;
    this.charge = null;
    this.dash = null;
    this.stunUntil = 0;
    this.boostUntil = 0;
    this.boostMult = 1;
    this.intent.mx = this.intent.my = 0;
  }

  resetToSpawn() {
    this.x = this.spawn.x;
    this.y = this.spawn.y;
    this.heading = this.spawn.heading;
    this.resetMotion();
  }

  stun(ms) {
    this.stunUntil = Math.max(this.stunUntil, this.clock.now + ms);
    this.charge = null;
    this.dash = null;
  }

  knock(nx, ny, force) {
    this.kx += nx * force;
    this.ky += ny * force;
    this.vx *= 0.2;
    this.vy *= 0.2;
  }

  startCharge(target) {
    this.charge = { target, until: this.clock.now + SHOULDER.chargeMs };
    this.cooldowns.shoulder.trigger();
  }

  bounceX(sign) {
    if (this.vx * sign < 0) this.vx = 0;
    if (this.kx * sign < 0) this.kx = -this.kx * 0.35;
  }

  bounceY(sign) {
    if (this.vy * sign < 0) this.vy = 0;
    if (this.ky * sign < 0) this.ky = -this.ky * 0.35;
  }

  // ------------------------------------------------------------------ motion

  step(dt, hasBall) {
    const kDecay = Math.exp(-ACTOR.knockbackDamping * dt);
    this.kx *= kDecay;
    this.ky *= kDecay;

    if (this.dash) {
      this.stepDash(dt);
    } else if (this.charge) {
      this.stepCharge(dt);
    } else if (this.stunned) {
      this.approachVelocity(0, 0, ACTOR.decel * 0.6, dt);
    } else {
      this.stepSteering(dt, hasBall);
    }

    this.x += (this.vx + this.kx) * dt;
    this.y += (this.vy + this.ky) * dt;
  }

  stepDash(dt) {
    const { dx, dy, until } = this.dash;
    if (this.clock.now > until) {
      this.dash = null;
      this.vx *= 0.45;
      this.vy *= 0.45;
      return;
    }
    this.heading = Math.atan2(dy, dx);
    this.vx = dx * DASH.speed;
    this.vy = dy * DASH.speed;
  }

  stepCharge(dt) {
    const { target, until } = this.charge;
    if (this.clock.now > until || !target.enabled) {
      this.charge = null;
      return;
    }
    const ang = Math.atan2(target.y - this.y, target.x - this.x);
    this.heading = ang;
    this.vx = Math.cos(ang) * SHOULDER.chargeSpeed;
    this.vy = Math.sin(ang) * SHOULDER.chargeSpeed;
  }

  stepSteering(dt, hasBall) {
    const { mx, my } = this.intent;
    const mag = Math.min(1, Math.hypot(mx, my));
    const moving = mag > DEAD_ZONE;

    if (moving) {
      const turnRate = hasBall ? ACTOR.dribbleTurnRate : ACTOR.turnRate;
      this.turnTowards(Math.atan2(my, mx), turnRate * dt);
    }

    if (!moving) {
      this.approachVelocity(0, 0, ACTOR.decel, dt);
      return;
    }

    const boost = this.boosting ? this.boostMult : 1;
    const accel = ACTOR.accel * (boost > 1 ? 1.35 : 1);

    if (hasBall) {
      // Carry the ball along the (slowly turning) heading; slow down on sharp turns.
      const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(my, mx) - this.heading));
      const align = Phaser.Math.Clamp(Math.cos(diff), 0.4, 1);
      const s = ACTOR.speed * ACTOR.dribbleSpeedFactor * mag * align * boost;
      this.approachVelocity(this.dirX * s, this.dirY * s, accel, dt);
    } else {
      const s = ((ACTOR.speed * mag) / Math.hypot(mx, my)) * boost;
      this.approachVelocity(mx * s, my * s, accel, dt);
    }
  }

  turnTowards(target, maxStep) {
    const diff = Phaser.Math.Angle.Wrap(target - this.heading);
    this.heading = Phaser.Math.Angle.Wrap(this.heading + Phaser.Math.Clamp(diff, -maxStep, maxStep));
  }

  approachVelocity(tx, ty, rate, dt) {
    const dx = tx - this.vx;
    const dy = ty - this.vy;
    const dist = Math.hypot(dx, dy);
    const maxDelta = rate * dt;
    if (dist <= maxDelta) {
      this.vx = tx;
      this.vy = ty;
    } else {
      this.vx += (dx / dist) * maxDelta;
      this.vy += (dy / dist) * maxDelta;
    }
  }

  // ------------------------------------------------------------------- view

  syncView(time) {
    if (!this.enabled) return;
    this.view.setPosition(this.x, this.y);
    this.shadow.setPosition(this.x + 4, this.y + 8);
    this.label?.setPosition(this.x, this.y + 58);
    this.pointer.setRotation(this.heading);

    if (this.stunned) {
      this.sprite.setAngle(Math.sin(time * 0.04) * 14);
      this.sprite.setTint(0xffd0d0);
      this.ring.setAlpha(0.4 + 0.3 * Math.sin(time * 0.03));
      this.ring.setStrokeStyle(5, this.ringColor, 0.95);
    } else if (this.dashing) {
      this.sprite.setAngle(0);
      this.sprite.setTint(0xa8e0ff);
      const pulse = 0.75 + 0.25 * Math.sin(time * 0.06);
      this.ring.setAlpha(pulse);
      this.ring.setStrokeStyle(8, 0x66ddff, pulse);
    } else if (this.boosting) {
      this.sprite.setAngle(0);
      this.sprite.setTint(0xffe0a8);
      const pulse = 0.7 + 0.3 * Math.sin(time * 0.035);
      this.ring.setAlpha(pulse);
      this.ring.setStrokeStyle(7, 0xfff27a, pulse);
    } else {
      this.sprite.setAngle(0);
      this.sprite.clearTint();
      this.ring.setAlpha(1);
      this.ring.setStrokeStyle(5, this.ringColor, 0.95);
    }

    const squash = this.charging || this.boosting || this.dashing ? 1.1 : 1;
    const stretch = this.dashing ? 1.12 : this.boosting ? 1.04 : 1;
    this.sprite.setScale(this.spriteScale * squash * stretch, this.spriteScale * squash * (this.dashing ? 0.92 : 1));
  }

  spawnAfterimage(tint = 0xffffff, alpha = 0.45) {
    const ghost = this.scene.add
      .image(this.x, this.y, this.sprite.texture.key)
      .setDisplaySize(ACTOR.size, ACTOR.size)
      .setAlpha(alpha)
      .setTint(tint)
      .setDepth(4)
      .setRotation(this.heading);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scale: ghost.scale * 0.8,
      duration: this.dashing || this.boosting ? 280 : 220,
      onComplete: () => ghost.destroy(),
    });
  }

  spawnSpeedStreak(tint = 0xffe566) {
    const backX = this.x - this.dirX * (this.radius + 10);
    const backY = this.y - this.dirY * (this.radius + 10);
    const streak = this.scene.add
      .image(backX, backY, 'flame')
      .setTint(tint)
      .setAlpha(0.9)
      .setDepth(4)
      .setDisplaySize(this.dashing ? 28 : 22, this.dashing ? 12 : 14)
      .setRotation(this.heading);
    this.scene.tweens.add({
      targets: streak,
      x: backX - this.dirX * (this.dashing ? 55 : 40),
      y: backY - this.dirY * (this.dashing ? 55 : 40),
      alpha: 0,
      scaleX: 2.1,
      scaleY: 0.35,
      duration: this.dashing ? 160 : 180,
      onComplete: () => streak.destroy(),
    });
  }
}
