// Livello 3 della Storia: il Portale, corsa al varco (Niaboc). Il portale intergalattico chiude a mezzogiorno
// (il gong delle 12) e la pattuglia di Niaboc vuole fermarci. Primo livello di volo: si pilota Emma
// (l'autovettore) sul circuito di Niaboc di WisiKart, un solo giro contro il tempo.
// Posizioni sul giro in t (frazione del circuito, come in tracks.js); lat = scostamento laterale in metri
// (negativo a sinistra), alt = quota in metri sopra la strada. La strada è larga 15 m, si vola tra 1 e 15 m.

const VOCE = 'assets/story/voce/';

export const PORTALE = {
  id: 'portale', // stesso id dell'ingresso in piazza: è la chiave del salvataggio
  type: 'flight',
  name: 'Portale: corsa al varco',
  subtitle: 'Un giro di Niaboc prima del gong di mezzogiorno. La pattuglia è già sveglia.',
  preview: 'assets/tracks/niaboc/preview.png',
  track: 'niaboc',
  music: 'niaboc',
  model: { url: 'assets/props/autovettore.glb', h: 2.2 },
  patrolModel: { url: 'assets/story/portale/pattuglia.glb', h: 2.0 },
  portalModel: { url: 'assets/props/portale-niaboc.glb', h: 30 },
  cinematic: 'assets/video/intro.mp4', // il tunnel: si vede se si arriva prima del gong
  completeMessage: 'Sei passato dal portale prima del gong. Il viaggio verso Retah è in arrivo.',

  time: 72, // secondi al gong (un giro perfetto ne richiede circa 51)
  ringPenalty: 3, // secondi persi per ogni anello mancato
  hitPenalty: 2, // secondi persi urtando pattuglia o barriera
  endT: 0.975, // il portale, in fondo al giro (la partenza è a startT del circuito)
  maxSpeed: 46,
  brakeSpeed: 20,

  // anelli rosa e ciano da attraversare (raggio 3,4 m)
  rings: [
    { t: 0.07, lat: 0, alt: 4 },
    { t: 0.13, lat: 4, alt: 6 },
    { t: 0.2, lat: -3, alt: 3 },
    { t: 0.28, lat: 2, alt: 8 },
    { t: 0.36, lat: -4, alt: 5 },
    { t: 0.44, lat: 3, alt: 3 },
    { t: 0.52, lat: 0, alt: 9 },
    { t: 0.6, lat: -3, alt: 4 },
    { t: 0.68, lat: 4, alt: 10 },
    { t: 0.76, lat: -2, alt: 3 },
    { t: 0.84, lat: 2, alt: 7 },
    { t: 0.91, lat: 0, alt: 5 }
  ],

  // barriere di energia nella seconda metà: coprono la quota tra a0 e a1, si passa sopra o sotto
  barriers: [
    { t: 0.56, a0: 0, a1: 6 }, // bassa: si passa sopra
    { t: 0.64, a0: 5, a1: 16 }, // alta: si passa sotto
    { t: 0.72, a0: 0, a1: 7.5 },
    { t: 0.8, a0: 4.5, a1: 16 },
    { t: 0.88, a0: 0, a1: 5.5 }
  ],

  // la pattuglia parte davanti e cerca di sbarrare la strada
  patrols: [
    { t: 0.06, lat: -3, alt: 4 },
    { t: 0.11, lat: 3, alt: 6 },
    { t: 0.17, lat: 0, alt: 3 }
  ],
  patrolSpeed: 33,

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
    win: { url: VOCE + 'volo-vittoria.wav', text: 'Ce l’abbiamo fatta. Ovviamente per merito mio.' }
  }
};
