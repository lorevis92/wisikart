// Livello 1 della Storia: lo Stadio di Space Ball.
// Coordinate in metri sul piano di gioco (x verso destra, y verso l'alto, z = profondità solo scenica).
// Fisica del personaggio (Player.js): salto ≈ 3 m di altezza, ≈ 6 m di distanza da fermo a terra,
// ≈ 7,9 m partendo dalla traversa alta di una porta. Le misure qui sotto sono pensate su questi valori.
//
// solids     blocchi pieni [x0, x1, y0, y1] con uno stile scenico
// platforms  piattaforme attraversabili dal basso [x0, x1, y] (si sale da sotto, si sta sopra)
// crumbles   file di sedili che crollano poco dopo che ci si sale [x0, x1, y]
// ladders    scale { x, y0, y1 }: y1 coincide con la piattaforma d'arrivo

const S = 'assets/story/stadio/';

export const STADIO = {
  id: 'stadio',
  name: 'Stadio di Space Ball',
  subtitle: 'Gradinate, campo, spogliatoi. E in cima, il Tifoso Supremo.',
  preview: S + 'campo.png',
  music: 'stadio',
  bossMusic: 'boss',
  start: { x: 2, y: 0 },
  lives: 5,
  ammo: 3,
  maxAmmo: 9,
  killY: -8,

  // sfondi: ogni immagine copre il suo rettangolo [x0, y0, x1, y1] e scorre in parallasse
  sections: [
    { id: 'gradinate', bg: S + 'gradinate.png', rect: [-8, -4, 96, 16], fallback: ['#1b2a6b', '#3fb6c9', '#7a3fa8'] },
    { id: 'campo', bg: S + 'campo.png', rect: [96, -4, 192, 16], fallback: ['#0b0a24', '#2a1a5a', '#6a2fa0'] },
    { id: 'tunnel', bg: S + 'tunnel.png', rect: [192, -2, 228, 45], fallback: ['#0a1a22', '#1f4a4a', '#0a1418'] },
    { id: 'arena', bg: S + 'gradinate.png', rect: [192, 45, 228, 66], fallback: ['#1b2a6b', '#3fb6c9', '#7a3fa8'] }
  ],

  // punto di ripartenza dopo una caduta nel vuoto: si attiva passandoci sopra
  checkpoints: [
    { x: 2, y: 0 },
    { x: 94, y: 0 },
    { x: 170, y: 0 },
    { x: 200, y: 0, label: 'Tunnel degli spogliatoi' },
    { x: 200, y: 46, label: 'Arena' }
  ],

  solids: [
    // --- gradinate: file di sedili a gradoni, con il vuoto in mezzo ---
    { r: [-9, -6, -12, 22], style: 'wall' },
    { r: [-6, 10, -12, 0], style: 'stand' },
    { r: [12.5, 19, -12, 1.2], style: 'stand' },
    { r: [26.5, 36, -12, 2.2], style: 'stand' },
    { r: [48.5, 58, -12, 2.0], style: 'stand' },
    { r: [60, 66, -12, 3.2], style: 'stand' },
    { r: [68, 78, -12, 1.0], style: 'stand' },
    // --- campo: terreno continuo, una panchina e il fossato largo dopo la porta alta ---
    { r: [90, 160, -12, 0], style: 'field' },
    { r: [152, 154, 0, 1.6], style: 'bench' },
    { r: [166.6, 226, -12, 0], style: 'field' },
    // --- tunnel degli spogliatoi ---
    { r: [226, 229, -12, 66], style: 'brick' },
    { r: [193, 196, 4.5, 46], style: 'brick' },
    // --- arena in cima ---
    { r: [192, 196, 46, 66], style: 'brick' }
  ],

  platforms: [
    // traverse delle porte: sotto si passa, sopra si sale
    { r: [114.5, 117.5, 3.4], style: 'goal' },
    { r: [133, 136, 3.4], style: 'goal' },
    { r: [154, 160, 4.2], style: 'goal' },
    // grate del tunnel
    { r: [205, 226, 8], style: 'grate' },
    { r: [196, 214, 16], style: 'grate' },
    { r: [206, 226, 24], style: 'grate' },
    { r: [196, 220, 32], style: 'grate' },
    { r: [208, 213, 34.2], style: 'grate' },
    { r: [215.5, 220.5, 36.4], style: 'grate' },
    { r: [208, 213, 38.6], style: 'grate' },
    { r: [200, 205.5, 40.8], style: 'grate' },
    // pavimento dell'arena (ci si arriva dalla scala che lo attraversa)
    { r: [196, 226, 46], style: 'arena' }
  ],

  crumbles: [
    [21.5, 24, 2.2],
    [38.5, 41, 3.4],
    [43.5, 46, 3.4],
    [80.5, 83, 2.2],
    [85, 87.5, 3.0]
  ],

  ladders: [
    { x: 223.5, y0: 0, y1: 8 },
    { x: 207, y0: 8, y1: 16 },
    { x: 211, y0: 16, y1: 24 },
    { x: 218, y0: 24, y1: 32 },
    { x: 202.5, y0: 40.8, y1: 46 }
  ],

  // tifosi che ondeggiano: da scavalcare
  fans: [
    { x: 16, y: 1.2, phase: 0 },
    { x: 52, y: 2.0, phase: 1.3 },
    { x: 73, y: 1.0, phase: 2.1 }
  ],
  // tifosi con la sciarpa: sciarpa giù = saltala, sciarpa su = passaci sotto
  scarves: [
    { x: 31, y: 2.2, phase: 0 },
    { x: 63, y: 3.2, phase: 1.4 }
  ],
  // bottiglie e secchi dagli spalti: posizioni fisse a turno, a intervalli regolari
  droppers: [
    { x0: 28, x1: 35, y: 2.2, period: 1.6, offset: 0.2 },
    { x0: 50, x1: 57, y: 2.0, period: 1.4, offset: 0.7 },
    { x0: 69, x1: 77, y: 1.0, period: 1.1, offset: 0.1 }
  ],

  // palle spaziali a pendolo sul campo
  pendulums: [
    { x: 124, y: 12.5, length: 11, amp: 1.0, period: 3.0, phase: 0 },
    { x: 143, y: 12.5, length: 11, amp: 1.05, period: 2.7, phase: 1.6 },
    { x: 181, y: 12.5, length: 11, amp: 1.1, period: 2.4, phase: 0.8 }
  ],
  // porte (la traversa è in `platforms`): x = centro, top = altezza della traversa
  goals: [
    { x: 116, top: 3.4, width: 3 },
    { x: 134.5, top: 3.4, width: 3 },
    { x: 157, top: 4.2, width: 6 }
  ],

  pickups: [
    { x: 33, y: 2.2, kind: 'bottle', amount: 2 },
    { x: 64, y: 3.2, kind: 'bottle', amount: 2 },
    { x: 129, y: 0, kind: 'rack', amount: 6 },
    { x: 210, y: 16, kind: 'bottle', amount: 2 },
    { x: 199.5, y: 32, kind: 'crate', amount: 6 }
  ],

  stewards: [
    { x0: 209.5, x1: 221, y: 8 },
    { x0: 198, x1: 209, y: 16 },
    { x0: 207, x1: 216, y: 24 }
  ],

  boss: { x: 220, y: 46, x0: 214, x1: 223, hp: 3, trigger: 45 }
};
