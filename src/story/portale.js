// Livello 3 della Storia: il Portale, corsa al varco (Niaboc). Il portale intergalattico chiude a mezzogiorno
// (il gong delle 12) e la pattuglia di Niaboc vuole fermarci. Primo livello di volo: si pilota Emma
// (l'autovettore) sul circuito di Niaboc di WisiKart, un solo giro contro il tempo.
// Regola del tempo: il timer di partenza è volutamente troppo corto per finire il giro. Ogni anello preso
// aggiunge secondi (+3, e in catena +4 dal terzo di fila, poi +5); mancarne uno non toglie tempo ma azzera la
// catena. Gli anelli dorati, in punti scomodi, danno anche un turbo e monete, e contano per la catena.
// Posizioni sul giro in t (frazione del circuito, come in tracks.js); lat = scostamento laterale in metri
// (negativo a sinistra), alt = quota sopra la strada. La strada è larga 15 m, si vola tra 1 e 15 m.
// Gli anelli sono distanziati di circa 5 secondi di volo: presi tutti, il timer non si esaurisce mai.

const VOCE = 'assets/story/voce/';

export const PORTALE = {
  id: 'portale', // stesso id dell'ingresso in piazza: è la chiave del salvataggio
  type: 'flight',
  name: 'Portale: corsa al varco',
  subtitle: 'Un giro di Niaboc prima del gong di mezzogiorno. La pattuglia è già sveglia.',
  preview: 'assets/tracks/niaboc/preview.png',
  track: 'niaboc',
  music: 'volo',
  model: { url: 'assets/props/autovettore.glb', h: 2.2 },
  patrolModel: { url: 'assets/story/portale/pattuglia.glb', h: 2.0 },
  portalModel: { url: 'assets/props/portale-niaboc.glb', h: 30 },
  cinematic: 'assets/video/intro.mp4', // il tunnel: si vede se si arriva prima del gong
  completeMessage: 'Atterraggio riuscito: benvenuto su Retah. La tavola calda sembra un posto tranquillo. Non lo è.',
  nextWorld: 'retah', // finito il tunnel si atterra su Retah (e per ora non si torna a Niaboc)

  // --- tempo (tarato con i piloti automatici: vedi README) ---
  time: 12.5, // secondi al gong alla partenza: da soli non bastano
  ringBonus: [3, 3, 4, 5], // bonus per il 1°, 2°, 3° anello di fila e dal 4° in poi
  hitPenalty: 2, // urto con pattuglia, blocco o barriera: secondi e velocità
  nearBonus: 0.5, // "Sfiorata!"
  endT: 0.975, // il portale, in fondo al giro (la partenza è a startT del circuito)
  maxSpeed: 46,
  brakeSpeed: 20,
  turbo: { time: 1.4, mult: 1.3 },

  // anelli rosa e ciano (raggio 3,4 m), ognuno ≈ 5 secondi di volo dal precedente
  rings: [
    { t: 0.068, lat: 0, alt: 4 },
    { t: 0.163, lat: 4, alt: 6 },
    { t: 0.257, lat: -3, alt: 3 },
    { t: 0.352, lat: 2, alt: 6 }, // appena usciti dal tunnel
    { t: 0.446, lat: -4, alt: 5 },
    { t: 0.541, lat: 3, alt: 3.5 },
    { t: 0.635, lat: 0, alt: 9 },
    { t: 0.73, lat: -3, alt: 4 },
    { t: 0.824, lat: 4, alt: 10 },
    { t: 0.919, lat: 0, alt: 5 }
  ],
  // anelli dorati, rischiosi: chi punta solo ad arrivare li può ignorare
  goldRings: [
    { t: 0.4, lat: 6.5, alt: 11, coins: 5 }, // alto e di lato, dove la pattuglia fa la tenaglia
    { t: 0.492, lat: -4, alt: 2.6, coins: 5 }, // sotto il ponte basso
    { t: 0.686, lat: 5, alt: 3.6, coins: 5 } // rasoterra, subito dopo la barriera alta
  ],

  // barriere di energia nella seconda metà: coprono la quota tra a0 e a1, si passa sopra o sotto
  barriers: [
    { t: 0.59, a0: 0, a1: 6 }, // bassa: si passa sopra
    { t: 0.68, a0: 5, a1: 16 }, // alta: si passa sotto
    { t: 0.78, a0: 0, a1: 7.5 },
    { t: 0.87, a0: 4.5, a1: 16 }
  ],

  // sorprese lungo il percorso (la pista non cambia: sono costruzioni sopra)
  tunnel: { from: 0.285, to: 0.335, radius: 13 }, // dentro un capannone buio con luci al neon
  bridge: { t: 0.492, a0: 5.6, a1: 8.2 }, // ponte basso: si passa sotto (o sopra)
  // la picchiata si cerca da sola: il tratto in discesa più ripido del circuito

  // la pattuglia: il caposquadra (più grosso, luci bianche e rosse) lancia blocchi di energia; le altre due fanno la tenaglia
  patrols: [
    { t: 0.12, lat: 0, alt: 5, leader: true },
    { t: 0.14, lat: -4, alt: 4 },
    { t: 0.15, lat: 4, alt: 4 }
  ],
  patrolSpeed: 33,

  // medaglie: oro e argento richiedono tutte le condizioni indicate; il bronzo è arrivare in tempo
  medals: {
    gold: { time: 5, rings: 12, coins: 10 },
    silver: { time: 2, rings: 10, coins: 0 }
  },

  briefing: {
    goal: 'Arriva al Portale prima del gong',
    controls: 'flight',
    rules: [
      { icon: 'gong', text: 'Il gong parte con pochi secondi: da soli non bastano per finire il giro.' },
      { icon: 'ring', text: 'Ogni anello preso aggiunge tempo: +3 s, in catena +4 e poi +5. Mancarne uno azzera la catena.' },
      { icon: 'goldring', text: 'Anelli dorati in punti rischiosi: tempo, turbo e monete. Facoltativi.' },
      { icon: 'barrier', text: 'Barriere di energia: si passano sopra o sotto. Vale anche per il ponte basso.' },
      { icon: 'patrol', text: 'La pattuglia sbarra la strada: superala o spostala sparando. Un urto costa tempo e velocità.' },
      { icon: 'leader', text: 'Il caposquadra lancia blocchi d’energia in linea retta: prima lampeggia.' },
      { icon: 'pincer', text: 'Tenaglia: due navicelle si stringono ai lati. Resta in mezzo o cambia quota.' },
      { icon: 'medal', text: 'Medaglie in base a tempo rimasto, anelli e monete.' }
    ],
    tip: 'Gli anelli sono il tempo. Il resto è panorama.'
  },

  // battute di Emma (è la navicella): testo per i sottotitoli, file audio
  voices: {
    start: { url: VOCE + 'volo-start.wav', text: 'Motori accesi. Tieniti forte, capo: la pattuglia è già sveglia e di pessimo umore.' },
    ring1: { url: VOCE + 'volo-anello1.wav', text: 'Anello preso. Non male, per uno che non sa parcheggiare.' },
    ring2: { url: VOCE + 'volo-anello2.wav', text: 'Bel colpo!' },
    missed: { url: VOCE + 'volo-mancato.wav', text: 'Anello mancato. Il tempo non fa sconti.' },
    patrol: { url: VOCE + 'volo-pattuglia.wav', text: 'Pattuglia alle spalle. Non guardare me, guarda avanti.' },
    barrier: { url: VOCE + 'volo-barriera.wav', text: 'Barriera d’energia davanti! Su o giù, decidi in fretta.' },
    hit: { url: VOCE + 'volo-colpito.wav', text: 'Ahia. Questo mi resta sulla carrozzeria.' },
    gong: { url: VOCE + 'volo-gong.wav', text: 'Manca poco al gong. Niente pressione.' },
    portal: { url: VOCE + 'volo-portale.wav', text: 'Il portale! Dentro, dentro, dentro!' },
    late: { url: VOCE + 'volo-tardi.wav', text: 'Gong suonato, portale chiuso. Rifacciamo il giro, e stavolta con più entusiasmo.' },
    win: { url: VOCE + 'volo-vittoria.wav', text: 'Ce l’abbiamo fatta. Ovviamente per merito mio.' },
    near: { url: VOCE + 'volo-sfiorata.wav', text: 'Sfiorata! Se avessi un cuore, adesso batterebbe.' },
    chain: { url: VOCE + 'volo-serie.wav', text: 'Che serie! Continua così.' },
    ten: { url: VOCE + 'volo-dieci.wav', text: 'Dieci secondi. Niente panico. Panico moderato, al massimo.' },
    leader: { url: VOCE + 'volo-caposquadra.wav', text: 'Il caposquadra ci ha visti. Ora si fa sul serio.' },
    pincer: { url: VOCE + 'volo-tenaglia.wav', text: 'Tenaglia! Si stringono ai lati!' }
  }
};
