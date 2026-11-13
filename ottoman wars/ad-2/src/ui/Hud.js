import { TEXT } from '../config.js';

// DOM overlay: crisp text at any resolution, cheap to animate with CSS.

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
    // top bar
    this.top = el('div', 'top', root);
    const prog = el('div', 'prog', this.top);
    el('i', 'ic-army', prog);
    const track = el('div', 'track', prog);
    this.fill = el('div', 'fill', track);
    this.knob = el('div', 'knob', track);
    el('i', 'ic-castle', prog);
    this.cta = el('button', 'cta-mini', root, TEXT.playNow);
    this.cta.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onCta();
    });
    // title + tutorial
    this.title = el('div', 'title', root, `<div class="t1">${TEXT.title}</div><div class="t2">FETHE HAZIR MISIN?</div>`);
    this.hand = el('div', 'hand', root, `<div class="swipe"><span class="finger"></span></div><div class="lbl">${TEXT.swipe}</div>`);
    this.bubbles = new Map();
    this.layer = el('div', 'layer', root);
    this.siege = el('div', 'siege', root, `<div class="lbl">${TEXT.siege}</div><div class="bar"><div class="hp"></div></div>`);
    this.siegeHp = this.siege.querySelector('.hp');
    this.flash = el('div', 'flash', root);
  }

  setProgress(k) {
    const p = Math.max(0, Math.min(1, k)) * 100;
    this.fill.style.width = `${p}%`;
    this.knob.style.left = `${p}%`;
  }

  showTitle(v) {
    this.title.classList.toggle('show', v);
  }

  showHand(v) {
    this.hand.classList.toggle('show', v);
  }

  showTop(v) {
    this.top.classList.toggle('show', v);
    this.cta.classList.toggle('show', v);
  }

  // count badge that follows a group in 3D (x, y in CSS px)
  bubble(id, x, y, n, team, visible = true) {
    let b = this.bubbles.get(id);
    if (!b) {
      b = el('div', `bubble ${team}`, this.layer, '<span></span>');
      b.span = b.firstChild;
      b.n = -1;
      this.bubbles.set(id, b);
    }
    if (!visible || n <= 0) {
      b.style.display = 'none';
      return;
    }
    b.style.display = 'block';
    b.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    if (b.n !== n) {
      if (b.n >= 0) {
        b.classList.remove('bump');
        void b.offsetWidth;
        b.classList.add('bump');
      }
      b.n = n;
      b.span.textContent = n;
    }
  }

  hideBubble(id) {
    const b = this.bubbles.get(id);
    if (b) b.style.display = 'none';
  }

  float(x, y, text, kind = 'good') {
    const f = el('div', `float ${kind}`, this.layer, text);
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    setTimeout(() => f.remove(), 1100);
  }

  callout(text, kind = '') {
    const c = el('div', `callout ${kind}`, this.root, text);
    setTimeout(() => c.remove(), 1500);
  }

  doFlash(color = '#fff') {
    this.flash.style.background = color;
    this.flash.classList.remove('go');
    void this.flash.offsetWidth;
    this.flash.classList.add('go');
  }

  siegeBar(x, y, k, visible) {
    this.siege.classList.toggle('show', visible);
    if (!visible) return;
    this.siege.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    this.siegeHp.style.width = `${Math.max(0, k) * 100}%`;
  }

  endCard(win, count, onRetry) {
    this.showTop(false);
    this.siegeBar(0, 0, 0, false);
    for (const b of this.bubbles.values()) b.style.display = 'none';
    const card = el('div', `end ${win ? 'win' : 'lose'}`, this.root);
    card.innerHTML = `
      <div class="rays"></div>
      <div class="panel">
        <div class="logo">${TEXT.title}</div>
        <div class="res">${win ? TEXT.victory : TEXT.defeat}</div>
        ${win ? '<div class="stars"><i></i><i></i><i></i></div>' : ''}
        <div class="line">${win ? TEXT.victoryLine : TEXT.defeatLine}</div>
        ${win ? `<div class="stat"><span>${TEXT.army}</span><b>${count}</b></div>` : ''}
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
    // background tap also installs
    card.addEventListener('pointerdown', () => this.onCta());
    requestAnimationFrame(() => card.classList.add('show'));
    this.card = card;
  }

  reset() {
    this.card?.remove();
    this.card = null;
    for (const b of this.bubbles.values()) b.remove();
    this.bubbles.clear();
    this.layer.innerHTML = '';
    this.siegeBar(0, 0, 0, false);
  }
}
