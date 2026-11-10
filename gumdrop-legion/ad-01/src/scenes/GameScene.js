import Phaser from 'phaser';
import { AD, CAM, COLORS, FONT, GAME_WIDTH as W, GAME_HEIGHT as H, LEVEL, RUN } from '../config.js';
import { World, Props, project, depthFor, REF_S } from '../world/World.js';
import { Crowd } from '../game/Crowd.js';
import { GatePair, applyOp, gateIsGood, gateLabel } from '../game/Gate.js';
import { EndCard } from '../ui/EndCard.js';
import { candyText, makeLogo } from '../ui/Ui.js';
import { sfx } from '../audio/Sfx.js';
import { notifyGameEnd, openStore } from '../ad/cta.js';

const BOSS_SIZE = 1.55; // world units
const BOSS_STOP = 3.4; // crowd stops this far in front of the boss

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.state = 'intro';
    this.dist = 0;
    this.speedMul = 0;
    this.lastInputAt = this.time.now;
    this.peak = RUN.startCount;

    this.world = new World(this);
    this.props = new Props(this);

    this.crowd = new Crowd(this, { count: RUN.startCount, keys: ['p0', 'p1', 'p2'] });
    this.crowd.setLabelStyle(0x3d9bff, '#1d3d8f');

    this.gates = LEVEL.gates.map((g) => new GatePair(this, g));
    this.armies = LEVEL.enemies.map((e) => {
      const c = new Crowd(this, { count: e.count, keys: ['e0', 'e1', 'e2'], baseZ: e.z, facing: 'front' });
      c.setLabelStyle(0x7fc41f, '#3d6b00');
      c.worldZ = e.z;
      c.alive = true;
      return c;
    });
    this.buildBoss();
    this.buildHud();
    this.buildTutorial();
    this.bindInput();

    this.time.addEvent({ delay: 250, loop: true, callback: () => this.checkIdle() });
    this.cameras.main.fadeIn(350, 255, 211, 236);
    this.update(0, 16);
  }

  /* ─────────────────────────── boss ─────────────────────────── */

  buildBoss() {
    this.bossHp = LEVEL.bossHp;
    this.boss = this.add.image(0, 0, 'boss').setOrigin(0.5, 0.94);
    this.bossShadow = this.add.image(0, 0, 'shadow');
    this.crown = this.add.image(0, 0, 'crown').setOrigin(0.5, 1);
    this.bossLabel = this.add.container(0, 0);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.25);
    bg.fillRoundedRect(-82, -26, 168, 60, 30);
    bg.fillStyle(0xff4d6d, 1);
    bg.fillRoundedRect(-84, -30, 168, 60, 30);
    bg.lineStyle(4, 0xffffff, 1);
    bg.strokeRoundedRect(-84, -30, 168, 60, 30);
    this.bossHpText = this.add
      .text(8, -1, String(this.bossHp), { fontFamily: FONT, fontSize: '36px', color: '#ffffff', stroke: '#7a0f2a', strokeThickness: 7 })
      .setOrigin(0.5);
    const heart = this.add.text(-52, -1, '♥', { fontFamily: 'Arial', fontSize: '34px', color: '#ffffff' }).setOrigin(0.5);
    this.bossLabel.add([bg, heart, this.bossHpText]);
    this.bossName = candyText(this, 0, 0, 'SOUR KING', 34, { colors: ['#ffffff', '#e9ff9a', '#9be22e'], stroke: '#2f5200' });
    this.bossBob = 0;
  }

  updateBoss(dt) {
    if (!this.boss.active) return;
    const zr = LEVEL.bossZ - this.dist;
    const visible = zr < 140;
    [this.boss, this.bossShadow, this.crown, this.bossLabel, this.bossName].forEach((o) => o.setVisible(visible && !this.bossDead));
    if (!visible || this.bossDead) return;
    this.bossBob += dt;
    const p = project(0, zr);
    const size = BOSS_SIZE * p.s;
    const breathe = 1 + Math.sin(this.bossBob * 3) * 0.03;
    const base = (size / this.boss.width) * (this.bossPunch || 1);
    this.boss.setPosition(p.x, p.y).setScale(base / breathe, base * breathe).setDepth(depthFor(zr));
    this.bossShadow.setPosition(p.x, p.y).setScale((size * 1.1) / this.bossShadow.width).setDepth(depthFor(zr) - 0.5);
    const top = p.y - this.boss.displayHeight * 0.9;
    this.crown.setPosition(p.x + size * 0.02, top + size * 0.12).setScale((size * 0.42) / this.crown.width).setAngle(Math.sin(this.bossBob * 2) * 4).setDepth(depthFor(zr) + 0.1);
    const ls = Phaser.Math.Clamp(p.s / REF_S, 0.35, 1.3);
    this.bossLabel.setPosition(p.x, top - size * 0.22).setScale(ls).setDepth(1400);
    this.bossName.setPosition(p.x, top - size * 0.22 - 52 * ls).setScale(ls).setDepth(1400);
    const fade = Phaser.Math.Clamp((140 - zr) / 30, 0, 1);
    [this.boss, this.bossShadow, this.crown, this.bossLabel, this.bossName].forEach((o) => o.setAlpha(fade));
    this.bossScreen = { x: p.x, y: p.y - this.boss.displayHeight * 0.45, size };
  }

  /* ─────────────────────────── HUD ─────────────────────────── */

  buildHud() {
    const y = 64;
    const pill = this.add.graphics().setDepth(1800);
    pill.fillStyle(0x000000, 0.18);
    pill.fillRoundedRect(W / 2 - 90 + 3, y - 30 + 5, 180, 56, 28);
    pill.fillStyle(0xffffff, 1);
    pill.fillRoundedRect(W / 2 - 90, y - 30, 180, 56, 28);
    this.add.text(W / 2, y - 2, 'LEVEL 7', { fontFamily: FONT, fontSize: '28px', color: '#ff3d8b' }).setOrigin(0.5).setDepth(1801);

    // progress track
    const ty = 128;
    const tw = 460;
    this.prog = { x: W / 2 - tw / 2, y: ty, w: tw };
    const track = this.add.graphics().setDepth(1800);
    track.fillStyle(0x000000, 0.18);
    track.fillRoundedRect(this.prog.x + 2, ty - 11 + 4, tw, 22, 11);
    track.fillStyle(0xffffff, 0.9);
    track.fillRoundedRect(this.prog.x, ty - 11, tw, 22, 11);
    this.progFill = this.add.graphics().setDepth(1801);
    this.progIcon = this.add.image(this.prog.x, ty - 4, 'p0').setScale(0.55).setDepth(1803);
    this.add.image(this.prog.x + tw + 8, ty - 10, 'crown').setScale(0.3).setDepth(1802);
    this.hudItems = [pill, track, this.progFill, this.progIcon];
  }

  updateHud() {
    const pct = Phaser.Math.Clamp(this.dist / (LEVEL.bossZ - BOSS_STOP - CAM.crowdZ), 0, 1);
    const { x, y, w } = this.prog;
    this.progFill.clear();
    if (pct > 0.01) {
      this.progFill.fillStyle(0xff5fa2, 1);
      this.progFill.fillRoundedRect(x + 3, y - 8, Math.max(16, (w - 6) * pct), 16, 8);
      this.progFill.fillStyle(0xffffff, 0.35);
      this.progFill.fillRoundedRect(x + 8, y - 6, Math.max(6, (w - 16) * pct), 5, 3);
    }
    this.progIcon.x = x + w * pct;
  }

  /* ───────────────────────── tutorial ───────────────────────── */

  buildTutorial() {
    const c = this.add.container(0, 0).setDepth(1900);
    const logo = makeLogo(this, W / 2, 300, 0.85);
    const p = project(0, CAM.crowdZ);
    const hand = this.add.image(W / 2, p.y + 40, 'hand').setOrigin(0.3, 0.05).setScale(0.9);
    const track = this.add.graphics();
    track.lineStyle(10, 0xffffff, 0.75);
    track.beginPath();
    track.arc(W / 2, p.y - 190, 420, Phaser.Math.DegToRad(68), Phaser.Math.DegToRad(112));
    track.strokePath();
    const arrowL = this.add.text(W / 2 - 165, p.y + 15, '◀', { fontFamily: 'Arial', fontSize: '44px', color: '#ffffff' }).setOrigin(0.5);
    const arrowR = this.add.text(W / 2 + 165, p.y + 15, '▶', { fontFamily: 'Arial', fontSize: '44px', color: '#ffffff' }).setOrigin(0.5);
    const msg = candyText(this, W / 2, p.y + 190, 'DRAG TO LEAD\nYOUR LEGION!', 50, { colors: ['#ffffff', '#ffffff', '#ffe1f0'], stroke: '#c2246a' });
    c.add([logo, track, arrowL, arrowR, hand, msg]);
    this.tweens.add({ targets: hand, x: { from: W / 2 - 150, to: W / 2 + 150 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: msg, scale: 1.06, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tutorial = c;
  }

  hideTutorial() {
    if (!this.tutorial) return;
    const t = this.tutorial;
    this.tutorial = null;
    this.tweens.add({ targets: t, alpha: 0, duration: 250, onComplete: () => t.destroy() });
  }

  /* ─────────────────────────── input ─────────────────────────── */

  bindInput() {
    this.input.on('pointerdown', (p) => {
      sfx.unlock();
      sfx.startMusic();
      this.lastInputAt = this.time.now;
      this.dragX = p.x;
      if (this.state === 'intro') this.startRun();
    });
    this.input.on('pointermove', (p) => {
      if (!p.isDown || this.dragX == null) return;
      this.lastInputAt = this.time.now;
      const dx = p.x - this.dragX;
      this.dragX = p.x;
      if (this.state === 'run' || this.state === 'intro') {
        this.crowd.x += (dx / REF_S) * 1.25;
        this.clampCrowd();
      }
    });
    this.input.on('pointerup', () => (this.dragX = null));
  }

  clampCrowd() {
    const lim = Math.max(0.05, 1 - this.crowd.radius() * 0.85);
    this.crowd.x = Phaser.Math.Clamp(this.crowd.x, -lim, lim);
  }

  startRun() {
    this.state = 'run';
    this.hideTutorial();
    this.tweens.add({ targets: this, speedMul: 1, duration: 700, ease: 'Sine.In' });
  }

  checkIdle() {
    if (this.state === 'end') return;
    if (this.time.now - this.lastInputAt > AD.idleEndMs) this.finish(false, true);
    // no input for a while in intro → just start, the ad must move
    if (this.state === 'intro' && this.time.now - this.lastInputAt > 6000) this.startRun();
  }

  /* ─────────────────────────── loop ─────────────────────────── */

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    if (this.state === 'run') this.dist += RUN.speed * this.speedMul * dt;

    this.world.update(this.dist, dt);
    this.props.update(this.dist);

    // gates
    for (const gate of this.gates) {
      const zr = gate.update(this.dist);
      if (!gate.used && this.state === 'run' && zr <= CAM.crowdZ) this.passGate(gate);
    }

    // enemy armies
    for (const army of this.armies) {
      if (!army.alive) continue;
      if (army.rushing) army.worldZ -= dt * (this.state === 'battle' ? 3.5 : 6);
      army.baseZ = army.worldZ - this.dist;
      const gap = army.frontZ() - this.crowd.backZ();
      if (!army.rushing && this.state === 'run' && army.baseZ - CAM.crowdZ < 9) {
        army.rushing = true;
        sfx.clash();
      }
      if (this.state === 'run' && army.rushing && gap < -0.1) this.startBattle(army);
      if (this.state === 'battle' && this.battleArmy === army) army.worldZ = Math.max(army.worldZ, this.dist + this.crowd.backZ() - 0.25 + (army.baseZ - army.frontZ()));
      army.update(dt, { running: army.rushing });
      const vis = army.baseZ < 140;
      army.members.forEach((m) => {
        m.spr.setVisible(vis);
        m.shadow.setVisible(vis);
      });
      // label only once they're close enough to read
      army.label.setVisible(army.count > 0 && army.baseZ < 55);
      army.label.setScale(Phaser.Math.Clamp(project(0, army.baseZ).s / REF_S + 0.3, 0.55, 1));
    }

    this.updateBoss(dt);
    if (this.state === 'run' && LEVEL.bossZ - this.dist - CAM.crowdZ <= BOSS_STOP) this.startBoss();

    this.crowd.update(dt, { running: this.state === 'run' || this.state === 'intro' ? this.speedMul > 0.2 : this.state === 'battle' });
    this.updateHud();
  }

  /* ─────────────────────────── gates ─────────────────────────── */

  passGate(gate) {
    const side = this.crowd.x < 0 ? 'left' : 'right';
    const opt = gate.trigger(side);
    const before = this.crowd.count;
    const after = applyOp(before, opt);
    const diff = after - before;
    const isGood = gateIsGood(opt);
    sfx.gate(isGood);
    const p = project(this.crowd.x, CAM.crowdZ);
    this.floatText(gateLabel(opt), p.x, p.y - 150, isGood ? ['#ffffff', '#bfe6ff', '#4fb8ff'] : ['#ffffff', '#ffc2cf', '#ff4d6d'], isGood ? '#0b4f93' : '#8a1430');
    if (diff > 0) {
      this.crowd.add(diff);
      const n = Math.min(diff, 18);
      for (let i = 0; i < n; i++) this.time.delayedCall(i * 30, () => sfx.pop(1 + i * 0.05));
      this.sparkleBurst(p.x, p.y - 30, 0x8fd3ff, 22);
      this.cameras.main.zoomTo(1.035, 120, 'Sine.easeOut', true, (cam, prog) => prog === 1 && cam.zoomTo(1, 260));
    } else if (diff < 0) {
      this.crowd.remove(-diff).forEach((r, i) => this.time.delayedCall(i * 20, () => this.poof(r.x, r.y, 0xff8aa8)));
      this.cameras.main.shake(180, 0.006);
    }
    this.peak = Math.max(this.peak, this.crowd.count);
    this.clampCrowd();
    if (this.crowd.count <= 0) this.finish(false);
  }

  /* ─────────────────────────── battle ─────────────────────────── */

  startBattle(army) {
    this.state = 'battle';
    this.battleArmy = army;
    sfx.clash();
    this.cameras.main.shake(220, 0.007);
    this.battleTimer = this.time.addEvent({
      delay: 70,
      loop: true,
      callback: () => {
        if (army.count <= 0 || this.crowd.count <= 0) {
          this.battleTimer.remove();
          this.endBattle(army);
          return;
        }
        const k = army.count > 30 && this.crowd.count > 30 ? 2 : 1;
        army.remove(k).forEach((r) => this.poof(r.x, r.y, 0xc6f36b));
        this.crowd.remove(k).forEach((r) => {
          this.poof(r.x, r.y, 0x9fd2ff);
          if (Math.random() < 0.5) this.sparkleBurst(r.x, r.y, 0xffe36b, 4);
        });
        sfx.squish();
      },
    });
  }

  endBattle(army) {
    army.alive = false;
    army.destroy();
    if (this.crowd.count <= 0) {
      this.finish(false);
      return;
    }
    const p = project(this.crowd.x, CAM.crowdZ);
    this.floatText('CRUSHED!', W / 2, p.y - 220, ['#ffffff', '#fff1a8', '#ffc94d'], '#6b1458', 64);
    sfx.pop(1.6);
    this.state = 'run';
  }

  /* ─────────────────────────── boss ─────────────────────────── */

  startBoss() {
    this.state = 'boss';
    this.cameras.main.zoomTo(1.07, 600, 'Sine.easeInOut');
    sfx.musicVolume(0.75);
    this.floatText('ATTACK!', W / 2, 250, ['#ffffff', '#ffe36b', '#ff9a1f'], '#6b1458', 72);
    this.time.delayedCall(450, () => {
      this.bossTimer = this.time.addEvent({ delay: 55, loop: true, callback: () => this.flingOne() });
    });
  }

  flingOne() {
    if (this.bossDead || this.state !== 'boss') return;
    if (this.crowd.count <= 0) {
      this.bossTimer.remove();
      if (this.bossHp > 0) this.time.delayedCall(700, () => this.bossHp > 0 && this.finish(false));
      return;
    }
    let spr = this.crowd.takeOne();
    const from = project(this.crowd.x, CAM.crowdZ);
    if (!spr) spr = this.add.image(from.x, from.y - 30, 'p0').setScale(0.4);
    const target = this.bossScreen;
    if (!target) return;
    const sx = spr.x;
    const sy = spr.y;
    const tx = target.x + (Math.random() - 0.5) * target.size * 0.5;
    const ty = target.y + (Math.random() - 0.5) * target.size * 0.3;
    const s0 = spr.scaleX;
    spr.setDepth(1300);
    const o = { t: 0 };
    this.tweens.add({
      targets: o,
      t: 1,
      duration: 340,
      ease: 'Sine.In',
      onUpdate: () => {
        spr.x = sx + (tx - sx) * o.t;
        spr.y = sy + (ty - sy) * o.t - Math.sin(o.t * Math.PI) * 160;
        spr.setScale(s0 * (1 - o.t * 0.35));
        spr.angle = o.t * 360;
      },
      onComplete: () => {
        spr.destroy();
        this.hitBoss(tx, ty);
      },
    });
  }

  hitBoss(x, y) {
    if (this.bossDead) return;
    this.bossHp -= 1;
    this.bossHpText.setText(String(Math.max(0, this.bossHp)));
    sfx.bossHit();
    this.poof(x, y, 0x9fd2ff);
    this.bossPunch = 0.93;
    this.tweens.add({ targets: this, bossPunch: 1, duration: 140, ease: 'Back.Out' });
    this.boss.setTintFill(0xffffff);
    this.time.delayedCall(40, () => this.boss.clearTint());
    if (this.bossHp <= 0) this.defeatBoss();
  }

  defeatBoss() {
    this.bossDead = true;
    this.bossTimer?.remove();
    sfx.bossPop();
    const { x, y, size } = this.bossScreen;
    this.cameras.main.shake(500, 0.012);
    this.cameras.main.flash(200, 255, 255, 255);
    // juice explosion
    const p = this.add
      .particles(x, y, 'dot', {
        speed: { min: 200, max: 900 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.6, end: 0 },
        lifespan: 900,
        gravityY: 900,
        tint: [0x9be22e, 0xd9ff6b, 0xffffff, 0xffd34d],
        emitting: false,
      })
      .setDepth(1350);
    p.explode(90);
    const crownFly = this.add.image(this.crown.x, this.crown.y, 'crown').setScale(this.crown.scale).setDepth(1360);
    this.tweens.add({ targets: crownFly, y: crownFly.y - 260, angle: 540, duration: 900, ease: 'Cubic.Out' });
    this.tweens.add({ targets: crownFly, y: { from: crownFly.y - 260, to: H + 200 }, delay: 900, duration: 700, ease: 'Cubic.In' });
    [this.boss, this.bossShadow, this.crown, this.bossLabel, this.bossName].forEach((o) => o.setVisible(false));
    this.time.delayedCall(1200, () => p.destroy());
    this.crowd.hop = 2.2;
    this.time.delayedCall(600, () => this.finish(true));
    void size;
  }

  /* ─────────────────────────── FX ─────────────────────────── */

  floatText(str, x, y, colors, stroke, size = 84) {
    const t = candyText(this, x, y, str, size, { colors, stroke }).setDepth(1700);
    t.setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: y - 90, alpha: 0, delay: 500, duration: 500, ease: 'Cubic.In', onComplete: () => t.destroy() });
  }

  poof(x, y, tint) {
    const p = this.add.image(x, y, 'puff').setTint(tint).setScale(0.35).setDepth(1290).setAlpha(0.95);
    this.tweens.add({ targets: p, scale: 0.9, alpha: 0, duration: 300, ease: 'Cubic.Out', onComplete: () => p.destroy() });
  }

  sparkleBurst(x, y, tint, n) {
    const p = this.add
      .particles(x, y, 'sparkle', {
        speed: { min: 120, max: 420 },
        angle: { min: 200, max: 340 },
        scale: { start: 0.7, end: 0 },
        lifespan: 600,
        gravityY: 500,
        tint: [tint, 0xffffff],
        emitting: false,
      })
      .setDepth(1310);
    p.explode(n);
    this.time.delayedCall(700, () => p.destroy());
  }

  /* ─────────────────────────── end ─────────────────────────── */

  finish(won, idle = false) {
    if (this.state === 'end') return;
    this.state = 'end';
    this.hideTutorial();
    this.battleTimer?.remove();
    this.bossTimer?.remove();
    notifyGameEnd();
    if (won) sfx.win();
    else if (!idle) sfx.lose();
    sfx.musicVolume(0.3, 1);
    this.cameras.main.zoomTo(1, 400);
    const delay = won ? 900 : idle ? 0 : 700;
    if (!won && !idle) this.floatText('DEFEATED', W / 2, 560, ['#ffffff', '#ffc2cf', '#ff4d6d'], '#7a0f2a', 80);
    this.time.delayedCall(delay, () => {
      this.endCard = new EndCard(this, {
        won,
        legion: this.peak,
        onReplay: () => {
          sfx.musicVolume(0.55);
          this.scene.restart();
        },
      });
    });
    void openStore;
    void COLORS;
  }
}
