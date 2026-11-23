import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import foxUrl from '../assets/models/fox.glb';
import frogUrl from '../assets/models/frog.glb';
import owlUrl from '../assets/models/owl.glb';
import axolotlUrl from '../assets/models/axolotl.glb';
import rabbitUrl from '../assets/models/rabbit.glb';
import beeUrl from '../assets/models/line-bee.glb';
import puffUrl from '../assets/models/puff-mushroom.glb';
import babyUrl from '../assets/models/baby-bloop.glb';
import cocoonUrl from '../assets/models/cocoon.glb';

// The artist's Bloop models (1 unit tall, feet at y = 0, facing +Z), inlined as data URLs.
const URLS = { fox: foxUrl, frog: frogUrl, owl: owlUrl, axolotl: axolotlUrl, rabbit: rabbitUrl, bee: beeUrl, puff: puffUrl, baby: babyUrl, cocoon: cocoonUrl };
export const ANIMALS = ['fox', 'frog', 'owl', 'axolotl', 'rabbit'];
// signature colour of each animal (particles, combo text)
export const ANIMAL_COLORS = [0xff9f47, 0x74d6af, 0xad8ce5, 0x73c5ee, 0xf4a9cb];

function parse(url) {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Promise((resolve, reject) => new GLTFLoader().parse(bytes.buffer, '', resolve, reject));
}

export async function loadModels() {
  const out = {};
  await Promise.all(Object.entries(URLS).map(async ([k, u]) => (out[k] = await parse(u))));
  return out;
}

// Jelly look without real transparency: the body glows a little from inside and its rim lights up.
function jellify(mat, { rainbow = false } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = mat.userData.time;
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
vec3 hue2rgb(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }`,
      )
      .replace(
        '#include <color_fragment>',
        rainbow
          ? `#include <color_fragment>
  float lum = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15));
  vec3 rb = hue2rgb(fract(uTime * 0.35 + vViewPosition.y * 0.9 + vViewPosition.x * 0.35));
  diffuseColor.rgb = mix(diffuseColor.rgb, rb * (0.55 + lum * 0.7), 0.85);`
          : '#include <color_fragment>',
      )
      .replace(
        '#include <opaque_fragment>',
        `float fres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.4);
  outgoingLight += diffuseColor.rgb * ${rainbow ? '0.3' : '0.1'} + mix(diffuseColor.rgb, vec3(1.0), 0.35) * fres * 0.4;
  #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => (rainbow ? 'jelly-rainbow' : 'jelly');
  return mat;
}

export class Pieces {
  constructor(models, envMap) {
    this.models = models;
    this.time = { value: 0 };
    const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0, envMap, envMapIntensity: 0.6, ...o });
    this.mats = {
      jelly: jellify(Object.assign(std({ roughness: 0.22 }), { userData: { time: this.time } })),
      rainbow: jellify(Object.assign(std({ roughness: 0.18 }), { userData: { time: this.time } }), { rainbow: true }),
      face: std({ roughness: 0.18 }),
      shell: std({ roughness: 0.5, envMapIntensity: 0.5 }),
    };
    // how big each model sits in a cell (the widest ones are scaled down a little)
    this.fit = {};
    for (const [k, g] of Object.entries(models)) {
      const size = new THREE.Box3().setFromObject(g.scene).getSize(new THREE.Vector3());
      this.fit[k] = Math.min(1.0, 1.1 / Math.max(size.x, 0.01));
    }
  }

  // kind: animal | bee | puff | rainbow | cocoon | baby
  make(kind, type = 0) {
    const name = kind === 'animal' ? ANIMALS[type] : kind === 'rainbow' ? 'baby' : kind;
    const g = this.models[name];
    const model = g.scene.clone(true);
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = false;
      if (name === 'cocoon') o.material = this.mats.shell;
      else if (o.name.startsWith('Body')) o.material = kind === 'rainbow' ? this.mats.rainbow : this.mats.jelly;
      else {
        o.material = this.mats.face;
        o.castShadow = false;
      }
    });
    const inner = new THREE.Group();
    inner.add(model);
    const root = new THREE.Group();
    root.add(inner);
    const s = this.fit[name] * (kind === 'rainbow' ? 1.08 : 1);
    model.scale.setScalar(s);
    const mixer = new THREE.AnimationMixer(model);
    const clips = Object.fromEntries(g.animations.map((a) => [a.name, a]));
    const view = { kind, type, name, root, inner, model, mixer, clips, sq: 1, sqv: 0, yaw: 0, yawT: 0, lookT: Math.random() * 4, scale: 1, hp: 2 };
    if (clips.Idle) {
      view.idle = mixer.clipAction(clips.Idle);
      view.idle.play();
      view.idle.time = Math.random() * clips.Idle.duration;
    }
    if (clips.Happy) {
      view.happy = mixer.clipAction(clips.Happy);
      view.happy.setLoop(THREE.LoopOnce, 1);
      view.happy.clampWhenFinished = false;
    }
    if (clips.Crack) {
      view.crack = mixer.clipAction(clips.Crack);
      view.crack.setLoop(THREE.LoopOnce, 1);
      view.crack.clampWhenFinished = true;
    }
    return view;
  }

  // the face lights up (eyes close in a smile); idle blinking pauses meanwhile
  smile(v) {
    if (!v.happy) return;
    v.idle?.stop();
    v.happy.reset().play();
    v.smileT = v.clips.Happy.duration;
  }

  squash(v, amount) {
    v.sq = amount;
    v.sqv = 0;
  }

  update(v, dt) {
    v.mixer.update(dt);
    if (v.smileT > 0) {
      v.smileT -= dt;
      if (v.smileT <= 0) v.idle?.reset().play();
    }
    // a springy squash & stretch that keeps the volume
    const acc = -170 * (v.sq - 1) - 11 * v.sqv;
    v.sqv += acc * dt;
    v.sq += v.sqv * dt;
    const k = Math.max(0.4, v.sq);
    const side = 1 / Math.sqrt(k);
    v.inner.scale.set(side * v.scale, k * v.scale, side * v.scale);
    // now and then a Bloop glances at its neighbour
    v.lookT -= dt;
    if (v.lookT <= 0) {
      v.lookT = 2.5 + Math.random() * 5;
      v.yawT = Math.random() < 0.5 ? 0 : (Math.random() - 0.5) * 1.1;
    }
    v.yaw += (v.yawT - v.yaw) * Math.min(1, dt * 5);
    v.inner.rotation.y = v.yaw;
  }

  tick(dt) {
    this.time.value += dt;
  }
}
