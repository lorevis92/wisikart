// Livello 8 della Storia: esibizione al piazzale delle statue di Oremo (Canair), al tramonto a tripla stella.
// Stesso sistema ritmico di Infinity Guitars, con il brano lungo in tre sezioni in crescendo (AudioEngine.js:
// esibizione), l'ultima è "Love u mamma" (Emma la presenta prima che parta). Al posto delle vite c'è la barra
// del pubblico: parte quasi vuota, sale con le note buone e perfette, scende con quelle mancate; a zero la
// sezione riparte da capo. Le combo alte fanno piovere monete (contano per il totale della Storia).
// Finale: applausi e la chiusura della prima parte della Storia (finale: schermata in main.js / UI.js).
// Il palco sta sul circuito di Canair di WisiKart, tra la strada e le statue (stageT, stageSide). Motore: RhythmMode.js.

const VOCE = 'assets/story/voce/';

export const ESIBIZIONE = {
  id: 'esibizione', // stesso id dell'ingresso in piazza: è la chiave del salvataggio
  type: 'rhythm',
  name: 'Esibizione al piazzale',
  subtitle: 'Il tramonto a tripla stella, le statue di Oremo e un pubblico da conquistare.',
  preview: 'assets/tracks/canair/preview.png',
  music: 'canair',
  loadingText: 'Monto il palco tra le statue…',
  completeMessage: 'Fine della prima parte della Storia. Canair ti ha sentito suonare.',

  scene: 'stage',
  track: 'canair',
  stageT: 0.33, // accanto alle statue di Oremo (vedi le props del circuito)
  stageSide: -11,
  song: 'esibizione',
  sections: [0, 1, 2],
  // barra del pubblico: partenza, variazioni per nota (perfetto, buono, tenuta completa, mancata), soglie
  audience: { start: 0.22, perfect: 0.03, good: 0.015, hold: 0.02, miss: -0.07, high: 0.75, low: 0.2 },
  coinsEvery: 20, // ogni 20 note di fila, una pioggia di monete
  coinsPerRain: 5,

  finale: {
    title: 'Fine della prima parte',
    text: 'Il piazzale è in piedi. Le statue di Oremo sembrano applaudire anche loro, e i tre soli scendono dietro il promontorio.',
    producer: 'In fondo alla folla, qualcuno non applaude: prende appunti. Quando la musica finisce, lascia un biglietto da visita sul bordo del palco. Sopra c’è scritto solo: «Produzioni. Chiamami.»',
    image: 'assets/tracks/canair/preview.png'
  },

  briefing: {
    goal: 'Conquista il pubblico del piazzale',
    controls: 'rhythm',
    rules: [
      { icon: 'lanes', text: 'Come a Infinity Guitars: quattro corsie, premi quando la nota tocca la linea, tieni quelle lunghe.' },
      { icon: 'audience', text: 'Niente vite: c’è la barra del pubblico. Parte quasi vuota, sale con le note buone, scende con quelle mancate.' },
      { icon: 'retry', text: 'Se il pubblico se ne va tutto (barra a zero), la sezione riparte da capo.' },
      { icon: 'coin', text: 'Ogni 20 note di fila piovono monete: contano per il totale della Storia.' },
      { icon: 'guitar', text: 'Tre sezioni in crescendo. L’ultima è «Love u mamma».' }
    ],
    tip: 'Suona con il cuore, non con la paura. E guarda la linea, non il pubblico.'
  },

  voices: {
    arrivo: { url: VOCE + 'esibizione-arrivo.wav', text: 'Il tramonto a tripla stella. Il pubblico sta arrivando: fai in modo che ne valga la pena.' },
    cresce: { url: VOCE + 'esibizione-cresce.wav', text: 'La folla cresce. Stanno iniziando ad ascoltarti davvero.' },
    cala: { url: VOCE + 'esibizione-cala.wav', text: 'Li stai perdendo. Suona con il cuore, non con la paura.' },
    lovemamma: { url: VOCE + 'esibizione-lovemamma.wav', text: 'Love u mamma. So cosa significa questa canzone per te. Suonala bene.' }
  }
};
