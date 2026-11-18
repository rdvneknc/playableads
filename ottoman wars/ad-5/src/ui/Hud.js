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
  constructor(root, { onCta, onFire }) {
    this.root = root;
    this.onCta = onCta;
    this.cta = el('button', 'cta-mini', root, TEXT.playNow);
    this.cta.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onCta();
    });
    this.hand = el('div', 'drag', root, `<span class="finger"></span><div class="lbl">${TEXT.drag}</div>`);
    this.fireBtn = el('button', 'firebtn', root, `<i></i>${TEXT.fire}`);
    this.fireBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onFire?.();
    });
    this.layer = el('div', 'layer', root);
    this.tip = el('div', 'tip', this.layer, '<span></span>');
    this.tipText = this.tip.firstChild;
    this.stack = el('div', 'stackcount', this.layer, '');
    this.joy = el('div', 'joy', root, '<div class="knob"></div>');
    this.knob = this.joy.firstChild;
    this.flash = el('div', 'flash', root);
    this.purse = el('div', 'purse', root, '<i></i><b>0</b>');
    this.purseN = this.purse.querySelector('b');
    this.questEl = el('div', 'quest', root, '<div class="qstep"></div><div class="qbody"><b></b><span></span><div class="qbar"><i></i></div></div><div class="qicon"></div>');
    this.qStep = this.questEl.querySelector('.qstep');
    this.qTitle = this.questEl.querySelector('b');
    this.qSub = this.questEl.querySelector('span');
    this.qBar = this.questEl.querySelector('.qbar i');
    this.qIcon = this.questEl.querySelector('.qicon');
    this.tipKey = '';
    this.armyEl = el('div', 'army', root, '');
  }

  // army strip under the purse: counts by unit kind
  army(list) {
    this.armyEl.classList.toggle('show', !!list);
    if (!list) return;
    const html = list.map((u) => `<span class="u ${u.kind}"><i></i>${u.n}/${u.max}</span>`).join('');
    if (html !== this.armyHtml) {
      this.armyHtml = html;
      this.armyEl.innerHTML = html;
    }
  }

  quest(q) {
    this.questEl.classList.toggle('show', !!q);
    if (!q) return;
    if (this.qTitle.textContent !== q.title) {
      this.questEl.classList.remove('new');
      void this.questEl.offsetWidth;
      this.questEl.classList.add('new');
    }
    this.qStep.textContent = q.step;
    this.qTitle.textContent = q.title;
    this.qSub.textContent = q.sub;
    this.qBar.style.width = `${(q.k || 0) * 100}%`;
    this.qIcon.className = `qicon ${q.icon || ''}`;
  }

  // one drag gesture: a finger sliding from (x0,y0) toward (x1,y1)
  dragHint(visible, x0 = 0, y0 = 0, x1 = 0, y1 = 0) {
    this.hand.classList.toggle('show', visible);
    if (!visible) return;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, 110 / d);
    this.hand.style.transform = `translate(${x0}px, ${y0}px)`;
    this.hand.style.setProperty('--dx', `${dx * k}px`);
    this.hand.style.setProperty('--dy', `${dy * k}px`);
  }

  fireButton(visible, x = 0, y = 0) {
    this.fireBtn.classList.toggle('show', visible);
    if (visible) this.fireBtn.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
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

  // info cards over open build plots
  cards(list) {
    this.cardEls ||= new Map();
    const seen = new Set();
    for (const c of list) {
      seen.add(c.id);
      let e = this.cardEls.get(c.id);
      if (!e) {
        e = el('div', 'card', this.layer, '<b></b><span></span><div class="pbar"><i></i></div>');
        e.b = e.querySelector('b');
        e.s = e.querySelector('span');
        e.i = e.querySelector('i');
        this.cardEls.set(c.id, e);
      }
      e.b.textContent = c.name;
      e.s.textContent = c.desc;
      e.i.style.width = `${c.k * 100}%`;
      e.classList.toggle('main', !!c.main);
      e.classList.toggle('building', c.k > 0);
      e.style.display = 'block';
      e.style.transform = `translate(${c.x}px, ${c.y}px) translate(-50%, -100%)`;
    }
    for (const [id, e] of this.cardEls) if (!seen.has(id)) e.style.display = 'none';
  }

  // arrow on the screen edge toward an off-screen goal (dx, dy in NDC, y down)
  pointer(visible, dx = 0, dy = 0) {
    if (!this.ptr) this.ptr = el('div', 'ptr', this.root, '<i></i>');
    this.ptr.style.display = visible ? 'block' : 'none';
    if (!visible) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const s = Math.max(Math.abs(dx) / 0.86, Math.abs(dy) / 0.8, 1e-3);
    const x = Math.max(36, Math.min(w - 36, (dx / s) * 0.5 * w + w / 2));
    const y = Math.max(165, Math.min(h - 70, (dy / s) * 0.5 * h + h / 2));
    const a = Math.atan2(dy * h, dx * w);
    this.ptr.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${a}rad)`;
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

  endCard() {
    this.showCta(false);
    this.setTip('', '', 0, 0, false);
    this.fireButton(false);
    this.stack.style.display = 'none';
    const card = el('div', 'end win', this.root);
    card.innerHTML = `
      <div class="rays"></div>
      <div class="panel">
        <div class="logo">${TEXT.title}</div>
        <div class="res">${TEXT.victory}</div>
        <div class="line">${TEXT.victoryLine}</div>
        <button class="cta">${TEXT.buildArmy}</button>
      </div>`;
    card.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.onCta();
    });
    requestAnimationFrame(() => card.classList.add('show'));
    this.card = card;
  }

  reset() {
    this.card?.remove();
    this.card = null;
    [...this.layer.querySelectorAll('.float')].forEach((f) => f.remove());
    this.tipKey = '';
    this.cards([]);
  }
}
