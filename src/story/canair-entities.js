import * as THREE from 'three';
import { overlap } from './entities.js';

// Entità della salita al promontorio Utgenra (story/salita.js). Stesse regole di entities.js: `group`,
// `update(dt, ctx)` con ctx = { t, player, mode } e, se fa male, `hurts(box)`.

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });

/** Gradino di roccia che si sbriciola un istante dopo che ci si sale sopra (attraversabile dal basso). */
export class CrumbleStep {
  constructor({ x0, x1, y }) {
    this.x0 = x0; this.x1 = x1; this.y = y; this.baseY = y;
    this.active = true;
    this.state = 'idle';
    this.timer = 0;
    this.group = new THREE.Group();
    const w = x1 - x0;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, 2.2), std('#9a7a52', { flatShading: true }));
    slab.position.y = -0.2;
    slab.castShadow = slab.receiveShadow = true;
    this.group.add(slab);
    // crepe chiare: dicono che non regge
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 2.22), std('#e8d8b0'));
      c.position.set(-w / 2 + ((i + 1) * w) / 4, -0.2, 0);
      c.rotation.z = (i % 2 ? 1 : -1) * 0.5;
      this.group.add(c);
    }
    // sassolini che cadono mentre trema
    this.pebbles = [];
    for (let i = 0; i < 5; i++) {
      const pb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08), std('#7a5a3a'));
      pb.visible = false;
      this.group.add(pb);
      this.pebbles.push(pb);
    }
    this.group.position.set((x0 + x1) / 2, y, 0);
  }

  update(dt, ctx) {
    const standing = ctx.player.standingOn === this;
    if (this.state === 'idle' && standing) { this.state = 'shake'; this.timer = 0.5; this.pebbles.forEach((p, i) => { p.visible = true; p.position.set(-0.5 + i * 0.25, -0.4, 0.8); p.userData.vy = 0; }); }
    if (this.state === 'shake') {
      this.timer -= dt;
      this.group.position.x = (this.x0 + this.x1) / 2 + Math.sin(ctx.t * 70) * 0.05;
      for (const p of this.pebbles) { p.userData.vy -= 20 * dt; p.position.y += p.userData.vy * dt; }
      if (this.timer <= 0) { this.state = 'fall'; this.active = false; this.timer = 3.2; this.vy = 0; ctx.mode.sfx('break'); }
    } else if (this.state === 'fall') {
      this.timer -= dt;
      this.vy -= 30 * dt;
      this.group.position.y += this.vy * dt;
      this.group.rotation.z += dt * 0.9;
      if (this.timer <= 0) this.reset();
    }
  }

  reset() {
    this.state = 'idle'; this.active = true;
    this.group.position.set((this.x0 + this.x1) / 2, this.baseY, 0);
    this.group.rotation.set(0, 0, 0);
    this.pebbles.forEach((p) => { p.visible = false; });
  }
}

/**
 * Raffiche di vento laterali, periodiche, annunciate in anticipo. Spingono Whiskey di lato mentre soffiano,
 * tranne quando è aggrappato (appigli o scale). Contano solo tra y0 e y1.
 */
export class WindGusts {
  constructor({ y0, y1, period = 7, warn = 1.6, gust = 2.4, force = 4.2, offset = 0 }) {
    Object.assign(this, { y0, y1, period, warn, gust, force, offset });
    this.cycle = -1;
    this.dir = 1;
    this.group = new THREE.Group();
    // strisce di vento (visibili durante la raffica, intorno a Whiskey)
    this.streaks = [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.5 + (i % 3), 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      this.group.add(m);
      this.streaks.push({ m, ox: (i * 37) % 20 - 10, oy: (i * 13) % 8 - 3, sp: 14 + (i % 4) * 3 });
    }
    this.announced = false;
    this.first = true;
  }

  update(dt, ctx) {
    const p = ctx.player, mode = ctx.mode;
    const inRange = p.y >= this.y0 - 1 && p.y <= this.y1;
    const tt = (ctx.t + this.offset) % this.period;
    const cycle = Math.floor((ctx.t + this.offset) / this.period);
    if (cycle !== this.cycle) { this.cycle = cycle; this.dir = cycle % 2 ? -1 : 1; this.announced = false; }
    const warnAt = this.period - this.warn - this.gust, gustAt = this.period - this.gust;
    this.blowing = inRange && tt >= gustAt;
    if (inRange && tt >= warnAt && tt < gustAt && !this.announced) {
      this.announced = true;
      mode.say(this.dir > 0 ? 'Raffica da sinistra! Aggrappati →' : '← Raffica da destra! Aggrappati', this.warn + this.gust);
      mode.sfx('whoosh');
      if (this.first) { this.first = false; mode.line('vento', { important: true }); }
      else if (Math.random() < 0.3) mode.line('vento');
    }
    if (this.blowing && !p.hanging && !p.climbing) {
      p.x += this.dir * this.force * dt * (p.onGround ? 0.8 : 1);
    }
    const k = this.blowing ? 1 : 0;
    for (const s of this.streaks) {
      s.m.material.opacity = THREE.MathUtils.damp(s.m.material.opacity, k * 0.5, 8, dt);
      s.ox += this.dir * s.sp * dt;
      if (s.ox > 12) s.ox -= 24;
      if (s.ox < -12) s.ox += 24;
      s.m.position.set(p.x + s.ox, p.y + 1 + s.oy, 1.2);
    }
  }
}

/**
 * Canale verticale da cui rotolano massi: la scanalatura sulla parete dice dove cadono; prima di ogni masso
 * polvere e rumore in cima. Attivo solo quando Whiskey è da quelle parti.
 */
export class BoulderChute {
  constructor({ x, yTop, yBottom, period = 5, offset = 0, r = 0.9 }, model) {
    Object.assign(this, { x, yTop, yBottom, period, offset, r });
    this.group = new THREE.Group();
    const groove = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.6, yTop - yBottom + 2), new THREE.MeshBasicMaterial({ color: 0x3a2818, transparent: true, opacity: 0.55, depthWrite: false }));
    groove.position.set(x, (yTop + yBottom) / 2, -1.9);
    this.group.add(groove);
    this.rock = new THREE.Group();
    if (model) { const m = model.clone(true); m.position.y = -r; this.rock.add(m); }
    else this.rock.add(new THREE.Mesh(new THREE.DodecahedronGeometry(r), std('#6a5038', { flatShading: true })));
    this.rock.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.rock.visible = false;
    this.group.add(this.rock);
    this.dust = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd8c0a0, transparent: true, opacity: 0, depthWrite: false }));
    this.dust.position.set(x, yTop + 1, -0.5);
    this.group.add(this.dust);
    this.state = 'wait';
    this.timer = offset;
    this.said = false;
  }

  update(dt, ctx) {
    const p = ctx.player, mode = ctx.mode;
    const near = p.y > this.yBottom - 6 && p.y < this.yTop + 4;
    this.timer -= dt;
    if (this.state === 'wait') {
      if (this.timer <= 0 && near) {
        this.state = 'warn'; this.timer = 1.1;
        mode.sfx('wall');
        mode.say('Masso in arrivo! ↓', 1.6);
        if (!this.said) { this.said = true; mode.line('masso', { important: true }); }
      } else if (this.timer <= 0) this.timer = 0.5;
    } else if (this.state === 'warn') {
      this.dust.material.opacity = 0.5 + Math.sin(ctx.t * 20) * 0.2;
      if (this.timer <= 0) { this.state = 'fall'; this.y = this.yTop; this.vy = -2; this.rock.visible = true; this.dust.material.opacity = 0; }
    } else if (this.state === 'fall') {
      this.vy = Math.max(-13, this.vy - 18 * dt);
      this.y += this.vy * dt;
      this.rock.position.set(this.x + Math.sin(this.y * 0.7) * 0.25, this.y, 0);
      this.rock.rotation.z += dt * 5;
      if (this.y < this.yBottom) { this.state = 'wait'; this.timer = this.period; this.rock.visible = false; }
    }
  }

  hurts(b) {
    if (this.state !== 'fall') return false;
    const r = this.r * 0.8;
    return overlap(b, { x0: this.x - r, x1: this.x + r, y0: this.y - r, y1: this.y + r });
  }

  get bx() { return this.x; }
}

/** Fila di appigli sulla parete (la presa vera la fa Player con level.holds). */
export class HoldRow {
  constructor({ x0, x1, y }, model) {
    this.group = new THREE.Group();
    for (let x = x0; x <= x1 + 0.01; x += 1.1) {
      const g = new THREE.Group();
      if (model) g.add(model.clone(true));
      else g.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), std('#c9a070')));
      g.position.set(x, y - 0.1, -0.35);
      g.rotation.x = -0.4;
      this.group.add(g);
    }
    // una fune tesa sopra gli appigli: si capisce da lontano che ci si appende
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, x1 - x0 + 0.6, 6), std('#d8c090'));
    rope.rotation.z = Math.PI / 2;
    rope.position.set((x0 + x1) / 2, y + 0.05, -0.3);
    this.group.add(rope);
  }

  update() {}
}

/** Panchina di pietra: il checkpoint tra un tratto e l'altro. */
export class Bench {
  constructor({ x, y }) {
    this.group = new THREE.Group();
    const m = std('#b8a080');
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 0.8), m);
    seat.position.y = 0.55;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.2), m);
    back.position.set(0, 0.95, -0.35);
    for (const s of [-0.9, 0.9]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 0.6), m);
      leg.position.set(s, 0.25, 0);
      this.group.add(leg);
    }
    this.group.add(seat, back);
    this.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.group.position.set(x, y, -0.6);
  }

  update() {}
}

/** In cima: il piazzale con le statue di Oremo; arrivandoci si vince il livello. */
export class Summit {
  constructor({ x, y, winX }, statues = []) {
    this.winX = winX; this.y = y;
    this.group = new THREE.Group();
    statues.forEach((s, i) => {
      if (!s) return;
      s.position.set(x + i * 6, y, -2.5 - i * 0.5);
      s.rotation.y = -0.3 + i * 0.25;
      this.group.add(s);
    });
    this.done = false;
  }

  update(dt, ctx) {
    const p = ctx.player;
    if (!this.done && p.x > this.winX && p.y >= this.y - 0.3 && p.onGround) {
      this.done = true;
      ctx.mode.win('Sei in cima al promontorio Utgenra: il piazzale delle statue di Oremo.', { line: 'vetta', time: 5 });
    }
  }
}

/**
 * La città di Canair sotto il promontorio, lontana dietro la parete: più si sale, più scende e si allarga
 * nell'inquadratura (la telecamera guarda un po' in basso).
 */
export class CityBelow {
  constructor() {
    this.group = new THREE.Group();
    const n = 320;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xd8b890, roughness: 0.8, emissive: 0x6a3a18, emissiveIntensity: 0.25 }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const x = ((i * 7919) % 3000) / 10 - 150, z = ((i * 104729) % 800) / 10 - 40;
      const h = 3 + ((i * 31) % 16);
      m.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(4 + (i % 4), h, 4 + ((i * 3) % 4)));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, col.setHSL(0.08 + ((i * 13) % 10) / 100, 0.35, 0.55 + ((i * 7) % 10) / 50));
    }
    this.group.add(mesh);
    // il fiume che attraversa la città
    const river = new THREE.Mesh(new THREE.PlaneGeometry(400, 14), new THREE.MeshStandardMaterial({ color: 0x4f86a8, roughness: 0.1, metalness: 0.4, emissive: 0xff8a50, emissiveIntensity: 0.15 }));
    river.rotation.x = -Math.PI / 2;
    river.position.set(0, 0.1, 10);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 140), std('#6a7a3a'));
    ground.rotation.x = -Math.PI / 2;
    this.group.add(river, ground);
  }

  update(dt, ctx) {
    const mode = ctx.mode;
    const cy = mode.camY || 4;
    const climb = Math.max(0, cy - 4);
    this.group.position.set(mode.camX || 8, cy - 30 - climb * 0.12, -120);
    const s = 1 + climb / 80;
    this.group.scale.set(s, 1, s);
  }
}
