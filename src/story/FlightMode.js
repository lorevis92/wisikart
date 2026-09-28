import * as THREE from 'three';
import { Assets } from '../core/AssetLoader.js';
import { Track } from '../track/Track.js';
import { trackById } from '../config/tracks.js';

// Livello di volo della Storia (il primo è il Portale, story/portale.js): si pilota Emma sul circuito di
// WisiKart. Stessa interfaccia di StoryMode (load → update/render → hud → dispose), così main.js li tratta
// allo stesso modo. Dalla guida del kart riusa la pista (Track: campioni, proiezione, bordi) e lo schema di
// sterzo (heading, avanti = (sin h, cos h)); in più si vola: quota su e giù, e si spara.
// Tempo: il timer parte corto e cresce con gli anelli (catena = bonus più alto). Vedi portale.js.

const _v = new THREE.Vector3();
const _f = new THREE.Vector3();
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra });

const TURN = 1.7; // rad/s di sterzo a piena velocità
const ACC = 16, BRAKE = 34;
const CLIMB = 8.5; // m/s in quota
const ALT_MIN = 1.1, ALT_MAX = 15;
const RING_R = 3.4;
const R_HIT = 2.4; // urto con una navicella della pattuglia
const R_NEAR = 4.6; // sotto questa distanza, passando, è una "sfiorata"
const TRAIL = 40; // punti della scia luminosa

/** Emma parla una battuta alla volta: quelle importanti aspettano il loro turno, le altre si saltano. */
class EmmaVoice {
  constructor(audio, lines) {
    this.audio = audio;
    this.lines = lines;
    this.buffers = {};
    this.busyUntil = 0;
    this.queue = null;
    this.subtitle = null;
    this.subUntil = 0;
    this.t = 0;
  }

  async load() {
    const ctx = this.audio.ctx;
    await Promise.all(Object.entries(this.lines).map(async ([k, l]) => { this.buffers[k] = ctx ? await Assets.audioBuffer(ctx, l.url) : null; }));
  }

  say(key, { important = false } = {}) {
    if (!this.lines[key]) return false;
    if (this.t < this.busyUntil) {
      if (important) this.queue = key; // la più recente tra le importanti
      return false;
    }
    const dur = this.audio.voiceBuffer ? this.audio.voiceBuffer(this.buffers[key]) : 0;
    const len = dur || 2.4; // senza audio resta il sottotitolo
    this.busyUntil = this.t + len + 0.25;
    this.subtitle = `Emma: «${this.lines[key].text}»`;
    this.subUntil = this.t + len + 0.6;
    return true;
  }

  /** Interrompe la coda (per le battute di fine giro). */
  clear() { this.queue = null; this.busyUntil = 0; }

  update(dt) {
    this.t += dt;
    if (this.queue && this.t >= this.busyUntil) { const k = this.queue; this.queue = null; this.say(k); }
    if (this.t > this.subUntil) this.subtitle = null;
  }
}

export class FlightMode {
  constructor({ level, audio, coins = 0, onCoins, onComplete, onGameOver }) {
    this.level = level;
    this.audio = audio;
    this.coins = coins;
    this.onCoins = onCoins;
    this.onComplete = onComplete;
    this.onGameOver = onGameOver;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.4, 2400);
    this.t = 0;
    this.state = 'play'; // play | portal | won | late | ended
    this.stateTimer = 0;
    this.notice = null;
    this.noticeTimer = 0;
    this.bullets = [];
    this.blocks = [];
    this.bursts = [];
    this.shake = 0;
  }

  // ---------- costruzione ----------
  async load(progress = () => {}) {
    const L = this.level;
    progress('Scaldo i motori…');
    // il circuito di WisiKart, senza scatole, pad e senza il portale a metà giro (qui il portale è l'arrivo)
    const def = trackById[L.track];
    const trackDef = { ...def, itemBoxes: [], boostPads: [], props: (def.props || []).filter((p) => p.model !== 'portale-niaboc') };
    this.track = new Track(trackDef, this.scene, null);
    await this.track.build();
    const tr = this.track;
    this.N = tr.N;
    this.step = tr.length / tr.N;
    this.startIdx = tr.idxFromT(def.startT);
    this.endProg = this._progOfT(L.endT);
    progress('Chiamo la pattuglia…');
    const [ship, patrol, portal] = await Promise.all([
      Assets.model(L.model.url, { targetHeight: L.model.h }),
      Assets.model(L.patrolModel.url, { targetHeight: L.patrolModel.h }),
      Assets.model(L.portalModel.url, { targetHeight: L.portalModel.h })
    ]);
    this.emma = new EmmaVoice(this.audio, L.voices);
    await this.emma.load();
    this._buildShip(ship);
    this._buildTrail();
    this._buildRings();
    this._buildBarriers();
    this._buildTunnel();
    this._buildBridge();
    this._findDive();
    this._buildPortal(portal);
    this.patrolProto = patrol;
    this._buildPatrols();
    this.restart(true);
    progress('Pronti.');
  }

  /** Avanzamento (in campioni) dalla linea di partenza. */
  _prog(idx) { return (idx - this.startIdx + this.N) % this.N; }
  _progOfT(t) { return this._prog(this.track.idxFromT(t)); }

  /** Punto sulla pista a un avanzamento (float), con scostamento laterale e quota. */
  _point(prog, lat, alt, out = new THREE.Vector3()) {
    const N = this.N, S = this.track.samples;
    const i = Math.floor(prog), f = prog - i;
    const a = S[(this.startIdx + i) % N], b = S[(this.startIdx + i + 1) % N];
    out.copy(a.pos).lerp(b.pos, f).addScaledVector(a.right, lat);
    out.y += alt;
    return out;
  }

  _sample(prog) { return this.track.samples[(this.startIdx + Math.floor(((prog % this.N) + this.N) % this.N)) % this.N]; }

  _buildShip(model) {
    this.ship = new THREE.Group();
    this.shipBody = new THREE.Group();
    this.ship.add(this.shipBody);
    if (model) {
      model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.shipBody.add(model);
    } else {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 1.6, 6, 14), std('#d99a2b', { metalness: 0.4 }));
      body.rotation.x = Math.PI / 2;
      body.position.y = 0.9;
      body.castShadow = true;
      this.shipBody.add(body);
    }
    this.shipBody.position.y = -1.0; // il punto di riferimento è al centro della navicella
    this.trails = [];
    for (const s of [-1, 1]) {
      const tr = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.4, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0x6fd8ff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
      tr.rotation.x = -Math.PI / 2;
      tr.position.set(s * 0.6, -0.4, -1.6);
      this.ship.add(tr);
      this.trails.push(tr);
    }
    this.scene.add(this.ship);
  }

  /** Scia luminosa dietro Emma: un nastro che segue gli ultimi punti percorsi e sfuma. */
  _buildTrail() {
    const g = new THREE.BufferGeometry();
    this.trailPos = new Float32Array(TRAIL * 2 * 3);
    const colors = new Float32Array(TRAIL * 2 * 3);
    for (let i = 0; i < TRAIL; i++) {
      const k = 1 - i / TRAIL;
      for (const j of [0, 1]) colors.set([0.4 * k, 0.85 * k, 1.0 * k], (i * 2 + j) * 3);
    }
    const idx = [];
    for (let i = 0; i < TRAIL - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setIndex(idx);
    this.trailMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.trailMesh.frustumCulled = false;
    this.trailPts = [];
    this.scene.add(this.trailMesh);
  }

  _ringMesh(color, gold = false) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x110818, emissive: color, emissiveIntensity: 2.6, metalness: gold ? 0.8 : 0 });
    const torus = new THREE.Mesh(new THREE.TorusGeometry(gold ? RING_R * 0.8 : RING_R, gold ? 0.36 : 0.28, 10, 40), mat);
    const disc = new THREE.Mesh(new THREE.CircleGeometry((gold ? RING_R * 0.8 : RING_R) - 0.2, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    g.add(torus, disc);
    if (gold) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshStandardMaterial({ color: 0xfff2a8, emissive: 0xffc040, emissiveIntensity: 1.5 }));
      g.add(star);
      g.userData.star = star;
    }
    return { g, mat, disc };
  }

  _buildRings() {
    const L = this.level;
    const all = [
      ...L.rings.map((r, i) => ({ ...r, gold: false, color: i % 2 ? 0x3fe8ff : 0xff4fc8 })),
      ...(L.goldRings || []).map((r) => ({ ...r, gold: true, color: 0xf5b942 }))
    ];
    this.rings = all.map((r) => {
      const prog = this._progOfT(r.t);
      const s = this._sample(prog);
      const { g, mat, disc } = this._ringMesh(r.color, r.gold);
      const c = this._point(prog, r.lat, r.alt);
      g.position.copy(c);
      g.lookAt(_v.copy(c).add(s.tangent)); // il cerchio guarda lungo la pista
      this.scene.add(g);
      return { ...r, prog, center: c.clone(), group: g, mat, disc, radius: r.gold ? RING_R * 0.8 : RING_R, state: 'wait' };
    }).sort((a, b) => a.prog - b.prog);
    this.normalRings = this.rings.filter((r) => !r.gold).length;
  }

  _stripes(color, rx, ry) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = color; x.fillRect(0, 0, 64, 64);
    x.fillStyle = 'rgba(255,220,240,0.9)'; for (let i = 0; i < 64; i += 16) x.fillRect(0, i, 64, 3);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    return t;
  }

  _buildBarriers() {
    const hw = this.track.halfW + 2.5;
    this.barriers = this.level.barriers.map((b) => {
      const prog = this._progOfT(b.t);
      const s = this._sample(prog);
      const h = b.a1 - b.a0;
      const g = new THREE.Group();
      const tex = this._stripes('rgba(255,40,90,0.5)', hw / 3, h / 3);
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      wall.position.y = b.a0 + h / 2;
      g.add(wall);
      // bordi luminosi: dicono dove finisce la barriera (sopra o sotto si passa)
      for (const y of [b.a0, b.a1]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 1, 0.25, 0.25), new THREE.MeshStandardMaterial({ color: 0x220010, emissive: 0xff2a6a, emissiveIntensity: 3 }));
        bar.position.y = y;
        g.add(bar);
      }
      const base = this._point(prog, 0, 0);
      g.position.copy(base);
      g.lookAt(_v.copy(base).add(s.tangent));
      this.scene.add(g);
      return { ...b, prog, group: g, tex, done: false, kind: 'barrier' };
    });
  }

  /** Capannone buio sopra un tratto di pista: volta con luci al neon; dentro la quota ha un soffitto. */
  _buildTunnel() {
    const T = this.level.tunnel;
    if (!T) { this.tunnel = null; return; }
    const p0 = this._progOfT(T.from), p1 = this._progOfT(T.to), R = T.radius;
    const SEG = 18, rows = Math.max(2, Math.round(p1 - p0));
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= rows; i++) {
      const prog = p0 + i;
      const s = this._sample(prog);
      for (let j = 0; j <= SEG; j++) {
        const a = (j / SEG) * Math.PI;
        const p = this._point(prog, Math.cos(a) * R, Math.sin(a) * R * 0.8);
        pos.push(p.x, p.y, p.z);
        uv.push(j / SEG * 6, i / 4);
        if (i < rows && j < SEG) { const k = i * (SEG + 1) + j; idx.push(k, k + SEG + 1, k + 1, k + 1, k + SEG + 1, k + SEG + 2); }
      }
      // archi al neon ogni ~12 m, rosa e ciano
      if (i % 4 === 0) {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(R - 0.4, 0.14, 6, 30, Math.PI), new THREE.MeshStandardMaterial({ color: 0x110818, emissive: i % 8 ? 0x3fe8ff : 0xff4fc8, emissiveIntensity: 2.8 }));
        const c = this._point(prog, 0, 0);
        arc.position.copy(c);
        arc.scale.set(1, 0.8, 1);
        arc.lookAt(_v.copy(c).add(s.tangent));
        this.scene.add(arc);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const shell = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x14142a, roughness: 0.9, metalness: 0.2, side: THREE.DoubleSide }));
    shell.castShadow = true; // fa buio sulla strada
    shell.receiveShadow = true;
    this.scene.add(shell);
    this.tunnel = { p0, p1, R };
  }

  /** Soffitto della volta a un dato scostamento laterale (con margine per la navicella). */
  _tunnelCeil(lat) {
    const R = this.tunnel.R;
    const h = Math.sqrt(Math.max(0, R * R - lat * lat)) * 0.8;
    return Math.max(ALT_MIN + 0.4, h - 1.6);
  }

  _inTunnel() { return this.tunnel && this.prog >= this.tunnel.p0 && this.prog <= this.tunnel.p1; }

  /** Ponte basso che scavalca la pista: un'altra fascia di quota da evitare (sotto o sopra). */
  _buildBridge() {
    const B = this.level.bridge;
    if (!B) return;
    const prog = this._progOfT(B.t);
    const s = this._sample(prog);
    const w = (this.track.wallDist + 6) * 2;
    const g = new THREE.Group();
    const concrete = std('#5a5f70', { roughness: 0.9 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(w, B.a1 - B.a0, 5), concrete);
    deck.position.y = (B.a0 + B.a1) / 2;
    deck.castShadow = true;
    g.add(deck);
    for (const x of [-w / 2 + 1.5, w / 2 - 1.5]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(2, B.a0, 3), concrete);
      pillar.position.set(x, B.a0 / 2, 0);
      g.add(pillar);
    }
    const neon = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.3, 0.2), new THREE.MeshStandardMaterial({ color: 0x110818, emissive: 0xff4fc8, emissiveIntensity: 3 }));
    neon.position.set(0, B.a0 + 0.2, 2.6);
    g.add(neon);
    const base = this._point(prog, 0, 0);
    g.position.copy(base);
    g.lookAt(_v.copy(base).add(s.tangent)); // +Z lungo la pista: il ponte (asse X) la scavalca di traverso
    this.scene.add(g);
    this.barriers.push({ ...B, prog, group: g, done: false, kind: 'bridge' });
    this.barriers.sort((a, b) => a.prog - b.prog);
  }

  /** La picchiata: il tratto in discesa più ripido del giro, dove la telecamera si inclina in avanti. */
  _findDive() {
    let best = 0, bestP = -1;
    for (let p = 30; p < this.endProg - 30; p++) {
      const s0 = this._sample(p), s1 = this._sample(p + 25);
      const drop = (s0.pos.y - s1.pos.y) / (25 * this.step);
      if (drop > best) { best = drop; bestP = p; }
    }
    this.dive = bestP >= 0 ? { p0: bestP - 10, p1: bestP + 35, slope: best } : null;
  }

  _buildPortal(model) {
    const prog = this.endProg;
    const s = this._sample(prog);
    const g = new THREE.Group();
    if (model) {
      model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.add(model);
    } else {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(16, 1, 12, 48, Math.PI), std('#2b2d45', { emissive: 0xff4fc8, emissiveIntensity: 0.6 }));
      g.add(arch);
    }
    this.portalDisc = new THREE.Mesh(new THREE.CircleGeometry(13, 48), new THREE.MeshBasicMaterial({ color: 0xff7ae0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.portalDisc.position.y = 11;
    g.add(this.portalDisc);
    const base = this._point(prog, 0, 0);
    g.position.copy(base);
    g.lookAt(_v.copy(base).add(s.tangent));
    this.scene.add(g);
    this.portal = g;
  }

  _patrolMesh(leader) {
    const g = new THREE.Group();
    if (this.patrolProto) {
      const m = this.patrolProto.clone(true);
      m.rotation.y = Math.PI / 2; // il modello ha il muso verso -X: lo giro verso +Z
      m.position.y = -1;
      m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.add(m);
    } else {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 1.8, 6, 12), std(leader ? '#1d2a55' : '#2f6bd9', { metalness: 0.5 }));
      body.rotation.x = Math.PI / 2;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 2.6), std('#f2f0ff'));
      g.add(body, stripe);
    }
    if (leader) g.scale.setScalar(1.4); // il caposquadra è più grosso
    // lampeggianti: blu e rossi per le gregarie, bianchi e rossi per il caposquadra; ambra per la tenaglia
    const mk = (c) => new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: c }));
    const a = mk(leader ? 0xffffff : 0x2a6aff), b = mk(0xff2a3a);
    a.position.set(-0.35, 0.6, 0); b.position.set(0.35, 0.6, 0);
    const amberL = mk(0xffb020), amberR = mk(0xffb020);
    amberL.position.set(-1.1, 0, 0); amberR.position.set(1.1, 0, 0);
    amberL.visible = amberR.visible = false;
    g.add(a, b, amberL, amberR);
    // riflettore puntato sulla pista davanti: illumina e proietta ombre (quella del caposquadra)
    const spot = new THREE.SpotLight(leader ? 0xfff4e0 : 0xcfe0ff, leader ? 70 : 40, 40, 0.42, 0.5, 1.2);
    spot.position.set(0, -0.3, 0.8);
    spot.target.position.set(0, -6, 12);
    spot.castShadow = leader;
    if (leader) spot.shadow.mapSize.set(512, 512);
    g.add(spot, spot.target);
    g.userData = { lights: [a, b], amber: [amberL, amberR], spot };
    return g;
  }

  _buildPatrols() {
    this.patrols = this.level.patrols.map((p) => {
      const g = this._patrolMesh(!!p.leader);
      this.scene.add(g);
      return { def: p, leader: !!p.leader, group: g, prog: 0, lat: 0, alt: 0, stun: 0, vlat: 0, fireCool: 2, flash: 0, minD: 99, passed: false };
    });
    this.leader = this.patrols.find((p) => p.leader);
    this.wings = this.patrols.filter((p) => !p.leader);
  }

  /** Nuovo giro da capo (all'inizio e dopo il gong). */
  restart(first = false) {
    const L = this.level;
    this.prog = 0;
    this.lat = 0;
    this.alt = 3;
    this.heading = Math.atan2(this._sample(0).tangent.x, this._sample(0).tangent.z);
    this.speed = first ? 0 : 20;
    this.timer = L.time;
    this.elapsed = 0;
    this.hitCool = 0;
    this.nearCool = 0;
    this.shootCool = 0;
    this.nextRing = 0;
    this.ringsTaken = 0;
    this.goldTaken = 0;
    this.chain = 0;
    this.bestChain = 0;
    this.coinsHere = 0;
    this.ringVariant = 0;
    this.turbo = 0;
    this.saidGong = this.saidTen = this.saidPortal = this.saidBarrier = this.saidLeader = false;
    this.patrolVoiceCool = 6;
    this.pincer = { state: 'idle', t: 0, cool: 6 };
    this.overtook = false;
    this.heartbeat = 0;
    this.gain = null;
    this.callout = null;
    this.flashAt = 0;
    this.pos = this._point(0, 0, 0).clone();
    this.pos.y += this.alt;
    this.idx = this.startIdx;
    this.trailPts = [];
    for (const r of this.rings) { r.state = 'wait'; r.group.visible = true; r.group.scale.setScalar(1); r.mat.emissiveIntensity = 2.6; r.mat.emissive.set(r.color); r.disc.material.opacity = 0.12; }
    for (const b of this.barriers) b.done = false;
    for (const p of this.patrols) {
      p.prog = this._progOfT(p.def.t); p.lat = p.def.lat; p.alt = p.def.alt; p.stun = 0; p.vlat = 0; p.fireCool = 2; p.flash = 0; p.minD = 99; p.passed = false;
    }
    for (const b of this.bullets) this.scene.remove(b.mesh);
    for (const b of this.blocks) this.scene.remove(b.mesh);
    this.bullets = [];
    this.blocks = [];
    this.state = 'play';
    this.emma.say('start', { important: true });
    this.audio.playTheme(L.music);
    this.audio.setTempo && this.audio.setTempo(1);
    this._placeCamera(1);
  }

  say(text, time = 2) { this.notice = text; this.noticeTimer = time; }
  _callout(text, time = 1.2) { this.callout = { text, until: this.t + time, key: this.t }; }
  _gain(sec) { this.gain = { text: `+${sec % 1 ? sec.toFixed(1).replace('.', ',') : sec}`, until: this.t + 1.2, key: this.t }; }

  _addTime(sec) { this.timer += sec; this._gain(sec); }

  _penalty(sec) {
    this.timer = Math.max(0, this.timer - sec);
    this.shake = Math.max(this.shake, 0.6);
  }

  _addCoins(n) {
    const before = this.coins;
    this.coins += n;
    this.coinsHere += n;
    const lives = Math.floor(this.coins / 100) - Math.floor(before / 100);
    if (lives > 0) this._callout('100 monete: una vita in più!', 1.8); // vale nel prossimo livello a piedi
    if (this.onCoins) this.onCoins(this.coins, lives);
  }

  // ---------- gioco ----------
  update(dt, input) {
    this.t += dt;
    this.emma.update(dt);
    this.noticeTimer = Math.max(0, this.noticeTimer - dt);
    if (this.noticeTimer <= 0) this.notice = null;
    if (this.gain && this.t > this.gain.until) this.gain = null;
    if (this.callout && this.t > this.callout.until) this.callout = null;
    this.track.update(dt, this.t, this.pos);
    this.portalDisc.material.opacity = 0.28 + Math.sin(this.t * 3) * 0.1;
    this.portalDisc.rotation.z += dt * 0.5;
    this._animateProps(dt);

    if (this.state !== 'play') {
      this.stateTimer -= dt;
      this._move(dt, { ax: 0, ay: 0, brake: false });
      this._placeCamera(dt);
      if (this.stateTimer <= 0) {
        if (this.state === 'portal') this._win();
        else if (this.state === 'won') { this.state = 'ended'; this.onComplete && this.onComplete(this.result); }
        else if (this.state === 'late') this.restart();
      }
      return;
    }

    const ctl = { ax: input.axisX, ay: input.axisY, brake: input.brakeHeld };
    input.jumpPressed = input.upPressed = input.itemPressed = false;
    this.elapsed += dt;
    this._move(dt, ctl);

    // sparo: spazio (tenuto = raffica)
    this.shootCool -= dt;
    if (input.jumpHeld && this.shootCool <= 0) { this.shootCool = 0.22; this._shoot(); }
    this._bullets(dt);
    this._patrols(dt);
    this._blocks(dt);
    this._checkpoints();

    // gong
    this.timer -= dt;
    // "manca poco al gong": a metà giro, se il margine è stretto
    if (!this.saidGong && this.prog > this.endProg * 0.5 && this.timer < 8) { this.saidGong = true; this.emma.say('gong'); }
    this._finale(dt);
    if (!this.saidPortal && this.endProg - this.prog < 130 / this.step) { this.saidPortal = true; this.emma.say('portal', { important: true }); }
    if (this.prog >= this.endProg && this.prog < this.endProg + 60) return this._enterPortal();
    if (this.timer <= 0) return this._late();
    this._placeCamera(dt);
  }

  /** Nel tratto finale (≈ ultimi 10 s di volo prima del portale). Il timer è quasi sempre basso: non basta quello. */
  _lastStretch() { return (this.endProg - this.prog) * this.step < Math.max(320, this.speed * 10); }

  /** Ultimi 10 secondi: bordo rosso, gong che batte come un cuore, musica che accelera. */
  _finale(dt) {
    const tense = this.timer < 10 && this._lastStretch();
    if (!tense) { if (this.audio.tempo !== 1 && this.audio.setTempo) this.audio.setTempo(1); return; }
    if (!this.saidTen) { this.saidTen = true; this.emma.say('ten', { important: true }); }
    if (this.audio.setTempo) this.audio.setTempo(1 + (10 - this.timer) * 0.035);
    this.heartbeat -= dt;
    if (this.heartbeat <= 0) { this.heartbeat = 0.45 + this.timer * 0.05; this.audio.sfx('gong'); }
  }

  _move(dt, ctl) {
    const L = this.level, tr = this.track;
    this.turbo = Math.max(0, this.turbo - dt);
    const top = L.maxSpeed * (this.turbo > 0 ? L.turbo.mult : 1) * (this._inDive() ? 1.12 : 1);
    const target = ctl.brake ? L.brakeSpeed : top;
    if (this.speed < target) this.speed = Math.min(target, this.speed + ACC * (this.turbo > 0 ? 2.5 : 1) * dt);
    else this.speed = Math.max(target, this.speed - (ctl.brake ? BRAKE : ACC) * dt);
    // sterzo come nel kart: heading diminuisce con lo sterzo a destra
    const sf = Math.min(1, this.speed / 14);
    this.heading -= ctl.ax * TURN * sf * dt;
    let maxAlt = ALT_MAX;
    if (this._inTunnel()) maxAlt = this._tunnelCeil(this.lat);
    this.alt = THREE.MathUtils.clamp(this.alt + ctl.ay * CLIMB * dt, ALT_MIN, Math.max(ALT_MIN, maxAlt));
    _f.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.pos.addScaledVector(_f, this.speed * dt);
    const pr = tr.project(this.pos, this.idx);
    this.idx = pr.idx;
    this.lat = pr.lateral;
    // bordi della pista (i guardrail del kart): si striscia, rallentando
    const wall = tr.wallDist - 1;
    if (Math.abs(pr.lateral) > wall) {
      const side = Math.sign(pr.lateral);
      this.pos.addScaledVector(pr.right, -side * (Math.abs(pr.lateral) - wall + 0.05));
      const tHeading = Math.atan2(pr.tangent.x, pr.tangent.z);
      const diff = Math.atan2(Math.sin(tHeading - this.heading), Math.cos(tHeading - this.heading));
      if (Math.sin(diff) * side > 0.05) { this.heading = tHeading + side * 0.06; this.speed *= 1 - 0.6 * dt; }
    }
    this.prog = this._prog(this.idx);
    this.pos.y = pr.height + this.alt;
    // aspetto: rollio in curva, beccheggio in salita/discesa e lungo la pendenza della pista
    this.ship.position.copy(this.pos);
    this.ship.rotation.order = 'YXZ';
    this.roll = THREE.MathUtils.damp(this.roll || 0, -ctl.ax * 0.5, 6, dt);
    const slope = -Math.asin(THREE.MathUtils.clamp(pr.tangent.y, -1, 1));
    this.pitch = THREE.MathUtils.damp(this.pitch || 0, -ctl.ay * 0.28 + slope, 6, dt);
    this.ship.rotation.set(this.pitch, this.heading, this.roll);
    this.shipBody.position.y = -1 + Math.sin(this.t * 3) * 0.06;
    const k = this.speed / L.maxSpeed;
    for (const t of this.trails) {
      t.scale.set(1, 0.6 + k * 0.8 + (this.turbo > 0 ? 0.9 : 0) + Math.random() * 0.15, 1);
      t.material.color.set(this.turbo > 0 ? 0xffd45a : 0x6fd8ff);
    }
    this._updateTrail(pr.right);
  }

  _updateTrail(right) {
    const tail = _v.set(Math.sin(this.heading), 0, Math.cos(this.heading)).multiplyScalar(-1.8).add(this.pos);
    this.trailPts.unshift({ p: tail.clone(), r: right.clone() });
    if (this.trailPts.length > TRAIL) this.trailPts.length = TRAIL;
    const w = 0.35 + (this.turbo > 0 ? 0.35 : 0);
    for (let i = 0; i < TRAIL; i++) {
      const pt = this.trailPts[Math.min(i, this.trailPts.length - 1)];
      const ww = w * (1 - i / TRAIL);
      this.trailPos.set([pt.p.x - pt.r.x * ww, pt.p.y, pt.p.z - pt.r.z * ww, pt.p.x + pt.r.x * ww, pt.p.y, pt.p.z + pt.r.z * ww], i * 6);
    }
    this.trailMesh.geometry.attributes.position.needsUpdate = true;
  }

  _inDive() { return this.dive && this.prog >= this.dive.p0 && this.prog <= this.dive.p1; }

  _shoot() {
    const dir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0x9fffe0 }));
    m.position.copy(this.pos).addScaledVector(dir, 2);
    this.scene.add(m);
    this.bullets.push({ mesh: m, dir, speed: this.speed + 95, life: 1.1 });
    this.audio.sfx('shoot');
  }

  _bullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.mesh.position.addScaledVector(b.dir, b.speed * dt);
      b.life -= dt;
      let hit = false;
      for (const p of this.patrols) {
        if (p.group.position.distanceTo(b.mesh.position) < (p.leader ? 3.2 : 2.6)) {
          hit = true;
          // colpita: scarta di lato, rallenta e resta stordita per un po'
          p.stun = 2.5;
          p.vlat = (p.lat >= this.lat ? 1 : -1) * 9;
          this._burst(b.mesh.position, 0x9fffe0);
          this.audio.sfx('hit');
          break;
        }
      }
      // i proiettili fermano anche i blocchi d'energia
      for (const blk of this.blocks) if (!hit && blk.mesh.position.distanceTo(b.mesh.position) < 1.8) { hit = true; blk.life = 0; this._burst(blk.mesh.position, 0x9fffe0); }
      if (hit || b.life <= 0) { this.scene.remove(b.mesh); this.bullets.splice(i, 1); }
    }
  }

  _near(label = 'Sfiorata!') {
    if (this.nearCool > 0) return;
    this.nearCool = 1.2;
    this._addTime(this.level.nearBonus);
    this._callout(`${label} +${String(this.level.nearBonus).replace('.', ',')} s`);
    this.shake = Math.max(this.shake, 0.25);
    this.audio.sfx('whoosh');
    this.emma.say('near');
  }

  _hit(label) {
    if (this.hitCool > 0) return;
    this.hitCool = 1.2;
    this.speed *= 0.55;
    this.turbo = 0;
    this._penalty(this.level.hitPenalty);
    this._callout(`${label} −${this.level.hitPenalty} s`, 1.3);
    this.emma.say('hit');
    this.audio.sfx('hit');
  }

  _patrols(dt) {
    const L = this.level, hw = this.track.wallDist - 2;
    this.hitCool = Math.max(0, this.hitCool - dt);
    this.nearCool = Math.max(0, this.nearCool - dt);
    this.patrolVoiceCool -= dt;
    this._pincerLogic(dt);
    let behindClose = false;
    for (const p of this.patrols) {
      const gap = (p.prog - this.prog) * this.step; // metri: positivo = davanti
      let speed = L.patrolSpeed;
      if (p.stun > 0) {
        p.stun -= dt;
        speed *= 0.55;
        p.lat += p.vlat * dt;
        p.vlat *= 1 - dt * 1.5;
        p.group.rotation.z += dt * 8;
      } else {
        p.group.rotation.z = THREE.MathUtils.damp(p.group.rotation.z % (Math.PI * 2), 0, 6, dt);
        const pin = !p.leader && this.pincer.state !== 'idle';
        if (pin) {
          // tenaglia: ai lati della navicella (avviso e apertura larghi, stretta vicina), alla sua quota
          const side = p === this.wings[0] ? -1 : 1;
          const off = this.pincer.state === 'squeeze' ? 3.3 : 8.5;
          p.lat = THREE.MathUtils.damp(p.lat, THREE.MathUtils.clamp(this.lat, -hw + 3.5, hw - 3.5) + side * off, this.pincer.state === 'squeeze' ? 3 : 2, dt);
          p.alt = THREE.MathUtils.damp(p.alt, this.alt, 2.5, dt);
          speed = this.speed * (this.pincer.state === 'squeeze' ? 0.72 : 1.02); // si fanno superare stringendo
        } else if (gap > 0 && gap < 70) {
          // se Emma arriva da dietro, si mettono in mezzo: stessa corsia e stessa quota
          p.lat = THREE.MathUtils.damp(p.lat, this.lat, 1.6, dt);
          p.alt = THREE.MathUtils.damp(p.alt, this.alt, 1.2, dt);
          if (gap < 18) speed = Math.max(speed, this.speed * 0.85);
        } else {
          p.lat = THREE.MathUtils.damp(p.lat, p.def.lat + Math.sin(this.t * 0.8 + p.def.t * 40) * 3, 1, dt);
          p.alt = THREE.MathUtils.damp(p.alt, p.def.alt + Math.sin(this.t * 0.6 + p.def.t * 30) * 1.5, 1, dt);
        }
        if (gap < -15) this.overtook = true;
        if (gap < -6 && gap > -45) behindClose = true;
        if (p.leader) this._leaderLogic(p, gap, dt);
      }
      p.lat = THREE.MathUtils.clamp(p.lat, -hw, hw);
      p.alt = THREE.MathUtils.clamp(p.alt, ALT_MIN + 0.4, (this._inTunnel() ? this._tunnelCeil(p.lat) : ALT_MAX - 1));
      p.prog += (speed * dt) / this.step;
      if (p.prog > this.endProg - 10) p.prog = this.endProg - 10; // non attraversano il portale
      const s = this._sample(p.prog);
      this._point(p.prog, p.lat, 0, p.group.position);
      p.group.position.y += p.alt;
      p.group.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);
      const [a, b] = p.group.userData.lights;
      const on = Math.sin(this.t * 12 + p.def.t * 50) > 0;
      a.visible = on || p.flash > 0; b.visible = !on;
      if (p.flash > 0) a.scale.setScalar(2.5); else a.scale.setScalar(1);
      const amber = this.pincer.state === 'warn' || this.pincer.state === 'squeeze';
      for (const m of p.group.userData.amber) m.visible = !p.leader && amber && Math.sin(this.t * 20) > 0;
      // urto e sfiorata
      const d = p.group.position.distanceTo(this.pos) / (p.leader ? 1.3 : 1);
      if (d < R_HIT) this._hit('Urto con la pattuglia');
      p.minD = Math.min(p.minD, d);
      if (gap > 3) { p.minD = 99; p.passed = false; }
      if (!p.passed && gap < -2) { p.passed = true; if (p.minD >= R_HIT && p.minD < R_NEAR) this._near(); }
    }
    if (behindClose && this.overtook && this.patrolVoiceCool <= 0) { this.patrolVoiceCool = 14; this.emma.say('patrol'); }
  }

  /** Caposquadra: se Emma è dietro a tiro, lampeggia e lancia un blocco d'energia in linea retta. */
  _leaderLogic(p, gap, dt) {
    if (!this.saidLeader && gap > 0 && gap < 110) { this.saidLeader = true; this.emma.say('leader', { important: true }); }
    p.fireCool -= dt;
    if (p.flash > 0) {
      p.flash -= dt;
      if (p.flash <= 0) {
        // il blocco parte dalla quota e dalla corsia del caposquadra e torna indietro lungo la pista
        const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), new THREE.MeshStandardMaterial({ color: 0x0a2a24, emissive: 0x9fffe0, emissiveIntensity: 2.5, transparent: true, opacity: 0.85 }));
        this.scene.add(m);
        this.blocks.push({ mesh: m, prog: p.prog - 2, lat: p.lat, alt: p.alt, life: 4, minD: 99, passed: false });
        this.audio.sfx('shoot');
      }
      return;
    }
    if (p.fireCool <= 0 && gap > 25 && gap < 130) { p.fireCool = 3.2; p.flash = 0.6; this.audio.sfx('beep'); }
  }

  _blocks(dt) {
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const b = this.blocks[i];
      b.life -= dt;
      b.prog -= (26 * dt) / this.step; // verso Emma, in linea retta lungo la pista
      this._point(b.prog, b.lat, b.alt, b.mesh.position);
      b.mesh.rotation.x += dt * 3; b.mesh.rotation.y += dt * 2;
      const d = b.mesh.position.distanceTo(this.pos);
      if (d < 2.1) { this._hit('Blocco d’energia'); this._burst(b.mesh.position, 0x9fffe0); b.life = 0; }
      b.minD = Math.min(b.minD, d);
      if (!b.passed && b.prog < this.prog - 1) { b.passed = true; if (b.minD >= 2.1 && b.minD < 4.2) this._near(); }
      if (b.life <= 0) { this.scene.remove(b.mesh); this.blocks.splice(i, 1); }
    }
  }

  /** Tenaglia delle due gregarie: avviso (luci ambra), stretta ai lati, poi si aprono. */
  _pincerLogic(dt) {
    const P = this.pincer;
    P.t -= dt;
    P.cool -= dt;
    const [w1, w2] = this.wings;
    if (!w1 || !w2) return;
    const gap1 = (w1.prog - this.prog) * this.step, gap2 = (w2.prog - this.prog) * this.step;
    if (P.state === 'idle') {
      if (P.cool <= 0 && w1.stun <= 0 && w2.stun <= 0 && gap1 > 5 && gap1 < 45 && gap2 > 5 && gap2 < 45) {
        P.state = 'warn'; P.t = 1.3;
        this._callout('Tenaglia!', 1.2);
        this.emma.say('pincer', { important: true });
      }
    } else if (P.state === 'warn' && P.t <= 0) { P.state = 'squeeze'; P.t = 2.6; }
    else if (P.state === 'squeeze' && P.t <= 0) { P.state = 'open'; P.t = 1.2; }
    else if (P.state === 'open' && P.t <= 0) { P.state = 'idle'; P.cool = 12; }
  }

  _ringBonus() {
    const B = this.level.ringBonus;
    return B[Math.min(this.chain, B.length) - 1];
  }

  _checkpoints() {
    // anelli: si decide quando si passa il loro punto sul giro
    while (this.nextRing < this.rings.length && this.prog >= this.rings[this.nextRing].prog && this.prog < this.rings[this.nextRing].prog + 40) {
      const r = this.rings[this.nextRing++];
      // distanza dal centro nel piano dell'anello (quota e scostamento laterale)
      const d = Math.hypot(this.lat - r.lat, this.pos.y - r.center.y);
      if (d < r.radius + 0.3) {
        r.state = 'taken';
        this.chain++;
        this.bestChain = Math.max(this.bestChain, this.chain);
        this.ringsTaken++;
        const bonus = this._ringBonus();
        this._addTime(bonus);
        this.audio.chime ? this.audio.chime(this.chain - 1) : this.audio.sfx('pickup');
        if (r.gold) {
          this.goldTaken++;
          this.turbo = this.level.turbo.time;
          this._addCoins(r.coins || 5);
          this.audio.boost && this.audio.boost(1);
          this._callout(`Anello d’oro! +${r.coins || 5} monete`, 1.3);
        }
        if (this.chain === 5 || this.chain === 9) this.emma.say('chain', { important: true });
        else this.emma.say(this.ringVariant++ % 2 ? 'ring2' : 'ring1');
      } else if (!r.gold) {
        // mancato: niente tempo perso, ma la catena si azzera
        r.state = 'missed';
        r.mat.emissive.set(0x444455);
        r.mat.emissiveIntensity = 0.6;
        if (this.chain >= 3) this._callout('Catena persa', 1);
        this.chain = 0;
        this.emma.say('missed');
        this.audio.sfx('back');
      } else r.state = 'missed'; // un dorato saltato non rompe la catena
    }
    // barriere e ponte: avviso la prima volta, urto se la quota è dentro la banda
    for (const b of this.barriers) {
      const ahead = (b.prog - this.prog) * this.step;
      if (b.kind === 'barrier' && !this.saidBarrier && ahead > 0 && ahead < 110) { this.saidBarrier = true; this.emma.say('barrier', { important: true }); }
      if (b.done || this.prog < b.prog) continue;
      b.done = true;
      if (this.alt > b.a0 && this.alt < b.a1) {
        this._hit(b.kind === 'bridge' ? 'Il ponte!' : 'Barriera');
        this.audio.sfx('wall');
        this._burst(this.pos, 0xff2a6a);
      } else if (Math.min(Math.abs(this.alt - b.a0), Math.abs(this.alt - b.a1)) < 1.1) this._near();
    }
  }

  _animateProps(dt) {
    for (const r of this.rings) {
      if (r.state === 'taken') {
        r.group.scale.multiplyScalar(1 + dt * 3);
        r.mat.emissiveIntensity = Math.max(0, r.mat.emissiveIntensity - dt * 5);
        r.disc.material.opacity = Math.max(0, r.disc.material.opacity - dt);
        if (r.mat.emissiveIntensity <= 0) r.group.visible = false;
      } else if (r.state === 'wait') {
        r.group.rotation.z += dt * (r.gold ? 1.8 : 0.6);
        r.mat.emissiveIntensity = 2.2 + Math.sin(this.t * (r.gold ? 7 : 4) + r.prog) * 0.6;
        if (r.group.userData.star) r.group.userData.star.rotation.y += dt * 3;
      }
    }
    for (const b of this.barriers) if (b.tex) b.tex.offset.y -= dt * 0.8;
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t += dt;
      b.m.scale.setScalar(1 + b.t * 10);
      b.m.material.opacity = Math.max(0, 0.8 - b.t * 2.5);
      if (b.t > 0.35) { this.scene.remove(b.m); this.bursts.splice(i, 1); }
    }
  }

  _burst(pos, color) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
    m.position.copy(pos);
    this.scene.add(m);
    this.bursts.push({ m, t: 0 });
  }

  /** Dentro il portale: lampo bianco, poi la vittoria. */
  _enterPortal() {
    this.state = 'portal';
    this.stateTimer = 0.6;
    this.flashAt = this.t;
    this.audio.sfx('whoosh');
    this.audio.setTempo && this.audio.setTempo(1);
  }

  _win() {
    this.state = 'won';
    this.stateTimer = 3;
    this.audio.sfx('finish');
    this.emma.clear();
    this.emma.say('win', { important: true });
    this.say('Dentro il portale!', 3);
    this.result = this._medal();
  }

  /** Medaglia: tempo rimasto, anelli presi (dorati compresi) e monete raccolte nel livello. */
  _medal() {
    const M = this.level.medals || {};
    const left = Math.max(0, this.timer), rings = this.ringsTaken, coins = this.coinsHere;
    const meets = (m) => m && left >= m.time && rings >= m.rings && coins >= m.coins;
    const medal = meets(M.gold) ? 'gold' : meets(M.silver) ? 'silver' : 'bronze';
    const total = this.rings.length;
    return {
      medal,
      stats: [
        ['Tempo rimasto al gong', `${left.toFixed(1).replace('.', ',')} s`, M.gold ? `${M.gold.time} s` : null],
        ['Anelli presi', `${rings}/${total} (dorati ${this.goldTaken})`, M.gold ? `${M.gold.rings}` : null],
        ['Catena migliore', `${this.bestChain}`, null],
        ['Monete raccolte', `${coins}`, M.gold ? `${M.gold.coins}` : null]
      ]
    };
  }

  _late() {
    this.state = 'late';
    this.stateTimer = 4;
    this.audio.sfx('back');
    this.audio.setTempo && this.audio.setTempo(1);
    this.emma.clear();
    this.emma.say('late', { important: true });
    this.say('Gong! Il portale si è chiuso: si rifà il giro.', 3.5);
  }

  _placeCamera(dt) {
    const f = _f.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    // picchiata: telecamera più alta che guarda giù lungo la discesa
    const dive = this._inDive() ? 1 : 0;
    this.diveK = THREE.MathUtils.damp(this.diveK || 0, dive, 3, dt >= 1 ? 10 : dt);
    const target = _v.copy(this.pos).addScaledVector(f, -10 + this.diveK * 1.5);
    target.y += 3.8 + this.diveK * 3.2;
    const k = dt >= 1 ? 1 : Math.min(1, dt * 6);
    this.camera.position.lerp(target, k);
    // scosse negli urti e nelle sfiorate
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - (dt >= 1 ? 1 : dt) * 1.8);
      const a = this.shake * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
    }
    this.camera.lookAt(this.pos.x + f.x * 8, this.pos.y + 0.8 - this.diveK * 2.5, this.pos.z + f.z * 8);
    // campo visivo: si allarga con la velocità e col turbo
    const fov = 62 + (this.speed / this.level.maxSpeed) * 10 + (this.turbo > 0 ? 8 : 0);
    const cur = this.camera.fov + (fov - this.camera.fov) * Math.min(1, (dt >= 1 ? 1 : dt) * 4);
    if (Math.abs(this.camera.fov - cur) > 0.05) { this.camera.fov = cur; this.camera.updateProjectionMatrix(); }
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  hud() {
    const k = this.speed / this.level.maxSpeed;
    return {
      flight: true,
      coins: this.coins,
      timer: Math.max(0, this.timer),
      timerLabel: 'Gong',
      timerGain: this.gain,
      rings: { taken: this.ringsTaken, total: this.rings.length },
      chain: this.chain,
      speed: Math.round(this.speed * 3.6),
      speedLines: Math.max(0, Math.min(1, (k - 0.7) * 2.5 + (this.turbo > 0 ? 0.5 : 0))),
      alarm: this.state === 'play' && this.timer < 10 && this._lastStretch(),
      callout: this.callout,
      flash: this.flashAt || 0,
      notice: this.emma.subtitle || this.notice
    };
  }

  dispose() {
    this.track.dispose();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
  }
}
