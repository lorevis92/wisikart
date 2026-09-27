import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const existsCache = new Map();
const textureCache = new Map();
const modelCache = new Map();

async function exists(url) {
  if (existsCache.has(url)) return existsCache.get(url);
  let ok = false;
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const ct = res.headers.get('content-type') || '';
    ok = res.ok && !ct.includes('text/html');
  } catch {
    ok = false;
  }
  existsCache.set(url, ok);
  return ok;
}

export const Assets = {
  exists,

  async texture(url, { equirect = false } = {}) {
    if (!(await exists(url))) return null;
    if (textureCache.has(url)) return textureCache.get(url);
    const p = new Promise((resolve) => {
      new THREE.TextureLoader().load(
        url,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          if (equirect) t.mapping = THREE.EquirectangularReflectionMapping;
          resolve(t);
        },
        undefined,
        () => resolve(null)
      );
    });
    textureCache.set(url, p);
    return p;
  },

  /** Carica un GLB e lo normalizza: centrato, appoggiato a y=0, altezza = targetHeight. */
  async model(url, { targetHeight = 2, rotY = 0 } = {}) {
    if (!(await exists(url))) return null;
    if (!modelCache.has(url)) {
      modelCache.set(
        url,
        new Promise((resolve) => {
          new GLTFLoader().load(url, (g) => resolve(g.scene), undefined, () => resolve(null));
        })
      );
    }
    const src = await modelCache.get(url);
    if (!src) return null;
    const scene = src.clone(true);
    scene.rotation.y = rotY;
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = targetHeight / Math.max(size.y, 0.001);
    scene.scale.setScalar(s);
    scene.updateMatrixWorld(true);
    box.setFromObject(scene);
    const center = new THREE.Vector3();
    box.getCenter(center);
    scene.position.x -= center.x;
    scene.position.z -= center.z;
    scene.position.y -= box.min.y;
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material && o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
      }
    });
    const group = new THREE.Group();
    group.add(scene);
    return group;
  },

  async audioBuffer(ctx, url) {
    if (!(await exists(url))) return null;
    try {
      const res = await fetch(url);
      const data = await res.arrayBuffer();
      return await ctx.decodeAudioData(data);
    } catch {
      return null;
    }
  }
};
