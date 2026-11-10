import { BOARD } from '../config.js';
import { wait } from './Unit.js';

const RANGED = ['ranged', 'gun', 'horsearcher', 'cannon'];
const ARROWS = ['ranged', 'horsearcher'];
const MELEE = ['melee', 'cavalry'];

const tileDist = (r1, c1, r2, c2) => Math.abs(r1 - r2) + Math.abs(c1 - c2);

// Deterministic turn-based rules (see the table in config.js).
export class Battle {
  constructor(scene, units, castles) {
    this.scene = scene;
    this.units = units;
    this.castles = castles; // { p, e }
    this.round = 0;
  }

  alive(side) {
    return this.units.filter((u) => u.alive && u.side === side);
  }

  foeSide(u) {
    return u.side === 'p' ? 'e' : 'p';
  }

  unitAt(r, c) {
    return this.units.find((u) => u.alive && u.row === r && u.col === c);
  }

  // Distance from a tile to a target (castles are walls: only the column counts).
  distTo(r, c, t) {
    return t.isCastle ? Math.abs(c - t.col) : tileDist(r, c, t.row, t.col);
  }

  over() {
    const { p, e } = this.castles;
    if (!e.alive || !this.alive('e').length) return 'win';
    if (!p.alive || !this.alive('p').length) return 'lose';
    return null;
  }

  /* ── damage model ── */
  damage(att, tgt, { moved = 0, dist = 1, contact = false } = {}) {
    const d = att.def;
    const tags = [];
    let armor = tgt.isCastle ? tgt.armor : tgt.def.def;
    if (d.pierce) armor *= 0.5;
    let dmg = (att.atk * 100) / (100 + armor);
    if (!tgt.isCastle && d.bonus.includes(tgt.def.kind)) {
      dmg *= 1.5;
      tags.push('crit');
    }
    if (d.kind === 'cavalry' && moved >= 2) {
      dmg *= 1.5;
      tags.push('charge');
    }
    if (ARROWS.includes(d.kind) && !contact && dist > Math.ceil(d.range / 2)) dmg *= 0.75;
    if (contact && RANGED.includes(d.kind)) dmg *= 0.5; // forced to fight hand-to-hand
    if (tgt.isCastle && d.siege) dmg *= d.siege;
    return { dmg: Math.max(1, Math.round(dmg)), tags };
  }

  // Every attack `u` could make standing on (r, c) after moving `moved` tiles.
  attacksFrom(u, r, c, moved) {
    const d = u.def;
    const foes = this.alive(this.foeSide(u));
    const castle = this.castles[this.foeSide(u)];
    const targets = castle.alive ? [...foes, castle] : foes;
    const adjacent = foes.filter((f) => this.distTo(r, c, f) === 1);
    const out = [];

    if (MELEE.includes(d.kind)) {
      for (const t of targets) if (this.distTo(r, c, t) === 1) out.push({ t, ...this.damage(u, t, { moved }), mode: 'melee' });
      return out;
    }
    // ranged kinds
    if (adjacent.length && d.kind !== 'cannon') {
      for (const t of adjacent) out.push({ t, ...this.damage(u, t, { contact: true }), mode: 'melee' });
      return out;
    }
    if (d.kind === 'gun' && moved > 0) return out; // must stand still to fire
    for (const t of targets) {
      const dist = this.distTo(r, c, t);
      if (dist <= d.range && dist >= (d.minRange || 1)) out.push({ t, ...this.damage(u, t, { dist }), mode: 'shoot', dist });
    }
    return out;
  }

  score(a) {
    const t = a.t;
    let s = a.dmg;
    if (!t.isCastle && a.dmg >= t.hp) s += 200; // finish it
    if (!t.isCastle) s += (1 - t.hp / t.maxHp) * 20; // focus the wounded
    if (!t.isCastle && t.def.kind === 'cannon') s += 15;
    if (t.isCastle) s -= 8; // armies first, walls second
    return s;
  }

  // Breadth-first reachable tiles (units block movement).
  reachable(u) {
    const start = `${u.row},${u.col}`;
    const prev = new Map([[start, null]]);
    const out = [{ r: u.row, c: u.col, steps: 0 }];
    let frontier = [[u.row, u.col]];
    for (let step = 1; step <= u.def.move; step++) {
      const next = [];
      for (const [r, c] of frontier) {
        for (const [dr, dc] of [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ]) {
          const nr = r + dr;
          const nc = c + dc;
          const key = `${nr},${nc}`;
          if (nr < 0 || nr >= BOARD.rows || nc < 0 || nc >= BOARD.cols || prev.has(key) || this.unitAt(nr, nc)) continue;
          prev.set(key, `${r},${c}`);
          next.push([nr, nc]);
          out.push({ r: nr, c: nc, steps: step });
        }
      }
      frontier = next;
    }
    const pathTo = (r, c) => {
      const path = [];
      let k = `${r},${c}`;
      while (k && k !== start) {
        path.unshift(k.split(',').map(Number));
        k = prev.get(k);
      }
      return path;
    };
    return { tiles: out, pathTo };
  }

  // Choose where to stand and what to hit.
  plan(u) {
    const d = u.def;
    const here = this.attacksFrom(u, u.row, u.col, 0);
    // Shooters already in range hold their ground.
    if (here.length && (RANGED.includes(d.kind) && d.kind !== 'horsearcher')) return { path: [], attack: this.best(here) };
    if (d.move === 0) return { path: [], attack: here.length ? this.best(here) : null };

    const { tiles, pathTo } = this.reachable(u);
    let bestPlan = null;
    for (const tile of tiles) {
      const opts = this.attacksFrom(u, tile.r, tile.c, tile.steps);
      if (!opts.length) continue;
      const a = this.best(opts);
      let s = this.score(a) - tile.steps * 0.5;
      // horse archers keep their distance
      if (d.kind === 'horsearcher' && this.alive(this.foeSide(u)).some((f) => this.distTo(tile.r, tile.c, f) === 1)) s -= 25;
      if (!bestPlan || s > bestPlan.s) bestPlan = { s, tile, attack: a };
    }
    if (bestPlan) return { path: pathTo(bestPlan.tile.r, bestPlan.tile.c), attack: bestPlan.attack };

    // Nothing to hit this turn: advance toward the enemy (or their castle).
    const foes = this.alive(this.foeSide(u));
    const goals = foes.length ? foes : [this.castles[this.foeSide(u)]];
    const want = RANGED.includes(d.kind) ? d.range : 1;
    let best = null;
    for (const tile of tiles) {
      const near = Math.min(...goals.map((g) => this.distTo(tile.r, tile.c, g)));
      const gap = Math.max(0, near - want);
      const s = gap * 10 + (near === 1 && RANGED.includes(d.kind) ? 15 : 0) + tile.steps * 0.1;
      if (!best || s < best.s) best = { s, tile };
    }
    return { path: best ? pathTo(best.tile.r, best.tile.c) : [], attack: null };
  }

  best(opts) {
    return opts.reduce((a, b) => (this.score(b) > this.score(a) ? b : a));
  }

  async act(u) {
    if (!u.alive) return;
    const { path, attack } = this.plan(u);
    u.setActive(true);
    if (path.length) await u.walk(path);
    if (attack && attack.t.alive) {
      // re-evaluate from the final tile (positions may have changed)
      const opts = this.attacksFrom(u, u.row, u.col, path.length).filter((o) => o.t === attack.t);
      const a = opts[0] || attack;
      const tag = a.tags.includes('charge') ? 'charge' : a.tags.includes('crit') ? 'crit' : null;
      if (a.mode === 'melee') await u.melee(a.t, a.dmg, tag);
      else if (u.def.kind === 'gun') await u.fire(a.t, a.dmg, tag);
      else if (u.def.kind === 'cannon') {
        const splash = a.t.isCastle
          ? []
          : this.alive(a.t.side).filter((f) => f !== a.t && tileDist(f.row, f.col, a.t.row, a.t.col) === 1).map((f) => ({ u: f, dmg: Math.round(a.dmg * u.def.splash) }));
        await u.cannon(a.t, a.dmg, splash);
      } else await u.shoot(a.t, a.dmg, tag);

      // melee retaliation (once per round)
      const t = a.t;
      if (a.mode === 'melee' && !t.isCastle && t.alive && u.alive && !t.retaliated) {
        t.retaliated = true;
        const back = this.damage(t, u, { contact: !MELEE.includes(t.def.kind) });
        await t.counter(u, Math.max(1, Math.round(back.dmg * 0.5)));
      }
    }
    u.setActive(false);
    await wait(this.scene, 120);
  }

  async playRound() {
    this.round += 1;
    this.units.forEach((u) => (u.retaliated = false));
    const order = this.units
      .filter((u) => u.alive)
      .sort((a, b) => b.def.init - a.def.init || (a.side === 'p' ? -1 : 1) - (b.side === 'p' ? -1 : 1));
    for (const u of order) {
      if (this.over()) return;
      await this.act(u);
    }
  }
}
