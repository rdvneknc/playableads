import logoUrl from '../assets/logo.webp';
import babyUrl from '../assets/baby-icon.webp';
import { TEXT } from '../config.js';

const el = (tag, cls, html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

const HAND = `<svg viewBox="0 0 64 64" width="64" height="64"><path d="M24 30V12a5 5 0 0 1 10 0v14l2-1a5 5 0 0 1 6 2l1 1a5 5 0 0 1 6 2l1 1a5 5 0 0 1 6 4v10c0 9-6 16-16 16h-4c-6 0-10-3-13-8l-9-14a4.5 4.5 0 0 1 7-5z" fill="#fff" stroke="#3b2a4a" stroke-width="3" stroke-linejoin="round"/></svg>`;

export class Hud {
  constructor(root, { onCta }) {
    this.root = root;
    this.onCta = onCta;

    // top bar: moves + goals
    this.top = el('div', 'top');
    this.movesBox = el('div', 'moves', `<b>20</b><span>${TEXT.moves}</span>`);
    this.goals = el('div', 'goals');
    this.goalBaby = el('div', 'goal', `<img src="${babyUrl}" alt=""><b>3</b><i>✓</i>`);
    this.goalHoney = el('div', 'goal honey', `<span class="hex"></span><b>10</b><i>✓</i>`);
    this.goals.append(this.goalBaby, this.goalHoney);
    this.top.append(this.movesBox, this.goals);
    root.append(this.top);

    this.logo = el('img', 'logo');
    this.logo.src = logoUrl;
    root.append(this.logo);

    this.banner = el('div', 'banner');
    root.append(this.banner);
    this.combo = el('div', 'combo');
    root.append(this.combo);

    this.hand = el('div', 'hand', HAND);
    root.append(this.hand);

    this.cta = el('button', 'cta', TEXT.cta);
    this.cta.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onCta();
    });
    root.append(this.cta);

    this.end = el('div', 'end');
    root.append(this.end);
  }

  show() {
    this.top.classList.add('show');
    this.cta.classList.add('show');
  }

  intro(text) {
    this.logo.classList.add('intro');
    this.say(text, 2.2);
    setTimeout(() => this.logo.classList.remove('intro'), 2000);
  }

  setMoves(n) {
    const b = this.movesBox.querySelector('b');
    b.textContent = n;
    this.movesBox.classList.toggle('low', n <= 5);
    this.movesBox.classList.remove('tick');
    void this.movesBox.offsetWidth;
    this.movesBox.classList.add('tick');
  }

  setGoals(babies, honey) {
    for (const [g, n] of [[this.goalBaby, babies], [this.goalHoney, honey]]) {
      const b = g.querySelector('b');
      if (b.textContent !== String(n)) {
        g.classList.remove('bump');
        void g.offsetWidth;
        g.classList.add('bump');
      }
      b.textContent = n;
      g.classList.toggle('done', n <= 0);
    }
  }

  // screen centre of a goal icon (the freed babies fly there)
  goalPoint(name) {
    const r = (name === 'honey' ? this.goalHoney : this.goalBaby).getBoundingClientRect();
    return { x: r.left + r.height / 2, y: r.top + r.height / 2 };
  }

  say(text, secs = 1.6) {
    this.banner.textContent = text;
    this.banner.classList.remove('on');
    void this.banner.offsetWidth;
    this.banner.classList.add('on');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => this.banner.classList.remove('on'), secs * 1000);
  }

  comboText(text, color = '#ff7fb0') {
    this.combo.textContent = text;
    this.combo.style.setProperty('--c', color);
    this.combo.classList.remove('on');
    void this.combo.offsetWidth;
    this.combo.classList.add('on');
  }

  // a hand that drags from a to b (screen px); null hides it
  hint(a, b) {
    if (!a) {
      this.hand.classList.remove('on');
      return;
    }
    this.hand.style.setProperty('--x0', `${a.x}px`);
    this.hand.style.setProperty('--y0', `${a.y}px`);
    this.hand.style.setProperty('--x1', `${b.x}px`);
    this.hand.style.setProperty('--y1', `${b.y}px`);
    this.hand.classList.add('on');
  }

  endCard(win) {
    this.hint(null);
    this.cta.classList.remove('show');
    this.top.classList.remove('show');
    this.end.innerHTML = '';
    const card = el('div', 'card');
    const logo = el('img', 'elogo');
    logo.src = logoUrl;
    card.append(logo);
    card.append(el('h1', '', win ? TEXT.winTitle : TEXT.loseTitle));
    card.append(el('p', '', win ? TEXT.winSub : TEXT.loseSub));
    const btn = el('button', 'big', TEXT.cta);
    card.append(btn);
    this.end.append(card);
    this.end.classList.add('on');
    this.end.addEventListener('pointerdown', () => this.onCta());
  }
}
