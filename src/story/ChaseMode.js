import * as THREE from 'three';
import { Assets } from '../core/AssetLoader.js';
import { Track } from '../track/Track.js';
import { trackById } from '../config/tracks.js';
import { FlightMode } from './FlightMode.js';
import { EmmaVoice } from './emma.js';
import { loadRigged } from './Rig.js';

// Inseguimento in volo della Storia (il primo è sul lago di Retah, story/inseguimento.js). Riusa il motore
// del Portale (FlightMode: pista, pilotaggio, scia) e cambia le regole: salute a cuori, checkpoint, due
// blindati (uno guidato dal capo, che parla alla radio) che si alternano in fasi — dietro con i missili,
// di fianco con la spallata, davanti con mine o un muro — poi il cannone ionico e il tuffo nello spazio vettore.
// Tenendo premuto "guarda indietro" la telecamera si gira verso i blindati; di norma li mostra lo specchietto.

const _v = new THREE.Vector3();
const _t = new THREE.Vector3();
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
const DIRS = { left: 'Missile da sinistra!', right: 'Missile da destra!', back: 'Missile da dietro!' };
const clamp = THREE.MathUtils.clamp;
const MIRROR = { w: 280, vw: 0.3, ratio: 0.36, top: 64 }; // specchietto: stessa misura del riquadro in style.css

export class ChaseMode extends FlightMode {
  constructor(opts) {
    super(opts);
    this.missiles = [];
    this.shots = [];
    this.chasers = [];
    this.covers = [];
    this.obstacles = [];
    this.look = 0; // 0 = telecamera avanti, 1 = girata all'indietro
    this.mirrorCam = new THREE.PerspectiveCamera(55, 1 / MIRROR.ratio, 0.4, 600);
    this.paused = false;
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
    this.finalProg = this.endProg - L.final.at / this.step;
    progress('Il capo accende i motori…');
    const [ship, chaser, wreck, boss] = await Promise.all([
      Assets.model(L.model.url, { targetHeight: L.model.h }),
      Assets.model(L.chaserModel.url, { targetHeight: L.chaserModel.h }),
      Assets.model(L.wreckModel.url, { targetHeight: L.wreckModel.h }),
      loadRigged(L.bossModel.url, L.bossModel.h)
    ]);
    this.emma = new EmmaVoice(this.audio, L.voices);
    await this.emma.load();
    this._buildShip(ship);
    this._buildTrail();
    this.chaserProto = chaser;
    this._buildChasers(boss);
    this.wreckProto = wreck;
    this._buildCovers();
    this._buildVortex();
    this._buildBeam();
    this.cpProgs = L.checkpoints.map((t) => this._progOfT(t)).sort((a, b) => a - b);
    this.cpProg = 0;
    // durate delle fasi: un po' diverse a ogni partita
    this.cycles = L.cycles.map((c) => ({ ...c, behind: c.behind + (Math.random() * 2 - 1), flank: c.flank + (Math.random() * 2 - 1), block: c.block + (Math.random() * 2 - 1) }));
    this.restart(true, 0);
    progress('Pronti.');
  }

  /** I due blindati: fari che illuminano il terreno davanti a loro, e sul principale il capo in piedi nella botola. */
  _buildChasers(boss) {
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
      if (d.leader) g.scale.setScalar(1.15);
      // luci: occhio rosso (lampeggia quando sta per attaccare) e due fari che proiettano luce davanti
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a3a }));
      eye.position.set(0, 2.5, 1.4);
      g.add(eye);
      const lamp = new THREE.SpotLight(0xfff0d0, 170, 90, 0.42, 0.6, 1.1);
      lamp.position.set(0, 1.3, 2.4);
      lamp.target.position.set(0, -3, 26);
      g.add(lamp, lamp.target);
      // coni di luce visibili (si vedono anche prima del blindato)
      for (const s of [-0.8, 0.8]) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(3.2, 20, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        cone.rotation.x = -Math.PI / 2 - 0.12;
        cone.position.set(s, 1.1, 12.4);
        g.add(cone);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff4d8 }));
        head.position.set(s, 1.2, 2.4);
        g.add(head);
      }
      let rig = null;
      if (d.leader && boss) {
        // il capo della rete, in piedi nella botola: mezzo busto fuori, pugno alzato
        const b = boss.root;
        b.position.set(0, 1.55, -0.3);
        g.add(b);
        rig = boss.rig;
      }
      this.scene.add(g);
      return { def: d, leader: !!d.leader, group: g, eye, lamp, rig, gap: d.gap, lat: d.lat, alt: 1.4, stun: 0, guard: 0, hp: this.level.chaserHp, prog: 0, mode: 'follow', sub: null, subT: 0, side: 1, hum: null };
    });
    this.leader = this.chasers.find((c) => c.leader) || this.chasers[0];
    this.wing = this.chasers.find((c) => c !== this.leader) || this.chasers[0];
  }

  /** Ripari nel tratto finale: cespugli alti e relitti, con una colonna di luce che si vede da lontano. */
  _buildCovers() {
    const C = this.level.covers, LC = this.level.cannon;
    const total = this.endProg * this.step;
    let i = 0;
    for (let d = total - this.level.final.at + 60; d < total - LC.finale - 60; d += C.every) {
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
        const mat = std(i % 4 === 0 ? '#6a7a3a' : '#7a7a42', { roughness: 0.95, flatShading: true });
        for (let k = 0; k < 7; k++) {
          const r = 1.6 + ((k * 13) % 5) * 0.25;
          const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
          b.position.set(((k * 17) % 5 - 2) * 1.1, 1.3 + (k % 3) * 1.6, ((k * 7) % 3 - 1) * 0.9);
          b.castShadow = true;
          g.add(b);
        }
      }
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 40, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0x43e0b0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      beacon.position.y = h + 20;
      const zone = new THREE.Mesh(new THREE.PlaneGeometry(w + 1.2, LC.safeAhead), new THREE.MeshBasicMaterial({ color: 0x43e0b0, transparent: true, opacity: 0.0, depthWrite: false }));
      zone.rotation.x = -Math.PI / 2;
      zone.position.set(0, 0.08, -LC.safeAhead / 2 - depth / 2);
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
    g.add(new THREE.PointLight(0x7fa4ff, 60, 60, 1.5));
    const s = this._sample(this.endProg);
    const c = this._point(this.endProg, 0, 8);
    g.position.copy(c);
    g.lookAt(_v.copy(c).add(s.tangent));
    this.scene.add(g);
    this.vortex = g;
  }

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
    this.heat = 0; // l'arma si scalda: sparare di continuo la fa fermare per un attimo
    this.overheat = false;
    this.turbo = 0;
    this.shake = 0;
    this.callout = null;
    this.flashAt = this.flashAt || 0;
    this.finale = false;
    this.cannon = { charge: 0, countdown: 0, said: false, fired: false };
    this.missileCool = 3.5;
    this.pendingMissile = null;
    this.nextChaser = 0;
    for (const m of this.missiles) this.scene.remove(m.mesh);
    for (const b of this.shots) this.scene.remove(b.mesh);
    for (const o of this.obstacles) this.scene.remove(o.group);
    this.missiles = [];
    this.shots = [];
    this.obstacles = [];
    for (const c of this.chasers) { c.gap = c.def.gap + 10; c.lat = c.def.lat; c.stun = 0; c.guard = 0; c.hp = L.chaserHp; c.mode = 'follow'; c.sub = null; }
    this.pos = this._point(fromProg, 0, 0).clone();
    this.pos.y += this.alt;
    this.idx = (this.startIdx + Math.floor(fromProg)) % this.N;
    this.trailPts = [];
    this.state = 'play';
    // fasi: dall'inizio si parte dalla prima; da un checkpoint si riprende il giro di fasi in corso
    if (first) { this.cycleIndex = 0; this.threat = 0; this.saidGuard = false; this._sayStart = true; }
    this._setPhase(fromProg >= this.finalProg ? 'final' : 'behind', first ? this.cycles[0].behind : 5);
    this.audio.playTheme(L.music);
    this.audio.setTempo && this.audio.setTempo(1);
    this._placeCamera(1);
  }

  // ---------- fasi ----------
  _setPhase(kind, dur = 0) {
    this.phase = { kind, t: 0, dur, actor: null, said: false };
    const cyc = this.cycles[Math.min(this.cycleIndex, this.cycles.length - 1)];
    if (kind === 'flank') {
      // accosta il gregario la prima volta, il capo la seconda
      const c = this.cycleIndex % 2 === 0 ? this.wing : this.leader;
      c.mode = 'flank'; c.sub = 'approach'; c.subT = 0; c.side = c.lat < this.lat ? -1 : 1; c.rammed = false; c.ramHp = this.level.flank.ramHp;
      this.phase.actor = c;
      this.emma.say('accosta', { important: true });
    } else if (kind === 'block') {
      const c = this.cycleIndex % 2 === 0 ? this.leader : this.wing;
      c.mode = 'block'; c.sub = 'overtake'; c.subT = 0; c.side = c.lat < this.lat ? -1 : 1; c.dropped = false; c.obstacle = cyc.obstacle;
      this.phase.actor = c;
      this.emma.say('taglia', { important: true });
    } else if (kind === 'final') {
      for (const c of this.chasers) if (c.mode !== 'follow') { c.mode = 'follow'; c.sub = null; }
      this.pendingMissile = null;
      this.cannon.charge = 0;
      this.emma.clear();
      this.emma.say('capoCannone', { important: true });
    }
  }

  _phases(dt) {
    const P = this.phase;
    P.t += dt;
    if (P.kind !== 'final' && this.prog >= this.finalProg) return this._setPhase('final');
    if (P.kind === 'behind') {
      // una minaccia del capo a metà di ogni fase 1; al primo giro Emma spiega come guardare indietro
      if (!P.said && P.t > (this.saidGuard ? Math.min(4, P.dur * 0.4) : Math.min(7, P.dur * 0.8))) {
        P.said = true;
        if (!this.saidGuard) { this.saidGuard = true; this.emma.say('guarda', { important: true }); }
        else this.emma.say(['capo1', 'capo2', 'capo3'][this.threat++ % 3], { important: true });
      }
      if (P.t >= P.dur && this.cycleIndex < this.cycles.length) this._setPhase('flank', this.cycles[this.cycleIndex].flank);
    } else if (P.kind === 'flank') {
      if (P.actor.mode === 'follow' || P.t > P.dur + 6) this._setPhase('block', this.cycles[this.cycleIndex].block);
    } else if (P.kind === 'block') {
      if (P.actor.mode === 'follow' || P.t > P.dur + 8) {
        this.cycleIndex++;
        const next = this.cycles[this.cycleIndex];
        this._setPhase('behind', next ? next.behind : 999); // finiti i giri: dietro fino al finale
      }
    }
  }

  // ---------- gioco ----------
  update(dt, input) {
    this.t += dt;
    this.emma.update(dt);
    if (this._sayStart) { this._sayStart = false; this.emma.seq(['start', 'capoArrivo', 'chiParla']); }
    this.noticeTimer = Math.max(0, this.noticeTimer - dt);
    if (this.noticeTimer <= 0) this.notice = null;
    if (this.callout && this.t > this.callout.until) this.callout = null;
    this.track.update(dt, this.t, this.pos);
    this._animate(dt);
    this._engines();

    if (this.state !== 'play') {
      this.stateTimer -= dt;
      this.look = THREE.MathUtils.damp(this.look, 0, 8, dt);
      if (this.state !== 'down') this._move(dt, { ax: 0, ay: 0, brake: false });
      this._chasers(dt);
      this._placeCamera(dt);
      if (this.stateTimer <= 0) {
        if (this.state === 'portal') this._win();
        else if (this.state === 'won') { this.state = 'ended'; this._stopEngines(); this.onComplete && this.onComplete(null); }
        else if (this.state === 'down') this.restart(false, this.cpProg);
      }
      return;
    }

    // guarda indietro (tenuto): telecamera girata, sterzo meno preciso
    const back = !!input.lookHeld;
    this.look = THREE.MathUtils.damp(this.look, back ? 1 : 0, 9, dt);
    let ax = input.axisX;
    if (this.look > 0.5) ax = ax * this.level.lookBackSteer + Math.sin(this.t * 7.3) * 0.12;
    const ctl = { ax, ay: input.axisY, brake: !!input.chaseBrake };
    input.jumpPressed = input.upPressed = input.itemPressed = input.attackPressed = false;
    this.hitCool = Math.max(0, this.hitCool - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this._move(dt, ctl);
    // sparo: spazio (tenuto = raffica): avanti mira a ciò che c'è davanti, guardando indietro ai blindati
    this.shootCool -= dt;
    const W = this.level.weapon;
    this.heat = Math.max(0, this.heat - dt * W.cool);
    if (this.overheat && this.heat < W.resume) this.overheat = false;
    if (input.jumpHeld && this.shootCool <= 0 && !this.overheat) {
      this.shootCool = W.every;
      this._shoot(this.look > 0.5);
      this.heat += W.heat;
      if (this.heat >= 1) { this.heat = 1; this.overheat = true; this._callout('Arma surriscaldata!', 1); this.audio.sfx('back'); }
    }
    this._phases(dt);
    this._shots(dt);
    this._chasers(dt);
    this._missiles(dt);
    this._obstaclesUpdate(dt);
    this._cannon(dt);
    this._coverBumps();
    this._checkpointsChase();
    const left = (this.endProg - this.prog) * this.step;
    if (!this.finale && left < this.level.cannon.finale) {
      this.finale = true;
      this.pendingMissile = null;
      this.cannon.countdown = 0;
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
    const alert = this.cannon && (this.cannon.countdown > 0 || this.cannon.charge > 0.85);
    for (const c of this.covers) {
      c.beacon.material.opacity = alert ? 0.55 + Math.sin(this.t * 10) * 0.25 : 0.28 + Math.sin(this.t * 2 + c.prog) * 0.08;
      c.zone.material.opacity = alert ? 0.18 + Math.sin(this.t * 10) * 0.08 : 0;
    }
    for (const o of this.obstacles) {
      o.group.rotation.z = 0;
      if (o.kind === 'mines') for (const m of o.mines) if (m.alive) { m.mesh.rotation.y += dt * 2; m.mesh.material.emissiveIntensity = 1.6 + Math.sin(this.t * 9 + m.lat) * 0.8; }
      if (o.kind === 'wall' && o.alive) o.tex.offset.y -= dt * 0.8;
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

  // ---------- motori dei blindati: più forti quando sono vicini, a destra o a sinistra ----------
  _engines() {
    for (const c of this.chasers) {
      if (!c.hum && this.audio.hum) c.hum = this.audio.hum(c.leader ? 44 : 52);
      if (!c.hum) continue;
      if (this.paused || this.state === 'won' || this.state === 'ended') { c.hum.set(0); continue; }
      const d = c.group.position.distanceTo(this.pos);
      const near = clamp(1 - d / 110, 0, 1);
      const rel = c.lat - this.lat;
      c.hum.set(0.02 + near * near * 0.32, clamp(rel / 9, -1, 1) * (this.look > 0.5 ? -1 : 1), 1 + near * 0.25);
    }
  }

  _stopEngines() { for (const c of this.chasers) if (c.hum) { c.hum.stop(); c.hum = null; } }

  /** Menu di gioco aperto o chiuso (main.js): i motori dei blindati tacciono. */
  pause(on) { this.paused = on; this._engines(); }

  // ---------- sparo ----------
  _shoot(back) {
    // guardando indietro: il blindato dietro più vicino; avanti: mine, nucleo del muro, blindati davanti o di fianco
    let target = null, best = Infinity;
    const consider = (kind, ref, p, maxD) => { const d = p.distanceTo(this.pos); if (d < maxD && d < best) { best = d; target = { kind, ref }; } };
    for (const c of this.chasers) {
      const behind = c.gap > 2, ahead = c.gap < 2;
      if (back ? behind : ahead) consider('chaser', c, c.group.position, 150);
    }
    if (!back) for (const o of this.obstacles) {
      if ((o.prog - this.prog) * this.step < 3) continue;
      if (o.kind === 'mines') for (const m of o.mines) if (m.alive) consider('mine', m, m.mesh.getWorldPosition(_t), 140);
      if (o.kind === 'wall' && o.alive) consider('core', o, o.core.getWorldPosition(_t), 160);
    }
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0x9fffe0 }));
    mesh.position.copy(this.pos);
    this.scene.add(mesh);
    const dir = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)).multiplyScalar(back ? -1 : 1);
    this.shots.push({ mesh, target, dir, life: 1.4, back });
    this.audio.sfx('shoot');
  }

  _targetPos(tg, out) {
    if (tg.kind === 'chaser') return out.copy(tg.ref.group.position).setY(tg.ref.group.position.y + 1.4);
    if (tg.kind === 'mine') return tg.ref.mesh.getWorldPosition(out);
    return tg.ref.core.getWorldPosition(out);
  }

  _targetAlive(tg) {
    if (tg.kind === 'chaser') return true;
    if (tg.kind === 'mine') return tg.ref.alive;
    return tg.ref.alive;
  }

  _shots(dt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      let done = s.life <= 0;
      if (s.target && this._targetAlive(s.target)) {
        this._targetPos(s.target, _v).sub(s.mesh.position);
        const d = _v.length();
        if (d < 2.2) {
          done = true;
          if (s.target.kind === 'chaser') this._chaserHit(s.target.ref);
          else if (s.target.kind === 'mine') this._mineDown(s.target.ref);
          else this._coreHit(s.target.ref);
        } else s.mesh.position.addScaledVector(_v.normalize(), Math.min(d, 125 * dt));
      } else s.mesh.position.addScaledVector(s.dir, (s.back ? 90 : this.speed + 90) * dt);
      if (done) { this.scene.remove(s.mesh); this.shots.splice(i, 1); }
    }
  }

  /**
   * Colpo su un blindato: scintille; dopo chaserHp colpi è "preso": rallenta, resta indietro e per un po' non
   * attacca (se stava accostando o tagliando la strada, rinuncia). Poi ha qualche secondo di corazza.
   */
  _chaserHit(c) {
    const at = c.group.position.clone().setY(c.group.position.y + 1.4);
    // mentre accosta o sorpassa è corazzato (scintille azzurre): si colpisce quando carica o dopo
    const armored = (c.mode === 'flank' && c.sub === 'approach') || (c.mode === 'block' && c.sub === 'overtake');
    if (c.stun > 0 || c.guard > 0 || armored) { this._burst(at, 0x9fe0ff); return; }
    if (c.mode === 'flank' && c.sub === 'aim') {
      // colpito mentre carica la spallata: con abbastanza colpi rinuncia
      c.ramHp--;
      this._burst(at, 0xffe0a0);
      if (c.ramHp > 0) { this.audio.sfx('wall'); return; }
      c.sub = 'retreat'; c.subT = 0; c.stun = 1.5; c.guard = 4;
      this.audio.sfx('boom');
      this._callout('Spallata annullata!', 1.1);
      this.emma.say('preso');
      return;
    }
    c.hp--;
    if (c.hp > 0) { this._burst(at, 0xffe0a0); this.audio.sfx('wall'); return; }
    c.hp = this.level.chaserHp;
    c.stun = 2.2;
    c.guard = 2.2 + 3.5;
    if (c.mode === 'flank') c.sub = 'retreat';
    else if (c.mode === 'block' && c.sub === 'overtake') c.sub = 'fallback'; // abbattuto prima di lasciare l'ostacolo
    else if (c.mode === 'follow') c.gap += 30;
    this._burst(at, 0xffb040);
    this.audio.sfx('boom');
    this._callout('Preso uno!', 1.1);
    this.emma.say('preso');
    if (c.leader) this.emma.say(['capo1', 'capo2', 'capo3'][this.threat++ % 3]); // il capo non la prende bene
  }

  // ---------- blindati ----------
  _chasers(dt) {
    const L = this.level, F = L.flank, hw = this.track.wallDist - 3;
    for (const c of this.chasers) {
      c.stun = Math.max(0, c.stun - dt);
      c.guard = Math.max(0, c.guard - dt);
      c.subT += dt;
      let targetGap = this.finale ? c.def.gap * 0.45 : c.def.gap, targetLat = this.lat + c.def.lat, rel = 0, latRate = 1.2;
      if (c.mode === 'flank') {
        // fase 2: accosta di lato, carica la spallata (luci che lampeggiano), scatta verso Emma, poi torna dietro
        if (c.sub === 'approach') {
          targetGap = -1; targetLat = this.lat + c.side * F.side; latRate = 2;
          if (Math.abs(c.gap + 1) < 1.5 && Math.abs(c.lat - targetLat) < 1.2) { c.sub = 'aim'; c.subT = 0; this.audio.sfx('warn'); this._callout('Spallata!', 0.9); }
        } else if (c.sub === 'aim') {
          targetGap = -1; targetLat = this.lat + c.side * F.side; latRate = 3;
          if (c.subT >= F.aim) { c.sub = 'ram'; c.subT = 0; c.ramFrom = c.lat; }
        } else if (c.sub === 'ram') {
          targetGap = -1;
          c.lat -= c.side * F.ramSpeed * dt;
          targetLat = c.lat; latRate = 0;
          const hitNow = Math.abs(c.gap) < 4 && Math.abs(c.lat - this.lat) < 2.4 && Math.abs(c.alt + 0.6 - this.alt) < 2.6;
          if (hitNow && !c.rammed) {
            c.rammed = true;
            this._hitPlayer(F.damage, 'Spallata!');
            this.pos.addScaledVector(this._sample(this.prog).right, -c.side * 2.5); // spinti di lato
            c.sub = 'retreat'; c.subT = 0;
          } else if (c.subT >= F.ram) {
            if (!c.rammed) { this._callout('Schivato!', 1); this.audio.sfx('whoosh'); }
            c.sub = 'retreat'; c.subT = 0;
          }
        } else if (c.sub === 'retreat') {
          if (c.gap > c.def.gap - 6) { c.mode = 'follow'; c.sub = null; }
        }
        if (c.sub !== 'retreat') rel = 14; // velocità massima di avvicinamento
      } else if (c.mode === 'block') {
        // fase 3: sorpassa dall'altra parte, a `drop` m davanti lascia l'ostacolo, poi si fa superare e torna dietro
        const B = L.block;
        if (c.sub === 'overtake') {
          targetGap = -B.drop - 10;
          targetLat = c.gap > -25 ? this.lat + c.side * 7 : 0; latRate = 2;
          rel = this.level.block.overtake;
          if (c.gap <= -B.drop && !c.dropped) { c.dropped = true; this._dropObstacle(c); c.sub = 'hold'; c.subT = 0; }
        } else if (c.sub === 'hold') {
          targetGap = c.gap; targetLat = 0;
          if (c.subT > 1.2) { c.sub = 'fallback'; c.subT = 0; }
        } else if (c.sub === 'fallback') {
          // si fa superare lungo il bordo, lontano da Emma
          targetLat = this.lat > 0 ? -hw + 1 : hw - 1; latRate = 1.6;
          if (c.gap > c.def.gap - 6) { c.mode = 'follow'; c.sub = null; }
        }
      }
      // velocità relativa: verso la distanza voluta; se Emma frena si avvicinano (in coda non speronano)
      let v = L.maxSpeed * 0.96 + (c.gap - targetGap) * 0.8;
      if (rel) v = this.speed + clamp((c.gap - targetGap) * 1.2, -rel, rel);
      v = clamp(v, 6, L.maxSpeed * 2);
      if (c.stun > 0) v = Math.min(v, this.speed * 0.6);
      if (this.state === 'down') v = this.speed;
      c.gap += (this.speed - v) * dt;
      if (c.mode === 'follow') c.gap = Math.max(14, c.gap);
      if (latRate) c.lat = THREE.MathUtils.damp(c.lat, clamp(targetLat, -hw, hw), latRate, dt);
      c.lat = clamp(c.lat, -hw, hw);
      c.alt = 1.4 + Math.sin(this.t * 1.7 + c.def.gap) * 0.3;
      c.prog = Math.min(this.prog - c.gap / this.step, this.endProg - 10);
      const s = this._sample(c.prog);
      this._point(c.prog, c.lat, c.alt, c.group.position);
      c.group.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);
      c.group.rotation.z = c.stun > 0 ? Math.sin(this.t * 20) * 0.1 : c.sub === 'ram' ? -c.side * 0.2 : 0;
      const warnLight = (this.pendingMissile && this.pendingMissile.c === c) || c.sub === 'aim';
      c.eye.visible = warnLight ? Math.sin(this.t * 30) > 0 : true;
      // contatto qualunque (non la spallata): si viene spinti via, senza perdere cuori
      if (this.state === 'play' && c.sub !== 'ram' && Math.abs(c.gap) < 3.5 && Math.abs(c.lat - this.lat) < 2.4 && Math.abs(c.alt + 0.6 - this.alt) < 2.4) {
        this.pos.addScaledVector(s.right, Math.sign(this.lat - c.lat || 1) * 0.15);
        this.speed *= 0.99;
      }
      // il capo agita il pugno dalla botola
      if (c.rig) c.rig.apply({ armR: { x: -2.6 + Math.sin(this.t * 9) * 0.35, z: -0.2 }, foreArmR: { x: -0.6 }, armL: { x: -0.3, z: 0.4 }, spine: { x: -0.1, y: Math.sin(this.t * 2) * 0.2 }, head: { x: -0.1 } });
    }
  }

  // ---------- ostacoli della fase 3 ----------
  /** Il blindato davanti lascia dietro di sé una fila di mine (con un varco) o un muro di energia. */
  _dropObstacle(c) {
    const B = this.level.block;
    const prog = c.prog - 6 / this.step;
    const s = this._sample(prog);
    const g = new THREE.Group();
    const base = this._point(prog, 0, 0);
    g.position.copy(base);
    g.lookAt(_v.copy(base).add(s.tangent));
    const o = { kind: c.obstacle, prog, group: g, passed: false, alive: true };
    // colonna rossa che si vede da lontano
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 30, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xff3a4a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beacon.position.set(0, 15, 0);
    g.add(beacon);
    if (o.kind === 'mines') {
      const gapIdx = Math.floor(Math.random() * B.mines.lats.length);
      o.mines = B.mines.lats.filter((_, i) => i !== gapIdx).map((lat, i) => {
        const alt = B.mines.alt[0] + ((i * 37) % 10) / 10 * (B.mines.alt[1] - B.mines.alt[0]);
        const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), new THREE.MeshStandardMaterial({ color: 0x2a0a0e, emissive: 0xff2a3a, emissiveIntensity: 2, flatShading: true }));
        mesh.position.set(-lat, alt, 0); // il gruppo guarda lungo la pista: la sua +X è la sinistra della pista
        g.add(mesh);
        return { lat, alt, mesh, alive: true };
      });
    } else {
      const hw = this.track.wallDist + 1, h = B.wall.a1;
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const x = cv.getContext('2d');
      x.fillStyle = 'rgba(255,40,90,0.5)'; x.fillRect(0, 0, 64, 64);
      x.fillStyle = 'rgba(255,220,240,0.9)'; for (let i = 0; i < 64; i += 16) x.fillRect(0, i, 64, 3);
      o.tex = new THREE.CanvasTexture(cv); o.tex.wrapS = o.tex.wrapT = THREE.RepeatWrapping; o.tex.repeat.set(hw / 3, h / 3);
      o.wall = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, h), new THREE.MeshBasicMaterial({ map: o.tex, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      o.wall.position.y = h / 2;
      o.core = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), new THREE.MeshStandardMaterial({ color: 0x220010, emissive: 0xffd45a, emissiveIntensity: 2.5 }));
      o.core.position.y = h + 0.8; // il generatore sopra il muro: si abbatte sparando
      o.coreHp = B.wall.coreHp;
      o.a1 = h;
      g.add(o.wall, o.core);
    }
    this.scene.add(g);
    this.obstacles.push(o);
    this.audio.sfx('warn');
  }

  _mineDown(m) {
    m.alive = false;
    m.mesh.visible = false;
    this._burst(m.mesh.getWorldPosition(_t).clone(), 0xff8a3a);
    this.audio.sfx('boom');
  }

  _coreHit(o) {
    o.coreHp--;
    this._burst(o.core.getWorldPosition(_t).clone(), 0xffe0a0);
    if (o.coreHp > 0) { this.audio.sfx('wall'); return; }
    o.alive = false;
    o.wall.visible = o.core.visible = false;
    this.audio.sfx('boom');
    this._callout('Muro abbattuto!', 1.1);
  }

  _obstaclesUpdate() {
    const B = this.level.block;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      if (!o.passed && this.prog >= o.prog) {
        o.passed = true;
        if (o.kind === 'mines') {
          const hit = o.mines.find((m) => m.alive && Math.abs(m.lat - this.lat) < B.mines.r && Math.abs(m.alt - this.alt) < B.mines.r);
          if (hit) { this._mineDown(hit); this._hitPlayer(B.damage, 'Mina!'); }
          else if (o.mines.some((m) => m.alive && Math.abs(m.lat - this.lat) < B.mines.r + 1.5 && Math.abs(m.alt - this.alt) < B.mines.r + 1.5)) { this._callout('Sfiorata!', 0.9); this.audio.sfx('whoosh'); }
        } else if (o.alive) {
          if (this.alt < o.a1) { this._hitPlayer(B.damage, 'Muro di energia!'); this.audio.sfx('wall'); }
          else { this._callout('Sopra il muro!', 0.9); this.audio.sfx('whoosh'); }
        }
      }
      if (o.passed && this.prog > o.prog + 80 / this.step) { this.scene.remove(o.group); this.obstacles.splice(i, 1); }
    }
  }

  // ---------- missili (fase 1) ----------
  _missiles(dt) {
    const M = this.level.missile;
    if (this.phase.kind === 'behind' && !this.finale) {
      this.missileCool -= dt;
      if (!this.pendingMissile && this.missileCool <= 0) {
        const ready = this.chasers.filter((c) => c.stun <= 0 && c.mode === 'follow');
        if (ready.length) {
          const c = ready[this.nextChaser++ % ready.length];
          this.pendingMissile = { c, t: M.warn };
          this.audio.sfx('warn');
          if (!this.saidMissile) { this.saidMissile = true; this.emma.say('missile', { important: true }); }
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
      const ahead = (this.prog - m.prog) * this.step;
      if (!m.locked && ahead < M.rel * M.lock) {
        m.locked = true;
        m.tLat = this.lat; m.tAlt = this.alt;
        this._callout('Scarta!', 0.8);
        this.audio.sfx('warn');
      }
      const tl = m.locked ? m.tLat : this.lat, ta = m.locked ? m.tAlt : this.alt;
      const rate = 10 * dt;
      m.lat += clamp(tl - m.lat, -rate, rate);
      m.alt += clamp(ta - m.alt, -rate, rate);
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

  // ---------- cannone ionico e ripari (fase finale) ----------
  _cannon(dt) {
    const C = this.cannon, LC = this.level.cannon;
    if (this.phase.kind !== 'final') return;
    if (this.finale) {
      const left = Math.max(0, (this.endProg - this.prog) * this.step);
      C.charge = Math.min(0.98, 0.82 + 0.16 * (1 - left / LC.finale));
      return;
    }
    if (C.fired) return; // un colpo solo, poi la barra risale nel tratto finale
    if (C.countdown > 0) {
      C.countdown -= dt;
      if (C.countdown <= 0) this._fireBeam();
      return;
    }
    C.charge = Math.min(1, C.charge + dt / LC.charge);
    if (C.charge >= 1) {
      C.countdown = LC.countdown;
      this.emma.say('riparo', { important: true });
      this._callout('Riparati!', 1.4);
      this.audio.sfx('warn');
    }
  }

  _behindCover() {
    const LC = this.level.cannon;
    return this.covers.some((c) => {
      const ahead = (c.prog - this.prog) * this.step - c.depth / 2;
      return ahead >= -1 && ahead <= LC.safeAhead && Math.abs(this.lat - c.lat) <= c.w / 2 + 0.6 && this.alt <= c.h + 0.3;
    });
  }

  _fireBeam(aim = null) {
    const C = this.cannon, LC = this.level.cannon;
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
    if (aim) return;
    C.charge = 0;
    C.fired = true;
    if (this._behindCover()) this._callout('Al riparo!', 1.2);
    else this._hitPlayer(LC.damage, 'Raggio ionico!');
  }

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
  _enterVortex() {
    this.state = 'portal';
    this.stateTimer = 0.7;
    this.flashAt = this.t;
    this.audio.sfx('whoosh');
    this._fireBeam(this._point(this.endProg - 25 / this.step, 0, 0).clone());
    for (const m of this.missiles) this.scene.remove(m.mesh);
    this.missiles = [];
    // il capo, alla radio, non la prende bene
    this.emma.clear();
    this.emma.say('capoVettore', { important: true });
  }

  _win() {
    this.state = 'won';
    this.stateTimer = 5;
    this.audio.sfx('finish');
    this.emma.say('vittoria', { important: true });
    this.say('Dentro lo spazio vettore!', 2.8);
  }

  // ---------- telecamera e specchietto ----------
  /** Dietro la navicella; tenendo "guarda indietro" si gira davanti a lei e inquadra i blindati. */
  _placeCamera(dt) {
    const f = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const k = this.look;
    const fwdPos = _v.copy(this.pos).addScaledVector(f, -10);
    fwdPos.y += 3.8;
    const backPos = _t.copy(this.pos).addScaledVector(f, 7.5);
    backPos.y += 3.4;
    const pos = fwdPos.lerp(backPos, k);
    const snap = dt >= 1 ? 1 : Math.min(1, dt * (k > 0.05 && k < 0.95 ? 12 : 6));
    this.camera.position.lerp(pos, snap);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - (dt >= 1 ? 1 : dt) * 1.8);
      const a = this.shake * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * a;
      this.camera.position.y += (Math.random() - 0.5) * a;
    }
    const look = new THREE.Vector3().copy(this.pos).addScaledVector(f, THREE.MathUtils.lerp(8, -26, k));
    look.y += THREE.MathUtils.lerp(0.8, 0.4, k);
    this.camera.lookAt(look);
    const fov = 62 + (this.speed / this.level.maxSpeed) * 10 * (1 - k) + (this.turbo > 0 ? 8 : 0);
    const cur = this.camera.fov + (fov - this.camera.fov) * Math.min(1, (dt >= 1 ? 1 : dt) * 4);
    if (Math.abs(this.camera.fov - cur) > 0.05) { this.camera.fov = cur; this.camera.updateProjectionMatrix(); }
  }

  /** Riquadro dello specchietto in pixel CSS (stessa formula del riquadro disegnato in style.css). */
  static mirrorRect(w, h) {
    const mw = Math.min(MIRROR.w, w * MIRROR.vw), mh = mw * MIRROR.ratio;
    return { x: (w - mw) / 2, y: h - MIRROR.top - mh, w: mw, h: mh };
  }

  /** Dopo la scena principale (main.js): lo specchietto, che mostra cosa c'è dietro quando si guarda avanti. */
  renderOverlay(renderer) {
    if (!this.showMirror()) return;
    const el = renderer.domElement;
    const r = ChaseMode.mirrorRect(el.clientWidth, el.clientHeight);
    const f = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const cam = this.mirrorCam;
    cam.position.copy(this.pos).addScaledVector(f, 0.5);
    cam.position.y += 2.2;
    cam.lookAt(_v.copy(this.pos).addScaledVector(f, -40).setY(this.pos.y + 0.8));
    cam.aspect = r.w / r.h;
    cam.updateProjectionMatrix();
    const shadows = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false; // le ombre sono già pronte dal fotogramma principale
    renderer.setScissorTest(true);
    renderer.setScissor(r.x, r.y, r.w, r.h);
    renderer.setViewport(r.x, r.y, r.w, r.h);
    this.ship.visible = false;
    renderer.render(this.scene, cam);
    this.ship.visible = true;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, el.clientWidth, el.clientHeight);
    renderer.shadowMap.autoUpdate = shadows;
  }

  showMirror() { return this.state === 'play' && this.look < 0.4; }

  /** Quanto sono vicini i blindati (0 lontani, 1 addosso) e dove sono, per l'indicatore sotto lo specchietto. */
  _pursuit() {
    let near = 0, where = 'dietro';
    for (const c of this.chasers) {
      const d = Math.abs(c.gap) + Math.abs(c.lat - this.lat) * 0.5;
      const k = clamp(1 - (d - 3) / 70, 0, 1);
      if (k > near) { near = k; where = c.gap < -6 ? 'davanti' : c.gap < 8 ? 'di fianco' : 'dietro'; }
    }
    return { near, where };
  }

  hud() {
    const k = this.speed / this.level.maxSpeed;
    const C = this.cannon;
    let warn = null;
    const locked = this.missiles.find((m) => m.locked);
    const flanker = this.chasers.find((c) => c.mode === 'flank' && (c.sub === 'approach' || c.sub === 'aim' || c.sub === 'ram'));
    const blocker = this.chasers.find((c) => c.mode === 'block' && c.sub === 'overtake');
    const obst = this.obstacles.find((o) => !o.passed && (o.kind === 'wall' ? o.alive : o.mines.some((m) => m.alive)));
    if (locked) warn = { text: 'Scarta!', dir: locked.dir };
    else if (flanker) warn = { text: flanker.sub === 'approach' ? (flanker.side < 0 ? 'Accosta da sinistra!' : 'Accosta da destra!') : 'Spallata!', dir: flanker.side < 0 ? 'left' : 'right' };
    else if (C.countdown > 0) warn = { text: `Riparati! ${Math.ceil(C.countdown)}`, dir: 'down' };
    else if (obst) warn = { text: obst.kind === 'wall' ? 'Muro di energia: sopra o abbattilo!' : 'Mine davanti: passa nel varco!', dir: 'up' };
    else if (blocker) warn = { text: 'Ti sta superando!', dir: blocker.side < 0 ? 'left' : 'right' };
    else if (this.missiles.length) warn = { text: 'Missile in arrivo', dir: this.missiles[0].dir };
    else if (this.pendingMissile) warn = { text: DIRS[this.pendingMissile.dir || 'back'], dir: this.pendingMissile.dir || 'back' };
    if (this.state !== 'play') warn = null;
    const radio = this.emma.subtitle && this.emma.speaker === 'capo';
    return {
      flight: true,
      lives: this.hearts,
      maxLives: this.level.hearts,
      speed: Math.round(this.speed * 3.6),
      speedLines: this.look > 0.5 ? 0 : Math.max(0, Math.min(1, (k - 0.7) * 2.5 + (this.turbo > 0 ? 0.5 : 0))),
      boss: this.phase && this.phase.kind === 'final' ? { hp: C.charge, max: 1, name: C.countdown > 0 ? 'Cannone ionico: riparati!' : 'Cannone ionico' } : null,
      warn,
      alarm: this.state === 'play' && (C.countdown > 0 || this.finale),
      callout: this.callout,
      flash: this.flashAt || 0,
      notice: this.notice,
      subtitle: this.emma.subtitle,
      radio: radio ? { portrait: this.level.radioPortrait, name: this.level.radioName } : null,
      mirror: this.showMirror(),
      pursuit: this.state === 'play' ? this._pursuit() : null,
      heat: this.state === 'play' ? { v: this.heat, hot: this.overheat } : null,
      lookBack: this.state === 'play' && this.look > 0.5
    };
  }

  dispose() {
    this._stopEngines();
    super.dispose();
  }
}
