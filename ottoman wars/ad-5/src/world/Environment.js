import * as THREE from '../vendor/three.module.min.js';
import { Builder, P } from './geom.js';
import { MAP, OUTPOSTS } from '../config.js';
import { T, tent, tree, ridge } from './Town.js';

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
  constructor(scene, tentFactory = null) {
    this.scene = scene;
    this.tentFactory = tentFactory; // the artist's çadır when it loaded
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
      // flat valley: the camp, the meadow and the road north to the enemy headquarters
      const d = Math.max(Math.abs(x), z > 0 ? z : Math.max(0, -z - 60));
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
    grad.addColorStop(0, 'rgba(176,146,100,0.95)');
    grad.addColorStop(0.7, 'rgba(170,140,96,0.8)');
    grad.addColorStop(1, 'rgba(170,140,96,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(${110 + rnd() * 60},${90 + rnd() * 50},${60 + rnd() * 40},0.35)`;
      ctx.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 3, 2 + rnd() * 3);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const dirtMat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false });
    const patch = (x, z, w, d, ry = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), dirtMat);
      m.rotation.order = 'YXZ';
      m.rotation.y = ry;
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.01, z);
      m.renderOrder = -2;
      m.receiveShadow = true;
      this.scene.add(m);
    };
    // kitchen yard, table & coin area, drill ground, the meadow path and the road north to the enemy
    patch(4, -0.6, 22, 10);
    patch(-1, -12.5, 18, 10);
    patch(-11.5, -4, 7, 20);
    for (let z = -20; z > -80; z -= 8) patch(0, z, 10, 10);
    for (const o of OUTPOSTS) patch(0, o.z, 20, 14);
    patch(-1, 8, 5, 6);
  }

  countryside() {
    const add = (o, x, z, ry = 0) => {
      o.position.set(x, 0, z);
      o.rotation.y = ry;
      this.scene.add(o);
    };
    // the army camp: rows of tents around the kitchen
    const tents = [[17, -10], [20, -5], [18.5, 1], [16, 5.5], [-17, -9], [-17.5, -2], [-16.5, 5], [11, 8], [14, -14], [-14, -15]];
    for (const [x, z] of tents) add(this.tentFactory ? this.tentFactory() : tent(), x, z, Math.atan2(-x, -z) + rr(-0.3, 0.3));
    const t = tree();
    const spots = [];
    for (let i = 0; i < 90; i++) {
      const x = rr(-60, 60);
      const z = rr(-95, 60);
      if (Math.abs(x) < 23 && z > -22 && z < 22) continue; // camp + meadow
      if (Math.abs(x) < 16 && z < -18) continue; // the road and the outposts
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
        if (z < -85) continue;
        if (Math.abs(x) < rMin && z > -22 && z < 8) continue;
        if (Math.abs(x) < 13 && z < -18) continue;
        o.position.set(x, 0, z);
        o.rotation.y = rr(0, 6);
        o.scale.setScalar(rr(0.7, 1.5));
        o.updateMatrix();
        m.setMatrixAt(i++, o.matrix);
      }
      this.scene.add(m);
    };
    scatter(tuft.build(), 900, 15, 60);
    scatter(flower.build(), 320, 15, 50);
    // rocky ridges flanking the valley to the north
    this.scene.add(ridge(-24, -70, -40, 10, 6, 14, 3));
    this.scene.add(ridge(24, 70, -46, 10, 6, 14, 7));
    this.scene.add(ridge(-20, -70, -82, 10, 10, 22, 11));
    this.scene.add(ridge(20, 70, -86, 10, 10, 22, 13));
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
