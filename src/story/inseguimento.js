// Livello 5 della Storia: inseguimento sul lago di Retah. Volo con l'autovettore (Emma) sul circuito di Retah
// di WisiKart, riusando il motore del Portale (ChaseMode estende FlightMode). Niente timer: si sopravvive
// fino allo spazio vettore, in fondo al giro. Il capo dei cacciatori (quello della rete, battuto alla tavola
// calda) guida il blindato principale e minaccia alla radio.
// L'inseguimento va a fasi: 1) dietro (si vedono nello specchietto, lanciano missili), 2) un blindato accosta
// e tenta la spallata, 3) un blindato sorpassa e taglia la strada lasciando mine o un muro di energia; poi si
// torna alla fase 1. Due giri di fasi (durate un po' diverse), poi la fase finale: cannone ionico e ripari,
// e il tuffo nello spazio vettore. Tenendo premuto "guarda indietro" la telecamera si gira: si vedono e si
// colpiscono i blindati alle spalle, ma si sterza peggio e non si vede cosa c'è davanti.
// Posizioni sul giro in t (frazione del circuito, come in tracks.js); distanze in metri. Motore: ChaseMode.js.

const VOCE = 'assets/story/voce/';

export const INSEGUIMENTO = {
  id: 'inseguimento', // stesso id dell'ingresso in piazza: è la chiave del salvataggio
  type: 'chase',
  name: 'Inseguimento sul lago',
  subtitle: 'Il capo dei cacciatori alle spalle, un cannone ionico e, in fondo, lo spazio vettore.',
  preview: 'assets/tracks/retah/preview.png',
  track: 'retah',
  music: 'volo',
  model: { url: 'assets/props/autovettore.glb', h: 2.2 },
  chaserModel: { url: 'assets/props/blindato.glb', h: 3.0 },
  bossModel: { url: 'assets/story/retah/capo.glb', h: 2.0 }, // il capo, in piedi nella botola del blindato principale
  wreckModel: { url: 'assets/props/relitto.glb', h: 5.5 },
  radioPortrait: 'assets/story/retah/capo-radio.png',
  radioName: 'Capo dei cacciatori',
  cinematic: 'assets/video/intro.mp4', // il tuffo nello spazio vettore
  completeMessage: 'Fuori dallo spazio vettore: benvenuto su Canair. È sera, e il Red Fox ha le luci accese.',
  nextWorld: 'canair', // dopo la cinematica si atterra su Canair…
  next: 'redfox', // …direttamente al Red Fox, di sera

  hearts: 5, // salute: a zero si riparte dall'ultimo checkpoint
  endT: 0.965, // l'imbocco dello spazio vettore (la partenza è a startT del circuito)
  checkpoints: [0.28, 0.52, 0.76],
  maxSpeed: 40,
  brakeSpeed: 10, // frenando quasi fino a fermarsi ci si tiene dietro un riparo
  turbo: { time: 1.2, mult: 1.25 },
  lookBackSteer: 0.45, // guardando indietro lo sterzo risponde meno (e con un po' di tremolio)

  // blindati: distanza alle spalle (m) e scostamento laterale che tengono nella fase 1; leader = guidato dal capo
  chasers: [{ gap: 38, lat: -3.5, leader: true }, { gap: 56, lat: 3.5 }],
  chaserHp: 6, // colpi per "prenderne uno" (poi resta indietro e per un po' non attacca)
  // arma: un colpo ogni `every` s; ogni colpo scalda di `heat`, si raffredda di `cool` al secondo;
  // al massimo si ferma finché non scende a `resume`
  weapon: { every: 0.26, heat: 0.15, cool: 0.55, resume: 0.3 },

  // due giri di fasi prima del finale; secondi per fase (a ogni partita ±1 s), ostacolo della fase 3
  cycles: [
    { behind: 8, flank: 8, block: 9, obstacle: 'mines' },
    { behind: 6, flank: 8, block: 9, obstacle: 'wall' }
  ],
  // fase 1: missili (ogni quanto, avviso, velocità in più di Emma, quando smettono di inseguire, raggio, danno)
  missile: { every: [3.5, 5.5], warn: 1.3, rel: 26, lock: 0.8, radius: 2.0, damage: 1 },
  // fase 2: accosta di lato fino a `side` m (corazzato), carica la spallata (aim s: ramHp colpi la annullano),
  // poi scatta verso Emma (ram s)
  flank: { side: 6.5, aim: 1.0, ram: 0.55, ramSpeed: 13, damage: 1, ramHp: 3 },
  // fase 3: sorpassa (corazzato, a `overtake` m/s più di Emma) e, a `drop` m davanti, lascia l'ostacolo; mine (una fila con un varco) o muro (sopra o abbattilo)
  block: { overtake: 46, drop: 115, mines: { lats: [-6, -3, 0, 3, 6], alt: [1.6, 3.6], r: 1.6 }, wall: { a1: 7.2, coreHp: 3 }, damage: 1 },
  // fase finale: comincia a `at` m dallo spazio vettore; il cannone si carica (charge s), conto alla rovescia,
  // raggio: al sicuro solo subito dietro un riparo (safeAhead m); negli ultimi `finale` m la barra resta quasi piena
  final: { at: 680 },
  cannon: { charge: 4.5, countdown: 2.5, safeAhead: 32, damage: 2, finale: 300 },
  covers: { every: 60, lats: [-4, 3.5, 0, -3, 4.5, -1.5] },

  briefing: {
    goal: 'Sopravvivi fino allo spazio vettore',
    controls: 'chase',
    rules: [
      { icon: 'mirror', text: 'Fase 1: i blindati sono dietro, li vedi nello specchietto. Tieni premuto Guarda indietro per vederli e sparargli (ma sterzi peggio e non vedi davanti).' },
      { icon: 'missile', text: 'Da dietro arrivano missili: l’avviso dice da dove. Quando compare «Scarta!», spostati di lato o cambia quota.' },
      { icon: 'flank', text: 'Fase 2: un blindato accosta di lato e carica la spallata. Scarta dall’altra parte, o sparagli.' },
      { icon: 'mines', text: 'Fase 3: un blindato sorpassa e lascia mine o un muro di energia. Passa nel varco, sopra, o abbattili sparando.' },
      { icon: 'cannon', text: 'Finale: cannone ionico. A barra piena resta solo dietro un riparo (colonna di luce verde), bassi e fermi.' },
      { icon: 'heart', text: 'Cinque cuori. A zero si riparte dall’ultimo checkpoint.' },
      { icon: 'vortex', text: 'In fondo, lo spazio vettore: tuffati dentro.' }
    ],
    tip: 'Il capo parla tanto. Tu guarda la strada, e ogni tanto lo specchietto.'
  },

  // battute: Emma e, alla radio, il capo (who: 'capo'); testo per i sottotitoli, file audio
  voices: {
    start: { url: VOCE + 'insegui-start.wav', text: 'Due blindati alle spalle. Tieniti basso e non fare l’eroe.' },
    missile: { url: VOCE + 'insegui-missile.wav', text: 'Missile in arrivo! Preparati a scartare.' },
    cannone: { url: VOCE + 'insegui-cannone.wav', text: 'Il cannone ionico si sta caricando. Non mi piace per niente.' },
    riparo: { url: VOCE + 'insegui-riparo.wav', text: 'Riparati dietro qualcosa, adesso!' },
    colpiti: { url: VOCE + 'insegui-colpiti.wav', text: 'Colpiti! La mia carrozzeria non te lo perdonerà.' },
    preso: { url: VOCE + 'insegui-preso.wav', text: 'Preso uno!' },
    vettore: { url: VOCE + 'insegui-vettore.wav', text: 'Lo spazio vettore! Dritto dentro, senza pensarci.' },
    vittoria: { url: VOCE + 'insegui-vittoria.wav', text: 'Dentro. E il cannone ha colpito il nulla. Il mio bersaglio preferito.' },
    chiParla: { url: VOCE + 'insegui-chi-parla.wav', text: 'Chi è quel signore urlante? Digli che la linea cade spesso da queste parti.' },
    accosta: { url: VOCE + 'insegui-accosta.wav', text: 'Sta accostando! Guarda a destra, o a sinistra, insomma guarda!' },
    taglia: { url: VOCE + 'insegui-taglia-strada.wav', text: 'Ci sta tagliando la strada! Frena o schiva, decidi tu, ma decidi ora.' },
    guarda: { url: VOCE + 'insegui-guarda-indietro.wav', text: 'Guarda indietro se vuoi sparargli. Ma tieni gli occhi anche davanti, mi raccomando.' },
    capoArrivo: { who: 'capo', url: VOCE + 'capo-arrivo.wav', text: 'Ti abbiamo trovato, Whiskey! Dovevi pensarci prima di rompere il juke-box.' },
    capo1: { who: 'capo', url: VOCE + 'capo-minaccia1.wav', text: 'Fermati e ti rompiamo solo un braccio! Ah ah, sto scherzando. Forse.' },
    capo2: { who: 'capo', url: VOCE + 'capo-minaccia2.wav', text: 'Bella la tua navicella. Peccato che tra poco sarà mia.' },
    capo3: { who: 'capo', url: VOCE + 'capo-minaccia3.wav', text: 'Non puoi scappare per sempre, ubriacone! Ah, forse sì. Ma non oggi!' },
    capoCannone: { who: 'capo', url: VOCE + 'capo-cannone.wav', text: 'Il cannone è quasi carico. Salutami l’universo.' },
    capoVettore: { who: 'capo', url: VOCE + 'capo-spazio-vettore.wav', text: 'Cosa?! Di nuovo nello spazio vettore?! Lo odio quando fa così!' }
  }
};
