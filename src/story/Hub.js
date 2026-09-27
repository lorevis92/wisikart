import * as THREE from 'three';
import { Assets } from '../core/AssetLoader.js';
import * as T from '../core/Textures.js';
import { trackById } from '../config/tracks.js';
import { Player } from './Player.js';
import { loadRigged, riggedUrl } from './Rig.js';

// Movimento nella piazza
const SPEED = 7.5;
const ACC = 40;
const GRAV = 32;
const JUMP_V = 12;
const R_PLAYER = 0.45;
const STEP = 0.35; // gradino che si sale camminando

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Piazza 3D di un pianeta della Storia: Whiskey la attraversa a piedi (telecamera in terza persona)
 * e ogni ingresso si attiva avvicinandosi, senza menu.
 * onEnter(entrance) viene chiamato per i livelli giocabili; i messaggi "chiuso" / "in arrivo" li gestisce la piazza.
 */
export class Hub {
  constructor({ world, character, audio, completed = {}, spawnAt = null, onEnter }) {
    this.world = world;
    this.character = character;
    this.audio = audio;
    this.completed = completed;
    this.spawnAt = spawnAt;
    this.onEnter = onEnter;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 600);
    this.pal = trackById.niaboc.palette;
    this.circles = [];   // ostacoli cilindrici { x, z, r }
    this.segments = [];  // ostacoli lineari { ax, az, bx, bz, r }
    this.platforms = []; // cilindri su cui si sale { x, z, r, top }
    this.entrances = [];
    this.dynamic = [];
    this.t = 0;
    this.notice = null;
    this.noticeTimer = 0;
    this.entering = null;
  }

  state(e) {
    if (e.kind === 'level') return this.completed[e.id] ? 'done' : 'open';
    if (e.kind === 'gate') return this.completed[e.requires] ? 'open' : 'locked';
    return 'soon';
  }

  // ---------- costruzione ----------
  async load(progress = () => {}) {
    progress('Accendo i lampioni…');
    await this._sky();
    this._lights();
    this._ground();
    this._city();
    this._props();
    progress('Apro i portoni…');
    await Promise.all(this.world.entrances.map((e) => this._entrance(e)));
    progress('Whiskey scende in piazza…');
    const rigged = await loadRigged(riggedUrl(this.character), 1.8);
    this.avatar = new Player(this.character, rigged);
    this.avatarRoot = new THREE.Group();
    this.avatarRoot.add(this.avatar.group);
    this.scene.add(this.avatarRoot);
    this._spawn();
    progress('Pronti.');
  }

  async _sky() {
    let tex = await Assets.texture(this.world.sky, { equirect: true });
    if (!tex) tex = T.skyGradientTexture('#05061a', '#1a1a4a', '#3a2a5a', true, true);
    this.scene.background = tex;
    this.scene.environment = tex;
    this.scene.environmentIntensity = 0.15; // notte: il cielo non deve illuminare tutto di grigio
    this.scene.fog = new THREE.Fog(this.pal.fog, 70, 190);
  }

  _lights() {
    this.scene.add(new THREE.HemisphereLight(new THREE.Color(this.pal.ambient), new THREE.Color(this.pal.ground), 0.45));
    // la luna grande, rosa: fa ombre nette sulla piazza
    const moon = new THREE.DirectionalLight(new THREE.Color(this.pal.sun), 1.9);
    moon.position.set(40, 60, -30);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const c = moon.shadow.camera;
    c.left = c.bottom = -45; c.right = c.top = 45; c.near = 10; c.far = 160;
    moon.shadow.bias = -0.0008;
    this.scene.add(moon, moon.target);
  }

  _ground() {
    const R = this.world.radius;
    // piastrelle della piazza
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#2a2c44';
    g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 2 ? '#2f3150' : '#26283e';
      g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
    }
    const tiles = new THREE.CanvasTexture(c);
    tiles.colorSpace = THREE.SRGBColorSpace;
    tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
    tiles.repeat.set(R / 2, R / 2);
    tiles.anisotropy = 8;
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(R + 2, 72), std('#ffffff', { map: tiles, roughness: 0.6, metalness: 0.1 }));
    plaza.rotation.x = -Math.PI / 2;
    plaza.receiveShadow = true;
    this.scene.add(plaza);
    // asfalto tutto intorno
    const road = T.roadTexture(this.pal.road, this.pal.roadLine);
    road.repeat.set(30, 30);
    const outer = new THREE.Mesh(new THREE.CircleGeometry(260, 64), std('#ffffff', { map: road, roughness: 0.95 }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    outer.receiveShadow = true;
    this.scene.add(outer);
    // anelli al neon ai bordi della piazza, come i cordoli viola e bianchi della pista
    for (const [r, col] of [[R + 2, this.pal.curb[0]], [R + 2.8, this.pal.wallGlow]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 6, 120), new THREE.MeshStandardMaterial({ color: 0x110818, emissive: new THREE.Color(col), emissiveIntensity: 2.2 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.06;
      this.scene.add(ring);
    }
  }

  /** Palazzi di Niaboc sullo sfondo: finestre accese, insegne al neon, luci rosse sui tetti. */
  _city() {
    const winTex = T.windowsTexture('#2a2c44', '#ffd27a', '#1c1d2e');
    const litTex = T.windowsTexture('#000000', '#ffc86a', '#000000');
    const cols = ['#8d8fb0', '#a095b8', '#7f93a8', '#9a8aa0', '#8a86b8'];
    const hues = [0.87, 0.52, 0.78, 0.95, 0.12];
    let n = 0;
    for (let ring = 0; ring < 2; ring++) {
      const count = ring ? 34 : 26;
      for (let i = 0; i < count; i++) {
        n++;
        const a = (i / count) * Math.PI * 2 + ring * 0.09;
        // lascia libere le visuali verso gli ingressi
        const d = 52 + ring * 26 + ((n * 37) % 11);
        const w = 12 + ((n * 13) % 9), h = 16 + ((n * 29) % 38), dp = 12 + ((n * 7) % 8);
        const m = new THREE.MeshStandardMaterial({ color: cols[n % cols.length], map: winTex.clone(), emissive: 0xffffff, emissiveMap: litTex.clone(), emissiveIntensity: 0.85, roughness: 0.8 });
        m.map.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 12)));
        m.emissiveMap.repeat.copy(m.map.repeat);
        m.map.needsUpdate = m.emissiveMap.needsUpdate = true;
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dp), m);
        b.position.set(Math.sin(a) * d, h / 2, -Math.cos(a) * d);
        b.rotation.y = -a;
        b.receiveShadow = true;
        this.scene.add(b);
        if (n % 3 !== 0) {
          const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 1.6, 0.4), new THREE.MeshStandardMaterial({ color: 0x220a22, emissive: new THREE.Color().setHSL(hues[n % hues.length], 0.9, 0.55), emissiveIntensity: 2.6 }));
          sign.position.set(0, h * 0.2, dp / 2 + 0.3);
          b.add(sign);
        }
        if (n % 4 === 0) {
          const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3355 }));
          beacon.position.y = h / 2 + 0.5;
          b.add(beacon);
        }
      }
    }
  }

  /** Fontana al centro (ci si sale con un salto), panchine e lampioni. */
  _props() {
    const R = this.world.radius;
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.7, 0.9, 32), std('#4a4668', { roughness: 0.5 }));
    basin.position.y = 0.45;
    basin.castShadow = basin.receiveShadow = true;
    const water = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.1, 32), new THREE.MeshStandardMaterial({ color: 0x3fa8ff, emissive: 0x1f6ad0, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85 }));
    water.position.y = 0.85;
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 3, 12), new THREE.MeshStandardMaterial({ color: 0x9fe0ff, emissive: 0x3fa8ff, emissiveIntensity: 1.2, transparent: true, opacity: 0.6 }));
    jet.position.y = 2.3;
    this.scene.add(basin, water, jet);
    this.dynamic.push((t) => { jet.scale.y = 1 + Math.sin(t * 3) * 0.12; });
    this.platforms.push({ x: 0, z: 0, r: 3.6, top: 0.9 });
    // lampioni a luce calda in cerchio
    const poleM = std('#2a2a38', { metalness: 0.6, roughness: 0.4 });
    const headM = new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffb45a, emissiveIntensity: 3 });
    const lampCount = 10;
    for (let i = 0; i < lampCount; i++) {
      const a = ((i + 0.5) / lampCount) * Math.PI * 2;
      const x = Math.sin(a) * (R - 3), z = -Math.cos(a) * (R - 3);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 6, 8), poleM);
      pole.position.set(x, 3, z);
      pole.castShadow = true;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), headM);
      head.position.set(x, 6.1, z);
      this.scene.add(pole, head);
      this.circles.push({ x, z, r: 0.3 });
      if (i % 2 === 0) {
        const light = new THREE.PointLight(0xffb45a, 30, 18, 1.8);
        light.position.set(x, 5.6, z);
        this.scene.add(light);
      }
    }
    // panchine lungo il bordo della fontana
    const benchM = std('#6b4a8a');
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = Math.sin(a) * 9, z = -Math.cos(a) * 9;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 0.9), benchM);
      bench.position.set(x, 0.45, z);
      bench.rotation.y = -a;
      bench.castShadow = true;
      this.scene.add(bench);
      this.platforms.push({ x, z, r: 1.2, top: 0.7 });
    }
  }

  async _entrance(e) {
    const a = THREE.MathUtils.degToRad(e.angle);
    const x = Math.sin(a) * e.dist, z = -Math.cos(a) * e.dist;
    const toCenter = new THREE.Vector3(-x, 0, -z).normalize();
    const tangent = new THREE.Vector3(-toCenter.z, 0, toCenter.x);
    const model = await Assets.model(e.model, { targetHeight: e.height });
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = Math.atan2(toCenter.x, toCenter.z); // il davanti (+Z) guarda il centro
    this.scene.add(group);
    let halfW = e.height * 0.5, halfD = e.height * 0.5;
    if (model) {
      model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      group.add(model);
      const box = new THREE.Box3().setFromObject(model);
      halfW = (box.max.x - box.min.x) / 2; halfD = (box.max.z - box.min.z) / 2;
    } else {
      // segnaposto: un blocco o un arco semplice
      const m = std('#4a3f7a', { emissive: 0x2a1a5a, emissiveIntensity: 0.4 });
      if (e.arch) {
        for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, e.height, 1.4), m); p.position.set(s * e.height * 0.35, e.height / 2, 0); group.add(p); }
        const top = new THREE.Mesh(new THREE.BoxGeometry(e.height * 0.84, 1.2, 1.4), m); top.position.y = e.height - 0.6; group.add(top);
        halfW = e.height * 0.42; halfD = 0.7;
      } else {
        const b = new THREE.Mesh(new THREE.BoxGeometry(e.height, e.height * 0.8, e.height), m); b.position.y = e.height * 0.4; group.add(b);
      }
    }
    const entrance = { ...e, x, z, group, toCenter, tangent, armed: true };
    if (e.arch) {
      // si attraversa: due piloni come ostacolo, l'ingresso è nel vano
      const span = halfW * 0.82;
      // archi profondi (un passaggio più che un arco): pareti ripetute lungo tutta la profondità
      const depths = halfD > 2 ? [-halfD * 0.75, -halfD * 0.25, halfD * 0.25, halfD * 0.75] : [0];
      for (const dd of depths) for (const s of [-1, 1]) {
        this.circles.push({ x: x + tangent.x * span * s + toCenter.x * dd, z: z + tangent.z * span * s + toCenter.z * dd, r: Math.max(0.8, halfW * 0.16) });
      }
      entrance.door = { x, z, r: Math.min(2.6, halfW * 0.55) };
    } else {
      // edificio: blocca con un cerchio, la porta è sul davanti
      const r = ((halfW + halfD) / 2) * 0.9;
      this.circles.push({ x, z, r });
      const front = r + 1.4;
      entrance.door = { x: x + toCenter.x * front, z: z + toCenter.z * front, r: 2.4 };
    }
    // cerchio luminoso davanti all'ingresso, colorato secondo lo stato
    const colors = { open: 0xf5b942, done: 0x43e0b0, soon: 0x7fa4ff, locked: 0x8a8fa8 };
    const st = this.state(e);
    const ring = new THREE.Mesh(new THREE.RingGeometry(entrance.door.r * 0.75, entrance.door.r, 40), new THREE.MeshBasicMaterial({ color: colors[st], transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(entrance.door.x, 0.05, entrance.door.z);
    this.scene.add(ring);
    this.dynamic.push((t) => { ring.material.opacity = 0.45 + Math.sin(t * 3 + e.angle) * 0.25; });
    // portale chiuso: barriera di energia nel vano, che blocca il passaggio
    if (st === 'locked') {
      const w = halfW * 1.5, h = e.height * 0.75;
      const barrier = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xff3a7a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      barrier.position.set(0, h / 2, 0);
      group.add(barrier);
      this.dynamic.push((t) => { barrier.material.opacity = 0.25 + Math.sin(t * 5) * 0.1; });
      const hw = w / 2;
      this.segments.push({ ax: x - tangent.x * hw, az: z - tangent.z * hw, bx: x + tangent.x * hw, bz: z + tangent.z * hw, r: 0.5 });
      // il messaggio "chiuso" scatta avvicinandosi alla barriera dal lato della piazza
      entrance.door = { x: x + toCenter.x * 1.6, z: z + toCenter.z * 1.6, r: 2.2 };
      ring.position.set(entrance.door.x, 0.05, entrance.door.z);
    }
    this.entrances.push(entrance);
  }

  _spawn() {
    const w = this.world;
    const e = this.spawnAt && this.entrances.find((x) => x.id === this.spawnAt);
    if (e) {
      // appena usciti dall'ingresso, rivolti verso la piazza
      this.pos = new THREE.Vector3(e.door.x + e.toCenter.x * 3.5, 0, e.door.z + e.toCenter.z * 3.5);
      this.heading = Math.atan2(e.toCenter.x, e.toCenter.z);
      e.armed = false;
    } else {
      this.pos = new THREE.Vector3(w.spawn.x, 0, w.spawn.z);
      this.heading = w.spawn.heading;
    }
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.onGround = true;
    this.camYaw = this.heading + Math.PI;
    this._placeCamera(1);
  }

  // ---------- gioco ----------
  say(text, time = 3) { this.notice = text; this.noticeTimer = time; }

  update(dt, input) {
    this.t += dt;
    for (const d of this.dynamic) d(this.t);
    this.noticeTimer = Math.max(0, this.noticeTimer - dt);
    if (this.noticeTimer <= 0) this.notice = null;
    if (this.entering) {
      // breve pausa prima di caricare il livello
      this.entering.t -= dt;
      this._animate(dt, 0);
      this._placeCamera(dt);
      if (this.entering.t <= 0) { const e = this.entering.e; this.entering = null; this.onEnter && this.onEnter(e); }
      return;
    }

    // ---- movimento relativo alla telecamera ----
    const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3().addScaledVector(fwd, input.axisY).addScaledVector(right, input.axisX);
    if (wish.lengthSq() > 1) wish.normalize();
    const target = wish.clone().multiplyScalar(SPEED);
    const acc = this.onGround ? ACC : ACC * 0.5;
    this.vel.x = moveTo(this.vel.x, target.x, acc * dt);
    this.vel.z = moveTo(this.vel.z, target.z, acc * dt);
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (wish.lengthSq() > 0.01) {
      const want = Math.atan2(wish.x, wish.z);
      this.heading += wrapAngle(want - this.heading) * Math.min(1, dt * 12);
    }
    // salto
    if (input.jumpPressed && this.onGround) { this.vy = JUMP_V; this.onGround = false; this.audio.sfx('jump'); }
    input.jumpPressed = input.upPressed = input.itemPressed = false;
    if (!input.jumpHeld && this.vy > 0) this.vy -= GRAV * 1.2 * dt;
    this.vy -= GRAV * dt;

    // ---- spostamento e collisioni ----
    const prevY = this.pos.y;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vy * dt;
    this._collide();
    const ground = this._groundAt(this.pos.x, this.pos.z, Math.max(prevY, this.pos.y));
    const wasGround = this.onGround;
    if (this.pos.y <= ground) {
      this.pos.y = ground;
      this.vy = 0;
      this.onGround = true;
      if (!wasGround) this.avatar.squash = 1;
    } else if (this.pos.y > ground + 0.05) this.onGround = false;

    // ---- telecamera: segue alle spalle con calma; Q/E per girarla ----
    const manual = (input.keys.has('KeyQ') ? 1 : 0) - (input.keys.has('KeyE') ? 1 : 0);
    if (manual) this.camYaw += manual * dt * 2.2;
    else if (speed > 1 && input.axisY >= -0.2) this.camYaw += wrapAngle(this.heading + Math.PI - this.camYaw) * Math.min(1, dt * 1.6 * Math.min(1, speed / SPEED));
    this._placeCamera(dt);

    this._animate(dt, speed);
    this._doors();
  }

  _collide() {
    const p = this.pos;
    const push = (cx, cz, r) => {
      const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz), min = r + R_PLAYER;
      if (d < min && d > 1e-4) { p.x = cx + (dx / d) * min; p.z = cz + (dz / d) * min; }
    };
    for (const c of this.circles) push(c.x, c.z, c.r);
    for (const s of this.segments) {
      const vx = s.bx - s.ax, vz = s.bz - s.az;
      const t = THREE.MathUtils.clamp(((p.x - s.ax) * vx + (p.z - s.az) * vz) / (vx * vx + vz * vz), 0, 1);
      push(s.ax + vx * t, s.az + vz * t, s.r);
    }
    // piattaforme: di fianco sono ostacoli, da sopra ci si sta
    for (const pl of this.platforms) if (p.y < pl.top - STEP) push(pl.x, pl.z, pl.r);
    // bordo della piazza
    const d = Math.hypot(p.x, p.z), max = this.world.radius + 1.2;
    if (d > max) { p.x *= max / d; p.z *= max / d; }
  }

  _groundAt(x, z, y) {
    let g = 0;
    for (const pl of this.platforms) if (Math.hypot(x - pl.x, z - pl.z) < pl.r && y >= pl.top - STEP) g = Math.max(g, pl.top);
    return g;
  }

  /** Ingressi: si entra camminandoci dentro; per rientrare bisogna prima allontanarsi. */
  _doors() {
    let near = null, nearD = Infinity;
    for (const e of this.entrances) {
      const d = Math.hypot(this.pos.x - e.door.x, this.pos.z - e.door.z);
      if (d < nearD) { nearD = d; near = e; }
      if (!e.armed) { if (d > e.door.r + 1.5) e.armed = true; continue; }
      if (d > e.door.r) continue;
      e.armed = false;
      const st = this.state(e);
      if (e.kind === 'level') {
        this.audio.sfx('select');
        this.say(`${e.name}…`, 1.5);
        this.entering = { e, t: 0.7 };
        this.vel.set(0, 0, 0);
      } else {
        this.audio.sfx(st === 'locked' ? 'back' : 'select');
        this.say(st === 'locked' ? e.locked : e.soon, 3.5);
      }
    }
    this.prompt = near && nearD < near.door.r + 6 ? { name: near.name, state: this.state(near) } : null;
  }

  _animate(dt, speed) {
    const a = this.avatar;
    a.vx = speed; a.vy = this.vy; a.onGround = this.onGround;
    if (this.onGround) a.walkPhase += speed * dt * 1.6;
    a._pose(dt);
    a.group.position.set(0, 0, 0);
    a.root.rotation.y = 0;
    this.avatarRoot.position.copy(this.pos);
    this.avatarRoot.rotation.y = this.heading;
  }

  _placeCamera(dt) {
    const dist = 8.5, height = 3.6;
    const target = new THREE.Vector3(this.pos.x + Math.sin(this.camYaw) * dist, this.pos.y + height, this.pos.z + Math.cos(this.camYaw) * dist);
    const k = dt >= 1 ? 1 : Math.min(1, dt * 8);
    this.camera.position.lerp(target, k);
    this.camera.lookAt(this.pos.x, this.pos.y + 1.4, this.pos.z);
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  hud() {
    return { world: this.world.name, subtitle: this.world.subtitle, prompt: this.prompt, notice: this.notice };
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    this.scene.environment = null;
  }
}

function moveTo(v, target, step) {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}
