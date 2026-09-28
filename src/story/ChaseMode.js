import * as THREE from 'three';
import { Assets } from '../core/AssetLoader.js';
import { Track } from '../track/Track.js';
import { trackById } from '../config/tracks.js';
import { FlightMode } from './FlightMode.js';
import { EmmaVoice } from './emma.js';

// Inseguimento in volo della Storia (il primo è sul lago di Retah, story/inseguimento.js). Riusa il motore
// del Portale (FlightMode: pista, pilotaggio, telecamera, scia) e cambia le regole: niente timer, salute a
// cuori, due blindati alle spalle con i missili, il cannone ionico e i ripari, checkpoint, finale scritto.

const _v = new THREE.Vector3();
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
const DIRS = { left: 'Missile da sinistra!', right: 'Missile da destra!', back: 'Missile da dietro!' };

export class ChaseMode extends FlightMode {
  constructor(opts) {
    super(opts);
    this.missiles = [];
    this.shots = [];
    this.chasers = [];
    this.covers = [];
  }

  // ---------- costruzione ----------
  async load(progress = () => {}) {
    const L = this.level;
    progress('Scaldo i motori…');
    // il circuito di WisiKart senza scatole e pad; i blindati fermi del kart qui inseguono davvero
    const def = trackById[L.track];
    const trackDef = { ...def, itemBoxes: [], boostPads: [], props: (def.props || []).filter((p) => p.model !== 'blindato') };
    this.track = new Track(trackDef, this.scene, null);
    await this.track.build();
    const tr = this.track;
    this.N = tr.N;
    this.step = tr.length / tr.N;
    this.startIdx = tr.idxFromT(def.startT);
    this.endProg = this._progOfT(L.endT);
    progress('I blindati accendono i motori…');
    const [ship, chaser, wreck] = await Promise.all([
      Assets.model(L.model.url, { targetHeight: L.model.h }),
      Assets.model(L.chaserModel.url, { targetHeight: L.chaserModel.h }),
      Assets.model(L.wreckModel.url, { targetHeight: L.wreckModel.h })
    ]);
    this.emma = new EmmaVoice(this.audio, L.voices);
    await this.emma.load();
    this._buildShip(ship);
    this._buildTrail();
    this.chaserProto = chaser;
    this._buildChasers();
    this.wreckProto = wreck;
    this._buildCovers();
    this._buildVortex();
    this._buildBeam();
    this.cpProgs = L.checkpoints.map((t) => this._progOfT(t)).sort((a, b) => a - b);
    this.cpProg = 0;
    this.restart(true, 0);
    progress('Pronti.');
  }

  _buildChasers() {
    this.chasers = this.level.chasers.map((d) => {
      const g = new THREE.Group();
      if (this.chaserProto) {
        const m = this.chaserProto.clone(true);
        m.rotation.y = -Math.PI / 2; // il modello è lungo sull'asse X: lo giro lungo la pista
        m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        g.add(m);
      } else {
        const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 4.4), std('#5a5f70', { metalness: 0.5 }));
        b.position.y = 0.8;
        g.add(b);
      }
      // fari rossi e cannoncino che lampeggia quando sta per lanciare
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a3a }));
      eye.position.set(0, 2.4, 1.2);
      g.add(eye);
      const lamp = new THREE.SpotLight(0xffd0b0, 40, 45, 0.5, 0.5, 1.2);
      lamp.position.set(0, 1.4, 2.2);
      lamp.target.position.set(0, -2, 14);
      g.add(lamp, lamp.target);
      this.scene.add(g);
      return { def: d, group: g, eye, gap: d.gap, lat: d.lat, alt: 1.4, stun: 0, guard: 0, hp: this.level.chaserHp, prog: 0 };
    });
  }

  /** Ripari lungo il percorso: cespugli alti e relitti, con una colonna di luce che si vede da lontano. */
  _buildCovers() {
    const C = this.level.covers;
    const total = this.endProg * this.step;
    let i = 0;
    for (let d = C.from; d < total - this.level.cannon.finale - 60; d += C.every) {
      const prog = (d + ((i * 37) % 30) - 15) / this.step;
      const lat = C.lats[i % C.lats.length];
      const wreck = i % 2 === 1;
      const g = new THREE.Group();
      const w = wreck ? 8 : 7, h = wreck ? 5.6 : 6.2, depth = wreck ? 6 : 5;
      if (wreck && this.wreckProto) {
        const m = this.wreckProto.clone(true);
        m.rotation.set(0, (i % 4) * 0.7, 0.12);
        g.add(m);
      } else {
        // cespuglio alto: più palle di foglie secche una sull'altra
        const mat = std(i % 4 === 0 ? '#6a7a3a' : '#7a7a42', { roughness: 0.95, flatShading: true });
        for (let k = 0; k < 7; k++) {
          const r = 1.6 + ((k * 13) % 5) * 0.25;
          const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
          b.position.set(((k * 17) % 5 - 2) * 1.1, 1.3 + (k % 3) * 1.6, ((k * 7) % 3 - 1) * 0.9);
          b.castShadow = true;
          g.add(b);
        }
      }
      // colonna di luce: dice "riparo qui" da lontano; si accende forte quando il cannone è carico
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 40, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0x43e0b0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      beacon.position.y = h + 20;
      const zone = new THREE.Mesh(new THREE.PlaneGeometry(w + 1.2, this.level.cannon.safeAhead), new THREE.MeshBasicMaterial({ color: 0x43e0b0, transparent: true, opacity: 0.0, depthWrite: false }));
      zone.rotation.x = -Math.PI / 2;
      zone.position.set(0, 0.08, -this.level.cannon.safeAhead / 2 - depth / 2); // la zona sicura, subito prima del riparo
      g.add(beacon, zone);
      const s = this._sample(prog);
      const base = this._point(prog, lat, 0);
      g.position.copy(base);
      g.lookAt(_v.copy(base).add(s.tangent));
      this.scene.add(g);
      this.covers.push({ prog, lat, w, h, depth, group: g, beacon, zone });
      i++;
    }
  }

  /** Lo spazio vettore: anelli blu e viola che ruotano e un vortice luminoso, in fondo al giro. */
  _buildVortex() {
    const g = new THREE.Group();
    this.vortexRings = [];
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(9 + i * 1.6, 0.35, 10, 60), new THREE.MeshStandardMaterial({ color: 0x0a0a20, emissive: i % 2 ? 0xa05cff : 0x4c7be8, emissiveIntensity: 2.6 }));
      g.add(r);
      this.vortexRings.push(r);
    }
    this.vortexDisc = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshBasicMaterial({ color: 0x9fb8ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    g.add(this.vortexDisc);
    const light = new THREE.PointLight(0x7fa4ff, 60, 60, 1.5);
    g.add(light);
    const s = this._sample(this.endProg);
    const c = this._point(this.endProg, 0, 8);
    g.position.copy(c);
    g.lookAt(_v.copy(c).add(s.tangent));
    this.scene.add(g);
    this.vortex = g;
  }

  /** Il raggio del cannone ionico: una colonna di luce che scende inclinata sul percorso. */
  _buildBeam() {
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 1, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.beam.visible = false;
    this.scene.add(this.beam);
    this.beamT = 0;
  }

  /** Da capo (all'inizio) o dall'ultimo checkpoint (a cuori finiti). */
  restart(first = false, fromProg = 0) {
    const L = this.level;
    this.prog = fromProg;
    this.lat = 0;
    this.alt = 3;
    const s0 = this._sample(fromProg);
    this.heading = Math.atan2(s0.tangent.x, s0.tangent.z);
    this.speed = first ? 0 : 22;
    this.hearts = L.hearts;
    this.hitCool = 0;
    this.invuln = first ? 0 : 2;
    this.shootCool = 0;
    this.turbo = 0;
    this.shake = 0;
    this.callout = null;
    this.flashAt = 0;
    this.finale = false;
    this.cannon = { charge: 0, countdown: 0, said: false };
    this.missileCool = 3.5;
    this.pendingMissile = null;
    this.nextChaser = 0;
    this.saidMissile = false;
    for (const m of this.missiles) this.scene.remove(m.mesh);
    for (const b of this.shots) this.scene.remove(b.mesh);
    this.missiles = [];
    this.shots = [];
    for (const c of this.chasers) { c.gap = c.def.gap + 10; c.lat = c.def.lat; c.stun = 0; c.guard = 0; c.hp = L.chaserHp; }
    this.pos = this._point(fromProg, 0, 0).clone();
    this.pos.y += this.alt;
    this.idx = (this.startIdx + Math.floor(fromProg)) % this.N;
    this.trailPts = [];
    this.state = 'play';
    if (first) this._sayStart = true;
    this.audio.playTheme(L.music);
    this.audio.setTempo && this.audio.setTempo(1);
    this._placeCamera(1);
  }

  // ---------- gioco ----------
  update(dt, input) {
    this.t += dt;
    this.emma.update(dt);
    if (this._sayStart) { this._sayStart = false; this.emma.say('start', { important: true }); }
    this.noticeTimer = Math.max(0, this.noticeTimer - dt);
    if (this.noticeTimer <= 0) this.notice = null;
    if (this.callout && this.t > this.callout.until) this.callout = null;
    this.track.update(dt, this.t, this.pos);
    this._animate(dt);

    if (this.state !== 'play') {
      this.stateTimer -= dt;
      if (this.state !== 'down') this._move(dt, { ax: 0, ay: 0, brake: false });
      this._chasers(dt);
      this._placeCamera(dt);
      if (this.stateTimer <= 0) {
        if (this.state === 'portal') this._win();
        else if (this.state === 'won') { this.state = 'ended'; this.onComplete && this.onComplete(null); }
        else if (this.state === 'down') this.restart(false, this.cpProg);
      }
      return;
    }

    const ctl = { ax: input.axisX, ay: input.axisY, brake: input.brakeHeld };
    input.jumpPressed = input.upPressed = input.itemPressed = false;
    this.hitCool = Math.max(0, this.hitCool - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this._move(dt, ctl);
    // sparo: spazio (tenuto = raffica), mira da solo il missile o il blindato più vicino
    this.shootCool -= dt;
    if (input.jumpHeld && this.shootCool <= 0) { this.shootCool = 0.28; this._shoot(); }
    this._shots(dt);
    this._chasers(dt);
    this._missiles(dt);
    this._cannon(dt);
    this._coverBumps();
    this._checkpointsChase();
    // tratto finale: lo spazio vettore è vicino, il cannone quasi carico
    const left = (this.endProg - this.prog) * this.step;
    if (!this.finale && left < this.level.cannon.finale) {
      this.finale = true;
      this.pendingMissile = null;
      this.cannon.countdown = 0;
      this.emma.clear();
      this.emma.say('vettore', { important: true });
      this._callout('Lo spazio vettore!', 1.6);
    }
    if (this.prog >= this.endProg && this.prog < this.endProg + 60) return this._enterVortex();
    this._placeCamera(dt);
  }

  _animate(dt) {
    this.vortexRings.forEach((r, i) => { r.rotation.z += dt * (0.6 + i * 0.35) * (i % 2 ? -1 : 1); });
    this.vortexDisc.material.opacity = 0.3 + Math.sin(this.t * 4) * 0.12;
    this.vortexDisc.rotation.z -= dt * 1.5;
    // ripari: le colonne pulsano, forte quando il cannone è carico; la zona sicura si illumina
    const alert = this.cannon && (this.cannon.countdown > 0 || this.cannon.charge > 0.85);
    for (const c of this.covers) {
      c.beacon.material.opacity = alert ? 0.55 + Math.sin(this.t * 10) * 0.25 : 0.28 + Math.sin(this.t * 2 + c.prog) * 0.08;
      c.zone.material.opacity = alert ? 0.18 + Math.sin(this.t * 10) * 0.08 : 0;
    }
    if (this.beamT > 0) {
      this.beamT = Math.max(0, this.beamT - dt);
      this.beam.material.opacity = Math.min(1, this.beamT * 2.2) * 0.85;
      this.beam.visible = this.beamT > 0;
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t += dt;
      b.m.scale.setScalar(1 + b.t * 10);
      b.m.material.opacity = Math.max(0, 0.8 - b.t * 2.5);
      if (b.t > 0.35) { this.scene.remove(b.m); this.bursts.splice(i, 1); }
    }
  }

  // ---------- sparo ----------
  _shoot() {
    // bersaglio: il blindato più vicino (i missili non si abbattono: si schivano)
    let target = null, best = Infinity;
    for (const c of this.chasers) { const d = c.group.position.distanceTo(this.pos); if (d < 140 && d < best) { best = d; target = { kind: 'chaser', ref: c }; } }
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0x9fffe0 }));
    mesh.position.copy(this.pos);
    this.scene.add(mesh);
    const dir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.shots.push({ mesh, target, dir, life: 1.4 });
    this.audio.sfx('shoot');
  }

  _shots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      let done = s.life <= 0;
      if (s.target && (s.target.kind === 'chaser' || this.missiles.includes(s.target.ref))) {
        const tp = s.target.kind === 'chaser' ? s.target.ref.group.position : s.target.ref.mesh.position;
        _v.copy(tp).add(new THREE.Vector3(0, s.target.kind === 'chaser' ? 1.4 : 0, 0)).sub(s.mesh.position);
        const d = _v.length();
        if (d < 2.2) {
          done = true;
          if (s.target.kind === 'chaser') this._chaserHit(s.target.ref);
          else this._missileDown(s.target.ref);
        } else s.mesh.position.addScaledVector(_v.normalize(), Math.min(d, 120 * dt));
      } else s.mesh.position.addScaledVector(s.dir, (this.speed + 90) * dt);
      if (done) { this.scene.remove(s.mesh); this.shots.splice(i, 1); }
    }
  }

  /**
   * Colpo su un blindato: scintille; dopo chaserHp colpi è "preso": rallenta, resta indietro e per un po' non
   * lancia. Appena ripreso ha qualche secondo di corazza (guard): non si può tenere fermo sparando e basta.
   */
  _chaserHit(c) {
    const at = c.group.position.clone().setY(c.group.position.y + 1.4);
    if (c.stun > 0 || c.guard > 0) { this._burst(at, 0x9fe0ff); return; }
    c.hp--;
    if (c.hp > 0) { this._burst(at, 0xffe0a0); this.audio.sfx('wall'); return; }
    c.hp = this.level.chaserHp;
    c.gap += 30;
    c.stun = 2.2;
    c.guard = 2.2 + 3.5;
    this._burst(at, 0xffb040);
    this.audio.sfx('boom');
    this._callout('Preso uno!', 1.1);
    this.emma.say('preso');
  }

  _missileDown(m) {
    this._burst(m.mesh.position, 0xffb040);
    this.audio.sfx('boom');
    this._callout('Missile abbattuto!', 1);
    this.scene.remove(m.mesh);
    this.missiles.splice(this.missiles.indexOf(m), 1);
  }

  // ---------- blindati e missili ----------
  _chasers(dt) {
    const L = this.level;
    for (const c of this.chasers) {
      c.stun = Math.max(0, c.stun - dt);
      c.guard = Math.max(0, c.guard - dt);
      // cercano di tenere la loro distanza; se Emma frena si avvicinano (ma non speronano)
      const target = this.finale ? c.def.gap * 0.45 : c.def.gap;
      let v = THREE.MathUtils.clamp(L.maxSpeed * 0.96 + (c.gap - target) * 0.8, 8, L.maxSpeed * 1.3);
      if (c.stun > 0) v *= 0.55;
      if (this.state === 'down') v = this.speed;
      c.gap = Math.max(14, c.gap + (this.speed - v) * dt);
      c.lat = THREE.MathUtils.damp(c.lat, THREE.MathUtils.clamp(this.lat + c.def.lat, -(this.track.wallDist - 3), this.track.wallDist - 3), 1.2, dt);
      c.alt = 1.4 + Math.sin(this.t * 1.7 + c.def.gap) * 0.3;
      c.prog = this.prog - c.gap / this.step;
      const s = this._sample(c.prog);
      this._point(c.prog, c.lat, c.alt, c.group.position);
      c.group.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);
      c.group.rotation.z = c.stun > 0 ? Math.sin(this.t * 20) * 0.1 : 0;
      c.eye.visible = this.pendingMissile && this.pendingMissile.c === c ? Math.sin(this.t * 30) > 0 : true;
    }
  }

  _missiles(dt) {
    const M = this.level.missile;
    // nuovo lancio: prima l'avviso (con la direzione), poi il missile; niente missili col cannone in carica
    if (!this.finale && this.cannon.countdown <= 0) {
      this.missileCool -= dt;
      if (!this.pendingMissile && this.missileCool <= 0) {
        const ready = this.chasers.filter((c) => c.stun <= 0);
        if (ready.length) {
          const c = ready[this.nextChaser++ % ready.length];
          this.pendingMissile = { c, t: M.warn };
          this.audio.sfx('warn');
          if (!this.saidMissile) { this.saidMissile = true; this.emma.say('missile', { important: true }); }
          else if (Math.random() < 0.35) this.emma.say('missile');
        }
        this.missileCool = M.every[0] + Math.random() * (M.every[1] - M.every[0]);
      }
    }
    if (this.pendingMissile) {
      const p = this.pendingMissile;
      p.t -= dt;
      p.dir = p.c.lat < this.lat - 1.5 ? 'left' : p.c.lat > this.lat + 1.5 ? 'right' : 'back';
      if (p.t <= 0) {
        this.pendingMissile = null;
        const mesh = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.4, 8), std('#c9cde0', { metalness: 0.6 }));
        body.rotation.x = Math.PI / 2;
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.2, 8), new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
        flame.rotation.x = -Math.PI / 2;
        flame.position.z = -1.2;
        mesh.add(body, flame);
        this.scene.add(mesh);
        this.missiles.push({ mesh, prog: p.c.prog + 1, lat: p.c.lat, alt: p.c.alt + 1.2, locked: false, tLat: 0, tAlt: 0, dir: p.dir });
        this.audio.sfx('shoot');
      }
    }
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.prog += ((this.speed + M.rel) * dt) / this.step;
      const ahead = (this.prog - m.prog) * this.step; // metri che mancano all'impatto
      // insegue fino a `lock` secondi dall'impatto, poi va dritto sull'ultimo punto: è lì che si scarta
      if (!m.locked && ahead < M.rel * M.lock) {
        m.locked = true;
        m.tLat = this.lat; m.tAlt = this.alt;
        this._callout('Scarta!', 0.8);
        this.audio.sfx('warn');
      }
      const tl = m.locked ? m.tLat : this.lat, ta = m.locked ? m.tAlt : this.alt;
      const rate = 10 * dt;
      m.lat += THREE.MathUtils.clamp(tl - m.lat, -rate, rate);
      m.alt += THREE.MathUtils.clamp(ta - m.alt, -rate, rate);
      m.dir = m.lat < this.lat - 1.5 ? 'left' : m.lat > this.lat + 1.5 ? 'right' : 'back';
      const s = this._sample(m.prog);
      this._point(m.prog, m.lat, 0, m.mesh.position);
      m.mesh.position.y += m.alt;
      m.mesh.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);
      if (ahead <= 0) {
        const d = Math.hypot(this.lat - m.lat, this.alt - m.alt);
        if (d < M.radius) this._hitPlayer(M.damage, 'Colpiti dal missile!');
        else { this._callout('Schivato!', 1); this.audio.sfx('whoosh'); this.shake = Math.max(this.shake, 0.25); }
        this._burst(m.mesh.position, 0xff8a3a);
        this.audio.sfx('boom');
        this.scene.remove(m.mesh);
        this.missiles.splice(i, 1);
      }
    }
  }

  // ---------- cannone ionico e ripari ----------
  _cannon(dt) {
    const C = this.cannon, LC = this.level.cannon;
    if (this.finale) {
      // finale scritto: la barra sale fino a quasi piena mentre ci si avvicina allo spazio vettore
      const left = Math.max(0, (this.endProg - this.prog) * this.step);
      C.charge = Math.min(0.98, 0.82 + 0.16 * (1 - left / LC.finale));
      return;
    }
    if (C.countdown > 0) {
      C.countdown -= dt;
      if (C.countdown <= 0) this._fireBeam();
      return;
    }
    C.charge = Math.min(1, C.charge + dt / LC.charge);
    if (C.charge >= 0.6 && !C.said) { C.said = true; this.emma.say('cannone', { important: true }); }
    if (C.charge >= 1) {
      C.countdown = LC.countdown;
      this.pendingMissile = null;
      this.emma.say('riparo', { important: true });
      this._callout('Riparati!', 1.4);
      this.audio.sfx('warn');
    }
  }

  /** Al sicuro: un riparo poco più avanti, nella stessa corsia, e non più alti di lui. */
  _behindCover() {
    const LC = this.level.cannon;
    return this.covers.some((c) => {
      const ahead = (c.prog - this.prog) * this.step - c.depth / 2;
      return ahead >= -1 && ahead <= LC.safeAhead && Math.abs(this.lat - c.lat) <= c.w / 2 + 0.6 && this.alt <= c.h + 0.3;
    });
  }

  _fireBeam(aim = null) {
    const C = this.cannon, LC = this.level.cannon;
    // il raggio scende inclinato da davanti fino al punto mirato (Emma, o l'imbocco nel finale)
    const target = aim || this.pos.clone();
    const s = this._sample(this.prog);
    const from = target.clone().addScaledVector(s.tangent, 180);
    from.y += 140;
    const len = from.distanceTo(target);
    this.beam.scale.set(1, len, 1);
    this.beam.position.copy(from).add(target).multiplyScalar(0.5);
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _v.copy(from).sub(target).normalize());
    this.beam.visible = true;
    this.beamT = 0.8;
    this.audio.sfx('beam');
    this.shake = Math.max(this.shake, 0.7);
    this.flashAt = this.t;
    C.charge = 0;
    C.said = false;
    if (aim) return;
    if (this._behindCover()) this._callout('Al riparo!', 1.2);
    else this._hitPlayer(LC.damage, 'Raggio ionico!');
  }

  /** Andare a sbattere contro un riparo: si rimbalza indietro e si perde velocità (niente cuori). */
  _coverBumps() {
    for (const c of this.covers) {
      const dp = (this.prog - c.prog) * this.step;
      if (Math.abs(dp) > c.depth / 2 || Math.abs(this.lat - c.lat) > c.w / 2 || this.alt > c.h) continue;
      const back = c.prog - (c.depth / 2 + 0.6) / this.step;
      const p = this._point(back, this.lat, 0);
      this.pos.set(p.x, p.y + this.alt, p.z);
      this.prog = back;
      this.speed = Math.min(this.speed, 5);
      if (this.hitCool <= 0) {
        this.hitCool = 0.8;
        this.shake = Math.max(this.shake, 0.5);
        this.audio.sfx('wall');
        this._callout('Occhio al riparo!', 1);
      }
    }
  }

  _hitPlayer(dmg, label) {
    if (this.invuln > 0 || this.state !== 'play') return;
    this.hearts = Math.max(0, this.hearts - dmg);
    this.invuln = 1.4;
    this.speed *= 0.6;
    this.turbo = 0;
    this.shake = Math.max(this.shake, 0.8);
    this.audio.sfx('hit');
    this._callout(label, 1.3);
    if (this.hearts <= 0) {
      // a cuori finiti si riparte dall'ultimo checkpoint
      this.state = 'down';
      this.stateTimer = 2.4;
      this.speed = 0;
      this._burst(this.pos, 0xff6a2a);
      this.audio.sfx('boom');
      this.emma.clear();
      this.say('Emma: «Colpiti e affondati. Si riparte dall’ultimo checkpoint.»', 2.4);
      return;
    }
    this.emma.say('colpiti');
  }

  _checkpointsChase() {
    for (const cp of this.cpProgs) {
      if (cp > this.cpProg && this.prog >= cp && this.prog < cp + 40) {
        this.cpProg = cp;
        this._callout('Checkpoint', 1.2);
        this.audio.sfx('lap');
      }
    }
  }

  // ---------- finale ----------
  /** Il tuffo: si entra nello spazio vettore e un attimo dopo il raggio colpisce l'imbocco, alle spalle. */
  _enterVortex() {
    this.state = 'portal';
    this.stateTimer = 0.7;
    this.flashAt = this.t;
    this.audio.sfx('whoosh');
    this._fireBeam(this._point(this.endProg - 25 / this.step, 0, 0).clone());
    for (const m of this.missiles) this.scene.remove(m.mesh);
    this.missiles = [];
  }

  _win() {
    this.state = 'won';
    this.stateTimer = 2.8;
    this.audio.sfx('finish');
    this.emma.clear();
    this.emma.say('vittoria', { important: true });
    this.say('Dentro lo spazio vettore!', 2.8);
  }

  hud() {
    const k = this.speed / this.level.maxSpeed;
    const C = this.cannon;
    // avviso con direzione: prima lo "scarta" di un missile agganciato, poi il raggio, poi i missili
    let warn = null;
    const locked = this.missiles.find((m) => m.locked);
    if (locked) warn = { text: 'Scarta!', dir: locked.dir };
    else if (C.countdown > 0) warn = { text: `Riparati! ${Math.ceil(C.countdown)}`, dir: 'down' };
    else if (this.missiles.length) warn = { text: 'Missile in arrivo', dir: this.missiles[0].dir };
    else if (this.pendingMissile) warn = { text: DIRS[this.pendingMissile.dir || 'back'], dir: this.pendingMissile.dir || 'back' };
    if (this.state !== 'play') warn = null;
    return {
      flight: true,
      lives: this.hearts,
      maxLives: this.level.hearts,
      speed: Math.round(this.speed * 3.6),
      speedLines: Math.max(0, Math.min(1, (k - 0.7) * 2.5 + (this.turbo > 0 ? 0.5 : 0))),
      boss: { hp: C.charge, max: 1, name: C.countdown > 0 ? 'Cannone ionico: riparati!' : 'Cannone ionico' },
      warn,
      alarm: this.state === 'play' && (C.countdown > 0 || this.finale),
      callout: this.callout,
      flash: this.flashAt || 0,
      notice: this.notice,
      subtitle: this.emma.subtitle
    };
  }
}
