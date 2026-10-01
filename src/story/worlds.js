import { STADIO } from './stadio.js';
import { VALVO } from './valvo.js';
import { PORTALE } from './portale.js';
import { RISSA } from './rissa.js';
import { INSEGUIMENTO } from './inseguimento.js';
import { CHITARRE } from './chitarre.js';
import { SALITA } from './salita.js';
import { ESIBIZIONE } from './esibizione.js';
import { LUBETONE } from './lubetone.js';

// Piazze 3D dei pianeti della Storia (una per pianeta), da attraversare a piedi come in un mini Super Mario 64.
// Ogni ingresso: angle = direzione dal centro della piazza in gradi (0 = nord, cioè davanti alla partenza,
// senso orario), dist = distanza dal centro, height = altezza del modello in metri. I modelli guardano
// verso +Z e vengono girati verso il centro. `arch: true` = si attraversa (portale, arco): i piloni fanno
// da ostacolo e l'ingresso è nel vano; gli altri sono edifici con la porta sul davanti.
// kind: 'level' (livello giocabile) o 'gate' (sfida senza livello, per ora solo un messaggio).
// beacon: true = colonna di luce e icona (lucchetto chiuso/aperto) visibili da tutta la piazza.
// requires: id dell'ingresso da completare prima (salvato in save.story); finché manca, lucchetto e `locked`.
// Un pianeta alla volta (save.storyWorld): il Portale (nextWorld) porta da Niaboc a Retah.
// L'ordine è obbligato: stadio → deposito → portale, poi su Retah rissa → inseguimento, poi su Canair
// negozio → salita (dalla parete, si sbuca in cima) → piazzale in cima → sentiero di discesa → paese. Vicoli e biblioteca si apriranno quando Whiskey
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
    // obiettivo mostrato in alto a sinistra: il primo il cui livello (until) non è ancora completato
    objectives: [
      { until: 'stadio', text: 'Entra nello Stadio di Space Ball' },
      { until: 'deposito', text: 'Trova Emma al Deposito Valvo & Go' },
      { until: 'portale', text: 'Raggiungi il Portale prima del gong' }
    ],
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
  },
  {
    // Retah: si atterra qui dopo il tunnel del Portale (save.storyWorld). Pianeta piatto e sabbioso al tramonto,
    // un lago su un lato (lake.x: l'acqua comincia a quella x, verso est), niente livelli bonus.
    // decor: veicoli e rottami fermi (h = altezza in metri, rot = gradi, tilt = inclinazione, r = ostacolo).
    id: 'retah',
    name: 'Retah',
    subtitle: 'Sabbia, un lago e una tavola calda piena di cacciatori di taglie',
    theme: 'desert',
    track: 'retah', // palette del circuito di WisiKart dello stesso pianeta
    sky: 'assets/tracks/retah/sky.png',
    music: 'retah',
    radius: 40,
    lake: { x: 27 },
    spawn: { x: -4, z: 24, heading: Math.PI }, // guarda verso nord (la tavola calda)
    objectives: [
      { until: 'rissa', text: 'Entra nella tavola calda' },
      { until: 'inseguimento', text: 'Raggiungi Emma sul retro' }
    ],
    objectivesDone: 'Canair ti aspetta',
    decor: [
      // tre autovettori parcheggiati davanti e di lato alla tavola calda
      { model: 'assets/props/autovettore.glb', h: 2.2, x: -10.5, z: 1, rot: 70, r: 2.4 },
      { model: 'assets/props/autovettore.glb', h: 2.2, x: 10, z: 2.5, rot: -80, r: 2.4 },
      { model: 'assets/props/autovettore.glb', h: 2.2, x: 14, z: -5, rot: -100, r: 2.4 },
      // due blindati fermi e minacciosi, puntati sulla tavola calda
      { model: 'assets/props/blindato.glb', h: 3.4, x: -23, z: -6, rot: 20, r: 3.8, lights: true },
      { model: 'assets/props/blindato.glb', h: 3.4, x: -21, z: -17, rot: -15, r: 3.8, lights: true },
      // relitto inclinato, mezzo insabbiato
      { model: 'assets/props/relitto.glb', h: 4.5, x: 17, z: 19, rot: 35, tilt: 0.22, sink: 0.6, r: 4.2 }
    ],
    entrances: [
      {
        id: 'rissa', kind: 'level', level: RISSA, angle: 0, dist: 7, height: 8,
        model: 'assets/props/tavola-calda.glb',
        name: 'Tavola calda', desc: 'Profumo di frittura e di guai. Dentro, i cacciatori di taglie.'
      },
      {
        // sul retro della tavola calda: ci si arriva girandole intorno
        id: 'inseguimento', kind: 'level', level: INSEGUIMENTO, requires: 'rissa', angle: 0, dist: 25, height: 2.4, beacon: true,
        model: 'assets/props/autovettore.glb',
        name: 'L’autovettore di Emma', desc: 'Parcheggiato sul retro. Motore caldo, pieno fatto, due blindati in agguato.',
        locked: 'Emma è chiusa dentro e non apre. Prima si esce vivi dalla tavola calda.'
      }
    ]
  },
  {
    // Canair, un unico mondo su due quote (story/canair-world.js): il paese in basso (piazza, casette,
    // Infinity Guitars, il cartello del sentiero sotto la parete) e, 28 m più su, il promontorio Utgenra (statue
    // di Oremo e fontana della pista Canair, palco, belvedere). Si sale dalla parete (livello 7, con i pericoli)
    // e si sbuca in cima (points.vetta); si scende a piedi dal sentiero con le lanterne, che dal basso resta
    // chiuso da un cancello finché la salita non è fatta. Poi il sentiero si percorre anche in salita.
    id: 'canair',
    name: 'Canair',
    subtitle: 'La casa dei senza patria: il paese, il promontorio e le statue di Oremo',
    theme: 'desert', // terreno aperto al tramonto, come Retah, con i colori di Canair
    track: 'canair',
    ground: '#a39a5e',
    sky: 'assets/tracks/canair/sky.png',
    music: 'canair',
    radius: 26,
    canair: { paese: 'assets/story/canair/paese.png', discesa: 'assets/story/canair/discesa.png' },
    shadowExtent: 110,
    shadowCenter: { x: 0, z: -35 },
    spawn: { x: 0, z: 18, heading: Math.PI }, // guarda verso la parete
    points: {
      vetta: { x: 0, y: 28, z: -47.5, heading: Math.PI } // dove sbuca la salita, in cima alla parete
    },
    // obiettivo in alto a sinistra: textUp vale quando si è in cima al promontorio
    objectives: [
      { until: 'chitarre', text: 'Entra da Infinity Guitars' },
      { until: 'salita', text: 'Sali al promontorio: il sentiero parte dal cartello sotto la parete' },
      { until: 'esibizione', text: 'Torna in cima dal sentiero con le lanterne e suona al piazzale', textUp: 'Suona al piazzale, tra le statue di Oremo' },
      { until: 'lubetone', text: 'Entra al Lube Tone, in paese', textUp: 'Scendi in paese: il Lube Tone ti aspetta' }
    ],
    objectivesDone: 'Fine della prima parte · il contratto è firmato',
    objectivesDoneUp: 'Fine della prima parte · il sentiero con le lanterne riporta in paese',
    decor: [
      { model: 'assets/props/autovettore.glb', h: 2.2, x: 10, z: 15, rot: -60, r: 2.4 } // Emma, parcheggiata in paese
    ],
    entrances: [
      {
        id: 'chitarre', kind: 'level', level: CHITARRE, angle: 265, dist: 18, height: 6.5, model: 'assets/story/canair/negozio-facciata.glb', procedural: 'shop',
        name: 'Infinity Guitars', desc: 'Chitarre vere, da guadagnarsi nota per nota.'
      },
      {
        // il cartello sotto la parete: da qui parte la salita (livello 7)
        id: 'salita', kind: 'level', level: SALITA, requires: 'chitarre', pos: { x: 0, z: -22, face: 180 }, height: 2.6, beacon: true,
        model: 'assets/story/canair/cartello.glb', label: '↑ Sali al promontorio',
        name: 'Sentiero del promontorio', desc: 'Su per la parete fino alle statue di Oremo.',
        locked: 'Lassù si sale solo con una chitarra sulla schiena. Prima Infinity Guitars.'
      },
      {
        // in cima: il palco dell'esibizione davanti alle statue (livello 8)
        id: 'esibizione', kind: 'level', level: ESIBIZIONE, requires: 'salita', pos: { x: 0, z: -64, y: 28, face: 180 }, height: 3, beacon: true,
        procedural: 'stage', label: '♪ Esibizione',
        name: 'Palco del piazzale', desc: 'Tra le statue, al tramonto a tripla stella.',
        locked: 'Il palco è pronto, ma il pubblico aspetta chi è salito dalla parete.'
      },
      {
        // in paese: il Lube Tone, il locale elegante (si apre dopo l'esibizione al piazzale)
        id: 'lubetone', kind: 'level', level: LUBETONE, requires: 'esibizione', angle: 140, dist: 18, height: 6, procedural: 'club', beacon: true,
        label: '♪ Lube Tone',
        name: 'Lube Tone', desc: 'Luci soffuse, gente elegante e un piccolo palco.',
        locked: 'Il Lube Tone fa suonare solo chi si è già fatto sentire: prima l’esibizione al piazzale.'
      },
      {
        // in cima, sul bordo sud: lo scorcio sul paese
        id: 'belvedere', kind: 'view', pos: { x: -16, z: -46.2, y: 28, face: 0 }, height: 1.5, procedural: 'railing',
        name: 'Belvedere', desc: 'Il paese visto dal promontorio.',
        view: {
          image: 'assets/story/canair/belvedere.png',
          title: 'Belvedere del promontorio Utgenra',
          text: 'Laggiù c’è il paese: le casette, la piazza, Infinity Guitars. Da quassù sembra tutto più piccolo, anche la paura di suonare.'
        }
      },
      {
        // cancello a metà del sentiero di discesa: dal basso resta chiuso finché la salita non è fatta
        id: 'cancello', kind: 'passage', requires: 'salita', pos: { x: 33, z: -16, y: 8.2, face: 180 }, height: 6, arch: true, procedural: 'path',
        name: 'Cancello del sentiero',
        locked: 'Il cancello si apre dall’alto. La prima volta si sale dalla parete: il cartello è sotto la roccia.'
      }
    ]
  }
];
