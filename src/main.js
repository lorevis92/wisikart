import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Input } from './core/Input.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { UI, fmt } from './ui/UI.js';
import { Race } from './race/Race.js';
import { CHARACTERS } from './config/characters.js';
import { TRACKS, CUPS, trackById, POINTS_TABLE } from './config/tracks.js';
import { ITEMS } from './config/items.js';
import { Assets } from './core/AssetLoader.js';
import { dotTexture } from './core/Textures.js';
import { StoryMode } from './story/StoryMode.js';
import { WORLDS } from './story/worlds.js';
import { Hub } from './story/Hub.js';
import { storyHero } from './story/hero.js';

const SAVE_KEY = 'wisikart.save.v1';

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.5, 2500);
    this.clock = new THREE.Clock();
    this.input = new Input();
    this.audio = new AudioEngine();
    this.ui = new UI(this);
    this.state = 'boot';
    this.settings = { music: 0.6, sfx: 0.8, voice: 1, difficulty: 1, quality: 'high' };
    this.save = this._loadSave();
    Object.assign(this.settings, this.save.settings || {});
    this.composer = null;
    this.menuScene = null;
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this.input.bindTouch(document.getElementById('touch'));
    this.input.bindTouch(document.getElementById('story-touch'));
    this.input.bindTouch(document.getElementById('hub-touch'));
    document.querySelectorAll('#main-menu .menu-item').forEach((b) => b.addEventListener('click', () => this.menuAction(b.dataset.action)));
    document.querySelectorAll('#kart-menu .menu-item').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.action === 'main') { this.audio.sfx('back'); this.state = 'title'; this.ui.title(); }
      else this.menuAction(b.dataset.action);
    }));
    document.querySelectorAll('[data-pause]').forEach((b) => b.addEventListener('click', () => this.pauseAction(b.dataset.pause)));
    document.getElementById('boot-start').addEventListener('click', () => this.enter());
    this._loop = this._loop.bind(this);
  }

  _loadSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; }
  }
  _persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...this.save, settings: this.settings })); } catch {}
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const ratio = this.settings?.quality === 'low' ? 0.66 : this.settings?.quality === 'medium' ? 0.85 : Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) this.composer.setSize(w, h);
    if (this.story) this.story.resize(w / h);
    if (this.hub) this.hub.resize(w / h);
  }

  async boot() {
    this.ui.bootProgress(0.1, 'Carico il WiSiVERSE…');
    await Assets.exists('assets/manifest.json');
    this.ui.bootProgress(0.35, 'Controllo gli asset…');
    // pre-controllo degli asset principali (solo esistenza, veloce)
    await Promise.all(CHARACTERS.map((c) => Assets.exists(c.portrait)));
    this.ui.bootProgress(0.7, 'Accordo gli strumenti…');
    this._buildMenuScene();
    this.ui.bootProgress(1, 'Pronto.');
    await this.ui.bootReady();
    requestAnimationFrame(this._loop);
  }

  async enter() {
    await this.audio.init();
    this.audio.resume();
    this.audio.setVolumes(this.settings);
    this.audio.playTheme('menu');
    this.audio.voice('welcome');
    this.state = 'title';
    this.ui.title();
  }

  // scena di sfondo del menu: kart che girano in un tunnel di luce
  _buildMenuScene() {
    const s = new THREE.Scene();
    s.background = new THREE.Color('#0e1230');
    s.fog = new THREE.FogExp2('#0e1230', 0.03);
    const hemi = new THREE.HemisphereLight(0x8899ff, 0x221133, 1.2);
    s.add(hemi);
    const ringG = new THREE.TorusGeometry(9, 0.25, 8, 40);
    const mats = ['#4c7be8', '#c14cff', '#43e0b0', '#f5b942'].map((c) => new THREE.MeshStandardMaterial({ color: 0x111133, emissive: new THREE.Color(c), emissiveIntensity: 1.6 }));
    this.menuRings = [];
    for (let i = 0; i < 26; i++) {
      const r = new THREE.Mesh(ringG, mats[i % mats.length]);
      r.position.z = -i * 7;
      s.add(r);
      this.menuRings.push(r);
    }
    const pc = 1200;
    const pp = new Float32Array(pc * 3);
    for (let i = 0; i < pc; i++) pp.set([(Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, -Math.random() * 180], i * 3);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    // pulviscolo del tunnel di luce: tondo, piccolo e tenue (i quadratini chiari sembravano puntini bianchi sparsi)
    this.menuParticles = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x8a7cff, size: 0.22, map: dotTexture(), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.add(this.menuParticles);
    this.menuScene = s;
    this.menuCam = new THREE.PerspectiveCamera(70, 1, 0.1, 300);
  }

  _setupComposer(track) {
    if (this.composer) { this.composer.dispose?.(); this.composer = null; }
    if (this.settings.quality === 'low') return;
    const c = new EffectComposer(this.renderer);
    c.addPass(new RenderPass(this.scene, this.camera));
    // tunnel: bagliore diffuso; notte: bagliore forte ma soglia alta, così brillano solo neon e lampioni
    const night = track.world?.night;
    const strength = track.theme === 'tunnel' ? 0.55 : night ? 0.7 : 0.22;
    const radius = night ? 0.45 : 0.6;
    const threshold = track.theme === 'tunnel' ? 0.55 : night ? 0.85 : 0.9;
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), strength, radius, threshold);
    c.addPass(bloom);
    c.addPass(new OutputPass());
    this.composer = c;
    this._resize();
  }

  // ---------- menu ----------
  menuAction(action) {
    this.audio.sfx('select');
    this.mode = action;
    if (action === 'options') {
      this.state = 'options';
      this.ui.options(this.settings, (s) => { Object.assign(this.settings, s); this.audio.setVolumes(this.settings); this._persist(); this._resize(); });
    } else if (action === 'story') {
      this.openStory();
    } else if (action === 'kart') {
      this.openKartMenu();
    } else if (action === 'credits') {
      this.state = 'credits';
      this.ui.credits();
    } else {
      this.state = 'chars';
      this.ui.characters(action, (c) => this.pickCharacter(c));
    }
  }

  back() {
    this.audio.sfx('back');
    if (this.state === 'options' || this.state === 'credits' || this.state === 'kartmenu') { this.state = 'title'; this.ui.title(); }
    else if (this.state === 'chars') this.openKartMenu(); // la scelta del pilota sta dentro WisiKart
    else if (this.state === 'tracks' || this.state === 'cups') { this.state = 'chars'; this.ui.characters(this.mode, (c) => this.pickCharacter(c)); }
  }

  /** Sottomenu WisiKart: Gran Premio, Corsa singola, Prova a tempo. */
  openKartMenu() {
    this.state = 'kartmenu';
    this.ui.kartMenu();
  }

  /** Testi della pausa: riprendi / ricomincia / esci, secondo dove ci si trova. */
  _pauseLabels(restart, quit) {
    document.querySelector('[data-pause="restart"]').textContent = restart;
    document.querySelector('[data-pause="quit"]').textContent = quit;
  }

  pickCharacter(c) {
    this.audio.sfx('select');
    this.playerChar = c;
    if (this.mode === 'gp') {
      this.state = 'cups';
      this.ui.cups((cup) => { this.audio.sfx('select'); this.startCup(cup); });
    } else {
      this.state = 'tracks';
      this.ui.tracks(this.mode, (t) => { this.audio.sfx('select'); this.startRace(t); }, this.save.bestLaps || {});
    }
  }

  startCup(cup) {
    this.gp = { cup, tracks: cup.tracks, raceIndex: 0, points: Object.fromEntries(CHARACTERS.map((x) => [x.id, 0])), history: [], finished: false };
    this.startRace(trackById[this.gp.tracks[0]]);
  }

  // ---------- gara ----------
  async startRace(trackDef) {
    this.state = 'loading';
    this.audio.stopMusic();
    const intro = this.ui.loading(trackDef);
    if (this.race) { this.race.dispose(); this.race = null; }
    this.scene.clear();
    const race = new Race({
      scene: this.scene, camera: this.camera, renderer: this.renderer, audio: this.audio, input: this.input,
      trackDef, playerChar: this.playerChar, mode: this.mode, difficulty: this.settings.difficulty,
      onEvent: (e) => this.onRaceEvent(e)
    });
    await race.load((t) => this.ui.loadingStatus(t));
    // la gara parte quando la presentazione dei piloti (griglia.mp4) finisce o viene saltata
    this.ui.loadingStatus('Pista pronta. I piloti si stanno sistemando…');
    await intro;
    this.ui.loadingDone();
    this.race = race;
    this._setupComposer(trackDef);
    this.ui.hudStart(race.track);
    this.state = 'race';
    this.paused = false;
    // un frame di respiro per il caricamento, poi si parte
    setTimeout(() => race.start(), 300);
  }

  onRaceEvent(e) {
    const ui = this.ui;
    switch (e.type) {
      case 'count': ui.center(String(e.n), 900); break;
      case 'go': ui.center('VIA!', 800); break;
      case 'lap': ui.notice(`Giro ${e.lap}`); break;
      case 'lastlap': ui.notice('Ultimo giro!'); break;
      case 'finish': ui.center(`${e.rank}°`, 2500); ui.notice(e.rank === 1 ? 'Vittoria!' : 'Traguardo!'); break;
      case 'used': ui.notice(ITEMS[e.item]?.name || '', 1200); break;
      case 'blind': ui.notice('Abbagliato!', 1500); break;
      case 'fog': ui.notice('Nebbia del Viandante', 1500); break;
      case 'shake': this.race.shake = 0.5; break;
      case 'results': this.showResults(e); break;
    }
  }

  showResults(e) {
    this.state = 'results';
    if (this.composer) { this.composer = null; }
    const me = e.results.find((r) => r.isPlayer);
    // record
    let isNewBest = false;
    if (e.bestLap) {
      this.save.bestLaps = this.save.bestLaps || {};
      const key = this.race.trackDef.id;
      if (!this.save.bestLaps[key] || e.bestLap < this.save.bestLaps[key]) { this.save.bestLaps[key] = e.bestLap; isNewBest = true; }
      this._persist();
    }
    const actions = [];
    if (this.mode === 'gp') {
      const race = {};
      for (const r of e.results) {
        race[r.character.id] = POINTS_TABLE[r.rank - 1] || 0;
        this.gp.points[r.character.id] += race[r.character.id];
      }
      this.gp.history.push(race);
      this.gp.standings = CHARACTERS.map((c) => ({ character: c, points: this.gp.points[c.id] })).sort((a, b) => b.points - a.points);
      const last = this.gp.raceIndex >= this.gp.tracks.length - 1;
      this.gp.finished = last;
      if (!last) actions.push(['Prossima gara', () => { this.gp.raceIndex++; this.startRace(trackById[this.gp.tracks[this.gp.raceIndex]]); }, true]);
      else actions.push(['Nuova coppa', () => { this.pickCharacter(this.playerChar); }, true]);
      actions.push(['Torna a WisiKart', () => this.toKartMenu()]);
    } else {
      actions.push(['Rigioca', () => this.startRace(this.race.trackDef), true]);
      actions.push(['Cambia pista', () => { this.state = 'tracks'; this.ui.tracks(this.mode, (t) => this.startRace(t), this.save.bestLaps || {}); }]);
      actions.push(['Torna a WisiKart', () => this.toKartMenu()]);
    }
    this.ui.results({ results: e.results, lapTimes: e.lapTimes, bestLap: e.bestLap, totalTime: e.totalTime, mode: this.mode, gp: this.gp, playerChar: this.playerChar, actions, isNewBest });
  }

  // ---------- storia ----------
  /** La Storia parte dalla piazza 3D del pianeta (per ora Niaboc). spawnAt = id dell'ingresso da cui si esce. */
  openStory(message = '', spawnAt = null) {
    this.startHub(WORLDS[0], { message, spawnAt });
  }

  async startHub(world, { message = '', spawnAt = null } = {}) {
    this.state = 'hubload';
    this.audio.stopMusic();
    this.ui.hubLoading(world);
    this._endStory();
    this._endHub();
    this.save.story = this.save.story || {};
    const hub = new Hub({
      world,
      character: storyHero(),
      audio: this.audio,
      completed: this.save.story,
      spawnAt,
      onEnter: (e) => { if (e.kind === 'level') this.startStory(e.level); }
    });
    await hub.load((t) => this.ui.loadingStatus(t));
    this.hub = hub;
    this._resize();
    this.input.releaseAll();
    this.input.pausePressed = false;
    this.state = 'hub';
    this.ui.hubStart(message);
    this.audio.playTheme(world.music);
  }

  _endHub() {
    if (this.hub) { this.hub.dispose(); this.hub = null; }
  }

  hubPause(on) {
    if (this.state !== 'hub' && this.state !== 'hubpaused') return;
    this.state = on ? 'hubpaused' : 'hub';
    if (on) this._pauseLabels('Torna al centro della piazza', 'Torna al menu principale');
    this.ui.pause(on);
    if (!on) this.ui.hubStart();
  }

  async startStory(level) {
    this.state = 'storyload';
    this.audio.stopMusic();
    this.ui.storyLoading(level);
    this._endStory();
    this._endHub();
    // Nella Storia si gioca con Whiskey basic; le sei forme si sbloccheranno più avanti (vedi story/hero.js)
    const story = new StoryMode({
      level,
      character: storyHero(),
      audio: this.audio,
      onComplete: () => this._storyComplete(level),
      onGameOver: () => this.startStory(level)
    });
    await story.load((t) => this.ui.loadingStatus(t));
    this.story = story;
    this._resize();
    // niente comandi rimasti in memoria dal menu (tasti, touch, salto)
    this.input.releaseAll();
    this.input.pausePressed = false;
    this.state = 'story';
    this.ui.storyHudStart();
    this.audio.playTheme(level.music);
  }

  _storyComplete(level) {
    this.save.story = { ...(this.save.story || {}), [level.id]: true };
    this._persist();
    this._endStory();
    // si ricompare in piazza davanti all'ingresso del livello appena finito; il salvataggio riapre il prossimo
    this.openStory(level.completeMessage || `Livello completato: ${level.name}.`, level.id);
  }

  _endStory() {
    if (this.story) { this.story.dispose(); this.story = null; }
  }

  storyPause(on) {
    if (this.state !== 'story' && this.state !== 'storypaused') return;
    this.state = on ? 'storypaused' : 'story';
    if (on) this._pauseLabels('Ricomincia il livello', 'Torna al menu principale');
    this.ui.pause(on);
    if (!on) this.ui.storyHudStart(); // chiude l'overlay e rimette l'HUD
  }

  /** Uscita da una gara (risultati o pausa): si torna al sottomenu WisiKart. */
  toKartMenu() {
    this.audio.sfx('back');
    if (this.race) { this.race.dispose(); this.race = null; }
    this.composer = null;
    this.scene.clear();
    this.audio.playTheme('menu');
    this.openKartMenu();
  }

  /** Uscita dalla Storia (piazza o livello): si torna al menu principale. */
  toMainMenu() {
    this.audio.sfx('back');
    this._endStory();
    this._endHub();
    this.state = 'title';
    this.audio.playTheme('menu');
    this.ui.title();
  }

  pauseAction(a) {
    this.audio.sfx('select');
    if (this.state === 'hubpaused') {
      this.ui.pause(false);
      if (a === 'resume') this.hubPause(false);
      else if (a === 'restart') { this.hub.spawnAt = null; this.hub._spawn(); this.hubPause(false); }
      else this.toMainMenu();
      return;
    }
    if (this.state === 'storypaused') {
      const level = this.story.level;
      if (a === 'resume') this.storyPause(false);
      else {
        this.ui.pause(false);
        if (a === 'restart') this.startStory(level);
        else this.toMainMenu();
      }
      return;
    }
    if (a === 'resume') this.togglePause(false);
    else if (a === 'restart') { this.togglePause(false); this.startRace(this.race.trackDef); }
    else if (a === 'quit') { this.togglePause(false); this.toKartMenu(); }
  }

  togglePause(on) {
    if (this.state !== 'race' && this.state !== 'paused') return;
    this.paused = on;
    this.state = on ? 'paused' : 'race';
    if (on) this._pauseLabels('Ricomincia la gara', 'Torna a WisiKart');
    this.ui.pause(on);
    if (on) this.audio.stopEngine(); else this.audio.startEngine();
  }

  /** Utilità di debug/test: fa avanzare la simulazione senza aspettare i frame. */
  simulate(seconds, step = 1 / 60) {
    if (!this.race) return;
    for (let t = 0; t < seconds; t += step) this.race.update(step);
  }

  // ---------- loop ----------
  _loop() {
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.input.update();
    // navigazione menu
    const ev = this.input.consumeMenu();
    if (!['race', 'loading', 'story', 'storyload', 'hub', 'hubload'].includes(this.state)) {
      for (const e of ev) {
        if (e === 'ok') this.ui.activateFocus();
        else if (e === 'back') {
          if (this.input.pausePressed) continue; // Esc: ci pensa la pausa qui sotto, sennò riprende e ri-mette in pausa
          if (this.state === 'paused') this.togglePause(false);
          else if (this.state === 'storypaused') this.storyPause(false);
          else if (this.state === 'hubpaused') this.hubPause(false);
          else this.back();
        }
        else this.ui.moveFocus(e);
      }
    }
    if (this.input.pausePressed) {
      this.input.pausePressed = false;
      if (this.state === 'race' && this.race.state !== 'countdown') this.togglePause(true);
      else if (this.state === 'paused') this.togglePause(false);
      else if (this.state === 'story') this.storyPause(true);
      else if (this.state === 'storypaused') this.storyPause(false);
      else if (this.state === 'hub') this.hubPause(true);
      else if (this.state === 'hubpaused') this.hubPause(false);
    }
    if (this.state === 'hub' && this.hub) {
      this.hub.update(dt, this.input);
      if (this.state === 'hub' && this.hub) {
        this.ui.hubHud(this.hub.hud());
        this.renderer.render(this.hub.scene, this.hub.camera);
      }
    } else if (this.state === 'hubpaused' && this.hub) {
      this.renderer.render(this.hub.scene, this.hub.camera);
    } else if (this.state === 'story' && this.story) {
      this.story.update(dt, this.input);
      if (this.state === 'story' && this.story) {
        this.ui.storyHud(this.story.hud());
        this.renderer.render(this.story.scene, this.story.camera);
      }
    } else if (this.state === 'storypaused' && this.story) {
      this.renderer.render(this.story.scene, this.story.camera);
    } else if (this.state === 'race' && this.race) {
      this.race.update(dt);
      if (this.race.state !== 'done') this.ui.hud(this.race.hud());
      if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    } else if (this.state === 'paused' || this.state === 'results') {
      if (this.race && this.race.state !== 'done') { if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera); }
      else if (this.race) this.renderer.render(this.scene, this.camera);
    } else if (this.menuScene) {
      const t = performance.now() / 1000;
      this.menuCam.aspect = this.camera.aspect;
      this.menuCam.updateProjectionMatrix();
      this.menuCam.position.set(Math.sin(t * 0.5) * 1.5, Math.cos(t * 0.4) * 1.2, 0);
      this.menuCam.lookAt(0, 0, -40);
      for (const r of this.menuRings) { r.position.z += dt * 18; if (r.position.z > 6) r.position.z -= 26 * 7; r.rotation.z = t * 0.3; }
      const p = this.menuParticles.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) { let z = p.getZ(i) + dt * 40; if (z > 2) z -= 180; p.setZ(i, z); }
      p.needsUpdate = true;
      this.renderer.render(this.menuScene, this.menuCam);
    }
  }
}

const game = new Game();
window.wisikart = game;
game.boot();
