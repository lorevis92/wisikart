// Ogni circuito è una curva chiusa (Catmull-Rom) definita da punti di controllo [x, y, z].
// `props` posiziona elementi lungo la pista: t = frazione del giro (0..1), side = distanza laterale
// (negativa a sinistra, positiva a destra), oppure coordinate assolute con `at`.
// Se il GLB indicato in `model` manca, viene usato un modello procedurale con lo stesso nome.
// `grid` è il video della griglia di partenza mostrato durante il caricamento (se manca resta l'anteprima).
// `faceTrack` gira il fronte dell'oggetto verso la pista, `alignTrack` lo allinea alla direzione di marcia
// (per gli archi che scavalcano la carreggiata).
// `world` (solo tema open, tutto opzionale) regola lo scenario; senza, vale il paesaggio di Canair:
//   night      luci notturne: finestre accese, neon, luna al posto del sole
//   flat       terreno perfettamente piatto (niente colline)
//   trees, rocks, bushes   quanti alberi, rocce e cespugli spargere
//   city       intervalli [da, a] di t con palazzi ai lati; cityStep = passo tra i palazzi; neon = probabilità di insegna
//   lamps      lampioni a luce calda lungo il guardrail
//   lake       { from, to, side, reach }: lago calmo su un lato tra due valori di t
//   fog        [vicino, lontano] della nebbia

export const TRACKS = [
  {
    id: 'omega65',
    name: 'Spazio Vettore Omega 65',
    short: 'Omega 65',
    subtitle: 'Il collegamento tra Niaboc e Wine Amy. Pareti magnetiche, guida manuale.',
    theme: 'tunnel',
    width: 15,
    laps: 3,
    sky: 'assets/tracks/omega65/sky.png',
    preview: 'assets/tracks/omega65/preview.png',
    grid: 'assets/video/griglia.mp4',
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
    short: 'Canair',
    subtitle: 'La casa dei senza patria. Statue scolpite nella roccia e tramonto sul fiume.',
    theme: 'open',
    width: 15,
    laps: 3,
    sky: 'assets/tracks/canair/sky.png',
    preview: 'assets/tracks/canair/preview.png',
    grid: 'assets/tracks/canair/griglia.mp4',
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
    short: 'Niaboc',
    subtitle: 'La città sotto le due lune. Il deposito dove tutto è cominciato.',
    theme: 'open',
    width: 15,
    laps: 3,
    sky: 'assets/tracks/niaboc/sky.png',
    preview: 'assets/tracks/niaboc/preview.png',
    grid: 'assets/tracks/niaboc/griglia.mp4',
    palette: {
      road: '#262a3d',
      roadLine: '#c9b8ff',
      curb: ['#9b4cff', '#f2f0ff'],
      wall: '#3a3358',
      wallGlow: '#ff6fd8',
      fog: '#080b1e',
      ambient: '#8a78c0',
      sun: '#ffb8e0',
      ground: '#171630',
      grass: '#2c2c3e',
      rock: '#4a4658'
    },
    // variante notturna e urbana del tema open
    world: {
      night: true,
      trees: 50,
      rocks: 20,
      city: [[0, 1]],
      cityStep: 0.011,
      neon: 0.85,
      lamps: true,
      fog: [260, 1400]
    },
    music: 'niaboc',
    points: [
      [0, 0, 0], [120, 0, 0], [240, 3, -20], [330, 8, -90], [350, 14, -200], [300, 18, -300],
      [190, 20, -350], [70, 18, -330], [10, 14, -250], [-60, 12, -180], [-160, 14, -160],
      [-260, 18, -200], [-330, 22, -290], [-420, 20, -360], [-520, 14, -330], [-570, 8, -230],
      [-540, 4, -120], [-460, 2, -40], [-380, 6, 30], [-280, 10, 70], [-170, 8, 60], [-80, 3, 20]
    ],
    startT: 0.02,
    itemBoxes: [0.15, 0.42, 0.64, 0.87],
    boostPads: [0.30, 0.56, 0.80],
    props: [
      { model: 'valvo-go', t: 0.10, side: -34, scale: 2.2, faceTrack: true },
      { model: 'autovettore', t: 0.082, side: -21, scale: 1.4, faceTrack: true },
      { model: 'autovettore', t: 0.118, side: -22, scale: 1.4, faceTrack: true },
      { model: 'portale-niaboc', t: 0.55, side: 0, scale: 1, alignTrack: true },
      { model: 'blindato', t: 0.75, side: 21, scale: 1.6, faceTrack: true }
    ]
  },
  {
    id: 'retah',
    name: 'Lago di Retah',
    short: 'Retah',
    subtitle: 'Un pianeta piatto, un lago, una tavola calda. E troppi cacciatori di taglie.',
    theme: 'open',
    width: 15,
    laps: 3,
    sky: 'assets/tracks/retah/sky.png',
    preview: 'assets/tracks/retah/preview.png',
    grid: 'assets/tracks/retah/griglia.mp4',
    palette: {
      road: '#a08d74',
      roadLine: '#fff1d6',
      curb: ['#f07a2e', '#fff0d2'],
      wall: '#c9a27a',
      wallGlow: '#ffc27a',
      fog: '#f4a7a0',
      ambient: '#ffd2b8',
      sun: '#ffc88a',
      ground: '#b8916a',
      grass: '#d9b98a',
      rock: '#b89468',
      sand: '#e6cf9f'
    },
    // pianeta completamente piatto con un lago calmo a sinistra della seconda metà
    world: {
      flat: true,
      trees: 0,
      rocks: 0,
      bushes: 220,
      city: [],
      lake: { from: 0.5, to: 0.9, side: -1, reach: 240 }
    },
    music: 'retah',
    points: [
      [0, 0, 0], [140, 0, 10], [280, 0, 0], [400, 0, -60], [460, 0, -180], [420, 0, -300],
      [300, 0, -360], [160, 0, -330], [80, 0, -240], [-10, 0, -180], [-90, 0, -230],
      [-150, 0, -300], [-240, 0, -330], [-330, 0, -280], [-420, 0, -330], [-520, 0, -320],
      [-590, 0, -230], [-580, 0, -100], [-480, 0, -20], [-360, 0, 30], [-230, 0, 60], [-110, 0, 40]
    ],
    startT: 0.02,
    itemBoxes: [0.18, 0.44, 0.66, 0.88],
    boostPads: [0.33, 0.58, 0.81],
    props: [
      { model: 'tavola-calda', t: 0.25, side: 27, scale: 1.7, faceTrack: true },
      { model: 'autovettore', t: 0.236, side: 20, scale: 1.3, faceTrack: true },
      { model: 'autovettore', t: 0.264, side: 21, scale: 1.3, faceTrack: true },
      { model: 'autovettore', t: 0.25, side: 44, scale: 1.3, faceTrack: true },
      { model: 'relitto', t: 0.45, side: -24, scale: 1.5, faceTrack: true },
      { model: 'blindato', t: 0.62, side: 21, scale: 1.6, faceTrack: true },
      { model: 'blindato', t: 0.64, side: 22, scale: 1.6, faceTrack: true }
    ]
  }
];

export const CUPS = [
  {
    id: 'fuga',
    name: 'Coppa della Fuga',
    desc: 'Due gare, un solo fuggitivo. Vince chi somma più punti.',
    tracks: ['omega65', 'canair']
  },
  {
    id: 'galassie',
    name: 'Coppa delle Galassie Unite',
    desc: 'Quattro gare, quattro mondi. Emma ha già preparato il discorso per chi arriva ultimo.',
    tracks: ['niaboc', 'omega65', 'retah', 'canair']
  }
];

export const trackById = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
export const POINTS_TABLE = [10, 8, 6, 4, 2, 1];
