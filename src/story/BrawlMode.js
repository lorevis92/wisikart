import * as THREE from 'three';
import { Assets } from '../core/AssetLoader.js';
import { loadRigged, riggedUrl, locomotionPose } from './Rig.js';
import { Player } from './Player.js';
import { EmmaVoice } from './emma.js';

// Livello brawler della Storia (il primo è la rissa alla tavola calda, story/rissa.js): arena fissa vista di
// fronte, ci si muove a destra/sinistra e in profondità. Stessa interfaccia di StoryMode e FlightMode
// (load → update → hud → dispose), così main.js li tratta allo stesso modo.

const GRAV = 30;
const JUMP_V = 10.5;
const SPEED = 5.4; // destra/sinistra
const DEPTH = 3.8; // in profondità
const HIT_Z = 0.7; // tolleranza in profondità perché un colpo vada a segno
const PICK_R = 1.15; // distanza per raccogliere sgabelli, piatti, bottiglie
// mosse di Whiskey: durata, portata, danno, se manda a terra
const MOVES = {
  p1: { dur: 0.28, reach: 1.3, dmg: 1 },
  p2: { dur: 0.28, reach: 1.3, dmg: 1 },
  p3: { dur: 0.46, reach: 1.55, dmg: 2, down: true },
  kick: { dur: 0.5, reach: 1.5, dmg: 2, down: true },
  throw: { dur: 0.3 }
};
// oggetti lanciati: velocità e danno
const THROWN = { bottle: { speed: 17, dmg: 2 }, plate: { speed: 20, dmg: 2 }, stool: { speed: 13, dmg: 3 } };

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
const yawFor = (facing) => facing * (Math.PI / 2 - 0.45); // tre quarti verso la telecamera

export class BrawlMode {
  constructor({ level, character, audio, bonusLives = 0, onComplete, onGameOver }) {
    this.level = level;
    this.character = character;
    this.audio = audio;
    this.onComplete = onComplete;
    this.onGameOver = onGameOver;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.5, 200);
    this.t = 0;
    this.lives = level.lives + bonusLives; // + vite guadagnate con le monete durante un volo
    this.ammo = level.ammo;
    this.state = 'intro'; // intro | fight | clear | exit | won | over | ended
    this.stateTimer = 1.6;
    this.notice = null;
    this.noticeTimer = 0;
    this.enemies = [];
    this.pool = [];
    this.projectiles = [];
    this.pickups = [];
    this.nets = [];
    this.bursts = [];
    this.shake = 0;
    this.waveIndex = -1;
  }

  // ---------- costruzione ----------
  async load(progress = () => {}) {
    const L = this.level;
    progress(L.loadingText || 'Preparo l’arena…');
    const M = L.models;
    const [heroRig, stool, plate, jukebox, bottle, bg] = await Promise.all([
      loadRigged(riggedUrl(this.character), 1.8),
      Assets.model(M.sgabello.url, { targetHeight: M.sgabello.h }),
      Assets.model(M.piatto.url, { targetHeight: M.piatto.h }),
      Assets.model(M.jukebox.url, { targetHeight: M.jukebox.h }),
      Assets.model(M.bottle.url, { targetHeight: M.bottle.h }),
      Assets.texture(L.background)
    ]);
    this.protos = { stool, plate, bottle };
    this._lights();
    this._backdrop(bg);
    this._floor();
    this._jukebox(jukebox);
    this._door();
    progress('Arrivano i clienti…');
    // Whiskey
    this.hero = this._fighter(heroRig, null);
    if (!heroRig) { const pl = new Player(this.character, null); this.hero.tilt.add(pl.group); }
    this.hero.hp = L.health;
    this.hero.baseH = 1.8;
    this.scene.add(this.hero.group);
    this.held = new THREE.Group(); // oggetto sollevato sopra la testa
    this.held.position.y = 2.1;
    this.hero.root.add(this.held);
    // nemici: tutti caricati adesso (ognuno con il suo scheletro), poi riusati tra un'ondata e l'altra
    const need = {};
    for (const w of L.waves) {
      const count = {};
      for (const k of [...w.spawn, ...(w.half || [])]) count[k] = (count[k] || 0) + 1;
      for (const [k, n] of Object.entries(count)) need[k] = Math.max(need[k] || 0, n);
    }
    for (const [type, n] of Object.entries(need)) {
      for (let i = 0; i < n; i++) {
        const rig = await loadRigged(M[type].url, M[type].h);
        const f = this._fighter(rig, type);
        f.type = type;
        f.def = L.enemies[type];
        f.baseH = M[type].h;
        if (f.def.baton) this._baton(f);
        f.group.visible = false;
        this.scene.add(f.group);
        this.pool.push(f);
      }
    }
    this.emma = new EmmaVoice(this.audio, L.voices);
    await this.emma.load();
    this._placeProps();
    this._resetHero();
    this._placeCamera();
    progress('Pronti.');
  }

  _lights() {
    this.scene.add(new THREE.HemisphereLight(0xffe2c4, 0x5a3a2a, 1.3));
    const key = new THREE.DirectionalLight(0xfff0d8, 1.7);
    key.position.set(-4, 14, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const c = key.shadow.camera;
    c.left = -14; c.right = 14; c.top = 8; c.bottom = -8; c.near = 1; c.far = 40;
    this.scene.add(key, key.target);
    // insegne del locale: una luce calda a sinistra e una rosa sul juke-box
    const warm = new THREE.PointLight(0xffb060, 18, 16, 1.6);
    warm.position.set(-7, 3.5, 0);
    const pink = new THREE.PointLight(0xff5fb0, 14, 10, 1.6);
    pink.position.set(8, 3, -2);
    this.scene.add(warm, pink);
    this.jukeLight = pink;
    this.scene.background = new THREE.Color('#2a1a14');
  }

  /** L'illustrazione del locale, dietro all'arena, a riempire l'inquadratura (vedi _fitBackdrop). */
  _backdrop(tex) {
    if (!tex) {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 256;
      const g = c.getContext('2d');
      const grd = g.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0, '#5a2e22'); grd.addColorStop(0.55, '#a8643a'); grd.addColorStop(0.56, '#3a2a2a'); grd.addColorStop(1, '#6a4a3a');
      g.fillStyle = grd; g.fillRect(0, 0, 16, 256);
      tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.userData.aspect = 1.79;
    }
    const aspect = tex.userData.aspect || (tex.image ? tex.image.width / tex.image.height : 1.79);
    this.bg = new THREE.Mesh(new THREE.PlaneGeometry(aspect, 1), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: false, depthWrite: false }));
    this.bg.renderOrder = -10;
    this.bgAspect = aspect;
    this.bgZ = -7;
    this.scene.add(this.bg);
  }

  /** Pavimento invisibile che raccoglie solo le ombre, più una fascia appena scura che segna l'arena. */
  _floor() {
    const A = this.level.arena;
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(40, 18), new THREE.ShadowMaterial({ opacity: 0.35 }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, 0.005, -1);
    shadow.receiveShadow = true;
    this.scene.add(shadow);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(A.x1 - A.x0 + 3, A.z1 - A.z0 + 1.2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12, depthWrite: false }));
    band.rotation.x = -Math.PI / 2;
    band.position.set((A.x0 + A.x1) / 2, 0.003, (A.z0 + A.z1) / 2);
    this.scene.add(band);
  }

  _jukebox(model) {
    const J = this.level.jukebox;
    const g = new THREE.Group();
    if (model) g.add(model);
    else {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2, 0.8), std('#8a2a4a', { emissive: 0x401020, emissiveIntensity: 0.6 }));
      box.position.y = 1;
      g.add(box);
    }
    // alone luminoso: pulsa quando è pronto, si accende di colori quando parte
    this.jukeGlow = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 32), new THREE.MeshBasicMaterial({ color: 0xff5fb0, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
    this.jukeGlow.rotation.x = -Math.PI / 2;
    this.jukeGlow.position.y = 0.02;
    g.add(this.jukeGlow);
    g.position.set(J.x, 0, J.z);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(g);
    this.juke = { ...J, group: g, used: false, playing: 0 };
  }

  /** Porta della cucina: compare accesa quando la terza ondata è finita. */
  _door() {
    const E = this.level.exit;
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.2), std('#3a2a22'));
    frame.position.y = 1.3;
    const light = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.3), new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.85 }));
    light.position.set(0, 1.2, 0.12);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 3), new THREE.MeshBasicMaterial({ color: 0x43e0b0 }));
    arrow.rotation.z = -Math.PI / 2;
    arrow.position.set(-1.4, 1.3, 0.3);
    g.add(frame, light, arrow);
    g.position.set(E.x, 0, E.z - 0.6);
    g.visible = false;
    this.scene.add(g);
    this.door = { group: g, arrow };
  }

  /** Personaggio (Whiskey o nemico): group (posizione) → root (verso) → tilt (a terra) → corpo. */
  _fighter(rigged, type) {
    const f = {
      group: new THREE.Group(), root: new THREE.Group(), tilt: new THREE.Group(),
      body: null, rig: null, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, facing: 1,
      state: 'idle', timer: 0, hurt: 0, down: 0, invuln: 0, stun: 0, walk: 0, cool: 0, alive: false
    };
    f.group.add(f.root);
    f.root.add(f.tilt);
    if (rigged) {
      f.body = rigged.root;
      f.rig = rigged.rig;
      f.tilt.add(f.body);
    } else if (type) {
      // segnaposto: corpo e testa, colori diversi per tipo
      const col = { scagnozzo: '#7a5a3a', cacciatore: '#3a4a6a', capo: '#6a2a2a' }[type] || '#555';
      const b = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.8, 6, 12), std(col));
      torso.position.y = 1.0;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), std('#d9b08a'));
      head.position.y = 1.75;
      b.add(torso, head);
      b.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      f.body = b;
      f.tilt.add(b);
    }
    // stelline di stordimento sopra la testa
    const stars = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
      s.position.set(Math.cos((i / 3) * Math.PI * 2) * 0.35, 0, Math.sin((i / 3) * Math.PI * 2) * 0.35);
      stars.add(s);
    }
    stars.visible = false;
    f.group.add(stars);
    f.stars = stars;
    return f;
  }

  /** Manganello del cacciatore (il modello non ha scheletro: il manganello si muove da solo). */
  _baton(f) {
    const pivot = new THREE.Group();
    pivot.position.set(-0.45, 1.15, 0.15); // mano destra (la sinistra del personaggio è +X)
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 8), std('#1d1d26', { metalness: 0.5 }));
    stick.position.y = 0.4;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7fd4ff }));
    tip.position.y = 0.86;
    pivot.add(stick, tip);
    pivot.rotation.x = 0.4;
    f.root.add(pivot);
    f.baton = pivot;
  }

  /** Sgabelli e piatti al loro posto (all'inizio e a ogni ondata). */
  _placeProps() {
    for (const p of this.props || []) if (p.group) this.scene.remove(p.group);
    this.props = this.level.props.map((d) => {
      const g = new THREE.Group();
      const proto = d.kind === 'stool' ? this.protos.stool : this.protos.plate;
      if (proto) g.add(proto.clone(true));
      else {
        const m = d.kind === 'stool'
          ? new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.8, 12), std('#c23a3a'))
          : new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16), std('#f0f0f0'));
        m.position.y = d.kind === 'stool' ? 0.4 : 0.02;
        g.add(m);
      }
      g.position.set(d.x, 0, d.z);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.scene.add(g);
      return { ...d, group: g, taken: false };
    });
  }

  _resetHero() {
    const h = this.hero;
    h.x = -7; h.z = 0; h.y = 0; h.vx = h.vz = h.vy = 0;
    h.facing = 1;
    h.hp = this.level.health;
    h.invuln = 0; h.hurt = 0; h.down = 0; h.stuck = 0;
    h.move = null;
    this.holding = null;
    this.held.clear();
  }

  // ---------- gioco ----------
  say(text, time = 2.4) { this.notice = text; this.noticeTimer = time; }

  _startWave(i) {
    const W = this.level.waves[i];
    this.waveIndex = i;
    this.queue = [...W.spawn];
    this.halfQueue = W.half ? [...W.half] : null;
    this.spawnCool = 0.4;
    this.waveLead = null; // il primo che entra: a metà della sua salute arrivano i rinforzi (`half`)
    this.boss = null;
    this.juke.used = false; // il juke-box torna utilizzabile
    this._placeProps();
    this.state = 'fight';
    this.say(W.label, 2.4);
    this.emma.say(W.voice, { important: true });
  }

  _spawn(type) {
    const f = this.pool.find((p) => p.type === type && !p.alive);
    if (!f) return;
    const A = this.level.arena;
    const side = this.hero.x < 0 ? 1 : -1; // entrano dal lato opposto a Whiskey, o da tutti e due a turno
    const s = this.spawnSide = this.enemies.length % 2 ? -side : side;
    f.x = s * 12; f.z = A.z0 + 0.6 + Math.random() * (A.z1 - A.z0 - 1.2); f.y = 0;
    f.vx = f.vy = f.vz = 0;
    f.hp = f.def.hp; f.maxHp = f.def.hp;
    f.state = 'enter'; f.timer = 0; f.cool = 1 + Math.random(); f.hurt = f.down = f.stun = 0;
    f.netCool = f.def.net ? 3 : 0;
    f.facing = -s;
    f.alive = true;
    f.fade = 1;
    f.group.visible = true;
    f.tilt.rotation.set(0, 0, 0);
    f.body.visible = true;
    this.enemies.push(f);
    if (!this.waveLead) this.waveLead = f;
    if (type === this.level.waves[this.waveIndex].boss) this.boss = f;
  }

  update(dt, input) {
    this.t += dt;
    this.emma.update(dt);
    this.noticeTimer = Math.max(0, this.noticeTimer - dt);
    if (this.noticeTimer <= 0) this.notice = null;
    const ctl = this._controls(input);

    if (this.state === 'won' || this.state === 'over') {
      this.stateTimer -= dt;
      this._heroUpdate(dt, { ax: this.state === 'won' ? 1 : 0, ay: 0 });
      this._enemiesUpdate(dt);
      this._effects(dt);
      this._placeCamera(dt);
      if (this.stateTimer <= 0) {
        const done = this.state === 'won' ? this.onComplete : this.onGameOver;
        this.state = 'ended';
        done && done();
      }
      return;
    }
    if (this.state === 'ended') return;

    if (this.state === 'intro') {
      this.stateTimer -= dt;
      if (!this.saidIntro) { this.saidIntro = true; this.emma.say('entrata', { important: true }); }
      if (this.stateTimer <= 0) this._startWave(0);
    }

    this._heroUpdate(dt, ctl);
    this._enemiesUpdate(dt);
    this._waves(dt);
    this._projectiles(dt);
    this._pickups();
    this._nets(dt);
    this._effects(dt);

    // uscita dalla cucina, vinta la terza ondata
    if (this.state === 'exit') {
      const E = this.level.exit, h = this.hero;
      this.door.arrow.position.x = -1.4 + Math.sin(this.t * 6) * 0.2;
      if (h.x > E.x - 0.9 && Math.abs(h.z - E.z) < 1.4) {
        this.state = 'won';
        this.stateTimer = 1.6;
        this.audio.sfx('finish');
        this.say('Fuori dalla cucina!', 2);
      }
    }
    this._placeCamera(dt);
  }

  _controls(input) {
    const c = { ax: input.axisX, ay: input.axisY, jump: input.jumpPressed, attack: input.attackPressed, item: input.itemPressed };
    input.jumpPressed = input.upPressed = input.itemPressed = input.attackPressed = false;
    return c;
  }

  // ---------- Whiskey ----------
  _heroUpdate(dt, ctl) {
    const h = this.hero, A = this.level.arena;
    h.invuln = Math.max(0, h.invuln - dt);
    h.hurt = Math.max(0, h.hurt - dt);
    h.stuck = Math.max(0, h.stuck - dt);
    if (h.down > 0) { h.down -= dt; if (h.down <= 0) h.invuln = Math.max(h.invuln, 1.8); }
    const free = h.down <= 0 && h.stuck <= 0 && h.hurt <= 0 && this.state !== 'over';
    const onGround = h.y <= 0.001;

    if (free && !h.move) {
      h.vx = ctl.ax * SPEED;
      h.vz = -ctl.ay * DEPTH;
      if (Math.abs(ctl.ax) > 0.15) h.facing = Math.sign(ctl.ax);
    } else if (h.move) {
      h.vx *= Math.max(0, 1 - dt * 10);
      h.vz *= Math.max(0, 1 - dt * 10);
    } else {
      h.vx *= Math.max(0, 1 - dt * 6);
      h.vz = 0;
    }
    if (free && ctl.jump && onGround && !h.move) { h.vy = JUMP_V; this.audio.sfx('jump'); }
    if (free && ctl.attack) {
      if (this.holding) this._throwHeld();
      else if (!h.move) this._startMove(onGround ? 'p1' : 'kick');
      else if (h.move.kind === 'p1' || h.move.kind === 'p2') h.move.queued = true;
    }
    if (free && ctl.item && !h.move) this._useItem();

    // mossa in corso: il colpo parte a metà
    if (h.move) {
      const m = h.move, M = MOVES[m.kind];
      m.t += dt;
      if (!m.hit && m.t >= M.dur * 0.42) { m.hit = true; if (M.reach) this._heroHit(M); }
      if (m.t >= M.dur) {
        const next = m.queued ? { p1: 'p2', p2: 'p3' }[m.kind] : null;
        h.move = null;
        if (next) this._startMove(next);
      }
    }

    h.x = THREE.MathUtils.clamp(h.x + h.vx * dt, A.x0, A.x1);
    h.z = THREE.MathUtils.clamp(h.z + h.vz * dt, A.z0, A.z1);
    h.vy -= GRAV * dt;
    h.y = Math.max(0, h.y + h.vy * dt);
    if (h.y === 0 && h.vy < 0) h.vy = 0;
    if (Math.hypot(h.vx, h.vz) > 0.3 && onGround) h.walk += dt * Math.hypot(h.vx, h.vz) * 1.7;
    this._poseHero(dt);
  }

  _startMove(kind) {
    const h = this.hero;
    h.move = { kind, t: 0, hit: false, queued: false };
    h.vx = h.facing * (kind === 'p3' || kind === 'kick' ? 3 : 1.2); // piccolo affondo
    this.audio.sfx('swing');
  }

  /** Colpo di Whiskey: tutti i nemici davanti, alla stessa profondità, entro la portata (anche il juke-box). */
  _heroHit(M) {
    const h = this.hero;
    let landed = false;
    for (const e of this.enemies) {
      if (!e.alive || e.hp <= 0 || e.down > 0) continue;
      const dx = (e.x - h.x) * h.facing;
      if (dx < -0.2 || dx > M.reach || Math.abs(e.z - h.z) > HIT_Z || Math.abs(e.y - h.y) > 1.3) continue;
      this._damage(e, M.dmg, M.down, h.facing);
      landed = true;
    }
    const J = this.juke;
    if (!J.used && Math.abs(J.z - h.z) < 1.1 && (J.x - h.x) * h.facing > -0.2 && (J.x - h.x) * h.facing < M.reach + 0.5) this._jukeboxHit();
    if (landed) { this.audio.sfx(M.down ? 'punch3' : 'punch'); this.shake = Math.max(this.shake, M.down ? 0.35 : 0.15); }
  }

  /** Lancia: se si ha qualcosa in mano lo tira; vicino a uno sgabello o a un piatto lo raccoglie; sennò una bottiglia. */
  _useItem() {
    const h = this.hero;
    if (this.holding) return this._throwHeld();
    let near = null, nd = PICK_R;
    for (const p of this.props) {
      if (p.taken) continue;
      const d = Math.hypot(p.x - h.x, p.z - h.z);
      if (d < nd) { nd = d; near = p; }
    }
    if (near) {
      near.taken = true;
      this.scene.remove(near.group);
      near.group.position.set(0, 0, 0);
      near.group.rotation.set(0, 0, 0);
      this.held.add(near.group);
      this.holding = near;
      this.audio.sfx('pickup');
      this.say(near.kind === 'stool' ? 'Sgabello in mano: Lancia o Pugno per tirarlo' : 'Piatto in mano: Lancia o Pugno per tirarlo', 1.6);
      return;
    }
    if (this.ammo <= 0) { this.say('Niente bottiglie. Emma: «Prova con gli sgabelli.»', 1.6); return; }
    this.ammo--;
    this._launch('bottle', this.protos.bottle);
  }

  _throwHeld() {
    const p = this.holding;
    this.holding = null;
    this.held.remove(p.group);
    this._launch(p.kind, null, p.group);
  }

  _launch(kind, proto, group = null) {
    const h = this.hero;
    let g = group;
    if (!g) {
      g = new THREE.Group();
      if (proto) { const m = proto.clone(true); m.position.y = -0.25; g.add(m); }
      else g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.4, 8), std('#3f9a5a')));
    }
    g.position.set(h.x + h.facing * 0.6, h.y + 1.3, h.z);
    this.scene.add(g);
    this.projectiles.push({ kind, group: g, x: g.position.x, y: g.position.y, z: h.z, vx: h.facing * THROWN[kind].speed, vy: 2.2, dmg: THROWN[kind].dmg });
    h.move = { kind: 'throw', t: 0, hit: true, queued: false };
    this.audio.sfx('shoot');
  }

  _projectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.vy -= 9 * dt;
      p.y += p.vy * dt;
      p.group.position.set(p.x, p.y, p.z);
      p.group.rotation.z -= Math.sign(p.vx) * dt * 14;
      let hit = false;
      for (const e of this.enemies) {
        if (!e.alive || e.hp <= 0 || e.down > 0) continue;
        if (Math.abs(e.x - p.x) < 0.65 && Math.abs(e.z - p.z) < HIT_Z && p.y < e.y + e.baseH + 0.2) {
          this._damage(e, p.dmg, true, Math.sign(p.vx));
          hit = true;
          break;
        }
      }
      const J = this.juke;
      if (!hit && !J.used && Math.abs(J.x - p.x) < 0.8 && Math.abs(J.z - p.z) < 1.2) { this._jukeboxHit(); hit = true; }
      if (hit || p.y < 0 || Math.abs(p.x) > 15) {
        this._burst(p.x, Math.max(0.3, p.y), p.z, p.kind === 'stool' ? 0xd08a4a : 0xe8f7ff);
        this.audio.sfx(hit ? 'punch3' : 'break');
        if (hit) this.shake = Math.max(this.shake, 0.3);
        this.scene.remove(p.group);
        this.projectiles.splice(i, 1);
      }
    }
  }

  _damage(e, dmg, knock, dir) {
    e.hp -= dmg;
    // colpo già caricato: un colpo leggero non lo ferma, si scambiano i colpi
    if (!knock && e.hp > 0 && e.state === 'windup' && e.timer < e.def.windup * 0.45) { this._burst(e.x, 1.3, e.z, 0xffe8a0); return; }
    e.stun = 0;
    e.stars.visible = false;
    e.facing = -dir;
    // corazzato (il capo): i colpi leggeri non lo fermano, quelli pesanti lo fanno solo barcollare
    if (e.def.armor && e.hp > 0) {
      if (knock) { e.state = 'hurt'; e.hurt = 0.35; e.vx = dir * 3; }
      this._burst(e.x, 1.5, e.z, 0xffe8a0);
      return;
    }
    if (e.hp <= 0 || knock) {
      e.state = 'down';
      e.down = e.hp <= 0 ? 1.1 : 1.2;
      e.vx = dir * 5;
      e.vy = 4;
    } else {
      e.state = 'hurt';
      e.hurt = 0.4;
      e.vx = dir * 2.5;
    }
    this._burst(e.x, 1.3, e.z, 0xffe8a0);
  }

  /** Juke-box colpito: parte la musica e tutti i nemici in campo restano storditi. */
  _jukeboxHit() {
    const J = this.juke;
    J.used = true;
    J.playing = J.stun;
    for (const e of this.enemies) {
      if (!e.alive || e.hp <= 0) continue;
      e.stun = J.stun;
      if (e.state !== 'down') { e.state = 'stun'; e.timer = 0; }
    }
    this.audio.sfx('jukebox');
    this.emma.say('jukebox', { important: true });
    this.say('Juke-box! Tutti storditi', 2);
    this.shake = Math.max(this.shake, 0.2);
  }

  /** Whiskey incassa un colpo: salute giù; a zero perde una vita (e si rialza con la salute piena). */
  _hurtHero(dmg, dir) {
    const h = this.hero;
    if (h.invuln > 0 || h.down > 0 || this.state === 'over' || this.state === 'won') return;
    h.hp -= dmg;
    h.move = null;
    this.audio.sfx('hit');
    this.shake = Math.max(this.shake, 0.4);
    if (h.hp <= 0) return this._loseLife(dir);
    h.hurt = 0.35;
    h.invuln = 0.9;
    h.vx = dir * 4;
    this.emma.say('hit');
  }

  _loseLife(dir = -this.hero.facing, message = null) {
    const h = this.hero;
    this.lives--;
    if (this.holding) { this.held.remove(this.holding.group); this.holding = null; }
    if (this.lives <= 0) {
      this.state = 'over';
      this.stateTimer = 2.8;
      h.down = 3;
      this.emma.clear();
      this.say('Emma: «Da capo. Con calma, stavolta.»', 3);
      return;
    }
    h.hp = this.level.health;
    h.down = 1.3;
    h.vx = dir * 4;
    h.vy = 5;
    this.emma.say('persa', { important: true });
    if (message) this.say(message, 2);
    // chi è vicino fa un passo indietro: si rialza in pace
    for (const e of this.enemies) if (e.alive && Math.abs(e.x - h.x) < 3) { e.vx = Math.sign(e.x - h.x || 1) * 5; e.cool = Math.max(e.cool, 1.5); }
  }

  // ---------- nemici ----------
  _enemiesUpdate(dt) {
    const h = this.hero, A = this.level.arena;
    const attacking = this.enemies.filter((e) => e.state === 'windup' || e.state === 'strike').length;
    let tokens = 2 - attacking;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const D = e.def;
      e.cool -= dt;
      if (e.netCool !== undefined) e.netCool -= dt;
      let wantX = 0, wantZ = 0;
      switch (e.state) {
        case 'enter': {
          // entra in scena camminando fino dentro l'arena
          const tx = THREE.MathUtils.clamp(e.x, A.x0 + 1, A.x1 - 1);
          wantX = Math.sign(tx - e.x);
          if (Math.abs(tx - e.x) < 0.2) e.state = 'approach';
          break;
        }
        case 'approach': {
          if (this.state === 'over' || this.state === 'won') break;
          const side = Math.sign(e.x - h.x) || 1;
          const tx = h.x + side * D.reach * 0.8;
          // quelli in attesa si allargano in profondità, così non stanno tutti in fila
          const idx = this.enemies.indexOf(e);
          const tz = THREE.MathUtils.clamp(h.z + (idx % 3 === 0 ? 0 : idx % 3 === 1 ? 0.9 : -0.9) * (e.cool > 0 ? 1 : 0), A.z0, A.z1);
          if (Math.abs(tx - e.x) > 0.2) wantX = Math.sign(tx - e.x);
          if (Math.abs(tz - e.z) > 0.15) wantZ = Math.sign(tz - e.z);
          e.facing = -side;
          const inPlace = Math.abs(tx - e.x) < 0.6 && Math.abs(h.z - e.z) < 0.45;
          if (D.net && e.netCool <= 0 && h.down <= 0) {
            e.state = 'netwind'; e.timer = 0.5; e.netCool = D.net.every;
          } else if (inPlace && e.cool <= 0 && tokens > 0 && h.down <= 0) {
            e.state = 'windup'; e.timer = D.windup; tokens--;
          }
          break;
        }
        case 'windup':
          e.timer -= dt;
          if (e.timer <= 0) {
            e.state = 'strike'; e.timer = 0.2;
            this.audio.sfx('swing');
            const dx = (h.x - e.x) * e.facing;
            if (dx > -0.2 && dx < D.reach + 0.25 && Math.abs(h.z - e.z) < 0.65 && h.y < 1.0) this._hurtHero(D.damage, e.facing);
          }
          break;
        case 'strike':
          e.timer -= dt;
          if (e.timer <= 0) { e.state = 'recover'; e.timer = 0.35; }
          break;
        case 'recover':
          e.timer -= dt;
          if (e.timer <= 0) { e.state = 'approach'; e.cool = D.cooldown * (0.8 + Math.random() * 0.4); }
          break;
        case 'netwind':
          // il capo alza la rete: il bersaglio a terra compare dove si trova Whiskey adesso
          e.timer -= dt;
          e.facing = Math.sign(h.x - e.x) || e.facing;
          if (e.timer <= 0) { this._throwNet(D.net); e.state = 'recover'; e.timer = 0.5; }
          break;
        case 'hurt':
          e.hurt -= dt;
          if (e.hurt <= 0) e.state = 'approach';
          if (D.net && e.netCool <= 0 && h.down <= 0 && this.state === 'fight') { e.state = 'netwind'; e.timer = 0.5; e.netCool = D.net.every; }
          break;
        case 'stun':
          e.stun -= dt;
          if (e.stun <= 0) { e.state = 'approach'; e.cool = 0.6; }
          break;
        case 'down':
          e.down -= dt;
          if (e.down <= 0) {
            if (e.hp <= 0) { e.state = 'dead'; e.timer = 0.8; this._defeated(e); }
            else { e.state = 'getup'; e.timer = 0.45; }
          }
          break;
        case 'getup':
          e.timer -= dt;
          if (e.timer <= 0) { e.state = 'approach'; e.cool = 0.8; }
          break;
        case 'dead':
          e.timer -= dt;
          e.body.visible = Math.floor(e.timer * 12) % 2 === 0;
          if (e.timer <= 0) { e.alive = false; e.group.visible = false; }
          break;
      }
      const moving = e.state === 'enter' || e.state === 'approach';
      const sp = D.speed;
      if (moving) {
        e.vx = THREE.MathUtils.damp(e.vx, wantX * sp, 10, dt);
        e.vz = THREE.MathUtils.damp(e.vz, wantZ * sp * 0.7, 10, dt);
      } else {
        e.vx *= Math.max(0, 1 - dt * 5);
        e.vz = 0;
      }
      e.x += e.vx * dt;
      e.z = THREE.MathUtils.clamp(e.z + e.vz * dt, A.z0, A.z1);
      if (e.state !== 'enter') e.x = THREE.MathUtils.clamp(e.x, A.x0 - 0.5, A.x1 + 0.5);
      e.vy -= GRAV * dt;
      e.y = Math.max(0, e.y + e.vy * dt);
      if (e.y === 0 && e.vy < 0) e.vy = 0;
      if (moving && Math.hypot(e.vx, e.vz) > 0.3) e.walk += dt * Math.hypot(e.vx, e.vz) * 1.8;
    }
    // non si sovrappongono
    const live = this.enemies.filter((e) => e.alive && e.state !== 'dead');
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < 0.85 && d > 1e-4) { const k = (0.85 - d) / 2 / d; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k; }
    }
    for (const e of this.enemies) if (e.alive) this._poseEnemy(e, dt);
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  /** Nemico battuto: a volte lascia bottiglie; il capo a metà chiama i rinforzi. */
  _defeated(e) {
    if (Math.random() < e.def.drop) this._drop(e.x, e.z);
  }

  _drop(x, z) {
    const g = new THREE.Group();
    const proto = this.protos.bottle;
    for (let i = 0; i < 2; i++) {
      const b = proto ? proto.clone(true) : new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.4, 8), std('#3f9a5a'));
      b.position.set(i * 0.22 - 0.11, proto ? 0 : 0.2, 0);
      g.add(b);
    }
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 24), new THREE.MeshBasicMaterial({ color: 0x7fe0a0, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.02;
    g.add(halo);
    g.position.set(x, 0, THREE.MathUtils.clamp(z, this.level.arena.z0, this.level.arena.z1));
    this.scene.add(g);
    this.pickups.push({ x: g.position.x, z: g.position.z, group: g, n: 2 });
  }

  _pickups() {
    const h = this.hero;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.group.rotation.y += 0.03;
      if (Math.hypot(p.x - h.x, p.z - h.z) < PICK_R * 0.8 && h.y < 0.5 && this.ammo < this.level.maxAmmo) {
        this.ammo = Math.min(this.level.maxAmmo, this.ammo + p.n);
        this.audio.sfx('pickup');
        this.say(`+${p.n} bottiglie`, 1.2);
        this.scene.remove(p.group);
        this.pickups.splice(i, 1);
      }
    }
  }

  /** Rete del capo: bersaglio a terra dove si trova Whiskey, che si riempie; poi la rete cade. */
  _throwNet(N) {
    const h = this.hero;
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(N.radius - 0.12, N.radius, 40), new THREE.MeshBasicMaterial({ color: 0xff3a4a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(N.radius, 40), new THREE.MeshBasicMaterial({ color: 0xff3a4a, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
    for (const m of [ring, fill]) { m.rotation.x = -Math.PI / 2; m.position.y = 0.02; }
    fill.scale.setScalar(0.05);
    // la rete: una griglia di corde che scende dall'alto
    const net = new THREE.Mesh(new THREE.CircleGeometry(N.radius, 12, 0, Math.PI * 2), new THREE.MeshBasicMaterial({ color: 0xd8c8a0, wireframe: true }));
    net.rotation.x = -Math.PI / 2;
    net.position.y = 7;
    g.add(ring, fill, net);
    g.position.set(h.x, 0, h.z);
    this.scene.add(g);
    this.nets.push({ x: h.x, z: h.z, r: N.radius, t: 0, warn: N.warn, group: g, fill, net, done: false });
    this.audio.sfx('warn');
  }

  _nets(dt) {
    const h = this.hero;
    for (let i = this.nets.length - 1; i >= 0; i--) {
      const n = this.nets[i];
      n.t += dt;
      const k = Math.min(1, n.t / n.warn);
      n.fill.scale.setScalar(0.05 + k * 0.95);
      n.net.position.y = k < 0.8 ? 7 : THREE.MathUtils.lerp(7, 0.1, (k - 0.8) / 0.2);
      if (!n.done && n.t >= n.warn) {
        n.done = true;
        this.audio.sfx('net');
        if (Math.hypot(h.x - n.x, h.z - n.z) < n.r && h.invuln <= 0 && h.down <= 0 && this.state !== 'won') {
          // presi nella rete: è l'unico colpo che toglie una vita intera
          h.stuck = 1.1;
          this.shake = Math.max(this.shake, 0.5);
          this.audio.sfx('hit');
          this._loseLife(-h.facing, 'Presi nella rete!');
          if (this.lives > 0) { h.down = 0; h.invuln = 2.2; } // si resta in piedi, impigliati, poi un attimo di respiro
        }
      }
      if (n.t > n.warn + 1.0) { this.scene.remove(n.group); this.nets.splice(i, 1); }
    }
  }

  _waves(dt) {
    if (this.state !== 'fight') {
      if (this.state === 'clear') {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this._startWave(this.waveIndex + 1);
      }
      return;
    }
    const W = this.level.waves[this.waveIndex];
    this.spawnCool -= dt;
    const active = this.enemies.filter((e) => e.alive && e.hp > 0).length;
    if (this.queue.length && active < W.maxActive && this.spawnCool <= 0) { this._spawn(this.queue.shift()); this.spawnCool = 0.35; } // entrano in gruppo
    // il primo (il capo, nella terza ondata) a metà: entrano i rinforzi
    if (this.halfQueue && this.waveLead && this.waveLead.hp <= this.waveLead.maxHp / 2) { this.queue.push(...this.halfQueue); this.halfQueue = null; this.say('Rinforzi!', 1.6); }
    if (!this.queue.length && !this.halfQueue && !this.enemies.some((e) => e.alive)) {
      this.hero.hp = Math.min(this.level.health, this.hero.hp + 2); // un po' di fiato tra un'ondata e l'altra
      this.boss = null;
      if (this.waveIndex + 1 < this.level.waves.length) {
        this.state = 'clear';
        this.stateTimer = 2.4;
        this.say('Ondata superata!', 2);
        this.audio.sfx('lap');
      } else {
        this.state = 'exit';
        this.door.group.visible = true;
        this.emma.clear();
        this.emma.say('fine', { important: true });
        this.say('Esci dalla cucina: la porta è a destra, sul fondo', 4);
        this.audio.sfx('finish');
      }
    }
  }

  // ---------- pose ----------
  _poseHero(dt) {
    const h = this.hero;
    h.group.position.set(h.x, h.y, h.z);
    h.root.rotation.y = THREE.MathUtils.damp(h.root.rotation.y, yawFor(h.facing), 16, dt);
    const lying = h.down > 0 ? 1 : 0;
    h.tilt.rotation.x = THREE.MathUtils.damp(h.tilt.rotation.x, lying ? -1.45 : 0, 10, dt);
    h.tilt.position.y = lying ? 0.25 : 0;
    const run = Math.min(1, Math.hypot(h.vx, h.vz) / SPEED);
    const air = h.y > 0.01 ? THREE.MathUtils.clamp(h.vy / JUMP_V, -1, 1) : null;
    let P = locomotionPose({ phase: h.walk, run: air === null ? run : 0, air });
    const m = h.move;
    if (m) {
      const k = Math.sin(Math.min(1, m.t / MOVES[m.kind].dur) * Math.PI); // estensione del colpo
      if (m.kind === 'p1') { P.armR = { x: THREE.MathUtils.lerp(-0.4, -1.55, k), z: -0.15 }; P.foreArmR = { x: THREE.MathUtils.lerp(-1.4, -0.1, k) }; P.spine = { y: -0.4 * k }; }
      if (m.kind === 'p2') { P.armL = { x: THREE.MathUtils.lerp(-0.4, -1.55, k), z: 0.15 }; P.foreArmL = { x: THREE.MathUtils.lerp(-1.4, -0.1, k) }; P.spine = { y: 0.4 * k }; }
      if (m.kind === 'p3') { P.upLegR = { x: -1.5 * k }; P.legR = { x: 0.2 }; P.upLegL = { x: 0.2 * k }; P.armL = { x: -0.8, z: 0.5 }; P.armR = { x: 0.4, z: -0.5 }; P.spine = { x: -0.2 * k }; }
      if (m.kind === 'kick') { P.upLegR = { x: -1.3 }; P.legR = { x: 0.1 }; P.upLegL = { x: -0.4 }; P.legL = { x: 1.2 }; P.armL = { x: -1, z: 0.9 }; P.armR = { x: -1, z: -0.9 }; }
      if (m.kind === 'throw') P = { ...P, ...locomotionPose({ phase: 0, run: 0, throwT: 1 - Math.min(1, m.t / MOVES.throw.dur) }) };
    }
    if (this.holding) { P.armL = { x: -2.9, z: 0.25 }; P.armR = { x: -2.9, z: -0.25 }; P.foreArmL = { x: -0.5 }; P.foreArmR = { x: -0.5 }; }
    if (h.hurt > 0 || h.stuck > 0) { P.spine = { x: -0.35 }; P.head = { x: -0.3 }; P.armL = { x: -0.6, z: 0.8 }; P.armR = { x: -0.6, z: -0.8 }; }
    if (h.rig) h.rig.apply(P);
    else if (h.body) h.body.rotation.set(m ? -0.15 : run * 0.15, 0, Math.sin(h.walk) * 0.08 * run);
    h.stars.visible = h.stuck > 0;
    if (h.stuck > 0) { h.stars.position.y = 2.1; h.stars.rotation.y += dt * 6; }
    h.group.visible = h.invuln <= 0 || h.down > 0 || Math.floor(h.invuln * 14) % 2 === 0;
  }

  _poseEnemy(e, dt) {
    e.group.position.set(e.x, e.y, e.z);
    e.root.rotation.y = THREE.MathUtils.damp(e.root.rotation.y, yawFor(e.facing), 12, dt);
    const lying = e.state === 'down' || e.state === 'dead';
    e.tilt.rotation.x = THREE.MathUtils.damp(e.tilt.rotation.x, lying ? -1.45 : e.state === 'getup' ? -0.6 : 0, 10, dt);
    e.tilt.position.y = lying ? 0.25 : 0;
    const run = Math.min(1, Math.hypot(e.vx, e.vz) / e.def.speed);
    let P = locomotionPose({ phase: e.walk, run, air: null });
    if (e.state === 'windup' || e.state === 'netwind') {
      const k = 1 - e.timer / (e.state === 'netwind' ? 0.5 : e.def.windup);
      P.armR = { x: e.state === 'netwind' ? -2.8 * k : 0.8 * k, z: -0.3 }; P.foreArmR = { x: -1.2 * k }; P.spine = { y: 0.35 * k, x: -0.1 * k };
    } else if (e.state === 'strike') {
      P.armR = { x: -1.6, z: -0.1 }; P.foreArmR = { x: -0.1 }; P.spine = { y: -0.4, x: 0.15 };
    } else if (e.state === 'hurt') {
      P.spine = { x: -0.45 }; P.head = { x: -0.4 }; P.armL = { x: -0.5, z: 0.9 }; P.armR = { x: -0.5, z: -0.9 };
    } else if (e.state === 'stun') {
      P.spine = { z: Math.sin(this.t * 5) * 0.2 }; P.head = { z: Math.sin(this.t * 5 + 1) * 0.3 }; P.armL = { z: 0.3 }; P.armR = { z: -0.3 };
    }
    if (e.rig) e.rig.apply(P);
    else if (e.body) {
      // corpo rigido (cacciatore senza scheletro): si inclina, carica e colpisce col busto
      const lean = e.state === 'windup' ? -0.2 : e.state === 'strike' ? 0.3 : e.state === 'hurt' ? -0.35 : run * 0.12;
      const sway = e.state === 'stun' ? Math.sin(this.t * 5) * 0.2 : Math.sin(e.walk) * 0.07 * run;
      e.body.rotation.set(lean, 0, sway);
      e.body.position.y = Math.abs(Math.sin(e.walk)) * 0.06 * run;
    }
    if (e.baton) {
      const target = e.state === 'windup' ? -2.4 : e.state === 'strike' ? 1.3 : 0.4;
      e.baton.rotation.x = THREE.MathUtils.damp(e.baton.rotation.x, target, e.state === 'strike' ? 30 : 10, dt);
    }
    e.stars.visible = e.state === 'stun';
    if (e.stars.visible) { e.stars.position.y = e.baseH + 0.3; e.stars.rotation.y += dt * 6; }
  }

  // ---------- effetti e telecamera ----------
  _burst(x, y, z, color) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    m.position.set(x, y, z);
    this.scene.add(m);
    this.bursts.push({ m, t: 0 });
  }

  _effects(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t += dt;
      b.m.scale.setScalar(1 + b.t * 7);
      b.m.material.opacity = Math.max(0, 0.85 - b.t * 3.5);
      if (b.t > 0.25) { this.scene.remove(b.m); this.bursts.splice(i, 1); }
    }
    // juke-box: pronto = alone che pulsa; in funzione = luci che cambiano colore
    const J = this.juke;
    J.playing = Math.max(0, J.playing - dt);
    this.jukeGlow.visible = !J.used || J.playing > 0;
    if (J.playing > 0) {
      const c = new THREE.Color().setHSL((this.t * 0.8) % 1, 0.9, 0.6);
      this.jukeGlow.material.color.copy(c);
      this.jukeLight.color.copy(c);
      this.jukeLight.intensity = 22 + Math.sin(this.t * 16) * 8;
      J.group.scale.y = 1 + Math.sin(this.t * 16) * 0.02;
    } else {
      this.jukeGlow.material.color.set(0xff5fb0);
      this.jukeGlow.material.opacity = 0.3 + Math.sin(this.t * 4) * 0.2;
      this.jukeLight.color.set(0xff5fb0);
      this.jukeLight.intensity = 14;
      J.group.scale.y = 1;
    }
  }

  _placeCamera(dt = 1) {
    // telecamera fissa: si allontana un po' sugli schermi stretti perché l'arena ci stia tutta
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect);
    const dist = Math.max(14.5, 12.2 / Math.tan(hfov / 2));
    this.camera.position.set(0, 3.2 + dist * 0.14, dist);
    this.camera.lookAt(0, 1.3, -0.6);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - Math.min(dt, 0.05) * 2);
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.4;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.4;
    }
    this._fitBackdrop();
  }

  /** Lo sfondo copre sempre tutta l'inquadratura, alla sua profondità. */
  _fitBackdrop() {
    const cam = this.camera;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const t = (this.bgZ - cam.position.z) / dir.z;
    const center = cam.position.clone().addScaledVector(dir, t);
    const d = t;
    const viewH = 2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const viewW = viewH * cam.aspect;
    const h = Math.max(viewH * 1.15, (viewW * 1.15) / this.bgAspect);
    this.bg.scale.set(h, h, 1);
    this.bg.position.set(center.x, center.y + h * 0.04, this.bgZ);
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    if (this.bg) this._placeCamera(0);
  }

  hud() {
    const b = this.boss && this.boss.alive && this.boss.hp > 0 ? { hp: Math.max(0, this.boss.hp), max: this.boss.maxHp, name: this.level.bossName } : null;
    // suggerimento vicino a un oggetto da raccogliere (se non c'è già un avviso)
    let prompt = null;
    if (!this.holding && this.props && this.state === 'fight') {
      const h = this.hero;
      const p = this.props.find((x) => !x.taken && Math.hypot(x.x - h.x, x.z - h.z) < PICK_R);
      if (p) prompt = p.kind === 'stool' ? 'Lancia: raccogli lo sgabello' : 'Lancia: raccogli il piatto';
    }
    return {
      lives: Math.max(0, this.lives),
      maxLives: Math.max(this.level.lives, this.lives),
      health: Math.max(0, this.hero.hp),
      maxHealth: this.level.health,
      ammo: this.ammo,
      maxAmmo: this.level.maxAmmo,
      boss: b,
      notice: this.notice || prompt,
      subtitle: this.emma.subtitle
    };
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
  }
}
