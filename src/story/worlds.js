import { STADIO } from './stadio.js';

// Mappe dei pianeti della Storia, in stile Super Mario World: un'illustrazione con le sfide sopra.
// x, y = posizione dell'icona in frazioni dell'immagine (0..1), sui nodi già disegnati nel percorso.
// kind: 'level' (livello giocabile), 'gate' (sfida chiusa finché non vinci `requires`), 'bonus' (in arrivo).

export const WORLDS = [
  {
    id: 'niaboc',
    name: 'Niaboc',
    subtitle: 'La città sotto le due lune',
    image: 'assets/story/niaboc/mappa.png',
    nodes: [
      {
        id: 'stadio', kind: 'level', level: STADIO, x: 0.4, y: 0.406, icon: 'stadio',
        name: 'Stadio di Space Ball', desc: 'Gradinate, campo, spogliatoi. E in cima, il Tifoso Supremo.'
      },
      {
        id: 'portale', kind: 'gate', requires: 'stadio', x: 0.606, y: 0.435, icon: 'portale',
        name: 'Portale di Niaboc', desc: 'Una pista oltre il portale al neon.',
        locked: 'Vinci lo Stadio di Space Ball per aprire il portale.',
        soon: 'Il portale è aperto. La pista dall’altra parte però non è ancora asciutta.'
      },
      {
        id: 'deposito', kind: 'bonus', x: 0.313, y: 0.543, icon: 'deposito',
        name: 'Deposito Valvo Go', desc: 'Il deposito dove tutto è cominciato.',
        soon: 'In arrivo. Emma dice che ci sta lavorando. Emma non ci sta lavorando.'
      },
      {
        id: 'vicoli', kind: 'bonus', x: 0.515, y: 0.622, icon: 'vicoli',
        name: 'Vicoli notturni', desc: 'Neon, scorciatoie e porte che non dovresti aprire.',
        soon: 'In arrivo. I vicoli sono ancora troppo bui anche per Emma.'
      },
      {
        id: 'biblioteca', kind: 'bonus', x: 0.695, y: 0.625, icon: 'biblioteca',
        name: 'Biblioteca', desc: 'Silenzio, per favore. Anche con i kart.',
        soon: 'In arrivo. La biblioteca è chiusa per inventario (dei libri, non dei kart).'
      }
    ]
  }
];
