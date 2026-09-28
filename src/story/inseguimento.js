// Livello 5 della Storia: inseguimento sul lago di Retah. Volo con l'autovettore (Emma) sul circuito di Retah
// di WisiKart, riusando il motore del Portale (ChaseMode estende FlightMode). Niente timer: si sopravvive
// fino allo spazio vettore, in fondo al giro. Due blindati inseguono e lanciano missili; il cannone ionico si
// carica (barra in alto) e a barra piena spara un raggio largo lungo il percorso: ci si salva solo stando
// subito dietro un riparo (cespugli alti e relitti, segnati da una colonna di luce visibile da lontano).
// Posizioni sul giro in t (frazione del circuito, come in tracks.js). Motore: ChaseMode.js.

const VOCE = 'assets/story/voce/';

export const INSEGUIMENTO = {
  id: 'inseguimento', // stesso id dell'ingresso in piazza: è la chiave del salvataggio
  type: 'chase',
  name: 'Inseguimento sul lago',
  subtitle: 'Due blindati alle spalle, un cannone ionico e, in fondo, lo spazio vettore.',
  preview: 'assets/tracks/retah/preview.png',
  track: 'retah',
  music: 'volo',
  model: { url: 'assets/props/autovettore.glb', h: 2.2 },
  chaserModel: { url: 'assets/props/blindato.glb', h: 3.0 },
  wreckModel: { url: 'assets/props/relitto.glb', h: 5.5 },
  cinematic: 'assets/video/intro.mp4', // il tuffo nello spazio vettore
  completeMessage: 'Dentro lo spazio vettore un attimo prima del colpo. Il viaggio verso Canair è in arrivo.',

  hearts: 5, // salute: a zero si riparte dall'ultimo checkpoint
  endT: 0.965, // l'imbocco dello spazio vettore (la partenza è a startT del circuito)
  checkpoints: [0.28, 0.52, 0.76],
  maxSpeed: 44,
  brakeSpeed: 10, // frenando quasi fino a fermarsi ci si tiene dietro un riparo
  turbo: { time: 1.2, mult: 1.25 },

  // blindati: distanza alle spalle (m) e scostamento laterale che cercano di tenere
  chasers: [{ gap: 42, lat: -3.5 }, { gap: 60, lat: 3.5 }],
  chaserHp: 6, // colpi per "prenderne uno" (poi resta indietro e per un po' non lancia)
  // missili: ogni quanto (s), avviso prima del lancio, velocità in più di Emma, quando smette di inseguire
  // (s prima dell'impatto, da lì va dritto: è il momento di scartare), raggio d'impatto, danno in cuori
  missile: { every: [4.5, 6.5], warn: 1.3, rel: 26, lock: 0.8, radius: 2.0, damage: 1 },
  // cannone ionico: secondi di carica, conto alla rovescia a barra piena, metri davanti a un riparo in cui si
  // è al sicuro, danno in cuori; nel tratto finale (finale m dallo spazio vettore) la barra resta quasi piena
  cannon: { charge: 16, countdown: 2.8, safeAhead: 32, damage: 2, finale: 380 },
  // ripari lungo il percorso, uno ogni `every` metri dal primo all'ultimo tratto utile
  covers: { every: 105, from: 230, lats: [-4, 3.5, 0, -3, 4.5, -1.5] },

  briefing: {
    goal: 'Sopravvivi fino allo spazio vettore',
    controls: 'chase',
    rules: [
      { icon: 'armored', text: 'Due blindati alle spalle: sparagli (Spara mira da solo) per farli restare indietro.' },
      { icon: 'missile', text: 'Missile: l’avviso dice da dove arriva. Quando compare «Scarta!», spostati di lato o cambia quota.' },
      { icon: 'cannon', text: 'Cannone ionico: guarda la barra in alto. A barra piena, pochi secondi e parte il raggio.' },
      { icon: 'cover', text: 'Al sicuro solo subito dietro un riparo (colonna di luce verde): frena lì e resta basso.' },
      { icon: 'heart', text: 'Cinque cuori. A zero si riparte dall’ultimo checkpoint.' },
      { icon: 'vortex', text: 'In fondo al giro, lo spazio vettore: tuffati dentro.' }
    ],
    tip: 'I ripari si vedono da lontano. Il raggio no: arriva e basta.'
  },

  // battute di Emma: testo per i sottotitoli, file audio
  voices: {
    start: { url: VOCE + 'insegui-start.wav', text: 'Due blindati alle spalle. Tieniti basso e non fare l’eroe.' },
    missile: { url: VOCE + 'insegui-missile.wav', text: 'Missile in arrivo! Preparati a scartare.' },
    cannone: { url: VOCE + 'insegui-cannone.wav', text: 'Il cannone ionico si sta caricando. Non mi piace per niente.' },
    riparo: { url: VOCE + 'insegui-riparo.wav', text: 'Riparati dietro qualcosa, adesso!' },
    colpiti: { url: VOCE + 'insegui-colpiti.wav', text: 'Colpiti! La mia carrozzeria non te lo perdonerà.' },
    preso: { url: VOCE + 'insegui-preso.wav', text: 'Preso uno!' },
    vettore: { url: VOCE + 'insegui-vettore.wav', text: 'Lo spazio vettore! Dritto dentro, senza pensarci.' },
    vittoria: { url: VOCE + 'insegui-vittoria.wav', text: 'Dentro. E il cannone ha colpito il nulla. Il mio bersaglio preferito.' }
  }
};
