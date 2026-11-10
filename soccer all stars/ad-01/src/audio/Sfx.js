// Tiny synthesized sound effects (no audio files → no bundle weight).
// The AudioContext is created lazily on the first user gesture, as ad networks require.
class SfxEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = true; // playable ships silent by default
    this.noiseBuffer = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(this.ctx.destination);

    const len = this.ctx.sampleRate * 1.5;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.6;
  }

  get ready() {
    return this.ctx && this.ctx.state === 'running' && !this.muted;
  }

  tone(freq, endFreq, duration, { type = 'sine', gain = 0.4, delay = 0 } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t + duration);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  noise(duration, { gain = 0.3, freq = 1200, q = 0.8, type = 'bandpass', delay = 0, attack = 0.005 } = {}) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  kick() {
    this.tone(180, 60, 0.12, { gain: 0.55 });
    this.noise(0.06, { gain: 0.25, freq: 2500 });
  }

  superKick() {
    this.tone(220, 50, 0.25, { type: 'triangle', gain: 0.5 });
    this.noise(0.45, { gain: 0.35, freq: 900, q: 0.6, type: 'lowpass', attack: 0.02 });
    this.tone(500, 1400, 0.3, { type: 'sawtooth', gain: 0.06 });
  }

  touch() {
    this.tone(260, 140, 0.05, { gain: 0.18 });
  }

  whoosh() {
    this.noise(0.22, { gain: 0.18, freq: 700, q: 0.7, attack: 0.04 });
  }

  bump() {
    this.tone(120, 45, 0.18, { type: 'square', gain: 0.22 });
    this.noise(0.12, { gain: 0.3, freq: 400, type: 'lowpass' });
  }

  post() {
    this.tone(880, 860, 0.35, { type: 'triangle', gain: 0.25 });
    this.tone(1320, 1300, 0.25, { type: 'sine', gain: 0.12 });
  }

  net() {
    this.noise(0.25, { gain: 0.2, freq: 600, type: 'lowpass' });
  }

  whistle(delay = 0) {
    this.tone(2100, 2050, 0.18, { type: 'square', gain: 0.06, delay });
    this.tone(2100, 2000, 0.3, { type: 'square', gain: 0.06, delay: delay + 0.22 });
  }

  goal() {
    this.noise(1.6, { gain: 0.35, freq: 1100, q: 0.4, attack: 0.15 });
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.22, { type: 'triangle', gain: 0.18, delay: i * 0.09 }));
  }

  conceded() {
    this.tone(330, 160, 0.5, { type: 'sawtooth', gain: 0.1 });
  }

  click() {
    this.tone(700, 500, 0.05, { gain: 0.15 });
  }

  deny() {
    this.tone(180, 140, 0.08, { type: 'square', gain: 0.08 });
  }
}

export const sfx = new SfxEngine();
