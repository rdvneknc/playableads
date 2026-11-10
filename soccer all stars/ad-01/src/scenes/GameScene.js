import Phaser from 'phaser';
import { AD, BALL, BOOST, COLORS, DRIBBLE, GOAL, MATCH, PHYSICS, PITCH, SHOT, SHOULDER } from '../config.js';
// PITCH.centerRadius used for kickoff restriction
import { SimClock } from '../game/Cooldown.js';
import { Pitch } from '../game/Pitch.js';
import { Actor } from '../game/Actor.js';
import { Ball } from '../game/Ball.js';
import { BotBrain } from '../game/BotBrain.js';
import { sfx } from '../audio/Sfx.js';
import { notifyGameEnd } from '../ad/cta.js';

const ok = { ok: true };
const fail = (reason) => ({ ok: false, reason });

// World + match rules. Runs a fixed-timestep simulation on its own clock, so
// pausing (scene.pause) freezes physics, cooldowns and match timers together.
// All HUD / controls live in UIScene and talk to this scene through `matchEvents`.
export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.matchEvents = new Phaser.Events.EventEmitter();
    this.clock = new SimClock();
    this.accumulator = 0;
    this.hitStopMs = 0;
    this.state = 'kickoff';
    this.score = { player: 0, bot: 0 };
    this.timeLeftMs = AD.matchDurationSec * 1000;
    this.playerInput = { mx: 0, my: 0 };
    this.contacts = [];
    // After a goal the conceded team restarts; the scorer stays in their half / out of the circle
    this.kickoffOwner = 'player';
    this.kickoffRestricted = null;

    this.pitch = new Pitch(this);

    // 1v1 landscape: player left (attacks right), bot right (attacks left)
    const playerX = PITCH.midX - (PITCH.midX - PITCH.left) * 0.42;
    const botX = PITCH.midX + (PITCH.right - PITCH.midX) * 0.42;

    this.player = new Actor(this, this.clock, {
      team: 'player',
      x: playerX,
      y: PITCH.midY,
      texture: 'player',
      ringColor: COLORS.playerRing,
      heading: 0,
    });
    this.bot = new Actor(this, this.clock, {
      team: 'bot',
      x: botX,
      y: PITCH.midY,
      texture: 'opponent',
      ringColor: COLORS.botRing,
      heading: Math.PI,
    });
    this.actors = [this.player, this.bot];

    this.ball = new Ball(this, this.clock, PITCH.cx, PITCH.midY);
    this.brains = [new BotBrain(this, this.bot, { attackSign: -1, lane: 0, canBoost: true })];

    this.aimGuide = this.add.graphics().setDepth(4);
    this.confetti = this.add.particles(0, 0, 'confetti', {
      speed: { min: 250, max: 650 },
      angle: { min: 0, max: 360 },
      rotate: { start: 0, end: 540 },
      gravityY: 700,
      lifespan: 1300,
      scale: { min: 0.8, max: 1.4 },
      tint: [0xffe566, 0x5cff9a, 0x3da9ff, 0xff6b6b, 0xffffff],
      emitting: false,
    }).setDepth(30);

    this.scene.launch('UI');
    this.startKickoff(MATCH.kickoffMs);
  }

  // ------------------------------------------------------------ public API

  get isPlaying() {
    return this.state === 'playing';
  }

  // Keep moving after a goal until kickoff play resumes (no freeze / teleport)
  get canMove() {
    return this.state === 'playing' || this.state === 'goal';
  }

  setPlayerInput(mx, my) {
    this.playerInput.mx = mx;
    this.playerInput.my = my;
  }

  playerAction(type) {
    if (type === 'shoot') return this.tryShoot(this.player, false);
    if (type === 'super') return this.tryDash(this.player);
    if (type === 'shoulder') return this.tryShoulder(this.player);
    return fail('unknown');
  }

  restartMatch() {
    this.kickoffOwner = 'player';
    this.kickoffRestricted = null;
    this.scene.stop('UI');
    this.scene.restart();
  }

  // ------------------------------------------------------------ match flow

  nearestFoe(actor) {
    let best = null;
    let bestD = Infinity;
    for (const a of this.actors) {
      if (!a.enabled || a.team === actor.team) continue;
      const d = actor.distanceTo(a);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  startKickoff(freezeMs, { resetActors = true, restrictScorer = null } = {}) {
    if (resetActors) {
      this.actors.forEach((a) => a.resetToSpawn());
      this.brains.forEach((b) => b.reset());
    }
    if (restrictScorer) this.kickoffRestricted = restrictScorer;
    this.ball.resetToSpawn();
    this.placeKickoffActors();

    if (freezeMs > 0) {
      this.state = 'kickoff';
      this.matchEvents.emit('kickoff', freezeMs);
      this.clock.after(freezeMs, () => this.beginPlay());
    } else {
      this.beginPlay();
    }
  }

  placeKickoffActors() {
    // Ball parks at center for the conceded side to collect.
    this.ball.resetToSpawn();
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.setOwner(null);
  }

  beginPlay() {
    if (this.state === 'ended') return;
    this.state = 'playing';
    // Do not auto-attach the ball — kickoff team must go pick it up
    this.ball.setOwner(null);
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.matchEvents.emit('play');
  }

  clearKickoffRestriction() {
    this.kickoffRestricted = null;
  }

  onGoal(side) {
    this.state = 'goal';
    // Right goal = player scored; left goal = bot scored
    const scorer = side === 'right' ? 'player' : 'bot';
    this.score[scorer] += 1;
    this.ball.setOwner(null);
    // Restriction starts only when the ball parks — applying it here snapped the scorer to midfield
    this.kickoffRestricted = null;
    this.kickoffOwner = scorer === 'player' ? 'bot' : 'player';
    if (this.goalTimer) this.clock.cancel(this.goalTimer);

    this.pitch.shakeNet(side);
    const gx = side === 'right' ? PITCH.right + 20 : PITCH.left - 20;
    this.confetti.explode(scorer === 'player' ? 70 : 30, gx, PITCH.midY);
    this.cameras.main.shake(260, 0.01);
    if (scorer === 'player') sfx.goal();
    else sfx.conceded();

    this.matchEvents.emit('goal', { scorer, score: { ...this.score } });
    this.goalTimer = this.clock.after(MATCH.goalResetMs, () => {
      this.goalTimer = null;
      if (this.state === 'ended') return;
      if (this.timeLeftMs <= 0) {
        this.endMatch();
        return;
      }
      // Free roam during celebration; only then reset both to spawn for kickoff
      this.startKickoff(0, { resetActors: true, restrictScorer: scorer });
    });
  }

  // Scorer can't re-enter opp half / center circle — soft walls only, never long-range snaps
  enforceKickoffRestriction(actor) {
    if (this.kickoffRestricted !== actor.team || !actor.enabled) return;
    if (this.state === 'goal') return;

    const mid = PITCH.midX;
    const cy = PITCH.midY;
    const ownLeft = actor.team === 'player';
    const edge = 8;

    // Soft mid-line: block crossing from own half; if already deep after a goal, leave them be
    if (ownLeft) {
      if (actor.x > mid && actor.x <= mid + edge) {
        actor.x = mid;
        if (actor.vx > 0) actor.vx = 0;
      } else if (actor.x > mid + edge && actor.vx > 0) {
        actor.vx = 0;
      }
    } else if (actor.x < mid && actor.x >= mid - edge) {
      actor.x = mid;
      if (actor.vx < 0) actor.vx = 0;
    } else if (actor.x < mid - edge && actor.vx < 0) {
      actor.vx = 0;
    }

    const dx = actor.x - mid;
    const dy = actor.y - cy;
    const dist = Math.hypot(dx, dy);
    const minD = PITCH.centerRadius + actor.radius;
    if (dist < minD) {
      let nx = dist > 0.001 ? dx / dist : ownLeft ? -1 : 1;
      let ny = dist > 0.001 ? dy / dist : 0;
      if (ownLeft && nx > -0.15) nx = -0.15;
      if (!ownLeft && nx < 0.15) nx = 0.15;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      // Push out with velocity — no position teleport
      const push = Math.min((minD - dist) * 18, 1000);
      actor.vx += nx * push;
      actor.vy += ny * push;
      const vn = actor.vx * nx + actor.vy * ny;
      if (vn < 0) {
        actor.vx -= vn * nx;
        actor.vy -= vn * ny;
      }
    }
  }

  updateKickoffClear() {
    if (!this.kickoffRestricted || !this.isPlaying) return;
    const { ball } = this;
    const owner = ball.owner;
    // Kickoff ends once the conceded side collects the ball and plays it out,
    // or once anyone shoots it clear of the center.
    const takenByKickoff =
      owner && owner.team === this.kickoffOwner && Math.hypot(ball.x - PITCH.cx, ball.y - PITCH.midY) > PITCH.centerRadius;
    const blasted = ball.speed > 700;
    if (takenByKickoff || blasted) this.clearKickoffRestriction();
  }

  endMatch() {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.ball.setOwner(null);
    this.actors.forEach((a) => {
      a.intent.mx = a.intent.my = 0;
      a.charge = null;
    });
    sfx.whistle();
    sfx.whistle(0.5);
    this.matchEvents.emit('ended', { score: { ...this.score } });
    notifyGameEnd();
  }

  // ------------------------------------------------------------ skills

  tryShoot(actor, isSuper, dirX, dirY) {
    if (!this.isPlaying) return fail('state');
    if (!actor.enabled || actor.stunned || actor.charging || actor.dashing) return fail('busy');
    // Super shot removed for player; keep param only for legacy ball path
    if (isSuper) return this.tryDash(actor);

    const cd = actor.cooldowns.shoot;
    if (!cd.ready) return fail('cooldown');

    const { ball } = this;
    if (ball.owner && ball.owner !== actor) return fail('noball');
    if (!ball.owner) {
      const reach = actor.radius + ball.radius + SHOT.reach;
      if (actor.distanceTo(ball) > reach || ball.isLockedFor(actor)) return fail('noball');
    }

    let dx = dirX ?? actor.dirX;
    let dy = dirY ?? actor.dirY;
    if (!ball.owner) {
      // Loose ball next to us: never kick it back through our own body
      const bx = ball.x - actor.x;
      const by = ball.y - actor.y;
      const bl = Math.hypot(bx, by) || 1;
      if ((bx * dx + by * dy) / bl < -0.2) {
        dx = bx / bl;
        dy = by / bl;
      }
    }

    cd.trigger();
    ball.kick(dx, dy, SHOT.speed, actor, false);
    sfx.kick();
    this.clearKickoffRestriction();
    this.matchEvents.emit('shot', { team: actor.team, isSuper: false });
    return ok;
  }

  tryShoulder(actor) {
    if (!this.isPlaying) return fail('state');
    const target = this.nearestFoe(actor);
    if (!target?.enabled) return fail('nobot');
    if (!actor.enabled || actor.stunned || actor.charging || actor.dashing) return fail('busy');
    if (!actor.cooldowns.shoulder.ready) return fail('cooldown');
    if (actor.distanceTo(target) > SHOULDER.range) return fail('far');

    actor.startCharge(target);
    sfx.whoosh();
    this.matchEvents.emit('shoulder', { team: actor.team });
    return ok;
  }

  // Bot sustained 2× speed
  tryBoost(actor) {
    if (!this.isPlaying) return fail('state');
    if (!actor.enabled || actor.stunned || actor.charging || actor.dashing) return fail('busy');
    if (actor.boosting) return fail('busy');
    if (!actor.cooldowns.super.ready) return fail('cooldown');

    actor.cooldowns.super.trigger();
    actor.activateBoost(BOOST.durationMs, BOOST.speedMult);
    sfx.whoosh();
    sfx.superKick();
    this.spark(actor.x, actor.y, 0xffe566);
    this.cameras.main.shake(90, 0.004);
    this.matchEvents.emit('boost', { team: actor.team });
    return ok;
  }

  // Player short forward burst
  tryDash(actor) {
    if (!this.isPlaying) return fail('state');
    if (!actor.enabled || actor.stunned || actor.charging || actor.dashing) return fail('busy');
    if (!actor.cooldowns.super.ready) return fail('cooldown');

    let dx = this.playerInput.mx;
    let dy = this.playerInput.my;
    if (Math.hypot(dx, dy) < 0.2) {
      dx = actor.dirX;
      dy = actor.dirY;
    }

    actor.startDash(dx, dy);
    sfx.whoosh();
    this.spark(actor.x, actor.y, 0x66ddff);
    for (let i = 0; i < 3; i++) actor.spawnAfterimage(0x66ccff, 0.5 - i * 0.1);
    this.cameras.main.shake(70, 0.0035);
    this.matchEvents.emit('dash', { team: actor.team });
    return ok;
  }

  // ------------------------------------------------------------ loop

  update(time, delta) {
    const frameMs = Math.min(delta, 100);

    if (this.hitStopMs > 0) {
      this.hitStopMs -= frameMs;
    } else {
      this.accumulator += frameMs;
      let steps = 0;
      while (this.accumulator >= PHYSICS.stepMs && steps < PHYSICS.maxStepsPerFrame) {
        this.fixedStep(PHYSICS.stepMs / 1000);
        this.accumulator -= PHYSICS.stepMs;
        steps += 1;
      }
      if (steps === PHYSICS.maxStepsPerFrame) this.accumulator = 0;
    }

    this.syncViews(time, frameMs / 1000);
    this.matchEvents.emit('tick');
  }

  fixedStep(dt) {
    this.clock.advance(dt * 1000);

    if (this.state === 'playing') {
      this.timeLeftMs = Math.max(0, this.timeLeftMs - dt * 1000);
      if (this.timeLeftMs === 0) {
        this.endMatch();
        return;
      }
    }

    const moving = this.canMove;
    this.player.intent.mx = moving ? this.playerInput.mx : 0;
    this.player.intent.my = moving ? this.playerInput.my : 0;
    for (const brain of this.brains) brain.step();

    if (this.state !== 'kickoff') {
      for (const a of this.actors) {
        if (a.enabled) a.step(dt, this.ball.owner === a);
      }
      this.resolveCharges();
      this.resolveActorCollision();
      for (const a of this.actors) {
        if (a.enabled) {
          this.pitch.clampActor(a);
          this.enforceKickoffRestriction(a);
        }
      }
      this.stepBall(dt);
      this.updateKickoffClear();
    }

    if (this.state === 'playing') {
      const side = this.pitch.checkGoal(this.ball);
      if (side) this.onGoal(side);
    }
  }

  // ------------------------------------------------------------ ball

  holdPoint(actor) {
    const d = actor.radius + this.ball.radius + DRIBBLE.gap;
    return { x: actor.x + actor.dirX * d, y: actor.y + actor.dirY * d };
  }

  stepBall(dt) {
    const { ball } = this;
    const owner = ball.owner;

    if (owner) {
      // Spring the ball towards the spot in front of the carrier
      const hold = this.holdPoint(owner);
      ball.vx = owner.vx + owner.kx + (hold.x - ball.x) * DRIBBLE.spring;
      ball.vy = owner.vy + owner.ky + (hold.y - ball.y) * DRIBBLE.spring;
      const s = ball.speed;
      const cap = 1100;
      if (s > cap) {
        ball.vx *= cap / s;
        ball.vy *= cap / s;
      }
    }

    // Sub-step so even a super shot moves < half a radius per collision check
    const travel = ball.speed * dt;
    const n = Phaser.Math.Clamp(Math.ceil(travel / (ball.radius * 0.5)), 1, 16);
    const sdt = dt / n;
    this.contacts.length = 0;
    let strongest = null;

    for (let i = 0; i < n; i++) {
      ball.x += ball.vx * sdt;
      ball.y += ball.vy * sdt;
      for (const a of this.actors) this.collideBallActor(a);
      // Static geometry is resolved last so an actor can never push the ball through a wall
      const hit = this.pitch.collideBall(ball);
      if (hit && (!strongest || hit.speed > strongest.speed)) strongest = hit;
    }

    ball.applyFriction(dt);
    if (this.pitch.isInsideGoal(ball)) {
      // The net swallows the ball so it settles inside instead of rolling back out
      const f = Math.exp(-GOAL.netDamping * dt);
      ball.vx *= f;
      ball.vy *= f;
    }
    if (strongest) this.onBallHit(strongest);

    if (owner && ball.owner === owner) {
      const hold = this.holdPoint(owner);
      if (Math.hypot(hold.x - ball.x, hold.y - ball.y) > DRIBBLE.loseDistance) ball.setOwner(null);
    }

    this.updatePossession();
  }

  collideBallActor(actor) {
    const { ball } = this;
    if (!actor.enabled) return;

    const dx = ball.x - actor.x;
    const dy = ball.y - actor.y;
    const minD = actor.radius + ball.radius;
    const dist = Math.hypot(dx, dy);

    if (ball.isLockedFor(actor)) {
      // The lock only lets the ball leave our body; once clear, it collides normally again
      if (dist > minD + DRIBBLE.touchSlack + 2) ball.locks.delete(actor);
      return;
    }
    if (dist >= minD + DRIBBLE.touchSlack) return;

    const nx = dist > 0.001 ? dx / dist : actor.dirX;
    const ny = dist > 0.001 ? dy / dist : actor.dirY;
    const avx = actor.vx + actor.kx;
    const avy = actor.vy + actor.ky;
    const rvx = ball.vx - avx;
    const rvy = ball.vy - avy;
    const relSpeed = Math.hypot(rvx, rvy);

    if (!this.contacts.some((c) => c.actor === actor)) this.contacts.push({ actor, relSpeed, dist });
    if (dist >= minD) return;

    const sup = ball.superShot;
    if (sup && sup.by !== actor && ball.speed > SHOT.superEndSpeed) {
      // Fireball bulldozes through whoever stands in the way
      const bl = ball.speed;
      actor.knock(ball.vx / bl, ball.vy / bl, SHOT.superKnockback);
      actor.stun(SHOT.superStunMs);
      ball.vx *= 0.75;
      ball.vy *= 0.75;
      ball.lockFor(actor, 300);
      if (ball.owner === actor) ball.setOwner(null);
      this.spark(ball.x, ball.y, 0xffaa33);
      this.cameras.main.shake(120, 0.008);
      sfx.bump();
      return;
    }

    ball.x = actor.x + nx * minD;
    ball.y = actor.y + ny * minD;

    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const e = ball.owner === actor ? 0 : 0.35;
      ball.vx -= (1 + e) * vn * nx;
      ball.vy -= (1 + e) * vn * ny;
      if (!ball.owner && -vn > 500) sfx.touch();
    }
  }

  updatePossession() {
    if (!this.isPlaying || !this.contacts.length) return;
    const { ball } = this;
    const sorted = this.contacts.slice().sort((a, b) => a.dist - b.dist);

    for (const { actor, relSpeed } of sorted) {
      if (ball.owner === actor) continue;
      if (actor.stunned || actor.charging || ball.isLockedFor(actor)) continue;
      // Scorer can't collect the parked kickoff ball
      if (this.kickoffRestricted === actor.team) continue;
      if (relSpeed > DRIBBLE.pickupSpeed) continue;

      const prev = ball.owner;
      if (prev) {
        if (this.clock.now - ball.ownedSince < DRIBBLE.protectMs) continue;
        ball.lockFor(prev, 260);
        this.matchEvents.emit('steal', { team: actor.team });
      }
      ball.setOwner(actor);
      sfx.touch();
      return;
    }
  }

  onBallHit(hit) {
    if (hit.kind === 'post' && hit.speed > 250) {
      sfx.post();
      this.cameras.main.shake(90, 0.004);
    } else if (hit.kind === 'net' && hit.speed > 200) {
      sfx.net();
    } else if (hit.kind === 'wall' && hit.speed > 400) {
      sfx.touch();
    }
  }

  // ------------------------------------------------------------ actors

  resolveCharges() {
    for (const attacker of this.actors) {
      if (!attacker.charging) continue;
      const target = attacker.charge.target;
      const reach = attacker.radius + target.radius + SHOULDER.contactSlack;
      if (attacker.distanceTo(target) <= reach) this.shoulderImpact(attacker, target);
    }
  }

  shoulderImpact(attacker, target) {
    const dist = attacker.distanceTo(target) || 1;
    const nx = (target.x - attacker.x) / dist;
    const ny = (target.y - attacker.y) / dist;

    attacker.charge = null;
    attacker.vx *= 0.25;
    attacker.vy *= 0.25;
    target.knock(nx, ny, SHOULDER.force);
    target.stun(SHOULDER.stunMs);

    const { ball } = this;
    if (ball.owner === target) {
      ball.setOwner(null);
      const side = Phaser.Math.FloatBetween(-0.35, 0.35);
      ball.vx = (nx - ny * side) * SHOULDER.ballPop;
      ball.vy = (ny + nx * side) * SHOULDER.ballPop;
      ball.lockFor(target, 450);
    }

    const cx = (attacker.x + target.x) / 2;
    const cy = (attacker.y + target.y) / 2;
    this.spark(cx, cy, 0xffe566);
    this.cameras.main.shake(150, 0.009);
    this.hitStopMs = 70;
    sfx.bump();
    this.matchEvents.emit('shoulder-hit', { team: attacker.team });
  }

  resolveActorCollision() {
    const list = this.actors;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        this.collideActors(list[i], list[j]);
      }
    }
  }

  collideActors(a, b) {
    if (!a.enabled || !b.enabled) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const minD = a.radius + b.radius;
    const dist = Math.hypot(dx, dy);
    if (dist >= minD) return;

    const nx = dist > 0.001 ? dx / dist : 1;
    const ny = dist > 0.001 ? dy / dist : 0;
    const push = (minD - dist) / 2;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;

    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rv < 0) {
      const j = (rv * 1.2) / 2;
      a.vx += j * nx;
      a.vy += j * ny;
      b.vx -= j * nx;
      b.vy -= j * ny;
    }
  }

  // ------------------------------------------------------------ visuals

  syncViews(time, dt) {
    for (const a of this.actors) {
      a.syncView(time);
      if (!a.enabled) continue;
      if (a.dashing && time - (a.lastGhostAt ?? 0) > 18) {
        a.lastGhostAt = time;
        a.spawnAfterimage(0x66ddff, 0.6);
        a.spawnSpeedStreak(0x7adfff);
      } else if (a.charging && time - (a.lastGhostAt ?? 0) > 35) {
        a.lastGhostAt = time;
        a.spawnAfterimage();
      } else if (a.boosting && a.speed > 80 && time - (a.lastGhostAt ?? 0) > 28) {
        a.lastGhostAt = time;
        a.spawnAfterimage(0xffcc66, 0.55);
        a.spawnSpeedStreak(0xffe566);
      }
    }
    this.ball.syncView(dt);
    this.drawAimGuide(time);
  }

  drawAimGuide(time) {
    const g = this.aimGuide;
    g.clear();
    if (!this.isPlaying || this.ball.owner !== this.player) return;

    const { ball, player } = this;
    const offset = (time * 0.12) % 26;
    for (let i = 0; i < 5; i++) {
      const d = BALL.radius + 18 + i * 26 + offset;
      const alpha = 0.75 * (1 - i / 5);
      const x = ball.x + player.dirX * d;
      const y = ball.y + player.dirY * d;
      g.fillStyle(0xffffff, alpha);
      g.fillCircle(x, y, 5 - i * 0.6);
    }
  }

  spark(x, y, color) {
    const ring = this.add.circle(x, y, 18, color, 0).setStrokeStyle(6, color, 1).setDepth(20);
    const core = this.add.circle(x, y, 22, 0xffffff, 0.9).setDepth(20);
    this.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    this.tweens.add({ targets: core, scale: 1.8, alpha: 0, duration: 180, onComplete: () => core.destroy() });
  }
}
