import * as THREE from 'three';
import { Assets } from '../core/AssetLoader.js';
import { Track } from '../track/Track.js';
import { trackById } from '../config/tracks.js';

// Livello di volo della Storia (il primo è il Portale, story/portale.js): si pilota Emma sul circuito di
// WisiKart. Stessa interfaccia di StoryMode (load → update/render → hud → dispose), così main.js li tratta
// allo stesso modo. Dalla guida del kart riusa la pista (Track: campioni, proiezione, bordi) e lo schema di
// sterzo (heading, avanti = (sin h, cos h)); in più si vola: quota su e giù, e si spara.

const _v = new THREE.Vector3();
const _f = new THREE.Vector3();
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra });

const TURN = 1.7; // rad/s di sterzo a piena velocità
const ACC = 16, BRAKE = 34;
const CLIMB = 8.5; // m/s in quota
const ALT_MIN = 1.1, ALT_MAX = 15;
const RING_R = 3.4;

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

  update(dt) {
    this.t += dt;
    if (this.queue && this.t >= this.busyUntil) { const k = this.queue; this.queue = null; this.say(k); }
    if (this.t > this.subUntil) this.subtitle = null;
  }
}

export class FlightMode {
  constructor({ level, audio, coins = 0, onComplete, onGameOver }) {
    this.level = level;
    this.audio = audio;
    this.coins = coins;
    this.onComplete = onComplete;
    this.onGameOver = onGameOver;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.4, 2400);
    this.t = 0;
    this.state = 'play'; // play | won | late | ended
    this.stateTimer = 0;
    this.notice = null;
    this.noticeTimer = 0;
    this.bullets = [];
    this.bursts = [];
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
    this._buildRings();
    this._buildBarriers();
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

  _sample(prog) { return this.track.samples[(this.startIdx + Math.floor(prog)) % this.N]; }

  _buildShip(model) {
    this.ship = new THREE.Group();
    this.shipBody = new THREE.Group();
    this.ship.add(this.shipBody);
    if (model) this.shipBody.add(model);
    else {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 1.6, 6, 14), std('#d99a2b', { metalness: 0.4 }));
      body.rotation.x = Math.PI / 2;
      body.position.y = 0.9;
      this.shipBody.add(body);
    }
    this.shipBody.position.y = -1.0; // il punto di riferimento è al centro della navicella
    // scie dei motori
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

  _buildRings() {
    this.rings = this.level.rings.map((r, i) => {
      const prog = this._progOfT(r.t);
      const s = this._sample(prog);
      const color = i % 2 ? 0x3fe8ff : 0xff4fc8;
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x110818, emissive: color, emissiveIntensity: 2.6 });
      const torus = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 0.28, 10, 40), mat);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(RING_R - 0.2, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.add(torus, disc);
      const c = this._point(prog, r.lat, r.alt + this._roadY(prog));
      g.position.copy(c);
      g.lookAt(_v.copy(c).add(s.tangent)); // il cerchio guarda lungo la pista
      this.scene.add(g);
      return { ...r, prog, center: c.clone(), group: g, mat, disc, state: 'wait', color };
    });
  }

  /** Altezza della strada relativa al campione (i punti della pista includono già la quota del circuito). */
  _roadY() { return 0; }

  _buildBarriers() {
    const hw = this.track.halfW + 2.5;
    this.barriers = this.level.barriers.map((b) => {
      const prog = this._progOfT(b.t);
      const s = this._sample(prog);
      const h = b.a1 - b.a0;
      const g = new THREE.Group();
      const tex = (() => {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const x = c.getContext('2d');
        x.fillStyle = 'rgba(255,40,90,0.5)'; x.fillRect(0, 0, 64, 64);
        x.fillStyle = 'rgba(255,200,230,0.9)'; for (let i = 0; i < 64; i += 16) x.fillRect(0, i, 64, 3);
        const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(hw / 3, h / 3); return t;
      })();
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
      return { ...b, prog, group: g, tex, done: false };
    });
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
    // il varco: un disco di luce che pulsa
    this.portalDisc = new THREE.Mesh(new THREE.CircleGeometry(13, 48), new THREE.MeshBasicMaterial({ color: 0xff7ae0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.portalDisc.position.y = 11;
    g.add(this.portalDisc);
    const base = this._point(prog, 0, 0);
    g.position.copy(base);
    g.lookAt(_v.copy(base).add(s.tangent));
    this.scene.add(g);
    this.portal = g;
  }

  _patrolMesh() {
    const g = new THREE.Group();
    if (this.patrolProto) {
      const m = this.patrolProto.clone(true);
      m.rotation.y = Math.PI / 2; // il modello ha il muso verso -X: lo giro verso +Z
      m.position.y = -1;
      g.add(m);
    } else {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 1.8, 6, 12), std('#2f6bd9', { metalness: 0.5 }));
      body.rotation.x = Math.PI / 2;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 2.6), std('#f2f0ff'));
      g.add(body, stripe);
    }
    // lampeggianti blu e rossi sul tetto
    const blue = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0x2a6aff }));
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a3a }));
    blue.position.set(-0.35, 0.6, 0); red.position.set(0.35, 0.6, 0);
    g.add(blue, red);
    g.userData.lights = [blue, red];
    return g;
  }

  _buildPatrols() {
    this.patrols = this.level.patrols.map((p) => {
      const g = this._patrolMesh();
      this.scene.add(g);
      return { def: p, group: g, prog: 0, lat: 0, alt: 0, stun: 0, vlat: 0 };
    });
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
    this.hitCool = 0;
    this.shootCool = 0;
    this.nextRing = 0;
    this.ringsTaken = 0;
    this.ringVariant = 0;
    this.saidGong = false;
    this.saidPortal = false;
    this.saidBarrier = false;
    this.patrolVoiceCool = 6;
    this.overtook = false;
    this.pos = this._point(0, 0, 0).clone();
    this.idx = this.startIdx;
    for (const r of this.rings) { r.state = 'wait'; r.group.visible = true; r.group.scale.setScalar(1); r.mat.emissiveIntensity = 2.6; r.mat.emissive.set(r.color); }
    for (const b of this.barriers) b.done = false;
    for (const p of this.patrols) {
      p.prog = this._progOfT(p.def.t); p.lat = p.def.lat; p.alt = p.def.alt; p.stun = 0; p.vlat = 0;
    }
    for (const b of this.bullets) this.scene.remove(b.mesh);
    this.bullets = [];
    this.state = 'play';
    this.emma.say('start', { important: true });
    this.audio.playTheme(L.music);
    this._placeCamera(1);
  }

  say(text, time = 2) { this.notice = text; this.noticeTimer = time; }

  _penalty(sec, label) {
    this.timer = Math.max(0, this.timer - sec);
    this.say(`${label} −${sec} s`, 1.4);
  }

  // ---------- gioco ----------
  update(dt, input) {
    this.t += dt;
    this.emma.update(dt);
    this.noticeTimer = Math.max(0, this.noticeTimer - dt);
    if (this.noticeTimer <= 0) this.notice = null;
    this.track.update(dt, this.t, this.pos);
    this.portalDisc.material.opacity = 0.28 + Math.sin(this.t * 3) * 0.1;
    this.portalDisc.rotation.z += dt * 0.5;
    this._animateProps(dt);

    if (this.state === 'won' || this.state === 'late') {
      this.stateTimer -= dt;
      // la navicella continua a scivolare in avanti
      this._move(dt, { ax: 0, ay: 0, brake: false });
      this._placeCamera(dt);
      if (this.stateTimer <= 0) {
        if (this.state === 'won') { this.state = 'ended'; this.onComplete && this.onComplete(); }
        else this.restart();
      }
      return;
    }
    if (this.state !== 'play') return;

    const ctl = { ax: input.axisX, ay: input.axisY, brake: input.brakeHeld };
    input.jumpPressed = input.upPressed = input.itemPressed = false;
    this._move(dt, ctl);

    // sparo: spazio (tenuto = raffica)
    this.shootCool -= dt;
    if (input.jumpHeld && this.shootCool <= 0) { this.shootCool = 0.22; this._shoot(); }
    this._bullets(dt);
    this._patrols(dt);
    this._checkpoints();

    // gong
    this.timer -= dt;
    if (!this.saidGong && this.timer < 15) { this.saidGong = true; this.emma.say('gong', { important: true }); }
    if (!this.saidPortal && this.endProg - this.prog < 130 / this.step) { this.saidPortal = true; this.emma.say('portal', { important: true }); }
    if (this.prog >= this.endProg && this.prog < this.endProg + 60) return this._win();
    if (this.timer <= 0) return this._late();
    this._placeCamera(dt);
  }

  _move(dt, ctl) {
    const L = this.level, tr = this.track;
    const target = ctl.brake ? L.brakeSpeed : L.maxSpeed;
    if (this.speed < target) this.speed = Math.min(target, this.speed + ACC * dt);
    else this.speed = Math.max(target, this.speed - (ctl.brake ? BRAKE : ACC) * dt);
    // sterzo come nel kart: heading diminuisce con lo sterzo a destra
    const sf = Math.min(1, this.speed / 14);
    this.heading -= ctl.ax * TURN * sf * dt;
    this.alt = THREE.MathUtils.clamp(this.alt + ctl.ay * CLIMB * dt, ALT_MIN, ALT_MAX);
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
    // aspetto: rollio in curva, beccheggio in salita/discesa
    this.ship.position.copy(this.pos);
    this.ship.rotation.set(0, 0, 0);
    this.ship.rotation.order = 'YXZ';
    this.roll = THREE.MathUtils.damp(this.roll || 0, -ctl.ax * 0.5, 6, dt);
    this.pitch = THREE.MathUtils.damp(this.pitch || 0, -ctl.ay * 0.28, 6, dt);
    this.ship.rotation.set(this.pitch, this.heading, this.roll);
    this.shipBody.position.y = -1 + Math.sin(this.t * 3) * 0.06;
    for (const t of this.trails) t.scale.set(1, 0.6 + (this.speed / L.maxSpeed) * 0.8 + Math.random() * 0.15, 1);
  }

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
        if (p.group.position.distanceTo(b.mesh.position) < 2.6) {
          hit = true;
          // colpita: scarta di lato, rallenta e resta stordita per un po'
          p.stun = 2.5;
          p.vlat = (p.lat >= this.lat ? 1 : -1) * 9;
          this._burst(b.mesh.position, 0x9fffe0);
          this.audio.sfx('hit');
          break;
        }
      }
      if (hit || b.life <= 0) { this.scene.remove(b.mesh); this.bullets.splice(i, 1); }
    }
  }

  _patrols(dt) {
    const L = this.level, hw = this.track.wallDist - 2;
    this.hitCool = Math.max(0, this.hitCool - dt);
    this.patrolVoiceCool -= dt;
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
        // se Whiskey arriva da dietro, si mettono in mezzo: stessa corsia e stessa quota
        if (gap > 0 && gap < 70) {
          p.lat = THREE.MathUtils.damp(p.lat, this.lat, 1.6, dt);
          p.alt = THREE.MathUtils.damp(p.alt, this.alt, 1.2, dt);
          if (gap < 18) speed = Math.max(speed, this.speed * 0.85); // tengono il passo per sbarrare
        } else {
          p.lat = THREE.MathUtils.damp(p.lat, p.def.lat + Math.sin(this.t * 0.8 + p.def.t * 40) * 3, 1, dt);
          p.alt = THREE.MathUtils.damp(p.alt, p.def.alt + Math.sin(this.t * 0.6 + p.def.t * 30) * 1.5, 1, dt);
        }
        if (gap < -15) this.overtook = true;
        if (gap < -6 && gap > -45) behindClose = true;
      }
      p.lat = THREE.MathUtils.clamp(p.lat, -hw, hw);
      p.alt = THREE.MathUtils.clamp(p.alt, ALT_MIN + 0.4, ALT_MAX - 1);
      p.prog += (speed * dt) / this.step;
      if (p.prog > this.endProg - 10) p.prog = this.endProg - 10; // non attraversano il portale
      const s = this._sample(p.prog);
      this._point(p.prog, p.lat, 0, p.group.position);
      p.group.position.y += p.alt;
      p.group.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);
      const [blue, red] = p.group.userData.lights;
      const on = Math.sin(this.t * 12 + p.def.t * 50) > 0;
      blue.visible = on; red.visible = !on;
      // urto con Emma: si perde tempo e velocità
      if (this.hitCool <= 0 && p.group.position.distanceTo(this.pos) < 2.9) {
        this.hitCool = 1.2;
        this.speed *= 0.55;
        this._penalty(L.hitPenalty, 'Urto con la pattuglia');
        this.emma.say('hit');
        this.audio.sfx('hit');
        this.pos.addScaledVector(this._sample(this.prog).right, this.lat >= p.lat ? 1.5 : -1.5);
      }
    }
    if (behindClose && this.overtook && this.patrolVoiceCool <= 0) { this.patrolVoiceCool = 14; this.emma.say('patrol'); }
  }

  _checkpoints() {
    const L = this.level;
    // anelli: si decide quando si passa il loro punto sul giro
    while (this.nextRing < this.rings.length && this.prog >= this.rings[this.nextRing].prog && this.prog < this.rings[this.nextRing].prog + 40) {
      const r = this.rings[this.nextRing++];
      // distanza dal centro nel piano dell'anello (quota e scostamento laterale)
      const d = Math.hypot(this.lat - r.lat, (this.pos.y - r.center.y));
      if (d < RING_R + 0.3) {
        r.state = 'taken';
        this.ringsTaken++;
        this.audio.sfx('pickup');
        this.emma.say(this.ringVariant++ % 2 ? 'ring2' : 'ring1');
      } else {
        r.state = 'missed';
        r.mat.emissive.set(0x444455);
        r.mat.emissiveIntensity = 0.6;
        this._penalty(L.ringPenalty, 'Anello mancato');
        this.emma.say('missed');
        this.audio.sfx('back');
      }
    }
    // barriere: avviso la prima volta, urto se la quota è dentro la banda
    for (const b of this.barriers) {
      const ahead = (b.prog - this.prog) * this.step;
      if (!this.saidBarrier && ahead > 0 && ahead < 110) { this.saidBarrier = true; this.emma.say('barrier', { important: true }); }
      if (b.done || this.prog < b.prog) continue;
      b.done = true;
      if (this.alt > b.a0 && this.alt < b.a1) {
        this.speed *= 0.5;
        this._penalty(L.hitPenalty, 'Barriera');
        this.emma.say('hit');
        this.audio.sfx('wall');
        this._burst(this.pos, 0xff2a6a);
      } else this.audio.sfx('select');
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
        r.group.rotation.z += dt * 0.6;
        r.mat.emissiveIntensity = 2.2 + Math.sin(this.t * 4 + r.prog) * 0.6;
      }
    }
    for (const b of this.barriers) b.tex.offset.y -= dt * 0.8;
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

  _win() {
    this.state = 'won';
    this.stateTimer = 3.2;
    this.audio.sfx('finish');
    this.emma.queue = null;
    this.emma.busyUntil = 0;
    this.emma.say('win', { important: true });
    this.say('Dentro il portale!', 3);
  }

  _late() {
    this.state = 'late';
    this.stateTimer = 4;
    this.audio.sfx('back');
    this.emma.queue = null;
    this.emma.busyUntil = 0;
    this.emma.say('late', { important: true });
    this.say('Gong! Il portale si è chiuso: si rifà il giro.', 3.5);
  }

  _placeCamera(dt) {
    const f = _f.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    const target = _v.copy(this.pos).addScaledVector(f, -10);
    target.y += 3.8;
    const k = dt >= 1 ? 1 : Math.min(1, dt * 6);
    this.camera.position.lerp(target, k);
    this.camera.lookAt(this.pos.x + f.x * 8, this.pos.y + 0.8, this.pos.z + f.z * 8);
    const fov = 62 + (this.speed / this.level.maxSpeed) * 10;
    if (Math.abs(this.camera.fov - fov) > 0.1) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  hud() {
    return {
      flight: true,
      coins: this.coins,
      timer: Math.max(0, this.timer),
      timerLabel: 'Gong',
      rings: { taken: this.ringsTaken, total: this.rings.length },
      speed: Math.round(this.speed * 3.6),
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
