// Livello 4 della Storia: rissa alla tavola calda di Retah. Brawler in una stanza 3D vera (story/diner.js):
// pavimento a scacchi, finestre sul lago al tramonto, bancone, tavoli, divanetti e juke-box che fanno da
// ostacoli solidi (ci si gira intorno e ci si passa dietro), telecamera fissa di tre quarti che segue appena.
// Tre ondate: scagnozzi, due cacciatori col manganello, il capo con la rete. Vinta la terza si esce dalla
// cucina e una breve scena porta Whiskey sul retro, all'autovettore di Emma: da lì parte il livello 5 (next).
// Coordinate in metri: x = destra/sinistra, z = profondità (negativo = verso le finestre sul fondo), y = quota.
// Motore: BrawlMode.js.

const VOCE = 'assets/story/voce/';
const R = 'assets/story/retah/';

export const RISSA = {
  id: 'rissa', // stesso id dell'ingresso in piazza: è la chiave del salvataggio
  type: 'brawl',
  name: 'Rissa alla tavola calda',
  subtitle: 'Tre ondate di cacciatori di taglie tra il bancone e la cucina.',
  preview: R + 'tavola-interno.png',
  music: 'rissa',
  loadingText: 'Apparecchio la tavola calda…',
  completeMessage: 'Fuori dalla cucina, e tutto intero. Emma ti aspetta sul retro, nel suo autovettore.',
  next: 'inseguimento', // finita la rissa si sale su Emma e si parte (dal menu si può tornare in piazza)

  lives: 3,
  health: 7, // colpi che si incassano prima di perdere una vita (la rete del capo toglie la vita intera)
  ammo: 3,
  maxAmmo: 6,
  // dove si possono muovere i personaggi (dentro le pareti; gli arredi sono ostacoli a parte)
  arena: { x0: -12.1, x1: 12.1, z0: -5.3, z1: 4.0 },

  models: {
    scagnozzo: { url: R + 'scagnozzo.glb', h: 1.75 },
    cacciatore: { url: R + 'cacciatore.glb', h: 1.95 },
    capo: { url: R + 'capo.glb', h: 2.15 },
    sgabello: { url: R + 'sgabello.glb', h: 0.85 },
    piatto: { url: R + 'piatto.glb', h: 0.34 },
    jukebox: { url: R + 'jukebox.glb', h: 2.0 },
    bancone: { url: R + 'bancone.glb', h: 1.1 },
    tavolo: { url: R + 'tavolo.glb', h: 0.85 },
    divanetto: { url: R + 'divanetto.glb', h: 1.1 },
    porta: { url: R + 'porta-cucina.glb', h: 2.4 },
    lampada: { url: R + 'lampada.glb', h: 1.1 },
    bottle: { url: 'assets/story/stadio/bottiglia.glb', h: 0.5 },
    diner: { url: 'assets/props/tavola-calda.glb', h: 7 },
    car: { url: 'assets/props/autovettore.glb', h: 2.2 }
  },
  sky: 'assets/tracks/retah/sky.png',

  // la stanza: pareti (x0..x1, fondo a `back`), finestre sul fondo (tratti di x), porta della cucina a destra,
  // arredi fissi (rot in gradi; la loro impronta diventa un ostacolo), lampade appese
  room: {
    x0: -12.6, x1: 12.6, back: -5.8, frontWall: 3.4, floorFront: 7.5, height: 4.4,
    leftWallH: 1.4, rightWallH: 3.0,
    windows: [[-9, -5], [-4.1, -0.9], [1, 5], [6, 10]], sill: 1.15, top: 3.7,
    door: { z: -1.6, h: 2.4 },
    jukebox: { x: -2.5, z: -5.2 },
    furniture: [
      // bancone lungo il lato sinistro (tre moduli in fila)
      { model: 'bancone', x: -11.2, z: -4.1, rot: 90, h: 1.1 },
      { model: 'bancone', x: -11.2, z: -2.0, rot: 90, h: 1.1 },
      { model: 'bancone', x: -11.2, z: 0.1, rot: 90, h: 1.1 },
      // due tavoli con i divanetti contro il fondo, a destra
      { model: 'divanetto', x: 3.1, z: -4.7, rot: 90, h: 1.1 },
      { model: 'tavolo', x: 4.4, z: -4.7, h: 0.85 },
      { model: 'divanetto', x: 5.7, z: -4.7, rot: -90, h: 1.1 },
      { model: 'divanetto', x: 7.4, z: -4.7, rot: 90, h: 1.1 },
      { model: 'tavolo', x: 8.7, z: -4.7, h: 0.85 },
      { model: 'divanetto', x: 10.0, z: -4.7, rot: -90, h: 1.1 },
      // due tavolini in mezzo: riparo o spazio da sfruttare, senza chiudere il centro
      { model: 'tavolo', x: 3.2, z: 1.2, h: 0.85 },
      { model: 'tavolo', x: -5.6, z: 2.2, h: 0.85 }
    ],
    lamps: [[-11.2, -3.2], [-11.2, -0.4], [4.4, -4.7], [8.7, -4.7], [3.2, 1.2], [-5.6, 2.2], [-1, -1.5]],
    lampY: 3.0
  },
  // da dove entrano i nemici: dalla porta della cucina e dall'ingresso sul davanti a sinistra
  spawns: [{ x: 13.4, z: -1.6, tx: 10.6 }, { x: -13.4, z: 3.0, tx: -9.6 }],

  // il juke-box contro la parete di fondo: colpito (pugno o lancio) stordisce tutti i nemici, una volta per ondata
  jukebox: { x: -2.5, z: -5.2, stun: 4 },
  // porta della cucina, da cui si esce vinta la terza ondata
  exit: { x: 11.4, z: -1.6 },

  // sgabelli e piatti da raccogliere e lanciare; respawn = ricompare a ogni ondata se è stato usato
  // (y = appoggiato sul bancone o su un tavolo)
  props: [
    { kind: 'stool', x: -10.0, z: -4.0, respawn: true },
    { kind: 'stool', x: -10.0, z: -2.5 },
    { kind: 'stool', x: -10.0, z: -1.0, respawn: true },
    { kind: 'stool', x: -10.0, z: 0.5 },
    { kind: 'stool', x: 2.1, z: 1.2, respawn: true },
    { kind: 'stool', x: 4.3, z: 1.2 },
    { kind: 'stool', x: -0.5, z: 2.6 },
    { kind: 'plate', x: 3.2, z: 1.2, y: 0.86, respawn: true },
    { kind: 'plate', x: -5.6, z: 2.2, y: 0.86, respawn: true },
    { kind: 'plate', x: -11.2, z: -2.0, y: 1.11, respawn: true },
    { kind: 'plate', x: 7.0, z: 0.4 }
  ],

  // nemici: hp, velocità, portata del colpo, carica prima del colpo, pausa tra un colpo e l'altro,
  // probabilità di lasciare bottiglie; armor = i colpi leggeri non lo fermano; il capo in più lancia la rete (ogni `every` secondi, bersaglio a terra)
  enemies: {
    scagnozzo: { hp: 5, speed: 3.4, reach: 1.2, windup: 0.45, cooldown: 1.45, damage: 1, drop: 0.45 },
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
