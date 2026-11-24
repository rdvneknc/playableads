import logoUrl from '../assets/logo.webp';
import { TEXT } from '../config.js';

// DOM overlay: akçe counter, the current goal, joystick, drag tutorial, callouts and the end card.

const el = (tag, cls, parent, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  parent?.appendChild(e);
  return e;
};
const HAND = `<svg viewBox="0 0 64 64" width="64" height="64"><path d="M24 30V12a5 5 0 0 1 10 0v14l2-1a5 5 0 0 1 6 2l1 1a5 5 0 0 1 6 2l1 1a5 5 0 0 1 6 4v10c0 9-6 16-16 16h-4c-6 0-10-3-13-8l-9-14a4.5 4.5 0 0 1 7-5z" fill="#fff" stroke="#2a1a0c" stroke-width="3" stroke-linejoin="round"/></svg>`;

export class Hud {
  constructor(root, { onCta }) {
    this.root = root;
    this.onCta = onCta;
    this.money = el('div', 'money', root, '<i class="coin"></i><b>0</b>');
    this.moneyN = this.money.querySelector('b');
    this.goal = el('div', 'goal', root, '<span></span>');
    this.goalT = this.goal.firstChild;
    this.cta = el('button', 'cta-mini', root, TEXT.playNow);
    this.cta.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onCta();
    });
    this.big = el('div', 'bigtxt', root);
    this.banner = el('div', 'banner', root);
    this.layer = el('div', 'layer', root);
    this.joy = el('div', 'joy', root, '<div class="knob"></div>');
    this.knob = this.joy.firstChild;
    this.tut = el('div', 'tut', root, `<div class="hand">${HAND}</div><div class="lbl">${TEXT.drag}</div>`);
    this.flashEl = el('div', 'flash', root);
    this.end = el('div', 'end', root);
  }

  show() {
    this.root.classList.add('on');
  }

  setMoney(n) {
    this.moneyN.textContent = Math.round(n);
  }

  bump() {
    this.money.classList.remove('bump');
    void this.money.offsetWidth;
    this.money.classList.add('bump');
  }

  setGoal(text) {
    if (this.goalText === text) return;
    this.goalText = text;
    this.goal.classList.toggle('on', !!text);
    if (!text) return;
    this.goalT.textContent = text;
    this.goal.classList.remove('pop');
    void this.goal.offsetWidth;
    this.goal.classList.add('pop');
  }

  joystick(on, x, y, dx, dy) {
    this.joy.classList.toggle('show', on);
    if (!on) return;
    this.joy.style.transform = `translate(${x}px, ${y}px)`;
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  tutorial(on, x = 0, y = 0) {
    this.tut.classList.toggle('show', on);
    if (on) this.tut.style.transform = `translate(${x}px, ${y}px)`;
  }

  bigText(text, cls = '') {
    this.big.innerHTML = text;
    this.big.className = `bigtxt ${cls}`;
    void this.big.offsetWidth;
    this.big.classList.add('on');
  }

  say(text, secs = 1.8) {
    this.banner.textContent = text;
    this.banner.classList.remove('on');
    void this.banner.offsetWidth;
    this.banner.classList.add('on');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => this.banner.classList.remove('on'), secs * 1000);
  }

  flash() {
    this.flashEl.classList.remove('on');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('on');
  }

  // a floating label in screen space ("+2", "DOLU")
  pop(x, y, html, cls = '') {
    const e = el('div', `pop ${cls}`, this.layer, html);
    e.style.left = `${x}px`;
    e.style.top = `${y}px`;
    setTimeout(() => e.remove(), 1100);
  }

  // the reveal at the end: "next target: the enemy castle"
  reveal() {
    this.root.classList.add('reveal');
    el('div', 'next', this.root, `<small>${TEXT.next}</small><b>${TEXT.nextSub}</b>`);
  }

  endCard() {
    this.root.classList.add('over');
    this.end.innerHTML = '';
    const card = el('div', 'card-end', this.end);
    const logo = el('img', 'elogo', card);
    logo.src = logoUrl;
    el('h1', '', card, TEXT.endTitle);
    el('p', '', card, TEXT.endSub);
    el('button', 'big', card, TEXT.playNow);
    this.end.classList.add('on');
    this.end.addEventListener('pointerdown', () => this.onCta());
  }
}
