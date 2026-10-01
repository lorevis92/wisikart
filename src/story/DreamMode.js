import { StoryMode } from './StoryMode.js';
import { FlightMode } from './FlightMode.js';
import { loadRigged } from './Rig.js';
import { EmmaVoice } from './emma.js';

// Il giorno dopo (story/sogno.js): un livello fatto di pezzi. La camera di Whiskey (StoryMode), dove prendere la
// Lommy apre una visione; la battaglia eroica (FlightMode, palette eterea); Sunday e il funerale (StoryMode);
// infine il risveglio. Tra un pezzo e l'altro una dissolvenza. Per main.js è un livello come gli altri: scena e
// telecamera sono quelle del pezzo in corso.

export class DreamMode {
  constructor(opts) {
    this.opts = opts;
    this.level = opts.level;
    this.audio = opts.audio;
    this.onComplete = opts.onComplete;
    this.t = 0;
    this.stepIndex = 0;
    this.trans = null; // dissolvenza in corso: { t, half, switched }
    this.caption = null;
    this.state = 'play';
  }

  get scene() { return this.cur.scene; }
  get camera() { return this.cur.camera; }

  async load(progress = () => {}) {
    const L = this.level, o = this.opts;
    progress(L.loadingText || 'Chiudo le tende…');
    const sunday = await loadRigged(L.sundayModel.url, L.sundayModel.h);
    const walk = (level) => new StoryMode({ ...o, level, onComplete: () => this._next(), onGameOver: () => {} });
    this.parts = {
      room: walk(L.room),
      battle: new FlightMode({ level: L.battle, audio: this.audio, onComplete: () => this._next() }),
      sunday: walk({ ...L.sunday, rigs: { sunday } }),
      funeral: walk(L.funeral)
    };
    // nella camera, prendere la Lommy apre la visione
    this.parts.room.onEvent = (e) => { if (e === 'lommy') this._next(); };
    progress('La camera…');
    await this.parts.room.load();
    progress('La battaglia…');
    await this.parts.battle.load();
    progress('Le nuvole…');
    await this.parts.sunday.load();
    progress('Il funerale…');
    await this.parts.funeral.load();
    this.cur = this.parts.room;
    this.emma = new EmmaVoice(this.audio, L.voices);
    await this.emma.load();
    progress('Pronti.');
  }

  get step() { return this.level.steps[this.stepIndex]; }

  /** Fine del pezzo in corso: dissolvenza e il pezzo dopo. */
  _next() {
    if (this.trans) return;
    this.trans = { t: 0, half: 0.9, switched: false };
    this.audio.sfx('whoosh');
  }

  _enter(step) {
    const L = this.level;
    if (step === 'room') {
      // di nuovo in camera: la Lommy torna sul comodino
      const r = this.parts.room;
      r._respawn(true);
      if (r.lommy) r.lommy.reset();
      this.cur = r;
      this.audio.playTheme(L.room.music);
    } else if (step === 'battle') {
      this.cur = this.parts.battle;
      this.cur.restart(true);
      this.audio.playTheme(L.battle.music);
    } else if (step === 'sunday' || step === 'funeral') {
      this.cur = this.parts[step];
      this.audio.playTheme(L[step].music);
    } else if (step === 'wake') {
      // il risveglio: la camera buia e due righe, poi Canair
      this.cur = this.parts.room;
      this.parts.room._respawn(true);
      this.state = 'wake';
      this.wakeT = 0;
      this.audio.stopMusic();
    }
    this.resize(this.aspect || 16 / 9);
  }

  update(dt, input) {
    this.t += dt;
    this.emma.update(dt);
    if (!this.saidIntro) { this.saidIntro = true; this.emma.say('arrivo', { important: true }); }
    if (this.trans) {
      const T = this.trans;
      T.t += dt;
      if (!T.switched && T.t >= T.half) { T.switched = true; this.stepIndex++; this._enter(this.step); }
      if (T.t >= T.half * 2) this.trans = null;
      input.jumpPressed = input.itemPressed = input.attackPressed = input.upPressed = false;
      return;
    }
    if (this.state === 'wake') {
      this.wakeT += dt;
      const lines = this.level.wake;
      const i = Math.min(lines.length - 1, Math.floor(this.wakeT / 2.4));
      this.caption = lines[i];
      if (this.wakeT > lines.length * 2.4 + 0.8) { this.state = 'ended'; this.caption = null; this.onComplete && this.onComplete(null); }
      return;
    }
    if (this.state !== 'play') return;
    this.cur.update(dt, input);
  }

  resize(aspect) {
    this.aspect = aspect;
    if (!this.parts) return;
    for (const p of Object.values(this.parts)) p.resize(aspect);
  }

  pause(on) { if (this.cur && this.cur.pause) this.cur.pause(on); }

  hud() {
    const h = this.cur ? this.cur.hud() : {};
    const T = this.trans;
    // dissolvenza a bianco-lilla tra un pezzo e l'altro; nero lento al risveglio
    const fade = T ? { k: T.t < T.half ? T.t / T.half : 1 - (T.t - T.half) / T.half, color: '#f4eeff' }
      : this.state === 'wake' ? { k: Math.max(0, 0.75 - this.wakeT * 0.05), color: '#000000' } : null;
    return {
      ...h,
      coins: undefined,
      fade,
      caption: this.caption,
      subtitle: this.emma.subtitle || h.subtitle
    };
  }

  dispose() {
    if (!this.parts) return;
    for (const p of Object.values(this.parts)) p.dispose();
  }
}
