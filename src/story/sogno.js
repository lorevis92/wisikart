import * as THREE from 'three';
import { PORTALE } from './portale.js';
import { Lommy, Follower, LightZones, Dissolve, Captions, Finish, Still, boxProp } from './sogno-entities.js';

// Livello della Storia: il giorno dopo (capitolo 3). Esplorazione onirica senza game over: la camera di Whiskey,
// buia e vera, dove "prendere la Lommy" apre ogni visione; tre visioni in fila; poi il risveglio, 48 ore dopo.
//   1. battaglia eroica: volo su rotaia nel tunnel, con il motore del Portale ma in una palette eterea
//      (chiara, poco satura, bagliore bianco-violaceo); impossibile perdere (niente gong);
//   2. Sunday: platform contemplativo a bassa gravità (prato-nuvole.png), Sunday cammina mano nella mano con
//      Whiskey tra nuvole → prato → casa → molo (cambiano luci e colori), finché si dissolve in un bagliore;
//   3. il funerale: cammino lento e lineare (funerale.png), madre e fratello immobili accanto alla bara.
// Motore: DreamMode.js, che passa da un livello all'altro (StoryMode per camera e visioni a piedi, FlightMode
// per la battaglia).

const VOCE = 'assets/story/voce/';
const S = 'assets/story/sogno/';
const C = 'assets/story/canair/';

// base comune dei pezzi a piedi (StoryMode): niente bottiglie, niente vite
const walkBase = {
  lives: 3, ammo: 0, maxAmmo: 0, killY: -10, noDeath: true,
  models: { boss: { url: '', h: 1 }, patrol: { url: '', h: 1 } }
};

/** La camera di Whiskey: buia e vera; sul comodino la Lommy. */
const ROOM = {
  ...walkBase,
  id: 'sogno-camera', name: 'La camera', music: 'menu',
  start: { x: 2.5, y: 0 }, noJump: true, speedScale: 0.75,
  background: '#07060c',
  lights: { sky: 0x6a7aa8, ground: 0x1a1420, hemi: 0.35, key: 0x9ab0ff, keyI: 0.5, rim: 0x6a5aaa },
  sections: [{ id: 'camera', bg: null, rect: [-6, -4, 20, 12], fallback: ['#0a0a18', '#14122a', '#08060e'] }],
  checkpoints: [{ x: 2.5, y: 0 }],
  camera: [{ rect: [-20, -20, 40, 40], x: 7, follow: 0.15, y: 2.6, dist: 13 }],
  solids: [
    { r: [-3, 17, -4, 0], style: 'dark' },
    { r: [-4, -1, 0, 8], style: 'dark' },
    { r: [15, 18, 0, 8], style: 'dark' }
  ],
  setup(mode) {
    // letto, comodino, finestra con la luna
    boxProp(mode, [3.2, 0.55, 1.6], '#4a3a5a', 3.5, 0, -0.8);
    boxProp(mode, [0.9, 0.35, 1.5], '#d8d0e8', 2.3, 0.55, -0.8);
    boxProp(mode, [0.8, 0.75, 0.6], '#3a2a20', 12, 0, -0.2);
    const win = boxProp(mode, [2.2, 1.6, 0.05], '#8aa0d8', 8, 2.2, -2.2, { emissive: 0x4a6aaa, emissiveIntensity: 0.8 });
    win.material.transparent = true; win.material.opacity = 0.7;
    const moon = new THREE.PointLight(0x8aa0ff, 6, 12, 1.6);
    moon.position.set(8, 3, -1);
    mode.scene.add(moon);
    mode.lommy = mode.add(new Lommy({ x: 12, y: 0.75 }), false);
  }
};

/** Visione 1: la battaglia eroica, su rotaia nel tunnel del Portale, in luce eterea. Non si perde. */
const BATTLE = {
  ...PORTALE,
  id: 'sogno-battaglia', name: 'Visione: la battaglia eroica',
  music: 'volo',
  time: 999, noTimer: true, // niente gong: non si può arrivare tardi
  endT: 0.37, // breve: dalla partenza a poco dopo il tunnel
  rings: PORTALE.rings.filter((r) => r.t < 0.36),
  goldRings: PORTALE.goldRings.filter((r) => r.t < 0.36),
  barriers: [],
  bridge: null,
  medals: null,
  cinematic: null,
  voices: {},
  palette: { road: '#d8d0ee', roadLine: '#ffffff', curb: ['#c8b8ff', '#ffffff'], wall: '#d0c8ec', wallGlow: '#f4ecff', fog: '#ece4ff', ambient: '#ffffff', sun: '#f6eeff', ground: '#cfc6e8' },
  world: { night: false, lamps: false, fog: [80, 600] },
  ethereal: { sky: '#e8e0fa', fog: '#ece4ff', near: 60, far: 520, light: 1.4 }
};

/** Visione 2: Sunday, mano nella mano, a bassa gravità. */
const SUNDAY = {
  ...walkBase,
  id: 'sogno-sunday', name: 'Visione: Sunday', music: 'retah',
  start: { x: 0, y: 0 }, gravityScale: 0.45,
  background: '#dfe8ff',
  lights: { sky: 0xffffff, ground: 0xc8d8ff, hemi: 0.9, key: 0xfff4e0, keyI: 1.2, rim: 0xffd8f0 },
  sections: [
    { id: 'nuvole', bg: S + 'prato-nuvole.png', rect: [-8, -6, 34, 16], fallback: ['#e8f0ff', '#cfdcff', '#ffffff'] },
    { id: 'prato', bg: S + 'prato-nuvole.png', rect: [34, -6, 64, 16], fallback: ['#d8f0c8', '#b8e0a0', '#8ac070'] },
    { id: 'casa', bg: S + 'prato-nuvole.png', rect: [64, -6, 92, 16], fallback: ['#ffe0b8', '#f0c890', '#c8a070'] },
    { id: 'molo', bg: S + 'prato-nuvole.png', rect: [92, -6, 130, 16], fallback: ['#ffd0d8', '#e8a8c0', '#8aa0c8'] }
  ],
  checkpoints: [{ x: 0, y: 0 }, { x: 34, y: 0 }, { x: 64, y: 0 }, { x: 92, y: 0 }],
  solids: [
    // nuvole: si salta piano dall'una all'altra
    { r: [-6, 8, -2, 0], style: 'cloud' },
    { r: [11, 17, -2, 0.8], style: 'cloud' },
    { r: [20, 27, -2, 1.6], style: 'cloud' },
    { r: [30, 34, -2, 0.6], style: 'cloud' },
    // prato e casa
    { r: [34, 92, -4, 0], style: 'meadow' },
    // il molo sull'acqua
    { r: [92, 124, -0.6, 0], style: 'pier' }
  ],
  setup(mode) {
    const sunday = new Follower(mode.level.rigs && mode.level.rigs.sunday);
    mode.add(sunday, false);
    mode.add(new LightZones([
      { x: -99, name: 'Tra le nuvole', sky: '#e4ecff', light: '#ffffff', ground: '#c8d8ff', hemi: 1.0 },
      { x: 34, name: 'Il prato', sky: '#d4f0c0', light: '#fff4c8', ground: '#7ab05a', hemi: 0.95 },
      { x: 64, name: 'La casa', sky: '#ffdcb0', light: '#ffd090', ground: '#a08060', hemi: 0.85 },
      { x: 92, name: 'Il molo', sky: '#ffbcd0', light: '#ffc8d8', ground: '#6a8ab0', hemi: 0.8 }
    ], mode), false);
    mode.add(new Captions([
      { x: 1, text: 'Sunday ti prende la mano.' },
      { x: 40, text: 'L’erba è tiepida, come una domenica senza sveglia.' },
      { x: 70, text: 'La casa ha le finestre accese. Qualcuno vi aspetta, o vi ha aspettato.' },
      { x: 96, text: 'Il molo finisce sull’acqua. Lei rallenta.' }
    ]), false);
    // la casa (suggerita) e l'acqua sotto il molo
    boxProp(mode, [6, 4, 4], '#f2e6c8', 78, 0, -3);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.4, 4), new THREE.MeshStandardMaterial({ color: 0xb8563a }));
    roof.position.set(78, 5.2, -3); roof.rotation.y = Math.PI / 4;
    mode.scene.add(roof);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), new THREE.MeshStandardMaterial({ color: 0x8ab0d8, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(110, -1.2, -4);
    mode.scene.add(water);
    mode.add(new Dissolve({ x: 116, delay: 3.8, text: 'Sunday si scioglie in un bagliore di luce.' }, sunday), false);
  }
};

/** Visione 3: il funerale. Solo camminare, piano. */
const FUNERAL = {
  ...walkBase,
  id: 'sogno-funerale', name: 'Visione: il funerale', music: 'menu',
  start: { x: 0, y: 0 }, noJump: true, speedScale: 0.42,
  background: '#1a1820',
  lights: { sky: 0xc8c0d8, ground: 0x2a2630, hemi: 0.6, key: 0xfff0d8, keyI: 0.8, rim: 0x8a7aaa },
  sections: [{ id: 'funerale', bg: S + 'funerale.png', rect: [-6, -4, 34, 14], fallback: ['#3a3640', '#2a2630', '#1a1820'] }],
  checkpoints: [{ x: 0, y: 0 }],
  camera: [{ rect: [-20, -20, 60, 40], yOff: 2.2, dist: 15 }],
  models: { ...walkBase.models, madre: { url: C + 'madre-jesoff.glb', h: 1.7 }, fratello: { url: C + 'fratello-jesoff.glb', h: 1.8 } },
  solids: [{ r: [-3, 34, -4, 0], style: 'dark' }, { r: [-4, -1, 0, 8], style: 'dark' }],
  setup(mode) {
    const M = mode.models;
    // la bara su un catafalco, i ceri
    boxProp(mode, [2.6, 0.7, 1.2], '#2a2024', 20, 0, -0.9);
    boxProp(mode, [2.3, 0.6, 0.9], '#5a3a2a', 20, 0.7, -0.9, { roughness: 0.5 });
    for (const x of [18.4, 21.6]) {
      boxProp(mode, [0.12, 1.2, 0.12], '#e8e0d0', x, 0, -0.9);
      const l = new THREE.PointLight(0xffc070, 3, 5, 1.8);
      l.position.set(x, 1.4, -0.9);
      mode.scene.add(l);
    }
    mode.add(new Still(M.madre, { x: 22.8, z: -0.9, yaw: -0.7 }), false);
    mode.add(new Still(M.fratello, { x: 24.2, z: -1.1, yaw: -0.5 }), false);
    mode.add(new Captions([
      { x: 2, text: 'Le scarpe fanno troppo rumore, qui dentro.' },
      { x: 10, text: 'Nessuno dice niente.' },
      { x: 17, text: 'Tua madre non alza lo sguardo. Tuo fratello sì.' }
    ]), false);
    mode.add(new Finish({ x: 25.5, text: '', time: 3 }), false);
  }
};

export const SOGNO = {
  id: 'sogno', // stesso id dell'ingresso in piazza: è la chiave del salvataggio
  type: 'dream',
  name: 'Il giorno dopo',
  subtitle: 'Quarantotto ore, una Lommy e tre visioni.',
  preview: S + 'prato-nuvole.png',
  music: 'menu',
  loadingText: 'Chiudo le tende…',
  completeMessage: 'Quarantotto ore dopo. Canair è sveglia, e Infinity Guitars ha la saracinesca alzata.',
  steps: ['room', 'battle', 'room', 'sunday', 'room', 'funeral', 'wake'],
  room: ROOM, battle: BATTLE, sunday: SUNDAY, funeral: FUNERAL,
  sundayModel: { url: C + 'sunday.glb', h: 1.65 },
  wake: ['Whiskey apre gli occhi.', 'Quarantotto ore dopo.'],

  briefing: {
    goal: 'Prendi la Lommy e attraversa le tre visioni',
    controls: 'platform',
    rules: [
      { icon: 'lommy', text: 'Nella camera, avvicinati alla Lommy sul comodino e premi Lancia (o Su, o Salta): si apre una visione.' },
      { icon: 'leader', text: 'Visione 1, la battaglia: voli nel tunnel, spari e sterzi come al Portale. Non si può perdere.' },
      { icon: 'sunday', text: 'Visione 2, Sunday: cammina e salta piano, a bassa gravità. Lei ti tiene per mano.' },
      { icon: 'candle', text: 'Visione 3, il funerale: si cammina soltanto, piano.' },
      { icon: 'heart', text: 'Niente game over: se cadi, riparti da poco prima.' }
    ],
    tip: 'Prenditi il tempo che ti serve. Io aspetto qui fuori.'
  },

  voices: {
    arrivo: { url: VOCE + 'sogno-arrivo.wav', text: 'Quarantotto ore chiuso in camera. Io sono rimasta parcheggiata fuori a chiedermi se stessi bene.' }
  }
};
