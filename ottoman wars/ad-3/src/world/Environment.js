import * as THREE from '../vendor/three.module.min.js';
import { Builder, P } from './geom.js';
import { MAP } from '../config.js';
import { T, tent, tree, field } from './Town.js';

// Green Anatolian countryside around the fortress: grass and packed earth,
// a dirt road to the north gate, fields, tents, scattered trees and far hills.

let seed = 5;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const rr = (a, b) => a + (b - a) * rnd();

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function grassTexture() {
  const N = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#c8c8c8';
  ctx.fillRect(0, 0, N, N);
  // tiny blades in light/dark strokes
  for (let i = 0; i < 5200; i++) {
    const x = rnd() * N;
    const y = rnd() * N;
    const l = 150 + rnd() * 105;
    ctx.strokeStyle = `rgba(${l * 0.92},${l},${l * 0.8},0.55)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 4);
    ctx.stroke();
  }
  for (let i = 0; i < 40; i++) {
    const x = rnd() * N;
    const y = rnd() * N;
    const r = 10 + rnd() * 24;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rnd() < 0.5 ? '90,100,60' : '255,250,210'},0.18)`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(90, 90);
  t.anisotropy = 8;
  return t;
}

export const SUN_DIR = new THREE.Vector3(-0.45, 0.85, 0.3).normalize();

export class Environment {
  constructor(scene) {
    this.scene = scene;
    scene.fog = new THREE.Fog(0xcfe0ea, 70, 210);
    this.sky();
    this.lights();
    this.ground();
    this.countryside();
  }

  sky() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color(0x6aa8e0) }, hor: { value: new THREE.Color(0xdbe9ef) } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 hor; varying vec3 vDir;
        void main(){ vec3 c = mix(hor, top, smoothstep(0.0, 0.5, vDir.y)); gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
    this.scene.add(this.skyMesh);
  }

  lights() {
    this.scene.add(new THREE.HemisphereLight(0xf4f6ff, 0x8a8a62, 1.25));
    const sun = new THREE.DirectionalLight(0xfff2dc, 2.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -26;
    sc.right = 26;
    sc.top = 26;
    sc.bottom = -26;
    sc.near = 1;
    sc.far = 120;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
  }

  follow(x, z) {
    this.sun.target.position.set(x, 0, z);
    this.sun.position.copy(this.sun.target.position).addScaledVector(SUN_DIR, 60);
    this.sun.target.updateMatrixWorld();
  }

  ground() {
    // grass with gentle colour variation
    const geo = new THREE.PlaneGeometry(400, 400, 80, 80);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const a = new THREE.Color(T.grass);
    const b = new THREE.Color(0x86a055);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const d = Math.max(Math.abs(x), Math.abs(z));
      pos.setY(i, d > 40 ? (d - 40) * 0.06 * (1 + Math.sin(x * 0.05) * Math.sin(z * 0.04)) : -0.02);
      c.copy(a).lerp(b, 0.5 + 0.5 * Math.sin(x * 0.13 + z * 0.07) * Math.sin(z * 0.11 - x * 0.05));
      c.convertSRGBToLinear();
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const g = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, map: grassTexture() }));
    g.receiveShadow = true;
    this.scene.add(g);
    // packed earth inside the walls (soft-edged canvas texture) + the road north
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const ctx = cv.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 60, 128, 128, 128);
    grad.addColorStop(0, 'rgba(214,194,152,1)');
    grad.addColorStop(0.82, 'rgba(208,188,146,0.95)');
    grad.addColorStop(1, 'rgba(208,188,146,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(${150 + rnd() * 40},${130 + rnd() * 30},${90 + rnd() * 30},0.25)`;
      ctx.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 3, 2 + rnd() * 3);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const dirtMat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false });
    // inside the walls stays green: only worn earth patches where people work and walk
    const patch = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), dirtMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.01, z);
      m.renderOrder = -2;
      m.receiveShadow = true;
      this.scene.add(m);
    };
    patch(MAP.wood.pile[0] - 2, MAP.wood.pile[1] - 1, 9, 8); // woodcutter yard
    patch(MAP.quarry.pile[0] + 2, MAP.quarry.pile[1] - 1, 9, 8); // quarry yard
    patch(MAP.hall[0], MAP.hall[1] + 0.5, 12, 10); // square in front of the konak
    // footpaths (soft-edged strips)
    const pcv = document.createElement('canvas');
    pcv.width = 64;
    pcv.height = 8;
    const pctx = pcv.getContext('2d');
    const pg = pctx.createLinearGradient(0, 0, 64, 0);
    pg.addColorStop(0, 'rgba(206,186,144,0)');
    pg.addColorStop(0.25, 'rgba(206,186,144,0.9)');
    pg.addColorStop(0.75, 'rgba(206,186,144,0.9)');
    pg.addColorStop(1, 'rgba(206,186,144,0)');
    pctx.fillStyle = pg;
    pctx.fillRect(0, 0, 64, 8);
    const ptex = new THREE.CanvasTexture(pcv);
    ptex.colorSpace = THREE.SRGBColorSpace;
    const pathMat = new THREE.MeshLambertMaterial({ map: ptex, transparent: true, depthWrite: false });
    const path = (x1, z1, x2, z2, w = 2.6) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), pathMat);
      m.rotation.order = 'YXZ';
      m.rotation.y = Math.atan2(x2 - x1, z2 - z1);
      m.rotation.x = -Math.PI / 2;
      m.position.set((x1 + x2) / 2, 0.012, (z1 + z2) / 2);
      m.renderOrder = -2;
      m.receiveShadow = true;
      this.scene.add(m);
    };
    path(0, -MAP.half, 0, MAP.hall[1] - 3); // gate → konak
    path(0, MAP.hall[1] + 4, 0, 11); // konak → south houses
    path(MAP.wood.pile[0], 9, MAP.quarry.pile[0], 9); // east–west street
    path(-7, 9, -7, 4, 2.2);
    path(7, 9, 7, 4, 2.2);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(5, 60), new THREE.MeshLambertMaterial({ color: 0xcdb48a, transparent: true, opacity: 0.85, depthWrite: false }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.012, -MAP.half - 30);
    road.renderOrder = -2;
    road.receiveShadow = true;
    this.scene.add(road);
  }

  countryside() {
    const add = (o, x, z, ry = 0) => {
      o.position.set(x, 0, z);
      o.rotation.y = ry;
      this.scene.add(o);
    };
    // fields to the south & east
    add(field(7, 5), -8, 22);
    add(field(7, 5), 1, 22, 0.05);
    add(field(6, 6), 22, 6, Math.PI / 2);
    add(field(6, 6), 22, -3, Math.PI / 2);
    // a few tents of the army camp to the west
    for (const [x, z] of [[-21, -4], [-23, 3], [-20, 9], [-25, -10]]) add(tent(), x, z, rr(0, 3));
    // trees (instanced copies of one mesh)
    const t = tree();
    const spots = [];
    for (let i = 0; i < 70; i++) {
      const a = rr(0, Math.PI * 2);
      const r = rr(20, 60);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(x) < 4 && z < -15) continue; // keep the road clear
      if (z < -18 && Math.abs(x) < 20) continue; // and the battlefield
      if (Math.abs(x + 9) < 6 && Math.abs(z - 22) < 5) continue;
      spots.push([x, z]);
    }
    const im = new THREE.InstancedMesh(t.geometry, t.material, spots.length);
    const o = new THREE.Object3D();
    spots.forEach(([x, z], i) => {
      o.position.set(x, 0, z);
      o.rotation.y = rr(0, 6);
      o.scale.setScalar(rr(0.8, 1.4));
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    im.castShadow = im.receiveShadow = true;
    this.scene.add(im);
    // grass tufts & wild flowers
    const tuft = new Builder();
    for (let k = 0; k < 5; k++) tuft.add(P.cone(0.07, 0.55, 3), k % 2 ? 0x7fa046 : 0x95b455, [Math.cos(k * 1.3) * 0.12, 0.25, Math.sin(k * 1.3) * 0.12], [Math.cos(k) * 0.3, 0, Math.sin(k) * 0.3]);
    const flower = new Builder()
      .add(P.cone(0.05, 0.4, 3), 0x7fa046, [0, 0.2, 0])
      .add(P.sph(0.08, 5, 4), 0xe8d24a, [0, 0.42, 0])
      .add(P.cone(0.05, 0.32, 3), 0x7fa046, [0.12, 0.16, 0.05])
      .add(P.sph(0.07, 5, 4), 0xe85a4a, [0.12, 0.33, 0.05]);
    const scatter = (geo, n, rMin, rMax) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), n);
      let i = 0;
      while (i < n) {
        const x = rr(-rMax, rMax);
        const z = rr(-rMax, rMax);
        const d = Math.max(Math.abs(x), Math.abs(z));
        if (d < rMin || (Math.abs(x) < 3.5 && z < -14)) continue;
        o.position.set(x, 0, z);
        o.rotation.y = rr(0, 6);
        o.scale.setScalar(rr(0.7, 1.5));
        o.updateMatrix();
        m.setMatrixAt(i++, o.matrix);
      }
      this.scene.add(m);
    };
    scatter(tuft.build(), 900, 16.5, 48);
    scatter(flower.build(), 220, 16.5, 40);
    // distant hills
    const b = new Builder();
    for (let i = 0; i < 18; i++) {
      const a = rr(0, Math.PI * 2);
      const r = rr(130, 190);
      const h = rr(14, 30);
      b.add(P.sph(1, 12, 8), i % 2 ? 0x8fb070 : 0x9cbc7a, [Math.cos(a) * r, 0, Math.sin(a) * r], [0, 0, 0], [rr(40, 70), h, rr(40, 70)]);
    }
    this.scene.add(new THREE.Mesh(b.build(), new THREE.MeshLambertMaterial({ vertexColors: true })));
  }

  update(t, camX, camZ) {
    this.skyMesh.position.set(camX, 0, camZ);
  }
}
