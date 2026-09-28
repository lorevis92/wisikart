// Livello 4 della Storia: rissa alla tavola calda di Retah. Brawler ad arena su un solo ambiente
// (tavola-interno.png come sfondo, telecamera fissa): il pavimento è una fascia larga in cui ci si muove a
// destra/sinistra e in profondità. Tre ondate: scagnozzi, due cacciatori col manganello, il capo con la rete.
// Coordinate in metri: x = destra/sinistra, z = profondità (negativo = verso il fondo del locale), y = quota.
// Motore: BrawlMode.js.

const VOCE = 'assets/story/voce/';
const R = 'assets/story/retah/';

export const RISSA = {
  id: 'rissa', // stesso id dell'ingresso in piazza: è la chiave del salvataggio
  type: 'brawl',
  name: 'Rissa alla tavola calda',
  subtitle: 'Tre ondate di cacciatori di taglie tra il bancone e la cucina.',
  preview: R + 'tavola-interno.png',
  background: R + 'tavola-interno.png',
  music: 'rissa',
  loadingText: 'Apparecchio la tavola calda…',
  completeMessage: 'Fuori dalla cucina, e tutto intero. Emma ti aspetta sul retro, nel suo autovettore.',

  lives: 3,
  health: 6, // colpi che si incassano prima di perdere una vita (la rete del capo toglie la vita intera)
  ammo: 3,
  maxAmmo: 6,
  arena: { x0: -10.5, x1: 10.5, z0: -3.1, z1: 2.4 },

  models: {
    scagnozzo: { url: R + 'scagnozzo.glb', h: 1.75 },
    cacciatore: { url: R + 'cacciatore.glb', h: 1.95 },
    capo: { url: R + 'capo.glb', h: 2.15 },
    sgabello: { url: R + 'sgabello.glb', h: 0.85 },
    piatto: { url: R + 'piatto.glb', h: 0.34 },
    jukebox: { url: R + 'jukebox.glb', h: 2.0 },
    bottle: { url: 'assets/story/stadio/bottiglia.glb', h: 0.5 }
  },

  // il juke-box sul fondo, a destra: colpito (pugno o lancio) stordisce tutti i nemici, una volta per ondata
  jukebox: { x: 8.2, z: -3.7, stun: 4 },
  // porta della cucina, da cui si esce vinta la terza ondata
  exit: { x: 10.2, z: -2.6 },

  // sgabelli e piatti da raccogliere e lanciare (tornano al loro posto a ogni ondata)
  props: [
    { kind: 'stool', x: -6.5, z: -1.8 },
    { kind: 'stool', x: -1.5, z: 1.4 },
    { kind: 'stool', x: 4.5, z: -2.2 },
    { kind: 'plate', x: -8.5, z: 0.9 },
    { kind: 'plate', x: 1.2, z: -2.7 },
    { kind: 'plate', x: 6.8, z: 1.6 }
  ],

  // nemici: hp, velocità, portata del colpo, carica prima del colpo, pausa tra un colpo e l'altro,
  // probabilità di lasciare bottiglie; armor = i colpi leggeri non lo fermano; il capo in più lancia la rete (ogni `every` secondi, bersaglio a terra)
  enemies: {
    scagnozzo: { hp: 5, speed: 3.4, reach: 1.2, windup: 0.42, cooldown: 1.2, damage: 1, drop: 0.45 },
    cacciatore: { hp: 11, speed: 3.0, reach: 2.2, windup: 0.55, cooldown: 1.5, damage: 2, drop: 1, baton: true },
    capo: { hp: 24, speed: 2.8, reach: 1.35, windup: 0.5, cooldown: 1.4, damage: 2, drop: 0, armor: true, net: { every: 4.5, warn: 1.3, radius: 1.6 } }
  },

  // ondate: chi entra (in gruppo, al massimo maxActive in campo); `half` = rinforzi quando il primo è a metà
  waves: [
    { label: 'Ondata 1: gli scagnozzi', voice: 'wave1', maxActive: 3, spawn: ['scagnozzo', 'scagnozzo', 'scagnozzo', 'scagnozzo', 'scagnozzo', 'scagnozzo'] },
    { label: 'Ondata 2: i cacciatori', voice: 'wave2', maxActive: 3, spawn: ['cacciatore', 'cacciatore'], half: ['scagnozzo'] },
    { label: 'Ondata 3: il capo', voice: 'boss', maxActive: 3, boss: 'capo', spawn: ['capo'], half: ['scagnozzo', 'scagnozzo'] }
  ],
  bossName: 'Il capo dei cacciatori',

  briefing: {
    goal: 'Supera tre ondate ed esci dalla cucina',
    controls: 'brawl',
    rules: [
      { icon: 'fist', text: 'Pugno premuto più volte: combo di tre colpi. Il terzo manda a terra.' },
      { icon: 'bottle', text: 'Bottiglie contate: i nemici battuti a volte ne lasciano cadere.' },
      { icon: 'stool', text: 'Sgabelli e piatti si raccolgono e si lanciano con lo stesso tasto.' },
      { icon: 'baton', text: 'I cacciatori col manganello colpiscono da più lontano: stagli addosso o lontano.' },
      { icon: 'net', text: 'Il capo segna un bersaglio a terra e lancia la rete: spostati, o perdi una vita.' },
      { icon: 'jukebox', text: 'Colpisci il juke-box: tutti i nemici storditi per qualche secondo. Una volta per ondata.' }
    ],
    tip: 'Tre contro uno non è una rissa, è una statistica. Muoviti in profondità.'
  },

  // battute di Emma (la sente dagli auricolari): testo per i sottotitoli, file audio
  voices: {
    entrata: { url: VOCE + 'rissa-entrata.wav', text: 'Tavola calda, cacciatori di taglie e nessuna uscita. Mi sembra una serata tranquilla.' },
    wave1: { url: VOCE + 'rissa-ondata1.wav', text: 'Arrivano gli scagnozzi. Tanti, ma non svegli.' },
    wave2: { url: VOCE + 'rissa-ondata2.wav', text: 'Due cacciatori col manganello. Tieni le distanze, o accorciale del tutto.' },
    boss: { url: VOCE + 'rissa-capo.wav', text: 'Il capo, con la rete. Guarda a terra e spostati.' },
    jukebox: { url: VOCE + 'rissa-jukebox.wav', text: 'Il juke-box! Finalmente qualcuno con un po’ di gusto musicale.' },
    hit: { url: VOCE + 'rissa-colpito.wav', text: 'Ahia. Questa l’ho sentita anche dagli auricolari.' },
    fine: { url: VOCE + 'rissa-fine.wav', text: 'Fatto. Ora esci dalla cucina, prima che arrivino i rinforzi.' },
    persa: { url: VOCE + 'rissa-persa.wav', text: 'Una vita in meno. Ne abbiamo ancora, vero?' }
  }
};
