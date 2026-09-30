// Livello 6 della Storia: Infinity Guitars (Canair). Nel negozio (negozio.png di sfondo) il proprietario
// mette alla prova Whiskey su tre chitarre: tre brani ritmici uno dopo l'altro, sempre più difficili
// (note rade → fitte → con accordi tenuti; brani generati da AudioEngine.js: prova1, prova2, prova3).
// Per passare un brano basta una precisione minima (pass), non serve il massimo; se non basta si riprova.
// Superati tutti e tre, il proprietario regala la chitarra: da qui Whiskey la porta sempre sulla schiena
// (unlock: 'guitar' → save.storyGuitar). Motore: RhythmMode.js.

const VOCE = 'assets/story/voce/';
const C = 'assets/story/canair/';

export const CHITARRE = {
  id: 'chitarre', // stesso id dell'ingresso in piazza: è la chiave del salvataggio
  type: 'rhythm',
  name: 'Infinity Guitars',
  subtitle: 'Tre chitarre, tre prove. Il proprietario non regala niente a nessuno. Quasi.',
  preview: C + 'negozio.png',
  music: 'canair',
  loadingText: 'Accordo le chitarre…',
  completeMessage: 'La chitarra è tua: da adesso la porti sempre sulla schiena. Il sentiero per il promontorio è aperto.',
  unlock: 'guitar',

  scene: 'shop',
  background: C + 'negozio.png',
  owner: { url: C + 'proprietario.glb', h: 1.8 },
  guitar: { url: C + 'chitarra.glb' },
  songs: ['prova1', 'prova2', 'prova3'],
  pass: 0.55, // precisione minima per superare un brano (perfetto = 1, buono = 0,6, nota tenuta fino in fondo = +0,5)

  briefing: {
    goal: 'Supera le tre prove del proprietario',
    controls: 'rhythm',
    rules: [
      { icon: 'lanes', text: 'Quattro corsie: premi il tasto della corsia quando la nota tocca la linea luminosa.' },
      { icon: 'hold', text: 'Le note lunghe si tengono premute fino alla fine della scia.' },
      { icon: 'combo', text: 'Perfetto, buono o mancato: le note di fila fanno la combo e moltiplicano i punti (fino a ×4).' },
      { icon: 'pass', text: 'Per passare un brano basta il 55% di precisione. Se non basta, si riprova lo stesso brano.' },
      { icon: 'guitar', text: 'Tre brani sempre più difficili: note rade, poi fitte, poi accordi tenuti. In palio, la chitarra.' }
    ],
    tip: 'Ascolta il conteggio: le note cadono dove le senti.'
  },

  voices: {
    arrivo: { who: 'proprietario', url: VOCE + 'chitarre-arrivo.wav', text: 'Infinity Guitars. Se vuoi una chitarra vera, qui devi guadagnartela nota per nota.' },
    bene: { url: VOCE + 'chitarre-bene.wav', text: 'Bel tocco! Continua così.' },
    male: { url: VOCE + 'chitarre-male.wav', text: 'Stonato. Anche un motore rotto suona meglio, a volte.' },
    premio: { who: 'proprietario', url: VOCE + 'chitarre-premio.wav', text: 'È tua. Portala con onore, o almeno non rompiamola subito.' }
  }
};
