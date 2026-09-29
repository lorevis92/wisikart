import { Assets } from '../core/AssetLoader.js';

/**
 * Le battute nei livelli della Storia (Emma, e chi parla alla radio, come il capo dei cacciatori): una alla
 * volta, con sottotitolo. Quelle importanti aspettano il loro turno in una piccola coda (così una minaccia e
 * la risposta di Emma si alternano senza sovrapporsi), le altre si saltano se qualcuno sta già parlando.
 * lines = { chiave: { url, text, who? } } — who: 'emma' (predefinito) o 'capo'.
 * Se la voce è spenta (menu, tasto M) la battuta non si sente ma il sottotitolo resta, per un tempo stimato
 * dalla lunghezza del testo; se la si spegne mentre parla, la battuta si interrompe e la coda si svuota.
 */
const NAMES = { emma: 'Emma', capo: 'Capo' };

export class EmmaVoice {
  constructor(audio, lines) {
    this.audio = audio;
    this.lines = lines || {};
    this.buffers = {};
    this.busyUntil = 0;
    this.queue = [];
    this.subtitle = null;
    this.speaker = null; // chi sta parlando adesso (per il riquadro radio)
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
      if (important && !this.queue.includes(key)) {
        this.queue.push(key);
        if (this.queue.length > 4) this.queue.shift(); // al massimo quattro in attesa: si perdono le più vecchie
      }
      return false;
    }
    const dur = this.audio.voiceBuffer ? this.audio.voiceBuffer(this.buffers[key]) : 0;
    // senza audio (voce spenta o file mancante) resta il sottotitolo, per il tempo di leggerlo
    const len = dur || Math.max(2, line.text.length / 15);
    this.busyUntil = this.t + len + 0.25;
    this.speaker = line.who || 'emma';
    this.subtitle = `${NAMES[this.speaker] || this.speaker}: «${line.text}»`;
    this.subUntil = this.t + len + 0.6;
    return true;
  }

  /** Una serie di battute importanti, una dopo l'altra (es. minaccia del capo e risposta di Emma). */
  seq(keys) { for (const k of keys) this.say(k, { important: true }); }

  /** Svuota la coda (per le battute di fine livello). */
  clear() { this.queue = []; this.busyUntil = 0; }

  update(dt) {
    this.t += dt;
    // voce appena spenta: niente più coda, e la prossima battuta può partire subito (come sottotitolo)
    if (this.audio.voiceEpoch !== undefined && this.audio.voiceEpoch !== this.epoch) {
      this.epoch = this.audio.voiceEpoch;
      this.queue = [];
      this.busyUntil = Math.min(this.busyUntil, this.t);
    }
    if (this.queue.length && this.t >= this.busyUntil) this.say(this.queue.shift());
    if (this.t > this.subUntil) { this.subtitle = null; this.speaker = null; }
  }
}
