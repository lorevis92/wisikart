import * as THREE from 'three';
import { Assets } from '../core/AssetLoader.js';

// Stanze 3D dei locali della Storia (negozio, Lube Tone, Red Fox, locale da ballo, camera di Whiskey):
// pavimento in legno, parete di fondo, pareti laterali tagliate per vedere la scena, e l'illustrazione del posto
// come quadro sulla parete. Stesso stile della tavola calda di Retah.

export const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });

/** Pavimento, parete di fondo (a z = back) e pareti laterali tagliate. */
export function buildRoom(scene, { floor = '#6a4428', plank = '#58361e', wall = '#7a4a32', trim = '#3a2418', width = 18, back = -3.4, leftH = 1.6, rightH = 3.2 } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = floor; g.fillRect(0, 0, 128, 128);
  g.fillStyle = plank; for (let y = 0; y < 128; y += 16) g.fillRect(0, y, 128, 2);
  for (let i = 0; i < 12; i++) g.fillRect((i * 37) % 128, Math.floor(i / 2) * 32 + 2, 2, 14);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(width / 2, 6);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(width, 14), std('#ffffff', { map: tex, roughness: 0.55 }));
  fl.rotation.x = -Math.PI / 2;
  fl.position.set(0, 0, back + 7);
  fl.receiveShadow = true;
  scene.add(fl);
  const box = (w, h, d, color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(color, { roughness: 0.85 }));
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  box(width, 4.4, 0.3, wall, 0, 2.2, back - 0.15);
  box(width, 0.25, 0.32, trim, 0, 0.12, back);
  if (leftH) box(0.3, leftH, 9, wall, -width / 2, leftH / 2, back + 4.5);
  if (rightH) box(0.3, rightH, 6, wall, width / 2, rightH / 2, back + 3);
  return fl;
}

/** L'illustrazione del posto come quadro incorniciato sulla parete di fondo. */
export async function muralOnWall(scene, url, { x = 0, y = 2.35, z = -3.38, h = 3.2, frame = '#c9a040' } = {}) {
  const tex = await Assets.texture(url);
  if (!tex) return null;
  const aspect = tex.image && tex.image.width ? tex.image.width / tex.image.height : 1.79;
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  pic.position.set(x, y, z);
  scene.add(pic);
  const fr = new THREE.Mesh(new THREE.BoxGeometry(h * aspect + 0.3, h + 0.3, 0.06), std(frame, { metalness: 0.7, roughness: 0.3 }));
  fr.position.set(x, y, z - 0.04);
  scene.add(fr);
  return pic;
}

/** Mette un modello (o un blocco al suo posto) nella stanza, con ombre. */
export function place(scene, model, fallback, x, y, z, yaw = 0, color = '#5a3a22') {
  const g = new THREE.Group();
  if (model) g.add(model.clone ? model.clone(true) : model);
  else { const b = new THREE.Mesh(new THREE.BoxGeometry(...fallback), std(color)); b.position.y = fallback[1] / 2; g.add(b); }
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g);
  return g;
}
