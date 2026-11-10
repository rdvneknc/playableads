import { COLORS, FONT, SLOT } from '../config.js';

// Procedural Art-Deco slot cabinet — chrome frame, neon edge, blinking lamps.
export class Cabinet {
  constructor(scene, cx, cy) {
    this.scene = scene;
    this.cx = cx;
    this.cy = cy;

    const winW = SLOT.windowW;
    const winH = SLOT.windowH;
    this.window = {
      x: cx - winW / 2,
      y: cy - winH / 2,
      w: winW,
      h: winH,
    };

    this.root = scene.add.container(0, 0).setDepth(4);
    this.lamps = [];
    this.neon = null;
    this.draw();
    this.startIdleAnim();
  }

  draw() {
    const { cx, cy, window: win } = this;
    const g = this.scene.add.graphics();
    this.root.add(g);

    const outerW = win.w + 100;
    const outerH = win.h + 178;
    const ox = cx - outerW / 2;
    const oy = cy - outerH / 2 + 14;
    this.ox = ox;
    this.oy = oy;
    this.outerW = outerW;
    this.outerH = outerH;

    // Soft floor glow
    g.fillStyle(COLORS.magenta, 0.12);
    g.fillEllipse(cx, oy + outerH + 18, outerW * 0.9, 48);

    // Drop shadow
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(ox + 12, oy + 18, outerW, outerH, 40);

    // Outer chrome shell
    g.fillStyle(0x2a1848, 1);
    g.fillRoundedRect(ox, oy, outerW, outerH, 40);

    // Metallic gradient bands
    g.fillStyle(0x4a2a78, 0.55);
    g.fillRoundedRect(ox + 8, oy + 8, outerW - 16, 70, 30);
    g.fillStyle(0x16082a, 0.65);
    g.fillRoundedRect(ox + 8, oy + outerH - 78, outerW - 16, 64, 28);

    // Gold double bevel
    g.lineStyle(10, COLORS.goldDeep, 1);
    g.strokeRoundedRect(ox + 3, oy + 3, outerW - 6, outerH - 6, 36);
    g.lineStyle(4, COLORS.gold, 1);
    g.strokeRoundedRect(ox + 12, oy + 12, outerW - 24, outerH - 24, 30);
    g.lineStyle(2, 0xfff1b0, 0.55);
    g.strokeRoundedRect(ox + 18, oy + 18, outerW - 36, outerH - 36, 26);

    // Neon edge (animated separately)
    this.neon = this.scene.add.graphics().setDepth(5);
    this.root.add(this.neon);
    this.drawNeon(0.55);

    // Crown / crest
    g.fillStyle(COLORS.goldDeep, 1);
    g.fillTriangle(cx - 88, oy + 10, cx + 88, oy + 10, cx, oy - 46);
    g.fillStyle(COLORS.gold, 1);
    g.fillTriangle(cx - 64, oy + 10, cx + 64, oy + 10, cx, oy - 32);
    g.fillStyle(0xfff6c8, 0.9);
    g.fillTriangle(cx - 28, oy + 6, cx + 28, oy + 6, cx, oy - 18);
    g.fillStyle(COLORS.panel, 1);
    g.fillCircle(cx, oy - 2, 12);
    g.lineStyle(3, COLORS.gold, 1);
    g.strokeCircle(cx, oy - 2, 12);
    g.fillStyle(COLORS.magenta, 1);
    g.fillCircle(cx, oy - 2, 5);

    // Marquee title plate
    g.fillStyle(0x0a0418, 1);
    g.fillRoundedRect(cx - 168, oy + 30, 336, 66, 18);
    g.lineStyle(3, COLORS.gold, 0.95);
    g.strokeRoundedRect(cx - 168, oy + 30, 336, 66, 18);
    g.lineStyle(1.5, COLORS.cyan, 0.45);
    g.strokeRoundedRect(cx - 160, oy + 38, 320, 50, 14);

    const logo = this.scene.add
      .text(cx, oy + 63, 'VEGASLOT', {
        fontFamily: FONT,
        fontSize: '40px',
        color: '#ffd56a',
        stroke: '#3a2208',
        strokeThickness: 6,
        padding: { x: 4, y: 4 },
      })
      .setOrigin(0.5);
    const grd = logo.context.createLinearGradient(0, 0, 0, logo.height);
    grd.addColorStop(0.15, '#fff6cf');
    grd.addColorStop(0.5, '#ffd24a');
    grd.addColorStop(0.85, '#c47a12');
    logo.setFill(grd);
    logo.setShadow(0, 3, '#000000', 6, true, false);
    this.logo = logo;
    this.root.add(logo);

    // Reel glass well
    g.fillStyle(0x02010a, 1);
    g.fillRoundedRect(win.x - 10, win.y - 10, win.w + 20, win.h + 20, 22);
    g.fillStyle(0x0c0520, 1);
    g.fillRoundedRect(win.x, win.y, win.w, win.h, 16);
    g.lineStyle(4, COLORS.goldDeep, 0.9);
    g.strokeRoundedRect(win.x - 4, win.y - 4, win.w + 8, win.h + 8, 18);
    g.lineStyle(2, COLORS.cyan, 0.35);
    g.strokeRoundedRect(win.x, win.y, win.w, win.h, 14);

    // Column wells + chrome dividers
    const colW = win.w / 3;
    for (let i = 0; i < 3; i++) {
      const wx = win.x + i * colW;
      g.fillStyle(i % 2 === 0 ? 0x0a0418 : 0x12072a, 0.95);
      g.fillRect(wx + 4, win.y + 4, colW - 8, win.h - 8);
      // Inner glass sheen
      g.fillStyle(0xffffff, 0.035);
      g.fillRect(wx + 10, win.y + 10, colW - 20, win.h * 0.28);
      if (i > 0) {
        g.lineStyle(5, COLORS.goldDeep, 0.95);
        g.lineBetween(wx, win.y + 10, wx, win.y + win.h - 10);
        g.lineStyle(2, COLORS.gold, 0.85);
        g.lineBetween(wx, win.y + 10, wx, win.y + win.h - 10);
      }
    }

    // Payline markers
    const midY = win.y + win.h / 2;
    g.fillStyle(COLORS.cyan, 1);
    g.fillTriangle(win.x - 22, midY, win.x - 6, midY - 14, win.x - 6, midY + 14);
    g.fillTriangle(win.x + win.w + 22, midY, win.x + win.w + 6, midY - 14, win.x + win.w + 6, midY + 14);
    g.lineStyle(2, COLORS.cyan, 0.28);
    g.lineBetween(win.x + 10, midY, win.x + win.w - 10, midY);

    // Bottom lamp bar
    g.fillStyle(0x080414, 1);
    g.fillRoundedRect(cx - 196, oy + outerH - 58, 392, 34, 14);
    g.lineStyle(2, COLORS.goldDeep, 0.7);
    g.strokeRoundedRect(cx - 196, oy + outerH - 58, 392, 34, 14);

    this.lampGfx = this.scene.add.graphics().setDepth(5);
    this.root.add(this.lampGfx);
    for (let i = 0; i < 9; i++) {
      this.lamps.push({
        x: cx - 160 + i * 40,
        y: oy + outerH - 41,
        phase: i * 0.35,
      });
    }
    this.drawLamps(0);

    // Side gem pillars
    [[ox + 26, cy], [ox + outerW - 26, cy]].forEach(([jx, jy], side) => {
      g.fillStyle(0x1a0a30, 1);
      g.fillRoundedRect(jx - 14, jy - 120, 28, 240, 12);
      g.lineStyle(2, COLORS.gold, 0.7);
      g.strokeRoundedRect(jx - 14, jy - 120, 28, 240, 12);
      const gems = [
        { c: COLORS.magenta, oy: -70 },
        { c: COLORS.gold, oy: 0 },
        { c: COLORS.cyan, oy: 70 },
      ];
      gems.forEach((gem) => {
        g.fillStyle(gem.c, 0.95);
        g.fillCircle(jx, jy + gem.oy, 10);
        g.fillStyle(0xffffff, 0.35);
        g.fillCircle(jx - 3, jy + gem.oy - 3, 3);
        g.lineStyle(2, COLORS.gold, 0.85);
        g.strokeCircle(jx, jy + gem.oy, 10);
      });
      // tiny accent for L/R
      g.fillStyle(side === 0 ? COLORS.magenta : COLORS.cyan, 0.5);
      g.fillCircle(jx, jy - 110, 4);
    });
  }

  drawNeon(alpha) {
    if (!this.neon) return;
    const { ox, oy, outerW, outerH } = this;
    this.neon.clear();
    this.neon.lineStyle(3, COLORS.magenta, alpha);
    this.neon.strokeRoundedRect(ox + 22, oy + 22, outerW - 44, outerH - 44, 24);
    this.neon.lineStyle(2, COLORS.cyan, alpha * 0.7);
    this.neon.strokeRoundedRect(ox + 28, oy + 28, outerW - 56, outerH - 56, 20);
  }

  drawLamps(t) {
    if (!this.lampGfx) return;
    this.lampGfx.clear();
    this.lamps.forEach((lamp, i) => {
      const pulse = 0.45 + 0.55 * Math.abs(Math.sin(t * 3 + lamp.phase));
      const color = i % 3 === 0 ? COLORS.gold : i % 3 === 1 ? COLORS.magenta : COLORS.cyan;
      this.lampGfx.fillStyle(color, pulse);
      this.lampGfx.fillCircle(lamp.x, lamp.y, 7);
      this.lampGfx.fillStyle(0xffffff, pulse * 0.45);
      this.lampGfx.fillCircle(lamp.x - 2, lamp.y - 2, 2.5);
    });
  }

  // Lamps chase faster while the reels run
  setExcited(on) {
    if (this.idleTween) this.idleTween.timeScale = on ? 3 : 1;
  }

  startIdleAnim() {
    this.idleTween = this.scene.tweens.addCounter({
      from: 0,
      to: Math.PI * 2,
      duration: 2200,
      repeat: -1,
      onUpdate: (tw) => {
        const t = tw.getValue();
        this.drawLamps(t);
        this.drawNeon(0.35 + 0.35 * Math.abs(Math.sin(t * 2)));
      },
    });
  }

  pulse(win = false) {
    // Flash lamps + neon hard
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: win ? 700 : 280,
      onUpdate: (tw) => {
        const v = tw.getValue();
        this.drawLamps(v * 12);
        this.drawNeon(0.5 + 0.5 * Math.sin(v * Math.PI * (win ? 8 : 3)));
      },
    });
  }
}
