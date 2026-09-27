import * as THREE from 'three';
import { Assets } from '../core/AssetLoader.js';
import * as T from '../core/Textures.js';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

function shadow(o) {
  o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return o;
}

/** Statua di Oremo: giovane con spada e scudo, o anziano con un braccio solo e il libro. */
function statue(kind, pal) {
  const g = new THREE.Group();
  const stone = mat(pal.rock || '#b39064', { roughness: 0.95 });
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, 0.6, 10), stone);
  ped.position.y = 0.3;
  g.add(ped);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.6, 6, 12), stone);
  body.position.y = 1.9;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), stone);
  head.position.y = 3.25;
  g.add(head);
  if (kind === 'giovane') {
    const helm = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.5, 12), stone);
    helm.position.y = 3.65;
    g.add(helm);
    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.3), stone);
    sword.position.set(0.85, 2.6, 0);
    g.add(sword);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.14, 16), stone);
    shield.rotation.z = Math.PI / 2;
    shield.position.set(-0.9, 2.1, 0.2);
    g.add(shield);
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.9, 4, 8), stone);
      arm.position.set(s * 0.75, 2.4, 0);
      g.add(arm);
    }
  } else {
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.9, 12, 1, true), stone);
    hood.position.y = 3.4;
    g.add(hood);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.9, 4, 8), stone);
    arm.position.set(0.75, 2.3, 0.3);
    arm.rotation.x = -0.9;
    g.add(arm);
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.9), stone);
    book.position.set(0.75, 1.9, 0.75);
    g.add(book);
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 8), stone);
    beard.rotation.x = Math.PI;
    beard.position.set(0, 2.85, 0.32);
    g.add(beard);
  }
  return shadow(g);
}

function diner() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 4), mat('#f0e4cf'));
  base.position.y = 1.3;
  g.add(base);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.3, 4.6), mat('#c0392b'));
  roof.position.y = 2.75;
  g.add(roof);
  const win = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.2, 0.1), mat('#7fd7ff', { emissive: 0x2a8fbf, emissiveIntensity: 0.6, roughness: 0.2 }));
  win.position.set(0, 1.5, 2.03);
  g.add(win);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 0.2), mat('#ff5a6e', { emissive: 0xff2244, emissiveIntensity: 1.5 }));
  sign.position.set(0, 3.4, 1.4);
  g.add(sign);
  for (let i = 0; i < 3; i++) {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.7, 8), mat('#b0b0b0', { metalness: 0.6, roughness: 0.3 }));
    stool.position.set(-1.6 + i * 1.6, 0.35, 3);
    g.add(stool);
  }
  return shadow(g);
}

function depot() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 7), mat('#2fa3a8'));
  body.position.y = 2.5;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 10, 16, 1, false, 0, Math.PI), mat('#ef8f2f'));
  roof.rotation.z = Math.PI / 2;
  roof.position.y = 5;
  g.add(roof);
  for (let i = 0; i < 2; i++) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(3, 3.4, 0.2), mat('#1a2a2e'));
    door.position.set(-2.5 + i * 5, 1.7, 3.55);
    g.add(door);
  }
  const sign = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 0.3), mat('#ffd166', { emissive: 0xffa600, emissiveIntensity: 1.2 }));
  sign.position.set(0, 4.2, 3.7);
  g.add(sign);
  const pipe = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.18, 8, 24), mat('#c9c9c9', { metalness: 0.7, roughness: 0.3 }));
  pipe.position.set(4.2, 3.2, 3.6);
  g.add(pipe);
  return shadow(g);
}

function armored() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.6, 2.4), mat('#3b3f46', { metalness: 0.5, roughness: 0.5 }));
  body.position.y = 1.2;
  g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.8), mat('#5a1f24'));
  top.position.set(-0.4, 2.4, 0);
  g.add(top);
  const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 2.6, 10), mat('#8be9ff', { emissive: 0x2bb8ff, emissiveIntensity: 1.5 }));
  cannon.rotation.z = Math.PI / 2;
  cannon.position.set(1.4, 2.6, 0);
  g.add(cannon);
  for (const z of [-1, 1]) for (const x of [-1.3, 1.3]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12), mat('#151515'));
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.55, z * 1.25);
    g.add(w);
  }
  for (const z of [-0.6, 0.6]) {
    const port = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.4, 8), mat('#ff5a3d', { emissive: 0xff2200, emissiveIntensity: 1 }));
    port.rotation.z = Math.PI / 2;
    port.position.set(2.2, 1.5, z);
    g.add(port);
  }
  return shadow(g);
}

function hoverCar() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 3.2, 6, 14), mat('#d99a2b', { metalness: 0.4, roughness: 0.3 }));
  body.rotation.z = Math.PI / 2;
  body.position.y = 1.2;
  g.add(body);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#9ad9ff', { transparent: true, opacity: 0.7, roughness: 0.1 }));
  canopy.position.set(0.4, 1.7, 0);
  g.add(canopy);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 1.4), mat('#4cf0ff', { emissive: 0x2ad4ff, emissiveIntensity: 3 }));
  glow.position.y = 0.35;
  g.add(glow);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.1), mat('#1f4a2c'));
  fin.position.set(-1.8, 1.9, 0);
  g.add(fin);
  return shadow(g);
}

function fountain() {
  const g = new THREE.Group();
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.5, 1, 24), mat('#b8a07a'));
  basin.position.y = 0.5;
  g.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 0.2, 24), mat('#4fb3e8', { roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85 }));
  water.position.y = 1.0;
  g.add(water);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 3.5, 12), mat('#b8a07a'));
  col.position.y = 2.7;
  g.add(col);
  const top = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 12), mat('#8fdcff', { emissive: 0x3fa8ff, emissiveIntensity: 0.8, transparent: true, opacity: 0.8 }));
  top.position.y = 4.9;
  g.add(top);
  return shadow(g);
}

const PROCEDURAL = {
  'oremo-giovane': (pal) => statue('giovane', pal),
  'oremo-anziano': (pal) => statue('anziano', pal),
  'tavola-calda': () => diner(),
  'valvo-go': () => depot(),
  blindato: () => armored(),
  autovettore: () => hoverCar(),
  fontana: () => fountain()
};

const HEIGHTS = {
  'oremo-giovane': 4, 'oremo-anziano': 4, 'tavola-calda': 3.5, 'valvo-go': 7.5, blindato: 3, autovettore: 2.4, fontana: 6
};

export async function buildProp(name, scale = 1, pal = {}) {
  const glb = await Assets.model(`assets/props/${name}.glb`, { targetHeight: HEIGHTS[name] || 4 });
  let obj = glb;
  if (!obj) {
    const f = PROCEDURAL[name];
    obj = f ? f(pal) : new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), mat('#ff00ff'));
  }
  obj.scale.multiplyScalar(scale);
  return obj;
}
