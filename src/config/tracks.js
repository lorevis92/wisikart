// Ogni circuito è una curva chiusa (Catmull-Rom) definita da punti di controllo [x, y, z].
// `props` posiziona elementi lungo la pista: t = frazione del giro (0..1), side = distanza laterale
// (negativa a sinistra, positiva a destra), oppure coordinate assolute con `at`.
// Se il GLB indicato in `model` manca, viene usato un modello procedurale con lo stesso nome.

export const TRACKS = [
  {
    id: 'omega65',
    name: 'Spazio Vettore Omega 65',
    subtitle: 'Il collegamento tra Niaboc e Wine Amy. Pareti magnetiche, guida manuale.',
    theme: 'tunnel',
    width: 15,
    laps: 3,
    sky: 'assets/tracks/omega65/sky.png',
    preview: 'assets/tracks/omega65/preview.png',
    palette: {
      road: '#23243a',
      roadLine: '#8fb3ff',
      curb: ['#4c7be8', '#c14cff'],
      wall: '#14102e',
      wallGlow: '#6a4cff',
      fog: '#0a0c24',
      ambient: '#6a5cff',
      sun: '#b0a0ff'
    },
    music: 'omega',
    points: [
      [-270, 0, -10], [-200, 0, 40], [-100, 0, 20], [0, 0, 0], [90, 0, -10], [200, 4, -40],
      [310, 14, -50], [410, 28, 0], [470, 44, 110], [450, 56, 240], [360, 66, 330],
      [220, 62, 370], [80, 48, 340], [-30, 36, 260], [-110, 28, 150], [-230, 26, 90],
      [-350, 30, 10], [-430, 38, -110], [-410, 34, -260], [-300, 22, -350],
      [-150, 10, -370], [-30, 2, -320], [20, 0, -220], [-60, 0, -160], [-160, 0, -130], [-250, 0, -80]
    ],
    startT: 0.12,
    itemBoxes: [0.22, 0.47, 0.72, 0.93],
    boostPads: [0.31, 0.60, 0.84],
    props: [
      { model: 'autovettore', t: 0.38, side: 0, y: 9, scale: 2.2, spin: true },
      { model: 'autovettore', t: 0.66, side: 0, y: 11, scale: 1.8, spin: true }
    ]
  },
  {
    id: 'canair',
    name: 'Canair – Promontorio Utgenra',
    subtitle: 'La casa dei senza patria. Statue scolpite nella roccia e tramonto sul fiume.',
    theme: 'open',
    width: 15,
    laps: 3,
    sky: 'assets/tracks/canair/sky.png',
    preview: 'assets/tracks/canair/preview.png',
    palette: {
      road: '#5c5652',
      roadLine: '#f3e7c8',
      curb: ['#e84c5a', '#fff3d6'],
      wall: '#b08a5a',
      wallGlow: '#ffcf7a',
      fog: '#f2b58a',
      ambient: '#ffd9b0',
      sun: '#ffd28a',
      grass: '#5aa64b',
      rock: '#a3774a'
    },
    music: 'canair',
    points: [
      [0, 0, 0], [110, 0, -8], [230, 2, -30], [330, 6, -90], [380, 14, -200],
      [340, 24, -310], [230, 36, -370], [100, 44, -380], [-20, 40, -330],
      [-90, 32, -230], [-190, 30, -190], [-310, 32, -230], [-390, 28, -330],
      [-500, 18, -350], [-590, 8, -270], [-600, 2, -150], [-520, 0, -60],
      [-420, 0, -20], [-330, 0, 40], [-250, 6, 120], [-140, 10, 150], [-60, 6, 90]
    ],
    startT: 0.02,
    itemBoxes: [0.14, 0.40, 0.62, 0.86],
    boostPads: [0.27, 0.55, 0.79],
    props: [
      { model: 'oremo-giovane', t: 0.315, side: -20, scale: 2.8, faceTrack: true },
      { model: 'oremo-anziano', t: 0.345, side: -20, scale: 2.8, faceTrack: true },
      { model: 'fontana', t: 0.33, side: 24, scale: 1 },
      { model: 'tavola-calda', t: 0.72, side: 24, scale: 1.7, faceTrack: true },
      { model: 'valvo-go', t: 0.92, side: -30, scale: 2.2, faceTrack: true },
      { model: 'blindato', t: 0.55, side: 20, scale: 1.6, faceTrack: true }
    ]
  },
  {
    id: 'niaboc',
    name: 'Niaboc – Deposito Valvo Go',
    subtitle: 'La città sotto le due lune.',
    theme: 'open',
    locked: true,
    preview: 'assets/tracks/niaboc/preview.png'
  },
  {
    id: 'retah',
    name: 'Lago di Retah',
    subtitle: 'Un pianeta piatto, una tavola calda, troppi cacciatori di taglie.',
    theme: 'open',
    locked: true,
    preview: 'assets/tracks/retah/preview.png'
  }
];

export const CUPS = [
  {
    id: 'fuga',
    name: 'Coppa della Fuga',
    desc: 'Due gare, un solo fuggitivo. Vince chi somma più punti.',
    tracks: ['omega65', 'canair']
  }
];

export const trackById = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
export const POINTS_TABLE = [10, 8, 6, 4, 2, 1];
