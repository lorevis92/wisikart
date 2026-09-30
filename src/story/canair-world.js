import * as THREE from 'three';
import { Assets } from '../core/AssetLoader.js';
import { buildProp } from '../track/Props.js';

// Canair come un unico mondo: il paese in basso (piazza, casette colorate, Infinity Guitars, il cartello del
// sentiero sotto la parete), la parete di roccia del promontorio Utgenra, il piazzale in cima (statue di Oremo e
// fontana, le stesse della pista Canair di WisiKart, palco, belvedere) e il sentiero di discesa con corrimano
// e lanterne che riporta in paese. La salita vera (livello 7) si fa sulla parete e finisce in cima; il palco
// dell'esibizione (livello 8) è costruito con lo stesso piazzale (buildPromontory).
// Coordinate in metri: il paese è intorno a (0, 0, 0), la parete a nord (z negativa), il piazzale è a quota TOP.

export const TOP = 28; // quota del piazzale in cima
// il piazzale: rettangolo in pianta, e dove stanno le sue cose
export const PROMONTORY = {
  x0: -30, x1: 30, z0: -95, z1: -44,
  statues: [{ name: 'oremo-giovane', x: -10, z: -84 }, { name: 'oremo-anziano', x: 10, z: -84 }],
  fountain: { x: 17, z: -64 },
  stage: { x: 0, z: -64 }, // il palco dell'esibizione, davanti alle statue, rivolto a sud
  belvedere: { x: -16, z: -46 },
  descent: { x: 25, z: -48 }, // cartello dell'inizio della discesa
  arrival: { x: 0, z: -47.5 } // dove sbuca la salita
};
// il sentiero di discesa: dal bordo est del piazzale, lungo il fianco della parete, fino al paese
export const DESCENT = { w: 3.2, pts: [[26, -48, TOP], [33, -48, TOP - 2], [33, -12, 6], [22, -8, 0]] };
export const PLAZA_R = 26;

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

/** Dati per la camminata della piazza (Hub): dove si può stare e a che quota. */
export function canairTerrain() {
  return {
    plaza: { x: 0, z: 0, r: PLAZA_R },
    plateaus: [{ x0: PROMONTORY.x0 + 1, x1: PROMONTORY.x1 - 1, z0: PROMONTORY.z0 + 1, z1: PROMONTORY.z1 - 0.8, y: TOP }],
    ramps: [DESCENT]
  };
}

function paving(a, b, repeat) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = b; g.lineWidth = 3;
  for (let y = 0; y < 128; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < 128; x += 32) g.strokeRect(x + 1, y + 1, 30, 30);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

/** Scritta su un cartello (sprite che guarda sempre la telecamera, visibile da lontano). */
export function labelSprite(text, color = '#43e0b0') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 112;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(12,14,34,0.85)';
  g.beginPath(); g.roundRect ? g.roundRect(4, 4, 504, 104, 30) : g.rect(4, 4, 504, 104); g.fill();
  g.lineWidth = 6; g.strokeStyle = color; g.stroke();
  g.fillStyle = '#fff'; g.font = 'bold 50px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 58);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true }));
  s.renderOrder = 21;
  s.scale.set(5.2, 1.14, 1);
  return s;
}

/**
 * La parete e il piazzale in cima: statue di Oremo e fontana della pista Canair, pavimento, parapetto con le
 * lanterne. Ritorna { colliders } (ostacoli circolari sul piazzale) e le posizioni utili.
 */
export async function buildPromontory(scene, pal = {}, { cliff = true } = {}) {
  const P = PROMONTORY;
  const w = P.x1 - P.x0, d = P.z1 - P.z0, cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2;
  const colliders = [];
  if (cliff) {
    // la parete: un blocco di roccia con massi sporgenti e le cenge della salita sulla faccia sud
    const rock = std(pal.rock || '#a3774a', { roughness: 0.95, flatShading: true });
    const mass = new THREE.Mesh(new THREE.BoxGeometry(w, TOP, d), rock);
    mass.position.set(cx, TOP / 2 - 0.02, cz);
    mass.castShadow = mass.receiveShadow = true;
    scene.add(mass);
    for (let i = 0; i < 26; i++) {
      const r = 3 + ((i * 7) % 5);
      const b = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rock);
      const side = i % 3;
      const px = side === 0 ? P.x0 + ((i * 37) % Math.round(w)) : side === 1 ? P.x0 - 1 : P.x1 + 1;
      const pz = side === 0 ? P.z1 + 0.5 : P.z0 + ((i * 53) % Math.round(d));
      b.position.set(px, ((i * 11) % Math.round(TOP - 4)) + 2, pz);
      b.scale.set(1, 1.3, 0.6);
      b.castShadow = true;
      scene.add(b);
    }
    // le cenge della salita, sulla faccia verso il paese: si vede da dove si sale
    const ledge = std('#c9a878');
    for (let i = 0; i < 9; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.4, 1.6), ledge);
      l.position.set(-8 + ((i * 7) % 16), 3 + i * 2.8, P.z1 + 0.7);
      l.castShadow = true;
      scene.add(l);
    }
  }
  // pavimento del piazzale
  const top = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std('#ffffff', { map: paving('#d9c29a', '#b89e74', 8), roughness: 0.8 }));
  top.rotation.x = -Math.PI / 2;
  top.position.set(cx, TOP + 0.01, cz);
  top.receiveShadow = true;
  scene.add(top);
  // statue di Oremo e fontana: le stesse della pista Canair (props/*.glb, o le versioni procedurali)
  for (const s of P.statues) {
    const m = await buildProp(s.name, 2.8, pal);
    m.position.set(s.x, TOP, s.z);
    m.rotation.y = s.x < 0 ? 0.25 : -0.25; // guardano il palco, verso sud
    m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(m);
    colliders.push({ x: s.x, z: s.z, r: 2.6 });
  }
  const f = await buildProp('fontana', 1, pal);
  f.position.set(P.fountain.x, TOP, P.fountain.z);
  scene.add(f);
  colliders.push({ x: P.fountain.x, z: P.fountain.z, r: 6.6 });
  // parapetto basso sul bordo, con le lanterne (varchi: arrivo della salita e inizio della discesa)
  const stone = std('#b8a080');
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffb45a, emissiveIntensity: 2.5 });
  const wall = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.8, 0.5), stone);
    m.position.set((x0 + x1) / 2, TOP + 0.4, (z0 + z1) / 2);
    m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    m.castShadow = true;
    scene.add(m);
  };
  wall(P.x0, P.z1, P.arrival.x - 3, P.z1);
  wall(P.arrival.x + 3, P.z1, P.x1, P.z1);
  wall(P.x0, P.z0, P.x1, P.z0);
  wall(P.x0, P.z0, P.x0, P.z1);
  wall(P.x1, P.z0, P.x1, P.descent.z - 2.5);
  wall(P.x1, P.descent.z + 2.5, P.x1, P.z1);
  for (const [x, z] of [[P.x0 + 1, P.z1 - 1], [P.x1 - 1, P.z1 - 1], [P.x0 + 1, P.z0 + 1], [P.x1 - 1, P.z0 + 1], [-4, P.z1 - 1], [4, P.z1 - 1]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.6, 6), std('#2a2a38'));
    post.position.set(x, TOP + 1.3, z);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), lamp);
    head.position.set(x, TOP + 2.7, z);
    scene.add(post, head);
  }
  const glow = new THREE.PointLight(0xffb45a, 30, 30, 1.6);
  glow.position.set(0, TOP + 4, -60);
  scene.add(glow);
  return { colliders, stage: { ...P.stage, y: TOP } };
}

/** Il sentiero di discesa: rampa lungo il fianco della parete, sostenuta dalla roccia, corrimano e lanterne. */
function buildDescent(scene, pal, dynamic) {
  const D = DESCENT;
  const path = std('#c9b08a', { roughness: 0.9 });
  const rock = std(pal.rock || '#a3774a', { roughness: 0.95, flatShading: true });
  const rail = std('#6a4a2a');
  const lampM = new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffb45a, emissiveIntensity: 2.6 });
  const lights = [];
  let walked = 0;
  for (let i = 0; i < D.pts.length - 1; i++) {
    const [x0, z0, y0] = D.pts[i], [x1, z1, y1] = D.pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(D.w, 0.4, a.distanceTo(b) + 0.6), path);
    slab.position.copy(a).add(b).multiplyScalar(0.5).setY((y0 + y1) / 2 - 0.2);
    slab.lookAt(b.x, b.y - 0.2, b.z);
    slab.receiveShadow = slab.castShadow = true;
    scene.add(slab);
    const dir = new THREE.Vector3(x1 - x0, 0, z1 - z0).normalize();
    const out = new THREE.Vector3(-dir.z, 0, dir.x); // lato del corrimano (lontano dalla parete)
    const sideSign = out.x > 0 || (out.x === 0 && out.z > 0) ? 1 : -1;
    const n = Math.ceil(len / 2.5);
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = y0 + (y1 - y0) * t;
      // roccia sotto la rampa (dal terreno alla rampa)
      if (y > 0.6 && k < n) {
        const h = y - 0.2;
        const col = new THREE.Mesh(new THREE.BoxGeometry(D.w + 0.6, h, len / n + 0.2), rock);
        col.position.set(x, h / 2, z);
        col.rotation.y = Math.atan2(dir.x, dir.z);
        col.castShadow = col.receiveShadow = true;
        scene.add(col);
      }
      // corrimano: paletti e barra
      const px = x + out.x * sideSign * (D.w / 2 + 0.1), pz = z + out.z * sideSign * (D.w / 2 + 0.1);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), rail);
      post.position.set(px, y + 0.5, pz);
      scene.add(post);
      // lanterne, una ogni 10 m circa
      walked += len / n;
      if (walked >= 10) {
        walked = 0;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lampM);
        head.position.set(px, y + 1.35, pz);
        scene.add(head);
        lights.push(head.position.clone());
      }
    }
    const barLen = a.distanceTo(b);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, barLen, 6), rail);
    const bo = out.clone().multiplyScalar(sideSign * (D.w / 2 + 0.1));
    bar.position.copy(a).add(b).multiplyScalar(0.5).add(bo).setY((y0 + y1) / 2 + 1.0);
    bar.lookAt(b.x + bo.x, b.y + 1.0, b.z + bo.z);
    bar.rotateX(Math.PI / 2);
    scene.add(bar);
  }
  // qualche luce vera tra le lanterne
  lights.filter((_, i) => i % 2 === 0).slice(0, 4).forEach((p) => {
    const l = new THREE.PointLight(0xffb45a, 14, 12, 1.7);
    l.position.copy(p);
    scene.add(l);
  });
}

/** Casette colorate intorno alla piazza del paese (lasciano liberi la parete a nord e il sentiero a est). */
function buildHouses(scene, circles) {
  const cols = ['#e8a05a', '#e86a5a', '#f0c85a', '#7ab0d8', '#a8d07a', '#d88ab8', '#f2e6c8'];
  const angles = [105, 128, 150, 172, 194, 216, 238, 312, 334];
  angles.forEach((deg, i) => {
    const a = THREE.MathUtils.degToRad(deg);
    const dist = 31 + (i % 3) * 3;
    const x = Math.sin(a) * dist, z = -Math.cos(a) * dist;
    const g = new THREE.Group();
    const w = 6 + (i % 3), h = 4.5 + (i % 4) * 1.2, dp = 5.5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, dp), std(cols[i % cols.length]));
    body.position.y = h / 2;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, dp) * 0.75, 2.4, 4), std('#8a3a2a'));
    roof.position.y = h + 1.2;
    roof.rotation.y = Math.PI / 4;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2), std('#5a3a22'));
    door.position.set(0, 1, dp / 2 + 0.02);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1), new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: 0xffc070, emissiveIntensity: 0.8 }));
    win.position.set(w * 0.28, h * 0.62, dp / 2 + 0.02);
    g.add(body, roof, door, win);
    g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(-x, -z); // la porta guarda la piazza
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g);
    circles.push({ x, z, r: 3.8 });
  });
}

/** Pannello lontano con un'illustrazione (paese, discesa): fa da scenografia oltre il mondo 3D. */
async function backdrop(scene, url, { pos, yaw, h }) {
  const tex = await Assets.texture(url);
  if (!tex) return;
  const aspect = tex.image && tex.image.width ? tex.image.width / tex.image.height : 1.79;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), new THREE.MeshBasicMaterial({ map: tex, fog: false, toneMapped: false }));
  m.position.copy(pos);
  m.rotation.y = yaw;
  scene.add(m);
}

/**
 * Tutta Canair dentro la piazza (Hub): piazza del paese, casette, parete, piazzale, discesa, scenografie.
 * hub.circles / hub.dynamic ricevono ostacoli e animazioni.
 */
export async function buildCanair(hub, { paese, discesa } = {}) {
  const scene = hub.scene, pal = hub.pal;
  // piazza lastricata del paese
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(PLAZA_R + 1, 64), std('#ffffff', { map: paving('#d8b48a', '#b08a62', 10), roughness: 0.8 }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  plaza.receiveShadow = true;
  scene.add(plaza);
  buildHouses(scene, hub.circles);
  // sentierino di terra dal cartello alla parete: da lì comincia la salita
  const trail = new THREE.Mesh(new THREE.PlaneGeometry(3, 22), std('#9a7a52', { roughness: 1 }));
  trail.rotation.x = -Math.PI / 2;
  trail.position.set(0, 0.03, -34);
  scene.add(trail);
  const { colliders } = await buildPromontory(scene, pal, { cliff: true });
  hub.circles.push(...colliders);
  buildDescent(scene, pal, hub.dynamic);
  // cartello in cima, simmetrico a quello del paese: "Scendi a Canair"
  const P = PROMONTORY;
  const sign = await Assets.model('assets/story/canair/cartello.glb', { targetHeight: 2.6 });
  const s = new THREE.Group();
  if (sign) s.add(sign);
  else { const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 0.15), std('#8a5a32')); b.position.y = 2; s.add(b); }
  s.position.set(P.descent.x - 1.5, TOP, P.descent.z - 2.2);
  s.rotation.y = -Math.PI / 2;
  scene.add(s);
  const lbl = labelSprite('↓ Scendi a Canair', '#ffc27a');
  lbl.position.set(P.descent.x - 1.5, TOP + 4.4, P.descent.z - 2.2);
  scene.add(lbl);
  hub.dynamic.push((t) => { lbl.position.y = TOP + 4.4 + Math.sin(t * 2) * 0.15; });
  // scenografie: il paese visto verso la montagna, e la valle della discesa
  await Promise.all([
    paese && backdrop(scene, paese, { pos: new THREE.Vector3(0, 70, -430), yaw: 0, h: 260 }),
    discesa && backdrop(scene, discesa, { pos: new THREE.Vector3(360, 60, -20), yaw: -Math.PI / 2, h: 220 })
  ]);
}
