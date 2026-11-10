// Procedural WebAudio: SFX + a light looping tune. Zero asset weight.
class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.muted = false;
    this.lastPop = 0;
    this.music = null;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      this.ctx = new AC();
    } catch {
      return null;
    }
    const comp = this.ctx.createDynamicsCompressor();
    comp.connect(this.ctx.destination);
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(comp);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.55;
    this.musicBus.connect(this.master);
    const len = this.ctx.sampleRate * 0.5;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return this.ctx;
  }

  unlock() {
    this.ensure();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  suspend() {
    if (this.ctx?.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.85;
  }

  live() {
    if (this.muted) return null;
    const ctx = this.ensure();
    if (!ctx || ctx.state === 'closed' || document.hidden) return null;
    return ctx;
  }

  tone(freq, freqEnd, dur, { type = 'sine', gain = 0.2, delay = 0, attack = 0.008, bus = null, at = null } = {}) {
    const ctx = this.live();
    if (!ctx) return;
    const t0 = at ?? ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(bus || this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  noiseHit(dur, { gain = 0.2, from = 2000, to = 300, delay = 0, type = 'lowpass' } = {}) {
    const ctx = this.live();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  // Bubbly "bloop" — rate-limited so big gains don't turn into noise.
  pop(pitch = 1) {
    const ctx = this.live();
    if (!ctx) return;
    if (ctx.currentTime - this.lastPop < 0.035) return;
    this.lastPop = ctx.currentTime;
    const f = 520 * pitch;
    this.tone(f, f * 1.9, 0.09, { type: 'sine', gain: 0.12 });
  }

  squish() {
    const ctx = this.live();
    if (!ctx) return;
    if (ctx.currentTime - this.lastPop < 0.05) return;
    this.lastPop = ctx.currentTime;
    const f = 300 + Math.random() * 120;
    this.tone(f, f * 0.45, 0.1, { type: 'triangle', gain: 0.14 });
    this.noiseHit(0.06, { gain: 0.05, from: 3000, to: 800 });
  }

  gate(goodGate) {
    this.noiseHit(0.35, { gain: 0.12, from: 600, to: 4000, type: 'bandpass' });
    if (goodGate) {
      [660, 880, 1175].forEach((f, i) => this.tone(f, f, 0.22, { type: 'triangle', gain: 0.12, delay: 0.04 + i * 0.06 }));
    } else {
      this.tone(330, 160, 0.35, { type: 'triangle', gain: 0.16 });
    }
  }

  click() {
    this.tone(880, 1200, 0.06, { type: 'triangle', gain: 0.1 });
  }

  clash() {
    this.noiseHit(0.25, { gain: 0.18, from: 1500, to: 200 });
    this.tone(160, 70, 0.25, { type: 'sine', gain: 0.25 });
  }

  bossHit() {
    this.tone(220 + Math.random() * 60, 90, 0.12, { type: 'sine', gain: 0.22 });
    this.noiseHit(0.05, { gain: 0.06, from: 4000, to: 1500 });
  }

  bossPop() {
    this.noiseHit(0.7, { gain: 0.3, from: 3000, to: 120 });
    this.tone(120, 40, 0.6, { type: 'sine', gain: 0.4 });
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, f, 0.3, { type: 'triangle', gain: 0.12, delay: 0.25 + i * 0.07 }));
  }

  win() {
    const seq = [523, 659, 784, 1046, 784, 1046, 1318];
    seq.forEach((f, i) => {
      this.tone(f, f, 0.22, { type: 'square', gain: 0.05, delay: i * 0.1 });
      this.tone(f / 2, f / 2, 0.22, { type: 'triangle', gain: 0.1, delay: i * 0.1 });
    });
    this.tone(1568, 1568, 0.9, { type: 'triangle', gain: 0.1, delay: seq.length * 0.1 });
  }

  lose() {
    [392, 349, 311, 262].forEach((f, i) => this.tone(f, f * 0.97, 0.3, { type: 'triangle', gain: 0.14, delay: i * 0.18 }));
  }

  // ── music: 4-bar loop, bass + soft marimba arpeggio ──
  startMusic() {
    const ctx = this.live();
    if (!ctx || this.music) return;
    const bpm = 118;
    const step = 60 / bpm / 2; // eighth notes
    const chords = [
      [261.6, 329.6, 392.0], // C
      [220.0, 261.6, 329.6], // Am
      [174.6, 220.0, 261.6], // F
      [196.0, 246.9, 293.7], // G
    ];
    let n = 0;
    let next = ctx.currentTime + 0.1;
    const schedule = () => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 0.2) {
        const bar = Math.floor(n / 8) % 4;
        const s = n % 8;
        const ch = chords[bar];
        if (s % 4 === 0) this.tone(ch[0] / 2, ch[0] / 2, step * 1.8, { type: 'triangle', gain: 0.16, bus: this.musicBus, at: next });
        if (s % 4 === 2) this.tone(ch[0] / 2, ch[0] / 2, step * 0.8, { type: 'triangle', gain: 0.09, bus: this.musicBus, at: next });
        const arp = [0, 1, 2, 1, 2, 0, 1, 2][s];
        const f = ch[arp] * (s >= 4 ? 2 : 1);
        this.tone(f, f, step * 0.9, { type: 'sine', gain: 0.05, bus: this.musicBus, at: next, attack: 0.004 });
        if (s === 0 || s === 4) this.tone(f * 2, f * 2, step * 0.5, { type: 'sine', gain: 0.015, bus: this.musicBus, at: next });
        // soft hat
        if (s % 2 === 1) this.hat(next);
        next += step;
        n += 1;
      }
    };
    this.music = setInterval(schedule, 50);
    schedule();
  }

  hat(at) {
    const ctx = this.live();
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.025, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    src.start(at);
    src.stop(at + 0.06);
  }

  musicVolume(v, ramp = 0.5) {
    if (!this.musicBus || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, t);
    this.musicBus.gain.linearRampToValueAtTime(v, t + ramp);
  }
}

export const sfx = new Sfx();
