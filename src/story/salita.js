import { CrumbleStep, WindGusts, BoulderChute, HoldRow, Bench, Summit, CityBelow } from './canair-entities.js';

// Livello 7 della Storia: salita al promontorio Utgenra (Canair). Platform di scalata verticale: si sale per
// una gola di roccia larga 16 m, da una cengia all'altra. Gradini che si sbriciolano un istante dopo che ci si
// sale, raffiche di vento laterali annunciate (aggrappati agli appigli e non ti spostano), massi che rotolano
// giù per canali verticali (la scanalatura scura dice dove), appigli per le traversate (ci si appende saltandoci
// sotto, ci si sposta di lato, Salta o Giù per lasciare). Tre tratti separati da panchine di pietra
// (checkpoint); più si sale, più la città di Canair si allarga sotto. In cima, il piazzale con le statue di Oremo.
// Stesse convenzioni di stadio.js (metri, x a destra, y in alto; salto ≈ 3 m in alto, ≈ 6 m in lungo).
// Le cenge sono piattaforme attraversabili dal basso: si sale saltandoci attraverso.

const C = 'assets/story/canair/';
const VOCE = 'assets/story/voce/';
const SKY = 'assets/tracks/canair/sky.png';

export const SALITA = {
  id: 'salita', // stesso id dell'ingresso in piazza: è la chiave del salvataggio
  name: 'Salita al promontorio Utgenra',
  subtitle: 'Roccia, vento e massi. In cima, le statue di Oremo.',
  preview: 'assets/tracks/canair/preview.png',
  music: 'canair',
  loadingText: 'Controllo le corde…',
  buildingText: 'Scolpisco le cenge…',
  enemiesText: 'Sveglio il vento…',
  completeMessage: 'Sei in cima al promontorio. Il palco è davanti alle statue; il sentiero con le lanterne riporta in paese.',
  arriveAt: 'vetta', // finita la salita si ricompare in cima alla parete, nel piazzale del promontorio (stesso mondo)
  start: { x: 3, y: 0 },
  lives: 6,
  ammo: 0,
  maxAmmo: 0, // niente bottiglie in scalata (la chitarra resta sulla schiena)
  killY: -8,
  fallLimit: 10, // cadendo più di 10 m sotto l'ultima panchina si riparte da lì
  fallText: 'Emma: «Giù per la parete. Si riparte dalla panchina.»',
  background: '#f2b58a',
  lights: { sky: 0xffd9b0, ground: 0x6a4a2a, hemi: 1.2, key: 0xffc88a, keyI: 1.5, rim: 0xff8a5a },
  introLine: 'arrivo',

  briefing: {
    goal: 'Scala il promontorio fino al piazzale delle statue',
    controls: 'platform',
    rules: [
      { icon: 'crumbleRock', text: 'I gradini con le crepe si sbriciolano un istante dopo che ci sali: non fermarti.' },
      { icon: 'holds', text: 'Appigli: salta sotto la fune per appenderti, poi sposta di lato. Salta o Giù per lasciare.' },
      { icon: 'wind', text: 'Le raffiche sono annunciate e ti spingono di lato. Aggrappato agli appigli non ti spostano.' },
      { icon: 'boulder', text: 'I massi rotolano giù per le scanalature scure: polvere in cima vuol dire che sta arrivando.' },
      { icon: 'bench', text: 'Tre tratti, due panchine di pietra: se cadi troppo in basso riparti dall’ultima.' }
    ],
    tip: 'Guarda in alto prima di saltare. I massi non avvisano due volte.'
  },

  voices: {
    arrivo: { url: VOCE + 'salita-arrivo.wav', text: 'Il promontorio Utgenra. Bella vista, se sopravvivi alla salita.' },
    vento: { url: VOCE + 'salita-vento.wav', text: 'Vento forte! Aggrappati, non fare l’eroe.' },
    masso: { url: VOCE + 'salita-masso.wav', text: 'Masso in arrivo! Scansati, la chitarra non sopravvivrebbe a un urto simile.' },
    vetta: { url: VOCE + 'salita-vetta.wav', text: 'Sei arrivato in cima. Le statue ti stanno guardando, fanne un buon uso.' }
  },

  models: {
    boulder: { url: C + 'masso.glb', h: 1.8 },
    hold: { url: C + 'appiglio.glb', h: 0.35 },
    oremoYoung: { url: 'assets/props/oremo-giovane.glb', h: 7 },
    oremoOld: { url: 'assets/props/oremo-anziano.glb', h: 7 }
  },

  // tre tratti: lo sfondo (il cielo di Canair) scorre in verticale mentre si sale
  sections: [
    { id: 'base', bg: SKY, rect: [-10, -10, 26, 30], fallback: ['#f2b58a', '#e8a070', '#8a6a4a'] },
    { id: 'meta', bg: SKY, rect: [-10, 28, 26, 58], fallback: ['#f0a878', '#e89060', '#7a5a3a'] },
    { id: 'vetta', bg: SKY, rect: [-10, 56, 26, 100], fallback: ['#e89868', '#d87a58', '#6a4a2a'] }
  ],

  checkpoints: [
    { x: 3, y: 0 },
    { x: 0.2, y: 28.6, label: 'Prima panchina: la città si allarga sotto' },
    { x: 0.2, y: 55.9, label: 'Seconda panchina: manca poco' }
  ],

  // telecamera centrata sulla gola, che segue appena di lato e guarda un po' in basso; in cima si apre verso le statue
  camera: [
    { rect: [-50, -20, 100, 85.5], x: 8, follow: 0.25, yOff: 1.6, lookDown: 3.5, dist: 22 },
    { rect: [-50, 85.5, 100, 200], x: 14, follow: 0.4, yOff: 1.6, lookDown: 1, dist: 22 }
  ],

  solids: [
    { r: [-8, 24, -6, 0], style: 'rock' }, // base
    { r: [-8, 0, 0, 86], style: 'rock' }, // parete sinistra
    { r: [16, 24, 0, 86], style: 'rock' }, // parete destra
    // il piazzale in cima, con un varco da cui si sbuca (riempito dall'ultima cengia)
    { r: [-12, 4, 86, 87], style: 'plaza' },
    { r: [12, 32, 86, 87], style: 'plaza' }
  ],

  // cenge fisse (le altre, che si sbriciolano, sono in setup)
  platforms: [
    // tratto 1
    { r: [2, 6, 2.6], style: 'ledge' },
    { r: [8, 12, 5.2], style: 'ledge' },
    { r: [9, 14, 10.4], style: 'ledge' },
    { r: [10, 14, 15.6], style: 'ledge' },
    { r: [4, 8, 18.2], style: 'ledge' },
    { r: [11, 15, 23.4], style: 'ledge' },
    { r: [5, 9, 26.0], style: 'ledge' },
    { r: [1, 15, 28.6], style: 'ledge' }, // prima panchina
    // tratto 2
    { r: [8, 12, 33.8], style: 'ledge' },
    { r: [12.2, 15.5, 36.4], style: 'ledge' },
    { r: [12.2, 15.5, 39.0], style: 'ledge' },
    { r: [0.3, 2.4, 40.3], style: 'ledge' }, // dopo la traversata
    { r: [0.3, 2.4, 42.9], style: 'ledge' },
    { r: [3.5, 7.5, 45.5], style: 'ledge' },
    { r: [3, 7, 50.7], style: 'ledge' },
    { r: [9, 14, 53.3], style: 'ledge' },
    { r: [1, 15, 55.9], style: 'ledge' }, // seconda panchina
    // tratto 3
    { r: [4, 8, 61.1], style: 'ledge' },
    { r: [4, 8, 66.3], style: 'ledge' },
    { r: [11.2, 14.5, 67.6], style: 'ledge' }, // dopo la traversata
    { r: [12, 15.5, 70.2], style: 'ledge' },
    { r: [1, 5, 75.0], style: 'ledge' },
    { r: [7, 11, 77.4], style: 'ledge' },
    { r: [8, 12, 82.2], style: 'ledge' },
    { r: [3, 7, 84.6], style: 'ledge' },
    { r: [4, 12, 87.0], style: 'plaza' } // si sbuca sul piazzale
  ],

  // gradini che si sbriciolano
  crumbleSteps: [
    [3, 7, 7.8], [4, 8, 13.0], [6, 10, 20.8],
    [2, 6, 31.2], [9, 13, 48.1],
    [10, 14, 58.5], [9, 13, 63.7], [6, 10, 72.6], [2, 6, 79.8]
  ],

  // appigli: y = altezza delle mani (appesi, i piedi stanno 1,8 m sotto)
  holds: [
    { x0: 2.5, x1: 12.6, y: 42.6 },
    { x0: 2.8, x1: 11.3, y: 70.0 }
  ],

  // canali dei massi: x del canale, da dove partono a dove finiscono, ogni quanti secondi
  chutes: [
    { x: 12.5, yTop: 30, yBottom: 0, period: 6, offset: 1.5 },
    { x: 10.5, yTop: 57, yBottom: 29, period: 7, offset: 2 },
    { x: 5.5, yTop: 88, yBottom: 57, period: 5.5, offset: 0.5 },
    { x: 13.5, yTop: 72, yBottom: 57, period: 6.5, offset: 3 }
  ],

  // raffiche di vento nel secondo e nel terzo tratto
  winds: [
    { y0: 29, y1: 56, period: 7, warn: 1.6, gust: 2.4, force: 3.6 },
    { y0: 56, y1: 87, period: 6, warn: 1.5, gust: 2.4, force: 4.0, offset: 2 }
  ],

  setup(mode) {
    const L = mode.level, M = mode.models;
    mode.add(new CityBelow(), false);
    for (const [x0, x1, y] of L.crumbleSteps) {
      const step = new CrumbleStep({ x0, x1, y });
      mode.platforms.push(step);
      mode.add(step, false);
      mode.onRespawn.push(() => step.reset());
    }
    for (const h of L.holds) mode.add(new HoldRow(h, M.hold), false);
    for (const c of L.chutes) mode.add(new BoulderChute(c, M.boulder));
    for (const w of L.winds) mode.add(new WindGusts(w), false);
    mode.add(new Bench({ x: 4, y: 28.6 }), false);
    mode.add(new Bench({ x: 4, y: 55.9 }), false);
    mode.add(new Summit({ x: 20, y: 87, winX: 17.5 }, [M.oremoYoung ? M.oremoYoung.clone(true) : null, M.oremoOld ? M.oremoOld.clone(true) : null]), false);
  }
};
