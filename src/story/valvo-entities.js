import * as THREE from 'three';
import { overlap } from './entities.js';

// Entità del Deposito Valvo & Go. Come in entities.js: `group`, `update(dt, ctx)`, e facoltativi
// `hurts(box)` (fa male) e `onBottle(box, mode)` (reagisce a una bottigliata).
// Le parti solide (nastri, casse, paratie, saracinesche) sono oggetti { x0, x1, y0, y1 } in mode.solids:
// il Player ci cammina sopra e ci sbatte contro come sul resto del livello.

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });

function stripes(a, b, n = 8) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, 64, 64);
  g.fillStyle = b;
  for (let i = -n; i < n * 2; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16 + 8, 0); g.lineTo(i * 16 - 56, 64); g.lineTo(i * 16 - 64, 64); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Nastro trasportatore: trascina chi ci sta sopra e cambia verso a intervalli (le frecce avvisano). */
export class Conveyor {
  constructor({ x0, x1, y, depth = 0.6, speed = 3.5, period = 3.2, dir = 1 }, mode) {
    this.speed = speed; this.period = period; this.dir = dir; this.timer = period;
    this.solid = { x0, x1, y0: y - depth, y1: y, style: 'none', carry: dir * speed };
    mode.solids.push(this.solid);
    this.group = new THREE.Group();
    const w = x1 - x0;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, Math.min(depth, 1.2) + 0.2, 2.6), std('#2a2e3e', { metalness: 0.7, roughness: 0.4 }));
    frame.position.set(0, -Math.min(depth, 1.2) / 2 - 0.05, 0);
    // frecce che scorrono nel verso del nastro
    const c = document.createElement('canvas');
    c.width = 128; c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#1b1d28'; g.fillRect(0, 0, 128, 32);
    g.fillStyle = '#f2c230';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(i * 32 + 6, 4); g.lineTo(i * 32 + 22, 16); g.lineTo(i * 32 + 6, 28); g.lineTo(i * 32 + 12, 16); g.fill(); }
    this.tex = new THREE.CanvasTexture(c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.wrapS = THREE.RepeatWrapping;
    this.tex.repeat.set(w / 1.6, 1);
    this.beltMat = new THREE.MeshStandardMaterial({ map: this.tex, emissive: 0xffffff, emissiveMap: this.tex, emissiveIntensity: 0.35, roughness: 0.5 });
    const belt = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 2.4), [std('#1b1d28'), std('#1b1d28'), this.beltMat, std('#1b1d28'), std('#1b1d28'), std('#1b1d28')]);
    belt.position.y = -0.06;
    this.group.add(frame, belt);
    for (const s of [-1, 1]) {
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.6, 12), std('#8a96b0', { metalness: 0.8, roughness: 0.3 }));
      roller.rotation.x = Math.PI / 2;
      roller.position.set(s * w / 2, -0.3, 0);
      this.group.add(roller);
    }
    this.group.position.set((x0 + x1) / 2, y, 0);
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) { this.timer = this.period; this.dir *= -1; this.solid.carry = this.dir * this.speed; }
    this.tex.repeat.x = Math.abs(this.tex.repeat.x) * this.dir;
    this.tex.offset.x -= dt * this.speed * 0.6;
    // l'ultimo mezzo secondo le frecce lampeggiano: sta per cambiare verso
    this.beltMat.emissiveIntensity = this.timer < 0.6 ? (Math.sin(this.timer * 40) > 0 ? 1 : 0.1) : 0.35;
  }
}

/** Cassa con monete: si apre con una bottigliata (resta solida finché è intera). */
export class CoinCrate {
  constructor({ x, y, coins = 3 }, mode, proto) {
    this.coins = coins;
    this.solid = { x0: x - 0.6, x1: x + 0.6, y0: y, y1: y + 1.2, style: 'none' };
    mode.solids.push(this.solid);
    this.group = new THREE.Group();
    const crate = proto ? proto.clone(true) : new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 1.2), std('#8a5a32'));
    if (!proto) crate.position.y = 0.6;
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.22, 1.26), std('#f5b942', { emissive: 0x6a4400, emissiveIntensity: 0.6, metalness: 0.6 }));
    band.position.y = 0.6;
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 18), std('#ffd45a', { emissive: 0xffa000, emissiveIntensity: 0.8, metalness: 0.8 }));
    coin.rotation.x = Math.PI / 2;
    coin.position.set(0, 0.6, 0.66);
    this.group.add(crate, band, coin);
    this.group.position.set(x, y, 0);
    this.broken = false;
  }

  update() {}

  onBottle(bb, mode) {
    if (this.broken || !overlap(bb, this.solid)) return false;
    this.broken = true;
    this.solid.y0 = this.solid.y1 = -999; // non c'è più
    this.group.visible = false;
    mode.burst((this.solid.x0 + this.solid.x1) / 2, 0.6 + this.group.position.y, 0xffd45a);
    mode.addCoins(this.coins);
    return `+${this.coins} monete`;
  }
}

/**
 * Valvola con getto di vapore a intervalli fissi. dir 'up': chi ci passa sopra mentre soffia viene lanciato
 * in alto (salto potenziato); dir -1/+1: getto orizzontale che spinge indietro chi prova a passare.
 */
export class SteamValve {
  constructor({ x, y, dir = 'up', period = 3, on = 1.2, offset = 0, len = 5, power = 21 }, proto) {
    Object.assign(this, { x, y, dir, period, on, len, power });
    this.t = offset;
    this.group = new THREE.Group();
    const valve = proto ? proto.clone(true) : this._proceduralValve();
    if (dir !== 'up') valve.rotation.z = dir > 0 ? -Math.PI / 2 : Math.PI / 2; // girata verso il getto
    this.group.add(valve);
    // getto: coni di vapore semitrasparenti
    this.jet = new THREE.Group();
    const steamM = new THREE.MeshBasicMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.55, depthWrite: false });
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.4 + i * 0.25, len / 4, 12, 1, true), steamM);
      c.position.y = (i + 0.5) * (len / 4);
      c.rotation.x = Math.PI; // si allarga allontanandosi
      this.jet.add(c);
    }
    if (dir === 'up') this.jet.position.y = 1.1;
    else { this.jet.rotation.z = dir > 0 ? -Math.PI / 2 : Math.PI / 2; this.jet.position.set(dir * 0.8, 0.9, 0); }
    this.steamM = steamM;
    this.group.add(this.jet);
    this.group.position.set(x, y, 0);
  }

  _proceduralValve() {
    const g = new THREE.Group();
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.1, 14), std('#6a7488', { metalness: 0.8, roughness: 0.35 }));
    pipe.position.y = 0.55;
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.07, 8, 20), std('#d23a3a', { metalness: 0.4 }));
    wheel.rotation.x = Math.PI / 2;
    wheel.position.y = 1.15;
    g.add(pipe, wheel);
    return g;
  }

  get active() { return (this.t % this.period) < this.on; }

  update(dt, ctx) {
    this.t += dt;
    const phase = this.t % this.period;
    const active = phase < this.on;
    const warn = !active && phase > this.period - 0.5; // sbuffi di avviso
    this.jet.visible = active || warn;
    this.jet.scale.set(1, active ? 1 : 0.25, 1);
    this.steamM.opacity = active ? 0.45 + Math.sin(this.t * 30) * 0.1 : 0.3;
    if (!active) return;
    const p = ctx.player, b = p.box();
    if (this.dir === 'up') {
      const col = { x0: this.x - 0.8, x1: this.x + 0.8, y0: this.y, y1: this.y + this.len };
      // una spinta per volta: non mentre si sta già salendo per un getto
      if (overlap(b, col) && !p.boosted && p.vy <= 4) { p.launch(this.power); ctx.mode.audio.boost(0.7); }
    } else {
      const x0 = this.dir > 0 ? this.x + 0.6 : this.x - 0.6 - this.len, x1 = this.dir > 0 ? this.x + 0.6 + this.len : this.x - 0.6;
      if (overlap(b, { x0, x1, y0: this.y, y1: this.y + 1.9 })) {
        p.vx = this.dir * 12; // spinta indietro, senza danno
        p.sliding = 0;
        if (p.onGround) p.vy = Math.max(p.vy, 3.5);
      }
    }
  }
}

/** Paratia: blocco solido che si alza quando la sua leva viene colpita. */
export class Gate {
  constructor({ id, x0, x1, y0, y1 }, mode) {
    this.id = id;
    this.solid = { x0, x1, y0, y1, style: 'none' };
    mode.solids.push(this.solid);
    this.h = y1 - y0;
    this.lift = 0;
    this.opening = false;
    this.group = new THREE.Group();
    const tex = stripes('#f2c230', '#1b1d28');
    tex.repeat.set(1, this.h / 1.2);
    const door = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, this.h, 3), [std('#3a3f52', { metalness: 0.7 }), std('#3a3f52', { metalness: 0.7 }), std('#3a3f52'), std('#3a3f52'), std('#ffffff', { map: tex }), std('#3a3f52')]);
    door.position.y = this.h / 2;
    this.door = door;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3a3a }));
    lamp.position.set(0, this.h + 0.3, 1.2);
    this.lamp = lamp;
    this.group.add(door, lamp);
    this.group.position.set((x0 + x1) / 2, y0, 0);
    this.y0 = y0;
  }

  open() {
    if (this.opening) return false;
    this.opening = true;
    this.lamp.material.color.set(0x43e0b0);
    return true;
  }

  update(dt) {
    if (!this.opening || this.lift >= this.h + 0.5) return;
    this.lift = Math.min(this.h + 0.5, this.lift + dt * 7);
    this.door.position.y = this.h / 2 + this.lift;
    this.solid.y0 = this.y0 + this.lift;
    this.solid.y1 = this.y0 + this.h + this.lift;
    if (this.lift >= this.h + 0.5) { this.solid.y0 = this.solid.y1 = -999; } // del tutto aperta: non ingombra più
  }
}

/** Leva da colpire con una bottiglia: apre la paratia collegata. */
export class Lever {
  constructor({ x, y, gate }, mode) {
    this.x = x; this.y = y; this.gateId = gate; this.mode = mode;
    this.on = false;
    this.group = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.3), std('#2a2e3e', { metalness: 0.6 }));
    plate.position.y = 0.65;
    this.handle = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 8), std('#c9d0e0', { metalness: 0.8 }));
    stick.position.y = 0.4;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), std('#d23a3a', { emissive: 0x5a0000, emissiveIntensity: 0.6 }));
    knob.position.y = 0.82;
    this.knob = knob;
    this.handle.add(stick, knob);
    this.handle.position.set(0, 0.65, 0.2);
    this.handle.rotation.z = 0.7;
    // bersaglio evidente: un cerchio giallo intorno
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.85, 28), new THREE.MeshBasicMaterial({ color: 0xf2c230, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.position.set(0, 0.65, 0.4);
    this.ring = ring;
    this.group.add(plate, this.handle, ring);
    this.group.position.set(x, y, 0);
  }

  update(dt, ctx) {
    if (!this.on) this.ring.material.opacity = 0.5 + Math.sin(ctx.t * 5) * 0.3;
    this.handle.rotation.z = THREE.MathUtils.damp(this.handle.rotation.z, this.on ? -0.7 : 0.7, 12, dt);
  }

  onBottle(bb, mode) {
    if (this.on || !overlap(bb, { x0: this.x - 0.6, x1: this.x + 0.6, y0: this.y - 0.1, y1: this.y + 1.4 })) return false;
    this.on = true;
    this.ring.visible = false;
    this.knob.material.color.set(0x43e0b0);
    this.knob.material.emissive.set(0x0a5a3a);
    const gate = mode.gates && mode.gates[this.gateId];
    if (gate) gate.open();
    mode.sfx('select');
    return 'Paratia aperta!';
  }
}

/** Il badge: raccolto apre la porta dell'hangar (e fa scattare l'allarme). */
export class Badge {
  constructor({ x, y }, tex, onTake) {
    this.x = x; this.y = y; this.onTake = onTake;
    this.taken = false;
    this.group = new THREE.Group();
    const m = tex
      ? new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false })
      : new THREE.MeshStandardMaterial({ color: 0x43e0b0, emissive: 0x1a6a4a, emissiveIntensity: 0.8 });
    this.card = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), m);
    this.card.position.y = 1.1;
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.72, 28), new THREE.MeshBasicMaterial({ color: 0x43e0b0, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    glow.position.y = 1.1;
    this.glow = glow;
    this.group.add(this.card, glow);
    this.group.position.set(x, y, 0);
  }

  update(dt, ctx) {
    if (this.taken) return;
    this.card.rotation.y += dt * 2;
    this.card.position.y = 1.1 + Math.sin(ctx.t * 3) * 0.12;
    this.glow.scale.setScalar(1 + Math.sin(ctx.t * 4) * 0.08);
    if (overlap(ctx.player.box(), { x0: this.x - 0.6, x1: this.x + 0.6, y0: this.y, y1: this.y + 1.8 })) {
      this.taken = true;
      this.group.visible = false;
      this.onTake();
    }
  }
}

/**
 * Saracinesca dell'hangar: appesa al soffitto, scende fino a 1,05 m (si passa solo scivolando), resta lì
 * un attimo e poi si chiude. I tempi li decide la regia dell'hangar (HangarAlarm).
 */
export class Shutter {
  constructor({ x, top = 9 }, mode) {
    this.x = x; this.top = top;
    this.bottom = top - 0.2;
    this.solid = { x0: x - 0.3, x1: x + 0.3, y0: this.bottom, y1: top, style: 'none' };
    mode.solids.push(this.solid);
    this.group = new THREE.Group();
    const tex = new THREE.CanvasTexture((() => {
      const c = document.createElement('canvas'); c.width = 32; c.height = 64;
      const g = c.getContext('2d'); g.fillStyle = '#5a6278'; g.fillRect(0, 0, 32, 64);
      g.fillStyle = '#3a4052'; for (let y = 0; y < 64; y += 8) g.fillRect(0, y, 32, 3);
      return c;
    })());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this.tex = tex;
    this.door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 4), std('#ffffff', { map: tex, metalness: 0.6, roughness: 0.4 }));
    this.edge = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 4.1), new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2a2a, emissiveIntensity: 0 }));
    this.light = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: 0x551111 }));
    this.light.position.set(0, top - 0.5, 2.2);
    this.group.add(this.door, this.edge, this.light);
    this.group.position.x = x;
    this.setBottom(this.bottom);
  }

  setBottom(b) {
    this.bottom = b;
    this.solid.y0 = b;
    const h = Math.max(0.05, this.top - b);
    this.door.scale.y = h;
    this.door.position.y = b + h / 2;
    this.tex.repeat.set(1, h / 1.5);
    this.edge.position.y = b;
  }

  get closed() { return this.bottom < 0.9; }

  update() {}
}

/**
 * Regia dell'hangar: allarme, saracinesche in sequenza da sinistra a destra, timer, droidi che spuntano,
 * trappola (chiuso dietro una saracinesca = si riparte dall'ingresso dell'hangar), finale con Emma.
 */
export class HangarAlarm {
  constructor({ shutters, first = 3.5, gap = 2.1, lower = 1.2, hold = 1.3, close = 0.35, startX, finishX, checkpoint, droids = [], car }, mode) {
    this.mode = mode;
    this.shutters = shutters;
    this.first = first; this.gap = gap; this.lower = lower; this.hold = hold; this.close = close;
    this.startX = startX; this.finishX = finishX; this.checkpoint = checkpoint;
    this.droids = droids;
    this.car = car;
    this.on = false;
    this.t = 0;
    this.beep = 0;
    this.group = new THREE.Group();
    // luci rosse lampeggianti lungo l'hangar
    this.reds = [];
    for (let x = startX + 8; x < finishX; x += 26) {
      const l = new THREE.PointLight(0xff2020, 0, 22, 1.5);
      l.position.set(x, 7.5, 3);
      this.group.add(l);
      this.reds.push(l);
    }
    mode.onRespawn.push((cp) => { if (this.on || mode.flags.badge) this.restart(cp >= this.checkpoint ? 1.2 : null); });
  }

  /** Tempo di chiusura completa della saracinesca i (secondi dall'inizio dell'allarme). */
  closeTime(i) { return this.first + i * this.gap + this.lower + this.hold + this.close; }

  start() {
    this.on = true;
    this.t = 0;
    this.mode.audio.playTheme('allarme');
    this.mode.say('ALLARME! Le saracinesche si chiudono: corri e scivola sotto (giù mentre corri).', 3.5);
  }

  /** Riparte da capo (dopo una trappola o una vita persa nell'hangar); null = spento finché non si torna qui. */
  restart(delay) {
    for (const s of this.shutters) s.setBottom(s.top - 0.2);
    for (const d of this.droids) d.hide();
    if (delay === null) { this.on = false; return; }
    this.on = true;
    this.t = -delay;
  }

  update(dt, ctx) {
    const mode = this.mode, p = ctx.player;
    if (!this.on) { mode.extraHud.alarm = false; mode.extraHud.timer = null; return; }
    this.t += dt;
    const t = this.t;
    // luci e sirena
    const blink = Math.sin(ctx.t * 9) > 0;
    for (const l of this.reds) l.intensity = blink ? 40 : 4;
    this.beep -= dt;
    if (this.beep <= 0 && t >= 0) { this.beep = 0.75; mode.sfx('beep'); }
    // droidi: spuntano dai lati appena l'allarme parte
    if (t > 0.4) this.droids.forEach((d, i) => { if (!d.active && t > 0.4 + i * 0.5) d.appear(i % 2 ? 1 : -1); });
    // saracinesche
    this.shutters.forEach((s, i) => {
      const t0 = this.first + i * this.gap;
      let b = s.top - 0.2;
      if (t > t0) {
        const k = t - t0;
        if (k < this.lower) b = THREE.MathUtils.lerp(s.top - 0.2, 1.05, k / this.lower);
        else if (k < this.lower + this.hold) b = 1.05;
        else b = Math.max(0, THREE.MathUtils.lerp(1.05, 0, (k - this.lower - this.hold) / this.close));
      }
      s.setBottom(b);
      const active = t > t0 && b > 0;
      s.light.material.color.set(active ? (blink ? 0xff3030 : 0x551111) : b <= 0 ? 0x331111 : 0x225522);
      s.edge.material.emissiveIntensity = active ? (blink ? 2 : 0.4) : 0;
      // se scende addosso a Whiskey, lo spinge dal lato in cui si trova
      const box = p.box();
      if (overlap(box, s.solid)) p.x = p.x < s.x ? s.solid.x0 - 0.41 : s.solid.x1 + 0.41;
    });
    // trappola: una saracinesca chiusa davanti a Whiskey
    if (p.x > this.startX && this.shutters.some((s) => s.closed && s.x > p.x)) {
      mode.fail('Emma (da lontano): «Chiuso fuori. Classico.»');
      return;
    }
    // timer: quanto manca alla chiusura della prossima saracinesca davanti
    const next = this.shutters.findIndex((s) => s.x > p.x && !s.closed);
    mode.extraHud.alarm = true;
    mode.extraHud.timer = next >= 0 ? Math.max(0, this.closeTime(next) - t) : null;
    // finale: l'autovettore sotto il faro
    if (p.x >= this.finishX && p.onGround) this.finish();
  }

  finish() {
    this.on = false;
    const mode = this.mode;
    mode.extraHud.alarm = false;
    mode.extraHud.timer = null;
    for (const l of this.reds) l.intensity = 0;
    if (this.car) this.car.wake();
    mode.audio.stopMusic();
    mode.win('Emma: «Oh. Sei tu. Tre anni in un hangar e nemmeno una lavata. Sali, prima che ci ripensi.»', { voice: 'welcome', time: 5 });
  }
}

/** L'autovettore parcheggiato in fondo all'hangar, sotto un faro: si "accende" quando arriva Whiskey. */
export class ParkedCar {
  constructor({ x, y = 0 }, proto) {
    this.group = new THREE.Group();
    this.car = new THREE.Group();
    if (proto) {
      const c = proto.clone(true);
      c.traverse((o) => { if (o.isMesh) o.material = o.material.clone(); });
      this.car.add(c);
    } else {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.2, 3.6, 6, 14), std('#d99a2b', { metalness: 0.4, roughness: 0.3 }));
      body.rotation.z = Math.PI / 2;
      body.position.y = 1.5;
      this.car.add(body);
    }
    this.car.rotation.y = -Math.PI / 2 + 0.35; // di tre quarti, muso verso Whiskey che arriva
    this.group.add(this.car);
    // faro dall'alto con il suo cono di luce
    const spot = new THREE.SpotLight(0xfff1c8, 60, 20, 0.45, 0.5, 1.2);
    spot.position.set(0, 8.6, 1.5);
    spot.target.position.set(0, 0, 0);
    this.group.add(spot, spot.target);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 8.4, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
    cone.position.y = 4.4;
    this.group.add(cone);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.4, 16), new THREE.MeshBasicMaterial({ color: 0xfff1c8 }));
    lamp.position.y = 8.7;
    this.group.add(lamp);
    this.group.position.set(x, y, 0);
    this.awake = 0;
    this.woken = false;
  }

  wake() { this.woken = true; }

  update(dt, ctx) {
    this.car.position.y = Math.sin(ctx.t * 1.5) * 0.06; // fluttua appena
    if (!this.woken) return;
    this.awake = Math.min(1, this.awake + dt * 1.5);
    // si accende: un bagliore che pulsa, come se respirasse
    const k = this.awake * (0.6 + Math.sin(ctx.t * 4) * 0.4);
    this.car.traverse((o) => { if (o.isMesh && o.material.emissive) o.material.emissive.setRGB(0.1 * k, 0.5 * k, 0.45 * k); });
  }
}
