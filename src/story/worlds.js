import { STADIO } from './stadio.js';

// Piazze 3D dei pianeti della Storia (una per pianeta), da attraversare a piedi come in un mini Super Mario 64.
// Ogni ingresso: angle = direzione dal centro della piazza in gradi (0 = nord, cioè davanti alla partenza,
// senso orario), dist = distanza dal centro, height = altezza del modello in metri. I modelli guardano
// verso +Z e vengono girati verso il centro. `arch: true` = si attraversa (portale, arco): i piloni fanno
// da ostacolo e l'ingresso è nel vano; gli altri sono edifici con la porta sul davanti.
// kind: 'level' (livello giocabile), 'gate' (chiuso finché non vinci `requires`), 'bonus' (in arrivo).

export const WORLDS = [
  {
    id: 'niaboc',
    name: 'Niaboc',
    subtitle: 'La città sotto le due lune',
    sky: 'assets/tracks/niaboc/sky.png',
    music: 'niaboc',
    radius: 34,
    spawn: { x: 0, z: 10, heading: Math.PI }, // guarda verso nord (lo stadio)
    entrances: [
      {
        id: 'stadio', kind: 'level', level: STADIO, angle: 0, dist: 27, height: 13,
        model: 'assets/story/niaboc/stadio-esterno.glb',
        name: 'Stadio di Space Ball', desc: 'Gradinate, campo, spogliatoi. E in cima, il Tifoso Supremo.'
      },
      {
        id: 'portale', kind: 'gate', requires: 'stadio', angle: 58, dist: 25, height: 10, arch: true,
        model: 'assets/props/portale-niaboc.glb',
        name: 'Portale di Niaboc', desc: 'Una pista oltre il portale al neon.',
        locked: 'Il portale è sigillato. Emma: «Vinci lo Stadio di Space Ball e ne riparliamo.»',
        soon: 'Il portale è aperto. Emma: «La pista dall’altra parte però non è ancora asciutta.»'
      },
      {
        id: 'biblioteca', kind: 'bonus', angle: 128, dist: 26, height: 12,
        model: 'assets/story/niaboc/biblioteca.glb',
        name: 'Biblioteca', desc: 'Silenzio, per favore. Anche con i kart.',
        soon: 'In arrivo. Emma: «Chiusa per inventario. Dei libri, non dei kart.»'
      },
      {
        id: 'vicoli', kind: 'bonus', angle: 232, dist: 26, height: 9, arch: true,
        model: 'assets/story/niaboc/arco-vicoli.glb',
        name: 'Vicoli notturni', desc: 'Neon, scorciatoie e porte che non dovresti aprire.',
        soon: 'In arrivo. Emma: «I vicoli sono troppo bui anche per me. E io vedo al buio.»'
      },
      {
        id: 'deposito', kind: 'bonus', angle: 302, dist: 27, height: 10,
        model: 'assets/props/valvo-go.glb',
        name: 'Deposito Valvo Go', desc: 'Il deposito dove tutto è cominciato.',
        soon: 'In arrivo. Emma: «Ci sto lavorando.» Emma non ci sta lavorando.'
      }
    ]
  }
];
