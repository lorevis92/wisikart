import * as THREE from 'three';

// Interno 3D della tavola calda di Retah (arena della rissa, story/rissa.js → room) e cortile sul retro
// (dove Emma aspetta). Qui ci sono solo costruzione e geometria: ostacoli, griglia dei percorsi per i nemici,
// collisioni. Le regole della rissa stanno in BrawlMode.js.
// Coordinate: x = destra/sinistra, z = profondità (negativo = verso le finestre sul fondo), y = quota.

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Pavimento a scacchi da tavola calda (texture procedurale). */
function checkerTexture(a, b) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    g.fillStyle = (x + y) % 2 ? b : a;
    g.fillRect(x * 64, y * 64, 64, 64);
  }
  g.strokeStyle = 'rgba(0,0,0,0.15)';
  g.lineWidth = 2;
  g.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/**
 * Costruisce la stanza dentro `scene`. models = { bancone, tavolo, divanetto, porta, lampada, jukebox } (GLB già
 * caricati, o null: al loro posto blocchi semplici della stessa misura), sky = texture del cielo di Retah.
 * Ritorna { obstacles, jukebox, jukeGlow, jukeLight, door }.
 */
export function buildDiner(scene, room, models, sky) {
  const obstacles = [];
  const R = room;
  const W = R.x1 - R.x0;

  // --- luci: tramonto dalle finestre (fa entrare il sole a strisce), riempimento dal davanti, lampade ---
  scene.add(new THREE.HemisphereLight(0xffd8b8, 0x4a2a1a, 0.8));
  const sun = new THREE.DirectionalLight(0xff9a50, 2.6);
  sun.position.set(-7, 9, -22);
  sun.target.position.set(2, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -17; sc.right = 17; sc.top = 12; sc.bottom = -12; sc.near = 2; sc.far = 60;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xffe8d0, 0.55);
  fill.position.set(3, 10, 14);
  scene.add(fill);
  scene.background = new THREE.Color('#2a1a14');

  // --- fuori dalle finestre: sabbia, lago e cielo del tramonto ---
  if (sky) {
    const aspect = sky.image ? sky.image.width / sky.image.height : 1.78;
    const h = 110;
    const skyM = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h), new THREE.MeshBasicMaterial({ map: sky, toneMapped: false, fog: false }));
    skyM.position.set(0, 26, -70);
    scene.add(skyM);
  } else {
    const skyM = new THREE.Mesh(new THREE.PlaneGeometry(240, 110), new THREE.MeshBasicMaterial({ color: 0xf4a7a0 }));
    skyM.position.set(0, 26, -70);
    scene.add(skyM);
  }
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(240, 70), std('#d9b98a', { roughness: 0.95 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, -0.05, R.back - 35);
  scene.add(sand);
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(240, 44), new THREE.MeshStandardMaterial({ color: 0x4f86a8, roughness: 0.08, metalness: 0.4, emissive: 0xff8a50, emissiveIntensity: 0.12 }));
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(0, 0.0, R.back - 40);
  scene.add(lake);

  // --- pavimento a scacchi (prosegue un po' verso la telecamera, dove la stanza è "tagliata") ---
  const floorD = R.floorFront - R.back;
  const tex = checkerTexture('#efe4cc', '#2b2a38');
  tex.repeat.set(W / 1.2, floorD / 1.2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, floorD), std('#ffffff', { map: tex, roughness: 0.35, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((R.x0 + R.x1) / 2, 0, (R.back + R.floorFront) / 2);
  floor.receiveShadow = true;
  scene.add(floor);
  // bordo scuro dove la stanza è tagliata, verso chi guarda
  const edge = new THREE.Mesh(new THREE.PlaneGeometry(W + 4, 3), new THREE.MeshBasicMaterial({ color: 0x120c0a, transparent: true, opacity: 0.55, depthWrite: false }));
  edge.rotation.x = -Math.PI / 2;
  edge.position.set(0, 0.004, R.floorFront + 1.2);
  scene.add(edge);

  // --- parete di fondo con le finestre grandi ---
  const wallLow = std('#b8434a', { roughness: 0.7 }); // zoccolo rosso
  const wallHigh = std('#f1e3c8', { roughness: 0.85 }); // crema
  const chrome = std('#c9cfdc', { metalness: 0.85, roughness: 0.25 });
  const T = 0.25, zb = R.back - T / 2;
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  box(W, R.sill, T, wallLow, (R.x0 + R.x1) / 2, R.sill / 2, zb);
  box(W, R.height - R.top, T, wallHigh, (R.x0 + R.x1) / 2, (R.top + R.height) / 2, zb);
  // montanti tra una finestra e l'altra
  const wins = [...R.windows].sort((a, b) => a[0] - b[0]);
  let x = R.x0;
  for (const [a, b] of [...wins, [R.x1, R.x1]]) {
    if (a > x + 0.01) box(a - x, R.top - R.sill, T, wallHigh, (x + a) / 2, (R.sill + R.top) / 2, zb);
    x = b;
  }
  for (const [a, b] of wins) {
    // cornici cromate e vetro appena ambrato
    box(b - a, 0.08, 0.3, chrome, (a + b) / 2, R.sill, zb + 0.05);
    box(b - a, 0.08, 0.3, chrome, (a + b) / 2, R.top, zb + 0.05);
    box(0.06, R.top - R.sill, 0.2, chrome, (a + b) / 2, (R.sill + R.top) / 2, zb);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(b - a, R.top - R.sill), new THREE.MeshBasicMaterial({ color: 0xffd8b0, transparent: true, opacity: 0.07, depthWrite: false }));
    glass.position.set((a + b) / 2, (R.sill + R.top) / 2, zb);
    scene.add(glass);
  }
  // fascia al neon sopra le finestre
  const neon = new THREE.Mesh(new THREE.BoxGeometry(W - 1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x110818, emissive: 0x43e0b0, emissiveIntensity: 2.4 }));
  neon.position.set((R.x0 + R.x1) / 2, R.top + 0.35, zb + 0.2);
  scene.add(neon);

  // --- pareti laterali tagliate: la sinistra bassa, la destra con la porta della cucina ---
  box(T, R.leftWallH, R.floorFront - R.back, wallLow, R.x0 - T / 2, R.leftWallH / 2, (R.back + R.floorFront) / 2);
  const D = R.door;
  const dw = 2.4;
  const rightH = R.rightWallH;
  const zA = R.back, zB = R.frontWall;
  box(T, rightH, D.z - dw / 2 - zA, wallHigh, R.x1 + T / 2, rightH / 2, (zA + D.z - dw / 2) / 2);
  box(T, rightH, zB - (D.z + dw / 2), wallHigh, R.x1 + T / 2, rightH / 2, (D.z + dw / 2 + zB) / 2);
  box(T, rightH - D.h, dw, wallHigh, R.x1 + T / 2, (D.h + rightH) / 2, D.z);
  box(T * 1.02, 1.0, zB - zA, wallLow, R.x1 + T / 2 + 0.01, 0.5, (zA + zB) / 2);
  // porta della cucina: modello (o battenti semplici) e una luce che si accende quando si può uscire
  const door = new THREE.Group();
  if (models.porta) {
    const m = models.porta;
    m.rotation.y = -Math.PI / 2; // guarda dentro la stanza (verso -X)
    door.add(m);
  } else {
    for (const s of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.08, D.h, dw / 2 - 0.05), std('#c9cfdc', { metalness: 0.7, roughness: 0.3 }));
      leaf.position.set(0, D.h / 2, s * dw / 4);
      door.add(leaf);
    }
  }
  door.position.set(R.x1 + 0.05, 0, D.z);
  door.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(door);
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(dw * 0.9, D.h * 0.95), new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  doorGlow.rotation.y = -Math.PI / 2;
  doorGlow.position.set(R.x1 - 0.08, D.h / 2, D.z);
  scene.add(doorGlow);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 3), new THREE.MeshBasicMaterial({ color: 0x43e0b0 }));
  arrow.rotation.z = -Math.PI / 2;
  arrow.position.set(R.x1 - 1.6, 2.9, D.z);
  arrow.visible = false;
  scene.add(arrow);

  // --- arredi fissi: oggetti veri con volume e ombre; la loro impronta diventa un ostacolo ---
  const place = (f) => {
    const g = new THREE.Group();
    const proto = models[f.model];
    if (proto) g.add(proto.clone(true));
    else {
      const size = { bancone: [2.1, f.h, 0.62], tavolo: [f.h, f.h, f.h], divanetto: [2, f.h, 1.25] }[f.model] || [1, f.h, 1];
      const col = { bancone: '#8a3a2a', tavolo: '#d8d8e0', divanetto: '#b8434a' }[f.model] || '#888';
      const m = new THREE.Mesh(new THREE.BoxGeometry(...size), std(col));
      m.position.y = size[1] / 2;
      g.add(m);
    }
    g.position.set(f.x, 0, f.z);
    g.rotation.y = THREE.MathUtils.degToRad(f.rot || 0);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(g);
    g.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(g);
    obstacles.push({ x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z, h: b.max.y, kind: f.model });
    return g;
  };
  for (const f of R.furniture) place(f);

  // juke-box contro la parete di fondo (anche lui un ostacolo)
  const J = R.jukebox;
  const jg = new THREE.Group();
  if (models.jukebox) jg.add(models.jukebox);
  else {
    const jb = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2, 0.8), std('#8a2a4a', { emissive: 0x401020, emissiveIntensity: 0.6 }));
    jb.position.y = 1;
    jg.add(jb);
  }
  jg.position.set(J.x, 0, J.z);
  jg.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(jg);
  jg.updateMatrixWorld(true);
  const jb = new THREE.Box3().setFromObject(jg);
  obstacles.push({ x0: jb.min.x, x1: jb.max.x, z0: jb.min.z, z1: jb.max.z, h: jb.max.y, kind: 'jukebox' });
  const jukeGlow = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 32), new THREE.MeshBasicMaterial({ color: 0xff5fb0, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  jukeGlow.rotation.x = -Math.PI / 2;
  jukeGlow.position.set(J.x, 0.02, J.z + 0.9);
  scene.add(jukeGlow);
  const jukeLight = new THREE.PointLight(0xff5fb0, 10, 8, 1.6);
  jukeLight.position.set(J.x, 2.2, J.z + 1);
  scene.add(jukeLight);

  // --- lampade appese: modello e bagliore caldo ---
  for (const [lx, lz] of R.lamps) {
    const g = new THREE.Group();
    if (models.lampada) g.add(models.lampada.clone(true));
    else {
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.4, 16, 1, true), std('#2a6a5a', { side: THREE.DoubleSide }));
      shade.position.y = 0.2;
      g.add(shade);
    }
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffb45a, emissiveIntensity: 3 }));
    bulb.position.y = 0.05;
    g.add(bulb);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3, 4), std('#1d1d26'));
    cord.position.y = R.lampY + 1.5 + (models.lampada ? 1.2 : 0.4);
    g.position.set(lx, R.lampY, lz);
    scene.add(g);
    cord.position.set(lx, R.lampY + 2.2, lz);
    scene.add(cord);
    const l = new THREE.PointLight(0xffc070, 9, 7.5, 1.7);
    l.position.set(lx, R.lampY - 0.2, lz);
    scene.add(l);
  }
  return { obstacles, jukebox: jg, jukeGlow, jukeLight, door: { group: door, glow: doorGlow, arrow } };
}

/**
 * Griglia dei percorsi: celle libere o occupate dagli arredi (allargati del raggio di un personaggio).
 * Una mappa delle distanze da Whiskey (ricalcolata quando si sposta) dice a ogni nemico da che parte
 * girare intorno a bancone, tavoli e divanetti; se la strada è libera vanno dritti.
 */
export class NavGrid {
  constructor(bounds, obstacles, cell = 0.4, pad = 0.42) {
    this.b = bounds;
    this.obs = obstacles;
    this.cell = cell;
    this.nx = Math.ceil((bounds.x1 - bounds.x0) / cell);
    this.nz = Math.ceil((bounds.z1 - bounds.z0) / cell);
    this.blocked = new Uint8Array(this.nx * this.nz);
    for (let iz = 0; iz < this.nz; iz++) for (let ix = 0; ix < this.nx; ix++) {
      const x = bounds.x0 + (ix + 0.5) * cell, z = bounds.z0 + (iz + 0.5) * cell;
      if (obstacles.some((o) => x > o.x0 - pad && x < o.x1 + pad && z > o.z0 - pad && z < o.z1 + pad)) this.blocked[iz * this.nx + ix] = 1;
    }
    this.dist = new Int32Array(this.nx * this.nz).fill(-1);
    this.goal = -1;
  }

  _cell(x, z) {
    const ix = clamp(Math.floor((x - this.b.x0) / this.cell), 0, this.nx - 1);
    const iz = clamp(Math.floor((z - this.b.z0) / this.cell), 0, this.nz - 1);
    return iz * this.nx + ix;
  }

  _center(i) { return { x: this.b.x0 + ((i % this.nx) + 0.5) * this.cell, z: this.b.z0 + (Math.floor(i / this.nx) + 0.5) * this.cell }; }

  /** Mappa delle distanze verso (x, z): ricerca in ampiezza su 8 vicini, senza tagliare gli angoli. */
  setGoal(x, z) {
    let g = this._cell(x, z);
    if (g === this.goal) return;
    if (this.blocked[g]) {
      // Whiskey appoggiato a un arredo: la cella libera più vicina
      let best = -1, bd = Infinity;
      for (let i = 0; i < this.blocked.length; i++) {
        if (this.blocked[i]) continue;
        const c = this._center(i), d = (c.x - x) ** 2 + (c.z - z) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      g = best;
    }
    this.goal = g;
    const D = this.dist.fill(-1), nx = this.nx, nz = this.nz;
    const q = new Int32Array(nx * nz);
    let head = 0, tail = 0;
    D[g] = 0; q[tail++] = g;
    while (head < tail) {
      const i = q[head++], ix = i % nx, iz = (i - ix) / nx;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const jx = ix + dx, jz = iz + dz;
        if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
        const j = jz * nx + jx;
        if (this.blocked[j] || D[j] >= 0) continue;
        if (dx && dz && (this.blocked[iz * nx + jx] || this.blocked[jz * nx + ix])) continue;
        D[j] = D[i] + 1;
        q[tail++] = j;
      }
    }
  }

  /** Strada libera in linea retta tra due punti (con un margine intorno agli arredi)? */
  clear(x0, z0, x1, z1, pad = 0.3) {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.25);
    for (let k = 1; k <= n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      for (const o of this.obs) if (x > o.x0 - pad && x < o.x1 + pad && z > o.z0 - pad && z < o.z1 + pad) return false;
    }
    return true;
  }

  /** Direzione (unitaria) per andare da (x, z) verso il bersaglio (tx, tz): dritta se libera, sennò lungo la griglia. */
  steer(x, z, tx, tz) {
    const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz);
    if (d < 0.05) return { x: 0, z: 0 };
    if (this.clear(x, z, tx, tz)) return { x: dx / d, z: dz / d };
    const i = this._cell(x, z), nx = this.nx, ix = i % nx, iz = (i - ix) / nx;
    let best = -1, bd = this.dist[i] >= 0 ? this.dist[i] : Infinity;
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
      const jx = ix + ox, jz = iz + oz;
      if ((!ox && !oz) || jx < 0 || jz < 0 || jx >= nx || jz >= this.nz) continue;
      const j = jz * nx + jx, v = this.dist[j];
      if (v >= 0 && v < bd) { bd = v; best = j; }
    }
    if (best < 0) return { x: dx / d, z: dz / d };
    const c = this._center(best), ex = c.x - x, ez = c.z - z, e = Math.hypot(ex, ez) || 1;
    return { x: ex / e, z: ez / e };
  }
}

/** Spinge un personaggio (cerchio di raggio r nel piano x-z) fuori dagli arredi. */
export function collide(p, r, obstacles) {
  for (const o of obstacles) {
    const cx = clamp(p.x, o.x0, o.x1), cz = clamp(p.z, o.z0, o.z1);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r; continue; }
    // dentro l'arredo: fuori dal lato più vicino
    const l = p.x - o.x0, rr = o.x1 - p.x, b = p.z - o.z0, f = o.z1 - p.z, m = Math.min(l, rr, b, f);
    if (m === l) p.x = o.x0 - r; else if (m === rr) p.x = o.x1 + r; else if (m === b) p.z = o.z0 - r; else p.z = o.z1 + r;
  }
}

/**
 * Cortile sul retro della tavola calda, per la breve scena di fine rissa: sabbia al tramonto, la tavola calda
 * con la porta della cucina accesa, l'autovettore di Emma con un faro e un segnale "Sali su Emma".
 * Ritorna { start, target, car, marker }.
 */
export function buildBackyard(scene, { diner, car, sky }) {
  if (sky) { sky.mapping = THREE.EquirectangularReflectionMapping; scene.background = sky; scene.environment = sky; scene.environmentIntensity = 0.5; }
  else scene.background = new THREE.Color('#f4a7a0');
  scene.fog = new THREE.Fog(0xf4a7a0, 60, 220);
  scene.add(new THREE.HemisphereLight(0xffd2b8, 0xb8916a, 1.0));
  const sun = new THREE.DirectionalLight(0xffc88a, 2.3);
  sun.position.set(-30, 20, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const c = sun.shadow.camera;
  c.left = -20; c.right = 20; c.top = 20; c.bottom = -20; c.near = 1; c.far = 90;
  scene.add(sun, sun.target);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(300, 48), std('#e2c898', { roughness: 0.97 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // la tavola calda, vista da dietro, e la porta della cucina accesa
  const d = new THREE.Group();
  if (diner) d.add(diner);
  else { const b = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 8), std('#c9a27a')); b.position.y = 3; d.add(b); }
  d.position.set(-2, 0, -9);
  d.rotation.y = Math.PI; // il retro verso chi guarda
  d.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(d);
  d.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(d);
  const doorZ = box.max.z + 0.06;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.3), new THREE.MeshBasicMaterial({ color: 0xfff0b0 }));
  door.position.set(-0.5, 1.15, doorZ);
  scene.add(door);
  // l'autovettore di Emma: faro verde, anello a terra, freccia che galleggia
  const g = new THREE.Group();
  if (car) g.add(car);
  else { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 2, 6, 12), std('#d99a2b', { metalness: 0.4 })); b.rotation.z = Math.PI / 2; b.position.y = 1; g.add(b); }
  g.position.set(6.5, 0, 1);
  g.rotation.y = -0.5;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(g);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x43e0b0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.position.set(6.5, 20, 1);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 40), new THREE.MeshBasicMaterial({ color: 0x43e0b0, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(4.6, 0.03, 1.8);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 4), new THREE.MeshBasicMaterial({ color: 0x43e0b0 }));
  arrow.rotation.x = Math.PI;
  arrow.position.set(6.5, 3.8, 1);
  scene.add(beam, ring, arrow);
  return { start: new THREE.Vector3(-0.5, 0, doorZ + 0.7), target: new THREE.Vector3(4.6, 0, 1.8), car: g, marker: { beam, ring, arrow } };
}
