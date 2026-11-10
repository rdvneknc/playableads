import Phaser from 'phaser';
import { SLOT } from '../config.js';

const N = 5; // sprites in the strip: 3 visible + 1 buffer above/below
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// One vertical strip that really scrolls: sprites wrap from bottom to top and
// receive a new symbol each time they wrap. While fast, motion-blur textures are used.
export class Reel {
  constructor(scene, x, y, symbolKeys, index, size, hitW) {
    this.scene = scene;
    this.index = index;
    this.keys = symbolKeys;
    this.size = size;
    this.state = 'idle'; // idle | spinning | stopping
    this.pos = 0;
    this.speed = 0;
    this.blurred = false;
    this.startedAt = 0;
    this.final = null;
    this.finalByIndex = null;
    this.onLanded = null;

    this.container = scene.add.container(x, y).setDepth(15);
    this.sprites = [];
    for (let i = 0; i < N; i++) {
      const img = scene.add.image(0, 0, pick(symbolKeys));
      img.baseKey = img.texture.key;
      this.fit(img);
      this.sprites.push(img);
      this.container.add(img);
    }
    this.prevY = this.sprites.map(() => 0);
    this.layout(true);

    // Invisible hit area so the player can tap a reel to stop it
    this.hit = scene.add
      .rectangle(x, y, hitW - 8, size * SLOT.rowsVisible, 0xffffff, 0.001)
      .setDepth(18)
      .setInteractive({ useHandCursor: true });

    scene.events.on('update', this.update, this);
    scene.events.once('shutdown', () => scene.events.off('update', this.update, this));
  }

  fit(img) {
    const s = this.size - 10;
    img.setDisplaySize(s, s);
    img.baseScale = img.scaleX;
  }

  setSymbol(img, key, blurred = this.blurred) {
    img.baseKey = key;
    img.setTexture(blurred ? `${key}_blur` : key);
    this.fit(img);
  }

  yFor(i, pos = this.pos) {
    const s = this.size;
    const span = N * s;
    let v = (i * s + pos + 2.5 * s) % span;
    if (v < 0) v += span;
    return v - 2.5 * s;
  }

  layout(reset = false) {
    for (let i = 0; i < N; i++) {
      const y = this.yFor(i);
      const spr = this.sprites[i];
      if (!reset && y < this.prevY[i] - this.size) this.onWrap(i);
      spr.y = y;
      this.prevY[i] = y;
    }
  }

  onWrap(i) {
    const spr = this.sprites[i];
    if (this.state === 'stopping' && this.finalByIndex?.[i]) this.setSymbol(spr, this.finalByIndex[i], false);
    else this.setSymbol(spr, pick(this.keys));
  }

  setBlur(on) {
    if (this.blurred === on) return;
    this.blurred = on;
    this.sprites.forEach((s) => this.setSymbol(s, s.baseKey, on));
  }

  update(time, delta) {
    if (this.state !== 'spinning') return;
    this.pos += (this.speed * delta) / 1000;
    if (this.speed > SLOT.reelSpeed * 0.5) this.setBlur(true);
    this.layout();
  }

  start(finalSymbols, onLanded) {
    if (this.state !== 'idle') return false;
    this.final = finalSymbols;
    this.onLanded = onLanded;
    this.stopRequested = false;
    this.startedAt = this.scene.time.now;
    this.scene.tweens.killTweensOf(this);

    // Wind-up: nudge up a little, then accelerate down.
    this.state = 'windup';
    this.scene.tweens.add({
      targets: this,
      pos: this.pos - this.size * 0.22,
      duration: 130,
      ease: 'Sine.Out',
      onUpdate: () => this.layout(),
      onComplete: () => {
        this.state = 'spinning';
        this.speed = 0;
        this.scene.tweens.add({ targets: this, speed: SLOT.reelSpeed, duration: 260, ease: 'Quad.In' });
      },
    });
    return true;
  }

  get spinning() {
    return this.state === 'spinning' || this.state === 'windup';
  }

  canStop() {
    return this.spinning && this.scene.time.now - this.startedAt >= SLOT.minSpinMs;
  }

  stop(deferred = false) {
    if (this.stopRequested && !deferred) return false;
    if (this.state === 'windup' || (this.state === 'spinning' && !this.canStop())) {
      // Too early — stop as soon as the minimum spin time has passed.
      this.stopRequested = true;
      const wait = Math.max(30, SLOT.minSpinMs - (this.scene.time.now - this.startedAt));
      this.scene.time.delayedCall(wait, () => this.stop(true));
      return true;
    }
    if (this.state !== 'spinning') return false;
    this.stopRequested = true;

    const s = this.size;
    this.scene.tweens.killTweensOf(this);
    this.state = 'stopping';
    this.speed = SLOT.reelSpeed;

    // Land 3 cells + the remainder of the current cell further down.
    const targetCells = Math.ceil(this.pos / s) + 3;
    const target = targetCells * s;
    const travel = target - this.pos;

    // Decide which sprite ends on which row and give it the scripted symbol,
    // either now (if it won't wrap again before landing) or when it wraps.
    this.finalByIndex = {};
    for (let i = 0; i < N; i++) {
      const row = Math.round(this.yFor(i, target) / s);
      const key = row >= -1 && row <= 1 ? this.final[row + 1] : pick(this.keys);
      this.finalByIndex[i] = key;
      const wraps = this.yFor(i) + travel >= 2.5 * s;
      if (!wraps) this.setSymbol(this.sprites[i], key, false);
    }

    const ease = (t) => {
      const c1 = 0.9;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };
    // ease'(0) ≈ 3.9 → match the current reel speed at the start of the stop
    const duration = (travel / SLOT.reelSpeed) * 1000 * 3.9;
    this.scene.tweens.add({
      targets: this,
      pos: target,
      duration,
      ease,
      onUpdate: (tw) => {
        if (tw.progress > 0.35) this.setBlur(false);
        this.layout();
      },
      onComplete: () => this.land(),
    });
    return true;
  }

  land() {
    this.setBlur(false);
    this.layout();
    this.state = 'idle';
    this.speed = 0;
    // Normalize position so numbers stay small
    const span = N * this.size;
    this.pos = ((this.pos % span) + span) % span;
    this.layout(true);
    const cb = this.onLanded;
    this.onLanded = null;
    cb?.();
  }

  // Sprite currently shown on a given row (-1 top, 0 middle, 1 bottom)
  spriteAt(row) {
    return this.sprites.find((s) => Math.round(s.y / this.size) === row);
  }

  getWindow() {
    return [-1, 0, 1].map((r) => this.spriteAt(r)?.baseKey);
  }

  pulse(row = 0, repeat = 3) {
    const spr = this.spriteAt(row);
    if (!spr) return;
    this.scene.tweens.add({
      targets: spr,
      scale: spr.baseScale * 1.14,
      duration: 180,
      yoyo: true,
      repeat,
      ease: 'Sine.InOut',
      onComplete: () => spr.setScale(spr.baseScale),
    });
  }
}
