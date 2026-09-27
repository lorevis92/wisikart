import * as THREE from 'three';
import { faceTexture } from '../core/Textures.js';

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

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...extra });

/**
 * Dal GLB del kart (Whiskey seduto nel kart, mesh unica) tiene solo il personaggio dal busto in su:
 * scarta i triangoli sotto il 36% dell'altezza (il kart) e quelli che sporgono davanti al busto (il volante).
 * Ritorna una geometria nuova (quella originale resta intatta per il kart).
 */
export function carveRider(geometry) {
  const pos = geometry.attributes.position;
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const H = y1 - y0, cut = y0 + H * 0.36;
  // profondità del busto e della testa (metà alta): quello che sporge oltre è kart o volante
  const zs = [];
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > y0 + H * 0.5) zs.push(pos.getZ(i));
  zs.sort((a, b) => a - b);
  const zFront = zs[Math.floor(zs.length * 0.98)] + 0.06, zBack = zs[Math.floor(zs.length * 0.02)] - 0.06;
  const keep = (i) => pos.getY(i) >= cut && pos.getZ(i) <= zFront && pos.getZ(i) >= zBack;
  const src = geometry.index ? geometry.index.array : Array.from({ length: pos.count }, (_, i) => i);
  const out = [];
  for (let t = 0; t < src.length; t += 3) {
    const a = src[t], b = src[t + 1], c = src[t + 2];
    if (keep(a) && keep(b) && keep(c)) out.push(a, b, c);
  }
  const g = geometry.clone();
  g.setIndex(out);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/**
 * Whiskey in versione platform. Con il GLB del personaggio (characters/<id>.glb) usa il modello vero
 * dal busto in su, con gambe e bacino nei suoi colori; senza GLB ripiega sulla versione procedurale
 * con la faccia di faceTexture.
 */
export class Player {
  constructor(character, model = null) {
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
    this.group = new THREE.Group();
    this.squash = 0;
    if (model) this._buildGlb(character, model);
    else this._build(character);
  }

  _buildGlb(c, model) {
    const col = c.colors;
    const root = new THREE.Group();
    this.group.add(root);
    this.root = root;
    let src = null;
    model.traverse((o) => { if (o.isMesh && !src) src = o; });
    const geo = carveRider(src.geometry);
    const bb = geo.boundingBox;
    const hip = 0.58;
    const upper = 1.38 * Math.sqrt(c.scale || 1); // busto + testa, come nel kart ma in piedi
    const k = upper / Math.max(0.001, bb.max.y - bb.min.y);
    const body = new THREE.Group(); // si inclina, rimbalza e si schiaccia
    body.position.y = hip;
    root.add(body);
    const mesh = new THREE.Mesh(geo, src.material);
    mesh.scale.setScalar(k);
    mesh.position.set(-((bb.min.x + bb.max.x) / 2) * k, -bb.min.y * k - 0.04, -((bb.min.z + bb.max.z) / 2) * k);
    mesh.castShadow = true;
    body.add(mesh);
    this.body = body;
    const width = (bb.max.x - bb.min.x) * k;
    // bacino: copre il taglio del kart
    const pants = std(col.primary, { roughness: 0.7 });
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), pants);
    pelvis.scale.set(Math.min(0.42, width * 0.36), 0.2, Math.min(0.34, width * 0.3));
    pelvis.position.y = 0.02;
    body.add(pelvis);
    // gambe
    this.legs = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * Math.min(0.2, width * 0.17), hip, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.34, 4, 10), pants);
      leg.position.y = -0.26;
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.34), std(col.secondary, { roughness: 0.4 }));
      shoe.position.set(0, -0.52, 0.06);
      pivot.add(leg, shoe);
      root.add(pivot);
      this.legs.push(pivot);
    }
    // bottiglia che compare in mano al momento del lancio
    this.handBottle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.34, 8), std('#3f9a5a', { roughness: 0.2, transparent: true, opacity: 0.9 }));
    this.handBottle.position.set(width * 0.45, 0.9, 0.2);
    this.handBottle.visible = false;
    body.add(this.handBottle);
    this.arms = null;
    this.glb = true;
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
  }

  box(out = {}) {
    out.x0 = this.x - PLAYER_W / 2; out.x1 = this.x + PLAYER_W / 2;
    out.y0 = this.y; out.y1 = this.y + PLAYER_H;
    return out;
  }

  /**
   * ctl: { ax, ay, jumpPressed, jumpHeld, upPressed }; level: { solids, platforms, ladders }.
   * Ritorna gli eventi del passo ('jump', 'land').
   */
  update(dt, ctl, level) {
    const events = [];
    this.invuln = Math.max(0, this.invuln - dt);
    this.throwAnim = Math.max(0, this.throwAnim - dt);
    if (ctl.jumpPressed) this.jumpBuffer = BUFFER;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

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

    // ---- corsa ----
    const target = ctl.ax * RUN;
    const acc = this.onGround ? ACC_GROUND : ACC_AIR;
    if (this.vx < target) this.vx = Math.min(target, this.vx + acc * dt);
    else if (this.vx > target) this.vx = Math.max(target, this.vx - acc * dt);
    if (Math.abs(ctl.ax) > 0.1) this.facing = Math.sign(ctl.ax);

    // ---- salto (con tempo di coyote e tasto memorizzato) ----
    this.coyote = this.onGround ? COYOTE : Math.max(0, this.coyote - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = JUMP_V;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.onGround = false;
      events.push('jump');
    }
    // salto più corto se si lascia il tasto
    if (!ctl.jumpHeld && this.vy > 0) this.vy -= GRAV * 1.4 * dt;
    this.vy = Math.max(-28, this.vy - GRAV * dt);

    // ---- movimento con collisioni separate sui due assi ----
    const b = {};
    this.x += this.vx * dt;
    this.box(b);
    for (const s of level.solids) {
      if (b.x1 <= s.x0 || b.x0 >= s.x1 || b.y1 <= s.y0 + 0.001 || b.y0 >= s.y1 - 0.001) continue;
      if (this.vx > 0 || this.x < (s.x0 + s.x1) / 2) this.x = s.x0 - PLAYER_W / 2 - 0.001;
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
      else if (this.vy > 0) { this.y = s.y0 - PLAYER_H; this.vy = 0; }
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
    const targetYaw = this.climbing ? Math.PI : this.facing * (Math.PI / 2 - 0.55);
    this.root.rotation.y = THREE.MathUtils.damp(this.root.rotation.y, targetYaw, 14, dt);
    if (this.glb) return this._poseGlb(dt);
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

  /** Il modello GLB è rigido: si anima il corpo intero (rimbalzo, inclinazione, allungamento) e le gambe. */
  _poseGlb(dt) {
    const [ll, rl] = this.legs, b = this.body;
    const run = Math.min(1, Math.abs(this.vx) / RUN);
    let lean = 0, bob = 0, sx = 1, sy = 1, twist = 0;
    if (this.climbing) {
      const s = Math.sin(this.walkPhase);
      ll.rotation.x = s * 0.5; rl.rotation.x = -s * 0.5;
      bob = Math.abs(s) * 0.04;
      twist = s * 0.08;
    } else if (!this.onGround) {
      ll.rotation.x = -0.7; rl.rotation.x = 0.35;
      // allungato in salita, raccolto in discesa
      const st = THREE.MathUtils.clamp(this.vy / JUMP_V, -1, 1);
      sy = 1 + st * 0.07; sx = 1 - st * 0.04;
      lean = 0.12;
    } else {
      const s = Math.sin(this.walkPhase * 2.2) * run;
      ll.rotation.x = s * 0.9; rl.rotation.x = -s * 0.9;
      bob = Math.abs(Math.sin(this.walkPhase * 2.2)) * 0.07 * run;
      lean = run * 0.14;
      twist = s * 0.08;
    }
    // atterraggio: schiacciata breve
    this.squash = Math.max(0, this.squash - dt * 5);
    sy *= 1 - this.squash * 0.18; sx *= 1 + this.squash * 0.1;
    // lancio: slancio in avanti con torsione
    this.handBottle.visible = this.throwAnim > 0.1;
    if (this.throwAnim > 0) { const t = Math.sin((1 - this.throwAnim / 0.28) * Math.PI); lean += t * 0.3; twist -= t * 0.35; }
    b.position.y = 0.58 + bob;
    b.rotation.set(lean, twist, 0);
    b.scale.set(sx, sy, sx);
    this.group.visible = this.invuln <= 0 || Math.floor(this.invuln * 14) % 2 === 0;
  }
}
