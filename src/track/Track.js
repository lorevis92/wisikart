import * as THREE from 'three';
import { Assets } from '../core/AssetLoader.js';
import * as T from '../core/Textures.js';
import { buildProp } from './Props.js';

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// rumore value semplice, deterministico
function hash(x, y) {
  let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x, y) {
  return noise2(x, y) * 0.55 + noise2(x * 2.1, y * 2.1) * 0.28 + noise2(x * 4.3, y * 4.3) * 0.17;
}

export class Track {
  constructor(def, scene, renderer) {
    this.def = def;
    this.scene = scene;
    this.renderer = renderer;
    this.group = new THREE.Group();
    this.dynamic = [];
    this.itemBoxes = [];
    this.boostPads = [];
    this.hazards = [];
    this.halfW = def.width / 2;
    this.isTunnel = def.theme === 'tunnel';
    // parametri dello scenario open (vedi tracks.js); i default riproducono Canair
    this.world = {
      night: false, flat: false, trees: 520, rocks: 160, bushes: 0,
      city: [[0.88, 1.0], [0.0, 0.16], [0.43, 0.53]], cityStep: 0.012, neon: 0.45,
      lamps: false, lake: null, fog: [220, 1100],
      ...(def.world || {})
    };
    this.curve = new THREE.CatmullRomCurve3(
      def.points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
      true,
      'centripetal',
      0.5
    );
    this.length = this.curve.getLength();
    this.N = Math.round(this.length / 3);
    this._buildSamples();
  }

  _buildSamples() {
    const N = this.N;
    const pts = this.curve.getSpacedPoints(N);
    pts.pop(); // l'ultimo coincide col primo
    this.samples = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < N; i++) {
      const p = pts[i];
      const next = pts[(i + 1) % N];
      const prev = pts[(i - 1 + N) % N];
      const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
      const normal = new THREE.Vector3().crossVectors(right, tangent).normalize();
      this.samples.push({ pos: p, tangent, right, normal, dist: (i / N) * this.length });
    }
    // griglia spaziale per la ricerca del campione più vicino
    this.cell = 40;
    this.grid = new Map();
    for (let i = 0; i < N; i++) {
      const s = this.samples[i];
      const k = this._key(s.pos.x, s.pos.z);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(i);
    }
  }

  _key(x, z) {
    return `${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`;
  }

  idxFromT(t) {
    return ((Math.round(t * this.N) % this.N) + this.N) % this.N;
  }

  /** Indice del campione più vicino. hint accelera la ricerca. */
  nearestIndex(pos, hint = -1) {
    const N = this.N;
    if (hint >= 0) {
      let best = hint, bd = Infinity;
      for (let d = -25; d <= 25; d++) {
        const i = (hint + d + N) % N;
        const dd = this.samples[i].pos.distanceToSquared(pos);
        if (dd < bd) { bd = dd; best = i; }
      }
      if (bd < 40 * 40) return best;
    }
    let best = 0, bd = Infinity;
    const cx = Math.floor(pos.x / this.cell), cz = Math.floor(pos.z / this.cell);
    for (let r = 0; r <= 3; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const list = this.grid.get(`${cx + dx},${cz + dz}`);
          if (!list) continue;
          for (const i of list) {
            const dd = this.samples[i].pos.distanceToSquared(pos);
            if (dd < bd) { bd = dd; best = i; }
          }
        }
      }
      if (bd < Infinity && r >= 1) break;
    }
    if (bd === Infinity) {
      for (let i = 0; i < N; i += 4) {
        const dd = this.samples[i].pos.distanceToSquared(pos);
        if (dd < bd) { bd = dd; best = i; }
      }
    }
    return best;
  }

  /** Proietta una posizione sulla pista: indice, scostamento laterale, altezza del fondo. */
  project(pos, hint = -1) {
    const i = this.nearestIndex(pos, hint);
    const s = this.samples[i];
    _v.subVectors(pos, s.pos);
    const lateral = _v.dot(s.right);
    const along = _v.dot(s.tangent);
    // altezza interpolata lungo la tangente
    const j = along >= 0 ? (i + 1) % this.N : (i - 1 + this.N) % this.N;
    const s2 = this.samples[j];
    const segLen = s2.pos.distanceTo(s.pos) || 1;
    const f = Math.min(1, Math.abs(along) / segLen);
    const height = s.pos.y * (1 - f) + s2.pos.y * f;
    return { idx: i, lateral, height, tangent: s.tangent, right: s.right, along };
  }

  terrainHeight(x, z) {
    if (this.world.flat) return -0.3;
    _w.set(x, 0, z);
    const i = this.nearestIndex(_w);
    const s = this.samples[i];
    const d = Math.hypot(x - s.pos.x, z - s.pos.z);
    const base = fbm(x / 260 + 3.1, z / 260 + 7.7) * 34 - 20;
    const near = s.pos.y - 0.6 - Math.pow(Math.min(d, 22) / 22, 2) * 1.5;
    const k = smoothstep(18, 70, d);
    return near * (1 - k) + base * k;
  }

  async build() {
    const def = this.def;
    this.pal = def.palette;
    this._roadAndCurbs();
    if (this.isTunnel) this._tunnel();
    else {
      if (this.world.lake) this._lakeMask();
      this._openWorld();
    }
    this._startLine();
    this._itemBoxes();
    this._boostPads();
    await this._props();
    await this._sky();
    this._lights();
    this.scene.add(this.group);
  }

  _ribbon(inner, outer, texture, y = 0, repeatV = 8) {
    const N = this.N;
    const pos = new Float32Array((N + 1) * 2 * 3);
    const uv = new Float32Array((N + 1) * 2 * 2);
    const idx = [];
    for (let i = 0; i <= N; i++) {
      const s = this.samples[i % N];
      const v = (s.dist + (i === N ? this.length : 0)) / repeatV;
      const a = _v.copy(s.pos).addScaledVector(s.right, inner).addScaledVector(s.normal, y);
      pos.set([a.x, a.y, a.z], i * 6);
      const b = _w.copy(s.pos).addScaledVector(s.right, outer).addScaledVector(s.normal, y);
      pos.set([b.x, b.y, b.z], i * 6 + 3);
      uv.set([0, v, 1, v], i * 4);
      if (i < N) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, metalness: 0.02 });
    const mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = true;
    return mesh;
  }

  _roadAndCurbs() {
    const p = this.pal;
    const hw = this.halfW;
    const roadTex = T.roadTexture(p.road, p.roadLine, this.isTunnel);
    this.road = this._ribbon(-hw, hw, roadTex, 0, 12);
    this.road.material.roughness = 0.9;
    if (this.isTunnel) {
      this.road.material.emissive = new THREE.Color(p.roadLine);
      this.road.material.emissiveMap = roadTex;
      this.road.material.emissiveIntensity = 0.12;
    }
    this.group.add(this.road);
    const curbTex = T.curbTexture(p.curb[0], p.curb[1]);
    const cl = this._ribbon(-hw - 1.3, -hw, curbTex, 0.04, 4);
    const cr = this._ribbon(hw, hw + 1.3, curbTex, 0.04, 4);
    if (this.isTunnel) {
      for (const c of [cl, cr]) {
        c.material.emissive = new THREE.Color(p.curb[0]);
        c.material.emissiveIntensity = 0.5;
      }
    }
    this.group.add(cl, cr);
    // spalla erbosa/asfalto oltre il cordolo per la pista aperta
    if (!this.isTunnel) {
      const shoulderTex = T.grassTexture(p.grass);
      shoulderTex.repeat.set(1, 1);
      this.shoulderL = this._ribbon(-hw - 9, -hw - 1.3, shoulderTex, -0.02, 6);
      this.shoulderR = this._ribbon(hw + 1.3, hw + 9, shoulderTex, -0.02, 6);
      this.group.add(this.shoulderL, this.shoulderR);
      this.wallDist = hw + 8.5;
      this._guardRails();
    } else {
      this.wallDist = hw + 3.2;
    }
  }

  _guardRails() {
    const N = this.N;
    const step = 6;
    const count = Math.ceil(N / step) * 2;
    const postG = new THREE.CylinderGeometry(0.18, 0.18, 1.2, 8);
    const postM = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.6 });
    const posts = new THREE.InstancedMesh(postG, postM, count);
    const railG = new THREE.BoxGeometry(step * 3.05, 0.35, 0.18);
    const railM = new THREE.MeshStandardMaterial({ color: this.pal.wall, roughness: 0.5, metalness: 0.3 });
    const rails = new THREE.InstancedMesh(railG, railM, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    let k = 0;
    for (let i = 0; i < N; i += step) {
      const s = this.samples[i];
      for (const side of [-1, 1]) {
        const p = _v.copy(s.pos).addScaledVector(s.right, side * this.wallDist);
        m.compose(new THREE.Vector3(p.x, p.y + 0.6, p.z), q, sc);
        posts.setMatrixAt(k, m);
        const mid = this.samples[(i + Math.floor(step / 2)) % N];
        const pm = _w.copy(mid.pos).addScaledVector(mid.right, side * this.wallDist);
        const rot = new THREE.Matrix4().lookAt(new THREE.Vector3(), mid.tangent, new THREE.Vector3(0, 1, 0));
        q.setFromRotationMatrix(rot);
        q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
        m.compose(new THREE.Vector3(pm.x, pm.y + 1.05, pm.z), q, sc);
        rails.setMatrixAt(k, m);
        q.identity();
        k++;
      }
    }
    posts.count = rails.count = k;
    posts.castShadow = rails.castShadow = true;
    this.group.add(posts, rails);
  }

  _tunnel() {
    const N = this.N, R = 24, RY = 18, SEG = 28;
    const pos = new Float32Array((N + 1) * (SEG + 1) * 3);
    const uv = new Float32Array((N + 1) * (SEG + 1) * 2);
    const idx = [];
    for (let i = 0; i <= N; i++) {
      const s = this.samples[i % N];
      const v = (s.dist + (i === N ? this.length : 0)) / 24;
      for (let j = 0; j <= SEG; j++) {
        const a = (j / SEG) * Math.PI * 2;
        const x = Math.cos(a) * R, y = Math.sin(a) * RY + 12;
        _v.copy(s.pos).addScaledVector(s.right, x).addScaledVector(s.normal, y);
        const o = (i * (SEG + 1) + j);
        pos.set([_v.x, _v.y, _v.z], o * 3);
        uv.set([j / SEG * 6, v], o * 2);
        if (i < N && j < SEG) {
          const k = i * (SEG + 1) + j;
          idx.push(k, k + 1, k + SEG + 1, k + 1, k + SEG + 2, k + SEG + 1);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.tunnelTex = T.tunnelWallTexture(this.pal.wall, this.pal.wallGlow);
    const m = new THREE.MeshStandardMaterial({
      map: this.tunnelTex,
      emissive: new THREE.Color(this.pal.wallGlow),
      emissiveMap: this.tunnelTex,
      emissiveIntensity: 0.32,
      side: THREE.DoubleSide,
      roughness: 0.6,
      metalness: 0.2
    });
    this.tunnel = new THREE.Mesh(g, m);
    this.group.add(this.tunnel);

    // costole luminose
    const ribG = new THREE.TorusGeometry(21, 0.5, 8, 48);
    const ribM = new THREE.MeshStandardMaterial({
      color: 0x120c30,
      emissive: new THREE.Color(this.pal.wallGlow),
      emissiveIntensity: 2.2
    });
    const ribCount = Math.floor(N / 20);
    const ribs = new THREE.InstancedMesh(ribG, ribM, ribCount);
    const mat = new THREE.Matrix4();
    for (let r = 0; r < ribCount; r++) {
      const s = this.samples[(r * 20) % N];
      const center = _v.copy(s.pos).addScaledVector(s.normal, 12);
      const rot = new THREE.Matrix4().lookAt(new THREE.Vector3(), s.tangent, s.normal);
      mat.copy(rot).scale(new THREE.Vector3(1, 0.75, 1)).setPosition(center);
      ribs.setMatrixAt(r, mat);
    }
    this.group.add(ribs);

    // pareti di energia lungo i cordoli (barriera visibile)
    this._energyWalls();
  }

  _energyWalls() {
    const N = this.N;
    for (const side of [-1, 1]) {
      const pos = new Float32Array((N + 1) * 2 * 3);
      const uv = new Float32Array((N + 1) * 2 * 2);
      const idx = [];
      const off = side * (this.halfW + 3.2);
      for (let i = 0; i <= N; i++) {
        const s = this.samples[i % N];
        const v = (s.dist + (i === N ? this.length : 0)) / 10;
        const a = _v.copy(s.pos).addScaledVector(s.right, off);
        pos.set([a.x, a.y, a.z], i * 6);
        const b = _w.copy(a).addScaledVector(s.normal, 2.6);
        pos.set([b.x, b.y, b.z], i * 6 + 3);
        uv.set([0, v, 1, v], i * 4);
        if (i < N) {
          const k = i * 2;
          idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.MeshBasicMaterial({
        color: new THREE.Color(this.pal.wallGlow),
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(g, m);
      this.group.add(mesh);
      this.dynamic.push({ update: (dt, t) => { m.opacity = 0.28 + Math.sin(t * 4 + side) * 0.08; } });
    }
  }

  _openWorld() {
    const p = this.pal;
    // terreno
    const size = 2800, res = 200;
    const g = new THREE.PlaneGeometry(size, size, res, res);
    g.rotateX(-Math.PI / 2);
    const bb = new THREE.Box3().setFromPoints(this.samples.map((s) => s.pos));
    const c = new THREE.Vector3();
    bb.getCenter(c);
    g.translate(c.x, 0, c.z);
    const arr = g.attributes.position;
    const colors = new Float32Array(arr.count * 3);
    const grass = new THREE.Color(p.grass), rock = new THREE.Color(p.rock), sand = new THREE.Color(p.sand || '#d8c48c');
    const wet = sand.clone().multiplyScalar(0.72);
    const tmp = new THREE.Color();
    for (let i = 0; i < arr.count; i++) {
      const x = arr.getX(i), z = arr.getZ(i);
      const h = this.terrainHeight(x, z);
      arr.setY(i, h);
      const steep = fbm(x / 90, z / 90);
      tmp.copy(grass);
      if (h < -4) tmp.copy(sand);
      else if (steep > 0.62) tmp.lerp(rock, (steep - 0.62) * 2.5);
      if (this.world.flat) tmp.lerp(sand, steep * 0.5);
      if (this.lake) {
        const shore = this.lakeAt(x, z, 14);
        if (shore > 0) tmp.lerp(wet, Math.min(1, shore));
      }
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const gt = T.grassTexture('#ffffff');
    gt.repeat.set(140, 140);
    const terrain = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: gt, vertexColors: true, roughness: 1 }));
    if (this.world.night) terrain.material.color.setScalar(0.55);
    terrain.receiveShadow = true;
    this.group.add(terrain);
    this.terrain = terrain;

    // acqua
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(size * 1.2, size * 1.2),
      new THREE.MeshStandardMaterial({ color: 0x2f7fb8, roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.9 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(c.x, -7, c.z);
    if (!this.world.flat) this.group.add(water);
    if (this.lake) this._lakeMesh();

    // alberi, rocce, cespugli, edifici, lampioni
    this._scatter();
    this._bushes();
    this._city();
    if (this.world.lamps) this._lamps();
  }

  /** Distanza orizzontale dalla pista (campione più vicino). */
  _trackDist(x, z) {
    const j = this.nearestIndex(_w.set(x, 0, z));
    return { idx: j, d: Math.hypot(x - this.samples[j].pos.x, z - this.samples[j].pos.z) };
  }

  /** Maschera del lago: griglia di celle d'acqua sul lato scelto, lontane da ogni tratto di pista. */
  _lakeMask() {
    const L = this.world.lake;
    const cell = 6, margin = this.halfW + 14, reach = L.reach || 220;
    const i0 = this.idxFromT(L.from), i1 = this.idxFromT(L.to);
    const inRange = (i) => (i0 <= i1 ? i >= i0 && i <= i1 : i >= i0 || i <= i1);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = i0; i !== i1; i = (i + 1) % this.N) {
      const s = this.samples[i];
      for (const k of [0, 1]) {
        const p = _v.copy(s.pos).addScaledVector(s.right, L.side * (margin + k * reach));
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      }
    }
    const nx = Math.ceil((maxX - minX) / cell) + 1, nz = Math.ceil((maxZ - minZ) / cell) + 1;
    const mask = new Uint8Array(nx * nz);
    let count = 0;
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const x = minX + ix * cell, z = minZ + iz * cell;
        const { idx, d } = this._trackDist(x, z);
        if (d < margin || d > reach || !inRange(idx)) continue;
        const s = this.samples[idx];
        const lat = (x - s.pos.x) * s.right.x + (z - s.pos.z) * s.right.z;
        if (Math.sign(lat) !== L.side) continue;
        mask[iz * nx + ix] = 1;
        count++;
      }
    }
    if (count) this.lake = { minX, minZ, nx, nz, cell, mask };
  }

  /** 1 se il punto è nel lago; con `pad` > 0 sfuma da 1 a 0 entro pad metri dalla riva. */
  lakeAt(x, z, pad = 0) {
    const L = this.lake;
    if (!L) return 0;
    const r = Math.ceil(pad / L.cell);
    const cx = Math.round((x - L.minX) / L.cell), cz = Math.round((z - L.minZ) / L.cell);
    let best = Infinity;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const ix = cx + dx, iz = cz + dz;
        if (ix < 0 || iz < 0 || ix >= L.nx || iz >= L.nz || !L.mask[iz * L.nx + ix]) continue;
        best = Math.min(best, Math.hypot(dx, dz) * L.cell);
      }
    }
    if (best === Infinity) return 0;
    return pad ? 1 - best / (pad + L.cell) : 1;
  }

  _lakeMesh() {
    const L = this.lake;
    // maschera ammorbidita su canvas → alphaMap: riva morbida invece dei quadretti
    const S = 4;
    const c = document.createElement('canvas');
    c.width = L.nx * S; c.height = L.nz * S;
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, c.width, c.height);
    g.filter = 'blur(6px)';
    g.fillStyle = '#fff';
    for (let iz = 0; iz < L.nz; iz++) {
      for (let ix = 0; ix < L.nx; ix++) if (L.mask[iz * L.nx + ix]) g.fillRect(ix * S - S / 2, iz * S - S / 2, S + 1, S + 1);
    }
    const alpha = new THREE.CanvasTexture(c);
    alpha.flipY = false; // riga 0 del canvas = minZ
    const w = (L.nx - 1) * L.cell, d = (L.nz - 1) * L.cell;
    const geo = new THREE.PlaneGeometry(w, d);
    geo.rotateX(-Math.PI / 2);
    // dopo la rotazione v=1 sta a -z (minZ): con flipY=false la riga 0 va a v=0, quindi inverto le v
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    const m = new THREE.MeshStandardMaterial({
      color: 0x7fb4cf, roughness: 0.04, metalness: 0.85, envMapIntensity: 1.2,
      transparent: true, alphaMap: alpha, depthWrite: false
    });
    const water = new THREE.Mesh(geo, m);
    water.position.set(L.minX + w / 2, -0.12, L.minZ + d / 2);
    water.renderOrder = 1;
    this.group.add(water);
    // il lago è calmo: appena un respiro nei riflessi
    this.dynamic.push({ update: (dt, t) => { m.roughness = 0.04 + Math.sin(t * 0.7) * 0.015; } });
  }

  _bushes() {
    const count = this.world.bushes;
    if (!count) return;
    const N = this.N;
    const g = new THREE.IcosahedronGeometry(1.2, 0);
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
    const bushes = new THREE.InstancedMesh(g, m, count);
    const mt = new THREE.Matrix4(), col = new THREE.Color();
    const seedR = (i) => hash(i * 2.3 + 11, i * 0.7 + 5);
    let placed = 0, tries = 0;
    while (placed < count && tries < count * 8) {
      tries++;
      const s = this.samples[Math.floor(seedR(tries) * N)];
      const side = seedR(tries + 31) < 0.5 ? -1 : 1;
      const p = _v.copy(s.pos).addScaledVector(s.right, side * (14 + seedR(tries + 17) * 110)).addScaledVector(s.tangent, (seedR(tries + 3) - 0.5) * 40);
      if (this._trackDist(p.x, p.z).d < 13 || this.lakeAt(p.x, p.z, 4) > 0) continue;
      const sc = 0.5 + seedR(tries + 9) * 0.9;
      mt.makeRotationY(seedR(tries + 23) * 6.28).scale(new THREE.Vector3(sc * 1.3, sc * 0.7, sc * 1.3)).setPosition(p.x, this.terrainHeight(p.x, p.z) + 0.4 * sc, p.z);
      bushes.setMatrixAt(placed, mt);
      bushes.setColorAt(placed, col.setHSL(0.16 + seedR(tries + 41) * 0.08, 0.35, 0.3 + seedR(tries + 43) * 0.15));
      placed++;
    }
    bushes.count = placed;
    bushes.castShadow = true;
    this.group.add(bushes);
  }

  /** Lampioni a luce calda appena oltre il guardrail, alternati sui due lati, con una pozza di luce sull'asfalto. */
  _lamps() {
    const N = this.N, step = 9;
    const count = Math.ceil(N / step) + 1;
    const poleG = new THREE.CylinderGeometry(0.14, 0.2, 7, 6);
    poleG.translate(0, 3.5, 0);
    const armG = new THREE.BoxGeometry(0.14, 0.14, 2.6);
    armG.translate(0, 7, 1.2);
    const headG = new THREE.SphereGeometry(0.38, 10, 8);
    headG.translate(0, 6.85, 2.4);
    const poleM = new THREE.MeshStandardMaterial({ color: 0x2a2a38, roughness: 0.5, metalness: 0.6 });
    const headM = new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffb45a, emissiveIntensity: 3 });
    const poles = new THREE.InstancedMesh(poleG, poleM, count);
    const arms = new THREE.InstancedMesh(armG, poleM, count);
    const heads = new THREE.InstancedMesh(headG, headM, count);
    // pozza di luce: disco additivo con gradiente radiale
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,190,110,0.55)');
    grd.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const poolG = new THREE.PlaneGeometry(10, 10);
    poolG.rotateX(-Math.PI / 2);
    const poolM = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const pools = new THREE.InstancedMesh(poolG, poolM, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    const base = new THREE.Vector3();
    let k = 0;
    for (let i = 0, n = 0; i < N; i += step, n++) {
      const s = this.samples[i];
      const side = n % 2 ? 1 : -1;
      base.copy(s.pos).addScaledVector(s.right, side * (this.wallDist + 1.2));
      // il braccio (+Z locale) punta verso la carreggiata
      q.setFromAxisAngle(up, Math.atan2(-side * s.right.x, -side * s.right.z));
      m.compose(base, q, one);
      poles.setMatrixAt(k, m);
      arms.setMatrixAt(k, m);
      heads.setMatrixAt(k, m);
      base.copy(s.pos).addScaledVector(s.right, side * (this.halfW + 2.5)).addScaledVector(s.normal, 0.07);
      m.compose(base, q.identity(), one);
      pools.setMatrixAt(k, m);
      k++;
    }
    poles.count = arms.count = heads.count = pools.count = k;
    poles.castShadow = true;
    pools.renderOrder = 2;
    this.group.add(poles, arms, heads, pools);
  }

  _scatter() {
    const N = this.N;
    const treeCount = this.world.trees, rockCount = this.world.rocks;
    if (!treeCount && !rockCount) return;
    const trunkG = new THREE.CylinderGeometry(0.35, 0.5, 3, 6);
    const crownG = new THREE.ConeGeometry(2.6, 6.5, 7);
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x6b4b2a, roughness: 1 });
    const crownM = new THREE.MeshStandardMaterial({ color: 0x2e8b4e, roughness: 0.9 });
    const trunks = new THREE.InstancedMesh(trunkG, trunkM, treeCount);
    const crowns = new THREE.InstancedMesh(crownG, crownM, treeCount);
    const rockG = new THREE.DodecahedronGeometry(2.2, 0);
    const rockM = new THREE.MeshStandardMaterial({ color: this.pal.rock, roughness: 1, flatShading: true });
    const rocks = new THREE.InstancedMesh(rockG, rockM, rockCount);
    const m = new THREE.Matrix4();
    let placed = 0, tries = 0;
    const seedR = (i) => hash(i * 1.7, i * 3.3);
    while (placed < treeCount && tries < treeCount * 6) {
      tries++;
      const s = this.samples[Math.floor(seedR(tries) * N)];
      const side = seedR(tries + 99) < 0.5 ? -1 : 1;
      const d = 16 + seedR(tries + 7) * 90;
      const p = _v.copy(s.pos).addScaledVector(s.right, side * d).addScaledVector(s.tangent, (seedR(tries + 13) - 0.5) * 40);
      const h = this.terrainHeight(p.x, p.z);
      if (h < -3 || this.lakeAt(p.x, p.z, 6) > 0) continue;
      // evita altre parti di pista
      const j = this.nearestIndex(p);
      const dd = Math.hypot(p.x - this.samples[j].pos.x, p.z - this.samples[j].pos.z);
      if (dd < 15) continue;
      const sc = 0.8 + seedR(tries + 5) * 0.9;
      m.makeScale(sc, sc, sc).setPosition(p.x, h + 1.4 * sc, p.z);
      trunks.setMatrixAt(placed, m);
      m.makeScale(sc, sc, sc).setPosition(p.x, h + 5.8 * sc, p.z);
      crowns.setMatrixAt(placed, m);
      placed++;
    }
    trunks.count = crowns.count = placed;
    trunks.castShadow = crowns.castShadow = true;
    this.group.add(trunks, crowns);
    let rp = 0;
    tries = 0;
    while (rp < rockCount && tries < rockCount * 6) {
      tries++;
      const s = this.samples[Math.floor(seedR(tries + 500) * N)];
      const side = seedR(tries + 501) < 0.5 ? -1 : 1;
      const d = 13 + seedR(tries + 502) * 60;
      const p = _v.copy(s.pos).addScaledVector(s.right, side * d);
      const h = this.terrainHeight(p.x, p.z);
      const j = this.nearestIndex(p);
      if (Math.hypot(p.x - this.samples[j].pos.x, p.z - this.samples[j].pos.z) < 12.5) continue;
      const sc = 0.6 + seedR(tries + 503) * 2.2;
      m.makeRotationY(seedR(tries + 504) * 6.28).scale(new THREE.Vector3(sc, sc * 0.7, sc)).setPosition(p.x, h + 0.3, p.z);
      rocks.setMatrixAt(rp, m);
      rp++;
    }
    rocks.count = rp;
    rocks.castShadow = true;
    this.group.add(rocks);
  }

  _city() {
    // palazzi lungo gli intervalli di `world.city` (di default: partenza e rettilineo del centro)
    const wo = this.world;
    if (!wo.city.length) return;
    const night = wo.night;
    const winTex = night ? T.windowsTexture('#2a2c44', '#ffd27a', '#1c1d2e') : T.windowsTexture();
    // di notte le finestre accese brillano: stessa disposizione (seme fisso), solo le luci
    const litTex = night ? T.windowsTexture('#000000', '#ffc86a', '#000000') : null;
    const cols = night ? ['#8d8fb0', '#a095b8', '#7f93a8', '#9a8aa0', '#8a86b8'] : ['#e9d5b0', '#d9b78f', '#c9d6c0', '#e6c9c1', '#d4d0e8'];
    const neonHues = [0.87, 0.52, 0.78, 0.95, 0.12];
    // niente palazzi sopra gli oggetti di scena fermi (deposito, tavola calda…)
    const keepOut = (this.def.props || []).filter((p) => p.t !== undefined && !p.spin && p.side).map((p) => {
      const s = this.samples[this.idxFromT(p.t)];
      return { p: s.pos.clone().addScaledVector(s.right, p.side), r: 12 * (p.scale || 1) };
    });
    const group = new THREE.Group();
    let n = 0;
    for (const [a, b] of wo.city) {
      for (let t = a; t < b; t += wo.cityStep) {
        for (const side of [-1, 1]) {
          const s = this.samples[this.idxFromT(t)];
          const d = 24 + hash(n, side) * 14;
          const w = 12 + hash(n + 1, side) * 10, dpt = 12 + hash(n + 2, side) * 8;
          const h = night ? 16 + hash(n + 3, side) * 40 : 12 + hash(n + 3, side) * 26;
          const p = _v.copy(s.pos).addScaledVector(s.right, side * (d + w / 2));
          const rad = Math.hypot(w, dpt) / 2;
          const blocked = this._trackDist(p.x, p.z).d < rad + this.halfW + 6 || keepOut.some((k) => Math.hypot(k.p.x - p.x, k.p.z - p.z) < k.r + rad);
          if (blocked) { n++; continue; }
          const th = this.terrainHeight(p.x, p.z);
          const m = new THREE.MeshStandardMaterial({ color: cols[n % cols.length], map: winTex.clone(), roughness: 0.8 });
          m.map.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 12)));
          m.map.needsUpdate = true;
          if (litTex) {
            m.emissive = new THREE.Color(0xffffff);
            m.emissiveMap = litTex.clone();
            m.emissiveMap.repeat.copy(m.map.repeat);
            m.emissiveMap.needsUpdate = true;
            m.emissiveIntensity = 0.9;
          }
          const bx = new THREE.Mesh(new THREE.BoxGeometry(w, h, dpt), m);
          bx.position.set(p.x, th + h / 2 - 1, p.z);
          bx.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);
          bx.castShadow = bx.receiveShadow = true;
          group.add(bx);
          // insegna al neon (di notte a volte anche una verticale)
          if (hash(n + 9, side) < wo.neon) {
            const hue = night ? neonHues[n % neonHues.length] : hash(n + 4, side);
            const neonM = new THREE.MeshStandardMaterial({ color: 0x220a22, emissive: new THREE.Color().setHSL(hue, 0.9, 0.55), emissiveIntensity: night ? 2.6 : 1.8 });
            const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 1.6, 0.4), neonM);
            sign.position.set(0, h * 0.35, -side * (dpt / 2 + 0.3));
            bx.add(sign);
            if (night && hash(n + 12, side) < 0.5) {
              const tall = new THREE.Mesh(new THREE.BoxGeometry(0.5, Math.min(10, h * 0.4), 1.4), neonM);
              tall.position.set((hash(n + 13, side) - 0.5) * w * 0.8, 0, -side * (dpt / 2 + 0.8));
              bx.add(tall);
            }
          }
          // luce rossa di segnalazione sul tetto
          if (night && hash(n + 15, side) < 0.3) {
            const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3355 }));
            beacon.position.set(0, h / 2 + 0.4, 0);
            bx.add(beacon);
          }
          n++;
        }
      }
    }
    this.group.add(group);
  }

  _startLine() {
    const s = this.samples[this.idxFromT(this.def.startT)];
    const hw = this.halfW;
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) {
      g.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5';
      g.fillRect(x * 32, y * 32, 32, 32);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    line.position.copy(s.pos).addScaledVector(s.normal, 0.06);
    line.lookAt(_v.copy(s.pos).add(s.normal));
    line.rotateZ(Math.atan2(s.tangent.x, s.tangent.z) + Math.PI / 2);
    this.group.add(line);
    // arco
    const arch = new THREE.Group();
    const postM = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.4 });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 12, 12), postM);
      post.position.copy(s.pos).addScaledVector(s.right, side * (hw + 2.2)).addScaledVector(s.normal, 6);
      arch.add(post);
    }
    const bc = document.createElement('canvas');
    bc.width = 1024; bc.height = 160;
    const bg = bc.getContext('2d');
    bg.fillStyle = '#16204a';
    bg.fillRect(0, 0, 1024, 160);
    bg.fillStyle = '#f5b942';
    bg.font = 'bold 110px Fredoka, "Segoe UI", Arial, sans-serif';
    bg.textAlign = 'center';
    bg.textBaseline = 'middle';
    bg.fillText('WISIKART', 512, 84);
    const bt = new THREE.CanvasTexture(bc);
    bt.colorSpace = THREE.SRGBColorSpace;
    const banner = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 5.5, 3, 0.6), [postM, postM, postM, postM,
      new THREE.MeshStandardMaterial({ map: bt, emissive: 0x334488, emissiveMap: bt, emissiveIntensity: 0.4 }),
      new THREE.MeshStandardMaterial({ map: bt, emissive: 0x334488, emissiveMap: bt, emissiveIntensity: 0.4 })]);
    banner.position.copy(s.pos).addScaledVector(s.normal, 11.5);
    banner.lookAt(_v.copy(banner.position).add(s.tangent));
    arch.add(banner);
    this.group.add(arch);
    // semaforo di partenza
    const lights = new THREE.Group();
    this.startLights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0x000000 }));
      l.position.copy(s.pos).addScaledVector(s.normal, 9).addScaledVector(s.right, (i - 1) * 1.8);
      lights.add(l);
      this.startLights.push(l);
    }
    this.group.add(lights);
  }

  setStartLights(n, go = false) {
    this.startLights.forEach((l, i) => {
      if (go) { l.material.emissive.set(0x33ff66); l.material.emissiveIntensity = 3; }
      else if (i < n) { l.material.emissive.set(0xff2222); l.material.emissiveIntensity = 3; }
      else { l.material.emissive.set(0x000000); }
    });
  }

  gridPositions(count) {
    const startIdx = this.idxFromT(this.def.startT);
    const out = [];
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 2), col = i % 2;
      const s = this.samples[(startIdx - 4 - row * 4 + this.N) % this.N];
      const p = _v.copy(s.pos).addScaledVector(s.right, col ? 3.6 : -3.6).addScaledVector(s.tangent, col ? -1.5 : 0).clone();
      out.push({ pos: p, heading: Math.atan2(s.tangent.x, s.tangent.z), idx: (startIdx - 4 - row * 4 + this.N) % this.N });
    }
    return out;
  }

  _itemBoxes() {
    const geo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    for (const t of this.def.itemBoxes) {
      const idx = this.idxFromT(t);
      const s = this.samples[idx];
      for (const lat of [-4.2, 0, 4.2]) {
        const mat = new THREE.MeshStandardMaterial({
          color: 0xffffff, emissive: new THREE.Color().setHSL(0.6, 0.9, 0.5), emissiveIntensity: 0.9,
          transparent: true, opacity: 0.75, roughness: 0.2, metalness: 0.6
        });
        const mesh = new THREE.Mesh(geo, mat);
        const q = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), new THREE.MeshStandardMaterial({ color: 0xffd45a, emissive: 0xffb300, emissiveIntensity: 1.2 }));
        mesh.add(q);
        mesh.position.copy(s.pos).addScaledVector(s.right, lat).addScaledVector(s.normal, 1.4);
        this.group.add(mesh);
        this.itemBoxes.push({ mesh, pos: mesh.position.clone(), idx, taken: 0, hue: Math.random() });
      }
    }
  }

  _boostPads() {
    const tex = T.boostTexture();
    for (const t of this.def.boostPads) {
      const idx = this.idxFromT(t);
      const len = 5; // campioni ≈ 15 m
      const pos = [], uv = [], ind = [];
      for (let i = 0; i <= len; i++) {
        const s = this.samples[(idx + i) % this.N];
        const a = _v.copy(s.pos).addScaledVector(s.right, -this.halfW + 1).addScaledVector(s.normal, 0.05);
        const b = _w.copy(s.pos).addScaledVector(s.right, this.halfW - 1).addScaledVector(s.normal, 0.05);
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        uv.push(0, i / 2, 1, i / 2);
        if (i < len) { const k = i * 2; ind.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(ind);
      g.computeVertexNormals();
      const mt = tex.clone();
      mt.needsUpdate = true;
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: mt, emissive: 0x2fe0a0, emissiveMap: mt, emissiveIntensity: 0.9 }));
      this.group.add(m);
      this.boostPads.push({ idx, len, mat: m.material });
      this.dynamic.push({ update: (dt) => { mt.offset.y -= dt * 1.5; } });
    }
  }

  async _props() {
    const list = this.def.props || [];
    for (const p of list) {
      const s = p.t !== undefined ? this.samples[this.idxFromT(p.t)] : null;
      const pos = s ? _v.copy(s.pos).addScaledVector(s.right, p.side || 0).clone() : new THREE.Vector3(...p.at);
      if (!this.isTunnel && s) pos.y = this.terrainHeight(pos.x, pos.z) + 0.2;
      if (p.y) pos.y += p.y;
      const obj = await buildProp(p.model, p.scale || 1, this.pal);
      obj.position.copy(pos);
      if (p.faceTrack && s) obj.lookAt(_w.copy(pos).addScaledVector(s.right, -(p.side || 1)));
      if (p.alignTrack && s) obj.lookAt(_w.set(pos.x + s.tangent.x, pos.y, pos.z + s.tangent.z));
      this.group.add(obj);
      if (p.spin) this.dynamic.push({ update: (dt, t) => { obj.rotation.y += dt * 0.4; obj.position.y = pos.y + Math.sin(t * 1.3) * 0.8; } });
    }
  }

  async _sky() {
    if (this.isTunnel) {
      this.scene.background = new THREE.Color(this.pal.fog);
      this.scene.fog = new THREE.FogExp2(this.pal.fog, 0.0075);
      return;
    }
    let tex = await Assets.texture(this.def.sky, { equirect: true });
    if (!tex) tex = this.world.night ? T.skyGradientTexture('#05061a', '#1a1a4a', '#3a2a5a', true, true) : T.skyGradientTexture('#2b3a7a', '#f19a6b', '#ffd9a0');
    this.scene.background = tex;
    this.scene.environment = tex;
    // di notte il cielo non deve illuminare tutto di grigio: quasi niente luce d'ambiente dal cielo
    this.scene.environmentIntensity = this.world.night ? 0.12 : 1;
    this.scene.fog = new THREE.Fog(this.pal.fog, this.world.fog[0], this.world.fog[1]);
  }

  _lights() {
    const p = this.pal;
    const night = !this.isTunnel && this.world.night;
    // di notte: poca luce diffusa (le ombre restano scure) e una luna forte e radente che scolpisce i volumi
    const hemi = new THREE.HemisphereLight(new THREE.Color(this.isTunnel ? '#cfd6ff' : p.ambient), new THREE.Color(this.isTunnel ? '#2a1a5a' : p.ground || '#3b5a2c'), this.isTunnel ? 2.4 : night ? 0.22 : 0.75);
    this.group.add(hemi);
    // di notte il "sole" è la luna grande, rosa
    const sun = new THREE.DirectionalLight(new THREE.Color(p.sun), this.isTunnel ? 1.3 : night ? 2.1 : 1.9);
    this.sunOffset = night ? new THREE.Vector3(220, 150, -160) : new THREE.Vector3(180, 260, -120);
    sun.position.copy(this.sunOffset);
    sun.castShadow = !this.isTunnel;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 800;
    const ext = 120;
    sun.shadow.camera.left = -ext; sun.shadow.camera.right = ext;
    sun.shadow.camera.top = ext; sun.shadow.camera.bottom = -ext;
    sun.shadow.bias = -0.0006;
    this.sun = sun;
    this.group.add(sun, sun.target);
  }

  /** aggiornamenti per frame: animazioni, luci che seguono il giocatore */
  update(dt, time, focus) {
    for (const d of this.dynamic) d.update(dt, time);
    for (const b of this.itemBoxes) {
      if (b.taken > 0) {
        b.taken -= dt;
        b.mesh.visible = false;
        if (b.taken <= 0) b.mesh.visible = true;
        continue;
      }
      b.mesh.rotation.y += dt * 1.6;
      b.mesh.rotation.x += dt * 0.8;
      b.mesh.position.y = b.pos.y + Math.sin(time * 2.2 + b.hue * 10) * 0.25;
      b.mesh.material.emissive.setHSL((time * 0.15 + b.hue) % 1, 0.9, 0.5);
    }
    if (this.tunnelTex) this.tunnelTex.offset.y -= dt * 0.12;
    if (this.sun && focus) {
      this.sun.position.copy(focus).add(this.sunOffset);
      this.sun.target.position.copy(focus);
      this.sun.target.updateMatrixWorld();
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
    this.scene.background = null;
    this.scene.environment = null;
    this.scene.environmentIntensity = 1;
    this.scene.fog = null;
  }
}
