import * as THREE from 'three';
import { buildSong } from '../audio/AudioEngine.js';
import { loadRigged, riggedUrl, locomotionPose } from './Rig.js';
import { attachGuitar } from './hero.js';
import { EmmaVoice } from './emma.js';
import { muralOnWall, std } from './rooms.js';

// Livello a tempo di musica della Storia (il primo è il locale da ballo, story/ballo.js), alla Crypt of the
// NecroDancer: la pista è una griglia e Whiskey fa un passo solo se la direzione arriva vicino al battito
// (cerchio che pulsa nell'HUD). La tolleranza è larga all'inizio e si stringe man mano che ci si avvicina al
// centro. Hes fa strada (aspetta se Whiskey resta indietro); sulla pista ci sono note luminose da raccogliere.
// Niente game over: fuori tempo si perde solo il passo (e quello dopo). Più si avanza, più l'ambiente si
// deforma (luci che si allungano, colori che sbavano, prospettiva che ondeggia). Raggiunta Hes al centro,
// dissolvenza e si passa al livello dopo (next).

const CELL = 1.5;
const _v = new THREE.Vector3();

export class DanceMode {
  constructor({ level, character, audio, coins = 0, onCoins, onComplete }) {
    this.level = level;
    this.character = character;
    this.audio = audio;
    this.coins = coins;
    this.onCoins = onCoins;
    this.onComplete = onComplete;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.3, 400);
    this.t = 0;
    this.state = 'intro'; // intro | dance | fade | ended
    this.stateT = 0;
    this.notice = null;
    this.noticeTimer = 0;
    this.localTime = 0;
    this.prevAx = 0; this.prevAy = 0;
    this.blockedUntil = -1;
    this.lastBeatMoved = -99;
    this.notesTaken = 0;
    this.feedback = null;
  }

  async load(progress = () => {}) {
    const L = this.level, M = L.models;
    progress(L.loadingText || 'Accendo le stelle sul soffitto…');
    const [hero, hes] = await Promise.all([loadRigged(riggedUrl(this.character), 1.8), loadRigged(M.hes.url, M.hes.h)]);
    const S = this.scene;
    const N = L.grid; // la griglia va da -N a +N
    S.background = new THREE.Color('#0a0820');
    S.fog = new THREE.Fog(0x0a0820, 30, 90);
    S.add(new THREE.HemisphereLight(0xb8a8ff, 0x1a0a2a, 0.7));
    const key = new THREE.DirectionalLight(0xd8c8ff, 0.8);
    key.position.set(4, 14, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera; sc.left = sc.bottom = -16; sc.right = sc.top = 16;
    S.add(key);
    // la pista: piastrelle che si accendono sul battito
    const tiles = (2 * N + 1) ** 2;
    this.tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL * 0.94, 0.2, CELL * 0.94), new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.25 }), tiles);
    const m = new THREE.Matrix4(), col = new THREE.Color();
    this.tileColors = [];
    let k = 0;
    for (let j = -N; j <= N; j++) for (let i = -N; i <= N; i++) {
      m.makeTranslation(i * CELL, -0.1, j * CELL);
      this.tiles.setMatrixAt(k, m);
      const c = col.setHSL((((i + j) % 4) + 4) % 4 * 0.2 + 0.55, 0.7, 0.25).clone();
      this.tiles.setColorAt(k, c);
      this.tileColors.push(c);
      k++;
    }
    this.tiles.receiveShadow = true;
    S.add(this.tiles);
    // l'illustrazione del locale sul fondo, grande, e il soffitto a stelle
    await muralOnWall(S, L.background, { x: 0, y: 6, z: -(N + 3) * CELL, h: 11, frame: '#7a5ac9' });
    const starG = new THREE.BufferGeometry();
    const sp = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 30;
      sp.set([Math.cos(a) * r, 11 + Math.random() * 6, Math.sin(a) * r], i * 3);
    }
    starG.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(starG, new THREE.PointsMaterial({ color: 0xfff4d8, size: 0.18, transparent: true, opacity: 0.9 }));
    S.add(this.stars);
    // fasci di luce dall'alto (si allungano man mano che la notte si deforma)
    this.beams = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6, 12, 16, 1, true), new THREE.MeshBasicMaterial({ color: [0xff5fb0, 0x7fa4ff, 0xf5b942][i % 3], transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      cone.position.set(Math.cos(a) * 7, 6, Math.sin(a) * 7);
      S.add(cone);
      this.beams.push({ cone, a });
    }
    // il percorso di Hes (verso il centro) e le note luminose
    this.path = L.path.map(([i, j]) => ({ i, j }));
    this.notes = L.notes.map(([i, j]) => {
      const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshStandardMaterial({ color: 0xfff2a8, emissive: 0xffc040, emissiveIntensity: 1.8 }));
      g.position.set(i * CELL, 0.7, j * CELL);
      S.add(g);
      return { i, j, mesh: g, taken: false };
    });
    // Hes e Whiskey
    const mk = (rig, color) => {
      const root = new THREE.Group();
      if (rig) root.add(rig.root);
      else { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 6, 10), std(color)); b.position.y = 0.9; root.add(b); }
      root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      S.add(root);
      return root;
    };
    this.hesRig = hes; this.heroRig = hero;
    this.hesRoot = mk(hes, '#c0392b');
    this.heroRoot = mk(hero, '#2b3a6b');
    if (this.character.guitar) await attachGuitar(this.heroRoot);
    const glow = new THREE.PointLight(0xff8ac8, 10, 6, 1.6);
    glow.position.y = 2.2;
    this.hesRoot.add(glow);
    this.hesStep = 0;
    this.hesCell = { ...this.path[0] };
    this.cell = { ...L.start };
    this.heroRoot.position.set(this.cell.i * CELL, 0, this.cell.j * CELL);
    this.hesRoot.position.set(this.hesCell.i * CELL, 0, this.hesCell.j * CELL);
    this.heroFrom = this.heroRoot.position.clone(); this.heroTo = this.heroFrom.clone(); this.heroHop = 1;
    this.hesFrom = this.hesRoot.position.clone(); this.hesTo = this.hesFrom.clone(); this.hesHop = 1;
    this.emma = new EmmaVoice(this.audio, L.voices);
    await this.emma.load();
    this.song = buildSong(L.song);
    this.beat = this.song.beat;
    this._placeCamera(1);
    progress('Pronti.');
  }

  say(text, time = 2.4) { this.notice = text; this.noticeTimer = time; }

  /** Avanzamento verso il centro: 0 all'inizio, 1 con Hes al centro. */
  get progress() { return Math.min(1, this.hesStep / (this.path.length - 1)); }

  /** Tolleranza sul battito (s): larga all'inizio, stretta verso il centro. */
  _window() { const W = this.level.window; return W[0] + (W[1] - W[0]) * this.progress; }

  _time(dt) {
    this.localTime += dt;
    const st = this.audio.songTime ? this.audio.songTime() : null;
    return st !== null && st !== undefined ? st : this.localTime;
  }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    this.emma.update(dt);
    this.noticeTimer = Math.max(0, this.noticeTimer - dt);
    if (this.noticeTimer <= 0) this.notice = null;
    if (this.feedback && this.t - this.feedback.at > 0.5) this.feedback = null;
    input.jumpPressed = input.itemPressed = input.attackPressed = input.upPressed = false;
    for (let i = 0; i < 4; i++) input.lanePressed[i] = false;

    if (this.state === 'intro') {
      if (this.stateT < dt * 1.5) { this.emma.say('ritmo', { important: true }); this.audio.playSong(this.song, 0); this.localTime = 0; }
      this.time = this._time(dt);
      if (this.time >= 4 * this.beat - 0.05) { this.state = 'dance'; this.say('Muoviti sul battito: segui Hes!', 2.5); }
      return this._animate(dt);
    }
    if (this.state === 'fade') {
      if (this.stateT > this.level.fadeTime) { this.state = 'ended'; this.audio.stopSong(); this.onComplete && this.onComplete({ next: this.level.next }); }
      return this._animate(dt);
    }
    if (this.state !== 'dance') return;
    const time = this.time = this._time(dt);
    // il brano ricomincia (senza conteggio) se finisce prima di arrivare al centro
    if (time > this.song.duration - this.beat && this.audio.playSong) { this.audio.playSong(this.song, 4 * this.beat); this.localTime = 4 * this.beat; }
    // direzione appena premuta (fronte di salita delle frecce / levetta)
    const ax = input.axisX, ay = input.axisY;
    let dir = null;
    if (ax > 0.5 && this.prevAx <= 0.5) dir = [1, 0];
    else if (ax < -0.5 && this.prevAx >= -0.5) dir = [-1, 0];
    else if (ay > 0.5 && this.prevAy <= 0.5) dir = [0, -1];
    else if (ay < -0.5 && this.prevAy >= -0.5) dir = [0, 1];
    this.prevAx = ax; this.prevAy = ay;
    if (dir) this._tryMove(dir, time);
    this._hesLogic(time);
    // arrivati da Hes al centro: dissolvenza
    const last = this.path[this.path.length - 1];
    if (this.hesStep >= this.path.length - 1 && Math.abs(this.cell.i - last.i) + Math.abs(this.cell.j - last.j) <= 1) {
      this.state = 'fade'; this.stateT = 0;
      this.audio.sfx('finish');
      this.say('Hes ti prende le mani…', 2.5);
    }
    this._animate(dt);
  }

  /** Un passo, se la direzione cade abbastanza vicino a un battito (uno solo per battito). */
  _tryMove([di, dj], time) {
    const b = Math.round(time / this.beat);
    const err = Math.abs(time - b * this.beat);
    const W = this._window();
    if (err > W || b <= this.blockedUntil || b === this.lastBeatMoved) {
      // fuori tempo: niente passo, e si salta anche il battito dopo (Whiskey rallenta)
      this.blockedUntil = Math.max(this.blockedUntil, b + 1);
      this.feedback = { text: 'Fuori tempo', ok: false, at: this.t };
      this.audio.sfx('miss');
      return;
    }
    this.lastBeatMoved = b;
    const N = this.level.grid;
    const ni = THREE.MathUtils.clamp(this.cell.i + di, -N, N), nj = THREE.MathUtils.clamp(this.cell.j + dj, -N, N);
    if (ni === this.hesCell.i && nj === this.hesCell.j && this.hesStep < this.path.length - 1) return; // su Hes no
    this.cell = { i: ni, j: nj };
    this.heroFrom = this.heroRoot.position.clone();
    this.heroTo = new THREE.Vector3(ni * CELL, 0, nj * CELL);
    this.heroHop = 0;
    this.heroRoot.rotation.y = Math.atan2(di, dj);
    this.feedback = { text: err < W * 0.4 ? 'Perfetto!' : 'A tempo', ok: true, at: this.t };
    this.audio.sfx('select');
    // nota raccolta
    for (const n of this.notes) {
      if (!n.taken && n.i === ni && n.j === nj) {
        n.taken = true; n.mesh.visible = false;
        this.notesTaken++;
        this.coins++;
        this.audio.sfx('pickup');
        const lives = Math.floor(this.coins / 100) - Math.floor((this.coins - 1) / 100);
        this.onCoins && this.onCoins(this.coins, lives);
      }
    }
  }

  /** Hes avanza di una casella a ogni battito, se Whiskey le sta dietro; altrimenti lo aspetta. */
  _hesLogic(time) {
    const b = Math.floor(time / this.beat);
    if (b === this.hesBeat) return;
    this.hesBeat = b;
    if (this.hesStep >= this.path.length - 1) return;
    const dist = Math.abs(this.cell.i - this.hesCell.i) + Math.abs(this.cell.j - this.hesCell.j);
    if (dist > this.level.lead) return; // ti aspetta
    this.hesStep++;
    const c = this.path[this.hesStep];
    this.hesFrom = this.hesRoot.position.clone();
    this.hesTo = new THREE.Vector3(c.i * CELL, 0, c.j * CELL);
    this.hesHop = 0;
    this.hesRoot.rotation.y = Math.atan2(c.i - this.hesCell.i, c.j - this.hesCell.j);
    this.hesCell = { ...c };
  }

  _animate(dt) {
    const t = this.t, time = this.time || 0, beat = this.beat || 0.5;
    const phase = (time / beat) % 1;
    const p = this.progress;
    // saltelli tra una casella e l'altra
    const hop = (from, to, k, root) => { root.position.lerpVectors(from, to, Math.min(1, k)); root.position.y = Math.sin(Math.min(1, k) * Math.PI) * 0.35; };
    this.heroHop += dt / (beat * 0.45); hop(this.heroFrom, this.heroTo, this.heroHop, this.heroRoot);
    this.hesHop += dt / (beat * 0.45); hop(this.hesFrom, this.hesTo, this.hesHop, this.hesRoot);
    const dance = (rig, ph) => rig && rig.rig && rig.rig.apply({
      ...locomotionPose({ phase: ph * Math.PI * 2, run: 0.25 }),
      armL: { x: -1.2 + Math.sin(ph * Math.PI * 2) * 0.4, z: 0.6 }, armR: { x: -1.2 - Math.sin(ph * Math.PI * 2) * 0.4, z: -0.6 },
      head: { x: Math.abs(Math.sin(ph * Math.PI)) * 0.15 }
    });
    dance(this.heroRig, phase);
    dance(this.hesRig, phase + 0.25);
    // piastrelle che pulsano sul battito; note che girano
    this.tiles.material.emissiveIntensity = 0.15 + (1 - phase) * 0.35 + p * 0.2;
    for (const n of this.notes) if (!n.taken) { n.mesh.rotation.y += dt * 3; n.mesh.position.y = 0.7 + Math.sin(t * 3 + n.i) * 0.12; }
    // la notte si deforma: fasci che si allungano e girano, stelle che scivolano
    for (const b of this.beams) {
      b.cone.scale.set(1 + p * 0.6, 1 + p * 2.2, 1 + p * 0.6);
      b.cone.position.set(Math.cos(b.a + t * 0.2 * (1 + p * 2)) * 7, 6 - p * 3, Math.sin(b.a + t * 0.2 * (1 + p * 2)) * 7);
      b.cone.material.opacity = 0.08 + p * 0.12 + (1 - phase) * 0.05;
    }
    this.stars.rotation.y += dt * (0.02 + p * 0.25);
    this._placeCamera(dt);
  }

  _placeCamera(dt) {
    const p = this.progress || 0;
    const target = this.heroRoot.position;
    _v.set(target.x * 0.6, 9.5 - p * 1.5, target.z + 9.5);
    const k = dt >= 1 ? 1 : Math.min(1, dt * 3);
    this.camera.position.lerp(_v, k);
    this.camera.lookAt(target.x * 0.8, 0.5, target.z - 1.5);
    // prospettiva che ondeggia, sempre di più
    this.camera.rotation.z += Math.sin(this.t * 0.9) * 0.05 * p;
    const fov = 50 + Math.sin(this.t * 1.3) * 7 * p;
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
  }

  resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }

  pause(on) {
    if (this.state !== 'dance' && this.state !== 'intro') return;
    if (on) { this.pausedAt = this.time || 0; this.audio.stopSong(); }
    else { this.audio.playSong(this.song, this.pausedAt || 0); this.localTime = this.pausedAt || 0; }
  }

  hud() {
    const time = this.time || 0, beat = this.beat || 0.5;
    const dancing = this.state === 'dance' || this.state === 'intro';
    return {
      notice: this.notice,
      subtitle: this.emma.subtitle,
      coins: this.coins,
      beat: dancing ? { phase: (time / beat) % 1, window: this._window() / beat, feedback: this.feedback, count: this.state === 'intro' ? Math.max(1, 4 - Math.floor(time / beat)) : null } : null,
      notes: { taken: this.notesTaken, total: this.notes.length },
      distort: this.progress,
      fade: this.state === 'fade' ? { k: Math.min(1, this.stateT / this.level.fadeTime), color: '#fff4fa' } : null
    };
  }

  dispose() {
    this.audio.stopSong();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
  }
}
