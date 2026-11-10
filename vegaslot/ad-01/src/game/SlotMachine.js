import { SLOT } from '../config.js';
import { Reel } from './Reel.js';

// 3-reel controller with tap-to-stop and last-reel anticipation.
// Outcomes are scripted for the ad: near miss → win → jackpot.
export class SlotMachine {
  constructor(scene, windowRect) {
    this.scene = scene;
    this.windowRect = windowRect;
    this.busy = false;
    this.spinIndex = 0;
    this.timers = [];
    this.handlers = {};

    const { x, y, w, h } = windowRect;
    const colW = w / SLOT.reelCount;
    const symbolSize = Math.min(SLOT.symbolSize, colW - 10, h / SLOT.rowsVisible - 6);
    this.symbolSize = symbolSize;
    this.colW = colW;
    this.midY = y + h / 2;

    this.reels = [];
    for (let i = 0; i < SLOT.reelCount; i++) {
      const rx = x + colW / 2 + i * colW;
      const reel = new Reel(scene, rx, this.midY, SLOT.symbolKeys, i, symbolSize, colW);
      reel.hit.on('pointerdown', () => this.handlers.onTapReel?.(i));
      this.reels.push(reel);
    }

    const maskShape = scene.make.graphics({ x: 0, y: 0, add: false });
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(x + 4, y + 4, w - 8, h - 8);
    const mask = maskShape.createGeometryMask();
    this.reels.forEach((r) => r.container.setMask(mask));
  }

  reelX(i) {
    return this.reels[i].container.x;
  }

  nextOutcome() {
    const k = SLOT.symbolKeys; // bull, fox, lion(wild), panda, tiger, wolf
    const wild = SLOT.wildKey;
    const i = Math.min(this.spinIndex, 2);
    this.spinIndex += 1;

    if (i === 0) {
      // Near miss — fox, fox, (tiger). Lion is wild, keep it off the payline.
      return [
        [k[5], 'sym-fox', k[3]],
        [k[0], 'sym-fox', k[4]],
        ['sym-fox', 'sym-tiger', k[0]], // the fox sits just above the line → "so close"
      ];
    }
    if (i === 1) {
      return [
        [k[3], 'sym-fox', k[0]],
        [k[4], 'sym-fox', k[5]],
        [k[0], 'sym-fox', k[3]],
      ];
    }
    return [
      [k[4], wild, k[1]],
      [k[5], wild, k[3]],
      [k[1], wild, k[0]],
    ];
  }

  // handlers: { onReelStop(index, stoppedCount), onAnticipation(index), onDone(line), onTapReel(index) }
  spin(handlers) {
    if (this.busy) return false;
    Object.assign(this.handlers, handlers);
    this.busy = true;
    this.stoppedCount = 0;
    this.anticipating = false;
    const outcome = this.nextOutcome();

    this.timers.forEach((t) => t.remove(false));
    this.reels.forEach((reel, i) => {
      this.scene.time.delayedCall(i * SLOT.reelStaggerMs, () => reel.start(outcome[i], () => this.onReelLanded(i)));
    });
    // The last reel waits for the others (so it can tease); the rest stop on a schedule.
    const last = this.reels.length - 1;
    this.timers = this.reels.map((reel, i) =>
      this.scene.time.delayedCall(i === last ? 8000 : SLOT.autoStopMs[i], () => reel.stop()),
    );
    return true;
  }

  onReelLanded(index) {
    this.stoppedCount += 1;
    this.handlers.onReelStop?.(index, this.stoppedCount);

    if (this.stoppedCount === this.reels.length - 1) this.maybeAnticipate();

    if (this.stoppedCount === this.reels.length) {
      this.busy = false;
      this.anticipating = false;
      this.handlers.onDone?.(this.readPayline());
    }
  }

  // Two matching symbols on the line and one reel still running → stretch it.
  maybeAnticipate() {
    const idx = this.reels.findIndex((r) => r.state !== 'idle');
    if (idx < 0 || this.reels[idx].state === 'stopping') return;
    const landed = this.reels.filter((r) => r.state === 'idle').map((r) => r.getWindow()[1]);
    const tease = this.isWin(landed);
    this.timers[idx]?.remove(false);
    this.timers[idx] = this.scene.time.delayedCall(tease ? SLOT.anticipationMs : SLOT.lastReelGapMs, () => this.reels[idx].stop());
    if (!tease) return;
    this.anticipating = true;
    this.handlers.onAnticipation?.(idx);
  }

  // Player tapped SPIN while running → stop the left-most running reel.
  stopNext() {
    if (!this.busy) return false;
    const reel = this.reels.find((r) => r.spinning && !r.stopRequested);
    return reel ? reel.stop() : false;
  }

  stopReel(i) {
    if (!this.busy) return false;
    return this.reels[i].stop();
  }

  readPayline() {
    return this.reels.map((r) => r.getWindow()[1]);
  }

  isWin(line) {
    if (!line?.length) return false;
    const wild = SLOT.wildKey;
    const base = line.find((k) => k !== wild) || wild;
    return line.every((k) => k === base || k === wild);
  }

  isJackpot(line) {
    return line.every((k) => k === SLOT.wildKey);
  }
}
