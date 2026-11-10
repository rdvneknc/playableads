import { BOARD, GAME_WIDTH as W } from '../config.js';

// Perspective board: rows recede into the distance (0 = back, 2 = front).

// Interpolate y / scale at a fractional row (e.g. 1.5 = edge between rows 1 and 2).
function at(rf) {
  const { rowY, rowS, rows } = BOARD;
  const r = Math.max(-0.5, Math.min(rows - 0.5, rf));
  const i = Math.min(rows - 2, Math.max(0, Math.floor(r)));
  const t = r - i;
  return { y: rowY[i] + (rowY[i + 1] - rowY[i]) * t, s: rowS[i] + (rowS[i + 1] - rowS[i]) * t };
}

export function cell(row, col) {
  const { colW, cols } = BOARD;
  const { y, s } = at(row);
  return { x: W / 2 + (col - (cols - 1) / 2) * colW * s, y: y + 22 * s, s };
}

export function tileQuad(row, col) {
  const { colW, cols } = BOARD;
  const top = at(row - 0.5);
  const bot = at(row + 0.5);
  const xl = (c, s) => W / 2 + (c - cols / 2) * colW * s;
  return [
    { x: xl(col, top.s), y: top.y },
    { x: xl(col + 1, top.s), y: top.y },
    { x: xl(col + 1, bot.s), y: bot.y },
    { x: xl(col, bot.s), y: bot.y },
  ];
}

export function drawBoard(g, { highlight = null } = {}) {
  const { cols, rows } = BOARD;
  g.clear();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const q = tileQuad(r, c);
      const mine = BOARD.playerCols.includes(c);
      const theirs = BOARD.enemyCols.includes(c);
      const dark = (r + c) % 2 === 0;
      let color = dark ? 0x6b5a34 : 0x7d6a3e;
      let alpha = 0.38;
      if (mine) {
        color = dark ? 0x7a3a2a : 0x8a4630;
        alpha = 0.42;
      } else if (theirs) {
        color = dark ? 0x34445e : 0x3d4f6b;
        alpha = 0.4;
      }
      if (highlight && highlight(r, c)) {
        color = 0xffd36b;
        alpha = 0.55;
      }
      g.fillStyle(color, alpha);
      g.fillPoints(q, true);
      g.lineStyle(1.5, 0x1f1708, 0.3);
      g.strokePoints(q, true);
    }
  }
  // gold border around the whole board
  const tl = tileQuad(0, 0)[0];
  const tr = tileQuad(0, cols - 1)[1];
  const br = tileQuad(rows - 1, cols - 1)[2];
  const bl = tileQuad(rows - 1, 0)[3];
  g.lineStyle(4, 0xe0b64e, 0.75);
  g.strokePoints([tl, tr, br, bl], true);
}

// Which tile is under a screen point (null if none).
export function pick(x, y) {
  const { cols, rows } = BOARD;
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      const q = tileQuad(r, c);
      if (y < q[0].y || y > q[3].y) continue;
      const t = (y - q[0].y) / (q[3].y - q[0].y);
      const xl = q[0].x + (q[3].x - q[0].x) * t;
      const xr = q[1].x + (q[2].x - q[1].x) * t;
      if (x >= xl && x <= xr) return { row: r, col: c };
    }
  }
  return null;
}
