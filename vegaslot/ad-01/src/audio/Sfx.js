// Procedural WebAudio SFX — zero asset weight. Locked until the first tap.
class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.muted = false;
    this.riserNodes = null;
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
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    // 1s of white noise, reused for whooshes and thunks
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return this.ctx;
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

  tone(freq, freqEnd, dur, { type = 'sine', gain = 0.2, delay = 0, attack = 0.01 } = {}) {
    const ctx = this.live();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  noiseBurst(dur, { gain = 0.2, delay = 0, type = 'lowpass', from = 800, to = 200, q = 1 } = {}) {
    const ctx = this.live();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  click() {
    this.tone(900, 600, 0.05, { type: 'triangle', gain: 0.12 });
  }

  spinStart() {
    this.noiseBurst(0.45, { type: 'bandpass', from: 400, to: 2400, gain: 0.18, q: 0.8 });
    this.tone(160, 420, 0.3, { type: 'triangle', gain: 0.1 });
  }

  tick() {
    this.tone(1500, 1300, 0.03, { type: 'sine', gain: 0.018 });
  }

  wheelTick() {
    this.tone(1900, 1500, 0.035, { type: 'triangle', gain: 0.05 });
  }

  unlock() {
    this.ensure();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  bonus() {
    [659, 784, 988, 1318].forEach((f, i) => this.tone(f, f, 0.4, { type: 'sine', gain: 0.1, delay: i * 0.09 }));
    this.tone(1318, 1318, 1.0, { type: 'triangle', gain: 0.05, delay: 0.36 });
  }

  reelStop(i = 0) {
    this.noiseBurst(0.12, { from: 900, to: 120, gain: 0.32 });
    this.tone(150 - i * 12, 55, 0.16, { type: 'sine', gain: 0.35 });
    this.tone(1300 + i * 120, 1100, 0.05, { type: 'triangle', gain: 0.06 });
  }

  // Soft anticipation: a warm pad swell + gentle rising bell plucks (no harsh saw).
  riserStart() {
    const ctx = this.live();
    if (!ctx) return;
    this.riserStop();
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(1, t0 + 0.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(700, t0);
    lp.frequency.linearRampToValueAtTime(1600, t0 + 1.6);
    lp.connect(out);
    out.connect(this.master);

    const oscs = [261.6, 329.6, 392].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t0);
      o.detune.value = i === 1 ? 6 : -4;
      const g = ctx.createGain();
      g.gain.value = 0.035;
      o.connect(g);
      g.connect(lp);
      o.start(t0);
      return o;
    });

    // Bell plucks climbing a pentatonic scale
    const scale = [523, 587, 659, 784, 880, 1046, 1175, 1318];
    let step = 0;
    const pluck = () => {
      if (!this.riserNodes) return;
      const f = scale[Math.min(step, scale.length - 1)];
      this.tone(f, f, 0.5, { type: 'sine', gain: 0.045, attack: 0.008 });
      this.tone(f * 2, f * 2, 0.25, { type: 'sine', gain: 0.012, attack: 0.008 });
      step += 1;
      this.riserNodes.timer = setTimeout(pluck, Math.max(120, 230 - step * 12));
    };
    this.riserNodes = { oscs, out, timer: null };
    pluck();
  }

  riserStop() {
    if (!this.riserNodes || !this.ctx) return;
    const { oscs, out, timer } = this.riserNodes;
    clearTimeout(timer);
    const t = this.ctx.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), t);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    oscs.forEach((o) => o.stop(t + 0.4));
    this.riserNodes = null;
  }

  nearMiss() {
    this.tone(440, 330, 0.22, { type: 'triangle', gain: 0.14 });
    this.tone(330, 220, 0.34, { type: 'triangle', gain: 0.14, delay: 0.18 });
  }

  coin(delay = 0) {
    const f = 1800 + Math.random() * 700;
    this.tone(f, f * 1.02, 0.12, { type: 'triangle', gain: 0.07, delay });
    this.tone(f * 1.5, f * 1.5, 0.08, { type: 'sine', gain: 0.04, delay: delay + 0.03 });
  }

  win() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.22, { type: 'triangle', gain: 0.16, delay: i * 0.08 }));
    for (let i = 0; i < 8; i++) this.coin(0.3 + i * 0.07);
  }

  bigWin() {
    const notes = [392, 523, 659, 784, 659, 784, 1046];
    notes.forEach((f, i) => {
      this.tone(f, f, 0.26, { type: 'square', gain: 0.07, delay: i * 0.11 });
      this.tone(f / 2, f / 2, 0.26, { type: 'triangle', gain: 0.12, delay: i * 0.11 });
    });
    this.tone(1046, 1046, 0.9, { type: 'triangle', gain: 0.14, delay: notes.length * 0.11 });
    for (let i = 0; i < 22; i++) this.coin(0.2 + i * 0.06);
  }
}

export const sfx = new Sfx();
