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
    this.musicBus.gain.value = 0.6;
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

  click() {
    this.tone(700, 950, 0.06, { type: 'triangle', gain: 0.1 });
  }

  place() {
    this.tone(140, 60, 0.18, { type: 'sine', gain: 0.35 });
    this.noiseHit(0.12, { gain: 0.12, from: 1200, to: 200 });
  }

  coin() {
    this.tone(1600, 1650, 0.1, { type: 'triangle', gain: 0.08 });
    this.tone(2400, 2400, 0.08, { type: 'sine', gain: 0.05, delay: 0.05 });
  }

  step() {
    this.noiseHit(0.06, { gain: 0.05, from: 900, to: 300 });
  }

  gallop() {
    [0, 0.09, 0.2, 0.29].forEach((d, i) => this.tone(110 - i * 6, 55, 0.08, { type: 'sine', gain: 0.22, delay: d }));
  }

  swing() {
    this.noiseHit(0.18, { gain: 0.14, from: 800, to: 4000, type: 'bandpass' });
  }

  clash() {
    const f = 1800 + Math.random() * 500;
    this.tone(f, f * 0.98, 0.35, { type: 'triangle', gain: 0.09 });
    this.tone(f * 1.51, f * 1.5, 0.25, { type: 'sine', gain: 0.05 });
    this.noiseHit(0.08, { gain: 0.18, from: 6000, to: 2000, type: 'highpass' });
  }

  bow() {
    this.tone(220, 520, 0.12, { type: 'triangle', gain: 0.08 });
    this.noiseHit(0.3, { gain: 0.08, from: 2500, to: 600, type: 'bandpass', delay: 0.05 });
  }

  thunk() {
    this.tone(260, 120, 0.08, { type: 'square', gain: 0.07 });
    this.noiseHit(0.05, { gain: 0.08, from: 1800, to: 500 });
  }

  hurt() {
    this.tone(160, 90, 0.16, { type: 'sawtooth', gain: 0.06 });
  }

  fall() {
    this.tone(120, 45, 0.35, { type: 'sine', gain: 0.3 });
    this.noiseHit(0.3, { gain: 0.12, from: 700, to: 120 });
  }

  horn() {
    // short battle horn
    [0, 0.32].forEach((d, i) => {
      const f = i ? 293.7 : 220;
      this.tone(f, f, 0.5, { type: 'sawtooth', gain: 0.05, delay: d, attack: 0.06 });
      this.tone(f * 2, f * 2, 0.5, { type: 'triangle', gain: 0.04, delay: d, attack: 0.06 });
    });
  }

  collapse() {
    this.noiseHit(1.4, { gain: 0.35, from: 900, to: 60 });
    this.tone(70, 30, 1.2, { type: 'sine', gain: 0.45 });
    for (let i = 0; i < 6; i++) this.noiseHit(0.12, { gain: 0.1, from: 2000, to: 400, delay: 0.2 + i * 0.13 });
  }

  win() {
    const seq = [293.7, 370, 440, 587.3, 440, 587.3, 740];
    seq.forEach((f, i) => {
      this.tone(f, f, 0.24, { type: 'sawtooth', gain: 0.035, delay: i * 0.13, attack: 0.02 });
      this.tone(f, f, 0.24, { type: 'triangle', gain: 0.08, delay: i * 0.13 });
    });
    this.tone(587.3, 587.3, 1.0, { type: 'triangle', gain: 0.1, delay: seq.length * 0.13 });
  }

  lose() {
    [392, 349, 311, 262].forEach((f, i) => this.tone(f, f * 0.97, 0.32, { type: 'triangle', gain: 0.12, delay: i * 0.2 }));
  }

  // ── music: davul pattern + a reedy melody in a Hicaz-flavoured scale ──
  startMusic() {
    const ctx = this.live();
    if (!ctx || this.music) return;
    const bpm = 104;
    const step = 60 / bpm / 2;
    const D = 146.8;
    const scale = [1, 16 / 15, 5 / 4, 4 / 3, 3 / 2, 8 / 5, 16 / 9, 2]; // D Eb F# G A Bb C D
    const mel = [4, null, 3, 2, 3, null, 1, 0, 2, null, 3, 4, 5, 4, 3, 2, 4, null, 3, 2, 1, null, 2, 1, 0, null, null, null, 0, 1, 2, 3];
    let n = 0;
    let next = ctx.currentTime + 0.1;
    const drum = (at, f, g) => this.tone(f, f * 0.5, 0.22, { type: 'sine', gain: g, bus: this.musicBus, at });
    const schedule = () => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 0.25) {
        const s = n % 8;
        if (s === 0 || s === 3 || s === 6) drum(next, 90, s === 0 ? 0.32 : 0.22);
        if (s === 4) drum(next, 150, 0.14);
        if (s % 2 === 1) this.hat(next);
        const deg = mel[n % mel.length];
        if (deg !== null && n >= 16) {
          const f = D * 2 * scale[deg];
          this.tone(f, f, step * 1.7, { type: 'sawtooth', gain: 0.018, bus: this.musicBus, at: next, attack: 0.03 });
          this.tone(f, f, step * 1.7, { type: 'square', gain: 0.01, bus: this.musicBus, at: next, attack: 0.03 });
        }
        if (n % 32 === 0) this.tone(D / 2, D / 2, step * 30, { type: 'triangle', gain: 0.05, bus: this.musicBus, at: next, attack: 0.4 });
        next += step;
        n += 1;
      }
    };
    this.music = setInterval(schedule, 60);
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
