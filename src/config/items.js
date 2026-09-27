export const ITEMS = {
  missile: {
    id: 'missile',
    name: 'Missile al Perrican',
    desc: 'Insegue il pilota davanti a te e lo fa girare.',
    icon: 'assets/items/missile.png',
    color: '#ff6a3d'
  },
  cannone: {
    id: 'cannone',
    name: 'Colpo ionico',
    desc: 'Una sfera di energia dritta davanti a te. Chi la prende, si ferma.',
    icon: 'assets/items/cannone.png',
    color: '#4fd8ff'
  },
  grappoli: {
    id: 'grappoli',
    name: 'Grappoli del Bacco',
    desc: 'Lascia tre grappoli scivolosi dietro di te.',
    icon: 'assets/items/grappoli.png',
    color: '#8e3fbf'
  },
  perla: {
    id: 'perla',
    name: 'Lampo della perla',
    desc: 'Abbaglia tutti gli altri piloti per qualche secondo.',
    icon: 'assets/items/perla.png',
    color: '#fff3c4'
  },
  nebbia: {
    id: 'nebbia',
    name: 'Nebbia del Viandante',
    desc: 'Rallenta tutti gli avversari, che devono attraversare la nebbia.',
    icon: 'assets/items/nebbia.png',
    color: '#c9d4de'
  },
  pugno: {
    id: 'pugno',
    name: 'Pugno del Divoratore',
    desc: 'Scatto in avanti che spazza via chi hai vicino.',
    icon: 'assets/items/pugno.png',
    color: '#3f77ff'
  },
  turbo: {
    id: 'turbo',
    name: 'Turbo',
    desc: 'Una spinta di velocità immediata.',
    icon: null,
    color: '#43e0b0'
  }
};

// Pesi per posizione: [primo ... ultimo]. Chi è dietro riceve oggetti più forti.
export function rollItem(position, total) {
  const t = total <= 1 ? 0 : (position - 1) / (total - 1); // 0 = primo, 1 = ultimo
  const table = [
    ['grappoli', 3 + 2 * (1 - t)],
    ['cannone', 2 + 2 * t],
    ['missile', 1 + 4 * t],
    ['perla', 1.5 + 1.5 * t],
    ['nebbia', 1.5 + 1.5 * t],
    ['pugno', 1 + 2 * t],
    ['turbo', 1.5 + 3 * t]
  ];
  const sum = table.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * sum;
  for (const [id, w] of table) {
    r -= w;
    if (r <= 0) return id;
  }
  return 'turbo';
}
