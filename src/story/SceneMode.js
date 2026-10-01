import * as THREE from 'three';
import { Assets } from '../core/AssetLoader.js';
import { buildSong } from '../audio/AudioEngine.js';
import { loadRigged, riggedUrl, locomotionPose } from './Rig.js';
import { attachGuitar } from './hero.js';
import { EmmaVoice } from './emma.js';
import { buildRoom, muralOnWall, place, std } from './rooms.js';

// Livello "di scena" della Storia (il primo è il Red Fox, story/redfox.js): poco gioco, molta atmosfera.
// Whiskey entra nel locale, Hes canta sul palco (momento musicale da ascoltare, la telecamera è su di lei),
// poi dialogo al bancone a scorrimento, e la divisione della Lommy: lo schermo si distorce e si passa dritti al
// livello dopo (next), senza schermata di "livello completato". Stessa interfaccia degli altri livelli.

export class SceneMode {
  constructor({ level, character, audio, onComplete }) {
    this.level = level;
    this.character = character;
    this.audio = audio;
    this.onComplete = onComplete;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.3, 200);
    this.t = 0;
    this.state = 'enter'; // enter | song | dialogue | lommy | ended
    this.stateT = 0;
    this.notice = null;
    this.noticeTimer = 0;
    this.dialogue = null;
  }

  async load(progress = () => {}) {
    const L = this.level, M = L.models;
    progress(L.loadingText || 'Accendo le luci rosse…');
    const [hero, hes, counter, stool] = await Promise.all([
      loadRigged(riggedUrl(this.character), 1.8),
      loadRigged(M.hes.url, M.hes.h),
      Assets.model(M.counter.url, { targetHeight: M.counter.h }),
      Assets.model(M.stool.url, { targetHeight: M.stool.h })
    ]);
    const S = this.scene;
    S.background = new THREE.Color('#140608');
    S.add(new THREE.HemisphereLight(0xffc8b0, 0x2a0a0a, 0.6));
    const key = new THREE.DirectionalLight(0xffb090, 0.9);
    key.position.set(-3, 9, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera; sc.left = sc.bottom = -10; sc.right = sc.top = 10;
    S.add(key);
    buildRoom(S, { floor: '#3a1a14', plank: '#2a100c', wall: '#5a1418', trim: '#c9a040', back: -3.6 });
    await muralOnWall(S, L.background, { x: -2.2, z: -3.58, h: 3.0 });
    // insegna al neon rossa
    const neon = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x110808, emissive: 0xff3a3a, emissiveIntensity: 2.8 }));
    neon.position.set(3.6, 3.9, -3.5);
    S.add(neon);
    // bancone con gli sgabelli a sinistra
    place(S, counter, [2, 1.1, 0.6], -3.4, 0, -1.2, 0);
    place(S, counter, [2, 1.1, 0.6], -1.3, 0, -1.2, 0);
    for (const x of [-4.2, -3.0, -1.8, -0.6]) place(S, stool, [0.5, 0.8, 0.5], x, 0, -0.2, 0, '#8a2a2a');
    for (const x of [-3.4, -1.3]) {
      const l = new THREE.PointLight(0xffa060, 8, 6, 1.7);
      l.position.set(x, 2.8, -0.8);
      S.add(l);
    }
    // il palco a destra, con il faro rosso su Hes
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 3), std('#2a1210', { roughness: 0.6 }));
    deck.position.set(3.6, 0.25, -2.0);
    deck.castShadow = deck.receiveShadow = true;
    S.add(deck);
    const stageSpot = new THREE.SpotLight(0xff6a5a, 90, 14, 0.35, 0.5, 1.2);
    stageSpot.position.set(3.0, 6, 2);
    stageSpot.target.position.set(3.6, 0.5, -2.0);
    S.add(stageSpot, stageSpot.target);
    // Hes sul palco, con il microfono
    this.hes = hes;
    this.hesRoot = new THREE.Group();
    if (hes) this.hesRoot.add(hes.root);
    else { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 6, 10), std('#c0392b')); b.position.y = 0.9; this.hesRoot.add(b); }
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.25, 8), std('#2a2a30', { metalness: 0.7 }));
    mic.position.set(-0.12, 1.5, 0.28);
    mic.rotation.x = 0.6;
    this.hesRoot.add(mic);
    this.mic = mic;
    this.hesRoot.position.set(3.6, 0.5, -2.1);
    this.hesRoot.rotation.y = -0.35;
    this.hesRoot.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    S.add(this.hesRoot);
    // Whiskey entra dalla sinistra e va al bancone
    this.hero = hero;
    this.heroRoot = new THREE.Group();
    if (hero) this.heroRoot.add(hero.root);
    if (this.character.guitar) await attachGuitar(this.heroRoot);
    this.heroRoot.position.set(-8, 0, 1.6);
    this.heroRoot.rotation.y = Math.PI / 2;
    S.add(this.heroRoot);
    this.walk = 0;
    // inquadrature: d'insieme, sul palco, al bancone
    this.shots = {
      wide: { pos: new THREE.Vector3(0, 2.6, 8.5), look: new THREE.Vector3(0, 1.3, -1) },
      stage: { pos: new THREE.Vector3(1.8, 2.1, 3.0), look: new THREE.Vector3(3.6, 1.6, -2.0) },
      bar: { pos: new THREE.Vector3(-0.6, 1.9, 3.8), look: new THREE.Vector3(-2.2, 1.2, 0.0) }
    };
    this.shot = 'wide';
    this.camera.position.copy(this.shots.wide.pos);
    this.camera.lookAt(this.shots.wide.look);
    this.camLook = this.shots.wide.look.clone();
    this.emma = new EmmaVoice(this.audio, L.voices);
    await this.emma.load();
    this.song = buildSong(L.song);
    progress('Pronti.');
  }

  say(text, time = 2.4) { this.notice = text; this.noticeTimer = time; }

  update(dt, input) {
    this.t += dt;
    this.stateT += dt;
    this.emma.update(dt);
    this.noticeTimer = Math.max(0, this.noticeTimer - dt);
    if (this.noticeTimer <= 0) this.notice = null;
    const pressed = input.lanePressed.some(Boolean) || input.jumpPressed || input.attackPressed || input.itemPressed;
    for (let i = 0; i < 4; i++) input.lanePressed[i] = false;
    input.jumpPressed = input.itemPressed = input.attackPressed = input.upPressed = false;
    const L = this.level;

    if (this.state === 'enter') {
      if (this.stateT < dt * 1.5) this.emma.say('arrivo', { important: true });
      // Whiskey cammina fino al bancone
      const to = new THREE.Vector3(-2.4, 0, 0.7);
      const p = this.heroRoot.position;
      const d = p.distanceTo(to);
      if (d > 0.05) { p.lerp(to, Math.min(1, (2.2 * dt) / d)); this.walk += dt * 6; }
      if (this.stateT > 4.5) { this.state = 'song'; this.stateT = 0; this.shot = 'stage'; this.audio.playSong(this.song, 0); this.say('Hes canta…', 3); }
    } else if (this.state === 'song') {
      const st = this.audio.songTime ? this.audio.songTime() : null;
      const time = st ?? this.stateT;
      // momento d'ascolto: niente da premere (un tasto lo accorcia, dopo qualche secondo)
      if (time > this.song.duration || (pressed && this.stateT > 5)) {
        this.audio.stopSong();
        this.audio.sfx('applause');
        this.state = 'dialogue'; this.stateT = 0; this.shot = 'bar';
        // Hes scende dal palco e raggiunge Whiskey al bancone
        this.hesRoot.position.set(-1.4, 0, 0.6);
        this.hesRoot.rotation.y = -1.2;
        this.mic.visible = false;
        this.line = -1;
        this._nextLine();
      }
    } else if (this.state === 'dialogue') {
      const ln = L.lines[this.line];
      const auto = Math.max(3.5, ln.text.length / 14);
      if ((pressed && this.stateT > 0.6) || this.stateT > auto) this._nextLine();
    } else if (this.state === 'lommy') {
      if (this.stateT > L.lommyTime) {
        this.state = 'ended';
        this.onComplete && this.onComplete({ next: L.next });
      }
    }
    this._animate(dt);
  }

  _nextLine() {
    const lines = this.level.lines;
    this.line++;
    this.stateT = 0;
    if (this.line >= lines.length) {
      // la divisione della Lommy: lo schermo si distorce, e si va dritti al locale da ballo
      this.dialogue = null;
      this.state = 'lommy';
      this.emma.clear();
      this.emma.say('lommy', { important: true });
      this.audio.sfx('whoosh');
      this.audio.sfx('beam');
      return;
    }
    const ln = lines[this.line];
    this.dialogue = { name: ln.who, text: ln.text };
    this.audio.sfx('move');
  }

  _animate(dt) {
    const t = this.t;
    if (this.hero && this.hero.rig) {
      const walking = this.state === 'enter' && this.stateT < 4.2;
      this.hero.rig.apply(walking ? locomotionPose({ phase: this.walk, run: 0.3 }) : { spine: { x: 0.04 + Math.sin(t * 1.4) * 0.02 }, head: { y: this.state === 'song' ? 0.5 : 0.2 } });
    }
    if (!(this.state === 'enter' && this.stateT < 4.2)) this.heroRoot.rotation.y = THREE.MathUtils.damp(this.heroRoot.rotation.y, this.state === 'song' ? 0.6 : 1.2, 3, dt);
    if (this.hes && this.hes.rig) {
      const singing = this.state === 'song' || this.state === 'enter';
      this.hes.rig.apply(singing ? {
        armR: { x: -2.1, z: -0.35 }, foreArmR: { x: -1.6 },
        armL: { x: -0.6 + Math.sin(t * 1.5) * 0.3, z: 0.5 }, foreArmL: { x: -0.6 },
        spine: { y: Math.sin(t * 1.2) * 0.15, x: 0.05 }, head: { x: -0.1 + Math.sin(t * 2.4) * 0.05 }
      } : { spine: { x: 0.03 }, head: { y: 0.3 }, armL: { x: -0.3, z: 0.2 } });
    }
    // telecamera: si sposta morbida tra un'inquadratura e l'altra
    const S = this.shots[this.shot];
    const k = Math.min(1, dt * 2);
    this.camera.position.lerp(S.pos, k);
    this.camLook.lerp(S.look, k);
    this.camera.lookAt(this.camLook);
    if (this.state === 'lommy') {
      const q = Math.min(1, this.stateT / this.level.lommyTime);
      this.camera.rotation.z += Math.sin(t * 7) * 0.08 * q;
      this.camera.fov = 45 + Math.sin(t * 5) * 12 * q;
      this.camera.updateProjectionMatrix();
    }
  }

  resize(aspect) { this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); }

  pause(on) {
    if (this.state !== 'song') return;
    if (on) { this.pausedAt = this.audio.songTime ? this.audio.songTime() : null; this.audio.stopSong(); }
    else if (this.pausedAt !== null && this.pausedAt !== undefined) this.audio.playSong(this.song, this.pausedAt);
  }

  hud() {
    return {
      notice: this.notice,
      subtitle: this.emma.subtitle,
      dialogue: this.state === 'dialogue' ? this.dialogue : null,
      fx: this.state === 'lommy' ? { kind: 'lommy', k: Math.min(1, this.stateT / this.level.lommyTime) } : null
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
