// Livello 9 della Storia: il Lube Tone (Canair), capitolo 5 del romanzo, "Emorazionale". Subito dopo
// l'esibizione al piazzale: un locale elegante in paese, luci soffuse, un piccolo palco. Whiskey suona un brano
// (stesso sistema ritmico, brano "lubetone" generato da AudioEngine.js) davanti a Rioma e all'amico
// dell'etichetta, seduti a un tavolino; alla fine applaudono. Poi la scena del contratto: battute a schermo con i
// personaggi fermi, e la chiusura della prima parte della Storia (finale). Motore: RhythmMode.js (scene: 'club').

const VOCE = 'assets/story/voce/';
const C = 'assets/story/canair/';
const R = 'assets/story/retah/';

export const LUBETONE = {
  id: 'lubetone', // stesso id dell'ingresso in piazza: è la chiave del salvataggio
  type: 'rhythm',
  name: 'Lube Tone',
  subtitle: 'Gente elegante, luci soffuse e un tavolino dove qualcuno prende appunti.',
  preview: C + 'lube-tone.png',
  music: 'canair',
  loadingText: 'Abbasso le luci del Lube Tone…',
  completeMessage: 'Il contratto è firmato. Il Lube Tone ti ha applaudito, e il seguito è già scritto su un foglio.',

  scene: 'club',
  background: C + 'lube-tone.png', // il locale, come quadro sulla parete di fondo
  models: {
    table: { url: R + 'tavolo.glb', h: 0.85 },
    sofa: { url: R + 'divanetto.glb', h: 1.1 },
    lamp: { url: R + 'lampada.glb', h: 1.0 },
    rioma: { url: C + 'rioma.glb', h: 1.8 },
    friend: { url: C + 'amico-etichetta.glb', h: 1.85 }
  },
  songs: ['lubetone'],
  pass: 0.45, // precisione minima: se non basta si risuona il brano
  introLines: ['arrivo', 'trecanzoni'],

  // la scena del contratto: battute a schermo (who = nome mostrato; voice = battuta registrata da far partire)
  contract: {
    lines: [
      { who: 'Rioma', text: 'Te l’avevo detto: tre canzoni e se ne sarebbe innamorato.' },
      { who: 'L’amico dell’etichetta', text: 'Ragazzo, non ti chiedo da dove vieni. Ti chiedo dove vuoi arrivare.' },
      { who: 'L’amico dell’etichetta', text: 'Un disco con la nostra etichetta. Studio, promozione, e un tour sotto i tre soli di Canair. Basta una firma.' },
      { who: 'Emma', text: 'Un contratto discografico. Grande cosa, capo. Spero tu sappia quello che stai per firmare.', voice: 'contratto' },
      { who: 'Whiskey', text: '…' },
      { who: '', text: 'Whiskey prende la penna. La chitarra, sulla schiena, sembra trattenere il fiato.' }
    ]
  },

  finale: {
    title: 'Fine della prima parte',
    text: 'Dal deposito di Niaboc al palco del Lube Tone: una chitarra consumata, un autovettore che parla troppo e un pubblico che non smette di applaudire.',
    producer: 'Sul tavolino resta il contratto, con la firma ancora fresca. L’amico dell’etichetta lo piega in tre e sorride: «Ci vediamo in studio». Nel WiSiVERSE, però, nessuna firma è mai solo inchiostro.',
    image: C + 'lube-tone.png'
  },

  briefing: {
    goal: 'Suona al Lube Tone per Rioma e l’etichetta',
    controls: 'rhythm',
    rules: [
      { icon: 'lanes', text: 'Come sempre: quattro corsie, premi quando la nota tocca la linea, tieni quelle lunghe.' },
      { icon: 'pass', text: 'Un brano solo: basta il 45% di precisione. Se non basta, lo si risuona.' },
      { icon: 'table', text: 'Al tavolino ci sono Rioma e l’amico dell’etichetta: ascoltano tutto.' },
      { icon: 'contract', text: 'Alla fine, gli applausi. E poi qualcuno tira fuori un foglio da firmare.' }
    ],
    tip: 'Suonala come se il cameriere non stesse applaudendo anche lui.'
  },

  voices: {
    arrivo: { url: VOCE + 'lubetone-arrivo.wav', text: 'Il Lube Tone. Gente elegante, luci soffuse, e tu con la chitarra consumata. Divertente.' },
    trecanzoni: { url: VOCE + 'lubetone-tre-canzoni.wav', text: 'Tre canzoni, ha detto Rioma. Fagliene sentire una di troppo, tanto per gradire.' },
    applauso: { url: VOCE + 'lubetone-applauso.wav', text: 'L’applauso è vero. Anche se qui applaudono pure il cameriere, quindi non montarti la testa.' },
    contratto: { url: VOCE + 'lubetone-contratto.wav', text: 'Un contratto discografico. Grande cosa, capo. Spero tu sappia quello che stai per firmare.' },
    male: { url: VOCE + 'chitarre-male.wav', text: 'Stonato. Anche un motore rotto suona meglio, a volte.' }
  }
};
