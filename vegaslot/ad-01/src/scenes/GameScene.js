import Phaser from 'phaser';
import { AD, COLORS, FONT, FONT_UI, GAME_WIDTH, GAME_HEIGHT, PAYOUT, SLOT } from '../config.js';
import { Cabinet } from '../game/Cabinet.js';
import { SlotMachine } from '../game/SlotMachine.js';
import { EndCard } from '../ui/EndCard.js';
import { BonusWheel } from '../ui/BonusWheel.js';
import { sfx } from '../audio/Sfx.js';
import { notifyGameEnd, openStore } from '../ad/cta.js';

const W = GAME_WIDTH;
const H = GAME_HEIGHT;
const fmt = (n) => Math.round(n).toLocaleString('en-US');

const L = {
  hudY: 74,
  meterY: 166,
  cabinetY: 548,
  hintY: 924,
  spinY: 1022,
  powerY: 1094,
  ctaY: 1170,
  disclaimerY: 1250,
};

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.spinsDone = 0;
    this.inBonus = false;
    this.ended = false;
    this.endCard = null;
    this.balance = 1000;
    this.displayBalance = this.balance;
    this.bet = 50;
    this.meter = 0;
    this.totalWon = 0;
    this.charging = false;
    this.chargeLevel = 0;
    this.lastInputAt = this.time.now;

    this.drawBackdrop();
    this.cabinet = new Cabinet(this, W / 2, L.cabinetY);
    this.machine = new SlotMachine(this, this.cabinet.window);
    this.fxLayer = this.add.container(0, 0).setDepth(60);

    this.buildHud();
    this.buildControls();
    this.buildTapHint();

    this.machine.handlers.onTapReel = (i) => this.onTapReel(i);

    this.input.on('pointerdown', () => {
      sfx.unlock();
      this.lastInputAt = this.time.now;
      this.hideTapHint();
    });

    this.time.addEvent({ delay: 250, loop: true, callback: () => this.checkIdle() });
    this.setHint(`${AD.maxSpins} FREE SPINS — TAP SPIN!`, '#ffd56a');
    this.playIntro();
  }

  playIntro() {
    const cam = this.cameras.main;
    cam.fadeIn(400, 10, 6, 20);
    cam.setZoom(1.12);
    cam.zoomTo(1, 700, 'Cubic.easeOut');
    this.hud.forEach((o) => {
      const y = o.y;
      o.y = y - 160;
      this.tweens.add({ targets: o, y, duration: 650, delay: 250, ease: 'Back.Out' });
    });
    [this.spinBtn, ...this.betButtons, this.ctaBtn].forEach((o, i) => {
      const y = o.y;
      o.y = y + 260;
      this.tweens.add({ targets: o, y, duration: 650, delay: 350 + i * 60, ease: 'Back.Out' });
    });
    // A quick sparkle burst over the logo once things settle
    this.time.delayedCall(800, () => {
      const p = this.add
        .particles(W / 2, this.cabinet.oy + 63, 'sparkle', {
          x: { min: -150, max: 150 },
          y: { min: -20, max: 20 },
          lifespan: 600,
          scale: { start: 0.7, end: 0 },
          tint: [COLORS.gold, 0xffffff],
          blendMode: 'ADD',
          emitting: false,
        })
        .setDepth(20);
      p.explode(18);
      this.time.delayedCall(800, () => p.destroy());
    });
  }

  spinsLeftText() {
    const left = AD.maxSpins - this.spinsDone;
    return left === 1 ? 'LAST FREE SPIN' : `${left} FREE SPINS LEFT`;
  }

  /* ───────────────────────── backdrop ───────────────────────── */

  drawBackdrop() {
    this.add.image(W / 2, H / 2, 'bg').setDisplaySize(W, H).setDepth(0);

    const v = this.add.graphics().setDepth(1);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0);
    v.fillRect(0, 0, W, 200);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.6, 0.6);
    v.fillRect(0, H - 320, W, 320);

    // Soft spotlight behind the cabinet
    this.add
      .image(W / 2, L.cabinetY, 'glow')
      .setDisplaySize(900, 900)
      .setTint(0xb03cff)
      .setAlpha(0.35)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(2);

    // Slow floating sparkles
    this.add
      .particles(0, 0, 'sparkle', {
        x: { min: 0, max: W },
        y: { min: 200, max: H },
        lifespan: 3200,
        speedY: { min: -30, max: -12 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [COLORS.gold, 0xffffff, COLORS.magenta],
        frequency: 260,
        blendMode: 'ADD',
      })
      .setDepth(3);
  }

  /* ─────────────────────────── HUD ─────────────────────────── */

  buildHud() {
    const panelW = 318;
    this.hud = [];
    const mkPanel = (x, originX, key, color, icon) => {
      const img = this.add.image(x, L.hudY, key).setOrigin(originX, 0.5).setDepth(30);
      img.setScale(panelW / img.width);
      const left = originX === 0 ? x : x - panelW;
      const h = img.displayHeight;
      // soft flash behind the panel when its value changes
      const flash = this.add
        .image(left + panelW / 2, L.hudY, 'glow')
        .setDisplaySize(panelW * 1.3, h * 2.2)
        .setTint(originX === 0 ? COLORS.gold : COLORS.cyan)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0)
        .setDepth(29);
      const ico = this.add.image(left + panelW - 46, L.hudY + 2, icon).setDepth(31);
      ico.setScale(54 / ico.width);
      ico.baseScale = ico.scaleX;
      const text = this.add
        .text(left + 30, L.hudY + h * 0.14, '', {
          fontFamily: FONT,
          fontSize: '36px',
          color,
          stroke: '#000000',
          strokeThickness: 6,
        })
        .setOrigin(0, 0.5)
        .setDepth(31);
      text.setShadow(0, 3, '#000000', 4, true, false);
      this.hud.push(img, flash, ico, text);
      return { img, flash, ico, text, left, h };
    };
    this.balancePanel = mkPanel(18, 0, 'panel-balance', '#ffd56a', 'coin');
    this.betPanel = mkPanel(W - 18, 1, 'panel-bet', '#ffffff', 'chip');
    this.balanceText = this.balancePanel.text.setText(fmt(this.balance));
    this.betText = this.betPanel.text.setText(fmt(this.bet));
    // the coin icon slowly flips, the chip slowly turns
    this.tweens.add({ targets: this.balancePanel.ico, scaleX: { from: this.balancePanel.ico.baseScale, to: this.balancePanel.ico.baseScale * 0.15 }, duration: 900, yoyo: true, repeat: -1, repeatDelay: 1800, ease: 'Sine.InOut' });
    this.tweens.add({ targets: this.betPanel.ico, angle: 360, duration: 6000, repeat: -1 });

    // Jackpot meter (fills across the 3 spins)
    this.add
      .text(W / 2, L.meterY - 26, 'FILL THE METER  ·  WIN THE BONUS WHEEL', {
        fontFamily: FONT_UI,
        fontSize: '17px',
        color: '#ffcf7a',
        stroke: '#1a0a2e',
        strokeThickness: 4,
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setDepth(31);
    const meterW = 440;
    this.meterTrack = this.add.image(W / 2, L.meterY, 'bar-track').setDepth(30);
    this.meterTrack.setScale(meterW / this.meterTrack.width);
    this.meterFill = this.add.image(W / 2 - meterW / 2 + 5, L.meterY, 'bar-fill').setOrigin(0, 0.5).setDepth(31);
    this.meterFill.setScale(((meterW - 10) / this.meterFill.width), (this.meterTrack.displayHeight - 8) / this.meterFill.height);
    this.meterGlow = this.add
      .image(0, L.meterY, 'glow')
      .setDisplaySize(70, 70)
      .setTint(COLORS.gold)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0)
      .setDepth(32);
    // Prize star at the end of the meter
    this.meterStar = this.add.image(W / 2 + meterW / 2 + 4, L.meterY, 'sparkle').setDepth(33).setScale(1.1).setTint(COLORS.gold);
    this.tweens.add({ targets: this.meterStar, angle: 90, scale: 1.35, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.meterShown = 0;
    this.drawMeter(0);

    // Hint line under the cabinet
    this.hintText = this.add
      .text(W / 2, L.hintY, '', {
        fontFamily: FONT_UI,
        fontSize: '28px',
        color: '#ffffff',
        stroke: '#1a0a2e',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(35);
  }

  drawMeter(pct) {
    const f = this.meterFill;
    const w = f.width * Phaser.Math.Clamp(pct, 0, 1);
    f.setCrop(0, 0, Math.max(0.01, w), f.height);
    f.setVisible(pct > 0.005);
    this.meterGlow.x = f.x + w * f.scaleX;
  }

  setMeter(target) {
    this.meter = Phaser.Math.Clamp(target, 0, 100);
    this.tweens.add({
      targets: this,
      meterShown: this.meter / 100,
      duration: 700,
      ease: 'Cubic.Out',
      onUpdate: () => this.drawMeter(this.meterShown),
    });
    this.meterGlow.setAlpha(1);
    this.tweens.add({ targets: this.meterGlow, alpha: 0, duration: 900, delay: 400 });
  }

  setHint(msg, color = '#ffffff') {
    this.hintText.setText(msg).setColor(color).setAlpha(1).setScale(0.9);
    this.tweens.killTweensOf(this.hintText);
    this.tweens.add({ targets: this.hintText, scale: 1, duration: 220, ease: 'Back.Out' });
    this.tweens.add({ targets: this.hintText, alpha: 0.55, duration: 650, yoyo: true, repeat: -1, delay: 400, ease: 'Sine.InOut' });
  }

  flashPanel(panel) {
    panel.flash.setAlpha(0.9);
    this.tweens.add({ targets: panel.flash, alpha: 0, duration: 700, ease: 'Cubic.Out' });
    this.tweens.add({ targets: panel.ico, scale: panel.ico.baseScale * 1.3, duration: 140, yoyo: true });
  }

  balanceDelta(delta) {
    const p = this.balancePanel;
    const t = this.add
      .text(p.left + p.text.width + 50, L.hudY + 12, `${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))}`, {
        fontFamily: FONT,
        fontSize: delta > 0 ? '28px' : '22px',
        color: delta > 0 ? '#7dff9a' : '#ff8aa8',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(36);
    t.setOrigin(0, 0.5).setScale(0.6);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: L.hudY - 26, alpha: { from: 1, to: 0 }, duration: 1200, delay: 250, ease: 'Cubic.In', onComplete: () => t.destroy() });
    if (delta > 0) this.flashPanel(p);
  }

  animateBalance() {
    const delta = this.balance - this.displayBalance;
    if (Math.abs(delta) >= 1) this.balanceDelta(delta);
    this.tweens.addCounter({
      from: this.displayBalance,
      to: this.balance,
      duration: 600,
      ease: 'Cubic.Out',
      onUpdate: (tw) => {
        this.displayBalance = tw.getValue();
        this.balanceText.setText(fmt(this.displayBalance));
      },
    });
    this.tweens.add({ targets: this.balanceText, scale: 1.12, duration: 120, yoyo: true });
  }

  /* ───────────────────────── controls ───────────────────────── */

  buildControls() {
    const spin = this.add.image(W / 2, L.spinY, 'btn-spin').setDepth(40);
    spin.baseScale = 410 / spin.width;
    spin.setScale(spin.baseScale);
    spin.setInteractive({ useHandCursor: true, pixelPerfect: false });
    spin.on('pointerdown', () => this.onSpinPress());
    spin.on('pointerup', () => this.onSpinRelease());
    spin.on('pointerout', () => this.onSpinRelease());
    this.spinBtn = spin;
    this.idleTween = this.tweens.add({
      targets: spin,
      scale: spin.baseScale * 1.04,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    this.addGlint(spin, 2600);

    this.betButtons = [
      this.makeBetButton(W / 2 - 262, L.spinY, 'btn-minus', -25),
      this.makeBetButton(W / 2 + 262, L.spinY, 'btn-plus', 25),
    ];

    // Hold-for-power meter (only shows while the player holds SPIN)
    this.powerGroup = this.add.container(W / 2, L.powerY).setDepth(41).setAlpha(0);
    const pTrack = this.add.image(0, 0, 'bar-track');
    pTrack.setScale(300 / pTrack.width, 0.8);
    this.powerFill = this.add.image(-147, 0, 'bar-fill').setOrigin(0, 0.5);
    this.powerFill.setScale(294 / this.powerFill.width, 0.6);
    this.powerLabel = this.add
      .text(0, 0, 'POWER', { fontFamily: FONT_UI, fontSize: '16px', color: '#ffffff', stroke: '#3a1405', strokeThickness: 4 })
      .setOrigin(0.5);
    this.powerGroup.add([pTrack, this.powerFill, this.powerLabel]);

    // CTA
    const cta = this.add.image(W / 2, L.ctaY, 'btn-cta').setDepth(40);
    cta.baseScale = 380 / cta.width;
    cta.setScale(cta.baseScale).setInteractive({ useHandCursor: true });
    cta.on('pointerdown', () => {
      sfx.click();
      openStore();
    });
    this.addGlint(cta, 3400, 1200);
    this.ctaBtn = cta;

    this.add
      .text(W / 2, L.disclaimerY, AD.disclaimer, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        color: '#bfaee0',
      })
      .setOrigin(0.5)
      .setAlpha(0.75)
      .setDepth(40);
  }

  // Diagonal light sweep across a button (pre-rendered frames from Preload).
  addGlint(target, every, delay = 0, depth = target.depth + 1) {
    const key = `${target.texture.key}_shine`;
    if (!this.textures.exists(key)) return;
    const frames = this.textures.get(key).frameTotal - 1;
    const shine = this.add.image(target.x, target.y, key, 0).setDepth(depth).setVisible(false);
    shine.setBlendMode(Phaser.BlendModes.ADD);
    if (target.parentContainer) target.parentContainer.add(shine);
    const sweep = () => {
      if (!target.active) return;
      shine.setVisible(true);
      this.tweens.addCounter({
        from: 0,
        to: frames - 1,
        duration: 600,
        ease: 'Sine.InOut',
        onUpdate: (tw) => {
          shine.setFrame(Math.round(tw.getValue()));
          shine.setPosition(target.x, target.y).setScale(target.scaleX, target.scaleY);
        },
        onComplete: () => shine.setVisible(false),
      });
    };
    this.time.addEvent({ delay: every, startAt: Math.max(0, every - delay), loop: true, callback: sweep });
  }

  makeBetButton(x, y, key, delta) {
    const b = this.add.image(x, y, key).setDepth(40);
    b.baseScale = 84 / b.width;
    b.setScale(b.baseScale).setInteractive({ useHandCursor: true });
    b.on('pointerdown', () => {
      if (this.machine.busy || this.ended) return;
      sfx.click();
      this.tweens.add({ targets: b, scale: b.baseScale * 0.86, duration: 70, yoyo: true });
      this.changeBet(delta);
    });
    return b;
  }

  changeBet(delta) {
    const next = Phaser.Math.Clamp(this.bet + delta, 25, 200);
    if (next === this.bet) return;
    this.bet = next;
    this.betText.setText(fmt(this.bet)).setScale(1.25);
    this.flashPanel(this.betPanel);
    this.tweens.add({ targets: this.betText, scale: 1, duration: 200, ease: 'Back.Out' });
  }

  setControlsActive(on) {
    this.betButtons.forEach((b) => b.setAlpha(on ? 1 : 0.45));
  }

  /* ───────────────────────── tap hint ───────────────────────── */

  buildTapHint() {
    const c = this.add.container(W / 2 + 165, L.spinY + 40).setDepth(70).setVisible(false);
    const ring = this.add.circle(0, 0, 34).setStrokeStyle(5, 0xffffff, 0.9);
    const dot = this.add.circle(0, 0, 16, 0xffffff, 0.85);
    c.add([ring, dot]);
    this.tapHint = { c, ring, dot };
  }

  showTapHint() {
    const { c, ring, dot } = this.tapHint;
    if (c.visible) return;
    c.setVisible(true).setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 200 });
    this.tapHintTweens = [
      this.tweens.add({ targets: ring, scale: { from: 0.5, to: 1.6 }, alpha: { from: 1, to: 0 }, duration: 900, repeat: -1 }),
      this.tweens.add({ targets: dot, scale: { from: 1, to: 0.75 }, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.InOut' }),
      this.tweens.add({ targets: c, y: L.spinY + 28, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.InOut' }),
    ];
  }

  hideTapHint() {
    const { c } = this.tapHint;
    if (!c.visible) return;
    this.tapHintTweens?.forEach((t) => t.remove());
    c.setVisible(false);
  }

  checkIdle() {
    if (this.ended) return;
    const idle = this.time.now - this.lastInputAt;
    if (!this.machine.busy && !this.charging && !this.inBonus && idle > AD.idleHintMs) this.showTapHint();
    if (!this.machine.busy && !this.inBonus && idle > AD.idleEndMs) this.showEnd();
  }

  /* ─────────────────────────── spin ─────────────────────────── */

  onSpinPress() {
    if (this.ended) return;

    // While spinning: SPIN doubles as STOP for the next reel
    if (this.machine.busy) {
      if (this.machine.stopNext()) this.bump(this.spinBtn);
      return;
    }

    this.charging = true;
    this.chargeLevel = 0;
    this.chargeTween?.remove();
    this.chargeTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1000,
      delay: 160, // a quick tap is just a normal spin
      onStart: () => this.tweens.add({ targets: this.powerGroup, alpha: 1, duration: 150 }),
      onUpdate: (tw) => this.drawPower(tw.getValue()),
    });
    this.idleTween.pause();
    this.tweens.add({ targets: this.spinBtn, scale: this.spinBtn.baseScale * 0.94, duration: 90 });
  }

  drawPower(t) {
    this.chargeLevel = t;
    const f = this.powerFill;
    f.setCrop(0, 0, Math.max(0.01, f.width * t), f.height);
    const mult = this.powerMult(t);
    this.powerLabel.setText(mult > 1 ? `POWER  x${mult}` : 'POWER');
    if (Math.random() < 0.25) sfx.tick();
  }

  powerMult(t) {
    return t > 0.85 ? 2 : t > 0.45 ? 1.5 : 1;
  }

  onSpinRelease() {
    if (!this.charging) return;
    this.charging = false;
    const power = this.chargeLevel;
    this.chargeTween?.remove();
    this.chargeTween = null;
    this.tweens.add({ targets: this.powerGroup, alpha: 0, duration: 200, delay: 250 });
    this.tweens.add({ targets: this.spinBtn, scale: this.spinBtn.baseScale, duration: 160, ease: 'Back.Out' });
    this.idleTween.resume();
    if (this.ended || this.machine.busy) return;
    this.startSpin(power);
  }

  bump(target) {
    const s = target.baseScale || 1;
    this.tweens.add({ targets: target, scale: s * 0.92, duration: 70, yoyo: true });
  }

  onTapReel(i) {
    if (this.ended) return;
    if (!this.machine.busy) {
      // Tapping the reels when idle spins too — players do it.
      this.startSpin(0);
      return;
    }
    this.machine.stopReel(i);
  }

  startSpin(power = 0) {
    if (this.machine.busy || this.ended) return;
    if (this.balance < this.bet) {
      this.setHint('Out of coins — get more in the full game!', '#ffb4e0');
      return;
    }

    this.clearWinFx();
    this.hideTapHint();
    this.pendingMult = this.powerMult(power);
    this.balance -= this.bet;
    this.animateBalance();
    this.setControlsActive(false);
    this.setHint(this.pendingMult > 1 ? `POWER x${this.pendingMult}!  Tap reels to stop` : 'TAP THE REELS TO STOP!', this.pendingMult > 1 ? '#ffd56a' : '#ffffff');
    sfx.spinStart();
    this.cabinet.pulse(false);
    this.cabinet.setExcited(true);

    this.ticker?.remove();
    this.ticker = this.time.addEvent({ delay: 75, loop: true, callback: () => sfx.tick() });

    this.machine.spin({
      onReelStop: (index, stopped) => this.onReelStopFx(index, stopped),
      onAnticipation: (index) => this.startAnticipation(index),
      onDone: (line) => this.onSpinResult(line),
    });
  }

  onReelStopFx(index, stopped) {
    sfx.reelStop(index);
    this.cameras.main.shake(70, 0.0035);
    this.cabinet.pulse(false);
    const x = this.machine.reelX(index);
    const dust = this.add
      .particles(x, this.machine.midY + this.machine.symbolSize * 1.4, 'particle', {
        speed: { min: 60, max: 180 },
        angle: { min: 200, max: 340 },
        scale: { start: 0.8, end: 0 },
        lifespan: 380,
        tint: COLORS.gold,
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(20);
    dust.explode(10);
    this.time.delayedCall(500, () => dust.destroy());

    if (stopped === this.machine.reels.length) {
      this.ticker?.remove();
      this.stopAnticipation();
    }
  }

  startAnticipation(index) {
    const x = this.machine.reelX(index);
    const { y, h } = this.cabinet.window;
    const w = this.machine.colW;
    const g = this.add.graphics().setDepth(19).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(10, COLORS.gold, 0.35);
    g.strokeRoundedRect(x - w / 2 + 2, y + 2, w - 4, h - 4, 14);
    g.lineStyle(4, 0xffffff, 0.9);
    g.strokeRoundedRect(x - w / 2 + 6, y + 6, w - 12, h - 12, 12);
    this.anticipationFx = [g];
    this.anticipationFx.push(this.tweens.add({ targets: g, alpha: 0.35, duration: 180, yoyo: true, repeat: -1 }));
    const sparks = this.add
      .particles(x, y + h / 2, 'sparkle', {
        x: { min: -w / 2, max: w / 2 },
        y: { min: -h / 2, max: h / 2 },
        lifespan: 500,
        scale: { start: 0.6, end: 0 },
        tint: [COLORS.gold, 0xffffff],
        frequency: 40,
        blendMode: 'ADD',
      })
      .setDepth(21);
    this.anticipationFx.push(sparks);
    this.cameras.main.zoomTo(1.035, 400, 'Sine.easeInOut');
    const landed = this.machine.reels.find((r) => r.state === 'idle')?.getWindow()[1];
    const name = (landed || 'sym-fox').replace('sym-', '').toUpperCase();
    this.setHint(landed === SLOT.wildKey ? 'ONE MORE LION… JACKPOT!' : `ONE MORE ${name}…`, '#ffd56a');
    sfx.riserStart();
  }

  stopAnticipation() {
    if (!this.anticipationFx) return;
    this.anticipationFx.forEach((o) => (o.remove ? o.remove() : o.destroy()));
    this.anticipationFx = null;
    sfx.riserStop();
    this.cameras.main.zoomTo(1, 250);
  }

  /* ────────────────────────── results ────────────────────────── */

  onSpinResult(line) {
    this.spinsDone += 1;
    this.ticker?.remove();
    this.stopAnticipation();
    this.setControlsActive(true);
    this.cabinet.setExcited(false);

    const won = this.machine.isWin(line);
    const jackpot = won && this.machine.isJackpot(line);
    const mult = this.pendingMult || 1;
    this.pendingMult = 1;

    this.setMeter(jackpot ? 100 : Math.min(90, this.meter + (won ? 34 : 30)));

    if (won) {
      const payout = Math.round(this.bet * (jackpot ? PAYOUT.jackpotMult : PAYOUT.lineMult) * mult);
      this.totalWon += payout;
      this.balance += payout;
      this.showLineWin();
      this.showWin(payout, mult, jackpot ? 'WILD JACKPOT' : null);
    } else {
      this.showNearMiss();
    }

    if (jackpot) {
      this.inBonus = true;
      this.time.delayedCall(1900, () => this.unlockBonus());
    } else if (this.spinsDone >= AD.maxSpins) {
      this.time.delayedCall(1500, () => this.showEnd());
    } else {
      this.time.delayedCall(1300, () => {
        if (this.ended || this.machine.busy) return;
        this.setHint(`${this.spinsLeftText()} — ${won ? 'HOLD SPIN FOR POWER!' : 'SPIN AGAIN!'}`, '#ffffff');
      });
    }
  }

  unlockBonus() {
    if (this.ended) return;
    sfx.bonus();
    this.cameras.main.flash(200, 255, 230, 160);
    const t = this.popText('BONUS UNLOCKED!', 66, L.meterY + 70);
    t.setScale(0.2);
    this.tweens.add({ targets: t, scale: 1, duration: 420, ease: 'Back.Out' });
    this.tweens.add({ targets: this.meterStar, scale: 2.4, duration: 300, yoyo: true, repeat: 2 });
    this.setHint('THE BONUS WHEEL IS OPEN!', '#ffd56a');
    this.time.delayedCall(1300, () => {
      this.tweens.add({ targets: t, alpha: 0, duration: 250, onComplete: () => t.destroy() });
      this.clearWinFx();
      this.wheel = new BonusWheel(this, {
        onWin: (prize) => {
          this.lastInputAt = this.time.now;
          this.totalWon += prize;
          this.balance += prize;
          this.showMegaWin(prize);
          this.time.delayedCall(3300, () => this.showEnd());
        },
      });
    });
  }

  clearWinFx() {
    this.winFx?.forEach((o) => (o.remove ? o.remove() : o.destroy()));
    this.winFx = [];
    this.machine.reels.forEach((r) => r.sprites.forEach((spr) => spr.setAlpha(1)));
  }

  showLineWin() {
    this.clearWinFx();
    const { x, w } = this.cabinet.window;
    const midY = this.machine.midY;
    const s = this.machine.symbolSize;

    const line = this.add.graphics().setDepth(16).setBlendMode(Phaser.BlendModes.ADD);
    line.fillStyle(COLORS.gold, 0.22);
    line.fillRoundedRect(x + 6, midY - s / 2, w - 12, s, 14);
    const frames = this.add.graphics().setDepth(17);
    this.machine.reels.forEach((r) => {
      r.sprites.forEach((spr) => {
        if (spr !== r.spriteAt(0)) this.tweens.add({ targets: spr, alpha: 0.3, duration: 250 });
      });
      frames.lineStyle(5, COLORS.gold, 1);
      frames.strokeRoundedRect(r.container.x - s / 2 + 4, midY - s / 2 + 2, s - 8, s - 4, 16);
      r.pulse(0, 4);
    });
    this.winFx.push(line, frames, this.tweens.add({ targets: [line, frames], alpha: 0.35, duration: 260, yoyo: true, repeat: -1 }));
    this.cabinet.pulse(true);
  }

  coinBurst(x, y, count = 26, depth = 62) {
    const p = this.add
      .particles(x, y, 'coin', {
        speed: { min: 380, max: 760 },
        angle: { min: 235, max: 305 },
        gravityY: 1500,
        rotate: { min: -360, max: 360 },
        scale: { min: 0.55, max: 0.95 },
        lifespan: 1500,
        emitting: false,
      })
      .setDepth(depth);
    p.explode(count);
    this.time.delayedCall(1700, () => p.destroy());
  }

  popText(text, size, y, colors = ['#fff6cf', '#ffd24a', '#c47a12']) {
    const t = this.add
      .text(W / 2, y, text, {
        fontFamily: FONT,
        fontSize: `${size}px`,
        color: '#ffd56a',
        stroke: '#2a1405',
        strokeThickness: Math.round(size * 0.14),
        padding: { x: 8, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(65);
    const grd = t.context.createLinearGradient(0, 0, 0, t.height);
    grd.addColorStop(0.2, colors[0]);
    grd.addColorStop(0.55, colors[1]);
    grd.addColorStop(0.9, colors[2]);
    t.setFill(grd);
    t.setShadow(0, 6, '#000000', 10, true, false);
    return t;
  }

  showWin(payout, mult, title = null) {
    sfx.win();
    this.cameras.main.shake(160, 0.005);
    const cy = this.machine.midY;
    const label = this.popText(title || (mult > 1 ? `POWER WIN x${mult}` : 'WIN'), 40, cy - 70);
    const amount = this.popText('0', 84, cy + 10);
    [label, amount].forEach((t, i) => {
      t.setScale(0.2);
      this.tweens.add({ targets: t, scale: 1, duration: 420, delay: i * 80, ease: 'Back.Out' });
    });
    const counter = { v: 0 };
    this.tweens.add({
      targets: counter,
      v: payout,
      duration: 900,
      ease: 'Cubic.Out',
      onUpdate: () => amount.setText(`+${fmt(counter.v)}`),
    });
    this.coinBurst(W / 2, this.cabinet.window.y + this.cabinet.window.h, 24);
    this.time.delayedCall(450, () => this.animateBalance());
    this.setHint(title ? 'METER FULL!' : 'NICE WIN!', '#ffd56a');
    this.time.delayedCall(1700, () =>
      this.tweens.add({ targets: [label, amount], alpha: 0, y: '-=30', duration: 300, onComplete: () => [label, amount].forEach((t) => t.destroy()) }),
    );
  }

  showMegaWin(payout) {
    sfx.bigWin();
    this.cameras.main.flash(250, 255, 230, 160);
    this.cameras.main.shake(400, 0.008);
    const layer = this.add.container(0, 0).setDepth(64);
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x05020f, 0.6);
    const rays = this.add.image(W / 2, H * 0.42, 'rays').setScale(2.4).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9);
    const glow = this.add.image(W / 2, H * 0.42, 'glow').setDisplaySize(700, 700).setTint(COLORS.gold).setBlendMode(Phaser.BlendModes.ADD);
    layer.add([dim, rays, glow]);
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 250 });
    this.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });

    const title = this.popText('MEGA WIN!', 104, H * 0.38);
    const amount = this.popText('0', 76, H * 0.47, ['#ffffff', '#ffe58a', '#ffb02e']);
    title.setScale(0.1);
    amount.setScale(0.1);
    this.tweens.add({ targets: title, scale: 1, duration: 600, ease: 'Back.Out' });
    this.tweens.add({ targets: title, angle: { from: -3, to: 3 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: amount, scale: 1, duration: 500, delay: 200, ease: 'Back.Out' });
    const counter = { v: 0 };
    this.tweens.add({
      targets: counter,
      v: payout,
      duration: 1900,
      ease: 'Cubic.Out',
      onUpdate: () => amount.setText(`+${fmt(counter.v)}`),
    });

    // Coin rain + fountains
    const rain = this.add
      .particles(0, -40, 'coin', {
        x: { min: 0, max: W },
        speedY: { min: 300, max: 600 },
        speedX: { min: -60, max: 60 },
        rotate: { min: -360, max: 360 },
        scale: { min: 0.5, max: 0.9 },
        lifespan: 2600,
        frequency: 35,
        quantity: 2,
      })
      .setDepth(63);
    this.coinBurst(W * 0.25, H, 22, 66);
    this.coinBurst(W * 0.75, H, 22, 66);
    this.time.delayedCall(500, () => {
      this.coinBurst(W / 2, H, 30, 66);
      this.animateBalance();
    });
    this.time.delayedCall(2200, () => rain.stop());

    this.megaWin = { layer, title, amount, rain };
  }

  showNearMiss() {
    sfx.nearMiss();
    const reel = this.machine.reels[2];
    // Highlight the fox sitting just above the payline
    reel.pulse(-1, 2);
    this.tweens.add({ targets: reel.container, x: reel.container.x + 8, duration: 50, yoyo: true, repeat: 3 });
    const t = this.popText('SO CLOSE!', 72, this.machine.midY, ['#ffffff', '#ff8ad0', '#c0127a']);
    t.setScale(0.2);
    this.tweens.add({ targets: t, scale: 1, duration: 380, ease: 'Back.Out' });
    this.time.delayedCall(1300, () => this.tweens.add({ targets: t, alpha: 0, duration: 260, onComplete: () => t.destroy() }));
    this.setHint('Just one away!', '#ffb4e0');
    this.cameras.main.shake(120, 0.003);
  }

  /* ───────────────────────── end card ───────────────────────── */

  showEnd() {
    if (this.ended) return;
    this.ended = true;
    this.hideTapHint();
    this.ticker?.remove();
    notifyGameEnd();
    if (this.megaWin) {
      this.megaWin.rain.stop();
      this.tweens.add({ targets: [this.megaWin.layer, this.megaWin.title, this.megaWin.amount], alpha: 0, duration: 300 });
    }
    this.endCard = new EndCard(this, {
      won: this.totalWon > 0,
      total: this.balance,
      onReplay: () => this.scene.restart(),
    });
  }
}
