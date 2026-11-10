import Phaser from 'phaser';
import { UNITS, ENEMY_MULT, FONT, BOARD, TEXT } from '../config.js';
import { cell } from './Board.js';
import { sfx } from '../audio/Sfx.js';

export const wait = (scene, ms) => new Promise((r) => scene.time.delayedCall(ms, r));
export const tweenP = (scene, cfg) => new Promise((r) => scene.tweens.add({ ...cfg, onComplete: (...a) => (cfg.onComplete?.(...a), r()) }));

// One soldier on the board. Single sprite; every motion is code-driven.
export class Unit {
  constructor(scene, type, side, row, col) {
    const def = UNITS[type];
    this.scene = scene;
    this.type = type;
    this.def = def;
    this.side = side; // 'p' | 'e'
    this.dir = side === 'p' ? 1 : -1;
    this.row = row;
    this.col = col;
    const m = side === 'e' ? ENEMY_MULT : { hp: 1, atk: 1 };
    this.maxHp = Math.round(def.hp * m.hp);
    this.hp = this.maxHp;
    this.atk = Math.round(def.atk * m.atk);
    this.alive = true;
    this.t = Math.random() * 10;

    const p = cell(row, col);
    this.pos = { x: p.x, y: p.y, s: p.s, lift: 0, rot: 0, lean: 0, sx: 1, sy: 1 };

    this.shadow = scene.add.image(p.x, p.y, 'shadow');
    this.ring = scene.add.ellipse(p.x, p.y, 10, 10).setStrokeStyle(4, side === 'p' ? 0xd62c3a : 0x3b7be0, 0.9);
    this.spr = scene.add.image(p.x, p.y, `${def.art}-u`).setOrigin(0.5, 0.97);
    this.spr.setFlipX(side === 'e');
    this.baseScale = def.h / this.spr.height;
    this.hpBar = scene.add.graphics();
    this.update(0);
  }

  setActive(on) {
    this.isActive = on;
    if (!on && this.ring.active) this.ring.setStrokeStyle(4, this.side === 'p' ? 0xd62c3a : 0x3b7be0, 0.9);
  }

  async walk(path) {
    for (const [r, c] of path) await this.moveTo(r, c);
  }

  tagText(tag) {
    if (!tag) return;
    const str = tag === 'charge' ? TEXT.charge : TEXT.crit;
    this.scene.fx.floatText(str, this.pos.x, this.pos.y - this.height - 34 * this.pos.s, tag === 'charge' ? '#ffd36b' : '#ff9d5c', 26);
  }

  // Quick strike back after being hit in melee.
  async counter(target, dmg) {
    await tweenP(this.scene, { targets: this.pos, lean: 18 * this.pos.s, rot: 8, duration: 110, ease: 'Cubic.In' });
    this.scene.fx.slash(target.pos.x, target.pos.y - target.height * 0.55, target.pos.s, this.dir);
    sfx.clash();
    this.scene.fx.floatText(TEXT.counter, this.pos.x, this.pos.y - this.height - 34 * this.pos.s, '#e8e0cf', 18);
    target.hit(dmg, this.dir);
    await tweenP(this.scene, { targets: this.pos, lean: 0, rot: 0, duration: 200, ease: 'Sine.Out' });
  }

  get height() {
    return this.def.h * this.pos.s;
  }

  update(dt) {
    if (!this.spr.active) return;
    this.t += dt;
    const { x, y, s, lift, rot, lean, sx, sy } = this.pos;
    const breathe = this.alive && this.def.kind !== 'cannon' ? Math.sin(this.t * (this.def.move > 2 ? 2.4 : 2)) * 0.012 : 0;
    const sc = this.baseScale * s;
    this.spr.setPosition(x + lean * this.dir, y - lift);
    this.spr.setScale(sc * sx * (1 - breathe * 0.5), sc * sy * (1 + breathe));
    this.spr.setAngle(rot * this.dir);
    const depth = 100 + y;
    this.spr.setDepth(depth);
    const wide = ['cavalry', 'horsearcher', 'cannon'].includes(this.def.kind);
    const w = (wide ? 160 : 96) * s;
    this.shadow.setPosition(x + 6 * s, y + 2).setDisplaySize(w * (1 - lift / 300), w * 0.3).setDepth(depth - 2);
    this.ring.setPosition(x, y).setSize(w * 0.86, w * 0.26).setDepth(depth - 1);
    this.ring.setDisplayOrigin(this.ring.width / 2, this.ring.height / 2);
    if (this.isActive) {
      this.ring.setStrokeStyle(5, 0xffe27a, 0.6 + 0.4 * Math.abs(Math.sin(this.t * 8)));
    }
    this.drawHp(x, y - this.height - 14 * s - lift, s);
  }

  drawHp(x, y, s) {
    const g = this.hpBar;
    g.clear();
    if (!this.alive) return;
    const w = 90 * s;
    const h = 12 * s;
    const pct = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    g.setDepth(2000);
    g.fillStyle(0x000000, 0.55);
    g.fillRoundedRect(x - w / 2 - 2, y - 2, w + 4, h + 4, 4);
    g.fillStyle(this.side === 'p' ? 0xe0313f : 0x3d7fe6, 1);
    g.fillRoundedRect(x - w / 2, y, Math.max(2, w * pct), h, 3);
    g.fillStyle(0xffffff, 0.3);
    g.fillRect(x - w / 2 + 2, y + 1, Math.max(0, w * pct - 4), h * 0.35);
  }

  // Drop onto the board when placed.
  async dropIn() {
    this.pos.lift = 260;
    this.spr.setAlpha(0);
    this.scene.tweens.add({ targets: this.spr, alpha: 1, duration: 120 });
    await tweenP(this.scene, { targets: this.pos, lift: 0, duration: 320, ease: 'Quad.In' });
    sfx.place();
    this.scene.fx.dust(this.pos.x, this.pos.y, this.pos.s, 10);
    this.pos.sy = 0.82;
    this.pos.sx = 1.12;
    await tweenP(this.scene, { targets: this.pos, sx: 1, sy: 1, duration: 260, ease: 'Back.Out' });
  }

  async moveTo(row, col) {
    const to = cell(row, col);
    this.row = row;
    this.col = col;
    const cav = this.def.move > 2;
    const dur = cav ? 190 : 260;
    if (cav) sfx.gallop();
    else sfx.step();
    const hop = { v: 0 };
    const rock = this.scene.tweens.add({ targets: this.pos, rot: cav ? -5 : 3, duration: dur / 4, yoyo: true, repeat: 1, ease: 'Sine.InOut' });
    await tweenP(this.scene, {
      targets: [this.pos],
      x: to.x,
      y: to.y,
      s: to.s,
      duration: dur,
      ease: 'Sine.InOut',
      onUpdate: (tw) => {
        hop.v = Math.abs(Math.sin(tw.progress * Math.PI * (cav ? 3 : 2)));
        this.pos.lift = hop.v * (cav ? 16 : 12) * this.pos.s;
        if (cav && Math.random() < 0.3) this.scene.fx.dust(this.pos.x - 30 * this.dir * this.pos.s, this.pos.y, this.pos.s * 0.6, 1);
      },
    });
    rock.remove();
    this.pos.rot = 0;
    this.pos.lift = 0;
  }

  // Melee: wind up, dash in, slash, come back.
  async melee(target, dmg, tag = null) {
    const cav = this.def.move > 2;
    const home = { x: this.pos.x, y: this.pos.y, s: this.pos.s };
    await tweenP(this.scene, { targets: this.pos, rot: cav ? -10 : -9, lean: -14 * this.pos.s, duration: 160, ease: 'Sine.Out' });
    sfx.swing();
    const tx = target.pos.x - this.dir * (cav ? 95 : 70) * target.pos.s;
    await tweenP(this.scene, {
      targets: this.pos,
      x: tx,
      y: target.pos.y + 2,
      s: target.pos.s,
      rot: cav ? 9 : 12,
      lean: 10 * this.pos.s,
      duration: cav ? 170 : 140,
      ease: 'Cubic.In',
    });
    this.scene.fx.slash(target.pos.x, target.pos.y - target.height * 0.55, target.pos.s, this.dir);
    sfx.clash();
    target.hit(dmg, this.dir);
    this.tagText(tag);
    await wait(this.scene, 120);
    await tweenP(this.scene, { targets: this.pos, x: home.x, y: home.y, s: home.s, rot: 0, lean: 0, duration: 260, ease: 'Sine.InOut' });
  }

  // Ranged: draw the bow, loose a volley, the first arrow deals the damage.
  async shoot(target, dmg, tag = null) {
    await tweenP(this.scene, { targets: this.pos, lean: -8 * this.pos.s, sx: 0.96, duration: 220, ease: 'Sine.Out' });
    sfx.bow();
    this.pos.lean = 6 * this.pos.s;
    this.pos.sx = 1.03;
    this.scene.tweens.add({ targets: this.pos, lean: 0, sx: 1, duration: 260, ease: 'Sine.Out' });
    const horse = this.def.kind === 'horsearcher';
    const sx = this.pos.x + this.dir * (horse ? 95 : 70) * this.pos.s;
    const sy = this.pos.y - this.height * (horse ? 0.72 : 0.66);
    const tx = target.pos.x;
    const ty = target.pos.y - target.height * 0.5;
    const shots = [0, 1, 2].map((i) =>
      this.scene.fx.arrow(sx, sy - i * 6, tx + (i ? (Math.random() - 0.5) * 40 : 0), ty + (i ? (Math.random() - 0.5) * 30 : 0), i * 70, this.pos.s),
    );
    await shots[0];
    sfx.thunk();
    target.hit(dmg, this.dir);
    this.tagText(tag);
    await Promise.all(shots);
    await wait(this.scene, 120);
  }

  // Musket: aim, flash + smoke at the muzzle, a fast tracer, recoil.
  async fire(target, dmg, tag = null) {
    await tweenP(this.scene, { targets: this.pos, lean: -4 * this.pos.s, rot: -2, duration: 260, ease: 'Sine.Out' });
    const mx = this.pos.x + this.dir * 118 * this.pos.s;
    const my = this.pos.y - this.height * 0.74;
    sfx.musket();
    this.scene.fx.muzzle(mx, my, this.pos.s, this.dir);
    this.pos.lean = -16 * this.pos.s;
    this.pos.rot = -5;
    this.scene.tweens.add({ targets: this.pos, lean: 0, rot: 0, duration: 380, ease: 'Sine.Out' });
    await this.scene.fx.tracer(mx, my, target.pos.x, target.pos.y - target.height * 0.55);
    target.hit(dmg, this.dir);
    this.tagText(tag);
    await wait(this.scene, 260);
  }

  // Cannon: recoil, big smoke, ballistic ball, explosion with splash.
  async cannon(target, dmg, splash = []) {
    await tweenP(this.scene, { targets: this.pos, sx: 0.97, sy: 1.03, duration: 240, ease: 'Sine.Out' });
    const mx = this.pos.x + this.dir * 150 * this.pos.s;
    const my = this.pos.y - this.height * 0.66;
    sfx.cannon();
    this.scene.fx.muzzle(mx, my, this.pos.s * 1.8, this.dir);
    this.scene.cameras.main.shake(160, 0.006);
    this.pos.sx = 1;
    this.pos.sy = 1;
    this.pos.lean = -26 * this.pos.s;
    this.scene.tweens.add({ targets: this.pos, lean: 0, duration: 600, ease: 'Cubic.Out' });
    const tx = target.pos.x;
    const ty = target.pos.y - target.height * 0.35;
    await this.scene.fx.ball(mx, my, tx, ty, this.pos.s);
    sfx.boom();
    this.scene.fx.explosion(tx, target.pos.y, target.pos.s);
    target.hit(dmg, this.dir);
    splash.forEach((x) => x.u.alive && x.u.hit(x.dmg, this.dir));
    await wait(this.scene, 300);
  }

  hit(dmg, fromDir) {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.scene.fx.damage(dmg, this.pos.x, this.pos.y - this.height - 30 * this.pos.s);
    this.scene.fx.sparks(this.pos.x, this.pos.y - this.height * 0.55, this.pos.s);
    this.spr.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => this.spr.active && this.spr.setTint(0xff7a7a));
    this.scene.time.delayedCall(200, () => this.spr.active && this.spr.clearTint());
    const kb = { v: 0 };
    this.scene.tweens.add({
      targets: kb,
      v: 1,
      duration: 260,
      onUpdate: () => (this.pos.lean = Math.sin(kb.v * Math.PI) * 16 * this.pos.s * fromDir * this.dir),
      onComplete: () => (this.pos.lean = 0),
    });
    sfx.hurt();
    this.scene.cameras.main.shake(90, 0.004);
    if (this.hp <= 0) this.die(fromDir);
  }

  async die(fromDir) {
    this.alive = false;
    this.hpBar.clear();
    sfx.fall();
    await wait(this.scene, 140);
    this.scene.tweens.add({ targets: this.ring, alpha: 0, duration: 300 });
    await tweenP(this.scene, { targets: this.pos, rot: 84 * fromDir * this.dir, lift: -6, duration: 420, ease: 'Quad.In' });
    this.scene.fx.dust(this.pos.x, this.pos.y, this.pos.s, 14);
    this.scene.cameras.main.shake(140, 0.005);
    await tweenP(this.scene, { targets: [this.spr, this.shadow], alpha: 0, duration: 500, delay: 250 });
    this.destroy();
  }

  destroy() {
    [this.spr, this.shadow, this.ring, this.hpBar].forEach((o) => o.destroy());
  }
}

export { BOARD, FONT };
