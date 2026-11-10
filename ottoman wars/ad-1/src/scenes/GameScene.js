import Phaser from 'phaser';
import { AD, BOARD, BUDGET, ENEMY, FONT, GAME_WIDTH as W, GAME_HEIGHT as H, L, TEXT, UNITS } from '../config.js';
import { cell, drawBoard, pick } from '../game/Board.js';
import { Unit, wait, tweenP } from '../game/Unit.js';
import { Battle } from '../game/Battle.js';
import { Fx } from '../game/Fx.js';
import { EndCard } from '../ui/EndCard.js';
import { banner, goldText, makeButton, makeLogo } from '../ui/Ui.js';
import { sfx } from '../audio/Sfx.js';
import { notifyGameEnd } from '../ad/cta.js';

const TYPES = ['yeniceri', 'azap', 'tufekci', 'akinci', 'tatar', 'top'];
const MAX_ROUNDS = 8;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.state = 'place';
    this.gold = BUDGET;
    this.units = [];
    this.selected = null;
    this.lastInputAt = this.time.now;
    this.fx = new Fx(this);

    const bg = this.add.image(W / 2, H / 2, L.bg).setDepth(0);
    bg.setScale(Math.max(W / bg.width, H / bg.height));
    this.buildScenery();
    this.boardG = this.add.graphics().setDepth(50);
    this.redrawBoard();

    ENEMY.forEach((e) => this.units.push(new Unit(this, e.type, 'e', e.row, e.col)));

    this.buildHud();
    this.buildCards();
    this.buildTutorial();
    this.bindInput();

    this.time.addEvent({ delay: 250, loop: true, callback: () => this.checkIdle() });
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  /* ───────────────────────── scenery ───────────────────────── */

  buildScenery() {
    // Ottoman camp on the left
    L.tents.forEach(([x, y, sc], i) => this.add.image(x, y, 'tent').setOrigin(0.5, 1).setScale(sc).setDepth(10 - i).setTint(i ? 0xe8e0d0 : 0xffffff));
    // Enemy castle on the right (team art)
    this.castle = this.add.image(L.castle.x, L.castle.y, 'kale').setOrigin(0.5, 0.985).setDepth(10);
    this.castle.setScale(L.castle.w / this.castle.width);

    // drifting dust motes for depth
    this.add
      .particles(0, 0, 'dot', {
        x: { min: 0, max: W },
        y: { min: 480, max: 900 },
        lifespan: 4000,
        speedX: { min: 6, max: 18 },
        speedY: { min: -6, max: 2 },
        scale: { start: 0.18, end: 0 },
        alpha: { start: 0.5, end: 0 },
        tint: 0xffe2a8,
        frequency: 180,
      })
      .setDepth(60);
  }

  redrawBoard() {
    const show = this.state === 'place' && (this.selected || this.dragging);
    drawBoard(this.boardG, {
      highlight: show ? (r, c) => BOARD.playerCols.includes(c) && !this.unitAt(r, c) : null,
    });
  }

  unitAt(r, c) {
    return this.units.find((u) => u.alive && u.row === r && u.col === c);
  }

  /* ─────────────────────────── HUD ─────────────────────────── */

  buildHud() {
    // gold panel
    const { x: gx, y } = L.gold;
    const g = this.add.graphics().setDepth(3500);
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(gx - 150 + 4, y - 36 + 6, 300, 72, 36);
    g.fillStyle(0x8a5a12, 1);
    g.fillRoundedRect(gx - 154, y - 40, 308, 80, 40);
    g.fillStyle(0x2a170a, 1);
    g.fillRoundedRect(gx - 148, y - 34, 296, 68, 34);
    this.add.image(gx - 108, y, 'akce').setDisplaySize(62, 62).setDepth(3501);
    this.add.text(gx - 64, y - 16, TEXT.gold, { fontFamily: FONT, fontSize: '18px', color: '#d8b97a' }).setOrigin(0, 0.5).setDepth(3501);
    this.goldText = this.add
      .text(gx - 64, y + 12, String(this.gold), { fontFamily: FONT, fontSize: '36px', color: '#ffd36b', stroke: '#1d1206', strokeThickness: 6 })
      .setOrigin(0, 0.5)
      .setDepth(3501);
    this.shownGold = this.gold;

    this.logo = makeLogo(this, L.logo.x, L.logo.y, L.logo.s).setDepth(40);
    this.instr = goldText(this, L.instr.x, L.instr.y, TEXT.place, L.instr.size, { title: false, colors: ['#ffffff', '#fff3d2', '#f3d18a'], thick: 0.2 }).setDepth(3500);
  }

  setGold(v) {
    this.gold = v;
    this.tweens.addCounter({
      from: this.shownGold,
      to: v,
      duration: 300,
      onUpdate: (tw) => {
        this.shownGold = Math.round(tw.getValue());
        this.goldText.setText(String(this.shownGold));
      },
    });
    this.goldText.setScale(1.25);
    this.tweens.add({ targets: this.goldText, scale: 1, duration: 260, ease: 'Back.Out' });
    this.refreshCards();
  }

  toast(str) {
    this.fx.floatText(str, W / 2, L.hintY, '#ffb3a8', 30);
  }

  /* ─────────────────────────── cards ─────────────────────────── */

  buildCards() {
    this.cards = TYPES.map((type, i) => {
      const def = UNITS[type];
      const c = this.add.container(L.cardX[i], L.cardY).setDepth(3600);
      const frame = this.add.image(0, 0, 'kart');
      const CARD_W = L.cardW;
      const k = CARD_W / frame.width; // 256×340 art, window 33..221 × 44..233
      frame.setScale(k);
      const ox = -frame.width / 2;
      const oy = -frame.height / 2;
      const wx = (33 + 221) / 2;
      const wy = (44 + 233) / 2;
      const portrait = this.add.image((ox + wx) * k, (oy + wy) * k, `${def.art}-p`).setDisplaySize(190 * k, 190 * k);
      const name = this.add
        .text(0, (oy + 262) * k, def.name, { fontFamily: FONT, fontSize: `${Math.round((def.name.length > 7 ? 15 : 17) * (CARD_W / 112))}px`, color: '#fff3cf', stroke: '#0f1d0e', strokeThickness: 4 })
        .setOrigin(0.5);
      const coin = this.add.image(-14 * (CARD_W / 112), (oy + 306) * k, 'akce').setDisplaySize(24 * (CARD_W / 112), 24 * (CARD_W / 112));
      const cost = this.add.text(0, (oy + 306) * k, String(def.cost), { fontFamily: FONT, fontSize: `${Math.round(22 * (CARD_W / 112))}px`, color: '#ffd36b', stroke: '#0f1d0e', strokeThickness: 4 }).setOrigin(0, 0.5);
      const glow = this.add.graphics();
      glow.lineStyle(5, 0xfff1a8, 1);
      glow.strokeRoundedRect(-CARD_W / 2 - 3, -frame.displayHeight / 2 - 3, CARD_W + 6, frame.displayHeight + 6, 12);
      glow.setVisible(false);
      c.add([portrait, frame, name, coin, cost, glow]);
      c.setSize(CARD_W, frame.displayHeight).setInteractive({ useHandCursor: true });
      c.type = type;
      c.glow = glow;
      c.portrait = portrait;
      c.on('pointerdown', (p) => this.cardDown(c, p));
      return c;
    });

    this.fightBtn = makeButton(this, L.fight.x, L.fight.y, TEXT.fight, { w: L.fight.w, size: Math.round(L.fight.w * 0.11), onTap: (on) => this.onFight(on) }).setDepth(3600);
    this.refreshCards();
  }

  refreshCards() {
    this.cards.forEach((c) => {
      const ok = UNITS[c.type].cost <= this.gold;
      c.setAlpha(ok ? 1 : 0.5);
      c.portrait.setTint(ok ? 0xffffff : 0x777777);
      c.glow.setVisible(this.selected === c.type);
    });
    this.fightBtn?.setEnabled(this.units.some((u) => u.side === 'p'));
  }

  cardDown(card, p) {
    if (this.state !== 'place') return;
    sfx.unlock();
    this.lastInputAt = this.time.now;
    this.hideHint();
    if (UNITS[card.type].cost > this.gold) {
      this.toast(TEXT.noGold);
      this.cameras.main.shake(80, 0.003);
      return;
    }
    sfx.click();
    this.selected = card.type;
    this.dragging = { type: card.type, startX: p.x, startY: p.y, moved: false };
    const def = UNITS[card.type];
    this.ghost = this.add
      .image(p.x, p.y, `${def.art}-u`)
      .setOrigin(0.5, 0.95)
      .setAlpha(0)
      .setDepth(3700);
    this.ghost.setScale((def.h * 0.85) / this.ghost.height);
    this.refreshCards();
    this.redrawBoard();
  }

  bindInput() {
    this.input.on('pointerdown', (p, over) => {
      sfx.unlock();
      this.lastInputAt = this.time.now;
      if (this.state !== 'place' || over.length) return;
      const t = pick(p.x, p.y);
      if (!t) return;
      const u = this.unitAt(t.row, t.col);
      if (u && u.side === 'p') return this.removeUnit(u);
      if (this.selected) this.tryPlace(this.selected, t);
    });
    this.input.on('pointermove', (p) => {
      if (!this.dragging || !this.ghost) return;
      if (Math.hypot(p.x - this.dragging.startX, p.y - this.dragging.startY) > 14) this.dragging.moved = true;
      if (this.dragging.moved) this.ghost.setAlpha(0.85);
      const t = pick(p.x, p.y);
      if (t && BOARD.playerCols.includes(t.col) && !this.unitAt(t.row, t.col)) {
        const c = cell(t.row, t.col);
        this.ghost.setPosition(c.x, c.y).setScale((UNITS[this.dragging.type].h * c.s) / this.ghost.height);
      } else {
        this.ghost.setPosition(p.x, p.y + 40);
      }
    });
    this.input.on('pointerup', (p) => {
      if (!this.dragging) return;
      const d = this.dragging;
      this.dragging = null;
      this.ghost?.destroy();
      this.ghost = null;
      if (d.moved) {
        const t = pick(p.x, p.y);
        if (t) this.tryPlace(d.type, t);
      }
      this.redrawBoard();
    });
  }

  tryPlace(type, t) {
    if (!BOARD.playerCols.includes(t.col) || this.unitAt(t.row, t.col)) return false;
    const def = UNITS[type];
    if (def.cost > this.gold) {
      this.toast(TEXT.noGold);
      return false;
    }
    const u = new Unit(this, type, 'p', t.row, t.col);
    this.units.push(u);
    u.dropIn();
    sfx.coin();
    this.setGold(this.gold - def.cost);
    if (UNITS[type].cost > this.gold) this.selected = null;
    this.refreshCards();
    this.redrawBoard();
    return true;
  }

  removeUnit(u) {
    sfx.click();
    this.units = this.units.filter((x) => x !== u);
    this.fx.dust(u.pos.x, u.pos.y, u.pos.s, 6);
    u.destroy();
    this.setGold(this.gold + UNITS[u.type].cost);
    this.refreshCards();
    this.redrawBoard();
  }

  /* ───────────────────────── tutorial ───────────────────────── */

  buildTutorial() {
    this.hand = this.add.image(0, 0, 'hand').setOrigin(0.3, 0.05).setDepth(3800).setVisible(false);
    this.hintText = goldText(this, (L.cardX[0] + L.cardX[5]) / 2, L.hintY, TEXT.placeHint, 30, { title: false, colors: ['#ffffff', '#ffffff', '#ffe9b8'], thick: 0.22 }).setDepth(3800).setVisible(false);
    this.time.delayedCall(900, () => this.showHint());
  }

  showHint() {
    if (this.state !== 'place' || this.handTween || this.units.some((u) => u.side === 'p')) return;
    const from = { x: L.cardX[0], y: L.cardY - 20 };
    const to = cell(1, 1);
    this.hand.setVisible(true).setPosition(from.x, from.y).setAlpha(1);
    this.hintText.setVisible(true).setAlpha(1);
    this.handTween = this.tweens.chain({
      targets: this.hand,
      loop: -1,
      tweens: [
        { x: from.x, y: from.y, scale: 1, duration: 10 },
        { scale: 0.85, duration: 220 },
        { x: to.x, y: to.y - 30, duration: 900, ease: 'Sine.InOut' },
        { scale: 1, duration: 220 },
        { alpha: 0, duration: 250 },
        { alpha: 1, duration: 10, delay: 300 },
      ],
    });
    this.tweens.add({ targets: this.hintText, scale: 1.05, duration: 600, yoyo: true, repeat: -1 });
  }

  hideHint() {
    if (!this.handTween) return;
    this.handTween.stop();
    this.handTween = null;
    this.hand.setVisible(false);
    this.hintText.setVisible(false);
  }

  checkIdle() {
    if (this.state === 'end') return;
    const idle = this.time.now - this.lastInputAt;
    if (this.state === 'place' && idle > AD.idleHintMs) this.showHint();
    if (idle > AD.idleEndMs) this.finish(false, true);
  }

  /* ─────────────────────────── battle ─────────────────────────── */

  onFight(enabled) {
    if (this.state !== 'place') return;
    this.lastInputAt = this.time.now;
    sfx.unlock();
    if (!enabled) {
      this.toast(TEXT.needUnit);
      return;
    }
    this.startBattle();
  }

  async startBattle() {
    this.state = 'battle';
    this.selected = null;
    this.hideHint();
    this.redrawBoard();
    sfx.horn();
    this.tweens.add({ targets: [...this.cards, this.fightBtn], y: '+=320', alpha: 0, duration: 400, ease: 'Back.In' });
    this.tweens.add({ targets: [this.instr, this.logo], alpha: 0, duration: 300 });
    this.battle = new Battle(this, this.units);
    this.round = 0;
    await wait(this, 300);
    this.nextRound();
  }

  async nextRound() {
    if (this.state !== 'battle') return;
    this.round += 1;
    await banner(this, L.bannerY, TEXT.round(this.round), { color: 0xb3121f, hold: 380 });
    await this.battle.sideTurn('p');
    if (await this.checkEnd()) return;
    await wait(this, 150);
    await banner(this, L.bannerY, TEXT.enemyTurn, { color: 0x2c4f8f, hold: 260 });
    await this.battle.sideTurn('e');
    if (await this.checkEnd()) return;
    if (this.round >= MAX_ROUNDS) {
      const hp = (s) => this.battle.alive(s).reduce((n, u) => n + u.hp / u.maxHp, 0);
      this.finish(hp('p') >= hp('e'));
      return;
    }
    this.promptAttack();
  }

  promptAttack() {
    const btn = makeButton(this, L.attack.x, L.attack.y, TEXT.attack, { w: L.attack.w, size: Math.round(L.attack.w * 0.115), onTap: () => go() }).setDepth(3600);
    btn.setScale(0);
    this.tweens.add({ targets: btn, scale: 1, duration: 300, ease: 'Back.Out', onComplete: () => this.tweens.add({ targets: btn, scale: 1.06, duration: 500, yoyo: true, repeat: -1 }) });
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      this.lastInputAt = this.time.now;
      timer.remove();
      sfx.click();
      this.tweens.killTweensOf(btn);
      this.tweens.add({ targets: btn, scale: 0, duration: 180, onComplete: () => btn.destroy() });
      this.nextRound();
    };
    const timer = this.time.delayedCall(AD.autoRoundMs, go);
  }

  async checkEnd() {
    await wait(this, 450); // let death animations play
    const r = this.battle.over();
    if (!r) return false;
    if (r === 'win') await this.storm();
    this.finish(r === 'win');
    return true;
  }

  // Victory: the army rushes the castle and it collapses.
  async storm() {
    const cam = this.cameras.main;
    sfx.horn();
    const alive = this.battle.alive('p');
    alive.forEach((u) => this.tweens.add({ targets: u.pos, lift: 18 * u.pos.s, duration: 160, yoyo: true, repeat: 3 }));
    cam.pan(L.pan[0], L.pan[1], 600, 'Sine.easeInOut');
    cam.zoomTo(1.25, 600, 'Sine.easeInOut');
    await wait(this, 700);
    sfx.collapse();
    cam.shake(900, 0.012);
    this.tweens.add({ targets: this.castle, x: this.castle.x + 6, duration: 50, yoyo: true, repeat: 8 });
    await wait(this, 450);
    this.castle.setTexture('kale-yikik');
    for (let i = 0; i < 4; i++) this.time.delayedCall(i * 120, () => this.fx.dust(this.castle.x + (Math.random() - 0.5) * 160, this.castle.y - Math.random() * 120, 2.2, 12));
    const rubble = this.add
      .particles(this.castle.x, this.castle.y - 120, 'smoke', {
        speed: { min: 80, max: 300 },
        angle: { min: 200, max: 340 },
        gravityY: 500,
        scale: { start: 0.25, end: 0.05 },
        tint: [0x8a867c, 0x5f5c56, 0xb9a682],
        lifespan: 1100,
        emitting: false,
      })
      .setDepth(70);
    rubble.explode(40);
    await wait(this, 1100);
    cam.pan(W / 2, H / 2, 500, 'Sine.easeInOut');
    cam.zoomTo(1, 500, 'Sine.easeInOut');
    await banner(this, L.bannerY, TEXT.victory, { color: 0xb3121f, hold: 700 });
  }

  finish(won, idle = false) {
    if (this.state === 'end') return;
    this.state = 'end';
    this.hideHint();
    notifyGameEnd();
    if (won) sfx.win();
    else if (!idle) sfx.lose();
    sfx.musicVolume(0.35, 1);
    const army = this.units.filter((u) => u.side === 'p').map((u) => u.def.art);
    const show = () =>
      new EndCard(this, {
        won,
        army: army.length ? army : TYPES,
        onReplay: () => {
          sfx.musicVolume(0.6);
          this.scene.restart();
        },
      });
    if (!won && !idle) banner(this, L.bannerY, TEXT.defeat, { color: 0x3a3a3a, hold: 700 }).then(show);
    else show();
  }

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    this.units.forEach((u) => u.update(dt));
  }
}

export { tweenP };
