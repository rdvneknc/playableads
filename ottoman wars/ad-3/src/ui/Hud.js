import { TEXT } from '../config.js';

// DOM overlay: joystick, tips, raid bar, callouts, end card.

const el = (tag, cls, parent, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
};

export class Hud {
  constructor(root, { onCta }) {
    this.root = root;
    this.onCta = onCta;
    this.cta = el('button', 'cta-mini', root, TEXT.playNow);
    this.cta.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onCta();
    });
    this.title = el('div', 'title', root, `<div class="t1">${TEXT.title}</div><div class="t2">${TEXT.subtitle}</div>`);
    this.hand = el('div', 'hand', root, `<div class="ring"><span class="finger"></span></div><div class="lbl">${TEXT.drag}</div>`);
    this.layer = el('div', 'layer', root);
    this.tip = el('div', 'tip', this.layer, '<span></span>');
    this.tipText = this.tip.firstChild;
    this.stack = el('div', 'stackcount', this.layer, '');
    this.raid = el('div', 'raid', root, `<div class="row"><b class="foes">0</b><div class="bar"><div class="hp"></div></div></div>`);
    this.raidHp = this.raid.querySelector('.hp');
    this.raidFoes = this.raid.querySelector('.foes');
    this.clock = el('div', 'clock', root, `<span class="lbl">⚔ ${TEXT.enemyIn}</span><b>0:00</b><div class="cbar"><div class="cfill"></div></div>`);
    this.clockN = this.clock.querySelector('b');
    this.clockFill = this.clock.querySelector('.cfill');
    this.joy = el('div', 'joy', root, '<div class="knob"></div>');
    this.knob = this.joy.firstChild;
    this.flash = el('div', 'flash', root);
    this.purse = el('div', 'purse', root, '<i></i><b>0</b>');
    this.purseN = this.purse.querySelector('b');
    this.tipKey = '';
  }

  showTitle(v) {
    this.title.classList.toggle('show', v);
  }

  showHand(v) {
    this.hand.classList.toggle('show', v);
  }

  showCta(v) {
    this.cta.classList.toggle('show', v);
    this.purse.classList.toggle('show', v);
  }

  coins(n, bump = false) {
    this.purseN.textContent = n;
    if (bump) {
      this.purse.classList.remove('bump');
      void this.purse.offsetWidth;
      this.purse.classList.add('bump');
    }
  }

  joystick(active, bx, by, kx, ky) {
    this.joy.classList.toggle('show', active);
    if (!active) return;
    this.joy.style.transform = `translate(${bx}px, ${by}px)`;
    this.knob.style.transform = `translate(${kx}px, ${ky}px)`;
  }

  setTip(key, text, x, y, visible) {
    if (!visible || !text) {
      this.tip.classList.remove('show');
      return;
    }
    if (key !== this.tipKey) {
      this.tipKey = key;
      this.tipText.textContent = text;
      this.tip.classList.remove('pop');
      void this.tip.offsetWidth;
      this.tip.classList.add('pop');
    }
    this.tip.classList.add('show');
    // keep the bubble on screen (its tail may drift off the sage a little)
    const half = Math.min(this.tip.offsetWidth / 2 + 8, window.innerWidth / 2);
    const cx = Math.max(half, Math.min(window.innerWidth - half, x));
    this.tip.style.transform = `translate(${cx}px, ${Math.max(this.tip.offsetHeight + 118, y)}px) translate(-50%, -100%)`;
  }

  stackCount(n, max, x, y) {
    if (!n) {
      this.stack.style.display = 'none';
      return;
    }
    this.stack.style.display = 'block';
    this.stack.textContent = n >= max ? TEXT.full : `${n}`;
    this.stack.classList.toggle('max', n >= max);
    this.stack.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }

  raidBar(visible, hp, foes) {
    this.raid.classList.toggle('show', visible);
    if (!visible) return;
    this.raidHp.style.width = `${Math.max(0, hp) * 100}%`;
    this.raidHp.classList.toggle('low', hp < 0.35);
    this.raidFoes.textContent = foes;
  }

  timer(visible, secs, k) {
    this.clock.classList.toggle('show', visible);
    if (!visible) return;
    const s = Math.ceil(secs);
    this.clockN.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.clockFill.style.width = `${Math.max(0, Math.min(1, k)) * 100}%`;
    this.clock.classList.toggle('urgent', secs < 20);
  }

  float(x, y, text, kind = 'good') {
    const f = el('div', `float ${kind}`, this.layer, text);
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    setTimeout(() => f.remove(), 1000);
  }

  callout(text, kind = '') {
    const c = el('div', `callout ${kind}`, this.root, text);
    setTimeout(() => c.remove(), 1700);
  }

  doFlash(color = '#fff') {
    this.flash.style.background = color;
    this.flash.classList.remove('go');
    void this.flash.offsetWidth;
    this.flash.classList.add('go');
  }

  endCard(win, onRetry) {
    this.showCta(false);
    this.raidBar(false);
    this.setTip('', '', 0, 0, false);
    this.stack.style.display = 'none';
    const card = el('div', `end ${win ? 'win' : 'lose'}`, this.root);
    card.innerHTML = `
      <div class="rays"></div>
      <div class="panel">
        <div class="logo">${TEXT.title}</div>
        <div class="res">${win ? TEXT.victory : TEXT.defeat}</div>
        ${win ? '<div class="stars"><i></i><i></i><i></i></div>' : ''}
        <div class="line">${win ? TEXT.victoryLine : TEXT.defeatLine}</div>
        <button class="cta">${TEXT.playNow}</button>
        <button class="retry">↻ ${TEXT.retry}</button>
      </div>`;
    card.querySelector('.cta').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.onCta();
    });
    card.querySelector('.retry').addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      card.remove();
      onRetry();
    });
    card.addEventListener('pointerdown', () => this.onCta());
    requestAnimationFrame(() => card.classList.add('show'));
    this.card = card;
  }

  reset() {
    this.card?.remove();
    this.card = null;
    [...this.layer.querySelectorAll('.float')].forEach((f) => f.remove());
    this.raidBar(false);
    this.tipKey = '';
  }
}
