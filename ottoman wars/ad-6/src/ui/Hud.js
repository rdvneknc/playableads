import logoUrl from '../assets/logo.webp';
import { TEXT } from '../config.js';

// DOM overlay in the style of the game's battle screen: loot, timer, crescents and
// destruction %, unit cards at the bottom, the Paşa's battle-cry button, hints and the end card.

const el = (tag, cls, parent, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
};

const HAND = `<svg viewBox="0 0 64 64" width="64" height="64"><path d="M24 30V12a5 5 0 0 1 10 0v14l2-1a5 5 0 0 1 6 2l1 1a5 5 0 0 1 6 2l1 1a5 5 0 0 1 6 4v10c0 9-6 16-16 16h-4c-6 0-10-3-13-8l-9-14a4.5 4.5 0 0 1 7-5z" fill="#fff" stroke="#2a1a0c" stroke-width="3" stroke-linejoin="round"/></svg>`;
const CRESCENT = `<svg viewBox="0 0 40 40"><path d="M27 4a17 17 0 1 0 9 26A14 14 0 1 1 27 4z"/></svg>`;
const fmt = (n) => Math.round(n).toLocaleString('tr-TR');

export class Hud {
  constructor(root, { onCta, onCard, onAbility }) {
    this.root = root;
    this.onCta = onCta;
    const stop = (e) => e.stopPropagation();

    // top-left: our loot · top-right: the enemy and what is left to take
    this.me = el('div', 'side me', root, `<div class="nm">${TEXT.player}</div><div class="res"><i class="coin"></i><b>0</b></div>`);
    this.meN = this.me.querySelector('b');
    this.foe = el('div', 'side foe', root, `<div class="nm">${TEXT.enemy}</div><div class="res"><b>0</b><i class="coin"></i></div>`);
    this.foeN = this.foe.querySelector('b');

    // top-centre: timer, three crescents, destruction %
    this.top = el('div', 'topc', root, `<div class="time"></div><div class="moons">${CRESCENT.repeat(3)}</div><div class="pct">%0</div>`);
    this.timeEl = this.top.querySelector('.time');
    this.moons = [...this.top.querySelectorAll('svg')];
    this.pctEl = this.top.querySelector('.pct');

    this.banner = el('div', 'banner', root);
    this.big = el('div', 'bigtxt', root);
    this.layer = el('div', 'layer', root);

    // unit cards
    this.cards = el('div', 'cards', root);
    this.cardEls = {};
    this.cards.addEventListener('pointerdown', stop);

    this.ability = el('button', 'ability', root, `<span>${TEXT.ability}</span>`);
    this.ability.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onAbility();
    });

    this.cta = el('button', 'cta-mini', root, TEXT.playNow);
    this.cta.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onCta();
    });

    this.hand = el('div', 'hand', root, HAND);
    this.ring = el('div', 'tapring', root);
    this.flashEl = el('div', 'flash', root);
    this.end = el('div', 'end', root);
    this.onCard = onCard;
  }

  // cards: [{ key, img, count, label }]
  setCards(list) {
    this.cards.innerHTML = '';
    for (const c of list) {
      const e = el('button', `card k-${c.key}`, this.cards, `<img src="${c.img}" alt=""><b>${c.count}x</b><span>${c.label}</span>`);
      e.addEventListener('pointerdown', (ev) => {
        ev.stopPropagation();
        this.onCard(c.key);
      });
      this.cardEls[c.key] = e;
    }
  }

  updateCards(stock, selected, glow) {
    for (const [k, e] of Object.entries(this.cardEls)) {
      e.querySelector('b').textContent = `${stock[k]}x`;
      e.classList.toggle('sel', k === selected);
      e.classList.toggle('empty', stock[k] <= 0);
      e.classList.toggle('glow', k === glow);
    }
  }

  cardPoint(key) {
    const e = this.cardEls[key];
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.4 };
  }

  show() {
    this.root.classList.add('on');
  }

  setTime(s) {
    s = Math.max(0, Math.ceil(s));
    this.timeEl.textContent = `${Math.floor(s / 60)}dk ${String(s % 60).padStart(2, '0')}sn`;
  }

  setLoot(mine, left) {
    this.meN.textContent = fmt(mine);
    this.foeN.textContent = fmt(left);
  }

  setPct(p) {
    this.pctEl.textContent = `%${Math.floor(p)}`;
  }

  moon(i) {
    const m = this.moons[i];
    if (!m || m.classList.contains('on')) return;
    m.classList.add('on');
  }

  say(text, secs = 2) {
    this.banner.textContent = text;
    this.banner.classList.remove('on');
    void this.banner.offsetWidth;
    this.banner.classList.add('on');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => this.banner.classList.remove('on'), secs * 1000);
  }

  bigText(text, cls = '') {
    this.big.textContent = text;
    this.big.className = `bigtxt ${cls}`;
    void this.big.offsetWidth;
    this.big.classList.add('on');
  }

  flash() {
    this.flashEl.classList.remove('on');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('on');
  }

  // "+18.000" rising from a building
  lootText(x, y, n) {
    const e = el('div', 'loot', this.layer, `<i class="coin"></i>+${fmt(n)}`);
    e.style.left = `${x}px`;
    e.style.top = `${y}px`;
    setTimeout(() => e.remove(), 1600);
  }

  // a coin flying from the screen point to the loot counter
  coinFly(x, y, delay = 0) {
    const r = this.me.querySelector('.coin').getBoundingClientRect();
    const e = el('i', 'coin fly', this.layer);
    e.style.left = `${x}px`;
    e.style.top = `${y}px`;
    e.style.setProperty('--dx', `${r.left + r.width / 2 - x}px`);
    e.style.setProperty('--dy', `${r.top + r.height / 2 - y}px`);
    e.style.animationDelay = `${delay}s`;
    setTimeout(() => e.remove(), 900 + delay * 1000);
  }

  bump() {
    this.me.classList.remove('bump');
    void this.me.offsetWidth;
    this.me.classList.add('bump');
  }

  showAbility(on, glow = false) {
    this.ability.classList.toggle('on', on);
    this.ability.classList.toggle('glow', glow);
  }

  // hint hand: a tap at a screen point (or null to hide)
  hint(p, label = '') {
    if (!p) {
      this.hand.classList.remove('on');
      this.ring.classList.remove('on');
      return;
    }
    for (const e of [this.hand, this.ring]) {
      e.style.left = `${p.x}px`;
      e.style.top = `${p.y}px`;
      e.classList.add('on');
    }
    this.hand.dataset.label = label;
  }

  tapMark(x, y, ok) {
    const e = el('div', `tapmark ${ok ? '' : 'bad'}`, this.layer);
    e.style.left = `${x}px`;
    e.style.top = `${y}px`;
    setTimeout(() => e.remove(), 600);
  }

  endCard(win, stars, loot) {
    this.hint(null);
    this.root.classList.add('over');
    this.end.innerHTML = '';
    const card = el('div', 'card-end', this.end);
    const logo = el('img', 'elogo', card);
    logo.src = logoUrl;
    el('div', `moons end-moons`, card, CRESCENT.repeat(3));
    [...card.querySelectorAll('.end-moons svg')].forEach((m, i) => i < stars && setTimeout(() => m.classList.add('on'), 400 + i * 350));
    el('h1', '', card, win ? TEXT.endWin : TEXT.endLose);
    el('div', 'eloot', card, `<i class="coin"></i>${fmt(loot)}`);
    el('p', '', card, win ? TEXT.endWinSub : TEXT.endLoseSub);
    el('button', 'big', card, TEXT.playNow);
    this.end.classList.add('on');
    this.end.addEventListener('pointerdown', () => this.onCta());
  }
}
