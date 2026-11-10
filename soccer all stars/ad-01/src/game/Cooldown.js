// Cooldown driven by the match's simulation clock, so it freezes while paused.
export class Cooldown {
  constructor(clock, durationMs) {
    this.clock = clock;
    this.durationMs = durationMs;
    this.readyAt = 0;
  }

  get ready() {
    return this.clock.now >= this.readyAt;
  }

  get remainingMs() {
    return Math.max(0, this.readyAt - this.clock.now);
  }

  // 0 = just used, 1 = ready
  get progress() {
    return 1 - this.remainingMs / this.durationMs;
  }

  trigger(durationMs = this.durationMs) {
    this.readyAt = this.clock.now + durationMs;
  }

  reset() {
    this.readyAt = 0;
  }
}

export class SimClock {
  constructor() {
    this.now = 0;
    this.timers = [];
  }

  advance(ms) {
    this.now += ms;
    if (!this.timers.length) return;
    const due = this.timers.filter((t) => t.at <= this.now);
    if (!due.length) return;
    this.timers = this.timers.filter((t) => t.at > this.now);
    due.forEach((t) => t.fn());
  }

  after(ms, fn) {
    const timer = { at: this.now + ms, fn };
    this.timers.push(timer);
    return timer;
  }

  cancel(timer) {
    this.timers = this.timers.filter((t) => t !== timer);
  }
}
