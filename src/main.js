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
import { FlightMode } from './story/FlightMode.js';
import { BrawlMode } from './story/BrawlMode.js';
import { ChaseMode } from './story/ChaseMode.js';
import { RhythmMode } from './story/RhythmMode.js';

const SAVE_KEY = 'wisikart.save.v1';
// stati da cui si apre il menu di gioco (Esc, Start, tasto II): piazza, livelli, gare, caricamenti, video
const MENU_FROM = ['race', 'loading', 'story', 'storyload', 'briefing', 'storyhelp', 'hub', 'hubload', 'cinematic', 'medals', 'finale'];
// stati di gioco in cui le frecce non navigano un menu
const GAMEPLAY = ['race', 'loading', 'story', 'storyload', 'hub', 'hubload', 'cinematic'];
// motore di ogni tipo di livello della Storia
const MODES = { flight: FlightMode, chase: ChaseMode, brawl: BrawlMode, rhythm: RhythmMode };

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
    // audio: volumi, interruttori per canale, silenzio generale (M) e sottotitoli; salvati con il resto
    this.settings = { music: 0.6, sfx: 0.8, voice: 1, musicOn: true, sfxOn: true, voiceOn: true, muted: false, subtitles: true, difficulty: 1, quality: 'high' };
    this.save = this._loadSave();
    Object.assign(this.settings, this.save.settings || {});
    this.menu = null; // menu di gioco aperto: { from: stato di partenza, confirm }
    this.audioPanelOpen = false;
    this._flow = 0; // cresce a ogni nuovo caricamento o uscita: i caricamenti superati si fermano da soli
    this.composer = null;
    this.menuScene = null;
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this.input.bindTouch(document.getElementById('touch'));
    this.input.bindTouch(document.getElementById('story-touch'));
    this.input.bindTouch(document.getElementById('hub-touch'));
    this.audio.setVolumes(this.settings);
    this.ui.refreshAudio();
    document.getElementById('menu-btn').addEventListener('click', () => { if (this.state === 'menu') this.closeMenu(); else this.openMenu(); });
    document.getElementById('audio-btn').addEventListener('click', () => this.onSpeaker());
    document.getElementById('audio-panel-close').addEventListener('click', () => this.closeAudioPanel());
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

  // ---------- audio ----------
  /** Cambia le impostazioni audio (volumi, interruttori, silenzio, sottotitoli): valgono subito ovunque e si salvano. */
  setAudio(patch) {
    Object.assign(this.settings, patch);
    this.audio.setVolumes(this.settings);
    this._persist();
    this.ui.refreshAudio();
  }

  /** Tasto M: tutto l'audio spento o riacceso, subito. */
  toggleMute() {
    this.setAudio({ muted: !this.settings.muted });
    this.ui.toast(this.settings.muted ? 'Audio spento. M per riaccenderlo.' : 'Audio acceso.');
  }

  /** Altoparlante nell'angolo: il primo tocco silenzia tutto, il secondo apre il pannello audio. */
  onSpeaker() {
    if (this.state === 'menu' || this.audioPanelOpen) return this.toggleMute();
    if (!this.settings.muted) {
      this.setAudio({ muted: true });
      this.ui.toast('Audio spento. Tocca di nuovo l’altoparlante per le impostazioni.');
      return;
    }
    // in gioco il pannello audio è il menu di gioco (così la partita si ferma); fuori, un pannello a parte
    if (!this.openMenu({ focusAudio: true })) this.openAudioPanel();
  }

  openAudioPanel() {
    this.audioPanelOpen = true;
    this.ui.audioPanel(true);
  }

  closeAudioPanel() {
    if (!this.audioPanelOpen) return;
    this.audioPanelOpen = false;
    this.audio.sfx('back');
    this.ui.audioPanel(false);
  }

  // ---------- menu di gioco ----------
  /** Voci del menu secondo dove ci si trova. */
  _menuCtx(from) {
    const kart = from === 'race' || from === 'loading';
    return {
      title: from === 'cinematic' ? 'Video in pausa' : 'Pausa',
      help: from === 'story' && !!this.story?.level.briefing, // "Istruzioni" solo nei livelli della Storia
      hub: from === 'story' || from === 'briefing', // "Torna in piazza"
      confirmHub: this.story?.levelDone ? 'Tornare in piazza? Il livello è già completato e salvato.' : 'Tornare in piazza? I progressi di questo livello andranno persi.',
      restart: from === 'race' ? 'Ricomincia la gara' : from === 'story' ? 'Ricomincia il livello' : from === 'hub' ? 'Torna al centro della piazza' : null,
      confirm: kart ? 'Vuoi davvero uscire? I progressi di questa gara andranno persi.'
        : from === 'hub' || from === 'hubload' ? 'Vuoi davvero tornare al menu principale? I livelli completati restano salvati.'
          : from === 'cinematic' || from === 'medals' ? 'Vuoi davvero uscire? Il livello è già completato e salvato.'
            : 'Vuoi davvero uscire? I progressi di questo livello andranno persi.'
    };
  }

  /** Apre il menu di gioco se da qui si può (ritorna false altrimenti). La partita, i video e il motore si fermano. */
  openMenu({ focusAudio = false } = {}) {
    if (this.state === 'storyhelp') { if (this.ui.closePanel) this.ui.closePanel(); return true; } // Esc chiude le istruzioni e torna al menu
    if (!MENU_FROM.includes(this.state)) return false;
    const from = this.state;
    this.menu = { from, confirm: false };
    this.state = 'menu';
    this.audio.sfx('select');
    if (from === 'race') this.audio.stopEngine();
    if (this.story && this.story.pause) this.story.pause(true); // motori dei blindati & co.
    this.ui.pauseVideos(true);
    this.ui.gameMenu({ ...this._menuCtx(from), focusAudio });
    return true;
  }

  closeMenu() {
    if (!this.menu) return;
    const from = this.menu.from;
    this.menu = null;
    this.ui.gameMenu(null);
    this.state = from;
    this.ui.pauseVideos(false);
    if (this.story && this.story.pause) this.story.pause(false);
    // niente comandi rimasti in memoria dal menu (salto, lancio, tasti tenuti)
    this.input.releaseAll();
    this.input.pausePressed = false;
    if (from === 'race' && this.race && ['countdown', 'racing', 'finished'].includes(this.race.state)) this.audio.startEngine();
  }

  /** Esc / B nel menu: dalla conferma si torna alle voci, dalle voci si riprende. */
  menuBack() {
    if (!this.menu) return;
    if (this.menu.confirm) { this.menu.confirm = false; this.audio.sfx('back'); this.ui.gameMenu(this._menuCtx(this.menu.from)); }
    else this.closeMenu();
  }

  /** Cambio di stato alla fine di un caricamento: se nel frattempo il menu è aperto, vale alla sua chiusura. */
  _setState(s) {
    if (this.state === 'menu' && this.menu) this.menu.from = s;
    else this.state = s;
  }

  pauseAction(a) {
    this.audio.sfx('select');
    if (this.state !== 'menu' || !this.menu) return;
    const from = this.menu.from;
    if (a === 'resume') this.closeMenu();
    else if (a === 'help') this.storyHelp();
    else if (a === 'restart') {
      this.closeMenu();
      if (from === 'race' && this.race) this.startRace(this.race.trackDef);
      else if (from === 'story' && this.story) this.startStory(this.story.level);
      else if (from === 'hub' && this.hub) { this.hub.spawnAt = null; this.hub._spawn(); }
    } else if (a === 'quit') { this.menu.confirm = 'exit'; this.ui.gameMenuConfirm(true, this._menuCtx(from).confirm, 'Sì, esci'); }
    else if (a === 'hub') { this.menu.confirm = 'hub'; this.ui.gameMenuConfirm(true, this._menuCtx(from).confirmHub, 'Sì, torna in piazza'); }
    else if (a === 'stay') this.menuBack();
    else if (a === 'exit') {
      // Storia → menu principale (o la piazza, con "Torna in piazza"), WisiKart → sottomenu WisiKart
      const toHub = this.menu.confirm === 'hub';
      const level = this.story?.level;
      this.menu = null;
      this.ui.gameMenu(null);
      this.ui.abortWaits();
      if (from === 'race' || from === 'loading') this.toKartMenu();
      else if (toHub && level) { this.audio.sfx('back'); this._endStory(); this.openStory('', level.id); }
      else this.toMainMenu();
    }
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
    const flow = ++this._flow;
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
    if (flow !== this._flow) { race.dispose(); return; } // uscito dal menu durante il caricamento
    // la gara parte quando la presentazione dei piloti (griglia.mp4) finisce o viene saltata
    this.ui.loadingStatus('Pista pronta. I piloti si stanno sistemando…');
    await intro;
    if (flow !== this._flow) { race.dispose(); return; }
    this.ui.loadingDone();
    this.race = race;
    this._setupComposer(trackDef);
    this.ui.hudStart(race.track);
    this._setState('race');
    // un frame di respiro per il caricamento, poi si parte (col menu aperto il motore resta spento)
    setTimeout(() => {
      if (this.race !== race) return;
      race.start();
      if (this.state === 'menu') this.audio.stopEngine();
    }, 300);
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
    this.startHub(this._storyWorld(), { message, spawnAt });
  }

  /** Il pianeta in cui si trova Whiskey (save.storyWorld); dopo il Portale è Retah, e per ora non si torna indietro. */
  _storyWorld() {
    // salvataggi di prima di Retah: Portale già finito = si è già atterrati su Retah
    if (!this.save.storyWorld && this.save.story?.portale) this.save.storyWorld = 'retah';
    return WORLDS.find((w) => w.id === this.save.storyWorld) || WORLDS[0];
  }

  async startHub(world, { message = '', spawnAt = null } = {}) {
    const flow = ++this._flow;
    this.state = 'hubload';
    this.audio.stopMusic();
    this.ui.hubLoading(world);
    this._endStory();
    this._endHub();
    this.save.story = this.save.story || {};
    const hub = new Hub({
      world,
      character: storyHero({ guitar: !!this.save.storyGuitar }),
      audio: this.audio,
      completed: this.save.story,
      medals: this.save.storyMedals || {},
      spawnAt,
      onEnter: (e) => { if (e.kind === 'level') this.startStory(e.level); }
    });
    await hub.load((t) => this.ui.loadingStatus(t));
    if (flow !== this._flow) { hub.dispose(); return; }
    this.hub = hub;
    this._resize();
    this.input.releaseAll();
    this.input.pausePressed = false;
    this._setState('hub');
    this.ui.hubStart(message);
    this.audio.playTheme(world.music);
  }

  _endHub() {
    if (this.hub) { this.hub.dispose(); this.hub = null; }
  }

  async startStory(level) {
    const flow = ++this._flow;
    this.state = 'storyload';
    this.audio.stopMusic();
    this.ui.storyLoading(level);
    this._endStory();
    this._endHub();
    // Nella Storia si gioca con Whiskey basic; le sei forme si sbloccheranno più avanti (vedi story/hero.js).
    // Le monete sono un totale unico della Storia, salvato a ogni raccolta (ogni 100, una vita in più).
    const Mode = MODES[level.type] || StoryMode;
    const flight = level.type === 'flight' || level.type === 'chase' || level.type === 'rhythm'; // livelli senza vite
    // vite guadagnate con le monete durante un volo (dove le vite non ci sono): valgono nel livello a piedi dopo
    const bonusLives = flight ? 0 : this.save.storyBonusLives || 0;
    if (!flight && bonusLives) { this.save.storyBonusLives = 0; this._persist(); }
    const story = new Mode({
      level,
      character: storyHero({ guitar: !!this.save.storyGuitar }),
      audio: this.audio,
      coins: this.save.storyCoins || 0,
      bonusLives,
      onCoins: (n, livesGained = 0) => {
        this.save.storyCoins = n;
        if (livesGained) this.save.storyBonusLives = (this.save.storyBonusLives || 0) + livesGained;
        this._persist();
      },
      // livelli con una scena dopo la vittoria (la rissa, prima di salire su Emma): si salva subito
      onProgress: () => { this.save.story = { ...(this.save.story || {}), [level.id]: true }; this._persist(); },
      onComplete: (result) => this._storyComplete(level, result),
      onGameOver: () => this.startStory(level)
    });
    await story.load((t) => this.ui.loadingStatus(t));
    if (flow !== this._flow) { story.dispose(); return; } // uscito dal menu durante il caricamento
    this.story = story;
    this._resize();
    // istruzioni prima di partire (la scena del livello resta ferma dietro)
    this._setState('briefing');
    await this.ui.briefing(level, this.input.lastDevice);
    if (flow !== this._flow || this.story !== story) return; // nel frattempo si è usciti
    // niente comandi rimasti in memoria dal menu o dalle istruzioni (tasti, touch, salto)
    this.input.releaseAll();
    this.input.pausePressed = false;
    this._setState('story');
    this.ui.storyHudStart(level.type);
    this.audio.playTheme(level.music);
  }

  /** result (livelli con medaglie): { medal, stats } calcolati dal livello. */
  async _storyComplete(level, result = null) {
    const flow = ++this._flow;
    this.save.story = { ...(this.save.story || {}), [level.id]: true };
    // livello che chiude un pianeta (il Portale): si atterra sul prossimo e da lì si riparte
    if (level.nextWorld) this.save.storyWorld = level.nextWorld;
    // sblocchi: la chitarra di Infinity Guitars (da qui Whiskey la porta sempre sulla schiena)
    if (level.unlock === 'guitar') this.save.storyGuitar = true;
    // medaglia: si tiene la migliore per livello, ed è quella che si vede sull'ingresso in piazza
    let best = null, isNewBest = false;
    if (result && result.medal) {
      const rank = { bronze: 1, silver: 2, gold: 3 };
      this.save.storyMedals = this.save.storyMedals || {};
      const old = this.save.storyMedals[level.id];
      isNewBest = !old || rank[result.medal] > rank[old];
      if (isNewBest) this.save.storyMedals[level.id] = result.medal;
      best = this.save.storyMedals[level.id];
    }
    this._persist();
    this._endStory();
    // livelli con una cinematica finale (il tunnel del portale): prima il video
    if (level.cinematic) {
      this._setState('cinematic');
      this.audio.stopMusic();
      await this.ui.cinematic(level.cinematic);
      if (flow !== this._flow) return; // uscito dal menu durante il video
    }
    // fine della prima parte (esibizione al piazzale): applausi e schermata di chiusura
    if (result && result.finale && level.finale) {
      this._setState('finale');
      this.audio.stopMusic();
      this.audio.sfx('applause');
      await this.ui.finale(level.finale);
      if (flow !== this._flow) return;
    }
    if (result && result.medal) {
      this._setState('medals');
      this.audio.sfx('finish');
      await this.ui.medals({ level, medal: result.medal, best, isNewBest, stats: result.stats });
      if (flow !== this._flow) return;
    }
    // livello che prosegue direttamente nel successivo (rissa → inseguimento: si è appena saliti su Emma)
    const next = result && result.next ? this._levelById(result.next) : null;
    if (next) { this.startStory(next); return; }
    // si ricompare in piazza davanti all'ingresso del livello appena finito (o all'arrivo, su un pianeta nuovo)
    this.openStory(level.completeMessage || `Livello completato: ${level.name}.`, level.nextWorld ? null : level.id);
  }

  /** Un livello della Storia dal suo id (quello dell'ingresso in piazza). */
  _levelById(id) {
    for (const w of WORLDS) for (const e of w.entrances) if (e.id === id && e.level) return e.level;
    return null;
  }

  _endStory() {
    if (this.story) { this.story.dispose(); this.story = null; }
  }

  /** "Istruzioni" dal menu di gioco nei livelli della Storia: riapre la schermata, poi torna al menu. */
  async storyHelp() {
    if (this.state !== 'menu' || !this.menu || !this.story) return;
    const menu = this.menu;
    this.state = 'storyhelp';
    this.ui.gameMenu(null);
    await this.ui.briefing(this.story.level, this.input.lastDevice);
    if (this.state !== 'storyhelp') return;
    this.state = 'menu';
    this.menu = menu;
    this.input.pausePressed = false;
    this.ui.gameMenu(this._menuCtx(menu.from));
  }

  /** Uscita da una gara (risultati o menu di gioco): si torna al sottomenu WisiKart. */
  toKartMenu() {
    this._flow++;
    this.audio.sfx('back');
    if (this.race) { this.race.dispose(); this.race = null; }
    this.composer = null;
    this.scene.clear();
    this.audio.playTheme('menu');
    this.openKartMenu();
  }

  /** Uscita dalla Storia (piazza, livello, video): si torna al menu principale. */
  toMainMenu() {
    this._flow++;
    this.audio.sfx('back');
    this._endStory();
    this._endHub();
    this.state = 'title';
    this.audio.playTheme('menu');
    this.ui.title();
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
    const ev = this.input.consumeMenu();
    // M: silenzio immediato, sempre e ovunque
    if (this.input.mutePressed) { this.input.mutePressed = false; this.toggleMute(); }
    // Esc / P / Start / tasto II: apre o chiude il menu di gioco
    const pause = this.input.pausePressed;
    this.input.pausePressed = false;
    this.ui.menuButton(this.state === 'menu' || MENU_FROM.includes(this.state));
    if (this.audioPanelOpen) {
      if (pause) this.closeAudioPanel();
      else for (const e of ev) { if (e === 'back') this.closeAudioPanel(); else if (e === 'ok') this.ui.activateFocus(); else this.ui.moveFocus(e); }
    } else if (this.state === 'menu') {
      if (pause) this.menuBack();
      else for (const e of ev) { if (e === 'back') this.menuBack(); else if (e === 'ok') this.ui.activateFocus(); else this.ui.moveFocus(e); }
    } else if (pause && this.openMenu()) {
      // aperto: gli altri tasti di questo frame non contano
    } else if (['briefing', 'storyhelp', 'medals', 'finale'].includes(this.state)) {
      // istruzioni e medaglie: qualsiasi tasto (anche del gamepad) le chiude
      if (ev.length && this.ui.closePanel) this.ui.closePanel();
    } else if (!GAMEPLAY.includes(this.state)) {
      for (const e of ev) {
        if (e === 'ok') this.ui.activateFocus();
        else if (e === 'back') this.back();
        else this.ui.moveFocus(e);
      }
    }
    // con il menu aperto la scena resta ferma dietro
    const view = this.state === 'menu' && this.menu ? this.menu.from : this.state;
    if (this.state === 'hub' && this.hub) {
      this.hub.update(dt, this.input);
      if (this.state === 'hub' && this.hub) {
        this.ui.hubHud(this.hub.hud());
        this.renderer.render(this.hub.scene, this.hub.camera);
      }
    } else if (this.state === 'story' && this.story) {
      this.story.update(dt, this.input);
      if (this.state === 'story' && this.story) {
        this.ui.storyHud(this.story.hud());
        this.renderer.render(this.story.scene, this.story.camera);
        if (this.story.renderOverlay) this.story.renderOverlay(this.renderer); // specchietto dell'inseguimento
      }
    } else if (this.state === 'race' && this.race) {
      this.race.update(dt);
      if (this.race.state !== 'done') this.ui.hud(this.race.hud());
      if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
    } else if (view === 'hub' && this.hub) {
      this.renderer.render(this.hub.scene, this.hub.camera);
    } else if (['story', 'briefing', 'storyhelp'].includes(view) && this.story) {
      this.renderer.render(this.story.scene, this.story.camera);
    } else if ((view === 'race' || view === 'results') && this.race) {
      if (this.race.state !== 'done' && this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
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
