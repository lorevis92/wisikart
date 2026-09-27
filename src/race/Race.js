import * as THREE from 'three';
import { Track } from '../track/Track.js';
import { Kart } from '../kart/Kart.js';
import { AIDriver } from '../ai/AIDriver.js';
import { ItemSystem } from '../items/ItemSystem.js';
import { CHARACTERS } from '../config/characters.js';

const _camTarget = new THREE.Vector3();
const _camPos = new THREE.Vector3();

export class Race {
  constructor({ scene, camera, renderer, audio, input, trackDef, playerChar, mode = 'single', laps, difficulty = 1, onEvent }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.audio = audio;
    this.input = input;
    this.trackDef = trackDef;
    this.playerChar = playerChar;
    this.mode = mode; // single | gp | time
    this.laps = laps || trackDef.laps;
    this.difficulty = difficulty;
    this.onEvent = onEvent || (() => {});
    this.karts = [];
    this.ai = [];
    this.state = 'loading';
    this.time = 0;
    this.raceTime = 0;
    this.countdown = 4.2;
    this.lapTimes = [];
    this.bestLap = null;
    this.results = null;
    this.cameraMode = 0;
    this.finishOrder = [];
    this.playerPos = 1;
    this.lastLapStart = 0;
  }

  async load(onProgress = () => {}) {
    onProgress('Costruisco la pista…');
    this.track = new Track(this.trackDef, this.scene, this.renderer);
    await this.track.build();
    onProgress('Preparo i piloti…');
    const roster = this.mode === 'time' ? [this.playerChar] : [this.playerChar, ...CHARACTERS.filter((c) => c.id !== this.playerChar.id)];
    const grid = this.track.gridPositions(roster.length);
    // il giocatore parte in fondo alla griglia (come da tradizione), gli altri davanti
    const order = roster.map((c, i) => ({ c, i })).sort((a, b) => (a.c === this.playerChar ? 1 : 0) - (b.c === this.playerChar ? 1 : 0));
    for (let i = 0; i < order.length; i++) {
      const { c } = order[i];
      const isPlayer = c === this.playerChar;
      const kart = new Kart(c, { isPlayer, index: i });
      await kart.buildVisual();
      const g = grid[i];
      kart.placeAt(g.pos, g.heading, g.idx);
      this.scene.add(kart.group);
      this.karts.push(kart);
      if (isPlayer) this.player = kart;
      else this.ai.push(new AIDriver(kart, this.track, this.difficulty * (0.92 + Math.random() * 0.14)));
    }
    this.items = new ItemSystem(this.scene, this.track, this.audio);
    this.state = 'countdown';
    this.track.setStartLights(0);
    // camera iniziale
    this._updateCamera(1, true);
    onProgress('Pronti.');
  }

  start() {
    this.state = 'countdown';
    this.countdown = 4.0;
    this.audio.startEngine();
    this.audio.playTheme(this.trackDef.music);
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    const tr = this.track;
    // input giocatore
    const p = this.player;
    if (this.state === 'countdown') {
      const prev = this.countdown;
      this.countdown -= dt;
      const lights = Math.min(3, Math.floor(4 - this.countdown));
      if (Math.floor(prev) !== Math.floor(this.countdown)) {
        if (this.countdown > 0) { this.audio.sfx('beep'); this.onEvent({ type: 'count', n: Math.ceil(this.countdown) }); }
      }
      tr.setStartLights(lights, this.countdown <= 0);
      if (this.countdown <= 0) {
        this.state = 'racing';
        this.audio.sfx('go');
        this.audio.voice('start');
        this.onEvent({ type: 'go' });
        this.lastLapStart = 0;
      }
      // il giocatore può "caricare" l'acceleratore ma non muoversi
      p.input.throttle = 0;
      p.input.steer = this.input.steer;
      for (const k of this.karts) k.input.throttle = 0;
    } else if (this.state === 'racing' || this.state === 'finished') {
      this.raceTime += dt;
      if (this.autopilot) {
        if (!this.playerAI) this.playerAI = new AIDriver(p, this.track, 1);
        this.playerAI.update(dt, this.karts, null, this);
        if (p.input.item && p.item) { this.items.use(p, this.karts); p.input.item = false; }
      } else if (!p.finished) {
        p.input.throttle = this.input.throttle;
        p.input.steer = this.input.steer;
        p.input.drift = this.input.drift;
        if (this.input.itemPressed) { this.input.itemPressed = false; if (p.item) { this.items.use(p, this.karts); this.audio.sfx(p.item === 'missile' || p.item === 'cannone' ? 'shoot' : 'select'); } }
        if (this.input.lookBack !== undefined) this.lookBack = this.input.lookBack;
      }
      for (const a of this.ai) a.update(dt, this.karts, p, this);
      for (const k of this.karts) {
        if (!k.isPlayer && k.input.item && k.item) { this.items.use(k, this.karts); k.input.item = false; }
      }
    }

    // fisica
    for (const k of this.karts) {
      const wasDrifting = k.drifting, hadBoost = k.boost > 0, wasPad = k.padHit;
      k.padHit = false;
      k.update(dt, tr, this.karts);
      if (k.isPlayer) {
        if (k.lastDriftRelease) { this.audio.sfx(k.lastDriftRelease === 2 ? 'drift2' : 'drift1'); this.audio.sfx('boost'); k.lastDriftRelease = 0; }
        if (k.padHit && !wasPad) this.audio.sfx('boost');
        if (k.hitWall > 0.29) this.audio.sfx('wall');
        if (k.pickupEvent) { k.pickupEvent = false; this.audio.sfx('pickup'); }
      }
      if (k.pickupEvent) k.pickupEvent = false;
      if (k.itemRolling > 0 && k.itemRolling - dt <= 0 && !k.item) this.items.grant(k, k.rank, this.karts.length);
      if (k.lapEvent) {
        k.lapEvent = false;
        if (k.isPlayer) this._playerLap();
        if (k.lap > this.laps && !k.finished) this._finish(k);
      }
    }
    if (this.player.itemRolling > 0 && this.player.itemRolling - dt <= 0 && !this.player.item) { /* già gestito sopra */ }

    // oggetti
    this.items.update(dt, this.karts, p);
    for (const ev of this.items.events) {
      if (ev.type === 'hit') {
        if (ev.victim.ai && ev.victim !== p) ev.victim.ai.onHit(ev.by);
        if (ev.victim.isPlayer) { this.audio.sfx('hit'); this.audio.voice('hit'); this.onEvent({ type: 'shake', power: 1 }); }
        else if (ev.by === p) { this.audio.voice('hitother'); this.audio.sfx('hit'); }
      } else if (ev.type === 'blind') { this.audio.sfx('flash'); this.onEvent({ type: 'blind' }); }
      else if (ev.type === 'fog') this.onEvent({ type: 'fog' });
      else if (ev.type === 'use' && ev.kart.isPlayer) this.onEvent({ type: 'used', item: ev.item });
    }
    this.items.events.length = 0;

    // classifica
    const sorted = [...this.karts].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    sorted.forEach((k, i) => (k.rank = i + 1));
    this.playerPos = p.rank;

    tr.update(dt, this.time, p.pos);
    this._updateCamera(dt);
    const speedRatio = Math.min(1, Math.abs(p.speed) / p.maxSpeed);
    this.audio.updateEngine(speedRatio, p.boost > 0);

    // fine gara per tutti (o timeout dopo che il giocatore ha finito)
    if (this.state === 'finished') {
      this.finishTimer -= dt;
      if (this.finishTimer <= 0) this._complete();
    }
  }

  _playerLap() {
    const lapTime = this.raceTime - this.lastLapStart;
    this.lastLapStart = this.raceTime;
    this.lapTimes.push(lapTime);
    if (this.bestLap === null || lapTime < this.bestLap) this.bestLap = lapTime;
    if (this.player.lap <= this.laps) {
      this.audio.sfx('lap');
      if (this.player.lap === this.laps) { this.audio.voice('lastlap'); this.onEvent({ type: 'lastlap' }); }
      else this.onEvent({ type: 'lap', lap: this.player.lap });
    }
  }

  _finish(k) {
    k.finished = true;
    k.finishTime = this.raceTime;
    this.finishOrder.push(k);
    if (k.isPlayer) {
      this.state = 'finished';
      this.finishTimer = 6;
      this.audio.sfx('finish');
      if (k.rank === 1) this.audio.voice('win');
      this.onEvent({ type: 'finish', rank: k.rank });
      this.audio.playTheme('results');
    }
    if (this.finishOrder.length === this.karts.length) this.finishTimer = Math.min(this.finishTimer ?? 2, 2);
  }

  _complete() {
    if (this.results) return;
    // chi non ha finito viene classificato per posizione attuale
    const sorted = [...this.karts].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    this.results = sorted.map((k, i) => ({ rank: i + 1, character: k.character, time: k.finished ? k.finishTime : null, isPlayer: k.isPlayer }));
    this.state = 'done';
    this.audio.stopEngine();
    this.onEvent({ type: 'results', results: this.results, lapTimes: this.lapTimes, bestLap: this.bestLap, totalTime: this.player.finishTime });
  }

  _updateCamera(dt, snap = false) {
    const p = this.player;
    const cam = this.camera;
    const back = this.lookBack ? -1 : 1;
    const dist = 12 + Math.min(1, Math.abs(p.speed) / p.maxSpeed) * 2.5 + (p.boost > 0 ? 1.5 : 0);
    const height = 5.4;
    const f = p.forward(new THREE.Vector3());
    _camPos.copy(p.pos).addScaledVector(f, -dist * back).y += height;
    // segui la pendenza
    const s = this.track.samples[p.trackIdx];
    _camPos.y = Math.max(_camPos.y, s.pos.y + 2.5);
    if (this.state === 'countdown' && !snap) {
      // panoramica iniziale che scende sul kart
      const t = Math.max(0, this.countdown - 0.6) / 3.4;
      _camPos.addScaledVector(f, -t * 12).y += t * 14;
      _camPos.addScaledVector(s.right, Math.sin(t * 3.14) * 12);
    }
    _camTarget.copy(p.pos).addScaledVector(f, 6 * back).y += 1.6;
    if (snap) { cam.position.copy(_camPos); }
    else {
      const k = 1 - Math.exp(-dt * (this.lookBack ? 20 : 6.5));
      cam.position.lerp(_camPos, k);
    }
    // scossa
    if (this.shake > 0) {
      this.shake -= dt;
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.8;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.8;
    }
    cam.lookAt(_camTarget);
    const targetFov = 62 + (p.boost > 0 ? 12 : 0) + Math.min(1, Math.abs(p.speed) / p.maxSpeed) * 8;
    cam.fov = THREE.MathUtils.damp(cam.fov, targetFov, 4, dt);
    cam.updateProjectionMatrix();
  }

  hud() {
    const p = this.player;
    return {
      lap: Math.min(p.lap, this.laps),
      laps: this.laps,
      pos: p.rank,
      total: this.karts.length,
      time: this.raceTime,
      speed: Math.abs(p.speed) * 3.2,
      item: p.item,
      rolling: p.itemRolling > 0,
      boost: p.boost > 0,
      driftCharge: p.drifting ? p.driftCharge : 0,
      blind: p.blind,
      slow: p.slow,
      state: this.state,
      countdown: this.countdown,
      bestLap: this.bestLap,
      karts: this.karts.map((k) => ({ idx: k.trackIdx, lateral: k.lateral, isPlayer: k.isPlayer, color: k.character.colors.primary, rank: k.rank, name: k.character.name }))
    };
  }

  dispose() {
    this.audio.stopEngine();
    for (const k of this.karts) this.scene.remove(k.group);
    this.items.dispose();
    this.track.dispose();
  }
}
