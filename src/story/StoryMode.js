import * as THREE from 'three';
import { Assets } from '../core/AssetLoader.js';
import { Player, PLAYER_H } from './Player.js';
import { loadRigged, riggedUrl } from './Rig.js';
import { EmmaVoice } from './emma.js';
import { attachGuitar } from './hero.js';
import { CrumbleRow, Fan, Scarf, Dropper, Pendulum, Pickup, Steward, Boss, ThrownBottle, goalMesh, seatMesh, overlap } from './entities.js';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// modelli di default (quelli dello stadio); ogni livello può sostituirli o aggiungerne in `models`
const DEFAULT_MODELS = {
  bottle: { url: 'assets/story/stadio/bottiglia.glb', h: 0.55 },
  patrol: { url: 'assets/story/stadio/steward.glb', h: 1.9 },
  boss: { url: 'assets/story/stadio/tifoso.glb', h: 3.6 }
};

/**
 * Modalità Storia: platform 2.5D a scorrimento laterale (telecamera fissa di lato).
 * Il livello (stadio.js, valvo.js…) descrive geometria, entità, telecamera e modelli; un livello può
 * aggiungere entità sue con `setup(mode)` e chiudere la partita con `mode.win()`.
 * Il gioco (main.js) chiama load → update/render → dispose.
 */
export class StoryMode {
  constructor({ level, character, audio, coins = 0, bonusLives = 0, onCoins, onComplete, onGameOver }) {
    this.level = level;
    this.character = character;
    this.audio = audio;
    this.onCoins = onCoins;
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
    this.pickups = [];
    this.onRespawn = []; // entità che si rimettono a posto quando Whiskey riparte dal checkpoint
    this.lives = level.lives + bonusLives; // + vite guadagnate con le monete durante un volo
    this.ammo = level.ammo;
    this.maxAmmo = level.maxAmmo;
    // monete: il totale della Storia, portato avanti tra i livelli (ogni 100 una vita in più)
    this.coins = coins;
    this.lifeUpAt = -10;
    this.extraHud = {};
    this.checkpoint = 0;
    this.state = 'play'; // play | won | over | ended
    this.stateTimer = 0;
    this.notice = null;
    this.noticeTimer = 0;
  }

  // ---------- costruzione ----------
  async load(progress = () => {}) {
    const L = this.level;
    progress(L.loadingText || 'Accendo i riflettori…');
    const defs = { ...DEFAULT_MODELS, ...(L.models || {}) };
    const keys = Object.keys(defs);
    const [charModel, ...loaded] = await Promise.all([
      loadRigged(riggedUrl(this.character), 1.8),
      ...keys.map((k) => Assets.model(defs[k].url, { targetHeight: defs[k].h }))
    ]);
    this.models = Object.fromEntries(keys.map((k, i) => [k, loaded[i]]));
    // bottiglia appoggiata (pickup, spalti) e centrata (lanci)
    this.bottleStand = this.models.bottle;
    if (this.bottleStand) {
      this.bottleCentered = new THREE.Group();
      const b = this.bottleStand.clone(true);
      b.position.y = -(defs.bottle.h / 2);
      this.bottleCentered.add(b);
    }
    progress(L.buildingText || 'Sistemo i sedili…');
    this._lights();
    await this._backgrounds();
    this._geometry();
    progress(L.enemiesText || 'Chiamo gli steward…');
    // entità comuni (tutte facoltative)
    this.crumbles = (L.crumbles || []).map((c) => new CrumbleRow(c));
    this.platforms.push(...this.crumbles);
    for (const e of this.crumbles) this._add(e, false);
    for (const f of L.fans || []) this._add(new Fan(f));
    for (const s of L.scarves || []) this._add(new Scarf(s));
    for (const d of L.droppers || []) this._add(new Dropper(d, this.bottleCentered));
    for (const p of L.pendulums || []) this._add(new Pendulum(p));
    for (const p of L.pickups || []) this.spawnPickup(p, false);
    this.stewards = (L.stewards || []).map((s) => this.addPatrol(s));
    this.boss = L.boss ? this._add(new Boss(L.boss, this.models.boss)) : null;
    // entità proprie del livello (nastri, valvole, saracinesche…)
    if (L.setup) L.setup(this);
    // Whiskey: il personaggio con scheletro (story/characters/<id>.glb); senza file, la versione procedurale
    this.player = new Player(this.character, charModel);
    this.scene.add(this.player.group);
    // la chitarra vinta a Infinity Guitars: sempre sulla schiena
    if (this.character.guitar) await attachGuitar(this.player.root);
    // battute del livello (Emma), con sottotitoli: mode.line('chiave')
    if (L.voices) { this.emma = new EmmaVoice(this.audio, L.voices); await this.emma.load(); }
    this._respawn(true);
    progress('Pronti.');
  }

  /** Aggiunge un'entità alla scena; con hazard = true fa male al contatto (metodo hurts). */
  _add(e, hazard = true) {
    this.entities.push(e);
    if (hazard && e.hurts) this.hazards.push(e);
    if (e.group) this.scene.add(e.group);
    return e;
  }

  add(e, hazard = true) { return this._add(e, hazard); }

  /** Nemico che pattuglia un tratto (steward, carrello-droide): si stordisce con una bottigliata. */
  addPatrol(def) {
    const proto = this.models[def.model || 'patrol'];
    return this._add(new Steward(def, proto ? proto.clone(true) : null));
  }

  _lights() {
    const Lt = this.level.lights || {};
    this.scene.add(new THREE.HemisphereLight(Lt.sky ?? 0xcfd8ff, Lt.ground ?? 0x3a2a5a, Lt.hemi ?? 1.25));
    const key = new THREE.DirectionalLight(Lt.key ?? 0xfff1dd, Lt.keyI ?? 1.6);
    key.position.set(-8, 20, 18);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(Lt.rim ?? 0x9a7cff, 0.7);
    rim.position.set(10, 6, -10);
    this.scene.add(rim);
    this.scene.fog = null;
    // lampade calde (tunnel dello stadio, corsie del deposito…)
    for (const [x, y, color = 0xffc27a, intensity = 12] of this.level.lamps || []) {
      const lamp = new THREE.PointLight(color, intensity, 14, 1.6);
      lamp.position.set(x, y, 2);
      this.scene.add(lamp);
    }
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
    this.scene.background = new THREE.Color(this.level.background || '#0b0d26');
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
    this.platforms = (L.platforms || []).map(({ r, style }) => ({ x0: r[0], x1: r[1], y: r[2], style, active: true }));
    this.ladders = L.ladders || [];
    this.holds = L.holds || []; // appigli per le traversate (scalata)
    const seatCols = ['#f29a2e', '#a24cf0', '#1fbfae'];
    const mats = {
      stand: std('#3b3270'), standTop: std('#5a4aa8'),
      field: std('#4a2a9a', { emissive: 0x2a0a6a, emissiveIntensity: 0.35, roughness: 0.4 }), fieldEdge: std('#3ff0b0', { emissive: 0x1fd090, emissiveIntensity: 1.2 }),
      bench: std('#2f6bd9'), brick: std('#1f4a52', { roughness: 0.9 }), wall: std('#241c4a'),
      grate: std('#4a5a78', { metalness: 0.6, roughness: 0.4 }), arena: std('#5a3aa8', { emissive: 0x2a0a5a, emissiveIntensity: 0.3 }),
      // deposito: pavimento industriale, lamiere, cemento
      floor: std('#3a3f52', { metalness: 0.5, roughness: 0.55 }), floorEdge: std('#f2c230', { emissive: 0x6a4a00, emissiveIntensity: 0.4 }),
      metal: std('#4a5068', { metalness: 0.7, roughness: 0.4 }), concrete: std('#565a66', { roughness: 0.95 }),
      crate: std('#8a5a32', { roughness: 0.85 }),
      // promontorio: roccia e cenge
      rock: std('#8a6a4a', { roughness: 0.95, flatShading: true }), ledge: std('#a3845a', { roughness: 0.9 }), plaza: std('#c9b08a', { roughness: 0.85 }),
      // il giorno dopo: nuvole, prato, molo, la camera buia
      cloud: std('#ffffff', { emissive: 0xdfe8ff, emissiveIntensity: 0.35, roughness: 1 }), meadow: std('#7ab05a', { roughness: 1 }), pier: std('#8a6a4a', { roughness: 0.9 }), dark: std('#2a2630', { roughness: 0.9 })
    };
    for (const s of this.solids) {
      const w = s.x1 - s.x0, h = s.y1 - s.y0;
      if (s.style === 'crate') { this._crateStack(s); continue; }
      if (s.style === 'none') continue; // disegnato da un'entità (nastri, paratie…)
      const depth = s.style === 'field' || s.style === 'floor' ? 7 : s.style === 'brick' ? 3 : 4;
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), mats[s.style] || mats.wall);
      box.position.set((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, depth === 7 ? -1.5 : 0);
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
      } else if (s.style === 'field' || s.style === 'floor') {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.12), s.style === 'floor' ? mats.floorEdge : mats.fieldEdge);
        edge.position.set((s.x0 + s.x1) / 2, s.y1 - 0.05, 2.0);
        this.scene.add(edge);
      }
    }
    for (const p of this.platforms) {
      if (p.style === 'goal') continue; // la traversa la disegna la porta
      const w = p.x1 - p.x0;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, p.style === 'arena' ? 0.8 : 0.3, p.style === 'arena' ? 6 : 2.4), mats[p.style] || mats.grate);
      slab.position.set((p.x0 + p.x1) / 2, p.y - (p.style === 'arena' ? 0.4 : 0.15), -0.3);
      this.scene.add(slab);
    }
    for (const g of L.goals || []) this.scene.add(goalMesh(g));
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
  }

  /** Pila di casse (cassa.glb, o scatole procedurali) che riempie un blocco solido, una cassa ogni 1,2 m. */
  _crateStack(s) {
    const size = 1.2;
    const nx = Math.max(1, Math.round((s.x1 - s.x0) / size)), ny = Math.max(1, Math.round((s.y1 - s.y0) / size));
    const cw = (s.x1 - s.x0) / nx, ch = (s.y1 - s.y0) / ny;
    const proto = this.models.crate;
    const mat = std('#8a5a32', { roughness: 0.85 });
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        let c;
        if (proto) {
          c = proto.clone(true);
          c.scale.multiplyScalar(ch / size);
          c.rotation.y = ((ix * 7 + iy * 3) % 4) * (Math.PI / 2); // non tutte uguali
        } else {
          c = new THREE.Mesh(new THREE.BoxGeometry(cw * 0.96, ch * 0.96, 1.2), mat);
          c.position.y = ch / 2;
        }
        const g = new THREE.Group();
        g.add(c);
        g.position.set(s.x0 + (ix + 0.5) * cw, s.y0 + iy * ch, 0);
        this.scene.add(g);
      }
    }
  }

  // ---------- gioco ----------
  sfx(name) { this.audio.sfx(name); }

  say(text, time = 2.4) { this.notice = text; this.noticeTimer = time; }

  /** Battuta del livello (level.voices), con sottotitolo; important = aspetta il suo turno. */
  line(key, opts) { if (this.emma) this.emma.say(key, opts); }

  addAmmo(n, kind) {
    this.ammo = Math.min(this.maxAmmo, this.ammo + n);
    this.sfx('pickup');
    this.say(kind === 'rack' ? 'Bottigliera! +6 bottiglie' : kind === 'crate' ? 'Cassa di bottiglie! +6' : `+${n} bottiglie`, 1.4);
  }

  /** Monete raccolte: ogni volta che il totale supera un multiplo di 100, una vita in più. Salvate subito. */
  addCoins(n) {
    const before = this.coins;
    this.coins += n;
    this.sfx('pickup');
    const bonus = Math.floor(this.coins / 100) - Math.floor(before / 100);
    if (bonus > 0) {
      this.lives += bonus;
      this.lifeUpAt = this.t;
      this.sfx('lap');
      this.say(`${Math.floor(this.coins / 100) * 100} monete: una vita in più!`, 2.2);
    }
    if (this.onCoins) this.onCoins(this.coins);
  }

  spawnPickup(p, announce = true) {
    const pk = new Pickup(p, this.bottleStand);
    this.pickups.push(pk);
    this._add(pk, false);
    return pk;
  }

  hasBottleOnFloor() { return this.pickups.some((p) => !p.taken && p.kind === 'bottle' && p.y >= 45); }

  spawnSeat(seat) { this.seats.push(seat); this.scene.add(seat.group); this.sfx('shoot'); }

  burst(x, y, color) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
    m.position.set(x, y, 0);
    this.scene.add(m);
    this.bursts.push({ m, t: 0 });
  }

  /** Livello vinto: messaggio, voce facoltativa di Emma, poi si torna alla piazza. */
  win(message, { voice = null, line = null, time = 3.2 } = {}) {
    if (this.state !== 'play') return;
    this.state = 'won';
    this.stateTimer = time;
    this.sfx('finish');
    if (voice) this.audio.voice(voice);
    if (line && this.emma) { this.emma.clear(); this.emma.say(line, { important: true }); }
    this.say(message, time);
  }

  _respawn(first = false) {
    const cp = this.level.checkpoints[this.checkpoint];
    this.player.reset(cp.x, cp.y);
    this.player.invuln = first ? 0 : 1.5;
    this.camX = cp.x; this.camY = cp.y + 3;
    if (!first) for (const f of this.onRespawn) f(this.checkpoint);
  }

  /** Riparte dall'ultimo checkpoint perdendo una vita (cadute, trappole). */
  fail(message) {
    // livelli senza game over: si riparte dall'ultimo punto, senza perdere niente
    if (this.level.noDeath) { if (message) this.say(message); this._respawn(); return; }
    this.lives--;
    this.sfx('hit');
    if (this.lives <= 0) return this._gameOver();
    if (message) this.say(message);
    this._respawn();
  }

  _hurt(fromX) {
    const p = this.player;
    if (p.invuln > 0 || this.state !== 'play' || this.level.noDeath) return;
    this.lives--;
    this.sfx('hit');
    if (this.lives <= 0) return this._gameOver();
    p.invuln = 1.6;
    p.climbing = null;
    p.sliding = 0;
    p.vy = 9;
    p.vx = (p.x < fromX ? -1 : 1) * 6;
  }

  _fell() { this.fail(this.level.fallText || 'Emma: «Il vuoto non è una scorciatoia.»'); }

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
    if (this.emma) {
      this.emma.update(dt);
      if (!this.saidIntro && this.level.introLine) { this.saidIntro = true; this.emma.say(this.level.introLine, { important: true }); }
    }

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
    // un tasto d'azione (per le interazioni, es. prendere la Lommy nel giorno dopo): Lancia, Su, Pugno o Salta
    this.actionPressed = !!(input.itemPressed || input.attackPressed || input.upPressed || input.jumpPressed);
    const ctl = { ax: input.axisX, ay: input.axisY, jumpPressed: input.jumpPressed, jumpHeld: input.jumpHeld, upPressed: input.upPressed };
    input.jumpPressed = input.upPressed = false;
    const ev = p.update(dt, ctl, this);
    if (ev.includes('jump')) this.sfx('jump');
    if (ev.includes('slide')) this.sfx('move');

    // lancio della bottiglia
    if (input.itemPressed && !this.maxAmmo) input.itemPressed = false;
    if (input.itemPressed) {
      input.itemPressed = false;
      if (this.ammo > 0 && p.throwAnim <= 0 && !p.climbing && !p.sliding) {
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
    if (this.state !== 'play') return this._camera(dt);

    // danni
    const box = p.box();
    for (const h of this.hazards) if (h.hurts(box)) { this._hurt(h.x ?? h.bx ?? p.x - p.facing); break; }
    for (const s of this.seats) if (s.hurts(box)) { this._hurt(s.x); break; }
    if (p.y < this.level.killY) this._fell();
    // scalata: cadendo troppo sotto l'ultimo checkpoint si riparte da lì (niente discese infinite)
    else if (this.level.fallLimit && p.y < this.level.checkpoints[this.checkpoint].y - this.level.fallLimit) this.fail(this.level.fallText || 'Emma: «Giù per la parete. Si riparte dalla panchina.»');

    // checkpoint
    const cps = this.level.checkpoints;
    for (let i = this.checkpoint + 1; i < cps.length; i++) {
      if (p.x >= cps[i].x && p.y >= cps[i].y - 0.5 && p.onGround) {
        this.checkpoint = i;
        if (cps[i].label) this.say(cps[i].label, 1.8);
      }
    }

    // boss (se il livello ne ha uno): si sveglia quando arrivi nella sua arena
    const boss = this.boss;
    if (boss) {
      if (!boss.active && p.y > this.level.boss.trigger && !boss.dead) {
        boss.active = true;
        this.audio.playTheme(this.level.bossMusic);
        this.say(this.level.boss.intro || 'Il boss!', 3);
      }
      if (boss.dead) this.win(this.level.winText || 'Livello completato!');
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
      // prima i bersagli (nemici, leve, casse con monete), poi i muri
      let hit = false;
      for (const e of this.entities) {
        if (!e.onBottle) continue;
        const r = e.onBottle(bb, this);
        if (r) { hit = true; if (typeof r === 'string') this.say(r, 1.4); break; }
      }
      if (!hit) hit = this.solids.some((s) => overlap(bb, s));
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

  /**
   * Telecamera laterale. Di norma segue Whiskey; le zone del livello (camera: [{ rect, … }]) possono
   * fissare o limitare l'inquadratura: x (numero fisso), clampX [a, b], follow (quota di x che segue),
   * y (fisso) o yOff (sopra Whiskey), dist.
   */
  _camera(dt) {
    const p = this.player;
    let tx = Math.max(p.x + p.facing * 2.2, this.level.camMinX ?? 3), ty = Math.max(this.level.camMinY ?? 4.2, p.y + 2.4), dist = 19;
    for (const z of this.level.camera || []) {
      const [x0, y0, x1, y1] = z.rect;
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      if (z.x !== undefined) tx = z.x + (p.x - z.x) * (z.follow ?? 0);
      else if (z.clampX) tx = THREE.MathUtils.clamp(p.x, z.clampX[0], z.clampX[1]);
      if (z.y !== undefined) ty = z.y;
      else if (z.yOff !== undefined) ty = p.y + z.yOff;
      if (z.dist) dist = z.dist;
      this.lookDown = z.lookDown || 0; // la telecamera guarda un po' in basso (scalata: si vede la città sotto)
      break;
    }
    this.camX = THREE.MathUtils.damp(this.camX ?? tx, tx, 4, dt);
    this.camY = THREE.MathUtils.damp(this.camY ?? ty, ty, 4, dt);
    this.camDist = THREE.MathUtils.damp(this.camDist, dist, 2.5, dt);
    const down = this.lookDown || 0;
    this.camera.position.set(this.camX, this.camY + 0.6 + down * 0.6, this.camDist);
    this.camera.lookAt(this.camX, this.camY - down, 0);
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
      lives: this.level.noDeath ? undefined : this.lives,
      maxLives: Math.max(this.level.lives, this.lives), // le vite extra delle monete si aggiungono ai cuori
      lifeUp: this.t - this.lifeUpAt < 1.5,
      ammo: this.maxAmmo ? this.ammo : undefined, // livelli senza bottiglie (scalata): niente contatore
      maxAmmo: this.maxAmmo,
      coins: this.coins,
      boss: this.boss && this.boss.active ? { hp: this.boss.hp, max: this.boss.maxHp, name: this.level.boss.name } : null,
      notice: this.notice,
      subtitle: this.emma ? this.emma.subtitle : null,
      ...this.extraHud // timer, allarme, badge… dal livello
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
