// Livello della Storia: il Red Fox (Canair, sera). Si arriva qui appena atterrati dopo l'inseguimento di Retah.
// Scena d'ambiente: Whiskey entra nel locale (redfox.png come quadro sulla parete, bancone, sgabelli, palco),
// Hes canta sul palco (momento d'ascolto, niente da premere: la telecamera è su di lei), poi dialogo al bancone e
// la divisione della Lommy: lo schermo si distorce e si va dritti al locale da ballo (next), senza schermata di
// "livello completato". Motore: SceneMode.js.

const VOCE = 'assets/story/voce/';
const C = 'assets/story/canair/';
const R = 'assets/story/retah/';

export const REDFOX = {
  id: 'redfox', // stesso id dell'ingresso in piazza: è la chiave del salvataggio
  type: 'scene',
  name: 'Red Fox',
  subtitle: 'Sera a Canair. Un locale rosso, una voce sul palco e una Lommy da dividere.',
  preview: C + 'redfox.png',
  music: 'canair',
  loadingText: 'Accendo le luci rosse del Red Fox…',
  completeMessage: 'Il Red Fox è alle spalle. La notte di Canair, no.',
  next: 'ballo', // la Lommy porta dritti al locale da ballo

  background: C + 'redfox.png',
  models: {
    hes: { url: C + 'hes.glb', h: 1.72 },
    counter: { url: R + 'bancone.glb', h: 1.1 },
    stool: { url: R + 'sgabello.glb', h: 0.8 }
  },
  song: 'redfox', // la canzone di Hes (AudioEngine.js): si ascolta e basta
  lommyTime: 3.6, // secondi di distorsione prima del locale da ballo

  // dialogo al bancone (who = nome mostrato)
  lines: [
    { who: 'Hes', text: 'Non ti ho mai visto qui. Eppure la tua faccia è appesa a ogni palo di Canair.' },
    { who: 'Whiskey', text: 'È una foto venuta male.' },
    { who: 'Hes', text: 'Al Red Fox nessuno fa domande. In compenso, qualcuno offre la Lommy.' },
    { who: 'Hes', text: 'Una sola. Dividiamola, straniero: metà a te, metà a me.' },
    { who: 'Whiskey', text: 'Metà a me.' }
  ],

  briefing: {
    goal: 'Entra al Red Fox e ascolta Hes',
    controls: 'scene',
    rules: [
      { icon: 'mic', text: 'Hes canta sul palco: non serve premere niente, ascolta.' },
      { icon: 'contract', text: 'Al bancone si parla: un tasto per andare avanti nel dialogo (o aspetta).' },
      { icon: 'lommy', text: 'Poi c’è la Lommy. Da lì in poi la serata prende un’altra piega.' }
    ],
    tip: 'Ricordati che sei un ricercato. Cerca di non fare amicizia con tutto il locale.'
  },

  voices: {
    arrivo: { url: VOCE + 'redfox-arrivo.wav', text: 'Il Red Fox. Scelta coraggiosa per uno con la faccia su un manifesto WANTED.' },
    lommy: { url: VOCE + 'redfox-lommy.wav', text: 'Quella Lommy non è zucchero filato, capo. Ma tu fai sempre di testa tua.' }
  }
};
