// Sound: the artist's recorded samples (inlined mp3) plus the forest music loop. Starts on the first touch.
import squishUrl from '../assets/audio/jelly-squish.mp3';
import popUrl from '../assets/audio/match-pop.mp3';
import beeUrl from '../assets/audio/line-bee-buzz.mp3';
import puffUrl from '../assets/audio/puff-mushroom.mp3';
import rainbowUrl from '../assets/audio/rainbow-bloop.mp3';
import crackUrl from '../assets/audio/cocoon-crack.mp3';
import winUrl from '../assets/audio/level-win.mp3';
import musicUrl from '../assets/audio/forest-loop.mp3';

const SAMPLES = { squish: squishUrl, pop: popUrl, bee: beeUrl, puff: puffUrl, rainbow: rainbowUrl, crack: crackUrl, win: winUrl, music: musicUrl };

function dataUrlToBuffer(url) {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.buffers = {};
    this.last = {};
    this.musicSrc = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.muted) this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.connect(this.master);
    for (const [name, url] of Object.entries(SAMPLES)) {
      try {
        const p = this.ctx.decodeAudioData(
          dataUrlToBuffer(url),
          (b) => {
            this.buffers[name] = b;
            if (name === 'music') this.startMusic();
          },
          () => {},
        );
        p?.catch?.(() => {});
      } catch {
        /* silent fallback */
      }
    }
  }

  get ok() {
    return this.ctx && this.ctx.state !== 'closed';
  }

  gate(name, ms) {
    const now = performance.now();
    if (now - (this.last[name] || 0) < ms) return false;
    this.last[name] = now;
    return true;
  }

  play(name, { gain = 0.6, rate = 1, delay = 0, jitter = 0.06 } = {}) {
    const buf = this.buffers[name];
    if (!this.ok || !buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (1 - jitter / 2 + Math.random() * jitter);
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.master);
    src.start(this.ctx.currentTime + delay);
  }

  startMusic() {
    if (this.musicSrc || !this.buffers.music) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.music;
    src.loop = true;
    src.connect(this.musicGain);
    src.start();
    this.musicSrc = src;
    const t = this.ctx.currentTime;
    this.musicGain.gain.setValueAtTime(0, t);
    this.musicGain.gain.linearRampToValueAtTime(0.32, t + 1.5);
  }

  duckMusic(v = 0.12, back = 2.5) {
    if (!this.musicSrc) return;
    const t = this.ctx.currentTime;
    const g = this.musicGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(v, t + 0.2);
    g.linearRampToValueAtTime(0.32, t + back);
  }

  swap() {
    this.play('squish', { gain: 0.55 });
  }
  bad() {
    this.play('squish', { gain: 0.45, rate: 0.75 });
  }
  // each cascade step pops a little higher
  pop(chain = 0) {
    if (!this.gate('pop', 60)) return;
    this.play('pop', { gain: 0.6, rate: Math.min(1.6, 1 + chain * 0.09) });
  }
  land() {
    if (!this.gate('land', 90)) return;
    this.play('squish', { gain: 0.16, rate: 1.35, jitter: 0.25 });
  }
  bee() {
    if (!this.gate('bee', 80)) return;
    this.play('bee', { gain: 0.6 });
  }
  puff() {
    if (!this.gate('puff', 80)) return;
    this.play('puff', { gain: 0.75 });
  }
  rainbow() {
    this.play('rainbow', { gain: 0.8 });
  }
  crack() {
    if (!this.gate('crack', 70)) return;
    this.play('crack', { gain: 0.75 });
  }
  win() {
    this.duckMusic(0.08, 4);
    this.play('win', { gain: 0.85, jitter: 0 });
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.8;
  }
  suspend() {
    this.ctx?.suspend();
  }
  resume() {
    if (this.ctx && !this.muted) this.ctx.resume();
  }
}

export const sfx = new Sfx();
