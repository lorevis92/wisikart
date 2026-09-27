// I sei Whiskey del WiSiVERSE. Le statistiche vanno da 1 a 5.
// `model` e `portrait` puntano a public/assets: se il file manca, il gioco usa un modello procedurale.
// `modelRotY` corregge l'orientamento del GLB (i modelli Meshy a volte guardano verso -Z).
export const CHARACTERS = [
  {
    id: 'monna',
    name: 'Monna Whiskey',
    tagline: 'Un sorriso che ti supera in curva.',
    stats: { speed: 3, accel: 4, handling: 5, weight: 2 },
    colors: { primary: '#2f6b4a', secondary: '#d9a441', skin: '#5b8cf0', hair: '#1a1410' },
    item: 'perla',
    portrait: 'assets/characters/monna.png',
    model: 'assets/characters/monna.glb',
    modelRotY: Math.PI,
    look: { hair: 'long', hat: 'none' }
  },
  {
    id: 'bacco',
    name: 'Bacco',
    tagline: 'Parte piano, ma quando arriva è una festa.',
    stats: { speed: 4, accel: 2, handling: 3, weight: 4 },
    colors: { primary: '#7a1e2e', secondary: '#e6c877', skin: '#7aa6f5', hair: '#141210' },
    item: 'grappoli',
    portrait: 'assets/characters/bacco.png',
    model: 'assets/characters/bacco.glb',
    modelRotY: Math.PI,
    look: { hair: 'wild', hat: 'vine' }
  },
  {
    id: 'perla',
    name: "Whiskey con l'orecchino di perla",
    tagline: 'Ti guarda da sopra la spalla. Poi ti abbaglia.',
    stats: { speed: 4, accel: 3, handling: 4, weight: 2 },
    colors: { primary: '#2b4fd6', secondary: '#f0c93f', skin: '#7d5aa6', hair: '#f3cf49' },
    item: 'perla',
    portrait: 'assets/characters/perla.png',
    model: 'assets/characters/perla.glb',
    modelRotY: Math.PI,
    look: { hair: 'none', hat: 'turban' }
  },
  {
    id: 'viandante',
    name: 'Whiskey viandante',
    tagline: 'Sopra la nebbia, sempre. Sotto, gli altri.',
    stats: { speed: 3, accel: 5, handling: 4, weight: 2 },
    colors: { primary: '#1f4a2c', secondary: '#8c5a2b', skin: '#6d86b3', hair: '#e5702e' },
    item: 'nebbia',
    portrait: 'assets/characters/viandante.png',
    model: 'assets/characters/viandante.glb',
    modelRotY: Math.PI,
    look: { hair: 'curly', hat: 'none' }
  },
  {
    id: 'divoratore',
    name: 'Whiskey che divora i figli',
    tagline: 'Non frena. Mai. Per nessuno.',
    stats: { speed: 5, accel: 1, handling: 2, weight: 5 },
    colors: { primary: '#12142b', secondary: '#3b4c9e', skin: '#3d6bd8', hair: '#e8e8ea' },
    item: 'pugno',
    portrait: 'assets/characters/divoratore.png',
    model: 'assets/characters/divoratore.glb',
    modelRotY: Math.PI,
    scale: 1.25,
    look: { hair: 'shaggy', hat: 'none' }
  },
  {
    id: 'panciotto',
    name: 'Whiskey col panciotto',
    tagline: 'Elegante. Annoiato. Velocissimo.',
    stats: { speed: 3, accel: 3, handling: 3, weight: 3 },
    colors: { primary: '#b8202a', secondary: '#c79a3a', skin: '#6a79e6', hair: '#5a3a22' },
    item: 'missile',
    portrait: 'assets/characters/panciotto.png',
    model: 'assets/characters/panciotto.glb',
    modelRotY: Math.PI,
    look: { hair: 'long', hat: 'brim' }
  }
];

export const byId = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
