import Phaser from 'phaser';
import { FONT } from '../config.js';
import { sfx } from '../audio/Sfx.js';
import { VirtualJoystick } from '../ui/VirtualJoystick.js';
import { SkillButton } from '../ui/SkillButton.js';
import { EndCard } from '../ui/EndCard.js';
import { panelTexture, pillButton, gradText } from '../ui/Skin.js';
// HUD, controls, pause, banners and end card. Landscape layout.
export class UIScene extends Phaser.Scene {
  constructor() {
    super('UI');
  }

  create() {
    const { width, height } = this.scale;
    this.match = this.scene.get('Game');
    this.paused = false;
    this.ended = false;
    this.shotTutorialDone = false;

    this.input.addPointer(3);

    this.createHud(width);
    this.createTopBar(width, height);
    this.createControls(width, height);
    this.createPauseOverlay(width, height);
    this.createTutorial(width, height);
    this.bindMatchEvents();

    // Audio may only start after a user gesture: unlock on the first touch,
    // and give the kick-off whistle then if the browser blocked it earlier.
    this.startedAt = this.time.now;
    this.input.once('pointerdown', () => {
      sfx.unlock();
      this.time.delayedCall(60, () => {
        if (!sfx.whistled && this.match.state === 'playing' && this.time.now - this.startedAt < 6000) sfx.kickoffWhistle();
      });
    });

    this.onHidden = () => {
      if (!this.paused && !this.ended) this.setPaused(true);
    };
    this.game.events.on('hidden', this.onHidden);
    this.events.once('shutdown', () => this.game.events.off('hidden', this.onHidden));
  }

  get blocked() {
    return this.paused || this.ended;
  }

  createHud(width) {
    const y = 30;
    const barW = 300;
    // Asset segments ≈ 1 : 2 : 1 (blue | timer | red)
    const sideW = barW * 0.22;
    const midW = barW - sideW * 2;
    const x0 = width / 2 - barW / 2;

    this.add
      .image(width / 2, y, 'scoreboard')
      .setDisplaySize(barW, 48)
      .setDepth(50);

    const scoreStyle = {
      fontFamily: FONT,
      fontSize: '28px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    };
    this.scoreText = this.add
      .text(x0 + sideW / 2, y, '0', scoreStyle)
      .setOrigin(0.5)
      .setDepth(51);
    this.oppScoreText = this.add
      .text(x0 + sideW + midW + sideW / 2, y, '0', scoreStyle)
      .setOrigin(0.5)
      .setDepth(51);
    this.timerText = this.add
      .text(width / 2, y, '', {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(51);

    this.hintText = this.add
      .text(width / 2, 78, 'Beat the bot — SHOOT or DASH!', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#ffffff',
        stroke: '#0b3d1e',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.time.delayedCall(3800, () => this.tweens.add({ targets: this.hintText, alpha: 0, duration: 500 }));
  }

  updateTimer() {
    const s = Math.max(0, Math.ceil(this.match.timeLeftMs / 1000));
    const text = String(s);
    if (this.timerText.text !== text) {
      this.timerText.setText(text);
      if (s <= 10 && s > 0 && this.match.isPlaying) {
        this.timerText.setScale(1.25);
        this.tweens.add({ targets: this.timerText, scale: 1, duration: 250 });
      }
    }
  }

  popScore(text, value) {
    text.setText(String(value)).setScale(1.8);
    this.tweens.add({ targets: text, scale: 1, duration: 400, ease: 'Back.Out' });
  }

  createTopBar(width) {
    const x = width - 44;
    const y = 40;
    const r = 22;

    const hit = this.add.circle(x, y, r + 6, 0x000000, 0.001).setDepth(110).setInteractive({ useHandCursor: true });
    const shadow = this.add.circle(x + 2, y + 3, r, 0x000000, 0.28).setDepth(110);
    const bg = this.add.circle(x, y, r, 0x0b3d1e, 0.92).setStrokeStyle(3, 0xffffff, 0.95).setDepth(111);
    const gloss = this.add.ellipse(x - 4, y - 7, r * 1.1, r * 0.55, 0xffffff, 0.18).setDepth(112);

    this.pauseIcon = this.add.graphics().setDepth(113).setPosition(x, y);
    this.drawPauseIcon(false);

    hit.on('pointerdown', () => {
      if (this.ended) return;
      this.tweens.add({ targets: [bg, gloss, this.pauseIcon, shadow], scale: 0.88, duration: 70, yoyo: true });
      this.setPaused(!this.paused);
    });

    this.pauseBtn = { hit, bg, gloss, shadow };
  }

  drawPauseIcon(playing) {
    const g = this.pauseIcon;
    g.clear();
    g.fillStyle(0xffffff, 1);
    if (playing) {
      // play triangle when paused (tap to resume)
      g.fillTriangle(-5, -9, -5, 9, 10, 0);
    } else {
      // pause bars
      g.fillRoundedRect(-8, -9, 5, 18, 2);
      g.fillRoundedRect(3, -9, 5, 18, 2);
    }
  }

  createControls(width, height) {
    // Landscape: stick on the left, action buttons on the right
    const zone = new Phaser.Geom.Rectangle(0, height * 0.2, width * 0.48, height * 0.8);
    this.joystick = new VirtualJoystick(this, 120, height - 100, {
      radius: 88,
      knobRadius: 34,
      zone,
      isBlocked: () => this.blocked,
    });
    this.joystick.once('start', () => this.hideTutorial());

    const isBlocked = () => this.blocked;
    const act = (type) => () => this.match.playerAction(type);

    // Practical L layout for right thumb: Shoot primary, Dash above, Bump left
    const gap = 18;
    const shootSize = 118;
    const sideSize = 92;
    const ox = width - 28 - shootSize / 2;
    const oy = height - 28 - shootSize / 2;

    this.shootBtn = new SkillButton(this, ox, oy, {
      texture: 'btn-shoot',
      size: shootSize,
      label: 'Shoot',
      labelStroke: '#0b2f7a',
      onPress: act('shoot'),
      isBlocked,
    });
    this.superBtn = new SkillButton(this, ox, oy - shootSize / 2 - sideSize / 2 - gap, {
      texture: 'btn-super',
      size: sideSize,
      label: 'Dash',
      labelColor: '#7adfff',
      labelStroke: '#0b3a6a',
      onPress: act('super'),
      isBlocked,
    });
    this.shoulderBtn = new SkillButton(this, ox - shootSize / 2 - sideSize / 2 - gap, oy, {
      texture: 'btn-shoulder',
      size: sideSize,
      label: 'Bump',
      labelStroke: '#333333',
      onPress: act('shoulder'),
      isBlocked,
    });
  }

  updateControls() {
    const g = this.match;
    const { player, ball } = g;
    const hasBall = ball.owner === player;
    const nearBall = hasBall || (!ball.owner && player.distanceTo(ball) < player.radius + ball.radius + 30);

    const dash = player.cooldowns.super;
    const sh = player.cooldowns.shoulder;
    this.shootBtn.setState(1, 0, nearBall);
    this.superBtn.setState(dash.progress, dash.remainingMs, true);
    const foe = g.nearestFoe(player);
    this.shoulderBtn.setState(sh.progress, sh.remainingMs, !!foe && player.distanceTo(foe) < 220);

    this.shootBtn.setHighlight(hasBall && !this.shotTutorialDone && g.isPlaying);
    this.superBtn.setHighlight(this.shotTutorialDone && dash.ready && g.isPlaying);
  }

  createPauseOverlay(width, height) {
    const cx = width / 2;
    const cy = height / 2;
    const panelW = Math.min(440, width - 160);
    const panelH = 300;
    const py = cy - panelH / 2;

    const dim = this.add.rectangle(cx, cy, width, height, 0x050b1c, 0.74).setInteractive();
    // soft spotlight behind the panel
    const glow = this.add.graphics();
    for (let i = 6; i > 0; i--) {
      glow.fillStyle(0x2a7bff, 0.035);
      glow.fillEllipse(cx, cy, panelW + i * 70, panelH + i * 40);
    }

    panelTexture(this, 'pause-panel', panelW, panelH, { rim: '#5cff9a', top: '#123a2a', bottom: '#071a14', header: 112 });
    const panel = this.add.image(cx, cy + 6, 'pause-panel');
    panel.setInteractive(); // swallow taps on the panel itself

    // pause badge sitting on the top edge
    const badge = this.add.graphics();
    badge.fillStyle(0x000000, 0.35);
    badge.fillCircle(cx + 2, py + 4, 34);
    badge.fillStyle(0x0b3d24, 1);
    badge.fillCircle(cx, py, 34);
    badge.fillStyle(0x5cff9a, 1);
    badge.fillCircle(cx, py, 29);
    badge.fillStyle(0xffffff, 0.35);
    badge.fillEllipse(cx - 4, py - 12, 34, 14);
    badge.fillStyle(0x0b3d24, 1);
    badge.fillRoundedRect(cx - 12, py - 13, 8, 26, 3);
    badge.fillRoundedRect(cx + 4, py - 13, 8, 26, 3);

    const title = gradText(this, cx, py + 64, 'PAUSED', 46, ['#ffffff', '#d9ffe6', '#5cff9a'], '#05210f');

    const sub = this.add
      .text(cx, py + 124, 'Take a breath — the match is on hold', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#bfeed0',
      })
      .setOrigin(0.5);

    const resumeBtn = pillButton(this, cx, py + 198, '▶  RESUME', {
      w: 250,
      h: 70,
      size: 30,
      onTap: () => this.setPaused(false),
    });

    const hint = this.add
      .text(cx, py + panelH - 22, 'or tap anywhere to continue', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        color: '#7fb595',
      })
      .setOrigin(0.5);

    dim.on('pointerdown', () => this.setPaused(false));

    this.pauseLayer = this.add
      .container(0, 0, [dim, glow, panel, badge, title, sub, resumeBtn, hint])
      .setDepth(300)
      .setVisible(false)
      .setAlpha(0);
    this.pauseTitle = title;
    this.resumeBtn = resumeBtn;
  }

  setPaused(paused) {
    if (this.ended || paused === this.paused) return;
    this.paused = paused;
    this.joystick.reset();
    this.match.setPlayerInput(0, 0);
    this.drawPauseIcon(paused);
    sfx.setPaused(paused);

    if (paused) {
      this.pauseLayer.setVisible(true);
      this.pauseLayer.setAlpha(0);
      this.pauseTitle.setScale(0.7);
      this.resumeBtn.setScale(0.9);
      this.tweens.add({ targets: this.pauseLayer, alpha: 1, duration: 180 });
      this.tweens.add({ targets: this.pauseTitle, scale: 1, duration: 320, ease: 'Back.Out' });
      this.tweens.add({
        targets: this.resumeBtn,
        scale: 1.06,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
      this.time.delayedCall(260, () => this.paused && this.resumeBtn.sweep?.());
      this.scene.pause('Game');
    } else {
      this.tweens.killTweensOf(this.resumeBtn);
      this.resumeBtn.setScale(1);
      this.tweens.add({
        targets: this.pauseLayer,
        alpha: 0,
        duration: 140,
        onComplete: () => this.pauseLayer.setVisible(false),
      });
      this.scene.resume('Game');
    }
  }

  createTutorial(width, height) {
    const hx = 120;
    const hy = height - 100;
    this.tutorial = this.add.container(hx, hy).setDepth(150);

    const hand = this.add.graphics();
    hand.fillStyle(0xffffff, 1);
    hand.lineStyle(4, 0x222222, 1);
    hand.fillRoundedRect(-12, -46, 24, 56, 12);
    hand.strokeRoundedRect(-12, -46, 24, 56, 12);
    hand.fillRoundedRect(-30, -6, 62, 58, 20);
    hand.strokeRoundedRect(-30, -6, 62, 58, 20);
    hand.fillStyle(0xffffff, 1);
    hand.fillRect(-9, -6, 18, 14);

    const label = this.add
      .text(0, -100, 'Drag to move!', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.tutorialHand = this.add.container(0, 0, [hand]).setScale(0.85);
    this.tutorial.add([this.tutorialHand, label]);
    this.tweens.add({
      targets: this.tutorialHand,
      x: { from: -40, to: 50 },
      y: { from: 20, to: -30 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  hideTutorial() {
    if (!this.tutorial) return;
    const t = this.tutorial;
    this.tutorial = null;
    this.tweens.add({ targets: t, alpha: 0, duration: 250, onComplete: () => t.destroy() });
  }

  bindMatchEvents() {
    const ev = this.match.matchEvents;
    ev.on('kickoff', () => this.showBanner('READY?', '#ffffff', '#0b3d1e', 700));
    ev.on('play', () => {
      if (!this.firstPlayShown) {
        this.firstPlayShown = true;
        this.showBanner('GO!', '#ffe566', '#7a3a00', 650);
      }
    });
    ev.on('goal', ({ scorer, score }) => {
      if (scorer === 'player') {
        this.popScore(this.scoreText, score.player);
        this.showBanner('GOOOAL!', '#ffffff', '#0b3d1e', 1600);
      } else {
        this.popScore(this.oppScoreText, score.bot);
        this.showBanner('BOT SCORES!', '#ff8a80', '#5a0000', 1600);
      }
    });
    ev.on('shot', ({ team }) => {
      if (team === 'player') this.shotTutorialDone = true;
    });
    ev.on('ended', ({ score }) => this.showEndCard(score));
  }

  showBanner(text, color, stroke, holdMs) {
    const { width, height } = this.scale;
    const banner = this.add
      .text(width / 2, height / 2 - 20, text, { fontFamily: FONT, fontSize: '72px', color, stroke, strokeThickness: 12 })
      .setOrigin(0.5)
      .setDepth(200)
      .setScale(0.4)
      .setAlpha(0);

    this.tweens.add({ targets: banner, alpha: 1, scale: 1, duration: 320, ease: 'Back.Out' });
    this.tweens.add({
      targets: banner,
      alpha: 0,
      scale: 1.15,
      duration: 260,
      delay: holdMs,
      onComplete: () => banner.destroy(),
    });
  }

  showEndCard(score) {
    this.ended = true;
    this.joystick.reset();
    this.match.setPlayerInput(0, 0);
    this.hideTutorial();
    this.time.delayedCall(700, () => {
      this.endCard = new EndCard(this, { score, onReplay: () => this.match.restartMatch() });
    });
  }

  update() {
    if (!this.blocked) {
      const f = this.joystick.getForce();
      this.match.setPlayerInput(f.x, f.y);
    }
    this.updateTimer();
    this.updateControls();
  }
}
