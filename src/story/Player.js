import * as THREE from 'three';
import { faceTexture } from '../core/Textures.js';
import { locomotionPose } from './Rig.js';

// Fisica: salto ≈ 3 m di altezza, ≈ 6 m in lungo da fermo a terra (vedi stadio.js)
const GRAV = 34;
const JUMP_V = 14.2;
const RUN = 7.5;
const ACC_GROUND = 60;
const ACC_AIR = 32;
const CLIMB = 4.6;
const COYOTE = 0.1;
const BUFFER = 0.13;
export const PLAYER_W = 0.8;
export const PLAYER_H = 1.7;
// scivolata: più bassa, più veloce, dura poco (si prolunga se c'è un soffitto sopra)
const SLIDE_H = 0.85;
const SLIDE_T = 0.6;
const SLIDE_V = 9.5;
// appigli (scalata): appesi con le mani, ci si sposta di lato
const HANG_SPEED = 3.2;

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...extra });

/**
 * Whiskey in versione platform. Con il modello della Storia (story/characters/<id>.glb, vedi Rig.js) anima
 * le ossa vere, o il corpo intero se il modello non ha scheletro; senza file ripiega sulla versione
 * procedurale con la faccia di faceTexture.
 */
export class Player {
  constructor(character, rigged = null) {
    this.character = character;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.standingOn = null;
    this.climbing = null;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.invuln = 0;
    this.throwAnim = 0;
    this.walkPhase = 0;
    this.sliding = 0;
    this.boosted = false;
    this.hanging = null; // fila di appigli a cui si è appesi
    this.hangCool = 0;
    this.group = new THREE.Group();
    this.squash = 0;
    if (rigged) this._buildRig(rigged);
    else this._build(character);
  }

  _buildRig({ root: model, rig }) {
    const root = new THREE.Group();
    this.group.add(root);
    this.root = root;
    this.body = model; // si schiaccia e rimbalza; le ossa fanno il resto
    root.add(model);
    this.rig = rig;
    // bottiglia che compare accanto alla mano destra al momento del lancio
    this.handBottle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.34, 8), std('#3f9a5a', { roughness: 0.2, transparent: true, opacity: 0.9 }));
    this.handBottle.position.set(-0.35, 1.5, 0.15);
    this.handBottle.visible = false;
    root.add(this.handBottle);
  }

  _build(c) {
    const col = c.colors;
    const root = new THREE.Group(); // ruota per guardare a destra/sinistra
    this.group.add(root);
    this.root = root;
    const skin = std(col.skin), primary = std(col.primary), secondary = std(col.secondary), dark = std('#1d1d26');
    // gambe (pivot all'anca)
    this.legs = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.16, 0.78, 0);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.66, 10), dark);
      leg.position.y = -0.36;
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.34), secondary);
      shoe.position.set(0, -0.7, 0.06);
      pivot.add(leg, shoe);
      root.add(pivot);
      this.legs.push(pivot);
    }
    // busto
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.34, 6, 14), primary);
    torso.position.y = 1.08;
    root.add(torso);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 14), secondary);
    belt.position.y = 0.86;
    root.add(belt);
    // braccia (pivot alla spalla)
    this.arms = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.36, 1.3, 0);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.52, 8), primary);
      arm.position.y = -0.27;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), skin);
      hand.position.y = -0.55;
      pivot.add(arm, hand);
      root.add(pivot);
      this.arms.push(pivot);
    }
    // testa: la faccia di Whiskey (simbolo fisso di faceTexture)
    const headM = new THREE.MeshStandardMaterial({ map: faceTexture(col.skin, { blush: c.id === 'bacco', sly: c.id !== 'divoratore' }), roughness: 0.6 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 24, 20), headM);
    head.position.y = 1.66;
    head.rotation.y = Math.PI; // la faccia guarda avanti (+Z), come nel kart
    root.add(head);
    this.head = head;
    this._hair(c, root);
    // bottiglia in mano durante il lancio
    this.handBottle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 8), std('#3f9a5a', { roughness: 0.2, transparent: true, opacity: 0.9 }));
    this.handBottle.position.y = -0.62;
    this.handBottle.visible = false;
    this.arms[1].add(this.handBottle);
    root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }

  _hair(c, root) {
    const hair = std(c.colors.hair, { roughness: 0.9 });
    const look = c.look || {};
    const y = 1.66;
    if (look.hair === 'long') {
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.62, 0.22), hair);
      back.position.set(0, y - 0.12, -0.2);
      root.add(back);
    }
    if (['wild', 'curly', 'shaggy'].includes(look.hair)) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), hair);
        b.position.set(Math.cos(a) * 0.22, y + 0.2 + Math.sin(i * 1.7) * 0.04, Math.sin(a) * 0.22 - 0.05);
        root.add(b);
      }
    }
    if (look.hat === 'turban') {
      const t = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(c.colors.primary));
      t.position.y = y + 0.08;
      t.scale.set(1.08, 0.8, 1.08);
      root.add(t);
    } else if (look.hat === 'brim') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 20), std('#2a2230'));
      brim.position.y = y + 0.22;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.26, 16), std('#2a2230'));
      top.position.y = y + 0.36;
      root.add(brim, top);
    } else if (look.hat === 'vine') {
      const v = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 6, 18), std('#3f8a3a'));
      v.rotation.x = Math.PI / 2;
      v.position.y = y + 0.2;
      root.add(v);
    }
  }

  reset(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.climbing = null;
    this.onGround = false;
    this.standingOn = null;
    this.sliding = 0;
    this.boosted = false;
    this.hanging = null;
  }

  /** Altezza attuale: più bassa durante la scivolata (si passa sotto saracinesche e ostacoli bassi). */
  get h() { return this.sliding > 0 ? SLIDE_H : PLAYER_H; }

  box(out = {}) {
    out.x0 = this.x - PLAYER_W / 2; out.x1 = this.x + PLAYER_W / 2;
    out.y0 = this.y; out.y1 = this.y + this.h;
    return out;
  }

  /** Spinta dal basso (getto di vapore): il salto non si accorcia lasciando il tasto. */
  launch(vy) {
    this.vy = vy;
    this.onGround = false;
    this.boosted = true;
    this.climbing = null;
    this.sliding = 0;
  }

  /** C'è spazio per rialzarsi? (un soffitto basso sopra la testa prolunga la scivolata) */
  _canStand(level) {
    const x0 = this.x - PLAYER_W / 2, x1 = this.x + PLAYER_W / 2, y0 = this.y + SLIDE_H, y1 = this.y + PLAYER_H;
    return !level.solids.some((s) => x1 > s.x0 && x0 < s.x1 && y1 > s.y0 && y0 < s.y1);
  }

  /**
   * ctl: { ax, ay, jumpPressed, jumpHeld, upPressed }; level: { solids, platforms, ladders }.
   * Ritorna gli eventi del passo ('jump', 'land').
   */
  update(dt, ctl, level) {
    const events = [];
    // livelli onirici: gravità ridotta (gravityScale), passo lento (speedScale), niente salto (noJump)
    const G = GRAV * (level.gravityScale || 1), RUNS = RUN * (level.speedScale || 1);
    if (level.noJump) { ctl = { ...ctl, jumpPressed: false, upPressed: false, jumpHeld: false }; }
    this.invuln = Math.max(0, this.invuln - dt);
    this.throwAnim = Math.max(0, this.throwAnim - dt);
    if (ctl.jumpPressed) this.jumpBuffer = BUFFER;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.hangCool = Math.max(0, this.hangCool - dt);

    // ---- appigli: appesi con le mani (level.holds: file { x0, x1, y } con y = altezza delle mani) ----
    if (this.hanging) {
      const H = this.hanging;
      this.vx = ctl.ax * HANG_SPEED;
      this.x += this.vx * dt;
      this.y = H.y - PLAYER_H - 0.1;
      this.vy = 0;
      this.onGround = false;
      this.standingOn = null;
      if (Math.abs(ctl.ax) > 0.1) this.facing = Math.sign(ctl.ax);
      const off = this.x < H.x0 - 0.2 || this.x > H.x1 + 0.2;
      if (ctl.jumpPressed || off || (ctl.ay < -0.5 && this.hangT > 0.25)) {
        // si lascia: con Salta si dà una spinta verso l'alto, con Giù (o finiti gli appigli) si cade
        this.hanging = null;
        this.hangCool = 0.35;
        if (ctl.jumpPressed && !off) { this.vy = JUMP_V * 0.72; events.push('jump'); }
      } else {
        this.hangT += dt;
        this.walkPhase += Math.abs(this.vx) * dt * 2.4;
        this._pose(dt);
        return events;
      }
    } else if (!this.climbing && !this.onGround && this.hangCool <= 0 && level.holds) {
      for (const H of level.holds) {
        const hands = this.y + PLAYER_H + 0.1;
        if (this.x >= H.x0 && this.x <= H.x1 && hands > H.y - 0.45 && hands < H.y + 0.35) {
          this.hanging = H; this.hangT = 0; this.vx = 0; this.vy = 0; this.boosted = false; this.sliding = 0;
          events.push('grab');
          this._pose(dt);
          return events;
        }
      }
    }

    // ---- scale ----
    const ladder = this._ladderAt(level.ladders);
    if (!this.climbing && ladder) {
      const wantsUp = ctl.ay > 0.5 && this.y < ladder.y1 - 0.05;
      const wantsDown = ctl.ay < -0.5 && this.y > ladder.y0 + 0.05 && this.onGround;
      if (wantsUp || wantsDown) {
        this.climbing = ladder;
        this.jumpBuffer = 0;
      }
    }
    // su senza scala = salto (oltre allo spazio)
    if (!this.climbing && ctl.upPressed && !ladder) this.jumpBuffer = BUFFER;

    if (this.climbing) {
      const L = this.climbing;
      this.x += (L.x - this.x) * Math.min(1, dt * 14);
      this.vx = 0;
      this.vy = ctl.ay * CLIMB;
      this.y += this.vy * dt;
      this.onGround = false;
      this.standingOn = null;
      if (this.jumpBuffer > 0) {
        // salto via dalla scala
        this.climbing = null;
        this.jumpBuffer = 0;
        this.vy = JUMP_V * 0.8;
        this.vx = ctl.ax * RUN;
        events.push('jump');
      } else if (this.y >= L.y1) {
        this.y = L.y1; this.vy = 0; this.climbing = null; this.onGround = true; // arrivato sulla piattaforma
      } else if (this.y <= L.y0) {
        this.y = L.y0; this.vy = 0; this.climbing = null; this.onGround = true;
      }
      this.walkPhase += Math.abs(this.vy) * dt * 3;
      this._pose(dt);
      return events;
    }

    // ---- scivolata: giù mentre si corre a terra ----
    if (!this.sliding && this.onGround && ctl.ay < -0.5 && (Math.abs(this.vx) > 2.5 || Math.abs(ctl.ax) > 0.5) && !ladder) {
      this.sliding = SLIDE_T;
      const dir = Math.sign(this.vx) || Math.sign(ctl.ax) || this.facing;
      this.vx = dir * Math.max(Math.abs(this.vx), SLIDE_V);
      events.push('slide');
    }
    if (this.sliding > 0) {
      this.sliding = Math.max(0, this.sliding - dt);
      if (this.sliding === 0 && !this._canStand(level)) this.sliding = 0.05; // resta giù finché c'è un soffitto
      this.vx *= Math.max(0, 1 - dt * 1.2); // perde velocità pian piano
      if (Math.abs(this.vx) > 0.5) this.facing = Math.sign(this.vx);
    } else {
      // ---- corsa ----
      const target = ctl.ax * RUNS;
      const acc = this.onGround ? ACC_GROUND : ACC_AIR;
      if (this.vx < target) this.vx = Math.min(target, this.vx + acc * dt);
      else if (this.vx > target) this.vx = Math.max(target, this.vx - acc * dt);
      if (Math.abs(ctl.ax) > 0.1) this.facing = Math.sign(ctl.ax);
    }

    // ---- salto (con tempo di coyote e tasto memorizzato) ----
    this.coyote = this.onGround ? COYOTE : Math.max(0, this.coyote - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0 && (this.sliding === 0 || this._canStand(level))) {
      this.vy = JUMP_V;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.onGround = false;
      this.sliding = 0;
      events.push('jump');
    }
    // salto più corto se si lascia il tasto (non per le spinte del vapore)
    if (this.vy <= 0) this.boosted = false;
    if (!ctl.jumpHeld && this.vy > 0 && !this.boosted) this.vy -= G * 1.4 * dt;
    this.vy = Math.max(level.gravityScale ? -28 * level.gravityScale : -28, this.vy - G * dt);

    // ---- movimento con collisioni separate sui due assi ----
    const b = {};
    // nastro trasportatore: chi ci sta sopra viene trascinato (standingOn è quello del passo precedente)
    const carry = this.onGround && this.standingOn && this.standingOn.carry ? this.standingOn.carry : 0;
    const moveX = this.vx + carry;
    this.x += moveX * dt;
    this.box(b);
    for (const s of level.solids) {
      if (b.x1 <= s.x0 || b.x0 >= s.x1 || b.y1 <= s.y0 + 0.001 || b.y0 >= s.y1 - 0.001) continue;
      if (moveX > 0 || this.x < (s.x0 + s.x1) / 2) this.x = s.x0 - PLAYER_W / 2 - 0.001;
      else this.x = s.x1 + PLAYER_W / 2 + 0.001;
      this.vx = 0;
      this.box(b);
    }
    const prevY = this.y;
    const wasGround = this.onGround;
    this.y += this.vy * dt;
    this.onGround = false;
    this.standingOn = null;
    this.box(b);
    for (const s of level.solids) {
      if (b.x1 <= s.x0 || b.x0 >= s.x1 || b.y1 <= s.y0 || b.y0 >= s.y1) continue;
      if (this.vy <= 0 && prevY >= s.y1 - 0.05) { this.y = s.y1; this.vy = 0; this.onGround = true; this.standingOn = s; }
      else if (this.vy > 0) { this.y = s.y0 - this.h; this.vy = 0; this.boosted = false; }
      this.box(b);
    }
    if (this.vy <= 0) {
      for (const p of level.platforms) {
        if (!p.active) continue;
        if (b.x1 <= p.x0 || b.x0 >= p.x1) continue;
        if (prevY >= p.y - 0.05 && this.y <= p.y) { this.y = p.y; this.vy = 0; this.onGround = true; this.standingOn = p; }
      }
    }
    if (this.onGround && !wasGround) { events.push('land'); this.squash = 1; }
    if (this.onGround) this.walkPhase += Math.abs(this.vx) * dt * 1.6;
    this._pose(dt);
    return events;
  }

  _ladderAt(ladders) {
    for (const L of ladders) {
      if (Math.abs(this.x - L.x) < 0.7 && this.y >= L.y0 - 0.2 && this.y <= L.y1 + 0.05) return L;
    }
    return null;
  }

  throwBottle() {
    this.throwAnim = 0.28;
  }

  _pose(dt) {
    this.group.position.set(this.x, this.y, 0);
    // tre quarti verso la telecamera, così la faccia si vede sempre; sulla scala di spalle
    const targetYaw = this.climbing ? Math.PI : this.hanging ? this.facing * 0.5 : this.facing * (Math.PI / 2 - 0.55);
    this.root.rotation.y = THREE.MathUtils.damp(this.root.rotation.y, targetYaw, 14, dt);
    if (this.body) return this._poseRig(dt);
    const [la, ra] = this.arms, [ll, rl] = this.legs;
    if (this.climbing) {
      const s = Math.sin(this.walkPhase);
      la.rotation.set(-2.6 + s * 0.3, 0, 0); ra.rotation.set(-2.6 - s * 0.3, 0, 0);
      ll.rotation.x = s * 0.4; rl.rotation.x = -s * 0.4;
    } else if (!this.onGround) {
      la.rotation.set(-2.2, 0, 0.3); ra.rotation.set(-2.2, 0, -0.3);
      ll.rotation.x = -0.6; rl.rotation.x = 0.3;
    } else {
      const k = Math.min(1, Math.abs(this.vx) / RUN);
      const s = Math.sin(this.walkPhase * 2.2) * k;
      ll.rotation.x = s * 0.8; rl.rotation.x = -s * 0.8;
      la.rotation.set(-s * 0.7, 0, 0); ra.rotation.set(s * 0.7, 0, 0);
    }
    // lancio: il braccio destro parte da dietro la testa e scatta in avanti
    this.handBottle.visible = this.throwAnim > 0.12;
    if (this.throwAnim > 0) {
      const t = 1 - this.throwAnim / 0.28;
      ra.rotation.set(-3.0 + t * 3.6, 0, 0);
    }
    // lampeggia quando è invulnerabile
    this.group.visible = this.invuln <= 0 || Math.floor(this.invuln * 14) % 2 === 0;
  }

  /**
   * Modello vero: con lo scheletro (Rig.js) si animano le ossa (passo, salto, scale, lancio); senza scheletro
   * si muove il corpo intero, rigido (inclinazione, dondolio, torsione). In entrambi i casi rimbalza e si schiaccia.
   */
  _poseRig(dt) {
    const run = Math.min(1, Math.abs(this.vx) / RUN);
    const air = this.climbing || this.hanging || this.onGround ? null : THREE.MathUtils.clamp(this.vy / JUMP_V, -1, 1);
    const throwT = this.throwAnim > 0 ? this.throwAnim / 0.28 : 0;
    const phase = this.walkPhase * (this.climbing || this.hanging ? 1 : 2.2);
    let bob = this.onGround ? Math.abs(Math.sin(phase)) * 0.05 * run : 0;
    if (this.rig) {
      this.rig.apply(locomotionPose({ phase, run: this.onGround ? run : 0, air: this.hanging ? null : air, climb: !!this.climbing || !!this.hanging, throwT }));
      // gambe non animabili (scheletro con le ginocchia sopra l'anca): braccia e busto sulle ossa, e un
      // dondolio del corpo al posto dei passi
      const s = Math.sin(phase);
      if (this.rig.legsOk) this.body.rotation.set(0, 0, 0);
      else { this.body.rotation.set(0, 0, this.climbing ? s * 0.08 : this.onGround ? s * 0.07 * run : 0); bob *= 1.6; }
    } else {
      // corpo rigido: si inclina correndo, dondola a ogni passo, si slancia nel lancio
      const s = Math.sin(phase);
      const lean = (this.onGround ? run * 0.16 : air !== null ? 0.1 : 0) + (throwT ? Math.sin((1 - throwT) * Math.PI) * 0.3 : 0);
      const roll = this.climbing ? s * 0.1 : this.onGround ? s * 0.09 * run : 0;
      const twist = (this.onGround ? s * 0.1 * run : 0) - (throwT ? Math.sin((1 - throwT) * Math.PI) * 0.35 : 0);
      this.body.rotation.set(lean, twist, roll);
      bob *= 2;
    }
    this.squash = Math.max(0, this.squash - dt * 5);
    const st = air === null ? 0 : air;
    const sy = (1 + st * 0.05) * (1 - this.squash * 0.14), sx = (1 - st * 0.03) * (1 + this.squash * 0.08);
    this.body.scale.set(sx, sy, sx);
    this.body.position.y = bob;
    // scivolata: tutto il corpo all'indietro, piedi in avanti (l'altezza scende sotto la hitbox di 0,85 m)
    this.slideTilt = THREE.MathUtils.damp(this.slideTilt || 0, this.sliding > 0 ? 1 : 0, 18, dt);
    if (this.slideTilt > 0.01) {
      this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, -1.2, this.slideTilt);
      this.body.position.y = THREE.MathUtils.lerp(bob, 0.25, this.slideTilt);
      if (this.rig) this.rig.apply(locomotionPose({ slide: true }));
    }
    this.handBottle.visible = this.throwAnim > 0.12;
    this.group.visible = this.invuln <= 0 || Math.floor(this.invuln * 14) % 2 === 0;
  }

}
