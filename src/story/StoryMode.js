import * as THREE from 'three';
import { Assets } from '../core/AssetLoader.js';
import { Player, PLAYER_H } from './Player.js';
import { CrumbleRow, Fan, Scarf, Dropper, Pendulum, Pickup, Steward, Boss, ThrownBottle, goalMesh, seatMesh, overlap } from './entities.js';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Modalità Storia: platform 2.5D a scorrimento laterale (telecamera fissa di lato).
 * Scena, fisica e HUD sono separati dal kart; il gioco (main.js) chiama load → update/render → dispose.
 */
export class StoryMode {
  constructor({ level, character, audio, onComplete, onGameOver }) {
    this.level = level;
    this.character = character;
    this.audio = audio;
    this.onComplete = onComplete;
    this.onGameOver = onGameOver;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 400);
    this.camDist = 19;
    this.t = 0;
    this.entities = [];
    this.hazards = [];
    this.projectiles = [];
    this.seats = [];
    this.bursts = [];
    this.lives = level.lives;
    this.ammo = level.ammo;
    this.maxAmmo = level.maxAmmo;
    this.checkpoint = 0;
    this.state = 'play'; // play | dead | won | over
    this.stateTimer = 0;
    this.notice = null;
    this.noticeTimer = 0;
  }

  // ---------- costruzione ----------
  async load(progress = () => {}) {
    const L = this.level;
    progress('Accendo i riflettori…');
    const S = 'assets/story/stadio/';
    const [bottleStand, stewardProto, bossModel] = await Promise.all([
      Assets.model(S + 'bottiglia.glb', { targetHeight: 0.55 }),
      Assets.model(S + 'steward.glb', { targetHeight: 1.9 }),
      Assets.model(S + 'tifoso.glb', { targetHeight: 3.6 })
    ]);
    // bottiglia centrata (per i lanci) e appoggiata a terra (per pickup e spalti)
    this.bottleStand = bottleStand;
    if (bottleStand) {
      this.bottleCentered = new THREE.Group();
      const b = bottleStand.clone(true);
      b.position.y = -0.275;
      this.bottleCentered.add(b);
    }
    progress('Sistemo i sedili…');
    this._lights();
    await this._backgrounds();
    this._geometry();
    progress('Chiamo gli steward…');
    // entità
    this.crumbles = L.crumbles.map((c) => new CrumbleRow(c));
    this.platforms.push(...this.crumbles);
    for (const e of this.crumbles) this._add(e, false);
    for (const f of L.fans) this._add(new Fan(f));
    for (const s of L.scarves) this._add(new Scarf(s));
    for (const d of L.droppers) this._add(new Dropper(d, this.bottleCentered));
    for (const p of L.pendulums) this._add(new Pendulum(p));
    this.pickups = L.pickups.map((p) => this._add(new Pickup(p, bottleStand), false));
    this.stewards = L.stewards.map((s) => this._add(new Steward(s, stewardProto ? stewardProto.clone(true) : null)));
    this.boss = this._add(new Boss(L.boss, bossModel));
    // Whiskey
    this.player = new Player(this.character);
    this.scene.add(this.player.group);
    this._respawn(true);
    progress('Pronti.');
  }

  _add(e, hazard = true) {
    this.entities.push(e);
    if (hazard && e.hurts) this.hazards.push(e);
    this.scene.add(e.group);
    return e;
  }

  _lights() {
    this.scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x3a2a5a, 1.25));
    const key = new THREE.DirectionalLight(0xfff1dd, 1.6);
    key.position.set(-8, 20, 18);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9a7cff, 0.7);
    rim.position.set(10, 6, -10);
    this.scene.add(rim);
    this.scene.fog = null;
  }

  /** Un pannello per sezione, molto dietro al piano di gioco: scorre in parallasse e sfuma ai confini. */
  async _backgrounds() {
    this.bgs = [];
    const z = -34;
    for (let i = 0; i < this.level.sections.length; i++) {
      const sec = this.level.sections[i];
      let tex = await Assets.texture(sec.bg);
      if (!tex) tex = this._fallbackBg(sec.fallback);
      const aspect = tex.userData.aspect || (tex.image ? tex.image.width / tex.image.height : 1.79);
      const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(aspect, 1), m);
      mesh.position.z = z - i * 0.2;
      mesh.renderOrder = -10 + i;
      this.scene.add(mesh);
      this.bgs.push({ sec, mesh, aspect, z: mesh.position.z });
    }
    this.scene.background = new THREE.Color('#0b0d26');
  }

  _fallbackBg([top, mid, bottom]) {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, top); grd.addColorStop(0.55, mid); grd.addColorStop(1, bottom);
    g.fillStyle = grd;
    g.fillRect(0, 0, 16, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.userData.aspect = 1.79; // proporzioni come le illustrazioni
    return t;
  }

  _geometry() {
    const L = this.level;
    this.solids = L.solids.map(({ r, style }) => ({ x0: r[0], x1: r[1], y0: r[2], y1: r[3], style }));
    this.platforms = L.platforms.map(({ r, style }) => ({ x0: r[0], x1: r[1], y: r[2], style, active: true }));
    this.ladders = L.ladders;
    const seatCols = ['#f29a2e', '#a24cf0', '#1fbfae'];
    const mats = {
      stand: std('#3b3270'), standTop: std('#5a4aa8'),
      field: std('#4a2a9a', { emissive: 0x2a0a6a, emissiveIntensity: 0.35, roughness: 0.4 }), fieldEdge: std('#3ff0b0', { emissive: 0x1fd090, emissiveIntensity: 1.2 }),
      bench: std('#2f6bd9'), brick: std('#1f4a52', { roughness: 0.9 }), wall: std('#241c4a'),
      grate: std('#4a5a78', { metalness: 0.6, roughness: 0.4 }), arena: std('#5a3aa8', { emissive: 0x2a0a5a, emissiveIntensity: 0.3 })
    };
    for (const s of this.solids) {
      const w = s.x1 - s.x0, h = s.y1 - s.y0;
      const depth = s.style === 'field' ? 7 : s.style === 'brick' ? 3 : 4;
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), mats[s.style] || mats.wall);
      box.position.set((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, s.style === 'field' ? -1.5 : 0);
      this.scene.add(box);
      if (s.style === 'stand') {
        // la fila di sedili è il piano su cui si cammina, con una seconda fila dietro
        const n = Math.max(2, Math.round(w / 1.05));
        for (let i = 0; i < n; i++) {
          for (const [dz, dy] of [[0.2, 0], [-1.6, 0.9]]) {
            const seat = seatMesh(seatCols[(((i + Math.round(s.x0)) % 3) + 3) % 3], dz < 0 ? 1.1 : 1);
            seat.position.set(s.x0 + (i + 0.5) * (w / n), s.y1 + dy - 0.05, dz);
            this.scene.add(seat);
          }
        }
        const step = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, 1.6), mats.standTop);
        step.position.set((s.x0 + s.x1) / 2, s.y1 + 0.45, -1.6);
        this.scene.add(step);
      } else if (s.style === 'field') {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.12), mats.fieldEdge);
        edge.position.set((s.x0 + s.x1) / 2, s.y1 - 0.05, 2.0);
        this.scene.add(edge);
      }
    }
    for (const p of this.platforms) {
      if (p.style === 'goal') continue; // la traversa la disegna la porta
      const w = p.x1 - p.x0;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, p.style === 'arena' ? 0.8 : 0.3, p.style === 'arena' ? 6 : 2.4), mats[p.style]);
      slab.position.set((p.x0 + p.x1) / 2, p.y - (p.style === 'arena' ? 0.4 : 0.15), -0.3);
      this.scene.add(slab);
    }
    for (const g of L.goals) this.scene.add(goalMesh(g));
    // scale
    const rail = std('#8a96b0', { metalness: 0.7, roughness: 0.35 });
    for (const l of this.ladders) {
      const h = l.y1 - l.y0 + 1;
      for (const s of [-1, 1]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, 0.1), rail);
        r.position.set(l.x + s * 0.45, l.y0 + h / 2, -0.6);
        this.scene.add(r);
      }
      for (let y = l.y0 + 0.4; y < l.y1 + 0.9; y += 0.45) {
        const rung = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.07), rail);
        rung.position.set(l.x, y, -0.6);
        this.scene.add(rung);
      }
    }
    // luci calde del tunnel
    for (const [x, y] of [[204, 6], [214, 14], [206, 22], [218, 30], [210, 42]]) {
      const lamp = new THREE.PointLight(0xffc27a, 12, 14, 1.6);
      lamp.position.set(x, y, 2);
      this.scene.add(lamp);
    }
  }

  // ---------- gioco ----------
  sfx(name) { this.audio.sfx(name); }

  say(text, time = 2.4) { this.notice = text; this.noticeTimer = time; }

  addAmmo(n, kind) {
    this.ammo = Math.min(this.maxAmmo, this.ammo + n);
    this.sfx('pickup');
    this.say(kind === 'rack' ? 'Bottigliera! +6 bottiglie' : kind === 'crate' ? 'Cassa di bottiglie! +6' : `+${n} bottiglie`, 1.4);
  }

  spawnPickup(p) {
    const pk = new Pickup(p, this.bottleStand);
    this.pickups.push(pk);
    this._add(pk, false);
  }

  hasBottleOnFloor() { return this.pickups.some((p) => !p.taken && p.kind === 'bottle' && p.y >= 45); }

  spawnSeat(seat) { this.seats.push(seat); this.scene.add(seat.group); this.sfx('shoot'); }

  burst(x, y, color) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
    m.position.set(x, y, 0);
    this.scene.add(m);
    this.bursts.push({ m, t: 0 });
  }

  _respawn(first = false) {
    const cp = this.level.checkpoints[this.checkpoint];
    this.player.reset(cp.x, cp.y);
    this.player.invuln = first ? 0 : 1.5;
    this.camX = cp.x; this.camY = cp.y + 3;
  }

  _hurt(fromX) {
    const p = this.player;
    if (p.invuln > 0 || this.state !== 'play') return;
    this.lives--;
    this.sfx('hit');
    if (this.lives <= 0) return this._gameOver();
    p.invuln = 1.6;
    p.climbing = null;
    p.vy = 9;
    p.vx = (p.x < fromX ? -1 : 1) * 6;
  }

  _fell() {
    this.lives--;
    this.sfx('hit');
    if (this.lives <= 0) return this._gameOver();
    this.say('Emma: «Il vuoto non è una scorciatoia.»');
    this._respawn();
  }

  _gameOver() {
    this.state = 'over';
    this.stateTimer = 2.8;
    this.say('Emma: «Da capo. Con calma, stavolta.»', 3);
  }

  update(dt, input) {
    this.t += dt;
    const ctx = { t: this.t, player: this.player, mode: this };
    this.noticeTimer = Math.max(0, this.noticeTimer - dt);
    if (this.noticeTimer <= 0) this.notice = null;

    if (this.state === 'over' || this.state === 'won') {
      this.stateTimer -= dt;
      for (const e of this.entities) e.update(dt, ctx);
      if (this.state === 'won') this.player.update(dt, { ax: 0, ay: 0 }, this);
      this._camera(dt);
      if (this.stateTimer <= 0) {
        const done = this.state === 'won' ? this.onComplete : this.onGameOver;
        this.state = 'ended';
        done && done();
      }
      return;
    }
    if (this.state !== 'play') return;

    const p = this.player;
    const ctl = { ax: input.axisX, ay: input.axisY, jumpPressed: input.jumpPressed, jumpHeld: input.jumpHeld, upPressed: input.upPressed };
    input.jumpPressed = input.upPressed = false;
    const ev = p.update(dt, ctl, this);
    if (ev.includes('jump')) this.sfx('jump');

    // lancio della bottiglia
    if (input.itemPressed) {
      input.itemPressed = false;
      if (this.ammo > 0 && p.throwAnim <= 0 && !p.climbing) {
        this.ammo--;
        p.throwBottle();
        const b = new ThrownBottle(p.x + p.facing * 0.5, p.y + 1.3, p.facing, this.bottleCentered);
        this.projectiles.push(b);
        this.scene.add(b.group);
        this.sfx('shoot');
      } else if (this.ammo <= 0) this.say('Niente bottiglie. Emma: «Prova con lo sguardo.»', 1.6);
    }

    for (const e of this.entities) e.update(dt, ctx);
    this._projectiles(dt, ctx);

    // danni
    const box = p.box();
    for (const h of this.hazards) if (h.hurts(box)) { this._hurt(h.x ?? h.bx ?? p.x - p.facing); break; }
    for (const s of this.seats) if (s.hurts(box)) { this._hurt(s.x); break; }
    if (p.y < this.level.killY) this._fell();

    // checkpoint
    const cps = this.level.checkpoints;
    for (let i = this.checkpoint + 1; i < cps.length; i++) {
      if (p.x >= cps[i].x && p.y >= cps[i].y - 0.5 && p.onGround) {
        this.checkpoint = i;
        if (cps[i].label) this.say(cps[i].label, 1.8);
      }
    }

    // boss: si sveglia quando arrivi nell'arena
    const boss = this.boss;
    if (!boss.active && p.y > this.level.boss.trigger && !boss.dead) {
      boss.active = true;
      this.audio.playTheme(this.level.bossMusic);
      this.say('Il Tifoso Supremo! Tre bottigliate e torna a sedersi.', 3);
    }
    if (boss.dead && this.state === 'play') {
      this.state = 'won';
      this.stateTimer = 3.2;
      this.sfx('finish');
      this.say('Livello completato! Emma: «Lo sapevo. Più o meno.»', 3.2);
    }

    // effetti
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t += dt;
      b.m.scale.setScalar(1 + b.t * 8);
      b.m.material.opacity = Math.max(0, 0.8 - b.t * 3);
      if (b.t > 0.3) { this.scene.remove(b.m); this.bursts.splice(i, 1); }
    }
    this._camera(dt);
  }

  _projectiles(dt, ctx) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const b = this.projectiles[i];
      b.update(dt);
      const bb = b.box();
      let hit = this.solids.some((s) => overlap(bb, s));
      for (const st of this.stewards) {
        if (!hit && st.stun <= 0 && overlap(bb, st.box())) { st.hit(); hit = true; this.sfx('hit'); this.say('Steward stordito', 1.2); }
      }
      if (!hit && this.boss.active && !this.boss.dead && overlap(bb, this.boss.box())) {
        hit = true;
        if (this.boss.hit()) { this.sfx('hit'); if (!this.boss.dead) this.say(`Colpito! Ancora ${this.boss.hp}.`, 1.5); }
      }
      if (hit || b.done) {
        if (hit) { this.burst(b.x, b.y, 0x9fe0ff); this.sfx('break'); }
        this.scene.remove(b.group);
        this.projectiles.splice(i, 1);
      }
    }
    for (let i = this.seats.length - 1; i >= 0; i--) {
      const s = this.seats[i];
      s.update(dt, ctx);
      if (s.done) { this.scene.remove(s.group); this.seats.splice(i, 1); }
    }
  }

  _camera(dt) {
    const p = this.player;
    let tx, ty, dist;
    if (p.y > 44.5 && p.x > 190) {
      // arena: inquadratura larga e quasi ferma, si vedono sempre boss e lanci
      tx = 211 + (p.x - 211) * 0.25; ty = 52; dist = 27;
    } else if (p.x > 194) {
      // tunnel verticale: segue soprattutto l'altezza
      tx = THREE.MathUtils.clamp(p.x, 206, 216); ty = p.y + 1.8; dist = 21;
    } else {
      tx = p.x + p.facing * 2.2; ty = Math.max(4.2, p.y + 2.4); dist = 19;
      tx = Math.max(tx, 3);
    }
    this.camX = THREE.MathUtils.damp(this.camX ?? tx, tx, 4, dt);
    this.camY = THREE.MathUtils.damp(this.camY ?? ty, ty, 4, dt);
    this.camDist = THREE.MathUtils.damp(this.camDist, dist, 2.5, dt);
    this.camera.position.set(this.camX, this.camY + 0.6, this.camDist);
    this.camera.lookAt(this.camX, this.camY, 0);
    this._updateBackgrounds();
  }

  _updateBackgrounds() {
    const cam = this.camera;
    const cx = this.camX, cy = this.camY;
    for (const bg of this.bgs) {
      const [x0, y0, x1, y1] = bg.sec.rect;
      // visibile dentro il suo rettangolo, sfuma in 8 m oltre i bordi
      const wgt = smooth(x0 - 8, x0, cx) * (1 - smooth(x1, x1 + 8, cx)) * smooth(y0 - 6, y0, cy) * (1 - smooth(y1, y1 + 6, cy));
      bg.mesh.visible = wgt > 0.001;
      bg.mesh.material.opacity = wgt;
      if (!bg.mesh.visible) continue;
      // dimensione: copre la vista a quella profondità con un margine per la parallasse
      const d = cam.position.z - bg.z;
      const viewH = 2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const viewW = viewH * cam.aspect;
      const h = Math.max(viewH * 1.25, (viewW * 1.25) / bg.aspect);
      const w = h * bg.aspect;
      bg.mesh.scale.set(h, h, 1);
      // parallasse: all'inizio della sezione si vede il bordo sinistro, alla fine il destro
      const u = THREE.MathUtils.clamp((cx - x0) / Math.max(1, x1 - x0), 0, 1);
      const v = THREE.MathUtils.clamp((cy - y0) / Math.max(1, y1 - y0), 0, 1);
      bg.mesh.position.x = cx + (0.5 - u) * (w - viewW);
      bg.mesh.position.y = cy + (0.5 - v) * (h - viewH);
    }
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  hud() {
    return {
      lives: this.lives,
      maxLives: this.level.lives,
      ammo: this.ammo,
      maxAmmo: this.maxAmmo,
      boss: this.boss && this.boss.active ? { hp: this.boss.hp, max: this.boss.maxHp } : null,
      notice: this.notice
    };
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
  }
}

export { PLAYER_H };
