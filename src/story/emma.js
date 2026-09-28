import { Assets } from '../core/AssetLoader.js';

/**
 * Le battute di Emma nei livelli della Storia: una alla volta, con sottotitolo. Quelle importanti aspettano
 * il loro turno, le altre si saltano. lines = { chiave: { url, text } }.
 * Se la voce è spenta (menu, tasto M) la battuta non si sente ma il sottotitolo resta, per un tempo stimato
 * dalla lunghezza del testo; se la si spegne mentre parla, la battuta si interrompe e la coda si svuota.
 */
export class EmmaVoice {
  constructor(audio, lines) {
    this.audio = audio;
    this.lines = lines || {};
    this.buffers = {};
    this.busyUntil = 0;
    this.queue = null;
    this.subtitle = null;
    this.subUntil = 0;
    this.t = 0;
    this.epoch = audio.voiceEpoch || 0;
  }

  async load() {
    const ctx = this.audio.ctx;
    await Promise.all(Object.entries(this.lines).map(async ([k, l]) => { this.buffers[k] = ctx ? await Assets.audioBuffer(ctx, l.url) : null; }));
  }

  say(key, { important = false } = {}) {
    const line = this.lines[key];
    if (!line) return false;
    if (this.t < this.busyUntil) {
      if (important) this.queue = key; // la più recente tra le importanti
      return false;
    }
    const dur = this.audio.voiceBuffer ? this.audio.voiceBuffer(this.buffers[key]) : 0;
    // senza audio (voce spenta o file mancante) resta il sottotitolo, per il tempo di leggerlo
    const len = dur || Math.max(2, line.text.length / 15);
    this.busyUntil = this.t + len + 0.25;
    this.subtitle = `Emma: «${line.text}»`;
    this.subUntil = this.t + len + 0.6;
    return true;
  }

  /** Interrompe la coda (per le battute di fine livello). */
  clear() { this.queue = null; this.busyUntil = 0; }

  update(dt) {
    this.t += dt;
    // voce appena spenta: niente più coda, e la prossima battuta può partire subito (come sottotitolo)
    if (this.audio.voiceEpoch !== undefined && this.audio.voiceEpoch !== this.epoch) {
      this.epoch = this.audio.voiceEpoch;
      this.queue = null;
      this.busyUntil = Math.min(this.busyUntil, this.t);
    }
    if (this.queue && this.t >= this.busyUntil) { const k = this.queue; this.queue = null; this.say(k); }
    if (this.t > this.subUntil) this.subtitle = null;
  }
}
