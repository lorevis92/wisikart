import * as THREE from 'three';
import { Assets } from '../core/AssetLoader.js';
import { Track } from '../track/Track.js';
import { trackById } from '../config/tracks.js';
import { buildSong } from '../audio/AudioEngine.js';
import { loadRigged, riggedUrl, locomotionPose } from './Rig.js';
import { attachGuitar } from './hero.js';
import { EmmaVoice } from './emma.js';

// Livelli ritmici della Storia (Canair): Infinity Guitars (story/chitarre.js, tre brani di prova nel negozio)
// e l'esibizione al piazzale delle statue (story/esibizione.js, un brano lungo in tre sezioni con la barra del
// pubblico). Quattro corsie: le note scendono verso la linea di giudizio; si premono al momento giusto
// (perfetto / buono / mancato), quelle lunghe si tengono premute. Le note vengono dal brano stesso
// (buildSong in AudioEngine.js): quello che si sente è quello che cade. La corsia si disegna nell'HUD (UI.js).
// Stessa interfaccia degli altri livelli (load → update → hud → dispose).

const APPROACH = 1.7; // secondi in cui una nota scende dall'alto alla linea
const PERFECT = 0.07, GOOD = 0.14; // finestre di giudizio (s)
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });

export class RhythmMode {
  constructor({ level, character, audio, coins = 0, onCoins, onComplete, onGameOver }) {
    this.level = level;
    this.character = character;
    this.audio = audio;
    this.coins = coins;
    this.onCoins = onCoins;
    this.onComplete = onComplete;
    this.onGameOver = onGameOver;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.3, 2400);
    this.t = 0;
    this.state = 'intro'; // intro | play | result | interlude | retry | reward | finale | ended
    this.stateTimer = 4.5;
    this.notice = null;
    this.noticeTimer = 0;
    this.unitIndex = 0;
    this.paused = false;
    this.coinsHere = 0;
    this.bursts = [];
    this.fallingCoins = [];
    // brani da suonare: tre brani interi (negozio) o tre sezioni dello stesso brano (esibizione)
    const L = level;
    this.units = L.songs ? L.songs.map((song) => ({ song, section: null })) : L.sections.map((section) => ({ song: L.song, section }));
  }

  // ---------- costruzione ----------
  async load(progress = () => {}) {
    const L = this.level;
    progress(L.loadingText || 'Accordo le chitarre…');
    const [hero] = await Promise.all([loadRigged(riggedUrl(this.character), 1.8)]);
    this.hero = hero ? hero : null;
    if (L.scene === 'shop') await this._buildShop(progress);
    else await this._buildStage(progress);
    // Whiskey con la chitarra imbracciata
    this.heroRoot = new THREE.Group();
    if (this.hero) this.heroRoot.add(this.hero.root);
    else {
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.0, 6, 12), std('#2b3a6b'));
      b.position.y = 0.9;
      this.heroRoot.add(b);
    }
    this.heroGuitar = await attachGuitar(this.heroRoot, 'front');
    this.heroRoot.position.copy(this.heroSpot.pos);
    this.heroRoot.rotation.y = this.heroSpot.yaw;
    this.scene.add(this.heroRoot);
    this.emma = new EmmaVoice(this.audio, L.voices);
    await this.emma.load();
    this.songs = this.units.map((u) => buildSong(u.song, u.section));
    this.audienceV = L.audience ? L.audience.start : 0;
    this._placeCamera();
    progress('Pronti.');
  }

  /** Il negozio: l'illustrazione di sfondo, il proprietario fermo che parla, le tre chitarre in prova. */
  async _buildShop(progress) {
    const L = this.level;
    const [bg, owner, guitar] = await Promise.all([
      Assets.texture(L.background),
      loadRigged(L.owner.url, L.owner.h),
      Assets.model(L.guitar.url, { targetHeight: 1.0 })
    ]);
    this.scene.background = new THREE.Color('#1c1410');
    this.scene.add(new THREE.HemisphereLight(0xffe6c8, 0x3a2418, 1.3));
    const key = new THREE.DirectionalLight(0xfff0d8, 1.6);
    key.position.set(2, 8, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);
    // sfondo: l'illustrazione del negozio a riempire l'inquadratura
    let tex = bg;
    if (!tex) {
      const c = document.createElement('canvas'); c.width = 16; c.height = 256;
      const g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0, '#3a2418'); grd.addColorStop(1, '#8a5a3a');
      g.fillStyle = grd; g.fillRect(0, 0, 16, 256);
      tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    }
    const aspect = tex.image && tex.image.width ? tex.image.width / tex.image.height : 1.78;
    this.bg = new THREE.Mesh(new THREE.PlaneGeometry(aspect, 1), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, depthWrite: false }));
    this.bg.renderOrder = -10;
    this.bgAspect = aspect;
    this.scene.add(this.bg);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), new THREE.ShadowMaterial({ opacity: 0.35 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    // il proprietario, a sinistra, girato verso Whiskey
    this.owner = owner;
    if (owner) {
      owner.root.position.set(-3.6, 0, -0.4);
      owner.root.rotation.y = 0.55;
      this.scene.add(owner.root);
    }
    // le tre chitarre in prova, su un espositore a destra; quella in prova è illuminata
    this.stand = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      if (guitar) g.add(guitar.clone(true));
      else g.add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 1, 0.1), std('#c0392b')));
      g.position.set(5.0 + i * 0.75, 0.35, -1.6);
      g.rotation.y = -0.4;
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.scene.add(g);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 24), new THREE.MeshBasicMaterial({ color: 0xf5b942, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(g.position.x, 0.02, g.position.z);
      this.scene.add(ring);
      this.stand.push({ g, ring });
    }
    const spot = new THREE.SpotLight(0xfff0c0, 40, 12, 0.35, 0.5, 1.2);
    spot.position.set(5.5, 5, 1);
    this.scene.add(spot, spot.target);
    this.standSpot = spot;
    this.heroSpot = { pos: new THREE.Vector3(3.4, 0, -0.2), yaw: -0.5 };
    this.camBase = { pos: new THREE.Vector3(0, 2.0, 8.2), look: new THREE.Vector3(0, 1.4, 0), bgZ: -7 };
  }

  /** Il piazzale delle statue di Oremo sul circuito di Canair, al tramonto a tripla stella, con il pubblico. */
  async _buildStage(progress) {
    const L = this.level;
    progress('Monto il palco tra le statue…');
    const def = trackById[L.track];
    const trackDef = { ...def, itemBoxes: [], boostPads: [], props: (def.props || []).filter((p) => ['oremo-giovane', 'oremo-anziano', 'fontana'].includes(p.model)) };
    this.track = new Track(trackDef, this.scene, null);
    await this.track.build();
    const tr = this.track;
    const s = tr.samples[tr.idxFromT(L.stageT)];
    const right = s.right.clone(), fwd = s.tangent.clone().setY(0).normalize();
    const base = s.pos.clone();
    // palco: una pedana tra la strada e le statue, rivolta verso la strada (dove sta il pubblico)
    const stagePos = base.clone().addScaledVector(right, L.stageSide);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.6, 32), std('#5a3a2a', { roughness: 0.8 }));
    deck.position.copy(stagePos).setY(stagePos.y + 0.3);
    deck.receiveShadow = deck.castShadow = true;
    this.scene.add(deck);
    const lights = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: [0xff5a6e, 0xf5b942, 0x43e0b0][i % 3] }));
      b.position.copy(deck.position).add(new THREE.Vector3(Math.cos(a) * 3.3, 0.35, Math.sin(a) * 3.3));
      this.scene.add(b);
      lights.push(b);
    }
    this.stageLights = lights;
    const toCrowd = right.clone(); // il palco guarda verso la strada
    this.heroSpot = { pos: stagePos.clone().setY(stagePos.y + 0.6), yaw: Math.atan2(toCrowd.x, toCrowd.z) };
    // tre soli al tramonto, bassi dietro le statue
    for (let i = 0; i < 3; i++) {
      const sun = new THREE.Mesh(new THREE.SphereGeometry(14 - i * 3, 24, 16), new THREE.MeshBasicMaterial({ color: [0xffc86a, 0xff8a5a, 0xffe8b0][i], fog: false }));
      sun.position.copy(stagePos).addScaledVector(right, -520).addScaledVector(fwd, (i - 1) * 90).setY(stagePos.y + 40 + i * 18);
      this.scene.add(sun);
      const halo = new THREE.Mesh(new THREE.CircleGeometry(40 - i * 8, 32), new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.18, fog: false, depthWrite: false }));
      halo.position.copy(sun.position);
      halo.lookAt(stagePos);
      this.scene.add(halo);
    }
    const warm = new THREE.DirectionalLight(0xff9a60, 1.2);
    warm.position.copy(stagePos).addScaledVector(right, -60).setY(stagePos.y + 30);
    warm.target.position.copy(stagePos);
    this.scene.add(warm, warm.target);
    const spot = new THREE.SpotLight(0xfff0d0, 90, 30, 0.45, 0.5, 1.2);
    spot.position.copy(stagePos).addScaledVector(right, 8).setY(stagePos.y + 9);
    spot.target.position.copy(stagePos);
    this.scene.add(spot, spot.target);
    // il pubblico: figure semplici davanti al palco, ne compaiono tante quante dice la barra
    const N = 90;
    const bodyG = new THREE.CapsuleGeometry(0.28, 0.7, 4, 8);
    this.crowd = new THREE.InstancedMesh(bodyG, new THREE.MeshStandardMaterial({ roughness: 0.8 }), N);
    this.crowdSeats = [];
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const row = Math.floor(i / 15), k = i % 15;
      const p = stagePos.clone().addScaledVector(right, 5 + row * 1.5 + ((i * 7) % 3) * 0.3).addScaledVector(fwd, (k - 7) * 1.1 + (row % 2) * 0.5);
      p.y = tr.project ? tr.project(p, tr.idxFromT(L.stageT)).height + 0.65 : stagePos.y + 0.65;
      this.crowdSeats.push({ p, phase: (i * 1.7) % (Math.PI * 2) });
      this.crowd.setColorAt(i, col.setHSL(((i * 37) % 100) / 100, 0.6, 0.5));
    }
    this.crowd.count = 0;
    this.crowd.castShadow = true;
    this.scene.add(this.crowd);
    this.camBase = {
      // Whiskey di lato nell'inquadratura: al centro c'è la corsia delle note
      pos: stagePos.clone().addScaledVector(right, 15).setY(stagePos.y + 5.5),
      look: stagePos.clone().addScaledVector(fwd, -5).setY(stagePos.y + 2.6)
    };
    this.stagePos = stagePos;
    this.rightV = right;
    this.fwdV = fwd;
  }

  // ---------- gioco ----------
  say(text, time = 2.4) { this.notice = text; this.noticeTimer = time; }

  get song() { return this.songs[this.unitIndex]; }

  /** Parte (o riparte) il brano/sezione corrente. */
  _startUnit() {
    const song = this.song;
    this.notes = song.notes.map((n) => ({ ...n, state: 'wait' }));
    this.next = 0; // prima nota non ancora giudicata
    this.combo = 0;
    this.bestCombo = 0;
    this.missRun = 0;
    this.score = 0;
    this.pts = 0;
    this.maxPts = this.notes.reduce((a, n) => a + 1 + (n.dur > 0 ? 0.5 : 0), 0);
    this.judge = null;
    this.flash = [0, 0, 0, 0];
    this.localTime = 0;
    this.saidBene = {};
    this.state = 'play';
    this.audio.playSong(song, 0);
    this.say(song.title, 2.6);
    if (this.stand) this.stand.forEach((s, i) => { s.ring.material.opacity = i === this.unitIndex ? 0.8 : 0; });
    if (this.standSpot) this.standSpot.target.position.copy(this.stand[this.unitIndex].g.position);
  }

  /** Tempo del brano: quello dell'audio se c'è (le note sono sincronizzate alla musica), sennò un orologio. */
  _time(dt) {
    const st = this.audio.songTime ? this.audio.songTime() : null;
    this.localTime += dt;
    return st !== null && st !== undefined ? st : this.localTime;
  }

  update(dt, input) {
    this.t += dt;
    this.emma.update(dt);
    this.noticeTimer = Math.max(0, this.noticeTimer - dt);
    if (this.noticeTimer <= 0) this.notice = null;
    if (this.judge && this.t - this.judge.at > 0.6) this.judge = null;
    this._animate(dt);
    const L = this.level;

    if (this.state === 'intro') {
      if (!this.saidIntro) { this.saidIntro = true; this.emma.say('arrivo', { important: true }); }
      this.stateTimer -= dt;
      if (this.stateTimer <= 0 && this.t > 1) this._startUnit();
      return this._clearInput(input);
    }
    if (this.state === 'play') {
      const time = this.time = this._time(dt);
      this._judge(time, input);
      if (this.state === 'play' && time > this.song.duration) this._finishUnit();
      return;
    }
    this._clearInput(input);
    this.stateTimer -= dt;
    if (this.state === 'result' && this.stateTimer <= 0) {
      if (this.lastPassed) {
        this.unitIndex++;
        if (this.unitIndex >= this.units.length) this._reward();
        else this._startUnit();
      } else this._startUnit(); // riprova lo stesso brano
    } else if (this.state === 'interlude' && this.stateTimer <= 0 && this.emma.t >= this.emma.busyUntil) this._startUnit();
    else if (this.state === 'retry' && this.stateTimer <= 0) { this.audienceV = L.audience.start; this._startUnit(); }
    else if ((this.state === 'reward' || this.state === 'finale') && this.stateTimer <= 0) {
      const finale = this.state === 'finale';
      this.state = 'ended';
      this.audio.stopSong();
      this.onComplete && this.onComplete(finale ? { finale: true } : null);
    }
  }

  _clearInput(input) { for (let i = 0; i < 4; i++) input.lanePressed[i] = false; input.jumpPressed = input.itemPressed = input.attackPressed = false; }

  /** Giudizio: tasti premuti contro le note vicine, note passate (mancate), note tenute. */
  _judge(time, input) {
    const notes = this.notes;
    this.lanesHeld = input.lanes.slice();
    for (let lane = 0; lane < 4; lane++) {
      if (!input.lanePressed[lane]) continue;
      input.lanePressed[lane] = false;
      this.flash[lane] = this.t;
      // la prima nota non giudicata di quella corsia, se è abbastanza vicina
      let best = null;
      for (let i = this.next; i < notes.length; i++) {
        const n = notes[i];
        if (n.t - time > GOOD) break;
        if (n.lane === lane && n.state === 'wait' && Math.abs(n.t - time) <= GOOD) { best = n; break; }
      }
      if (!best) continue;
      const d = Math.abs(best.t - time);
      this._hit(best, d <= PERFECT ? 'perfect' : 'good');
    }
    input.jumpPressed = input.itemPressed = input.attackPressed = false;
    for (let i = this.next; i < notes.length; i++) {
      const n = notes[i];
      if (n.t - time > GOOD) break;
      if (n.state === 'wait' && time - n.t > GOOD) this._miss(n);
    }
    // note tenute: vanno tenute fino in fondo
    for (const n of notes) {
      if (n.state !== 'hold') continue;
      if (time >= n.t + n.dur) {
        n.state = 'done';
        this.pts += 0.5;
        this.score += 100 * this._mult();
        this._audience('hold');
      } else if (!input.lanes[n.lane] && time < n.t + n.dur - 0.12) {
        n.state = 'broken';
        this.combo = 0;
        this.judge = { text: 'Lasciata', lane: n.lane, at: this.t, kind: 'miss' };
        this._audience('miss');
      }
    }
    while (this.next < notes.length && notes[this.next].state !== 'wait') this.next++;
  }

  _mult() { return this.combo >= 50 ? 4 : this.combo >= 25 ? 3 : this.combo >= 10 ? 2 : 1; }

  _hit(n, kind) {
    n.state = n.dur > 0 ? 'hold' : 'hit';
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.missRun = 0;
    this.pts += kind === 'perfect' ? 1 : 0.6;
    this.score += (kind === 'perfect' ? 300 : 150) * this._mult();
    this.judge = { text: kind === 'perfect' ? 'Perfetto!' : 'Buono', lane: n.lane, at: this.t, kind };
    if (kind === 'perfect') this.audio.sfx('perfect');
    this._audience(kind);
    const L = this.level;
    // battute d'incoraggiamento e, all'esibizione, pioggia di monete a ogni combo alta
    if ((this.combo === 12 || this.combo === 30) && !this.saidBene[this.combo]) { this.saidBene[this.combo] = true; this.emma.say('bene'); }
    if (L.coinsEvery && this.combo % L.coinsEvery === 0) this._coinRain(L.coinsPerRain);
  }

  _miss(n) {
    n.state = 'miss';
    this.combo = 0;
    this.missRun++;
    this.judge = { text: 'Mancato', lane: n.lane, at: this.t, kind: 'miss' };
    this.audio.sfx('miss');
    this._audience('miss');
    if (this.missRun === 4 && this.emma.lines.male && this.t - (this.saidMale || -99) > 10) { this.saidMale = this.t; this.emma.say('male'); }
  }

  /** Barra del pubblico (esibizione): sale con le note buone, scende con quelle mancate; a zero si riparte. */
  _audience(kind) {
    const A = this.level.audience;
    if (!A || this.state !== 'play') return;
    const before = this.audienceV;
    this.audienceV = THREE.MathUtils.clamp(before + (A[kind] || 0), 0, 1);
    if (before < A.high && this.audienceV >= A.high && this.t - (this.saidUp || -99) > 12) { this.saidUp = this.t; this.emma.say('cresce'); }
    if (before >= A.low && this.audienceV < A.low && this.t - (this.saidDown || -99) > 10) { this.saidDown = this.t; this.emma.say('cala', { important: true }); }
    if (this.audienceV <= 0) {
      this.state = 'retry';
      this.stateTimer = 3;
      this.audio.stopSong();
      this.audio.sfx('back');
      this.say('Il pubblico se ne va… si riparte da capo', 3);
    }
  }

  _coinRain(n) {
    this.coins += n;
    this.coinsHere += n;
    this.onCoins && this.onCoins(this.coins, Math.floor(this.coins / 100) - Math.floor((this.coins - n) / 100));
    this.audio.sfx('pickup');
    const center = this.stagePos || this.heroSpot.pos;
    for (let i = 0; i < n * 2; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 14), new THREE.MeshStandardMaterial({ color: 0xf5b942, metalness: 0.8, roughness: 0.25, emissive: 0x6a4a00 }));
      m.position.copy(center).add(new THREE.Vector3((Math.random() - 0.5) * 6, 6 + Math.random() * 3, (Math.random() - 0.5) * 6));
      this.scene.add(m);
      this.fallingCoins.push({ m, vy: 0, spin: 4 + Math.random() * 6 });
    }
    this._callout = { text: `+${n} monete`, until: this.t + 1.2, key: this.t };
  }

  _accuracy() { return this.maxPts ? this.pts / this.maxPts : 0; }

  /** Fine del brano/sezione: nel negozio si passa se la precisione basta; all'esibizione si va avanti. */
  _finishUnit() {
    this.audio.stopSong();
    const L = this.level, acc = this._accuracy();
    if (L.pass !== undefined) {
      this.lastPassed = acc >= L.pass;
      this.state = 'result';
      this.stateTimer = 3.2;
      this.result = { acc, passed: this.lastPassed, score: this.score, combo: this.bestCombo };
      if (this.lastPassed) { this.audio.sfx('lap'); this.say(`Superata! Precisione ${Math.round(acc * 100)}%`, 3); }
      else { this.audio.sfx('back'); this.emma.say('male', { important: true }); this.say(`Precisione ${Math.round(acc * 100)}%: ne serve almeno ${Math.round(L.pass * 100)}%. Si riprova.`, 3.2); }
      return;
    }
    // esibizione: prossima sezione (prima dell'ultima, Emma presenta "Love u mamma")
    this.unitIndex++;
    if (this.unitIndex >= this.units.length) {
      this.state = 'finale';
      this.stateTimer = 4.5;
      this.audio.sfx('applause');
      this.audio.sfx('finish');
      this.say('Applausi a non finire!', 4);
      return;
    }
    this.state = 'interlude';
    this.stateTimer = 3;
    this.audio.sfx('applause');
    const nextSec = this.song;
    if (this.unitIndex === this.units.length - 1) this.emma.say('lovemamma', { important: true });
    this.say(`Prossima: ${nextSec.title}`, 3);
  }

  /** Superati i tre brani: il proprietario regala la chitarra. */
  _reward() {
    this.state = 'reward';
    this.stateTimer = 5.5;
    this.emma.clear();
    this.emma.say('premio', { important: true });
    this.audio.sfx('finish');
    this.say('La chitarra è tua!', 4);
    if (this.stand) {
      const g = this.stand[this.stand.length - 1].g;
      this.rewardGuitar = g;
      this.rewardFrom = g.position.clone();
    }
  }

  // ---------- animazione ----------
  _animate(dt) {
    const beat = this.song ? this.song.beat : 0.5;
    const time = this.time || 0;
    const ph = (time / beat) * Math.PI * 2;
    const playing = this.state === 'play';
    // Whiskey suona: plettro sul tempo, testa che batte, busto che ondeggia
    if (this.hero && this.hero.rig) {
      const strum = playing ? Math.sin(ph * 2) * 0.35 : 0;
      this.hero.rig.apply({
        armR: { x: -0.7 + strum, z: -0.35 }, foreArmR: { x: -1.3 },
        armL: { x: -1.0, z: 0.75 }, foreArmL: { x: -1.5 },
        spine: { x: 0.08 + (playing ? Math.abs(Math.sin(ph)) * 0.06 : 0), y: playing ? Math.sin(ph / 2) * 0.12 : 0 },
        head: { x: playing ? Math.abs(Math.sin(ph)) * 0.18 : 0 },
        upLegL: { x: -0.05 }, upLegR: { x: 0.05 }
      });
    }
    // il proprietario: respira, e gesticola quando parla
    if (this.owner && this.owner.rig) {
      const talking = this.emma.speaker === 'proprietario';
      this.owner.rig.apply({
        spine: { x: 0.03 + Math.sin(this.t * 1.5) * 0.02 },
        armR: talking ? { x: -1.0 + Math.sin(this.t * 5) * 0.3, z: -0.3 } : { x: 0, z: -0.1 },
        foreArmR: talking ? { x: -0.8 } : { x: -0.2 },
        head: { x: Math.sin(this.t * 0.8) * 0.05, y: talking ? Math.sin(this.t * 3) * 0.1 : 0 }
      });
    }
    // la chitarra regalata vola davanti alla telecamera girando
    if (this.rewardGuitar) {
      const k = Math.min(1, (5.5 - this.stateTimer) / 1.5);
      const to = new THREE.Vector3(0, 1.6, 4.2);
      this.rewardGuitar.position.lerpVectors(this.rewardFrom, to, k * k * (3 - 2 * k));
      this.rewardGuitar.rotation.y += dt * 2.5;
    }
    // pubblico: tanti quanti dice la barra, saltellano sul tempo
    if (this.crowd) {
      const n = Math.round(this.audienceV * this.crowdSeats.length);
      this.crowd.count = n;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
      for (let i = 0; i < n; i++) {
        const s = this.crowdSeats[i];
        const hop = playing ? Math.max(0, Math.sin(ph + s.phase)) * 0.25 * (0.4 + this.audienceV) : 0;
        m.compose(new THREE.Vector3(s.p.x, s.p.y + hop, s.p.z), q, sc);
        this.crowd.setMatrixAt(i, m);
      }
      this.crowd.instanceMatrix.needsUpdate = true;
      this.stageLights.forEach((b, i) => { b.visible = !playing || Math.sin(ph + i) > -0.2; });
    }
    for (let i = this.fallingCoins.length - 1; i >= 0; i--) {
      const c = this.fallingCoins[i];
      c.vy -= 12 * dt;
      c.m.position.y += c.vy * dt;
      c.m.rotation.x += c.spin * dt;
      if (c.m.position.y < (this.stagePos ? this.stagePos.y : 0) - 1) { this.scene.remove(c.m); this.fallingCoins.splice(i, 1); }
    }
    if (this._callout && this.t > this._callout.until) this._callout = null;
  }

  _placeCamera() {
    const B = this.camBase;
    this.camera.position.copy(B.pos);
    this.camera.lookAt(B.look);
    if (this.bg) {
      // sfondo del negozio: copre tutta l'inquadratura alla sua profondità
      const cam = this.camera, dir = new THREE.Vector3();
      cam.updateMatrixWorld();
      cam.getWorldDirection(dir);
      const t = (B.bgZ - cam.position.z) / dir.z;
      const c = cam.position.clone().addScaledVector(dir, t);
      const viewH = 2 * t * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), viewW = viewH * cam.aspect;
      const h = Math.max(viewH * 1.1, (viewW * 1.1) / this.bgAspect);
      this.bg.scale.set(h, h, 1);
      this.bg.position.set(c.x, c.y, B.bgZ);
    }
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    if (this.camBase) this._placeCamera();
  }

  /** Menu di gioco: il brano si ferma e riprende dallo stesso punto. */
  pause(on) {
    this.paused = on;
    if (this.state !== 'play') return;
    if (on) { this.pausedAt = this.time || 0; this.audio.stopSong(); }
    else { this.audio.playSong(this.song, this.pausedAt || 0); this.localTime = this.pausedAt || 0; }
  }

  hud() {
    const L = this.level;
    let rhythm = null;
    if (this.notes && (this.state === 'play' || this.state === 'result')) {
      const time = this.time || 0;
      const vis = [];
      for (let i = Math.max(0, this.next - 12); i < this.notes.length; i++) {
        const n = this.notes[i];
        const dt = n.t - time;
        if (dt > APPROACH + 0.1) break;
        if (dt + n.dur < -0.35 && n.state !== 'hold') continue;
        vis.push({ lane: n.lane, dt, dur: n.dur, state: n.state });
      }
      const first = this.notes.length ? this.notes[0].t : 0;
      rhythm = {
        approach: APPROACH, notes: vis, lanes: this.lanesHeld || [false, false, false, false],
        flash: this.flash.map((f) => Math.max(0, 1 - (this.t - f) / 0.18)),
        judge: this.judge ? { ...this.judge, age: this.t - this.judge.at } : null,
        combo: this.combo, mult: this._mult(), score: Math.round(this.score), acc: this._accuracy(),
        progress: Math.min(1, time / this.song.duration),
        count: time < first ? Math.max(1, Math.ceil((first - time) / this.song.beat)) : null,
        title: this.song.title,
        unit: `${this.unitIndex + 1}/${this.units.length}`,
        pass: L.pass
      };
    }
    return {
      rhythm,
      audience: L.audience ? { v: this.audienceV, low: L.audience.low, high: L.audience.high } : null,
      coins: L.coinsEvery ? this.coins : null,
      callout: this._callout || null,
      notice: this.notice,
      subtitle: this.emma.subtitle
    };
  }

  dispose() {
    this.audio.stopSong();
    if (this.track) this.track.dispose();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
  }
}
