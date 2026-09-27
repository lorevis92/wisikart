import * as THREE from 'three';

// Ogni entità ha `group` (scena), `update(dt, ctx)` e, se fa male, `hurts(box)`.
// ctx = { t, player, mode } dove mode è lo StoryMode (per suoni, pickup e proiettili).

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
export { overlap };

const SEAT_COLORS = ['#f29a2e', '#a24cf0', '#1fbfae'];

/** Sedile da stadio (seduta + schienale), usato per file, crolli e lanci del boss. */
export function seatMesh(color, scale = 1) {
  const g = new THREE.Group();
  const m = std(color, { roughness: 0.35 });
  const pan = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.8), m);
  pan.position.y = 0.08;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.75, 0.14), m);
  back.position.set(0, 0.45, -0.38);
  back.rotation.x = -0.12;
  g.add(pan, back);
  g.scale.setScalar(scale);
  return g;
}

/** Fila di sedili che crolla poco dopo che ci si sale (piattaforma attraversabile dal basso). */
export class CrumbleRow {
  constructor([x0, x1, y]) {
    this.x0 = x0; this.x1 = x1; this.y = y; this.baseY = y;
    this.active = true;
    this.state = 'idle';
    this.timer = 0;
    this.group = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.35, 1.6), std('#3a2f6b'));
    beam.position.set(0, -0.18, 0);
    this.group.add(beam);
    const n = Math.max(2, Math.round((x1 - x0) / 1.05));
    for (let i = 0; i < n; i++) {
      const s = seatMesh(SEAT_COLORS[(((i + Math.round(x0)) % 3) + 3) % 3]);
      s.position.set(-(x1 - x0) / 2 + (i + 0.5) * ((x1 - x0) / n), 0, 0.1);
      this.group.add(s);
    }
    // crepe: segnalano che non reggono
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 1.62), std('#15102a'));
    crack.position.set((x1 - x0) * 0.1, -0.1, 0);
    crack.rotation.z = 0.5;
    this.group.add(crack);
    this.group.position.set((x0 + x1) / 2, y, 0);
  }

  update(dt, ctx) {
    const standing = ctx.player.standingOn === this;
    if (this.state === 'idle' && standing) { this.state = 'shake'; this.timer = 0.45; }
    if (this.state === 'shake') {
      this.timer -= dt;
      this.group.position.x = (this.x0 + this.x1) / 2 + Math.sin(ctx.t * 70) * 0.06;
      if (this.timer <= 0) { this.state = 'fall'; this.active = false; this.timer = 3.5; this.vy = 0; ctx.mode.sfx('break'); }
    } else if (this.state === 'fall') {
      this.timer -= dt;
      this.vy -= 30 * dt;
      this.group.position.y += this.vy * dt;
      this.group.rotation.z += dt * 0.8;
      if (this.timer <= 0) this.reset();
    }
  }

  reset() {
    this.state = 'idle'; this.active = true;
    this.group.position.set((this.x0 + this.x1) / 2, this.baseY, 0);
    this.group.rotation.set(0, 0, 0);
  }
}

/** Tifoso alieno procedurale (corpo, testa con antenne, maglia). */
function alienFan(hue, jersey) {
  const g = new THREE.Group();
  const skin = std(new THREE.Color().setHSL(hue, 0.55, 0.5));
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.55, 6, 12), std(jersey));
  body.position.y = 0.72;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 12), skin);
  head.position.y = 1.45;
  g.add(body, head);
  for (const s of [-1, 1]) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6), skin);
    ant.position.set(s * 0.15, 1.85, 0);
    ant.rotation.z = -s * 0.3;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), skin);
    tip.position.set(s * 0.21, 2.02, 0);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), std('#ffffff'));
    eye.position.set(s * 0.13, 1.5, 0.31);
    g.add(ant, tip, eye);
  }
  g.skin = skin;
  return g;
}

/** Tifoso che ondeggia sulla fila: il corpo fa male, si scavalca con un salto. */
export class Fan {
  constructor({ x, y, phase }) {
    this.x = x; this.y = y; this.phase = phase;
    this.group = alienFan(0.3 + phase * 0.2, '#c23a4a');
    this.arms = [];
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 6), this.group.skin);
      arm.geometry.translate(0, 0.35, 0);
      arm.position.set(s * 0.45, 1.0, 0);
      this.group.add(arm);
      this.arms.push(arm);
    }
    this.group.position.set(x, y, 0);
    this.group.rotation.y = 0.3;
    this.dx = 0;
  }

  update(dt, ctx) {
    const t = ctx.t * 2.2 + this.phase;
    this.dx = Math.sin(t) * 0.35;
    this.group.position.x = this.x + this.dx;
    this.group.rotation.z = Math.sin(t) * 0.12;
    this.arms[0].rotation.z = 2.6 + Math.sin(t * 2) * 0.4;
    this.arms[1].rotation.z = -2.6 - Math.sin(t * 2) * 0.4;
  }

  hurts(b) {
    const x = this.x + this.dx;
    return overlap(b, { x0: x - 0.45, x1: x + 0.45, y0: this.y, y1: this.y + 1.35 });
  }
}

/**
 * Tifoso con la sciarpa tesa sopra la fila: giù (a 1,25 m) si salta, su (a 2,9 m) ci si passa sotto.
 * Il tifoso sta dietro la fila, la sciarpa attraversa il percorso.
 */
export class Scarf {
  constructor({ x, y, phase }) {
    this.x = x; this.y = y; this.phase = phase;
    this.period = 2.8;
    this.group = new THREE.Group();
    const fan = alienFan(0.75, '#2b62d9');
    fan.scale.setScalar(1.5);
    fan.position.set(0, 0, -1.9);
    this.group.add(fan);
    this.bar = new THREE.Group();
    const stripes = 8;
    for (let i = 0; i < stripes; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(3.6 / stripes, 0.34, 0.08), std(i % 2 ? '#f2c230' : '#d23a3a'));
      seg.position.x = -1.8 + (i + 0.5) * (3.6 / stripes);
      this.bar.add(seg);
    }
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 6), fan.skin);
      arm.name = 'arm';
      arm.userData.side = s;
      this.group.add(arm);
    }
    this.group.add(this.bar);
    this.group.position.set(x, y, 0);
    this.h = 1.25;
  }

  update(dt, ctx) {
    // onda a gradino ammorbidita: sta giù, sale, sta su, scende
    const u = ((ctx.t + this.phase) % this.period) / this.period;
    const tri = u < 0.4 ? 0 : u < 0.5 ? (u - 0.4) / 0.1 : u < 0.9 ? 1 : 1 - (u - 0.9) / 0.1;
    const k = tri * tri * (3 - 2 * tri);
    this.h = 1.25 + k * 1.65;
    this.bar.position.set(0, this.h, 0);
    this.bar.rotation.z = Math.sin(ctx.t * 6) * 0.03;
    // le braccia collegano le spalle del tifoso alle estremità della sciarpa
    for (const arm of this.group.children) {
      if (arm.name !== 'arm') continue;
      const s = arm.userData.side;
      const a = new THREE.Vector3(s * 0.6, 2.1, -1.7), bEnd = new THREE.Vector3(s * 1.7, this.h, 0);
      arm.position.copy(a).add(bEnd).multiplyScalar(0.5);
      arm.scale.y = a.distanceTo(bEnd);
      arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bEnd.clone().sub(a).normalize());
    }
  }

  hurts(b) {
    const y = this.y + this.h;
    return overlap(b, { x0: this.x - 1.8, x1: this.x + 1.8, y0: y - 0.17, y1: y + 0.17 });
  }
}

/** Bottiglie e secchi lanciati dagli spalti: cadono a turno su posizioni fisse, con l'ombra che avvisa. */
export class Dropper {
  constructor({ x0, x1, y, period, offset }, bottleModel) {
    this.x0 = x0; this.x1 = x1; this.y = y; this.period = period;
    this.timer = offset;
    this.slots = [];
    for (let x = x0 + 0.8; x <= x1 - 0.8; x += 2.2) this.slots.push(x);
    this.order = [0, 2, 1, 3, 0, 1, 3, 2].map((i) => i % this.slots.length);
    this.k = 0;
    this.items = [];
    this.bottleModel = bottleModel;
    this.group = new THREE.Group();
  }

  _spawn() {
    const x = this.slots[this.order[this.k++ % this.order.length]];
    const bucket = this.k % 3 === 0;
    let mesh;
    if (!bucket && this.bottleModel) mesh = this.bottleModel.clone(true);
    else if (bucket) {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.5, 12, 1, true), std('#8fa0b8', { metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide }));
    } else {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.55, 8), std('#3f9a5a', { roughness: 0.2 }));
    }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(x, this.y + 0.03, 0);
    const it = { x, yy: this.y + 14, vy: 0, mesh, shadow, spin: (Math.random() - 0.5) * 8 };
    mesh.position.set(x, it.yy, 0);
    this.group.add(mesh, shadow);
    this.items.push(it);
  }

  update(dt, ctx) {
    this.timer -= dt;
    if (this.timer <= 0) { this.timer += this.period; this._spawn(); }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.vy -= 22 * dt;
      it.yy += it.vy * dt;
      it.mesh.position.y = it.yy;
      it.mesh.rotation.z += it.spin * dt;
      const k = 1 - Math.min(1, (it.yy - this.y) / 14);
      it.shadow.scale.setScalar(0.4 + k * 0.8);
      it.shadow.material.opacity = 0.15 + k * 0.35;
      if (it.yy <= this.y) {
        ctx.mode.burst(it.x, this.y + 0.2, 0x9fe0ff);
        if (Math.abs(ctx.player.x - it.x) < 12) ctx.mode.sfx('break');
        this.group.remove(it.mesh, it.shadow);
        this.items.splice(i, 1);
      }
    }
  }

  hurts(b) {
    return this.items.some((it) => overlap(b, { x0: it.x - 0.3, x1: it.x + 0.3, y0: it.yy - 0.1, y1: it.yy + 0.5 }));
  }
}

/** Palla spaziale a pendolo: percorso fisso e prevedibile. */
export class Pendulum {
  constructor({ x, y, length, amp, period, phase }) {
    Object.assign(this, { px: x, py: y, length, amp, period, phase });
    this.r = 1.2;
    this.group = new THREE.Group();
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(this.r, 28, 20), std('#ff9a3a', { emissive: 0xff5a1a, emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.1 }));
    const swirl = new THREE.Mesh(new THREE.TorusGeometry(this.r * 0.75, 0.12, 8, 28), std('#a24cf0', { emissive: 0x7a2fd0, emissiveIntensity: 0.6 }));
    swirl.rotation.x = 1.2;
    this.ball.add(swirl);
    this.chain = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), std('#c9d6ff', { metalness: 0.8, roughness: 0.3 }));
    const hook = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), std('#445', { metalness: 0.7 }));
    hook.position.set(x, y, 0);
    this.group.add(this.ball, this.chain, hook);
    this.bx = x; this.by = y - length;
  }

  update(dt, ctx) {
    const a = this.amp * Math.sin((ctx.t / this.period) * Math.PI * 2 + this.phase);
    this.bx = this.px + Math.sin(a) * this.length;
    this.by = this.py - Math.cos(a) * this.length;
    this.ball.position.set(this.bx, this.by, 0);
    this.ball.rotation.z = -a * 2;
    this.chain.position.set((this.px + this.bx) / 2, (this.py + this.by) / 2, 0);
    this.chain.scale.y = this.length - this.r;
    this.chain.rotation.z = a;
  }

  hurts(b) {
    const cx = Math.max(b.x0, Math.min(this.bx, b.x1)), cy = Math.max(b.y0, Math.min(this.by, b.y1));
    return (cx - this.bx) ** 2 + (cy - this.by) ** 2 < (this.r * 0.92) ** 2;
  }
}

/** Porta da Space Ball ad arco, come nel campo: la traversa è una piattaforma, i pali sono scena. */
export function goalMesh({ x, top, width }) {
  const g = new THREE.Group();
  const orange = std('#f28a2e', { emissive: 0x5a2000, emissiveIntensity: 0.4, roughness: 0.35 });
  const blue = std('#2f6bd9', { roughness: 0.4 });
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, top, 12), orange);
    post.position.set(s * width / 2, top / 2, -1.2);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), blue);
    foot.position.set(s * width / 2, 0.25, -1.2);
    g.add(post, foot);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, 0.4, 2.8), orange);
  bar.position.set(0, top - 0.2, -0.2);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.1, 2.9), blue);
  trim.position.set(0, top - 0.02, -0.2);
  g.add(bar, trim);
  g.position.x = x;
  return g;
}

/** Munizioni: bottiglia singola, bottigliera (campo) o cassa (tunnel). */
export class Pickup {
  constructor({ x, y, kind, amount }, bottleModel) {
    this.x = x; this.y = y; this.kind = kind; this.amount = amount;
    this.taken = false;
    this.group = new THREE.Group();
    this.bottles = [];
    const bottle = () => {
      const b = bottleModel ? bottleModel.clone(true) : new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.55, 8), std('#3f9a5a', { roughness: 0.2 }));
      this.bottles.push(b);
      return b;
    };
    if (kind === 'rack') {
      const frame = std('#6b4a2a');
      for (const h of [0.5, 1.2]) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.6), frame);
        shelf.position.y = h;
        this.group.add(shelf);
        for (let i = 0; i < 4; i++) { const b = bottle(); b.position.set(-0.6 + i * 0.4, h + 0.04, 0); this.group.add(b); }
      }
      for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.7, 0.6), frame); leg.position.set(s * 0.9, 0.85, 0); this.group.add(leg); }
      this.w = 1.9; this.h = 1.8;
    } else if (kind === 'crate') {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.9), std('#8a5a32'));
      crate.position.y = 0.4;
      this.group.add(crate);
      for (let i = 0; i < 3; i++) { const b = bottle(); b.position.set(-0.3 + i * 0.3, 0.8, 0); this.group.add(b); }
      this.w = 1.2; this.h = 1.3;
    } else {
      this.spin = bottle();
      this.spin.position.y = 0.5;
      this.group.add(this.spin);
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.45, 20), new THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
      glow.position.y = 0.5;
      this.group.add(glow);
      this.w = 0.8; this.h = 1.1;
    }
    this.group.position.set(x, y, 0);
  }

  update(dt, ctx) {
    if (this.taken) return;
    if (this.spin) { this.spin.rotation.y += dt * 3; this.spin.position.y = 0.5 + Math.sin(ctx.t * 3) * 0.1; }
    const b = { x0: this.x - this.w / 2, x1: this.x + this.w / 2, y0: this.y, y1: this.y + this.h };
    if (overlap(ctx.player.box(), b) && ctx.mode.ammo < ctx.mode.maxAmmo) {
      this.taken = true;
      ctx.mode.addAmmo(this.amount, this.kind);
      if (this.kind === 'bottle') this.group.visible = false;
      else for (const b of this.bottles) b.visible = false; // resta la bottigliera/cassa vuota
    }
  }
}

/** Steward che pattuglia un tratto: fa male al contatto, una bottigliata lo stordisce. */
export class Steward {
  constructor({ x0, x1, y }, model) {
    this.x0 = x0; this.x1 = x1; this.y = y;
    this.x = (x0 + x1) / 2;
    this.dir = 1;
    this.stun = 0;
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    if (model) this.body.add(model);
    else {
      const vest = std('#f2d22e', { emissive: 0x3a3000, emissiveIntensity: 0.3 });
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.6, 6, 12), vest);
      torso.position.y = 1.05;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), std('#7aa6f5'));
      head.position.y = 1.7;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 14), std('#1d2a55'));
      cap.position.y = 1.92;
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), std('#1d1d2a'));
      legs.position.y = 0.35;
      this.body.add(torso, head, cap, legs);
    }
    this.stars = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), new THREE.MeshBasicMaterial({ color: 0xffe07a }));
      s.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.45, 0, Math.sin((i / 3) * Math.PI * 2) * 0.45);
      this.stars.add(s);
    }
    this.stars.position.y = 2.1;
    this.stars.visible = false;
    this.group.add(this.stars);
  }

  update(dt, ctx) {
    if (this.stun > 0) {
      this.stun -= dt;
      this.stars.visible = true;
      this.stars.rotation.y += dt * 5;
      this.body.rotation.z = THREE.MathUtils.damp(this.body.rotation.z, this.dir * 0.5, 8, dt);
      if (this.stun <= 0) this.stars.visible = false;
    } else {
      this.x += this.dir * 2.3 * dt;
      if (this.x > this.x1) { this.x = this.x1; this.dir = -1; }
      if (this.x < this.x0) { this.x = this.x0; this.dir = 1; }
      this.body.rotation.z = THREE.MathUtils.damp(this.body.rotation.z, 0, 8, dt);
      this.body.rotation.y = THREE.MathUtils.damp(this.body.rotation.y, this.dir * (Math.PI / 2 - 0.5), 10, dt);
      this.body.position.y = Math.abs(Math.sin(ctx.t * 7)) * 0.06; // passo
    }
    this.group.position.set(this.x, this.y, 0);
  }

  box() { return { x0: this.x - 0.45, x1: this.x + 0.45, y0: this.y, y1: this.y + 1.85 }; }
  hurts(b) { return this.stun <= 0 && overlap(b, this.box()); }
  hit() { this.stun = 5; }
}

/** Sedile lanciato dal boss: parabola verso il punto dove sei adesso, con il bersaglio a terra. */
export class ThrownSeat {
  constructor(from, target, floorY, flight, dropBottle) {
    this.x = from.x; this.y = from.y;
    this.floorY = floorY;
    this.g = 20;
    this.vx = (target - from.x) / flight;
    this.vy = (floorY - from.y + 0.5 * this.g * flight * flight) / flight;
    this.dropBottle = dropBottle;
    this.target = target;
    this.group = new THREE.Group();
    this.mesh = seatMesh(SEAT_COLORS[Math.floor(Math.random() * 3)], 1.2);
    this.group.add(this.mesh);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 24), new THREE.MeshBasicMaterial({ color: 0xff4a5a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.set(target, floorY + 0.04, 0);
    this.group.add(this.marker);
    this.done = false;
  }

  update(dt, ctx) {
    this.vy -= this.g * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.mesh.position.set(this.x, this.y, 0);
    this.mesh.rotation.z += dt * 7;
    this.marker.scale.setScalar(0.8 + Math.sin(ctx.t * 12) * 0.15);
    if (this.y <= this.floorY) {
      this.done = true;
      ctx.mode.burst(this.x, this.floorY + 0.3, 0xff9a3a);
      ctx.mode.sfx('break');
      if (this.dropBottle) ctx.mode.spawnPickup({ x: this.x, y: this.floorY, kind: 'bottle', amount: 2 });
    }
  }

  hurts(b) { return overlap(b, { x0: this.x - 0.6, x1: this.x + 0.6, y0: this.y - 0.1, y1: this.y + 0.9 }); }
}

/** Il Tifoso Supremo: lancia sedili a parabola, ogni tanto ne lascia uno con una bottiglia dentro. Tre colpi. */
export class Boss {
  constructor({ x, y, x0, x1, hp }, model) {
    this.x = x; this.y = y; this.x0 = x0; this.x1 = x1;
    this.hp = hp; this.maxHp = hp;
    this.active = false;
    this.dir = -1;
    this.throwTimer = 2.0;
    this.throws = 0;
    this.flash = 0;
    this.stagger = 0;
    this.dead = false;
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.mats = [];
    if (model) {
      // materiali propri, per poterlo far lampeggiare senza toccare altri modelli
      model.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); this.mats.push(o.material); } });
      this.body.add(model);
    } else {
      const fan = alienFan(0.05, '#7a1e2e');
      fan.scale.setScalar(2.2);
      fan.traverse((o) => { if (o.isMesh) this.mats.push(o.material); });
      this.body.add(fan);
    }
    this.h = 3.6;
    this.group.position.set(x, y, 0);
  }

  update(dt, ctx) {
    const p = ctx.player;
    this.flash = Math.max(0, this.flash - dt);
    for (const m of this.mats) {
      if (!m.emissive) continue;
      m.emissive.setRGB(this.flash > 0 ? 0.9 : 0, this.flash > 0 ? 0.15 : 0, this.flash > 0 ? 0.15 : 0);
    }
    if (this.dead) {
      this.body.rotation.z = THREE.MathUtils.damp(this.body.rotation.z, -1.4, 3, dt);
      this.body.position.y = THREE.MathUtils.damp(this.body.position.y, -0.6, 3, dt);
      return;
    }
    // guarda sempre il giocatore, di tre quarti
    const face = p.x < this.x ? -1 : 1;
    this.body.rotation.y = THREE.MathUtils.damp(this.body.rotation.y, face * (Math.PI / 2 - 0.5), 6, dt);
    if (!this.active) return;
    if (this.stagger > 0) {
      this.stagger -= dt;
      this.body.rotation.z = Math.sin(this.stagger * 30) * 0.08;
      return;
    }
    this.body.rotation.z = 0;
    // passeggia nel suo tratto
    this.x += this.dir * 1.4 * dt;
    if (this.x > this.x1) { this.x = this.x1; this.dir = -1; }
    if (this.x < this.x0) { this.x = this.x0; this.dir = 1; }
    this.body.position.y = Math.abs(Math.sin(ctx.t * 4)) * 0.12;
    this.group.position.x = this.x;
    // lancio: più ravvicinati a ogni colpo subito
    this.throwTimer -= dt;
    if (this.throwTimer <= 0) {
      const lost = this.maxHp - this.hp;
      this.throwTimer = 2.3 - lost * 0.45;
      this.throws++;
      // ogni due lanci il sedile lascia una bottiglia; sempre se sei a secco e a terra non ce n'è
      const drop = this.throws % 2 === 0 || (ctx.mode.ammo === 0 && !ctx.mode.hasBottleOnFloor());
      const target = THREE.MathUtils.clamp(p.x + p.vx * 0.35, 197.5, 225);
      ctx.mode.spawnSeat(new ThrownSeat({ x: this.x + face * 0.4, y: this.y + 3.2 }, target, this.y, 1.5 - lost * 0.12, drop));
      this.body.position.y = 0.3;
    }
  }

  box() { return { x0: this.x - 1.0, x1: this.x + 1.0, y0: this.y, y1: this.y + this.h }; }
  hurts(b) { return this.active && !this.dead && overlap(b, this.box()); }

  hit() {
    if (this.flash > 0 || this.dead) return false;
    this.hp--;
    this.flash = 0.8;
    this.stagger = 0.9;
    if (this.hp <= 0) this.dead = true;
    return true;
  }
}

/** Bottiglia lanciata da Whiskey: dritta nella direzione in cui guarda. */
export class ThrownBottle {
  constructor(x, y, dir, model) {
    this.x = x; this.y = y; this.dir = dir;
    this.life = 1.3;
    this.group = new THREE.Group();
    this.mesh = model ? model.clone(true) : new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.5, 8), std('#3f9a5a', { roughness: 0.2 }));
    this.group.add(this.mesh);
    this.done = false;
  }

  update(dt) {
    this.x += this.dir * 19 * dt;
    this.life -= dt;
    this.mesh.position.set(this.x, this.y, 0);
    this.mesh.rotation.z -= this.dir * dt * 16;
    if (this.life <= 0) this.done = true;
  }

  box() { return { x0: this.x - 0.25, x1: this.x + 0.25, y0: this.y - 0.25, y1: this.y + 0.25 }; }
}
