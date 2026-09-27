import { Assets } from '../core/AssetLoader.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Temi: progressione di accordi (semitoni rispetto alla tonica), bpm, scala per l'arpeggio
const THEMES = {
  menu: { bpm: 96, root: 57, chords: [[0, 3, 7, 10], [5, 8, 12, 15], [-2, 2, 5, 9], [3, 7, 10, 14]], lead: 'soft', drums: 'light' },
  omega: { bpm: 132, root: 52, chords: [[0, 3, 7, 10], [0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 8]], lead: 'saw', drums: 'drive' },
  canair: { bpm: 116, root: 60, chords: [[0, 4, 7, 11], [5, 9, 12, 16], [2, 5, 9, 12], [7, 11, 14, 17]], lead: 'pluck', drums: 'bounce' },
  // Niaboc di notte: più lento e più cupo di Omega, minore con la sesta bemolle
  niaboc: { bpm: 104, root: 50, chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-7, -4, 0, 3], [-5, -2, 2, 5]], lead: 'saw', drums: 'bounce' },
  // Retah: tramonto sul lago, maggiore settima come Canair ma rilassato
  retah: { bpm: 92, root: 58, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [5, 9, 12, 16], [2, 5, 9, 12]], lead: 'pluck', drums: 'light' },
  results: { bpm: 104, root: 57, chords: [[0, 4, 7, 11], [5, 9, 12, 16], [-3, 0, 4, 7], [2, 5, 9, 12]], lead: 'soft', drums: 'light' }
};

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.voiceGain = null;
    this.engineGain = null;
    this.volumes = { music: 0.6, sfx: 0.8, voice: 1 };
    this.voices = {};
    this.theme = null;
    this.playingTheme = null;
    this._next = 0;
    this._step = 0;
    this.engine = null;
  }

  async init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.voiceGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.voiceGain.connect(this.master);
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.5;
    this.engineGain.connect(this.sfxGain);
    this.setVolumes(this.volumes);
    const comp = this.ctx.createDynamicsCompressor();
    this.master.disconnect();
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    // voci di Emma
    const names = ['welcome', 'start', 'lastlap', 'hit', 'hitother', 'win'];
    await Promise.all(names.map(async (n) => { this.voices[n] = await Assets.audioBuffer(this.ctx, `assets/audio/voice/${n}.wav`); }));
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolumes(v) {
    Object.assign(this.volumes, v);
    if (!this.ctx) return;
    this.musicGain.gain.value = this.volumes.music * 0.5;
    this.sfxGain.gain.value = this.volumes.sfx;
    this.voiceGain.gain.value = this.volumes.voice;
  }

  voice(name, { duckMusic = true } = {}) {
    const b = this.voices[name];
    if (!b || !this.ctx) return false;
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    s.connect(this.voiceGain);
    s.start();
    if (duckMusic) {
      const g = this.musicGain.gain;
      const now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(this.volumes.music * 0.18, now, 0.05);
      g.setTargetAtTime(this.volumes.music * 0.5, now + b.duration, 0.4);
    }
    return true;
  }

  // ---- musica ----
  playTheme(name) {
    if (!this.ctx) return;
    if (this.playingTheme === name) return;
    this.playingTheme = name;
    this.theme = THEMES[name] || THEMES.menu;
    this._step = 0;
    this._next = this.ctx.currentTime + 0.05;
    if (!this._timer) this._timer = setInterval(() => this._schedule(), 60);
  }

  stopMusic() {
    this.playingTheme = null;
    this.theme = null;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  _schedule() {
    if (!this.theme || !this.ctx) return;
    const ctx = this.ctx;
    const spb = 60 / this.theme.bpm / 4; // sedicesimi
    while (this._next < ctx.currentTime + 0.25) {
      this._playStep(this._step, this._next, spb);
      this._next += spb;
      this._step++;
    }
  }

  _osc(type, freq, t, dur, gain, dest, { attack = 0.01, release = 0.08, detune = 0 } = {}) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.setValueAtTime(gain, Math.max(t + attack, t + dur - release));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise(t, dur, gain, dest, hp = 6000) {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    s.connect(f);
    f.connect(g);
    g.connect(dest);
    s.start(t);
  }

  _playStep(step, t, spb) {
    const th = this.theme, dest = this.musicGain;
    const bar = Math.floor(step / 16) % th.chords.length;
    const chord = th.chords[bar];
    const s16 = step % 16;
    const root = th.root;
    // basso
    const bassPattern = th.drums === 'drive' ? [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1] : [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0];
    if (bassPattern[s16]) {
      const n = root - 12 + chord[0] + (s16 === 15 ? 7 : 0);
      this._osc(th.lead === 'saw' ? 'sawtooth' : 'triangle', NOTE(n), t, spb * 0.9, 0.22, dest, { release: 0.05 });
    }
    // pad accordi ogni battuta
    if (s16 === 0) {
      for (const c of chord) this._osc('triangle', NOTE(root + c), t, spb * 16, 0.05, dest, { attack: 0.3, release: 0.6 });
    }
    // arpeggio
    const arpOrder = [0, 1, 2, 3, 2, 1, 0, 3, 1, 2, 3, 0, 2, 3, 1, 2];
    if (th.lead !== 'soft' || s16 % 2 === 0) {
      const n = root + 12 + chord[arpOrder[s16]];
      const type = th.lead === 'saw' ? 'square' : th.lead === 'pluck' ? 'triangle' : 'sine';
      this._osc(type, NOTE(n), t, spb * (th.lead === 'pluck' ? 0.5 : 0.8), th.lead === 'soft' ? 0.06 : 0.08, dest, { release: 0.05, detune: 4 });
    }
    // batteria
    if (th.drums !== 'none') {
      const kick = th.drums === 'drive' ? [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] : th.drums === 'bounce' ? [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0] : [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
      const snare = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
      if (kick[s16]) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.connect(g); g.connect(dest);
        o.start(t); o.stop(t + 0.22);
      }
      if (snare[s16] && th.drums !== 'light') this._noise(t, 0.12, 0.25, dest, 1800);
      if (s16 % 2 === 0 || th.drums === 'drive') this._noise(t, 0.04, th.drums === 'light' ? 0.05 : 0.09, dest, 8000);
    }
  }

  // ---- effetti ----
  sfx(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, d = this.sfxGain;
    switch (name) {
      case 'select': this._osc('square', 880, t, 0.06, 0.15, d); this._osc('square', 1320, t + 0.06, 0.08, 0.15, d); break;
      case 'back': this._osc('square', 660, t, 0.06, 0.12, d); this._osc('square', 440, t + 0.06, 0.1, 0.12, d); break;
      case 'move': this._osc('triangle', 520, t, 0.05, 0.12, d); break;
      case 'beep': this._osc('square', 440, t, 0.18, 0.25, d); break;
      case 'go': this._osc('square', 880, t, 0.5, 0.3, d); break;
      case 'pickup': [660, 880, 1100, 1320].forEach((f, i) => this._osc('sine', f, t + i * 0.05, 0.08, 0.2, d)); break;
      case 'boost': this.boost(); break;
      case 'drift1': this._osc('sine', 880, t, 0.1, 0.2, d); break;
      case 'drift2': this._osc('sine', 1320, t, 0.12, 0.25, d); this._osc('sine', 1760, t + 0.06, 0.12, 0.2, d); break;
      case 'hit': this._noise(t, 0.35, 0.5, d, 400); this._osc('sawtooth', 120, t, 0.35, 0.3, d); break;
      case 'shoot': this._noise(t, 0.2, 0.3, d, 3000); this._osc('sawtooth', 600, t, 0.2, 0.15, d); break;
      case 'flash': this._osc('sine', 2200, t, 0.5, 0.25, d, { attack: 0.005, release: 0.4 }); break;
      case 'lap': [523, 659, 784].forEach((f, i) => this._osc('triangle', f, t + i * 0.09, 0.14, 0.22, d)); break;
      case 'finish': [523, 659, 784, 1046].forEach((f, i) => this._osc('triangle', f, t + i * 0.12, 0.4, 0.25, d)); break;
      case 'wall': this._noise(t, 0.15, 0.3, d, 800); break;
    }
  }

  /**
   * Boost: "whoosh" con un accenno di synth. Glissando veloce verso l'alto (triangoli + sub
   * sinusoidale, un filo di dente di sega filtrato per l'energia), soffio d'aria in passa-banda
   * che sale insieme al pitch e rilascio morbido. `power` scala durata e intensità:
   * pad ~0.8, mini-turbo blu ~0.9, arancione ~1.15, turbo da oggetto ~1.1.
   */
  boost(power = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = 0.55 + power * 0.25; // durata totale, rilascio compreso
    const sweep = 0.13; // salita principale del pitch
    const f0 = 85, f1 = 300 + power * 60;
    const out = ctx.createGain();
    const peak = 0.2 * Math.min(1.25, power);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(peak, t + 0.025);
    out.gain.setValueAtTime(peak, t + sweep);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    out.connect(this.sfxGain);
    const stopAt = t + dur + 0.05;

    // corpo: due triangoli leggermente scordati (più largo) e un sub sinusoidale un'ottava sotto
    const pitch = (o, mul) => {
      o.frequency.setValueAtTime(f0 * mul, t);
      o.frequency.exponentialRampToValueAtTime(f1 * mul, t + sweep);
      o.frequency.exponentialRampToValueAtTime(f1 * mul * 1.18, t + dur); // continua a salire piano
    };
    const body = ctx.createGain();
    body.gain.value = 0.55;
    body.connect(out);
    for (const [type, mul, detune, g] of [['triangle', 1, -7, 0.5], ['triangle', 1, 7, 0.5], ['sine', 0.5, 0, 0.7]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.detune.value = detune;
      pitch(o, mul);
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og); og.connect(body);
      o.start(t); o.stop(stopAt);
    }
    // energia: dente di sega un'ottava sopra, poco e dietro un passa-basso che si apre e si richiude
    const edge = ctx.createOscillator();
    edge.type = 'sawtooth';
    pitch(edge, 2);
    const edgeF = ctx.createBiquadFilter();
    edgeF.type = 'lowpass';
    edgeF.Q.value = 2;
    edgeF.frequency.setValueAtTime(500, t);
    edgeF.frequency.exponentialRampToValueAtTime(2400, t + sweep);
    edgeF.frequency.exponentialRampToValueAtTime(700, t + dur);
    const edgeG = ctx.createGain();
    edgeG.gain.value = 0.08;
    edge.connect(edgeF); edgeF.connect(edgeG); edgeG.connect(out);
    edge.start(t); edge.stop(stopAt);

    // aria: rumore in passa-banda che sale col pitch e poi si allarga, come vento che ti supera
    const len = Math.floor(ctx.sampleRate * (dur + 0.05));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(350, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + sweep * 1.2);
    bp.frequency.exponentialRampToValueAtTime(1100, t + dur);
    const air = ctx.createGain();
    air.gain.setValueAtTime(0.0001, t);
    air.gain.exponentialRampToValueAtTime(0.5, t + 0.06);
    air.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    noise.connect(bp); bp.connect(air); air.connect(out);
    noise.start(t); noise.stop(stopAt);
  }

  // Motore: triangolo + sub sinusoidale, lowpass chiuso. Passa da engineGain → sfxGain,
  // quindi lo slider "Effetti" lo regola (a zero lo spegne).
  startEngine() {
    if (!this.ctx || this.engine) return;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    const o2 = this.ctx.createOscillator();
    o2.type = 'sine';
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 220;
    f.Q.value = 0.5;
    const g = this.ctx.createGain();
    g.gain.value = 0.0;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.engineGain);
    o.start(); o2.start();
    this.engine = { o, o2, f, g };
  }

  updateEngine(speedRatio, boosting) {
    if (!this.engine) return;
    const e = this.engine, t = this.ctx.currentTime;
    const base = 50 + speedRatio * 110 + (boosting ? 25 : 0);
    e.o.frequency.setTargetAtTime(base, t, 0.12);
    e.o2.frequency.setTargetAtTime(base * 0.5, t, 0.12);
    e.f.frequency.setTargetAtTime(180 + speedRatio * 420, t, 0.15);
    e.g.gain.setTargetAtTime(0.012 + speedRatio * 0.018, t, 0.15);
  }

  stopEngine() {
    if (!this.engine) return;
    const e = this.engine;
    e.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    setTimeout(() => { try { e.o.stop(); e.o2.stop(); } catch {} }, 400);
    this.engine = null;
  }
}
