// Pure match-3 rules (no rendering): the grid, matches, specials, valid moves.
// Row 0 is the far edge of the board; pieces fall toward the last row.
//
// piece = { id, kind: 'animal' | 'bee' | 'puff' | 'rainbow' | 'cocoon', type (animal 0..4), dir ('h'|'v' for bees), hp (cocoons) }

export const ROWS = 8;
export const COLS = 8;
export const TYPES = 5;

export const inside = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
export const key = (r, c) => r * COLS + c;
const isAnimal = (p) => p && p.kind === 'animal';
export const isSpecial = (p) => p && (p.kind === 'bee' || p.kind === 'puff' || p.kind === 'rainbow');
export const movable = (p) => p && p.kind !== 'cocoon';

// Groups of matching animals. Runs that share a cell merge into one group (L / T shapes).
export function findGroups(grid) {
  const runs = [];
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      const p = grid[r][c];
      let e = c + 1;
      if (isAnimal(p)) while (e < COLS && isAnimal(grid[r][e]) && grid[r][e].type === p.type) e++;
      if (isAnimal(p) && e - c >= 3) runs.push({ dir: 'h', type: p.type, cells: Array.from({ length: e - c }, (_, i) => [r, c + i]) });
      c = e;
    }
  }
  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS) {
      const p = grid[r][c];
      let e = r + 1;
      if (isAnimal(p)) while (e < ROWS && isAnimal(grid[e][c]) && grid[e][c].type === p.type) e++;
      if (isAnimal(p) && e - r >= 3) runs.push({ dir: 'v', type: p.type, cells: Array.from({ length: e - r }, (_, i) => [r + i, c]) });
      r = e;
    }
  }
  // union runs that share cells
  const parent = runs.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const owner = new Map();
  runs.forEach((run, i) => {
    for (const [r, c] of run.cells) {
      const k = key(r, c);
      if (owner.has(k)) parent[find(i)] = find(owner.get(k));
      else owner.set(k, i);
    }
  });
  const byRoot = new Map();
  runs.forEach((run, i) => {
    const root = find(i);
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push(run);
  });
  const groups = [];
  for (const list of byRoot.values()) {
    const cells = new Map();
    let maxH = 0;
    let maxV = 0;
    for (const run of list) {
      for (const [r, c] of run.cells) cells.set(key(r, c), [r, c]);
      if (run.dir === 'h') maxH = Math.max(maxH, run.cells.length);
      else maxV = Math.max(maxV, run.cells.length);
    }
    let special = null;
    if (maxH >= 5 || maxV >= 5) special = { kind: 'rainbow' };
    else if (maxH >= 3 && maxV >= 3) special = { kind: 'puff' };
    else if (maxH === 4) special = { kind: 'bee', dir: 'h' };
    else if (maxV === 4) special = { kind: 'bee', dir: 'v' };
    groups.push({ type: list[0].type, cells: [...cells.values()], maxH, maxV, special, runs: list });
  }
  return groups;
}

export function swapCells(grid, a, b) {
  const t = grid[a[0]][a[1]];
  grid[a[0]][a[1]] = grid[b[0]][b[1]];
  grid[b[0]][b[1]] = t;
}

// every swap the player could make, with a score used for hints
export function listMoves(grid) {
  const moves = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const r2 = r + dr;
        const c2 = c + dc;
        if (!inside(r2, c2)) continue;
        const a = grid[r][c];
        const b = grid[r2][c2];
        if (!movable(a) || !movable(b)) continue;
        let score = 0;
        if (isSpecial(a) || isSpecial(b)) {
          const both = isSpecial(a) && isSpecial(b);
          score = both ? 200 : a.kind === 'rainbow' || b.kind === 'rainbow' ? 90 : 40;
        } else {
          swapCells(grid, [r, c], [r2, c2]);
          const groups = findGroups(grid);
          swapCells(grid, [r, c], [r2, c2]);
          if (!groups.length) continue;
          for (const g of groups) {
            score += g.cells.length * 2;
            if (g.special?.kind === 'rainbow') score += 120;
            else if (g.special?.kind === 'puff') score += 70;
            else if (g.special?.kind === 'bee') score += 55;
          }
        }
        moves.push({ a: [r, c], b: [r2, c2], score });
      }
  return moves.sort((x, y) => y.score - x.score);
}

// cells hit by a special firing at (r, c)
export function blastCells(kind, r, c, dir) {
  const out = [];
  if (kind === 'bee') {
    if (dir === 'h') for (let i = 0; i < COLS; i++) out.push([r, i]);
    else for (let i = 0; i < ROWS; i++) out.push([i, c]);
  } else if (kind === 'puff') {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (inside(r + dr, c + dc)) out.push([r + dr, c + dc]);
  }
  return out;
}

export const neighbours = (r, c) => [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => inside(a, b));
