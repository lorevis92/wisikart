import { Assets } from '../core/AssetLoader.js';
import { Conveyor, CoinCrate, SteamValve, Gate, Lever, Badge, Shutter, HangarAlarm, ParkedCar } from './valvo-entities.js';
import * as THREE from 'three';

// Livello 2 della Storia: il Deposito Valvo & Go (Niaboc). Il deposito dove Whiskey lavorava: deve arrivare
// all'hangar in fondo, dove è parcheggiato il suo autovettore (Emma), per lasciare Niaboc.
// Platform industriale in tre sezioni, senza boss: scaffali, sala valvole, hangar a tempo.
// Stesse convenzioni di stadio.js (metri, x a destra, y in alto). Fisica del salto: ≈ 3 m in alto, ≈ 6 m in
// lungo da terra; i getti di vapore lanciano a ≈ 6,5 m; la scivolata abbassa Whiskey a 0,85 m.

const V = 'assets/story/valvo/';

export const VALVO = {
  id: 'deposito', // stesso id dell'ingresso in piazza: è la chiave del salvataggio
  name: 'Deposito Valvo & Go',
  subtitle: 'Scaffali, vapore e un allarme. In fondo all’hangar c’è un vecchio amico.',
  preview: V + 'hangar.png',
  music: 'valvo',
  loadingText: 'Timbro il cartellino…',
  buildingText: 'Impilo le casse…',
  enemiesText: 'Accendo i carrelli…',
  start: { x: 2, y: 0 },
  lives: 5,
  ammo: 4,
  maxAmmo: 9,
  coins: true,
  killY: -8,
  background: '#0a0c1a',
  completeMessage: 'Livello completato: Deposito Valvo & Go. Emma è con te, e il Portale di Niaboc è aperto.',
  lights: { sky: 0xbfd0ff, ground: 0x2a2a3a, hemi: 1.1, key: 0xfff1dd, keyI: 1.4, rim: 0x6aa8ff },

  models: {
    crate: { url: V + 'cassa.glb', h: 1.2 },
    cart: { url: V + 'carrello.glb', h: 1.5 },
    valve: { url: V + 'valvola.glb', h: 1.4 },
    car: { url: 'assets/props/autovettore.glb', h: 2.6 }
  },

  sections: [
    { id: 'scaffali', bg: V + 'scaffali.png', rect: [-8, -4, 96, 16], fallback: ['#10142a', '#2a3050', '#1a1a24'] },
    { id: 'valvole', bg: V + 'valvole.png', rect: [96, -4, 187, 18], fallback: ['#0e1a22', '#2a4a50', '#12181c'] },
    { id: 'hangar', bg: V + 'hangar.png', rect: [187, -4, 313, 16], fallback: ['#140a14', '#3a1a2a', '#10080c'] }
  ],

  checkpoints: [
    { x: 2, y: 0 },
    { x: 36, y: 0 },
    { x: 72, y: 0 },
    { x: 98, y: 0, label: 'Sala valvole' },
    { x: 121, y: 0 },
    { x: 173, y: 0 },
    { x: 190, y: 0, label: 'Hangar' }
  ],

  // nell'hangar c'è il soffitto: telecamera ferma in altezza
  camera: [
    { rect: [187, -20, 320, 40], yOff: 2.4, y: 4.6, dist: 19 }
  ],
  lamps: [[10, 7], [44, 7], [80, 7], [110, 9, 0x9fe0ff, 10], [150, 9, 0x9fe0ff, 10]],

  solids: [
    // --- scaffali ---
    { r: [-9, -6, -12, 24], style: 'concrete' },
    { r: [-6, 30, -12, 0], style: 'floor' },
    { r: [8, 9.2, 0, 1.2], style: 'crate' },
    { r: [12, 14.4, 0, 2.4], style: 'crate' },
    { r: [16.4, 18.8, 0, 3.6], style: 'crate' },
    // fossa 30..35
    { r: [35, 38, -12, 0], style: 'floor' },
    // 38..50 nastro a terra (entità)
    { r: [50, 56, -12, 0], style: 'floor' },
    { r: [54.8, 56, 0, 1.2], style: 'crate' },
    // fossa larga 56..71, attraversata dal nastro sospeso (entità)
    { r: [71, 96, -12, 0], style: 'floor' },
    { r: [79, 80.2, 0, 1.2], style: 'crate' },
    { r: [80.2, 82.6, 0, 2.4], style: 'crate' },
    // --- sala valvole ---
    { r: [96, 187, -12, 0], style: 'floor' },
    // --- hangar ---
    { r: [187, 310, -12, 0], style: 'floor' },
    { r: [187, 310, 9, 12], style: 'metal' }, // soffitto
    { r: [220, 221.2, 0, 1.2], style: 'crate' },
    { r: [248, 249.2, 0, 1.2], style: 'crate' },
    { r: [310, 313, -12, 24], style: 'concrete' }
  ],

  // grate alte raggiungibili solo col vapore (si attraversano dal basso)
  platforms: [
    { r: [104.5, 114, 5.2], style: 'grate' },
    { r: [154, 162, 5.2], style: 'grate' }
  ],

  pickups: [
    { x: 17.6, y: 3.6, kind: 'bottle', amount: 2 },
    { x: 79.6, y: 1.2, kind: 'bottle', amount: 2 },
    { x: 109, y: 5.2, kind: 'bottle', amount: 2 },
    { x: 158, y: 5.2, kind: 'bottle', amount: 2 }
  ],

  // carrelli-droide che pattugliano i corridoi degli scaffali
  stewards: [
    { x0: 22.5, x1: 29.5, y: 0, model: 'cart', speed: 2.6, w: 1.1, h: 1.5, stunText: 'Carrello in tilt' },
    { x0: 84, x1: 94, y: 0, model: 'cart', speed: 3, w: 1.1, h: 1.5, stunText: 'Carrello in tilt' }
  ],

  setup(mode) {
    const M = mode.models;
    mode.flags = { badge: false };
    mode.gates = {};
    // --- scaffali: nastri e casse con monete ---
    mode.add(new Conveyor({ x0: 38, x1: 50, y: 0, depth: 12, speed: 3.5, period: 3.2, dir: 1 }, mode), false);
    mode.add(new Conveyor({ x0: 57, x1: 70, y: 2.4, depth: 0.6, speed: 3, period: 3.6, dir: -1 }, mode), false);
    mode.add(new CoinCrate({ x: 21.2, y: 0, coins: 3 }, mode, M.crate), false);
    mode.add(new CoinCrate({ x: 81.4, y: 2.4, coins: 5 }, mode, M.crate), false);
    mode.add(new CoinCrate({ x: 137, y: 0, coins: 3 }, mode, M.crate), false);
    // --- sala valvole ---
    // getti verso l'alto: trampolini per le grate
    mode.add(new SteamValve({ x: 102, y: 0, dir: 'up', period: 3.2, on: 1.3 }, M.valve), false);
    mode.add(new SteamValve({ x: 151.5, y: 0, dir: 'up', period: 3.2, on: 1.3, offset: 1.6 }, M.valve), false);
    // getti laterali: spingono indietro chi prova a passare mentre soffiano
    mode.add(new SteamValve({ x: 133, y: 0, dir: -1, period: 2.6, on: 1.1, len: 6 }, M.valve), false);
    mode.add(new SteamValve({ x: 147, y: 0, dir: -1, period: 2.6, on: 1.1, len: 6, offset: 1.3 }, M.valve), false);
    // leve (da colpire con una bottiglia dalla grata alta) e paratie
    for (const g of [
      { id: 'g1', x0: 118, x1: 119.2, y0: 0, y1: 8 },
      { id: 'g2', x0: 170, x1: 171.2, y0: 0, y1: 8 },
      { id: 'hangar', x0: 186, x1: 187.2, y0: 0, y1: 9 }
    ]) mode.gates[g.id] = mode.add(new Gate(g, mode), false);
    mode.add(new Lever({ x: 116.5, y: 5.9, gate: 'g1' }, mode), false);
    mode.add(new Lever({ x: 164.5, y: 5.9, gate: 'g2' }, mode), false);
    // --- hangar a tempo ---
    const shutters = [200, 214, 228, 242, 256, 270, 284].map((x) => mode.add(new Shutter({ x, top: 9 }, mode), false));
    const droids = [[204, 211], [231, 239], [259, 267]].map(([x0, x1]) => mode.addPatrol({ x0, x1, y: 0, model: 'cart', speed: 3.6, w: 1.1, h: 1.5, stunText: 'Carrello in tilt', hidden: true }));
    const car = mode.add(new ParkedCar({ x: 300, y: 0 }, M.car), false);
    const alarm = mode.add(new HangarAlarm({ shutters, startX: 188, finishX: 296, checkpoint: 6, droids, car }, mode), false);
    // il badge, in fondo alla sala valvole: apre l'hangar e fa scattare l'allarme
    const badge = new Badge({ x: 180, y: 0 }, null, () => {
      mode.flags.badge = true;
      mode.extraHud.badge = true;
      mode.sfx('pickup');
      mode.gates.hangar.open();
      alarm.start();
    });
    mode.add(badge, false);
    // l'icona del badge (badge.png) arriva dopo: sostituisce la tessera verde se il file c'è
    Assets.texture(V + 'badge.png').then((tex) => {
      if (!tex) return;
      badge.card.material = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false });
    });
  }
};
