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
  // Storia: stadio allegro e saltellante, boss minore e incalzante
  stadio: { bpm: 120, root: 55, chords: [[0, 4, 7, 11], [7, 11, 14, 17], [9, 12, 16, 19], [5, 9, 12, 16]], lead: 'pluck', drums: 'bounce' },
  boss: { bpm: 138, root: 50, chords: [[0, 3, 7, 10], [-2, 2, 5, 9], [-4, 0, 3, 7], [-5, -1, 2, 5]], lead: 'saw', drums: 'drive' },
  // Livelli di volo: veloce, notturno, energico (negli ultimi 10 secondi il tempo accelera, vedi setTempo)
  volo: { bpm: 144, root: 49, chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9], [-5, -2, 2, 5]], lead: 'saw', drums: 'drive' },
  // Deposito Valvo & Go: magazzino notturno, minore e meccanico; l'allarme dell'hangar corre e insiste
  valvo: { bpm: 108, root: 52, chords: [[0, 3, 7, 10], [0, 3, 7, 10], [-4, 0, 3, 7], [-2, 2, 5, 9]], lead: 'pluck', drums: 'drive' },
  allarme: { bpm: 152, root: 50, chords: [[0, 3, 7, 10], [1, 5, 8, 12], [0, 3, 7, 10], [-2, 1, 5, 8]], lead: 'saw', drums: 'drive' },
  // Rissa alla tavola calda: arcade, maggiore e di corsa (I – VII♭ – IV – V), onde quadre e cassa dritta
  rissa: { bpm: 152, root: 55, chords: [[0, 4, 7, 12], [-2, 2, 5, 10], [5, 9, 12, 17], [7, 11, 14, 19]], lead: 'saw', drums: 'drive' },
  results: { bpm: 104, root: 57, chords: [[0, 4, 7, 11], [5, 9, 12, 16], [-3, 0, 4, 7], [2, 5, 9, 12]], lead: 'soft', drums: 'light' }
};

// ---------------------------------------------------------------------------------------------------------
// Brani dei livelli ritmici (Canair): generati dal motore come i temi, ma note per nota. buildSong() produce
// UNA lista di eventi (chitarra, basso, accordi, batteria) con i tempi esatti in secondi: la stessa lista la
// suona playSong() e da quella stessa lista (le note della chitarra) nasce la mappa del minigioco. Così le note
// da premere cadono esattamente dove si sentono. Accordi in semitoni sulla tonica; ogni sezione ha battute,
// giro di accordi (uno per battuta), densità della melodia (1 rada … 3 fitta), probabilità di note tenute
// (hold) e batteria; il seme (seed) è scelto perché le note si distribuiscano su tutte e quattro le corsie e
// l'esibizione cresca davvero da una sezione all'altra. Il motivo si ripete ogni due battute sugli accordi del momento (per questo "resta in testa").
export const SONGS = {
  prova1: {
    title: 'Prova 1 · Corde nuove', bpm: 92, root: 57, seed: 1,
    sections: [{ name: 'Corde nuove', bars: 12, chords: [[0, 4, 7, 12], [5, 9, 12, 17], [7, 11, 14, 19], [5, 9, 12, 17]], density: 1, hold: 0, drums: 'light' }]
  },
  prova2: {
    title: 'Prova 2 · Il manico veloce', bpm: 104, root: 55, seed: 4,
    sections: [{ name: 'Il manico veloce', bars: 14, chords: [[0, 4, 7, 12], [-3, 0, 4, 9], [5, 9, 12, 17], [7, 11, 14, 19]], density: 2, hold: 0.08, drums: 'bounce' }]
  },
  prova3: {
    title: 'Prova 3 · Accordi tenuti', bpm: 110, root: 52, seed: 2,
    sections: [{ name: 'Accordi tenuti', bars: 16, chords: [[0, 3, 7, 12], [-4, 0, 3, 8], [3, 7, 10, 15], [-2, 2, 5, 10]], density: 2.6, hold: 0.32, drums: 'drive' }]
  },
  // l'esibizione al piazzale: tre sezioni in crescendo, l'ultima è "Love u mamma" (pop-rock, I–V–vi–IV)
  esibizione: {
    title: 'Tramonto a tripla stella', bpm: 116, root: 50, seed: 1,
    sections: [
      { name: 'Primo sole', bars: 12, chords: [[0, 4, 7, 12], [-3, 0, 4, 9], [5, 9, 12, 17], [7, 11, 14, 19]], density: 1.4, hold: 0.15, drums: 'light' },
      { name: 'Secondo sole', bars: 14, chords: [[-3, 0, 4, 9], [5, 9, 12, 17], [0, 4, 7, 12], [7, 11, 14, 19]], density: 2.2, hold: 0.18, drums: 'bounce' },
      { name: 'Love u mamma', bars: 20, chords: [[0, 4, 7, 12], [7, 11, 14, 19], [9, 12, 16, 21], [5, 9, 12, 17]], density: 3, hold: 0.14, drums: 'drive', hook: true }
    ]
  }
};

/** Generatore pseudo-casuale con seme: lo stesso brano esce sempre uguale (musica e note). */
function seeded(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 16807) % 2147483647; return (s % 100000) / 100000; };
}

/**
 * Costruisce un brano (o una sola sezione, per l'esibizione): { title, bpm, beat, duration, notes, events }.
 * notes = [{ t, lane (0-3), dur }] in secondi (dur > 0 = nota tenuta), ricavate dalle note della chitarra;
 * events = tutto quello che si suona, compresi 4 colpi di conteggio prima dell'attacco.
 */
export function buildSong(name, sectionIndex = null) {
  const S = SONGS[name];
  const beat = 60 / S.bpm, step = beat / 2; // passo: ottavi
  const sections = sectionIndex === null ? S.sections : [S.sections[sectionIndex]];
  const rnd = seeded(S.seed + (sectionIndex || 0) * 7);
  const events = [], notes = [];
  let t = 4 * beat; // conteggio: quattro colpi, poi si parte
  for (let i = 0; i < 4; i++) events.push({ type: 'click', t: i * beat, accent: i === 0 });
  for (const sec of sections) {
    // motivo di due battute (16 ottavi): posizioni, nota dell'accordo (= corsia), durata in ottavi
    const makeMotif = () => {
      const cand = [];
      for (let p = 0; p < 16; p++) {
        const onBeat = p % 2 === 0, strong = p % 4 === 0;
        const keep = sec.density >= 2.5 ? (onBeat ? 0.85 : 0.45) : sec.density >= 1.8 ? (onBeat ? 0.78 : 0.12) : (strong ? 0.8 : onBeat ? 0.25 : 0);
        if (p === 0 || rnd() < keep) cand.push(p);
      }
      const motif = [];
      let tone = Math.floor(rnd() * 4);
      for (let k = 0; k < cand.length; k++) {
        const p = cand[k];
        if (motif.length && p < motif[motif.length - 1].p + motif[motif.length - 1].len) continue; // niente sovrapposizioni
        tone = (tone + (rnd() < 0.5 ? 3 : 1) * (rnd() < 0.3 ? 2 : 1)) % 4; // la melodia gira sulle quattro note dell'accordo (= corsie)
        let len = 1;
        if (p % 4 === 0 && rnd() < sec.hold) len = rnd() < 0.7 ? 4 : 6; // nota tenuta (sui battiti forti): due o tre battiti
        len = Math.min(len, 16 - p);
        motif.push({ p, tone, len });
      }
      return motif;
    };
    const motif = makeMotif();
    const fill = makeMotif(); // variazione ogni quattro coppie di battute (non nel ritornello)
    for (let bar = 0; bar < sec.bars; bar++) {
      const chord = sec.chords[bar % sec.chords.length];
      const bt = t + bar * 4 * beat;
      // accordo tenuto e basso
      events.push({ type: 'pad', t: bt, chord: chord.map((c) => S.root + c), dur: 4 * beat });
      for (let b = 0; b < 4; b++) {
        const drive = sec.drums === 'drive';
        events.push({ type: 'bass', t: bt + b * beat, midi: S.root - 12 + chord[0] + (b === 3 && bar % 2 ? 7 : 0), dur: beat * 0.9 });
        if (drive) events.push({ type: 'bass', t: bt + b * beat + step, midi: S.root - 12 + chord[0], dur: step * 0.9 });
        // batteria: cassa, rullante sul 2 e sul 4, charleston
        if (b === 0 || (b === 2 && sec.drums !== 'light') || (drive && b % 1 === 0)) events.push({ type: 'kick', t: bt + b * beat });
        if ((b === 1 || b === 3) && sec.drums !== 'light') events.push({ type: 'snare', t: bt + b * beat });
        events.push({ type: 'hat', t: bt + b * beat, open: false });
        if (sec.drums !== 'light') events.push({ type: 'hat', t: bt + b * beat + step, open: b === 3 });
      }
      // melodia della chitarra: il motivo sugli accordi di questa battuta
      const pair = Math.floor(bar / 2), half = bar % 2;
      const src = !sec.hook && pair % 4 === 3 && half === 1 ? fill : motif;
      for (const n of src) {
        if (Math.floor(n.p / 8) !== half) continue;
        const nt = bt + (n.p % 8) * step;
        const dur = n.len * step;
        const midi = S.root + 12 + chord[n.tone];
        events.push({ type: 'lead', t: nt, midi, dur: n.len > 1 ? dur : step * 0.9, held: n.len > 1 });
        notes.push({ t: nt, lane: n.tone, dur: n.len > 1 ? dur : 0 });
      }
    }
    t += sec.bars * 4 * beat;
    events.push({ type: 'crash', t });
  }
  events.sort((a, b) => a.t - b.t);
  notes.sort((a, b) => a.t - b.t);
  return { name, title: sectionIndex === null ? S.title : S.sections[sectionIndex].name, bpm: S.bpm, beat, duration: t + beat, notes, events };
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.voiceGain = null;
    this.engineGain = null;
    this.volumes = { music: 0.6, sfx: 0.8, voice: 1 };
    // interruttori per canale e silenzio generale (tasto M, icona dell'altoparlante)
    this.enabled = { music: true, sfx: true, voice: true };
    this.muted = false;
    this.activeVoices = new Set();
    this.voiceEpoch = 0; // cresce quando le voci vengono zittite: chi ha una coda di battute la svuota
    this.tempo = 1; // moltiplicatore del tempo della musica (il finale teso dei voli lo alza)
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

  /**
   * Impostazioni audio del gioco: volumi (music, sfx, voice), interruttori (musicOn, sfxOn, voiceOn) e
   * silenzio generale (muted). Spegnere la voce (o silenziare tutto) interrompe subito la battuta in corso.
   */
  setVolumes(v) {
    for (const k of ['music', 'sfx', 'voice']) {
      if (typeof v[k] === 'number') this.volumes[k] = v[k];
      if (typeof v[k + 'On'] === 'boolean') this.enabled[k] = v[k + 'On'];
    }
    if (typeof v.muted === 'boolean') this.muted = v.muted;
    if (!this.voiceOn()) this.stopVoices();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const [g, val] of [[this.musicGain, this._level('music') * 0.5], [this.sfxGain, this._level('sfx')], [this.voiceGain, this._level('voice')]]) {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(val, now);
    }
  }

  /** Volume effettivo di un canale (0 se spento o se è tutto silenziato). */
  _level(k) { return this.muted || !this.enabled[k] ? 0 : this.volumes[k]; }

  /** La voce di Emma si sente? (altrimenti restano solo i sottotitoli) */
  voiceOn() { return !this.muted && this.enabled.voice && this.volumes.voice > 0; }

  /** Zittisce le battute in corso e fa svuotare le code (vedi voiceEpoch). */
  stopVoices() {
    for (const s of this.activeVoices) { try { s.stop(); } catch {} }
    this.activeVoices.clear();
    this.voiceEpoch++;
    if (this.ctx) {
      const g = this.musicGain.gain, now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(this._level('music') * 0.5, now, 0.1);
    }
  }

  voice(name, opts) {
    return this.voiceBuffer(this.voices[name], opts);
  }

  /** Suona una voce già caricata (es. le battute di Emma nei livelli) abbassando la musica; ritorna la durata o 0. */
  voiceBuffer(b, { duckMusic = true } = {}) {
    if (!b || !this.ctx || !this.voiceOn()) return 0;
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    s.connect(this.voiceGain);
    s.start();
    this.activeVoices.add(s);
    s.onended = () => this.activeVoices.delete(s);
    if (duckMusic) {
      const g = this.musicGain.gain;
      const now = this.ctx.currentTime;
      const full = this._level('music') * 0.5;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(full * 0.36, now, 0.05);
      g.setTargetAtTime(full, now + b.duration, 0.4);
    }
    return b.duration;
  }

  // ---- brani dei livelli ritmici ----
  /** Suona un brano costruito con buildSong() a partire da `from` secondi (per riprendere dopo il menu). */
  playSong(song, from = 0) {
    if (!this.ctx) return;
    this.stopMusic();
    const idx = song.events.findIndex((e) => e.t >= from);
    this.song = { data: song, idx: idx < 0 ? song.events.length : idx, t0: this.ctx.currentTime + 0.12 - from };
    this._songTimer = setInterval(() => this._scheduleSong(), 40);
    this._scheduleSong();
  }

  /** Tempo del brano in corso, in secondi (null se non suona niente): il minigioco si sincronizza su questo. */
  songTime() { return this.song && this.ctx ? this.ctx.currentTime - this.song.t0 : null; }

  stopSong() {
    this.song = null;
    if (this._songTimer) { clearInterval(this._songTimer); this._songTimer = null; }
  }

  _scheduleSong() {
    const S = this.song;
    if (!S || !this.ctx) return;
    const ev = S.data.events, horizon = this.ctx.currentTime + 0.3;
    while (S.idx < ev.length && S.t0 + ev[S.idx].t < horizon) {
      const e = ev[S.idx++];
      const when = Math.max(this.ctx.currentTime, S.t0 + e.t);
      this._songEvent(e, when);
    }
  }

  /** Un evento del brano: chitarra (pizzicata o tenuta), basso, accordo, batteria, conteggio. */
  _songEvent(e, t) {
    const d = this.musicGain;
    switch (e.type) {
      case 'lead': {
        // "chitarra": dente di sega e triangolo in un passa-basso che si chiude (pizzico) o resta aperto (tenuta)
        const f = NOTE(e.midi), ctx = this.ctx;
        const out = ctx.createGain();
        out.gain.setValueAtTime(0.0001, t);
        out.gain.exponentialRampToValueAtTime(0.2, t + 0.008);
        out.gain.exponentialRampToValueAtTime(e.held ? 0.12 : 0.03, t + (e.held ? 0.25 : e.dur));
        if (e.held) out.gain.setValueAtTime(0.12, t + e.dur - 0.08);
        out.gain.exponentialRampToValueAtTime(0.0001, t + e.dur + 0.12);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(3200, t);
        lp.frequency.exponentialRampToValueAtTime(e.held ? 1400 : 700, t + 0.2);
        lp.connect(out); out.connect(d);
        for (const [type, mul, det] of [['sawtooth', 1, -5], ['sawtooth', 1, 5], ['triangle', 2, 0]]) {
          const o = ctx.createOscillator();
          o.type = type; o.frequency.value = f * mul; o.detune.value = det;
          o.connect(lp); o.start(t); o.stop(t + e.dur + 0.15);
        }
        break;
      }
      case 'bass': this._osc('triangle', NOTE(e.midi), t, e.dur, 0.24, d, { release: 0.05 }); break;
      case 'pad': for (const m of e.chord) this._osc('triangle', NOTE(m), t, e.dur, 0.04, d, { attack: 0.2, release: 0.4 }); break;
      case 'kick': {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.connect(g); g.connect(d); o.start(t); o.stop(t + 0.22);
        break;
      }
      case 'snare': this._noise(t, 0.14, 0.28, d, 1800); break;
      case 'hat': this._noise(t, e.open ? 0.12 : 0.04, 0.08, d, 8000); break;
      case 'crash': this._noise(t, 0.9, 0.18, d, 4000); break;
      case 'click': this._osc('square', e.accent ? 1320 : 990, t, 0.05, 0.12, this.sfxGain); break;
    }
  }

  // ---- musica ----
  playTheme(name) {
    if (!this.ctx) return;
    if (this.song) this.stopSong();
    if (this.playingTheme === name) return;
    this.playingTheme = name;
    this.tempo = 1;
    this.theme = THEMES[name] || THEMES.menu;
    this._step = 0;
    this._next = this.ctx.currentTime + 0.05;
    if (!this._timer) this._timer = setInterval(() => this._schedule(), 60);
  }

  /** Accelera (o rallenta) il tema in corso senza farlo ripartire. */
  setTempo(x) { this.tempo = x; }

  /** Anello preso: una nota che sale di un semitono a ogni anello della catena. */
  chime(step = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, f = 660 * Math.pow(2, Math.min(step, 12) / 12);
    this._osc('triangle', f, t, 0.12, 0.2, this.sfxGain);
    this._osc('sine', f * 1.5, t + 0.06, 0.16, 0.14, this.sfxGain);
  }

  stopMusic() {
    this.stopSong(); // anche un brano ritmico in corso
    this.playingTheme = null;
    this.theme = null;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  _schedule() {
    if (!this.theme || !this.ctx) return;
    const ctx = this.ctx;
    const spb = 60 / (this.theme.bpm * (this.tempo || 1)) / 4; // sedicesimi (tempo > 1 = accelera)
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
      // gong che batte come un cuore (due colpi bassi ravvicinati)
      case 'gong': this._osc('sine', 62, t, 0.22, 0.5, d, { attack: 0.005, release: 0.18 }); this._osc('sine', 58, t + 0.2, 0.26, 0.4, d, { attack: 0.005, release: 0.2 }); break;
      case 'whoosh': this._noise(t, 0.3, 0.25, d, 900); break;
      case 'jump': this._osc('triangle', 440, t, 0.06, 0.14, d); this._osc('triangle', 660, t + 0.05, 0.08, 0.12, d); break;
      case 'break': this._noise(t, 0.18, 0.28, d, 2200); this._osc('triangle', 1400, t, 0.05, 0.08, d); break;
      // rissa: pugno (colpo sordo), pugno finale più pesante, rete che cade, juke-box che parte
      case 'punch': this._noise(t, 0.08, 0.35, d, 700); this._osc('sine', 150, t, 0.09, 0.3, d, { attack: 0.003, release: 0.07 }); break;
      case 'punch3': this._noise(t, 0.14, 0.45, d, 500); this._osc('sine', 110, t, 0.16, 0.4, d, { attack: 0.003, release: 0.12 }); break;
      case 'swing': this._noise(t, 0.1, 0.12, d, 2500); break;
      case 'net': this._noise(t, 0.4, 0.25, d, 1200); this._osc('triangle', 300, t, 0.3, 0.12, d); break;
      case 'jukebox': [392, 494, 587, 784, 587, 784].forEach((f, i) => this._osc('square', f, t + i * 0.07, 0.1, 0.1, d)); break;
      // inseguimento: allarme missile, esplosione, raggio del cannone ionico
      case 'warn': this._osc('square', 990, t, 0.09, 0.14, d); this._osc('square', 990, t + 0.14, 0.09, 0.14, d); break;
      case 'boom': this._noise(t, 0.6, 0.6, d, 200); this._osc('sine', 70, t, 0.5, 0.45, d, { attack: 0.005, release: 0.4 }); break;
      // esibizione: applausi (tanti battiti di mani sparsi) e note giudicate
      case 'applause': for (let i = 0; i < 60; i++) this._noise(t + Math.random() * 2.4, 0.03, 0.12 + Math.random() * 0.1, d, 1500 + Math.random() * 2500); break;
      case 'perfect': this._osc('sine', 1760, t, 0.06, 0.06, d); break;
      case 'miss': this._osc('sawtooth', 110, t, 0.12, 0.08, d); break;
      case 'beam': this._noise(t, 1.0, 0.35, d, 300); this._osc('sawtooth', 90, t, 1.0, 0.25, d, { attack: 0.05, release: 0.6 }); this._osc('sine', 1800, t, 0.8, 0.08, d); break;
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

  /**
   * Motore di un veicolo nemico (i blindati dell'inseguimento): dente di sega grave filtrato, con volume,
   * posizione destra/sinistra e giri regolabili a ogni fotogramma. Passa dagli Effetti, come il motore del kart.
   * Ritorna { set(volume, pan, pitch), stop() } oppure null senza audio.
   */
  hum(freq = 48) {
    if (!this.ctx) return null;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = freq * 0.5;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.value = 0;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g);
    if (p) { g.connect(p); p.connect(this.sfxGain); } else g.connect(this.sfxGain);
    o.start(t); o2.start(t);
    let stopped = false;
    return {
      set: (vol, pan = 0, pitch = 1) => {
        if (stopped) return;
        const now = ctx.currentTime;
        g.gain.setTargetAtTime(vol, now, 0.12);
        if (p) p.pan.setTargetAtTime(pan, now, 0.1);
        o.frequency.setTargetAtTime(freq * pitch, now, 0.2);
        o2.frequency.setTargetAtTime(freq * 0.5 * pitch, now, 0.2);
        f.frequency.setTargetAtTime(260 + vol * 900, now, 0.2);
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        setTimeout(() => { try { o.stop(); o2.stop(); } catch {} }, 500);
      }
    };
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
