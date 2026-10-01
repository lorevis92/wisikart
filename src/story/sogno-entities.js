import * as THREE from 'three';
import { locomotionPose } from './Rig.js';

// Entità del giorno dopo (story/sogno.js): la Lommy da prendere nella camera, Sunday che cammina mano nella mano,
// le luci che cambiano da una scenografia all'altra, il suo dissolversi, la bara con madre e fratello,
// le didascalie lungo il cammino. Stesse regole di entities.js: group, update(dt, ctx), ctx = { t, player, mode }.

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });

/** La Lommy sul comodino: avvicinandosi compare l'invito, e "prenderla" apre la visione (mode.onEvent). */
export class Lommy {
  constructor({ x, y }) {
    this.x = x; this.y = y;
    this.group = new THREE.Group();
    const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.32, 10), new THREE.MeshStandardMaterial({ color: 0xff7ae0, emissive: 0xc040ff, emissiveIntensity: 1.6, transparent: true, opacity: 0.85 }));
    vial.position.y = 0.16;
    this.glow = new THREE.PointLight(0xd070ff, 4, 4, 1.8);
    this.glow.position.y = 0.4;
    this.group.add(vial, this.glow);
    this.group.position.set(x, y, 0.3);
    this.vial = vial;
    this.taken = false;
  }

  reset() { this.taken = false; this.group.visible = true; }

  update(dt, ctx) {
    const p = ctx.player, mode = ctx.mode;
    this.vial.rotation.y += dt * 1.5;
    this.glow.intensity = 3 + Math.sin(ctx.t * 3) * 1.5;
    if (this.taken) return;
    const near = Math.abs(p.x - this.x) < 1.3 && Math.abs(p.y - (this.y - 0.9)) < 1.6;
    if (near) {
      mode.say('Prendi la Lommy (Lancia, ↑ o Salta)', 0.2);
      if (mode.actionPressed) {
        this.taken = true;
        this.group.visible = false;
        mode.sfx('pickup');
        mode.onEvent && mode.onEvent('lommy');
      }
    }
  }
}

/** Sunday cammina accanto a Whiskey, mano nella mano: si muove con lui (non va inseguita). */
export class Follower {
  constructor(rigged, { side = -0.75 } = {}) {
    this.rigged = rigged;
    this.side = side;
    this.group = new THREE.Group();
    if (rigged) this.group.add(rigged.root);
    else { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 6, 10), std('#f2d0a0')); b.position.y = 0.85; this.group.add(b); }
    this.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; if (o.material) { o.material = o.material.clone(); o.material.transparent = true; } } });
    this.x = 0; this.y = 0; this.fade = 1;
  }

  setOpacity(a) { this.group.traverse((o) => { if (o.isMesh && o.material) o.material.opacity = a; }); }

  update(dt, ctx) {
    const p = ctx.player;
    // un passo dietro, dal lato verso la telecamera opposto al verso di marcia: mano nella mano
    const tx = p.x + this.side * p.facing;
    this.x = THREE.MathUtils.damp(this.x || tx, tx, 10, dt);
    this.y = THREE.MathUtils.damp(this.y, p.y, 8, dt);
    this.group.position.set(this.x, this.y, 0.55);
    this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, p.facing * (Math.PI / 2 - 0.4), 10, dt);
    if (this.rigged && this.rigged.rig) {
      const run = Math.min(1, Math.abs(p.vx) / 7.5);
      const P = locomotionPose({ phase: p.walkPhase * 2.2 + 0.4, run: p.onGround ? run : 0, air: p.onGround ? null : 0 });
      // la mano verso Whiskey
      if (p.facing > 0) P.armL = { x: -0.5, z: 0.35 }; else P.armR = { x: -0.5, z: -0.35 };
      this.rigged.rig.apply(P);
    }
  }
}

/**
 * Le scenografie della visione si succedono cambiando luce e colori: zones = [{ x, sky, light, hemi }]
 * (da quella x in poi). Il cielo e le luci si sfumano lentamente da una all'altra.
 */
export class LightZones {
  constructor(zones, mode) {
    this.zones = zones;
    this.group = new THREE.Group();
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.9);
    this.group.add(this.hemi);
    this.bg = new THREE.Color(zones[0].sky);
    mode.scene.background = this.bg;
    this.label = null;
  }

  update(dt, ctx) {
    const p = ctx.player, mode = ctx.mode;
    let z = this.zones[0];
    for (const zz of this.zones) if (p.x >= zz.x) z = zz;
    const k = Math.min(1, dt * 1.2);
    this.bg.lerp(new THREE.Color(z.sky), k);
    this.hemi.color.lerp(new THREE.Color(z.light), k);
    this.hemi.groundColor.lerp(new THREE.Color(z.ground || z.light), k);
    this.hemi.intensity = THREE.MathUtils.damp(this.hemi.intensity, z.hemi ?? 0.9, 1.2, dt);
    if (z.name && z !== this.current) { this.current = z; mode.say(z.name, 2.5); }
  }
}

/** In fondo alla visione: Sunday si dissolve in un bagliore di luce, poi la visione finisce. */
export class Dissolve {
  constructor({ x, delay = 3.5, text }, follower) {
    this.x = x; this.delay = delay; this.text = text;
    this.follower = follower;
    this.group = new THREE.Group();
    this.light = new THREE.PointLight(0xfff4e0, 0, 12, 1.5);
    this.flare = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff8ee, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.group.add(this.light, this.flare);
    this.t = -1;
  }

  update(dt, ctx) {
    const p = ctx.player, mode = ctx.mode;
    if (this.t < 0 && p.x >= this.x) { this.t = 0; if (this.text) mode.say(this.text, 4); mode.sfx('flash'); }
    if (this.t < 0) return;
    this.t += dt;
    const k = Math.min(1, this.t / (this.delay * 0.8));
    const f = this.follower;
    f.setOpacity(1 - k);
    this.flare.position.set(f.x, f.y + 1, 0.6);
    this.light.position.copy(this.flare.position);
    this.flare.scale.setScalar(1 + k * 5);
    this.flare.material.opacity = Math.sin(k * Math.PI) * 0.9;
    this.light.intensity = Math.sin(k * Math.PI) * 30;
    if (this.t >= this.delay) mode.win(this.text || '', { time: 1.5 });
  }
}

/** Didascalie lungo il cammino: a ogni x, una riga (una volta sola). */
export class Captions {
  constructor(lines) { this.lines = lines.map((l) => ({ ...l, done: false })); this.group = new THREE.Group(); }

  update(dt, ctx) {
    for (const l of this.lines) if (!l.done && ctx.player.x >= l.x) { l.done = true; ctx.mode.say(l.text, l.time || 4); }
  }
}

/** Fine del cammino: arrivati a x, la visione (o la stanza) finisce. */
export class Finish {
  constructor({ x, text = '', time = 2.5 }) { this.x = x; this.text = text; this.time = time; this.group = new THREE.Group(); }

  update(dt, ctx) { if (ctx.player.x >= this.x) ctx.mode.win(this.text, { time: this.time }); }
}

/** Una persona ferma (madre, fratello): modello statico, rivolto dove serve. */
export class Still {
  constructor(model, { x, y = 0, z = -0.6, yaw = 0, color = '#3a3a44' }) {
    this.group = new THREE.Group();
    if (model) this.group.add(model);
    else { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.0, 6, 10), std(color)); b.position.y = 0.95; this.group.add(b); }
    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.group.position.set(x, y, z);
    this.group.rotation.y = yaw;
  }

  update() {}
}

/** Arredi semplici (letto, comodino, bara, casa, molo): blocchi colorati con ombre. */
export function boxProp(mode, [w, h, d], color, x, y, z = 0, extra = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(color, extra));
  m.position.set(x, y + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  mode.scene.add(m);
  return m;
}
