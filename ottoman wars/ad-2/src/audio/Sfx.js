// Synthesised sound effects (no audio files). Starts on the first touch.

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.muted = false;
    this.last = {};
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  suspend() {
    this.ctx?.suspend();
  }

  resume() {
    if (this.ctx && !this.muted) this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    if (m) this.ctx.suspend();
    else this.ctx.resume();
  }

  get ok() {
    return this.ctx && this.ctx.state === 'running';
  }

  // rate-limit a named sound
  gate(name, ms) {
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < ms) return false;
    this.last[name] = now;
    return true;
  }

  tone(f0, f1, dur, { type = 'sine', gain = 0.2, delay = 0, attack = 0.005 } = {}) {
    if (!this.ok) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur, { gain = 0.2, freq = 1000, q = 1, type = 'bandpass', delay = 0, attack = 0.004, sweep = 0 } = {}) {
    if (!this.ok) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweep), t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  // brassy note (mehter-ish horn)
  horn(f, dur, delay = 0, gain = 0.13) {
    if (!this.ok) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 0.97, t);
    o.frequency.linearRampToValueAtTime(f, t + 0.06);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(600, t);
    lp.frequency.linearRampToValueAtTime(2400, t + 0.08);
    lp.frequency.linearRampToValueAtTime(1400, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.04);
    g.gain.setValueAtTime(gain, t + dur - 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  drum(delay = 0, gain = 0.5) {
    this.tone(110, 45, 0.35, { gain, delay, attack: 0.002 });
    this.noise(0.12, { gain: gain * 0.4, freq: 300, q: 0.7, delay, type: 'lowpass' });
  }

  /* ── game sounds ── */
  gateGood(big) {
    const base = big ? 523 : 440;
    [0, 4, 7, 12].forEach((s, i) => this.tone(base * 2 ** (s / 12), base * 2 ** (s / 12) * 1.01, 0.28, { type: 'triangle', gain: 0.12, delay: i * 0.055 }));
    this.noise(0.4, { gain: 0.06, freq: 5000, q: 0.6, sweep: 9000 });
  }

  gateBad() {
    this.tone(300, 120, 0.4, { type: 'sawtooth', gain: 0.1 });
    this.tone(220, 90, 0.45, { type: 'square', gain: 0.05, delay: 0.05 });
  }

  pop() {
    if (!this.gate('pop', 35)) return;
    this.tone(700 + Math.random() * 500, 1400, 0.07, { type: 'sine', gain: 0.06 });
  }

  clash() {
    if (!this.gate('clash', 45)) return;
    const f = 1800 + Math.random() * 1600;
    this.tone(f, f * 0.93, 0.18, { type: 'square', gain: 0.035 });
    this.tone(f * 1.51, f * 1.4, 0.14, { type: 'sine', gain: 0.04 });
    this.noise(0.08, { gain: 0.12, freq: 3500, q: 1.2 });
  }

  poof() {
    if (!this.gate('poof', 40)) return;
    this.noise(0.18, { gain: 0.1, freq: 900, q: 0.8, sweep: 300 });
  }

  wood() {
    if (!this.gate('wood', 60)) return;
    this.noise(0.14, { gain: 0.16, freq: 600, q: 2 });
    this.tone(180, 90, 0.12, { type: 'triangle', gain: 0.12 });
  }

  arrow() {
    if (!this.gate('arrow', 70)) return;
    this.noise(0.35, { gain: 0.05, freq: 2500, q: 6, sweep: 900 });
  }

  boom(big = false) {
    this.tone(big ? 90 : 120, 35, big ? 1.0 : 0.45, { gain: big ? 0.6 : 0.4, attack: 0.002 });
    this.noise(big ? 1.2 : 0.35, { gain: big ? 0.35 : 0.2, freq: big ? 500 : 700, q: 0.6, type: 'lowpass', sweep: 80 });
  }

  charge() {
    // war cry: drum roll + rising horn
    for (let i = 0; i < 6; i++) this.drum(i * 0.09, 0.3 + i * 0.05);
    this.horn(294, 0.35, 0.1);
    this.horn(392, 0.55, 0.42);
  }

  victory() {
    const n = [392, 494, 587, 784];
    n.forEach((f, i) => this.horn(f, i === 3 ? 0.9 : 0.2, i * 0.18, 0.14));
    this.horn(587, 0.9, 0.54, 0.08);
    [0, 0.45, 0.9, 1.1].forEach((d) => this.drum(d, 0.45));
    this.noise(1.6, { gain: 0.06, freq: 6000, q: 0.4, delay: 0.5 });
  }

  defeat() {
    [392, 349, 311, 262].forEach((f, i) => this.horn(f, i === 3 ? 0.8 : 0.3, i * 0.3, 0.1));
  }

  tap() {
    this.tone(880, 1320, 0.08, { type: 'triangle', gain: 0.08 });
  }
}

export const sfx = new Sfx();
