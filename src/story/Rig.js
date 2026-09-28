import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Assets } from '../core/AssetLoader.js';

// Personaggi con scheletro (public/assets/story/characters/<id>.glb). Le ossa hanno nomi in stile Mixamo
// (Hips, LeftUpLeg, LeftLeg, Spine, LeftArm, LeftForeArm, Head…); se un modello ne usasse altri,
// BONE_PATTERNS li riconosce per somiglianza e il lato si ricava dalla posizione.

const cache = new Map();

function loadGltf(url) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((resolve) => {
      new GLTFLoader().load(url, (g) => resolve(g), undefined, () => resolve(null));
    }));
  }
  return cache.get(url);
}

/** Percorso del modello con scheletro di un personaggio della Storia. */
export const riggedUrl = (character) => `assets/story/characters/${character.id}.glb`;

/**
 * Carica e clona (con lo scheletro) il personaggio. Ritorna { root, rig } oppure null se il file manca.
 * root: gruppo con i piedi a y = 0, alto `height`, che guarda verso +Z.
 * Un modello senza scheletro (o con ossa irriconoscibili) torna con rig = null: si anima come corpo rigido.
 */
export async function loadRigged(url, height = 1.8) {
  if (!(await Assets.exists(url))) return null;
  const gltf = await loadGltf(url);
  if (!gltf) return null;
  const scene = SkeletonUtils.clone(gltf.scene);
  let skinned = null;
  scene.traverse((o) => {
    if (o.isSkinnedMesh && !skinned) skinned = o;
    if (o.isMesh) {
      o.castShadow = true;
      o.frustumCulled = false; // il riquadro della mesh non segue le ossa animate
      if (o.material && o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
    }
  });
  // normalizza: altezza e piedi a terra
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene, true);
  const size = box.getSize(new THREE.Vector3());
  const k = height / Math.max(0.001, size.y);
  scene.scale.multiplyScalar(k);
  scene.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
  const root = new THREE.Group();
  root.add(scene);
  root.updateMatrixWorld(true);
  if (!skinned) return { root, rig: null };
  const rig = new RigAnimator(root, skinned.skeleton);
  // servono almeno le due cosce per camminare con le ossa; altrimenti corpo rigido
  return { root, rig: rig.hasLegs ? rig : null };
}

const BONE_PATTERNS = {
  hips: [/^hips$/i, /pelvis|hip/i],
  spine: [/^spine$/i, /spine|chest/i],
  spine1: [/^spine0?1$/i],
  spine2: [/^spine0?2$/i],
  neck: [/^neck$/i, /neck/i],
  head: [/^head$/i, /^head(?!_end|front)/i],
  upLegL: [/^leftupleg$/i, /(left|\bl\b|_l\b|\.l\b).*(up.?leg|thigh)|(up.?leg|thigh).*(left|_l\b|\.l\b)/i],
  upLegR: [/^rightupleg$/i, /(right|\br\b|_r\b|\.r\b).*(up.?leg|thigh)|(up.?leg|thigh).*(right|_r\b|\.r\b)/i],
  legL: [/^leftleg$/i, /(left|_l\b|\.l\b).*(calf|shin|knee|lowleg|lower.?leg)/i],
  legR: [/^rightleg$/i, /(right|_r\b|\.r\b).*(calf|shin|knee|lowleg|lower.?leg)/i],
  footL: [/^leftfoot$/i, /(left|_l\b|\.l\b).*foot/i],
  footR: [/^rightfoot$/i, /(right|_r\b|\.r\b).*foot/i],
  armL: [/^leftarm$/i, /(left|_l\b|\.l\b).*(upper.?arm|^arm)/i],
  armR: [/^rightarm$/i, /(right|_r\b|\.r\b).*(upper.?arm|^arm)/i],
  foreArmL: [/^leftforearm$/i, /(left|_l\b|\.l\b).*(fore.?arm|lower.?arm)/i],
  foreArmR: [/^rightforearm$/i, /(right|_r\b|\.r\b).*(fore.?arm|lower.?arm)/i]
};

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const _q = new THREE.Quaternion();
const _m = new THREE.Quaternion();

/**
 * Anima le ossa con rotazioni espresse negli assi del personaggio (non in quelli, arbitrari, di ogni osso):
 * x = avanti/indietro (negativo = in avanti per gambe e braccia, positivo = busto in avanti),
 * z = di lato (positivo = verso la sinistra del personaggio), y = torsione.
 */
export class RigAnimator {
  constructor(root, skeleton) {
    this.root = root;
    this.bones = {};
    const byName = skeleton.bones;
    for (const [key, pats] of Object.entries(BONE_PATTERNS)) {
      for (const re of pats) {
        const b = byName.find((x) => re.test(x.name) && !Object.values(this.bones).includes(x));
        if (b) { this.bones[key] = b; break; }
      }
    }
    // lato dalle posizioni, se i nomi non lo dicevano: sinistra del personaggio = +X
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const wx = (b) => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv).x;
    for (const [l, r] of [['upLegL', 'upLegR'], ['legL', 'legR'], ['footL', 'footR'], ['armL', 'armR'], ['foreArmL', 'foreArmR']]) {
      const bl = this.bones[l], br = this.bones[r];
      // i nomi espliciti vincono: alcuni scheletri generati hanno le anche quasi al centro, e la posizione ingannerebbe
      if (!bl || !br || /left|right/i.test(bl.name + br.name)) continue;
      if (wx(bl) < wx(br)) { this.bones[l] = br; this.bones[r] = bl; }
    }
    // riposo: rotazione locale e orientamento dell'osso negli assi del personaggio (per convertire le pose)
    const rootQ = root.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.rest = new Map();
    for (const b of Object.values(this.bones)) {
      const w = rootQ.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion()));
      this.rest.set(b, { q: b.quaternion.clone(), w, wInv: w.clone().invert(), base: null });
    }
    // braccia: le pose presuppongono braccia lungo i fianchi. Se a riposo un braccio è alzato o in T
    // (es. il Bacco tiene su i grappoli), una rotazione di base lo porta giù prima delle pose.
    const pos = (b) => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    for (const [arm, fore, side] of [['armL', 'foreArmL', 1], ['armR', 'foreArmR', -1]]) {
      const a = this.bones[arm], f = this.bones[fore];
      if (!a || !f) continue;
      const dir = pos(f).sub(pos(a)).normalize();
      const hang = new THREE.Vector3(side * 0.26, -0.97, 0).normalize();
      if (dir.angleTo(hang) > 0.35) this.rest.get(a).base = new THREE.Quaternion().setFromUnitVectors(dir, hang);
    }
    this.hasLegs = !!(this.bones.upLegL && this.bones.upLegR);
    const wy = (b) => b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv).y;
    const { legL, footL, legR, footR } = this.bones;
    // gambe: la coscia si anima se il piede sta ben sotto l'anca (certi scheletri aggiunti a mano, come la
    // Monna con la veste lunga, hanno piede e ginocchio sopra l'anca: lì le gambe restano ferme);
    // il ginocchio si piega solo se sta davvero tra anca e piede
    const { upLegL, upLegR } = this.bones;
    const chain = (up, knee, foot) => up && knee && foot && { up: wy(up), knee: wy(knee), foot: wy(foot) };
    const L = chain(upLegL, legL, footL), R = chain(upLegR, legR, footR);
    this.legsOk = !!(L && R) && L.foot < L.up - 0.15 && R.foot < R.up - 0.15;
    this.kneeOk = this.legsOk && [L, R].every((c) => c.knee < c.up - 0.05 && c.foot < c.knee - 0.02);
  }

  /** pose: { chiaveOsso: { x, y, z } } in radianti; le ossa non citate tornano a riposo. */
  apply(pose) {
    for (const [key, b] of Object.entries(this.bones)) {
      const r = this.rest.get(b);
      b.quaternion.copy(r.q);
      let p = pose[key];
      if (p && !this.kneeOk && /^(leg|foot)[LR]$/.test(key)) p = null;
      if (p && !this.legsOk && /^upLeg[LR]$/.test(key)) p = null;
      if (!p && !r.base) continue;
      // rotazione negli assi del personaggio (x, poi z, poi y), dopo l'eventuale correzione di base
      _m.identity();
      if (p?.x) _m.multiply(_q.setFromAxisAngle(AXES.x, p.x));
      if (p?.z) _m.multiply(_q.setFromAxisAngle(AXES.z, p.z));
      if (p?.y) _m.multiply(_q.setFromAxisAngle(AXES.y, p.y));
      if (r.base) _m.multiply(r.base);
      // stessa rotazione nello spazio dell'osso: riposo · w⁻¹ · M · w
      b.quaternion.multiply(_q.copy(r.wInv).multiply(_m).multiply(r.w));
    }
  }
}

/**
 * Pose di base condivise da livello e piazza.
 * phase = fase del passo, run = 0..1 intensità della corsa, air = -1..1 (salita/discesa) o null a terra.
 */
export function locomotionPose({ phase = 0, run = 0, air = null, climb = false, throwT = 0, lean = 0 }) {
  const P = {};
  if (climb) {
    const s = Math.sin(phase);
    P.upLegL = { x: -0.5 - s * 0.4 }; P.upLegR = { x: -0.5 + s * 0.4 };
    P.legL = { x: 0.8 }; P.legR = { x: 0.8 };
    P.armL = { x: -2.6 + s * 0.35, z: 0.2 }; P.armR = { x: -2.6 - s * 0.35, z: -0.2 };
    P.foreArmL = { x: -0.4 }; P.foreArmR = { x: -0.4 };
    return P;
  }
  if (air !== null) {
    // salto: una gamba avanti piegata, l'altra dietro, braccia su
    P.upLegL = { x: -0.9 }; P.legL = { x: 1.1 };
    P.upLegR = { x: 0.35 }; P.legR = { x: 0.5 };
    const up = air > 0 ? 1 : 0.6;
    P.armL = { x: -1.2 * up, z: 1.0 * up }; P.armR = { x: -1.2 * up, z: -1.0 * up };
    P.foreArmL = { x: -0.5 }; P.foreArmR = { x: -0.5 };
    P.spine = { x: 0.08 };
  } else {
    // camminata/corsa: gambe e braccia in opposizione, ginocchia che si piegano nel passaggio
    const s = Math.sin(phase), c = Math.cos(phase);
    const a = 0.2 + run * 0.55;
    P.upLegL = { x: -s * a }; P.upLegR = { x: s * a };
    P.legL = { x: Math.max(0, c) * (0.3 + run * 0.9) }; P.legR = { x: Math.max(0, -c) * (0.3 + run * 0.9) };
    P.footL = { x: -Math.max(0, c) * 0.25 * run }; P.footR = { x: -Math.max(0, -c) * 0.25 * run };
    P.armL = { x: s * a * 0.9, z: 0.15 }; P.armR = { x: -s * a * 0.9, z: -0.15 };
    P.foreArmL = { x: -0.35 - run * 0.35 }; P.foreArmR = { x: -0.35 - run * 0.35 };
    P.spine = { x: 0.06 + run * 0.12 + lean, y: s * 0.12 * run };
    P.head = { x: -run * 0.08 };
  }
  if (throwT > 0) {
    // lancio col braccio destro: da sopra la testa, dietro, a davanti
    const t = 1 - throwT;
    P.armR = { x: THREE.MathUtils.lerp(-2.9, -1.3, Math.min(1, t * 1.6)), z: -0.25 };
    P.foreArmR = { x: THREE.MathUtils.lerp(-1.4, -0.1, Math.min(1, t * 1.6)) };
    P.spine = { ...(P.spine || {}), y: (P.spine?.y || 0) + THREE.MathUtils.lerp(0.35, -0.3, t) };
  }
  return P;
}
