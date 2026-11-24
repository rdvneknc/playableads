import * as THREE from '../vendor/three.module.min.js';
import { Builder, P } from './geom.js';
import { tree } from './Town.js';
import { GRID, PITCH } from '../config.js';

// Warm Anatolian steppe around the enemy town: sandy tracks, olive grass islands,
// scattered trees and rocks, and soft afternoon light.

let seed = 11;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const rr = (a, b) => a + (b - a) * rnd();

// cheap smooth value noise
function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => noise(x, z) * 0.6 + noise(x * 2.1 + 5, z * 2.1 + 3) * 0.28 + noise(x * 4.3 + 9, z * 4.3 + 1) * 0.12;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function grainTexture() {
  const N = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(0, 0, N, N);
  for (let i = 0; i < 7000; i++) {
    const l = 200 + rnd() * 55;
    ctx.fillStyle = `rgba(${l},${l * 0.97},${l * 0.9},0.45)`;
    ctx.fillRect(rnd() * N, rnd() * N, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * N;
    const y = rnd() * N;
    const l = 180 + rnd() * 75;
    ctx.strokeStyle = `rgba(${l * 0.9},${l},${l * 0.75},0.35)`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 3);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(60, 60);
  t.anisotropy = 8;
  return t;
}

export const SUN_DIR = new THREE.Vector3(-0.5, 0.82, 0.28).normalize();

const inTown = (x, z, m = 0) =>
  x > GRID.x0 - m && x < GRID.x0 + GRID.cols * PITCH + m && z > GRID.z0 - m && z < GRID.z0 + GRID.rows * PITCH + m;

export class Terrain {
  constructor(scene) {
    this.scene = scene;
    scene.background = new THREE.Color(0xd8c9a4);
    scene.fog = new THREE.Fog(0xd8c9a4, 60, 140);
    this.lights();
    this.ground();
    this.scatter();
  }

  lights() {
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x9a8a62, 1.35));
    const sun = new THREE.DirectionalLight(0xffe6c0, 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -34;
    sc.right = 34;
    sc.top = 34;
    sc.bottom = -34;
    sc.near = 1;
    sc.far = 140;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    sun.target.position.set(0, 0, -11);
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 70);
    this.scene.add(sun, sun.target);
    this.sun = sun;
  }

  ground() {
    const S = 220;
    const geo = new THREE.PlaneGeometry(S, S, 220, 220);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const sand = new THREE.Color(0xe3c591);
    const sandLight = new THREE.Color(0xefd7a8);
    const grass = new THREE.Color(0xa9ad62);
    const grassDark = new THREE.Color(0x929a4e);
    const yard = new THREE.Color(0xb3b872);
    const c = new THREE.Color();
    const g = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const n = fbm(x * 0.055 + 3, z * 0.055 - 7);
      // tracks: a sandy band around the town and a road toward the camera
      const ring = Math.max(Math.abs(x) - 18, Math.abs(z + 13.5) - 13);
      const road = Math.abs(x - Math.sin(z * 0.06) * 4) - 3.5;
      let k = smooth(0.5, 0.58, n);
      if (ring < 6 && ring > -1) k *= smooth(0, 6, ring) ;
      if (z > -2) k *= smooth(0, 3, road);
      c.copy(sand).lerp(sandLight, noise(x * 0.3, z * 0.3) * 0.6);
      g.copy(grass).lerp(grassDark, noise(x * 0.2 + 4, z * 0.2) * 0.8);
      c.lerp(g, k);
      // grassy yards inside the walls
      if (inTown(x, z, -0.6)) c.copy(yard).lerp(grassDark, noise(x * 0.4, z * 0.4) * 0.35);
      c.convertSRGBToLinear();
      col.set([c.r, c.g, c.b], i * 3);
      const far = Math.max(0, Math.hypot(x, z + 10) - 55);
      pos.setY(i, far * far * 0.006 * (0.6 + n) - 0.02);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, map: grainTexture() }));
    m.receiveShadow = true;
    this.scene.add(m);
  }

  scatter() {
    const o = new THREE.Object3D();
    // trees on the grass islands, away from the town and the deploy ground near it
    const t = tree();
    const spots = [];
    for (let i = 0; i < 400 && spots.length < 46; i++) {
      const x = rr(-70, 70);
      const z = rr(-80, 40);
      if (Math.abs(x) < 27 && z > -33 && z < 12) continue;
      if (fbm(x * 0.055 + 3, z * 0.055 - 7) < 0.55) continue;
      spots.push([x, z]);
    }
    for (const p of [[-26, -30], [27, -31], [-29, 6], [30, 4], [-34, -14], [35, -18]]) spots.push(p);
    const im = new THREE.InstancedMesh(t.geometry, t.material, spots.length);
    spots.forEach(([x, z], i) => {
      o.position.set(x, 0, z);
      o.rotation.y = rr(0, 6);
      o.scale.setScalar(rr(1.1, 1.9));
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    im.castShadow = im.receiveShadow = true;
    this.scene.add(im);
    // rocks
    const rock = new Builder().add(new THREE.DodecahedronGeometry(0.6, 0), 0xb8ab94, [0, 0.25, 0], [0, 0, 0], [1, 0.6, 0.8]).add(new THREE.DodecahedronGeometry(0.4, 0), 0xa89a82, [0.55, 0.15, 0.2], [0.4, 1, 0]).build();
    const rocks = new THREE.InstancedMesh(rock, new THREE.MeshLambertMaterial({ vertexColors: true }), 40);
    for (let i = 0; i < 40; i++) {
      let x;
      let z;
      do {
        x = rr(-50, 50);
        z = rr(-60, 30);
      } while (inTown(x, z, 3) || (Math.abs(x) < 24 && z > -28 && z < 6 && rnd() < 0.7));
      o.position.set(x, 0, z);
      o.rotation.y = rr(0, 6);
      o.scale.setScalar(rr(0.7, 1.8));
      o.updateMatrix();
      rocks.setMatrixAt(i, o.matrix);
    }
    rocks.castShadow = rocks.receiveShadow = true;
    this.scene.add(rocks);
    // dry grass tufts
    const tuft = new Builder();
    for (let k = 0; k < 5; k++) tuft.add(P.cone(0.06, 0.45, 3), k % 2 ? 0x8a8f42 : 0xa3a052, [Math.cos(k * 1.3) * 0.1, 0.2, Math.sin(k * 1.3) * 0.1], [Math.cos(k) * 0.3, 0, Math.sin(k) * 0.3]);
    const tufts = new THREE.InstancedMesh(tuft.build(), new THREE.MeshLambertMaterial({ vertexColors: true }), 700);
    let i = 0;
    while (i < 700) {
      const x = rr(-55, 55);
      const z = rr(-60, 35);
      if (inTown(x, z, 0.6)) continue;
      if (fbm(x * 0.055 + 3, z * 0.055 - 7) < 0.48 && rnd() < 0.85) continue;
      o.position.set(x, 0, z);
      o.rotation.y = rr(0, 6);
      o.scale.setScalar(rr(0.8, 1.6));
      o.updateMatrix();
      tufts.setMatrixAt(i++, o.matrix);
    }
    this.scene.add(tufts);
  }
}
