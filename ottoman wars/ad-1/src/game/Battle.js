import { BOARD } from '../config.js';
import { wait } from './Unit.js';

const dist = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

// Turn-based resolution. Each side's units act front-first: move toward the
// nearest enemy, then attack if in range (cavalry that moved this turn charges).
export class Battle {
  constructor(scene, units) {
    this.scene = scene;
    this.units = units;
  }

  alive(side) {
    return this.units.filter((u) => u.alive && u.side === side);
  }

  occupied(row, col) {
    return this.units.some((u) => u.alive && u.row === row && u.col === col);
  }

  over() {
    if (!this.alive('e').length) return 'win';
    if (!this.alive('p').length) return 'lose';
    return null;
  }

  targetFor(u) {
    const foes = this.alive(u.side === 'p' ? 'e' : 'p');
    let best = null;
    for (const f of foes) {
      const d = dist(u, f);
      if (d > u.def.range) continue;
      // melee may only hit straight ahead/behind or the tile above/below
      if (u.def.range === 1 && d !== 1) continue;
      if (!best || d < best.d || (d === best.d && f.hp < best.f.hp)) best = { f, d };
    }
    return best?.f || null;
  }

  nearestFoe(u) {
    const foes = this.alive(u.side === 'p' ? 'e' : 'p');
    return foes.sort((a, b) => dist(u, a) - dist(u, b) || Math.abs(u.row - a.row) - Math.abs(u.row - b.row))[0];
  }

  // One step toward a foe; prefer staying in the lane.
  stepToward(u, foe) {
    const dc = Math.sign(foe.col - u.col);
    const dr = Math.sign(foe.row - u.row);
    const opts = [];
    if (dc && u.row === foe.row) opts.push([u.row, u.col + dc]);
    if (dc) opts.push([u.row, u.col + dc]);
    if (dr) opts.push([u.row + dr, u.col]);
    if (dr && dc) opts.push([u.row + dr, u.col + dc]);
    for (const [r, c] of opts) {
      if (r < 0 || r >= BOARD.rows || c < 0 || c >= BOARD.cols) continue;
      if (!this.occupied(r, c)) return [r, c];
    }
    return null;
  }

  async act(u) {
    if (!u.alive) return;
    let target = this.targetFor(u);
    let moved = 0;
    while (!target && moved < u.def.speed) {
      const foe = this.nearestFoe(u);
      if (!foe) return;
      const step = this.stepToward(u, foe);
      if (!step) break;
      await u.moveTo(step[0], step[1]);
      moved += 1;
      target = this.targetFor(u);
    }
    if (!target) return;
    const k = u.def.kind;
    if (k === 'ranged' || k === 'horsearcher') await u.shoot(target);
    else if (k === 'gun') await u.fire(target);
    else if (k === 'cannon') {
      const splash = this.alive(target.side).filter((f) => f !== target && dist(f, target) === 1);
      await u.cannon(target, splash);
    } else await u.melee(target, k === 'cavalry' && moved > 0 ? 1.5 : 1);
    await wait(this.scene, 160);
  }

  async sideTurn(side) {
    const order = this.alive(side).sort((a, b) => (side === 'p' ? b.col - a.col : a.col - b.col) || b.row - a.row);
    for (const u of order) {
      if (this.over()) return;
      await this.act(u);
    }
  }
}
