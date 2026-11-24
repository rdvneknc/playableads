import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { clone as cloneSkinned } from '../vendor/SkeletonUtils.js';
import commanderUrl from '../assets/models/ottoman-commander.glb';
import bearUrl from '../assets/models/brown-bear.glb';
import yeniceriUrl from '../assets/models/yeniceri.glb';
import yeniceriMaviUrl from '../assets/models/yeniceri-mavi.glb';
import azapUrl from '../assets/models/azap.glb';
import asciUrl from '../assets/models/asci.glb';
import cadirUrl from '../assets/models/cadir.glb';
import wallUrl from '../assets/models/wall-straight.glb';
import cornerUrl from '../assets/models/wall-corner-tower.glb';
import palaceUrl from '../assets/models/palace.glb';
import houseUrl from '../assets/models/house.glb';
import archerUrl from '../assets/models/archer-tower.glb';
import windmillUrl from '../assets/models/windmill.glb';
import goldUrl from '../assets/models/gold-storage.glb';

// The artist's .glb models, inlined in the build as data URLs.
//   hero – Osmanlı komutanı (Idle / Walk / Attack / Carry, CarrySocket)
//   bear – boz ayı (Idle / Walk / Attack / Die), also the boss at 1.7×
//   jan / enemy / azap / worker – soldiers, archers on the towers, quarry workers
//   tent + the town kit – the camp and the fortress it turns into
const URLS = {
  hero: commanderUrl, bear: bearUrl, jan: yeniceriUrl, enemy: yeniceriMaviUrl, azap: azapUrl, worker: asciUrl, tent: cadirUrl,
  wall: wallUrl, corner: cornerUrl, palace: palaceUrl, house: houseUrl, archer: archerUrl, windmill: windmillUrl, gold: goldUrl,
};

function parseGlb(url) {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Promise((resolve, reject) => new GLTFLoader().parse(bytes.buffer, '', resolve, reject));
}

export async function loadModels() {
  const out = {};
  await Promise.all(
    Object.entries(URLS).map(async ([k, url]) => {
      try {
        out[k] = await parseGlb(url);
      } catch (e) {
        console.warn(`${k}.glb failed to load`, e);
      }
    }),
  );
  return out;
}

// all the artist's models share one unit scale; this maps a 2.3 m tall Yeniçeri onto the game
export function unitScale(gltf, height = 2.3) {
  const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
  return height / Math.max(0.01, size.y);
}

const shadowed = (o) =>
  o.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });

// a static prop turned to face -Z like everything else in the game
export function staticModel(gltf, scale, tint = null) {
  const g = new THREE.Group();
  const m = gltf.scene.clone(true);
  if (tint != null)
    m.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.color = new THREE.Color(tint);
      }
    });
  m.scale.setScalar(scale);
  m.rotation.y = Math.PI;
  shadowed(m);
  g.add(m);
  g.model = m;
  return g;
}

// the cannon: same interface as the built-in fieldCannon (barrel, wheels, recoil, muzzle)
export function cannonModel(gltf, scale) {
  const g = staticModel(gltf, scale);
  const barrel = g.model.getObjectByName('Namlu');
  g.barrel = barrel;
  g.wheels = ['TekerlekSol', 'TekerlekSag'].map((n) => g.model.getObjectByName(n)).filter(Boolean);
  g.wheelSign = -1;
  const z0 = barrel.position.z;
  g.recoil = (k) => (barrel.position.z = z0 - k * 0.35);
  g.muzzleFwd = 1.5 * scale;
  g.muzzleY = 1.2 * scale;
  return g;
}

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

// A pool of animated (skinned) characters. On top of the clips it can pose a unit
// sitting on its heels (diz çökmüş) and holding a bowl with both hands.
export class SkinnedCrowd {
  constructor(scene, gltf, count, scale, { hide = [] } = {}) {
    this.units = [];
    const clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
    for (let i = 0; i < count; i++) {
      const model = cloneSkinned(gltf.scene);
      model.scale.setScalar(scale);
      model.rotation.y = Math.PI; // the models face +Z, the game uses -Z as forward
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.frustumCulled = false;
          if (hide.some((h) => o.name.includes(h))) o.visible = false;
        }
      });
      const root = new THREE.Group();
      root.add(model);
      root.visible = false;
      scene.add(root);
      const mixer = new THREE.AnimationMixer(model);
      const actions = {};
      for (const [name, clip] of Object.entries(clips)) {
        const a = mixer.clipAction(clip);
        if (name === 'Die') {
          a.setLoop(THREE.LoopOnce, 1);
          a.clampWhenFinished = true;
        }
        actions[name] = a;
      }
      const bones = {};
      model.traverse((o) => {
        if (o.isBone) bones[o.name] = o;
      });
      const pelvisY = bones.Pelvis ? bones.Pelvis.position.y : 1;
      this.units.push({ root, model, mixer, actions, bones, pelvisY, cur: null, sit: 0, hold: 0 });
    }
  }

  // anim: clip name; opts.sit / opts.hold add the seated pose and the bowl-holding arms
  update(i, x, y, z, yaw, anim, dt, { speed = 1, sit = false, hold = false } = {}) {
    const u = this.units[i];
    if (!u) return;
    u.root.visible = true;
    u.root.position.set(x, y, z);
    u.root.rotation.y = yaw;
    const want = u.actions[anim] ? anim : 'Idle';
    if (want !== u.cur) {
      const next = u.actions[want];
      if (next) {
        next.enabled = true;
        next.setEffectiveTimeScale(1);
        next.setEffectiveWeight(1);
        if (want === 'Die') next.reset();
        else if (!next.isRunning()) next.time = Math.random() * next.getClip().duration;
        next.play();
        if (u.cur && u.actions[u.cur]) u.actions[u.cur].crossFadeTo(next, 0.18, false);
      }
      u.cur = want;
    }
    const a = u.actions[want];
    if (a && want !== 'Die') a.timeScale = speed;
    u.mixer.update(dt);
    u.sit += ((sit ? 1 : 0) - u.sit) * Math.min(1, dt * 10);
    u.hold += ((hold ? 1 : 0) - u.hold) * Math.min(1, dt * 10);
    this.pose(u);
  }

  pose(u) {
    const B = u.bones;
    const k = u.sit;
    const set = (b, x, y, z, w) => {
      if (!b) return;
      _e.set(x, y, z);
      b.quaternion.slerp(_q.setFromEuler(_e), w);
    };
    if (k > 0.01 && B.Pelvis) {
      // kneel and sit back on the heels
      B.Pelvis.position.y = u.pelvisY - k * u.pelvisY * 0.62;
      set(B.ThighL, -1.45 * k, 0, 0.08 * k, k);
      set(B.ThighR, -1.45 * k, 0, -0.08 * k, k);
      set(B.ShinL, 2.75 * k, 0, 0, k);
      set(B.ShinR, 2.75 * k, 0, 0, k);
      set(B.FootL, -0.9 * k, 0, 0, k);
      set(B.FootR, -0.9 * k, 0, 0, k);
    }
    const h = u.hold;
    if (h > 0.01) {
      set(B.UpperArmSword || B.ArmR, -1.0, 0, 0.35, h);
      set(B.ForearmSword || B.ForearmR, -0.9, 0, 0, h);
      set(B.UpperArmShield || B.ArmL, -1.0, 0, -0.35, h);
      set(B.ForearmShield || B.ForearmL, -0.9, 0, 0, h);
    }
  }

  // between the two hands, in world space
  hand(i, out) {
    const u = this.units[i];
    const a = u?.bones.HandSword || u?.bones.HandR;
    const b = u?.bones.HandShield || u?.bones.HandL;
    if (!a || !b) return null;
    a.getWorldPosition(_a);
    b.getWorldPosition(_b);
    return out.addVectors(_a, _b).multiplyScalar(0.5);
  }

  hide(i) {
    if (this.units[i]) this.units[i].root.visible = false;
  }

  hideFrom(n) {
    for (let i = n; i < this.units.length; i++) this.units[i].root.visible = false;
  }
}
