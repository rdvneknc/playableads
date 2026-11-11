import Phaser from 'phaser';
import { FONT } from '../config.js';
import { sfx } from '../audio/Sfx.js';
import { VirtualJoystick } from '../ui/VirtualJoystick.js';
import { SkillButton } from '../ui/SkillButton.js';
import { EndCard } from '../ui/EndCard.js';
import { panelTexture, pillButton, gradText } from '../ui/Skin.js';
import { showBanner } from '../ui/Banner.js';
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
    // state kept on the Game scene so a rotation (which rebuilds this scene) doesn't reset it
    this.ui = this.match.uiState;

    if (this.input.manager.pointersTotal < 4) this.input.addPointer(3);

    this.createHud(width);
    this.createTopBar(width, height);
    this.createControls(width, height);
    this.createPauseOverlay(width, height);
    if (!this.ui.tutorialDone) this.createTutorial(width, height);
    this.bindMatchEvents();

    // Rebuilt in place after a rotation: restore score, pause and end card
    this.scoreText.setText(String(this.match.score.player));
    this.oppScoreText.setText(String(this.match.score.bot));
    if (this.match.state === 'ended') {
      this.ended = true;
      this.endCard = new EndCard(this, { score: { ...this.match.score }, onReplay: () => this.match.restartMatch() });
    } else if (this.scene.isPaused('Game')) {
      this.setPaused(true);
    }

    this.onOrientation = () => this.scene.restart();
    this.game.events.on('orientation', this.onOrientation);
    this.events.once('shutdown', () => this.game.events.off('orientation', this.onOrientation));

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

    const hint = this.add.container(width / 2, 84).setDepth(20);
    const hintLabel = this.add
      .text(0, 0, 'BEAT THE BOT  ·  SHOOT or DASH!', { fontFamily: FONT, fontSize: '19px', color: '#ffffff', letterSpacing: 1 })
      .setOrigin(0.5)
      .setShadow(0, 2, 'rgba(0,0,0,0.5)', 2, false, true);
    const hw = hintLabel.width / 2 + 36;
    const hintBg = this.add.graphics();
    hintBg.fillStyle(0x000000, 0.3);
    hintBg.fillRoundedRect(-hw + 2, -18 + 4, hw * 2, 36, 18);
    hintBg.fillStyle(0x0b1f3d, 0.88);
    hintBg.fillRoundedRect(-hw, -18, hw * 2, 36, 18);
    hintBg.lineStyle(2, 0xffd23f, 1);
    hintBg.strokeRoundedRect(-hw, -18, hw * 2, 36, 18);
    hintBg.fillStyle(0xffd23f, 1);
    hintBg.fillCircle(-hw + 18, 0, 5);
    hintBg.fillCircle(hw - 18, 0, 5);
    hint.add([hintBg, hintLabel]);
    hint.setScale(0.6).setAlpha(0);
    this.hintText = hint;
    if (this.match.uiState.hintShown) {
      hint.setVisible(false);
    } else {
      this.tweens.add({ targets: hint, scale: 1, alpha: 1, duration: 360, ease: 'Back.Out', delay: 300 });
      this.time.delayedCall(3800, () => {
        this.match.uiState.hintShown = true;
        this.tweens.add({ targets: this.hintText, alpha: 0, duration: 500 });
      });
    }
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
    const portrait = height > width;
    const isBlocked = () => this.blocked;
    const act = (type) => () => this.match.playerAction(type);

    let stick, shoot, dash, bump, zone;
    if (portrait) {
      // Control deck: a dark band under the pitch so thumbs never cover play,
      // controls sit well above the bottom edge.
      const deck = Math.round(Phaser.Math.Clamp(height * 0.25, 320, 400));
      this.drawDeck(width, height, deck);
      const cy = height - deck * 0.52;
      stick = { x: 168, y: cy, r: 116, k: 46 };
      shoot = { x: width - 132, y: cy + 10, size: 172 };
      bump = { x: shoot.x - 172, y: cy + 52, size: 126 };
      dash = { x: shoot.x - 92, y: cy - 132, size: 126 };
      zone = new Phaser.Geom.Rectangle(0, height - deck - 40, width * 0.55, deck + 40);
    } else {
      stick = { x: 140, y: height - 130, r: 96, k: 38 };
      shoot = { x: width - 100, y: height - 128, size: 132 };
      bump = { x: shoot.x - 138, y: shoot.y + 22, size: 100 };
      dash = { x: shoot.x - 26, y: shoot.y - 128, size: 100 };
      zone = new Phaser.Geom.Rectangle(0, height * 0.2, width * 0.48, height * 0.8);
    }

    this.joystick = new VirtualJoystick(this, stick.x, stick.y, {
      radius: stick.r,
      knobRadius: stick.k,
      zone,
      isBlocked,
    });
    this.joystick.once('start', () => this.hideTutorial());

    this.shootBtn = new SkillButton(this, shoot.x, shoot.y, {
      texture: 'btn-shoot',
      size: shoot.size,
      label: 'SHOOT',
      rim: 0x4de0ff,
      labelStroke: '#0b2f7a',
      onPress: act('shoot'),
      isBlocked,
    });
    this.superBtn = new SkillButton(this, dash.x, dash.y, {
      texture: 'btn-super',
      size: dash.size,
      label: 'DASH',
      rim: 0x7adfff,
      labelColor: '#ffffff',
      labelStroke: '#0b3a6a',
      onPress: act('super'),
      isBlocked,
    });
    this.shoulderBtn = new SkillButton(this, bump.x, bump.y, {
      texture: 'btn-shoulder',
      size: bump.size,
      label: 'BUMP',
      rim: 0xffd23f,
      labelStroke: '#4a2a00',
      onPress: act('shoulder'),
      isBlocked,
    });
  }

  drawDeck(width, height, deck) {
    const key = `deck-${width}x${deck}`;
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, width, deck + 60);
      const ctx = tex.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, deck + 60);
      g.addColorStop(0, 'rgba(6,14,32,0)');
      g.addColorStop(0.22, 'rgba(6,14,32,0.55)');
      g.addColorStop(1, 'rgba(4,10,24,0.82)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, deck + 60);
      // thin glowing edge
      const e = ctx.createLinearGradient(0, 0, width, 0);
      e.addColorStop(0, 'rgba(77,224,255,0)');
      e.addColorStop(0.5, 'rgba(77,224,255,0.55)');
      e.addColorStop(1, 'rgba(77,224,255,0)');
      ctx.fillStyle = e;
      ctx.fillRect(0, 58, width, 2);
      tex.refresh();
    }
    this.add.image(0, height - deck - 60, key).setOrigin(0, 0).setDepth(90);
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

    this.shootBtn.setHighlight(hasBall && !this.ui.shotTutorialDone && g.isPlaying);
    this.superBtn.setHighlight(this.ui.shotTutorialDone && dash.ready && g.isPlaying);
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
    const hx = this.joystick.homeX;
    const hy = this.joystick.homeY;
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
      .text(0, -this.joystick.radius - 26, 'DRAG TO MOVE', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#ffffff',
        stroke: '#0b1f3d',
        strokeThickness: 6,
        letterSpacing: 1,
      })
      .setOrigin(0.5)
      .setShadow(0, 3, 'rgba(0,0,0,0.45)', 3, true, false);

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
    this.ui.tutorialDone = true;
    const t = this.tutorial;
    this.tutorial = null;
    this.tweens.add({ targets: t, alpha: 0, duration: 250, onComplete: () => t.destroy() });
  }

  bindMatchEvents() {
    const ev = this.match.matchEvents;
    // remember what we attach so a rebuild (rotation) doesn't stack duplicates
    const on = ev.on.bind(ev);
    const bound = [];
    ev.on = (name, fn) => {
      bound.push([name, fn]);
      return on(name, fn);
    };
    this.events.once('shutdown', () => bound.forEach(([n, f]) => ev.off(n, f)));
    ev.on('kickoff', (ms) => showBanner(this, 'ready', 'READY?', null, Math.max(350, (ms || 900) - 550)));
    ev.on('play', () => {
      if (!this.ui.firstPlayShown) {
        this.ui.firstPlayShown = true;
        showBanner(this, 'go', 'GO!', null, 350);
      }
    });
    ev.on('goal', ({ scorer, score }) => {
      if (scorer === 'player') {
        this.popScore(this.scoreText, score.player);
        showBanner(this, 'goal', 'GOOOAL!', `YOU ${score.player}  –  ${score.bot} BOT`, 1500);
      } else {
        this.popScore(this.oppScoreText, score.bot);
        showBanner(this, 'conceded', 'BOT SCORES', `YOU ${score.player}  –  ${score.bot} BOT  ·  STRIKE BACK!`, 1500);
      }
    });
    ev.on('shot', ({ team }) => {
      if (team === 'player') this.ui.shotTutorialDone = true;
    });
    ev.on('ended', ({ score }) => this.showEndCard(score));
    ev.on = on;
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
