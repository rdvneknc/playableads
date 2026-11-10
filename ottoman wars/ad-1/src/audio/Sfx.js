// Richer procedural WebAudio — layered hits, metal, drums. Zero asset weight.
class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.muted = false;
    this.music = null;
    this.noise = null;
    this.metal = null;
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

    const lim = this.ctx.createDynamicsCompressor();
    lim.threshold.value = -18;
    lim.knee.value = 18;
    lim.ratio.value = 6;
    lim.attack.value = 0.003;
    lim.release.value = 0.18;
    lim.connect(this.ctx.destination);

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(lim);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.master);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.55;
    this.musicBus.connect(this.master);

    this.noise = this.makeNoise(1.2);
    this.metal = this.makeMetalImpulse(0.55);
    return this.ctx;
  }

  makeNoise(sec) {
    const len = Math.floor(this.ctx.sampleRate * sec);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // lightly brown-ish noise (warmer body hits)
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = white * 0.55 + last * 0.45;
    }
    return buf;
  }

  // Resonant metallic impulse for sword clashes / armour.
  makeMetalImpulse(sec) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * sec);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const partials = [880, 1320, 1760, 2640, 3520, 4950];
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      let s = 0;
      for (let p = 0; p < partials.length; p++) {
        const f = partials[p] * (1 + (Math.random() - 0.5) * 0.01);
        const decay = Math.exp(-t * (6 + p * 3.2));
        s += Math.sin(2 * Math.PI * f * t) * decay * (1 / (p + 1.2));
      }
      s += (Math.random() * 2 - 1) * Math.exp(-t * 40) * 0.35;
      d[i] = s * 0.55;
    }
    return buf;
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
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  live() {
    if (this.muted) return null;
    const ctx = this.ensure();
    if (!ctx || ctx.state === 'closed' || document.hidden) return null;
    return ctx;
  }

  tone(freq, freqEnd, dur, {
    type = 'sine',
    gain = 0.2,
    delay = 0,
    attack = 0.008,
    release = null,
    bus = null,
    at = null,
    detune = 0,
  } = {}) {
    const ctx = this.live();
    if (!ctx) return;
    const t0 = at ?? ctx.currentTime + delay;
    const rel = release ?? dur * 0.55;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (detune) osc.detune.setValueAtTime(detune, t0);
    if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(attack + 0.02, rel));
    osc.connect(g);
    g.connect(bus || this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.04);
  }

  noiseHit(dur, {
    gain = 0.2,
    from = 2000,
    to = 300,
    delay = 0,
    type = 'lowpass',
    Q = 0.7,
    bus = null,
    buffer = null,
  } = {}) {
    const ctx = this.live();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = buffer || this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = Q;
    f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus || this.sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  // Soft body thump (boots / impact)
  thud(gain = 0.28, delay = 0) {
    this.tone(70, 38, 0.22, { type: 'sine', gain, delay, attack: 0.004, release: 0.2 });
    this.tone(110, 55, 0.14, { type: 'triangle', gain: gain * 0.35, delay, attack: 0.004 });
    this.noiseHit(0.1, { gain: gain * 0.35, from: 600, to: 80, delay });
  }

  click() {
    this.tone(880, 1200, 0.045, { type: 'triangle', gain: 0.07, attack: 0.002 });
    this.noiseHit(0.03, { gain: 0.04, from: 5000, to: 1800, type: 'highpass' });
  }

  place() {
    this.thud(0.32);
    this.noiseHit(0.14, { gain: 0.1, from: 1400, to: 180 });
    this.tone(220, 90, 0.12, { type: 'triangle', gain: 0.08, delay: 0.02 });
  }

  coin() {
    this.tone(1480, 1560, 0.09, { type: 'triangle', gain: 0.07, attack: 0.002 });
    this.tone(2220, 2360, 0.12, { type: 'sine', gain: 0.05, delay: 0.04 });
    this.tone(2960, 2960, 0.08, { type: 'sine', gain: 0.03, delay: 0.08 });
  }

  step() {
    this.noiseHit(0.07, { gain: 0.055, from: 1100, to: 220 });
    this.tone(95, 55, 0.07, { type: 'sine', gain: 0.12, attack: 0.003 });
  }

  gallop() {
    [0, 0.08, 0.18, 0.26].forEach((d, i) => {
      this.thud(0.2 - i * 0.015, d);
      this.noiseHit(0.05, { gain: 0.05, from: 900, to: 250, delay: d });
    });
  }

  swing() {
    this.noiseHit(0.16, { gain: 0.16, from: 500, to: 4500, type: 'bandpass', Q: 1.4 });
    this.noiseHit(0.1, { gain: 0.08, from: 3000, to: 8000, type: 'highpass', delay: 0.02 });
  }

  clash() {
    const ctx = this.live();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.metal;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.45, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t0);
    src.stop(t0 + 0.5);
    this.noiseHit(0.06, { gain: 0.16, from: 7000, to: 1800, type: 'highpass' });
    this.tone(240, 90, 0.1, { type: 'sine', gain: 0.1 });
  }

  bow() {
    this.tone(180, 640, 0.1, { type: 'triangle', gain: 0.07, attack: 0.002 });
    this.noiseHit(0.08, { gain: 0.07, from: 1800, to: 4200, type: 'bandpass', Q: 2 });
    this.noiseHit(0.28, { gain: 0.09, from: 2800, to: 500, type: 'bandpass', delay: 0.04, Q: 0.9 });
  }

  thunk() {
    this.thud(0.22);
    this.noiseHit(0.06, { gain: 0.09, from: 2000, to: 400 });
  }

  musket() {
    // Crack + body boom
    this.noiseHit(0.12, { gain: 0.55, from: 8000, to: 1200, type: 'highpass' });
    this.noiseHit(0.45, { gain: 0.38, from: 2800, to: 120 });
    this.tone(160, 45, 0.28, { type: 'sine', gain: 0.32, attack: 0.002 });
    this.tone(420, 180, 0.08, { type: 'square', gain: 0.04, attack: 0.001 });
  }

  cannon() {
    this.noiseHit(0.25, { gain: 0.35, from: 2500, to: 400, type: 'bandpass', Q: 0.8 });
    this.noiseHit(1.1, { gain: 0.55, from: 900, to: 45 });
    this.tone(55, 28, 0.95, { type: 'sine', gain: 0.7, attack: 0.01, release: 0.9 });
    this.tone(90, 40, 0.5, { type: 'triangle', gain: 0.22, attack: 0.008 });
  }

  boom() {
    this.noiseHit(0.7, { gain: 0.42, from: 1800, to: 60 });
    this.tone(85, 32, 0.55, { type: 'sine', gain: 0.5 });
    this.noiseHit(0.2, { gain: 0.2, from: 4000, to: 600, type: 'highpass', delay: 0.02 });
  }

  hurt() {
    this.tone(190, 80, 0.14, { type: 'sawtooth', gain: 0.045, attack: 0.004 });
    this.noiseHit(0.1, { gain: 0.06, from: 1200, to: 300 });
  }

  fall() {
    this.thud(0.38);
    this.tone(140, 40, 0.4, { type: 'sine', gain: 0.28, release: 0.38 });
    this.noiseHit(0.35, { gain: 0.14, from: 900, to: 100 });
  }

  horn() {
    // Layered battle horn (reedy + fifth)
    [0, 0.28].forEach((d, i) => {
      const f = i ? 311.1 : 233.1;
      this.tone(f, f, 0.55, { type: 'sawtooth', gain: 0.045, delay: d, attack: 0.08, release: 0.5 });
      this.tone(f * 2, f * 2, 0.55, { type: 'triangle', gain: 0.05, delay: d, attack: 0.08, release: 0.5 });
      this.tone(f * 1.5, f * 1.5, 0.45, { type: 'sine', gain: 0.03, delay: d + 0.02, attack: 0.1 });
    });
  }

  collapse() {
    this.noiseHit(1.5, { gain: 0.4, from: 1100, to: 50 });
    this.tone(60, 26, 1.3, { type: 'sine', gain: 0.55, attack: 0.02, release: 1.2 });
    for (let i = 0; i < 7; i++) {
      this.noiseHit(0.14, {
        gain: 0.12,
        from: 2200 - i * 120,
        to: 350,
        delay: 0.15 + i * 0.12,
        buffer: this.metal,
        type: 'bandpass',
        Q: 1.2,
      });
      this.thud(0.18, 0.18 + i * 0.13);
    }
  }

  win() {
    const seq = [293.7, 349.2, 440, 587.3, 698.5, 880];
    seq.forEach((f, i) => {
      this.tone(f, f, 0.28, { type: 'triangle', gain: 0.09, delay: i * 0.12, attack: 0.02, release: 0.26 });
      this.tone(f * 2, f * 2, 0.22, { type: 'sine', gain: 0.035, delay: i * 0.12 + 0.02 });
    });
    this.tone(880, 880, 0.9, { type: 'triangle', gain: 0.1, delay: seq.length * 0.12, attack: 0.04, release: 0.85 });
    this.tone(1174.7, 1174.7, 0.7, { type: 'sine', gain: 0.04, delay: seq.length * 0.12 + 0.05 });
  }

  lose() {
    [392, 349.2, 311.1, 246.9].forEach((f, i) => {
      this.tone(f, f * 0.96, 0.38, { type: 'triangle', gain: 0.11, delay: i * 0.22, attack: 0.04, release: 0.35 });
      this.tone(f / 2, f / 2, 0.38, { type: 'sine', gain: 0.06, delay: i * 0.22 });
    });
  }

  // ── music: heavier davul + Hicaz melody ──
  startMusic() {
    const ctx = this.live();
    if (!ctx || this.music) return;
    const bpm = 100;
    const step = 60 / bpm / 2;
    const D = 146.8;
    const scale = [1, 16 / 15, 5 / 4, 4 / 3, 3 / 2, 8 / 5, 16 / 9, 2];
    const mel = [4, null, 3, 2, 3, null, 1, 0, 2, null, 3, 4, 5, 4, 3, 2, 4, null, 3, 2, 1, null, 2, 1, 0, null, null, null, 0, 1, 2, 3];
    let n = 0;
    let next = ctx.currentTime + 0.1;

    const dum = (at, heavy) => {
      this.tone(78, 42, 0.28, { type: 'sine', gain: heavy ? 0.38 : 0.22, bus: this.musicBus, at, attack: 0.004, release: 0.26 });
      this.tone(120, 60, 0.16, { type: 'triangle', gain: heavy ? 0.12 : 0.07, bus: this.musicBus, at, attack: 0.004 });
      this.noiseHit(0.09, { gain: heavy ? 0.08 : 0.05, from: 500, to: 90, bus: this.musicBus });
    };

    const schedule = () => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 0.28) {
        const s = n % 8;
        if (s === 0) dum(next, true);
        else if (s === 3 || s === 6) dum(next, false);
        if (s === 4) this.tone(170, 90, 0.12, { type: 'sine', gain: 0.1, bus: this.musicBus, at: next, attack: 0.003 });
        if (s % 2 === 1) this.hat(next);
        const deg = mel[n % mel.length];
        if (deg !== null && n >= 16) {
          const f = D * 2 * scale[deg];
          this.tone(f, f, step * 1.8, { type: 'sawtooth', gain: 0.016, bus: this.musicBus, at: next, attack: 0.04, release: step * 1.6 });
          this.tone(f, f, step * 1.8, { type: 'triangle', gain: 0.028, bus: this.musicBus, at: next, attack: 0.04, release: step * 1.6, detune: 6 });
        }
        if (n % 32 === 0) {
          this.tone(D / 2, D / 2, step * 28, { type: 'triangle', gain: 0.045, bus: this.musicBus, at: next, attack: 0.5, release: step * 26 });
        }
        next += step;
        n += 1;
      }
    };
    this.music = setInterval(schedule, 55);
    schedule();
  }

  hat(at) {
    const ctx = this.live();
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.03, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    src.start(at);
    src.stop(at + 0.055);
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
