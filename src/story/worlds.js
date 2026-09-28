import { STADIO } from './stadio.js';
import { VALVO } from './valvo.js';
import { PORTALE } from './portale.js';

// Piazze 3D dei pianeti della Storia (una per pianeta), da attraversare a piedi come in un mini Super Mario 64.
// Ogni ingresso: angle = direzione dal centro della piazza in gradi (0 = nord, cioè davanti alla partenza,
// senso orario), dist = distanza dal centro, height = altezza del modello in metri. I modelli guardano
// verso +Z e vengono girati verso il centro. `arch: true` = si attraversa (portale, arco): i piloni fanno
// da ostacolo e l'ingresso è nel vano; gli altri sono edifici con la porta sul davanti.
// kind: 'level' (livello giocabile) o 'gate' (sfida senza livello, per ora solo un messaggio).
// requires: id dell'ingresso da completare prima (salvato in save.story); finché manca, lucchetto e `locked`.
// L'ordine è obbligato: stadio → deposito → portale. Vicoli e biblioteca si apriranno quando Whiskey
// tornerà a Niaboc, più avanti nella storia ('ritorno-niaboc' non è ancora raggiungibile).

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
        id: 'deposito', kind: 'level', level: VALVO, requires: 'stadio', angle: 300, dist: 19, height: 10,
        model: 'assets/props/valvo-go.glb',
        name: 'Deposito Valvo & Go', desc: 'Il deposito dove tutto è cominciato. In fondo all’hangar, Emma.',
        locked: 'Il deposito è chiuso. Emma (da qualche parte là dentro) dovrà aspettare: prima lo Stadio di Space Ball.'
      },
      {
        // subito dietro il deposito, sulla stessa direzione: ci si arriva girandogli intorno
        id: 'portale', kind: 'level', level: PORTALE, requires: 'deposito', angle: 300, dist: 31, height: 10, arch: true,
        model: 'assets/props/portale-niaboc.glb',
        name: 'Portale: corsa al varco', desc: 'Un giro in volo prima del gong di mezzogiorno.',
        locked: 'Il portale è sigillato. Senza Emma non si va da nessuna parte: prima il Deposito Valvo & Go.'
      },
      {
        id: 'biblioteca', kind: 'gate', requires: 'ritorno-niaboc', angle: 128, dist: 26, height: 12,
        model: 'assets/story/niaboc/biblioteca.glb',
        name: 'Biblioteca', desc: 'Silenzio, per favore. Anche con i kart.',
        locked: 'Chiusa. Si aprirà quando Whiskey tornerà a Niaboc, più avanti nella storia.'
      },
      {
        id: 'vicoli', kind: 'gate', requires: 'ritorno-niaboc', angle: 205, dist: 26, height: 9, arch: true,
        model: 'assets/story/niaboc/arco-vicoli.glb',
        name: 'Vicoli notturni', desc: 'Neon, scorciatoie e porte che non dovresti aprire.',
        locked: 'Sbarrati. I vicoli si apriranno quando Whiskey tornerà a Niaboc, più avanti nella storia.'
      }
    ]
  }
];
