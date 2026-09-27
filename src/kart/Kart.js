import * as THREE from 'three';
import { Assets } from '../core/AssetLoader.js';
import { faceTexture, dotTexture } from '../core/Textures.js';

const _f = new THREE.Vector3();
const _u = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();

function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, ...extra });
}

export class Kart {
  constructor(character, { isPlayer = false, index = 0 } = {}) {
    this.character = character;
    this.isPlayer = isPlayer;
    this.index = index;
    this.group = new THREE.Group();
    this.model = new THREE.Group();
    this.group.add(this.model);
    this.wheels = [];
    this.frontWheels = [];

    const s = character.stats;
    this.maxSpeed = 36.5 + s.speed * 1.25;
    this.accel = 7 + s.accel * 1.6;
    this.turnRate = 1.55 + s.handling * 0.16;
    this.mass = 0.8 + s.weight * 0.16;

    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.vy = 0;
    this.hop = 0;
    this.groundY = 0;
    this.lateral = 0;
    this.trackIdx = 0;
    this.slope = 0;

    this.input = { throttle: 0, steer: 0, drift: false, item: false };
    this.drifting = false;
    this.driftDir = 0;
    this.driftCharge = 0;
    this.driftTier = 0;
    this.boost = 0;
    this.boostPower = 1;
    this.spin = 0;
    this.spinAngle = 0;
    this.slow = 0;
    this.blind = 0;
    this.shield = 0;
    this.invuln = 0;
    this.offRoad = false;
    this.item = null;
    this.itemRolling = 0;
    this.finished = false;
    this.finishTime = 0;
    this.lap = 1;
    this.progress = 0;
    this.lastIdx = 0;
    this.halfPassed = false;
    this.rank = index + 1;
    this.visualYaw = 0;
    this.visualRoll = 0;
    this.trail = [];
  }

  async buildVisual() {
    const c = this.character;
    const scale = c.scale || 1;
    const glb = await Assets.model(c.model, { targetHeight: 2.4 * scale, rotY: c.modelRotY || 0 });
    if (glb) {
      this.model.add(glb);
      this.hasGlb = true;
    } else {
      this._procedural(c, scale);
    }
    this._sparks();
    return this;
  }

  _procedural(c, scale) {
    const col = c.colors;
    const g = new THREE.Group();
    // telaio
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.6, 2, 1, 3), std(col.primary, { roughness: 0.35 }));
    body.position.y = 0.55;
    body.castShadow = true;
    g.add(body);
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 0.9, 12), std(col.secondary, { roughness: 0.3 }));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.55, 1.45);
    g.add(nose);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.4), std('#222'));
    seat.position.set(0, 1.0, -0.75);
    g.add(seat);
    const wheelG = new THREE.CylinderGeometry(0.42, 0.42, 0.42, 14);
    wheelG.rotateZ(Math.PI / 2);
    const rimG = new THREE.CylinderGeometry(0.22, 0.22, 0.44, 10);
    rimG.rotateZ(Math.PI / 2);
    const tyreM = std('#1b1b1f', { roughness: 0.9 });
    const rimM = std(col.secondary, { metalness: 0.6, roughness: 0.3 });
    for (const [x, z, front] of [[-1.0, 0.95, true], [1.0, 0.95, true], [-1.05, -0.95, false], [1.05, -0.95, false]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.42, z);
      const w = new THREE.Mesh(wheelG, tyreM);
      w.castShadow = true;
      const r = new THREE.Mesh(rimG, rimM);
      w.add(r);
      pivot.add(w);
      g.add(pivot);
      this.wheels.push(w);
      if (front) this.frontWheels.push(pivot);
    }
    // volante
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 8, 20), std('#222'));
    wheel.position.set(0, 1.15, 0.35);
    wheel.rotation.x = -1.1;
    g.add(wheel);
    // pilota
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 6, 12), std(col.primary));
    torso.position.set(0, 1.35, -0.45);
    torso.castShadow = true;
    g.add(torso);
    const arms = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.0, 8), std(col.skin));
    arms.rotation.z = Math.PI / 2;
    arms.position.set(0, 1.35, 0.05);
    g.add(arms);
    const headM = new THREE.MeshStandardMaterial({ map: faceTexture(col.skin, { blush: c.id === 'bacco', sly: c.id !== 'divoratore' }), roughness: 0.6 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 20), headM);
    head.position.set(0, 2.2, -0.45);
    head.rotation.y = Math.PI; // la faccia guarda avanti (+Z)
    head.castShadow = true;
    g.add(head);
    this.head = head;
    // capelli / copricapo
    const hair = std(col.hair, { roughness: 0.9 });
    const look = c.look || {};
    if (look.hair === 'long') {
      const back = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 1.0, 12, 1, true), hair);
      back.position.set(0, 1.95, -0.7);
      g.add(back);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.58, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
      cap.position.set(0, 2.25, -0.5);
      g.add(cap);
    } else if (look.hair === 'wild' || look.hair === 'curly' || look.hair === 'shaggy') {
      const n = look.hair === 'shaggy' ? 14 : 9;
      for (let i = 0; i < n; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.22 + Math.random() * 0.12, 8, 8), hair);
        const a = (i / n) * Math.PI * 2;
        const r = look.hair === 'shaggy' ? 0.55 : 0.45;
        b.position.set(Math.cos(a) * r, 2.45 + Math.sin(a * 2) * 0.12 - (look.hair === 'shaggy' ? 0.25 : 0), -0.45 + Math.sin(a) * r * 0.8);
        g.add(b);
      }
      if (look.hair === 'shaggy') {
        const mane = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.9, 12, 1, true), hair);
        mane.position.set(0, 1.85, -0.5);
        g.add(mane);
      }
    }
    if (look.hat === 'vine') {
      const crown = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.12, 8, 16), std('#2e8b3d'));
      crown.rotation.x = Math.PI / 2;
      crown.position.set(0, 2.6, -0.45);
      g.add(crown);
      for (let i = 0; i < 5; i++) {
        const grape = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), std('#6b2fa0'));
        const a = i * 1.25;
        grape.position.set(Math.cos(a) * 0.5, 2.55 + (i % 2) * 0.12, -0.45 + Math.sin(a) * 0.5);
        g.add(grape);
      }
    } else if (look.hat === 'turban') {
      const tur = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), std('#2b4fd6'));
      tur.position.set(0, 2.3, -0.45);
      g.add(tur);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.2, 0.12), std('#f0c93f'));
      tail.position.set(0.2, 1.9, -1.0);
      tail.rotation.x = 0.4;
      g.add(tail);
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), std('#ffffff', { roughness: 0.1, metalness: 0.3 }));
      pearl.position.set(0.5, 2.0, -0.4);
      g.add(pearl);
    } else if (look.hat === 'brim') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.08, 20), std('#7a4a26'));
      brim.position.set(0, 2.62, -0.45);
      g.add(brim);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.5, 20), std('#7a4a26'));
      top.position.set(0, 2.85, -0.45);
      g.add(top);
    }
    g.scale.setScalar(scale);
    this.model.add(g);
  }

  _sparks() {
    const g = new THREE.BufferGeometry();
    const n = 40;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.sparkMat = new THREE.PointsMaterial({ color: 0xffc860, size: 0.3, map: dotTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.sparks = new THREE.Points(g, this.sparkMat);
    this.sparkLife = new Float32Array(n);
    this.group.add(this.sparks);
    // fiamma del turbo
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 10), new THREE.MeshBasicMaterial({ color: 0xffa640, transparent: true, opacity: 0 }));
    this.flame.rotation.x = Math.PI / 2;
    this.flame.position.set(0, 0.5, -1.9);
    this.model.add(this.flame);
    // scudo/aura
    this.aura = new THREE.Mesh(new THREE.SphereGeometry(2.1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, wireframe: true }));
    this.aura.position.y = 1.2;
    this.model.add(this.aura);
  }

  placeAt(pos, heading, idx) {
    this.pos.copy(pos);
    this.heading = heading;
    this.trackIdx = idx;
    this.lastIdx = idx;
    this.speed = 0;
    this.group.position.copy(pos);
    this.group.rotation.set(0, heading, 0);
  }

  forward(out = _f) {
    return out.set(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  applySpinout(power = 1) {
    if (this.invuln > 0 || this.spin > 0) return false;
    if (this.shield > 0) { this.shield = 0; return false; }
    this.spin = 1.1 * power;
    this.drifting = false;
    this.driftCharge = 0;
    this.boost = 0;
    return true;
  }

  update(dt, track, others) {
    const inp = this.input;
    if (this.finished) { inp.throttle = 0.35; inp.steer *= 0.5; }
    // timers
    this.invuln = Math.max(0, this.invuln - dt);
    this.slow = Math.max(0, this.slow - dt);
    this.blind = Math.max(0, this.blind - dt);
    this.shield = Math.max(0, this.shield - dt);
    this.boost = Math.max(0, this.boost - dt);

    // proiezione sulla pista
    const pr = track.project(this.pos, this.trackIdx);
    this.trackIdx = pr.idx;
    this.lateral = pr.lateral;
    this.groundY = pr.height;
    this.slope = pr.tangent.y;
    const offRoad = Math.abs(this.lateral) > track.halfW + 1.3;
    this.offRoad = offRoad && !track.isTunnel;

    let maxSpeed = this.maxSpeed;
    if (this.boost > 0) maxSpeed *= 1.32 * this.boostPower;
    if (this.offRoad) maxSpeed *= 0.55;
    if (this.slow > 0) maxSpeed *= 0.62;
    if (!this.isPlayer && this.aiBoostFactor) maxSpeed *= this.aiBoostFactor;
    // pendenza
    maxSpeed *= 1 - Math.max(-0.12, Math.min(0.12, this.slope * 0.8));

    if (this.spin > 0) {
      this.spin -= dt;
      this.spinAngle += dt * 9;
      this.speed = THREE.MathUtils.damp(this.speed, 0, 4, dt);
      this.drifting = false;
    } else {
      this.spinAngle = THREE.MathUtils.damp(this.spinAngle, 0, 10, dt);
      // accelerazione
      const target = inp.throttle > 0 ? maxSpeed * inp.throttle : inp.throttle < 0 ? -maxSpeed * 0.35 : 0;
      const rate = inp.throttle > 0 ? this.accel * (this.boost > 0 ? 2.2 : 1) : inp.throttle < 0 ? 18 : 6;
      if (this.speed < target) this.speed = Math.min(target, this.speed + rate * dt);
      else this.speed = Math.max(target, this.speed - (this.speed > maxSpeed ? 18 : rate) * dt);
      if (this.boost > 0 && this.speed < maxSpeed * 0.9) this.speed = Math.min(maxSpeed, this.speed + 40 * dt);

      // derapata
      const canDrift = Math.abs(this.speed) > 9 && this.hop <= 0.01;
      if (inp.drift && !this.drifting && canDrift && Math.abs(inp.steer) > 0.25) {
        this.drifting = true;
        this.driftDir = Math.sign(inp.steer);
        this.driftCharge = 0;
        this.vy = 3.4;
        this.hop = 0.01;
      }
      if (this.drifting && (!inp.drift || Math.abs(this.speed) < 6)) {
        this.drifting = false;
        if (this.driftCharge > 2.3) { this.boost = Math.max(this.boost, 1.6); this.boostPower = 1.08; this.driftTier = 2; }
        else if (this.driftCharge > 1.1) { this.boost = Math.max(this.boost, 0.9); this.boostPower = 1; this.driftTier = 1; }
        else this.driftTier = 0;
        this.lastDriftRelease = this.driftTier;
        this.driftCharge = 0;
      }
      // sterzo
      const speedFactor = Math.min(1, Math.abs(this.speed) / 14);
      const dir = this.speed >= 0 ? 1 : -1;
      if (this.drifting) {
        this.driftCharge += dt * (Math.abs(inp.steer) > 0.2 ? 1.0 : 0.6);
        const steerBias = this.driftDir * 0.95 + inp.steer * 0.55;
        this.heading -= steerBias * this.turnRate * 0.95 * speedFactor * dt * dir;
        this.speed = Math.max(this.speed - 1.5 * dt, 0);
      } else {
        this.heading -= inp.steer * this.turnRate * speedFactor * dt * dir;
      }
    }

    // salto
    if (this.hop > 0 || this.vy !== 0) {
      this.vy -= 14 * dt;
      this.hop += this.vy * dt;
      if (this.hop <= 0) { this.hop = 0; this.vy = 0; }
    }

    // movimento
    this.forward(_f);
    this.pos.addScaledVector(_f, this.speed * dt);

    // muri
    const wall = track.wallDist;
    const pr2 = track.project(this.pos, this.trackIdx);
    if (Math.abs(pr2.lateral) > wall) {
      const side = Math.sign(pr2.lateral);
      const over = Math.abs(pr2.lateral) - wall;
      this.pos.addScaledVector(pr2.right, -side * (over + 0.05));
      const tHeading = Math.atan2(pr2.tangent.x, pr2.tangent.z);
      const diff = Math.atan2(Math.sin(tHeading - this.heading), Math.cos(tHeading - this.heading));
      // componente della direzione che spinge contro il muro
      const into = Math.sin(diff) * side * (this.speed >= 0 ? 1 : -1);
      if (into > 0.05) {
        if (!this.touchingWall) { this.speed *= 1 - Math.min(0.6, into * 0.9); this.hitWall = 0.3; }
        // scivola: allinea la direzione al muro con un piccolo angolo di uscita
        this.heading = tHeading + side * 0.08 * (this.speed >= 0 ? 1 : -1);
      }
      this.touchingWall = true;
    } else this.touchingWall = false;
    this.hitWall = Math.max(0, (this.hitWall || 0) - dt);
    this.pos.y = pr2.height + this.hop;
    this.trackIdx = pr2.idx;
    this.lateral = pr2.lateral;

    // collisioni tra kart
    for (const o of others) {
      if (o === this) continue;
      const dx = o.pos.x - this.pos.x, dz = o.pos.z - this.pos.z;
      const d2 = dx * dx + dz * dz;
      const r = 2.3;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (r - d) * 0.5;
        const wa = o.mass / (o.mass + this.mass);
        this.pos.x -= (dx / d) * push * wa * 2;
        this.pos.z -= (dz / d) * push * wa * 2;
        this.speed *= 0.985;
        if (o.punching && this.applySpinout(0.7)) this.hitBy = o;
      }
    }

    // progressione
    const N = track.N;
    const startIdx = track.idxFromT(track.def.startT);
    const rel = (this.trackIdx - startIdx + N) % N;
    const lastRel = (this.lastIdx - startIdx + N) % N;
    if (rel > N * 0.45 && rel < N * 0.6) this.halfPassed = true;
    if (this.halfPassed && lastRel > N * 0.85 && rel < N * 0.15) {
      this.lap += 1;
      this.halfPassed = false;
      this.lapEvent = true;
    } else if (!this.halfPassed && lastRel < N * 0.15 && rel > N * 0.85 && this.lap > 1) {
      // retromarcia oltre il traguardo
      this.lap -= 1;
      this.halfPassed = true;
    }
    this.lastIdx = this.trackIdx;
    this.progress = (this.lap - 1) * N + rel;

    // pad turbo
    for (const p of track.boostPads) {
      const d = (this.trackIdx - p.idx + N) % N;
      if (d <= p.len && Math.abs(this.lateral) < track.halfW) {
        if (this.boost < 0.6) { this.boost = 1.3; this.boostPower = 1.1; this.padHit = true; }
      }
    }
    // scatole oggetti
    for (const b of track.itemBoxes) {
      if (b.taken > 0) continue;
      if (this.item || this.itemRolling > 0) continue;
      if (b.pos.distanceToSquared(this.pos) < 2.6 * 2.6) {
        b.taken = 4;
        this.itemRolling = 1.4;
        this.pickupEvent = true;
      }
    }
    if (this.itemRolling > 0) this.itemRolling -= dt;

    this._visual(dt, track);
  }

  _visual(dt, track) {
    const s = track.samples[this.trackIdx];
    this.forward(_f);
    _u.copy(s.normal);
    _f.sub(_u.clone().multiplyScalar(_f.dot(_u))).normalize();
    _m.lookAt(new THREE.Vector3(), _f.clone().negate(), _u);
    _q.setFromRotationMatrix(_m);
    this.group.position.copy(this.pos);
    this.group.quaternion.slerp(_q, Math.min(1, dt * 10));
    // yaw visivo in derapata + rollio
    const targetYaw = this.drifting ? -this.driftDir * 0.55 : 0;
    this.visualYaw = THREE.MathUtils.damp(this.visualYaw, targetYaw + this.spinAngle, 8, dt);
    const targetRoll = (this.drifting ? this.driftDir * 0.1 : this.input.steer * 0.06) * Math.min(1, Math.abs(this.speed) / 20);
    this.visualRoll = THREE.MathUtils.damp(this.visualRoll, targetRoll, 6, dt);
    this.model.rotation.set(0, this.visualYaw, this.visualRoll);
    this.model.position.y = this.hasGlb ? 0 : 0;
    for (const w of this.wheels) w.rotation.x += this.speed * dt * 2.4;
    for (const p of this.frontWheels) p.rotation.y = THREE.MathUtils.damp(p.rotation.y, -this.input.steer * 0.45, 8, dt);
    // fiamma
    const fl = this.boost > 0 ? 1 : 0;
    this.flame.material.opacity = THREE.MathUtils.damp(this.flame.material.opacity, fl * 0.9, 8, dt);
    this.flame.scale.setScalar(0.8 + Math.random() * 0.5);
    this.flame.material.color.set(this.boostPower > 1.05 ? 0xff7a3a : 0xffc040);
    // scintille di derapata
    const pos = this.sparks.geometry.attributes.position;
    const n = this.sparkLife.length;
    const spark = this.drifting && this.hop === 0;
    // dorate all'inizio, blu col mini-turbo pronto, arancioni col super mini-turbo (niente bianco: sembravano puntini sparsi)
    this.sparkMat.color.set(this.driftCharge > 2.3 ? 0xff8a3a : this.driftCharge > 1.1 ? 0x5fc4ff : 0xffc860);
    for (let i = 0; i < n; i++) {
      this.sparkLife[i] -= dt * 3;
      if (this.sparkLife[i] <= 0 && spark && Math.random() < 0.5) {
        this.sparkLife[i] = 1;
        const side = this.driftDir;
        const ox = side * (1.1 + Math.random() * 0.4), oz = -1 + Math.random() * 0.6;
        pos.setXYZ(i, ox, 0.2, oz);
      } else if (this.sparkLife[i] > 0) {
        pos.setY(i, pos.getY(i) + dt * 3);
        pos.setZ(i, pos.getZ(i) - dt * 8);
      } else pos.setXYZ(i, 0, -100, 0);
    }
    pos.needsUpdate = true;
    this.sparks.quaternion.copy(this.model.quaternion);
    this.sparkMat.opacity = spark ? 1 : Math.max(0, this.sparkMat.opacity - dt * 4);
    // aura scudo / invulnerabilità
    const auraOn = this.shield > 0 ? 0.35 : this.invuln > 0 ? 0.2 : 0;
    this.aura.material.opacity = auraOn;
    this.aura.material.color.set(this.shield > 0 ? 0x4cf0ff : 0xffffff);
    this.aura.rotation.y += dt * 2;
  }
}
