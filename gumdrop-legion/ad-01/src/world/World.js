import Phaser from 'phaser';
import { CAM, COLORS, GAME_WIDTH as W, GAME_HEIGHT as H } from '../config.js';

// Pseudo-3D projection: a fixed camera looking down a straight road.
// x: lateral (road spans -1..1), z: distance ahead of the camera (world units).
export function project(x, z) {
  const zz = Math.max(0.5, z);
  const s = CAM.widthF / zz; // pixels per world unit at this depth
  return { x: W / 2 + x * s, y: CAM.horizonY + CAM.heightF / zz, s };
}

export const REF_S = CAM.widthF / CAM.crowdZ; // pixels per unit where the crowd stands

// Depth for sorting: nearer → higher
export const depthFor = (z) => 1000 - z * 4;

// Draws sky, far hills and the scrolling striped road. `dist` = how far we've travelled.
export class World {
  constructor(scene) {
    this.scene = scene;
    const hz = CAM.horizonY;

    const sky = scene.add.graphics().setDepth(-30);
    sky.fillGradientStyle(COLORS.skyTop, COLORS.skyTop, COLORS.skyBottom, COLORS.skyBottom, 1);
    sky.fillRect(0, 0, W, hz + 4);

    // Sun glow
    scene.add.image(W * 0.72, hz - 150, 'dot').setScale(9).setTint(0xfff4c8).setAlpha(0.8).setDepth(-29);

    this.clouds = [];
    const cloudDefs = [
      [90, 120, 0.9, 6],
      [430, 80, 1.15, 4],
      [640, 190, 0.7, 8],
      [260, 230, 0.55, 10],
    ];
    cloudDefs.forEach(([x, y, s, v]) => {
      const c = scene.add.image(x, y, 'cloud').setScale(s).setDepth(-28).setAlpha(0.95);
      c.vx = v;
      this.clouds.push(c);
    });

    this.hills = scene.add.image(W / 2, hz + 44, 'hills').setOrigin(0.5, 1).setDepth(-27);
    this.hills.setScale(W / this.hills.width + 0.02, 1);

    this.ground = scene.add.graphics().setDepth(-26);
  }

  update(dist, dt) {
    this.clouds.forEach((c) => {
      c.x -= c.vx * dt;
      if (c.x < -200) c.x = W + 200;
    });
    this.drawRoad(dist);
  }

  drawRoad(dist) {
    const g = this.ground;
    g.clear();
    g.fillStyle(COLORS.grassA, 1);
    g.fillRect(0, CAM.horizonY + 38, W, H - CAM.horizonY);

    const first = Math.floor(dist + CAM.nearZ - 1.5);
    const last = Math.floor(dist + CAM.farZ);
    const curbW = 0.09;
    // far → near so nearer segments overdraw
    for (let zw = last; zw >= first; zw--) {
      const zA = zw - dist; // near edge
      const zB = zA + 1; // far edge
      if (zB < 1) continue;
      const a = project(0, Math.max(zA, 1));
      const b = project(0, zB);
      const even = (zw & 1) === 0;

      // side ground stripes
      g.fillStyle(even ? COLORS.grassA : COLORS.grassB, 1);
      g.fillRect(0, b.y, W, a.y - b.y + 1);

      // curbs (candy-cane red / white)
      const ow = 1 + curbW;
      g.fillStyle((zw >> 0) % 2 ? COLORS.curbA : COLORS.curbB, 1);
      g.fillPoints(
        [
          { x: W / 2 - ow * a.s, y: a.y },
          { x: W / 2 + ow * a.s, y: a.y },
          { x: W / 2 + ow * b.s, y: b.y },
          { x: W / 2 - ow * b.s, y: b.y },
        ],
        true,
      );

      // road surface
      g.fillStyle(even ? COLORS.roadA : COLORS.roadB, 1);
      g.fillPoints(
        [
          { x: W / 2 - a.s, y: a.y },
          { x: W / 2 + a.s, y: a.y },
          { x: W / 2 + b.s, y: b.y },
          { x: W / 2 - b.s, y: b.y },
        ],
        true,
      );

      // sprinkle lane dashes
      if (zw % 4 === 0) {
        g.fillStyle(0xffffff, 1);
        for (const lx of [-0.5, 0.5]) {
          const w = 0.03;
          g.fillPoints(
            [
              { x: W / 2 + (lx - w) * a.s, y: a.y },
              { x: W / 2 + (lx + w) * a.s, y: a.y },
              { x: W / 2 + (lx + w) * b.s, y: b.y },
              { x: W / 2 - (-lx + w) * b.s, y: b.y },
            ],
            true,
          );
        }
      }
    }

    // atmospheric fade into the horizon
    // soft haze where the road meets the hills
    g.fillGradientStyle(0xd9b8f0, 0xd9b8f0, 0xd9b8f0, 0xd9b8f0, 0.55, 0.55, 0, 0);
    g.fillRect(0, CAM.horizonY + 38, W, 30);
  }
}

// Billboard props along the roadside (trees, canes, bushes), recycled as we move.
export class Props {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    const kinds = [
      { key: 'lolli', h: 1.0 },
      { key: 'cane', h: 0.8 },
      { key: 'bush', h: 0.45 },
    ];
    const spacing = 5;
    for (let i = 0; i < 34; i++) {
      for (const side of [-1, 1]) {
        const kind = kinds[(i * 2 + (side > 0 ? 1 : 0)) % kinds.length];
        const img = scene.add.image(0, 0, kind.key).setOrigin(0.5, 1);
        const item = {
          img,
          kind,
          z: 8 + i * spacing + (side > 0 ? spacing / 2 : 0),
          x: side * (1.45 + ((i * 37) % 7) * 0.12),
        };
        if (kind.key === 'cane') img.setFlipX(side > 0);
        this.items.push(item);
      }
    }
    this.span = 34 * spacing;
  }

  update(dist) {
    for (const it of this.items) {
      let zr = it.z - dist;
      if (zr < 4) {
        it.z += this.span;
        zr = it.z - dist;
      }
      const visible = zr < 130;
      it.img.setVisible(visible);
      if (!visible) continue;
      const p = project(it.x, zr);
      it.img.setPosition(p.x, p.y);
      it.img.setScale((it.kind.h * p.s) / it.img.height);
      it.img.setDepth(depthFor(zr));
      it.img.setAlpha(Phaser.Math.Clamp((130 - zr) / 25, 0, 1));
    }
  }
}
