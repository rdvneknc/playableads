import Phaser from 'phaser';
import { ACTOR, BALL, BOT, GOAL, PITCH, SHOULDER } from '../config.js';

// AI for any non-human actor. attackSign: +1 attacks RIGHT (player team), -1 attacks LEFT (bot team).
// lane: -1 prefer top, +1 prefer bottom — keeps 2v2 partners from stacking.
export class BotBrain {
  constructor(match, bot, { attackSign, lane = 0, canBoost = false } = {}) {
    this.match = match;
    this.bot = bot;
    this.attackSign = attackSign;
    this.lane = lane;
    this.canBoost = canBoost;
    this.nextThinkAt = 0;
    this.target = { x: bot.x, y: bot.y };
    this.aimOffset = 0;
    this.hadBall = false;
    this.dodgeSide = 0;
    this.mode = 'idle';
  }

  reset() {
    this.nextThinkAt = 0;
    this.hadBall = false;
    this.dodgeSide = 0;
    this.mode = 'idle';
  }

  get foes() {
    return this.match.actors.filter((a) => a.enabled && a.team !== this.bot.team);
  }

  get mates() {
    return this.match.actors.filter((a) => a.enabled && a.team === this.bot.team && a !== this.bot);
  }

  nearestFoe() {
    let best = null;
    let bestD = Infinity;
    for (const f of this.foes) {
      const d = this.bot.distanceTo(f);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }

  homeGoalX() {
    return this.attackSign > 0 ? PITCH.left : PITCH.right;
  }

  foeGoalX() {
    return this.attackSign > 0 ? PITCH.right + 24 : PITCH.left - 24;
  }

  step() {
    const { bot } = this;
    const { ball, clock } = this.match;

    if (!bot.enabled || !this.match.canMove || bot.stunned || bot.charging || bot.dashing) {
      bot.intent.mx = bot.intent.my = 0;
      return;
    }

    const hasBall = ball.owner === bot;
    if (hasBall && !this.hadBall) {
      this.dodgeSide = 0;
      this.aimOffset = Phaser.Math.FloatBetween(-1, 1) * (GOAL.halfWidth - BALL.radius - 16);
      this.nextThinkAt = clock.now + BOT.reactionMs;
    }
    this.hadBall = hasBall;

    if (clock.now >= this.nextThinkAt) {
      this.nextThinkAt = clock.now + BOT.reactionMs * Phaser.Math.FloatBetween(0.7, 1.3);
      this.think(hasBall);
    }

    if (hasBall) this.steerAttack();
    else this.steerTo(this.target.x, this.target.y);
  }

  think(hasBall) {
    const { bot } = this;
    const { ball } = this.match;
    const opp = this.nearestFoe();

    if (this.canBoost) this.considerBoost(hasBall, opp);

    if (hasBall) {
      this.mode = 'attack';
      this.considerShot(opp);
      return;
    }

    const oppHasBall = ball.owner && ball.owner.team !== bot.team;
    const distOpp = opp ? bot.distanceTo(opp) : 9999;

    if (
      opp &&
      bot.cooldowns.shoulder.ready &&
      distOpp < SHOULDER.range * 0.9 &&
      (oppHasBall || (ball.owner === null && opp.distanceTo(ball) < bot.distanceTo(ball)))
    ) {
      if (Math.random() < (oppHasBall ? BOT.shoulderChance : BOT.shoulderChance * 0.4)) {
        this.match.tryShoulder(bot);
        return;
      }
    }

    if (oppHasBall) {
      this.mode = 'defend';
      this.planDefense(opp, distOpp);
    } else if (ball.owner && ball.owner.team === bot.team) {
      this.mode = 'support';
      this.planSupport();
    } else {
      this.mode = 'chase';
      this.planChase();
    }
  }

  considerBoost(hasBall, opp) {
    const { bot } = this;
    const { ball } = this.match;
    if (!bot.cooldowns.super.ready || bot.boosting) return;

    const distBall = bot.distanceTo(ball);
    const distOpp = opp ? bot.distanceTo(opp) : 9999;
    const racingForLoose =
      !ball.owner && distBall > BOT.boostChaseDist && (!opp || distBall < opp.distanceTo(ball) + 40);
    const chasingCarrier = ball.owner && ball.owner.team !== bot.team && distOpp > 90 && distOpp < 320;
    const goalDist = Math.hypot(this.foeGoalX() - ball.x, PITCH.midY - ball.y);
    const burstingAttack = hasBall && goalDist < BOT.boostAttackDist;
    const pressuredCarry = hasBall && opp && distOpp < 130;

    if (racingForLoose || chasingCarrier || burstingAttack || pressuredCarry) {
      this.match.tryBoost(bot);
    }
  }

  planSupport() {
    const { bot } = this;
    const { ball } = this.match;
    const carrier = ball.owner;
    const laneY = PITCH.midY + this.lane * 110;
    // Stay wide ahead of the carrier toward the foe goal
    const ahead = this.attackSign * 140;
    this.target.x = Phaser.Math.Clamp((carrier?.x ?? ball.x) + ahead, PITCH.left + 40, PITCH.right - 40);
    this.target.y = Phaser.Math.Clamp(laneY * 0.55 + (carrier?.y ?? ball.y) * 0.45, PITCH.top + 40, PITCH.bottom - 40);
    // Don't crowd the carrier
    if (carrier && bot.distanceTo(carrier) < 90) {
      this.target.x = carrier.x + this.attackSign * 40;
      this.target.y = laneY;
    }
  }

  planDefense(opp, distOpp) {
    const { bot } = this;
    const { ball } = this.match;
    const threat = ball.owner && ball.owner.team !== bot.team ? ball.owner : opp;
    if (!threat) {
      this.planChase();
      return;
    }

    // One defender presses, the other covers goal — based on who is closer
    const matesCloser = this.mates.some((m) => m.distanceTo(threat) + 25 < bot.distanceTo(threat));
    if (!matesCloser && distOpp < BOT.pressDistance + 40) {
      this.target.x = ball.x;
      this.target.y = ball.y;
      return;
    }

    const gx = this.homeGoalX();
    const gy = PITCH.midY;
    const dx = gx - threat.x;
    const dy = gy - threat.y;
    const len = Math.hypot(dx, dy) || 1;
    const mark = Math.min(120, len * 0.45);
    this.target.x = threat.x + (dx / len) * mark;
    this.target.y = Phaser.Math.Clamp(
      threat.y + (dy / len) * mark + this.lane * 50,
      PITCH.top + 40,
      PITCH.bottom - 40,
    );
  }

  planChase() {
    const { bot } = this;
    const { ball } = this.match;

    // Teammate already closer → fan out instead of stacking
    const mateCloser = this.mates.some((m) => m.distanceTo(ball) + 35 < bot.distanceTo(ball));
    if (mateCloser) {
      this.planSupport();
      this.target.x = Phaser.Math.Clamp(ball.x - this.attackSign * 80, PITCH.left + 40, PITCH.right - 40);
      this.target.y = Phaser.Math.Clamp(PITCH.midY + this.lane * 120, PITCH.top + 40, PITCH.bottom - 40);
      return;
    }

    // Cut off a shot heading for our goal
    const towardHome = this.attackSign > 0 ? ball.vx < -300 : ball.vx > 300;
    if (towardHome) {
      const home = this.homeGoalX();
      const lineX = Phaser.Math.Clamp(bot.x, Math.min(ball.x, home) + 20, Math.max(ball.x, home) - 20);
      if (Math.abs(ball.vx) > 1) {
        const crossY = ball.y + (ball.vy * (lineX - ball.x)) / ball.vx;
        const goalY = ball.y + (ball.vy * (home - ball.x)) / ball.vx;
        if (Math.abs(goalY - PITCH.midY) < GOAL.halfWidth + 40) {
          this.target.x = lineX;
          this.target.y = Phaser.Math.Clamp(crossY, PITCH.top + 40, PITCH.bottom - 40);
          return;
        }
      }
    }

    const t = Math.min(0.7, bot.distanceTo(ball) / ACTOR.speed);
    const k = BALL.friction;
    const travel = (1 - Math.exp(-k * t)) / k;
    const px = Phaser.Math.Clamp(ball.x + ball.vx * travel, PITCH.left + 20, PITCH.right - 20);
    const py = Phaser.Math.Clamp(ball.y + ball.vy * travel, PITCH.top + 20, PITCH.bottom - 20);
    // Approach from own-goal side, with lane bias
    this.target.x = px - this.attackSign * 22;
    this.target.y = py + this.lane * 18;
  }

  aimPoint() {
    return { x: this.foeGoalX(), y: PITCH.midY + this.aimOffset };
  }

  steerAttack() {
    const { bot } = this;
    const { ball } = this.match;
    const opp = this.nearestFoe();
    const aim = this.aimPoint();
    let dx = aim.x - ball.x;
    let dy = aim.y - ball.y;
    let len = Math.hypot(dx, dy) || 1;
    let mx = dx / len;
    let my = dy / len;

    if (opp) {
      const ox = opp.x - bot.x;
      const oy = opp.y - bot.y;
      const oDist = Math.hypot(ox, oy);
      const ahead = ox * mx + oy * my;
      const lateral = ox * -my + oy * mx;
      const range = 340;
      if (ahead > -10 && oDist < range && Math.abs(lateral) < 140) {
        const px = -my;
        const py = mx;
        if (this.dodgeSide === 0) this.dodgeSide = this.chooseDodgeSide(py, lateral);
        const w = (1 - oDist / range) * 2.2 + 0.35;
        mx += px * this.dodgeSide * w;
        my += py * this.dodgeSide * w;
      } else if (ahead < -20 || oDist > range + 40) {
        this.dodgeSide = 0;
      }
    }

    const edge = 60;
    if (bot.y < PITCH.top + edge) my += 0.6;
    if (bot.y > PITCH.bottom - edge) my -= 0.6;

    len = Math.hypot(mx, my) || 1;
    bot.intent.mx = mx / len;
    bot.intent.my = my / len;
  }

  chooseDodgeSide(py, lateral) {
    if (Math.abs(lateral) >= 30) return lateral >= 0 ? -1 : 1;
    if (this.lane !== 0) return this.lane;
    const off = this.bot.y - PITCH.midY;
    if (Math.abs(off) < 40) return Math.random() < 0.5 ? 1 : -1;
    return py * -off >= 0 ? 1 : -1;
  }

  steerTo(tx, ty) {
    const { bot } = this;
    const dx = tx - bot.x;
    const dy = ty - bot.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) {
      bot.intent.mx = bot.intent.my = 0;
      return;
    }
    const arrive = Math.min(1, dist / 60);
    bot.intent.mx = (dx / dist) * arrive;
    bot.intent.my = (dy / dist) * arrive;
  }

  laneBlocked(fromX, fromY, toX, toY) {
    for (const opp of this.foes) {
      const dx = toX - fromX;
      const dy = toY - fromY;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1) continue;
      const t = ((opp.x - fromX) * dx + (opp.y - fromY) * dy) / len2;
      if (t < 0 || t > 1) continue;
      const cx = fromX + dx * t;
      const cy = fromY + dy * t;
      if (Math.hypot(opp.x - cx, opp.y - cy) < ACTOR.radius + BALL.radius + 8) return true;
    }
    return false;
  }

  considerShot(opp) {
    const { bot } = this;
    const { ball } = this.match;
    const aim = this.aimPoint();
    const dist = Math.hypot(aim.x - ball.x, aim.y - ball.y);
    const angleToAim = Math.atan2(aim.y - ball.y, aim.x - ball.x);
    const err = Math.abs(Phaser.Math.Angle.Wrap(angleToAim - bot.heading));
    const blocked = this.laneBlocked(ball.x, ball.y, aim.x, aim.y);
    const pressured = opp && bot.distanceTo(opp) < 105;

    const shoot = () => {
      const a = angleToAim + Phaser.Math.FloatBetween(-BOT.aimError, BOT.aimError);
      this.match.tryShoot(bot, false, Math.cos(a), Math.sin(a));
    };

    if (dist < BOT.shootDistance && err < 0.45 && !blocked) {
      shoot();
    } else if (dist < 240 && err < 0.75) {
      shoot();
    } else if (pressured && dist < 300 && err < 0.7) {
      shoot();
    }
  }
}
