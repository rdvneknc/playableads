import Phaser from 'phaser';
import { PITCH, GOAL, PHYSICS, COLORS, GAME_WIDTH, GAME_HEIGHT } from '../config.js';

// Landscape pitch: goals on the LEFT and RIGHT ends.
// Player attacks the right goal; bot attacks the left goal.
export class Pitch {
  constructor(scene) {
    this.scene = scene;
    this.segments = [];
    this.nets = {};

    this.drawGround();
    this.buildColliders();
    // Left goal = blue team's; right goal = red team's
    this.nets.left = this.drawGoal(PITCH.left, -1, {
      mid: COLORS.goalBlue,
      deep: COLORS.goalBlueDeep,
      hi: COLORS.goalBlueHi,
      net: 0xeaf6ff,
    });
    this.nets.right = this.drawGoal(PITCH.right, 1, {
      mid: COLORS.goalRed,
      deep: COLORS.goalRedDeep,
      hi: COLORS.goalRedHi,
      net: 0xffe8e0,
    });
  }

  drawGround() {
    // Provided grass art as the floor only — lines / boxes stay drawn above
    this.scene.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'grass')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(0);

    const g = this.scene.add.graphics().setDepth(1);

    g.fillStyle(0x000000, 0.08);
    g.fillRect(0, 0, GAME_WIDTH, PITCH.top);
    g.fillRect(0, PITCH.bottom, GAME_WIDTH, GAME_HEIGHT - PITCH.bottom);
    g.fillRect(0, PITCH.top, PITCH.left, PITCH.bottom - PITCH.top);
    g.fillRect(PITCH.right, PITCH.top, GAME_WIDTH - PITCH.right, PITCH.bottom - PITCH.top);

    const { left, right, top, bottom } = PITCH;
    const cx = PITCH.cx;
    const cy = PITCH.midY;
    const gap = GOAL.halfWidth;

    // Sidelines + end lines with mouth gaps
    g.lineStyle(4, COLORS.line, 0.95);
    g.beginPath();
    g.moveTo(left, cy - gap);
    g.lineTo(left, top);
    g.lineTo(right, top);
    g.lineTo(right, cy - gap);
    g.moveTo(right, cy + gap);
    g.lineTo(right, bottom);
    g.lineTo(left, bottom);
    g.lineTo(left, cy + gap);
    g.strokePath();

    g.lineStyle(4, COLORS.line, 0.7);
    g.lineBetween(left, cy - gap, left, cy + gap);
    g.lineBetween(right, cy - gap, right, cy + gap);

    g.lineStyle(4, COLORS.line, 0.95);
    const arcR = 26;
    g.beginPath();
    g.arc(left, top, arcR, 0, Math.PI / 2, false);
    g.strokePath();
    g.beginPath();
    g.arc(right, top, arcR, Math.PI / 2, Math.PI, false);
    g.strokePath();
    g.beginPath();
    g.arc(left, bottom, arcR, -Math.PI / 2, 0, false);
    g.strokePath();
    g.beginPath();
    g.arc(right, bottom, arcR, Math.PI, Math.PI * 1.5, false);
    g.strokePath();

    // Halfway line + center circle
    g.lineBetween(cx, top, cx, bottom);
    g.strokeCircle(cx, cy, PITCH.centerRadius);
    g.fillStyle(COLORS.line, 1);
    g.fillCircle(cx, cy, 5);

    const boxD = Math.min(160, (right - left) * 0.16);
    const boxH = Math.min(260, (bottom - top) * 0.55);
    g.strokeRect(left, cy - boxH / 2, boxD, boxH);
    g.strokeRect(right - boxD, cy - boxH / 2, boxD, boxH);

    const sixD = Math.min(70, boxD * 0.45);
    const sixH = Math.min(140, boxH * 0.55);
    g.strokeRect(left, cy - sixH / 2, sixD, sixH);
    g.strokeRect(right - sixD, cy - sixH / 2, sixD, sixH);

    const spot = 24;
    g.fillCircle(left + boxD - spot, cy, 4);
    g.fillCircle(right - boxD + spot, cy, 4);
    g.beginPath();
    g.arc(left + boxD - spot, cy, 42, Phaser.Math.DegToRad(-55), Phaser.Math.DegToRad(55), false);
    g.strokePath();
    g.beginPath();
    g.arc(right - boxD + spot, cy, 42, Phaser.Math.DegToRad(125), Phaser.Math.DegToRad(235), false);
    g.strokePath();
  }

  // dir = -1 → net extends left, +1 → net extends right
  drawGoal(mouthX, dir, colors) {
    const scene = this.scene;
    const hw = GOAL.halfWidth;
    const depth = GOAL.depth;
    const post = GOAL.postRadius * 2;
    const cy = PITCH.midY;

    const netContainer = scene.add.container(mouthX, cy).setDepth(2);
    const net = scene.add.graphics();
    net.fillStyle(0x000000, 0.2);
    net.fillRoundedRect(dir < 0 ? -depth + 4 : 4, -hw - 2, depth, hw * 2 + 4, 8);
    net.fillStyle(colors.net, 0.45);
    net.fillRect(dir < 0 ? -depth : 0, -hw, depth, hw * 2);

    net.lineStyle(1.5, 0xffffff, 0.75);
    const x0 = dir < 0 ? -depth : 0;
    for (let x = x0 + 8; x <= x0 + depth - 6; x += 10) {
      net.lineBetween(x, -hw + 4, x, hw - 4);
    }
    for (let y = -hw + 8; y <= hw - 4; y += 11) {
      net.lineBetween(x0 + 4, y, x0 + depth - 2, y);
    }
    netContainer.add(net);

    const frame = scene.add.graphics().setDepth(9);
    const top = cy - hw;
    const bot = cy + hw;
    const backX = mouthX + dir * depth;

    // Side rails + back bar only — no posts standing in front of the mouth
    this.strokeTube(frame, mouthX, top, backX, top, post, colors.deep, colors.hi);
    this.strokeTube(frame, mouthX, bot, backX, bot, post, colors.deep, colors.hi);
    this.strokeTube(frame, backX, top, backX, bot, post - 2, colors.mid, colors.hi);

    for (const [jx, jy] of [
      [backX, top],
      [backX, bot],
    ]) {
      frame.fillStyle(colors.mid, 1);
      frame.fillCircle(jx, jy, GOAL.postRadius * 1.3);
      frame.fillStyle(colors.hi, 0.8);
      frame.fillCircle(jx - 2, jy - 2, GOAL.postRadius * 0.45);
    }

    return netContainer;
  }

  strokeTube(g, x1, y1, x2, y2, thickness, color, highlight, alpha = 1) {
    g.lineStyle(thickness, color, alpha);
    g.lineBetween(x1, y1, x2, y2);
    g.lineStyle(Math.max(2, thickness * 0.32), highlight, 0.55 * alpha);
    g.lineBetween(x1, y1, x2, y2);
  }

  shakeNet(side) {
    const net = this.nets[side];
    if (!net) return;
    this.scene.tweens.killTweensOf(net);
    net.setScale(1);
    this.scene.tweens.add({
      targets: net,
      scaleX: 1.14,
      scaleY: 1.03,
      duration: 90,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.InOut',
      onComplete: () => net.setScale(1),
    });
  }

  buildColliders() {
    const { left, right, top, bottom } = PITCH;
    const cy = PITCH.midY;
    const hw = GOAL.halfWidth;
    const d = GOAL.depth;
    const wall = { restitution: PHYSICS.wallRestitution, friction: 0.92, kind: 'wall' };
    const net = { restitution: GOAL.netRestitution, friction: GOAL.netFriction, kind: 'net' };
    const seg = (ax, ay, bx, by, props) => this.segments.push({ ax, ay, bx, by, ...props });

    // Sidelines (full)
    seg(left, top, right, top, wall);
    seg(left, bottom, right, bottom, wall);

    // End lines with mouth gaps
    seg(left, top, left, cy - hw, wall);
    seg(left, cy + hw, left, bottom, wall);
    seg(right, top, right, cy - hw, wall);
    seg(right, cy + hw, right, bottom, wall);

    for (const [mouthX, dir] of [
      [left, -1],
      [right, 1],
    ]) {
      const backX = mouthX + dir * d;
      seg(mouthX, cy - hw, backX, cy - hw, net);
      seg(mouthX, cy + hw, backX, cy + hw, net);
      seg(backX, cy - hw, backX, cy + hw, net);
      // No circular posts at the mouth — they sat in front of the goal and blocked shots
    }
  }

  collideBall(ball) {
    let hit = null;
    const r = ball.radius;

    for (const s of this.segments) {
      const abx = s.bx - s.ax;
      const aby = s.by - s.ay;
      const len2 = abx * abx + aby * aby;
      let t = ((ball.x - s.ax) * abx + (ball.y - s.ay) * aby) / len2;
      t = Phaser.Math.Clamp(t, 0, 1);
      const qx = s.ax + abx * t;
      const qy = s.ay + aby * t;
      const impact = this.resolveCircle(ball, qx, qy, r, s.restitution, s.friction);
      if (impact !== null && (!hit || impact > hit.speed)) hit = { kind: s.kind, speed: impact };
    }

    this.enforceBounds(ball);
    return hit;
  }

  enforceBounds(ball) {
    const r = ball.radius;
    const e = PHYSICS.wallRestitution;
    const cy = PITCH.midY;
    const hw = GOAL.halfWidth;
    const inGoal = ball.x < PITCH.left || ball.x > PITCH.right;

    const minY = inGoal ? cy - hw + r : PITCH.top + r;
    const maxY = inGoal ? cy + hw - r : PITCH.bottom - r;
    if (ball.y < minY) {
      ball.y = minY;
      if (ball.vy < 0) ball.vy = -ball.vy * e;
    } else if (ball.y > maxY) {
      ball.y = maxY;
      if (ball.vy > 0) ball.vy = -ball.vy * e;
    }

    const inMouth = Math.abs(ball.y - cy) < hw;
    const minX = inMouth ? PITCH.left - GOAL.depth + r : PITCH.left + r;
    const maxX = inMouth ? PITCH.right + GOAL.depth - r : PITCH.right - r;
    if (ball.x < minX) {
      ball.x = minX;
      if (ball.vx < 0) ball.vx = -ball.vx * e;
    } else if (ball.x > maxX) {
      ball.x = maxX;
      if (ball.vx > 0) ball.vx = -ball.vx * e;
    }
  }

  resolveCircle(ball, qx, qy, minDist, restitution, friction) {
    let dx = ball.x - qx;
    let dy = ball.y - qy;
    const dist2 = dx * dx + dy * dy;
    if (dist2 >= minDist * minDist) return null;

    let dist = Math.sqrt(dist2);
    if (dist < 0.0001) {
      dx = ball.x < PITCH.cx ? 1 : -1;
      dy = 0;
      dist = 1;
    }
    const nx = dx / dist;
    const ny = dy / dist;

    ball.x = qx + nx * minDist;
    ball.y = qy + ny * minDist;

    const vn = ball.vx * nx + ball.vy * ny;
    if (vn >= 0) return 0;

    const tx = ball.vx - vn * nx;
    const ty = ball.vy - vn * ny;
    ball.vx = tx * friction - vn * restitution * nx;
    ball.vy = ty * friction - vn * restitution * ny;
    return -vn;
  }

  isInsideGoal(ball) {
    if (Math.abs(ball.y - PITCH.midY) >= GOAL.halfWidth) return false;
    return ball.x < PITCH.left || ball.x > PITCH.right;
  }

  // Whole ball past the goal line between the posts.
  checkGoal(ball) {
    const inMouth = Math.abs(ball.y - PITCH.midY) < GOAL.halfWidth;
    if (!inMouth) return null;
    if (ball.x + ball.radius < PITCH.left) return 'left';
    if (ball.x - ball.radius > PITCH.right) return 'right';
    return null;
  }

  clampActor(actor) {
    const r = actor.radius;
    const minX = PITCH.left + r;
    const maxX = PITCH.right - r;
    const minY = PITCH.top + r;
    const maxY = PITCH.bottom - r;

    if (actor.x < minX) {
      actor.x = minX;
      actor.bounceX(1);
    } else if (actor.x > maxX) {
      actor.x = maxX;
      actor.bounceX(-1);
    }
    if (actor.y < minY) {
      actor.y = minY;
      actor.bounceY(1);
    } else if (actor.y > maxY) {
      actor.y = maxY;
      actor.bounceY(-1);
    }
  }
}
