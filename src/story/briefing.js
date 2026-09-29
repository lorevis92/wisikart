// Schermata di istruzioni prima di ogni livello della Storia. Ogni livello fornisce i suoi contenuti come dati:
//   briefing: { goal: 'una riga', controls: 'platform' | 'flight', rules: [{ icon, text }], tip: 'consiglio di Emma' }
// I comandi cambiano con l'input rilevato (tastiera, touch, gamepad); le icone sono SVG disegnati qui.

const svg = (body) => `<svg viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  bottle: svg('<rect x="20" y="6" width="8" height="8" rx="2" fill="#7fe0a0"/><path d="M18 16h12l3 8v18a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3V24z" fill="#3f9a5a"/><rect x="18" y="26" width="12" height="8" fill="#e8f7ec" opacity=".8"/>'),
  crumble: svg('<rect x="6" y="20" width="36" height="8" rx="2" fill="#a24cf0"/><path d="M22 20l3 4-2 4" stroke="#1b1030" stroke-width="2" fill="none"/><rect x="9" y="33" width="8" height="5" rx="1" fill="#a24cf0" opacity=".6" transform="rotate(-18 13 35)"/><rect x="30" y="35" width="7" height="4" rx="1" fill="#a24cf0" opacity=".5" transform="rotate(22 33 37)"/>'),
  fan: svg('<circle cx="24" cy="15" r="7" fill="#6fc3a0"/><rect x="15" y="22" width="18" height="18" rx="7" fill="#c23a4a"/><path d="M15 26l-7-10M33 26l7-10" stroke="#6fc3a0" stroke-width="4" stroke-linecap="round"/>'),
  drop: svg('<path d="M24 4v16" stroke="#9fb3ff" stroke-width="2" stroke-dasharray="3 3"/><rect x="20" y="20" width="8" height="12" rx="2" fill="#3f9a5a"/><ellipse cx="24" cy="42" rx="11" ry="3" fill="#000" opacity=".35"/>'),
  pendulum: svg('<path d="M24 4l-9 24" stroke="#c9d6ff" stroke-width="2"/><circle cx="14" cy="32" r="9" fill="#ff9a3a"/><path d="M28 40a14 14 0 0 0 10-10" stroke="#fff" stroke-width="2" fill="none" stroke-dasharray="2 3"/>'),
  boss: svg('<circle cx="24" cy="16" r="10" fill="#7a1e2e"/><rect x="12" y="26" width="24" height="16" rx="6" fill="#7a1e2e"/><rect x="6" y="6" width="10" height="7" rx="2" fill="#f29a2e" transform="rotate(-20 11 9)"/><circle cx="20" cy="15" r="2" fill="#fff"/><circle cx="28" cy="15" r="2" fill="#fff"/>'),
  coin: svg('<circle cx="24" cy="24" r="15" fill="#f5b942"/><circle cx="24" cy="24" r="11" fill="none" stroke="#b07a12" stroke-width="2"/><text x="24" y="30" font-size="15" font-weight="700" text-anchor="middle" fill="#8a5a08">100</text>'),
  conveyor: svg('<rect x="4" y="20" width="40" height="10" rx="5" fill="#2a2e3e"/><path d="M12 22l5 3-5 3M22 22l5 3-5 3M32 22l5 3-5 3" fill="#f2c230"/><circle cx="9" cy="25" r="3" fill="#8a96b0"/><circle cx="39" cy="25" r="3" fill="#8a96b0"/>'),
  cart: svg('<rect x="10" y="14" width="22" height="18" rx="3" fill="#f2c230"/><rect x="32" y="8" width="3" height="26" fill="#8a96b0"/><rect x="35" y="28" width="9" height="3" fill="#8a96b0"/><circle cx="15" cy="36" r="4" fill="#2a2e3e"/><circle cx="28" cy="36" r="4" fill="#2a2e3e"/><circle cx="16" cy="21" r="2.5" fill="#ff4a5a"/>'),
  steam: svg('<rect x="17" y="34" width="14" height="8" rx="2" fill="#6a7488"/><path d="M20 32c-4-6 4-8 0-14M28 32c-4-6 4-8 0-14" stroke="#e8f4ff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M24 6l-5 6h10z" fill="#43e0b0"/>'),
  lever: svg('<rect x="14" y="24" width="20" height="16" rx="3" fill="#2a2e3e"/><path d="M24 30L34 12" stroke="#c9d0e0" stroke-width="3" stroke-linecap="round"/><circle cx="34" cy="12" r="4" fill="#d23a3a"/><circle cx="24" cy="24" r="14" fill="none" stroke="#f2c230" stroke-width="2" stroke-dasharray="4 3"/>'),
  badge: svg('<rect x="12" y="8" width="24" height="32" rx="4" fill="#43e0b0"/><rect x="20" y="4" width="8" height="6" rx="2" fill="#2a2e3e"/><circle cx="24" cy="20" r="5" fill="#1b3a30"/><rect x="17" y="29" width="14" height="3" rx="1.5" fill="#1b3a30"/>'),
  shutter: svg('<rect x="8" y="6" width="32" height="24" fill="#5a6278"/><path d="M8 12h32M8 18h32M8 24h32" stroke="#3a4052" stroke-width="2"/><rect x="8" y="29" width="32" height="3" fill="#ff2a2a"/><path d="M10 42h20" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M26 38l6 4-6 4" fill="#fff"/>'),
  slide: svg('<circle cx="14" cy="30" r="5" fill="#5b8cf0"/><path d="M18 33l18 4" stroke="#2b3a6b" stroke-width="5" stroke-linecap="round"/><path d="M6 42h36" stroke="#8a96b0" stroke-width="2"/><rect x="26" y="8" width="16" height="20" fill="#5a6278"/>'),
  ring: svg('<circle cx="24" cy="24" r="15" fill="none" stroke="#ff4fc8" stroke-width="5"/><circle cx="24" cy="24" r="9" fill="none" stroke="#3fe8ff" stroke-width="2"/><text x="24" y="28" font-size="11" font-weight="700" text-anchor="middle" fill="#fff">+3</text>'),
  goldring: svg('<circle cx="24" cy="24" r="15" fill="none" stroke="#f5b942" stroke-width="5"/><path d="M24 14l3 7h7l-6 4 2 7-6-4-6 4 2-7-6-4h7z" fill="#ffe08a"/>'),
  barrier: svg('<rect x="4" y="14" width="40" height="14" fill="#ff2a6a" opacity=".45"/><path d="M4 14h40M4 28h40" stroke="#ff2a6a" stroke-width="2.5"/><path d="M24 6v6M24 30v8" stroke="#fff" stroke-width="2"/><path d="M20 9l4-5 4 5M20 35l4 5 4-5" fill="none" stroke="#fff" stroke-width="2"/>'),
  patrol: svg('<ellipse cx="24" cy="26" rx="18" ry="8" fill="#2f6bd9"/><rect x="14" y="23" width="20" height="4" fill="#f2f0ff"/><circle cx="20" cy="16" r="3" fill="#2a6aff"/><circle cx="28" cy="16" r="3" fill="#ff2a3a"/>'),
  leader: svg('<ellipse cx="18" cy="28" rx="14" ry="7" fill="#1d2a55"/><circle cx="18" cy="20" r="3.5" fill="#fff"/><rect x="34" y="23" width="8" height="8" rx="1" fill="#9fffe0"/><path d="M33 27h-6" stroke="#9fffe0" stroke-width="2" stroke-dasharray="2 2"/>'),
  pincer: svg('<ellipse cx="9" cy="24" rx="6" ry="4" fill="#2f6bd9"/><ellipse cx="39" cy="24" rx="6" ry="4" fill="#2f6bd9"/><path d="M16 24h5M32 24h-5" stroke="#f2c230" stroke-width="3"/><path d="M19 20l3 4-3 4M29 20l-3 4 3 4" fill="none" stroke="#f2c230" stroke-width="2"/><circle cx="24" cy="24" r="3" fill="#fff"/>'),
  gong: svg('<circle cx="24" cy="22" r="14" fill="#d9a441"/><circle cx="24" cy="22" r="8" fill="none" stroke="#8a5e12" stroke-width="2"/><path d="M24 38v6M16 44h16" stroke="#8a96b0" stroke-width="3"/><text x="24" y="26" font-size="10" font-weight="700" text-anchor="middle" fill="#5a3a08">12</text>'),
  medal: svg('<path d="M16 4l8 14 8-14" fill="#2b62d9"/><circle cx="24" cy="30" r="12" fill="#f5b942"/><path d="M24 23l2.5 5h5l-4 3 1.5 5-5-3-5 3 1.5-5-4-3h5z" fill="#fff3c0"/>'),
  // rissa alla tavola calda
  fist: svg('<rect x="12" y="16" width="20" height="16" rx="6" fill="#f2c9a0"/><path d="M16 16v-3M21 16v-4M26 16v-3" stroke="#c99a70" stroke-width="3" stroke-linecap="round"/><path d="M34 20l8-4M34 25h9M34 30l8 4" stroke="#ffd45a" stroke-width="2.5" stroke-linecap="round"/><text x="22" y="44" font-size="9" font-weight="700" text-anchor="middle" fill="#fff">×3</text>'),
  stool: svg('<ellipse cx="24" cy="14" rx="11" ry="4" fill="#c23a3a"/><path d="M16 16l-4 24M32 16l4 24M24 18v22" stroke="#8a96b0" stroke-width="3" stroke-linecap="round"/><circle cx="40" cy="30" r="6" fill="#e8f0ff" stroke="#8a96b0" stroke-width="2"/>'),
  baton: svg('<circle cx="16" cy="14" r="6" fill="#3a4a6a"/><rect x="10" y="20" width="12" height="18" rx="4" fill="#3a4a6a"/><path d="M22 26l18-14" stroke="#1d1d26" stroke-width="4" stroke-linecap="round"/><circle cx="40" cy="12" r="3" fill="#7fd4ff"/><path d="M26 40h16" stroke="#fff" stroke-width="2" stroke-dasharray="3 2"/>'),
  net: svg('<ellipse cx="24" cy="38" rx="16" ry="5" fill="none" stroke="#ff3a4a" stroke-width="3"/><path d="M12 10h24l-4 22H16z" fill="none" stroke="#d8c8a0" stroke-width="2"/><path d="M14 16h20M15 22h18M16 28h16M20 10l-2 22M24 10v22M28 10l2 22" stroke="#d8c8a0" stroke-width="1.5"/>'),
  jukebox: svg('<path d="M12 42V18a12 12 0 0 1 24 0v24z" fill="#8a2a4a"/><path d="M16 38V19a8 8 0 0 1 16 0v19" fill="none" stroke="#ffd45a" stroke-width="2"/><circle cx="24" cy="22" r="4" fill="#ff5fb0"/><path d="M38 8v8a2.5 2.5 0 1 1-2-2.4M42 6v8a2.5 2.5 0 1 1-2-2.4" stroke="#fff" stroke-width="1.8" fill="none"/>'),
  // inseguimento sul lago
  armored: svg('<rect x="6" y="20" width="32" height="14" rx="4" fill="#5a5f70"/><rect x="14" y="13" width="14" height="8" rx="2" fill="#3a3f52"/><path d="M28 16h14" stroke="#3a3f52" stroke-width="3"/><circle cx="12" cy="36" r="4" fill="#1d1d26"/><circle cx="32" cy="36" r="4" fill="#1d1d26"/><circle cx="20" cy="17" r="2" fill="#ff2a3a"/>'),
  missile: svg('<path d="M8 30l22-12 8 4-22 12z" fill="#c9cde0"/><path d="M38 22l6-2-4 6z" fill="#ff4a5a"/><path d="M8 30l-4 6 8-2M14 27l-6-4 2 8" fill="#ff9a3a"/><path d="M40 34a8 8 0 0 1-8 8" stroke="#ffd45a" stroke-width="2.5" fill="none"/><path d="M29 40l3 2 1-4" stroke="#ffd45a" stroke-width="2" fill="none"/>'),
  cannon: svg('<rect x="4" y="6" width="40" height="8" rx="4" fill="#2a2e3e"/><rect x="6" y="8" width="28" height="4" rx="2" fill="#7fd4ff"/><path d="M24 18l-6 26h12z" fill="#9fe8ff" opacity=".7"/><path d="M24 18v26" stroke="#fff" stroke-width="2"/>'),
  cover: svg('<path d="M4 42h40" stroke="#b89468" stroke-width="3"/><path d="M28 42c-2-10 2-18 8-22 4 6 6 14 2 22z" fill="#6a7a3a"/><path d="M6 12l14 12" stroke="#9fe8ff" stroke-width="4" opacity=".8"/><ellipse cx="18" cy="36" rx="6" ry="3" fill="#d99a2b"/><path d="M36 4v12" stroke="#43e0b0" stroke-width="2"/><circle cx="36" cy="4" r="2" fill="#43e0b0"/>'),
  heart: svg('<path d="M24 40S8 30 8 19a8 8 0 0 1 16-3 8 8 0 0 1 16 3c0 11-16 21-16 21z" fill="#ff5a6e"/><path d="M34 8v6M31 11h6" stroke="#fff" stroke-width="2"/>'),
  mirror: svg('<rect x="6" y="12" width="36" height="16" rx="6" fill="#1b1f3a" stroke="#c9cfdc" stroke-width="3"/><rect x="12" y="18" width="7" height="5" rx="1" fill="#5a5f70"/><rect x="28" y="17" width="8" height="6" rx="1" fill="#5a5f70"/><circle cx="13" cy="20" r="1.3" fill="#fff4d8"/><circle cx="29" cy="19" r="1.3" fill="#fff4d8"/><path d="M24 30v8M18 38h12" stroke="#c9cfdc" stroke-width="3"/>'),
  flank: svg('<ellipse cx="18" cy="30" rx="7" ry="4" fill="#d99a2b"/><rect x="28" y="20" width="16" height="12" rx="3" fill="#5a5f70"/><path d="M26 24l-5 3 5 3" fill="none" stroke="#ff4a5a" stroke-width="2.5"/><path d="M14 22l-6-4M14 38l-6 4" stroke="#43e0b0" stroke-width="2.5" stroke-linecap="round"/>'),
  mines: svg('<circle cx="10" cy="26" r="5" fill="#ff2a3a"/><circle cx="24" cy="20" r="5" fill="#ff2a3a"/><circle cx="38" cy="26" r="5" fill="#ff2a3a"/><path d="M24 44V30" stroke="#43e0b0" stroke-width="2.5" stroke-dasharray="3 2"/><path d="M20 34l4-5 4 5" fill="none" stroke="#43e0b0" stroke-width="2.5"/>'),
  vortex: svg('<circle cx="24" cy="24" r="17" fill="none" stroke="#7fa4ff" stroke-width="3"/><path d="M24 12a12 12 0 1 1-12 12 8 8 0 1 1 8 8 4 4 0 1 1 4-4" fill="none" stroke="#c9d6ff" stroke-width="2.5"/>')
};

const K = (label) => ({ kind: 'key', label });
const T = (label) => ({ kind: 'touch', label });
const P = (label) => ({ kind: 'pad', label });

/** Comandi per tipo di livello e per input: ogni voce è { azione, tasti[] }. */
export const CONTROLS = {
  platform: {
    keyboard: [
      ['Cammina', [K('←'), K('→')], [K('A'), K('D')]],
      ['Salta (tieni per saltare più in alto)', [K('Spazio')], [K('K')]],
      ['Scale', [K('↑'), K('↓')]],
      ['Scivola (giù mentre corri)', [K('↓')]],
      ['Lancia una bottiglia', [K('Maiusc')], [K('E')], [K('J')]],
      ['Menu di gioco · silenzio', [K('Esc')], [K('M')]]
    ],
    touch: [
      ['Cammina', [T('◀'), T('▶')]],
      ['Salta', [T('Salta')]],
      ['Scale / scivola', [T('▲'), T('▼')]],
      ['Lancia una bottiglia', [T('Lancia')]],
      ['Menu di gioco', [T('II')]]
    ],
    gamepad: [
      ['Cammina', [P('levetta')], [P('croce')]],
      ['Salta', [P('A')]],
      ['Scale / scivola', [P('su')], [P('giù')]],
      ['Lancia una bottiglia', [P('Y')], [P('LB')]],
      ['Menu di gioco', [P('Start')]]
    ]
  },
  flight: {
    keyboard: [
      ['Sterza', [K('←'), K('→')], [K('A'), K('D')]],
      ['Quota su / giù', [K('↑'), K('↓')], [K('W'), K('S')]],
      ['Spara (tieni per la raffica)', [K('Spazio')], [K('K')]],
      ['Frena', [K('Maiusc')], [K('E')], [K('J')]],
      ['Menu di gioco · silenzio', [K('Esc')], [K('M')]]
    ],
    touch: [
      ['Sterza', [T('◀'), T('▶')]],
      ['Quota su / giù', [T('▲'), T('▼')]],
      ['Spara', [T('Spara')]],
      ['Frena', [T('Frena')]],
      ['Menu di gioco', [T('II')]]
    ],
    gamepad: [
      ['Sterza', [P('levetta')]],
      ['Quota su / giù', [P('levetta su/giù')], [P('croce')]],
      ['Spara', [P('A')]],
      ['Frena', [P('X')]],
      ['Menu di gioco', [P('Start')]]
    ]
  },
  // rissa: si cammina anche in profondità, pugni in combo, lanci
  brawl: {
    keyboard: [
      ['Cammina (anche in profondità)', [K('←'), K('→'), K('↑'), K('↓')], [K('W'), K('A'), K('S'), K('D')]],
      ['Pugno (premi di nuovo per la combo)', [K('F')], [K('L')]],
      ['Salta (in aria: calcio volante)', [K('Spazio')], [K('K')]],
      ['Raccogli / lancia (sgabelli, piatti, bottiglie)', [K('Maiusc')], [K('E')], [K('J')]],
      ['Menu di gioco · silenzio', [K('Esc')], [K('M')]]
    ],
    touch: [
      ['Cammina', [T('◀'), T('▶')]],
      ['In profondità', [T('▲'), T('▼')]],
      ['Pugno (combo)', [T('Pugno')]],
      ['Salta', [T('Salta')]],
      ['Raccogli / lancia', [T('Lancia')]],
      ['Menu di gioco', [T('II')]]
    ],
    gamepad: [
      ['Cammina (anche in profondità)', [P('levetta')], [P('croce')]],
      ['Pugno (combo)', [P('X')]],
      ['Salta', [P('A')]],
      ['Raccogli / lancia', [P('Y')], [P('LB')]],
      ['Menu di gioco', [P('Start')]]
    ]
  }
};
// inseguimento: come il Portale, più "guarda indietro" (tenuto) e il freno su un tasto suo
CONTROLS.chase = {
  keyboard: [
    ['Sterza', [K('←'), K('→')], [K('A'), K('D')]],
    ['Quota su / giù', [K('↑'), K('↓')], [K('W'), K('S')]],
    ['Spara (tieni per la raffica)', [K('Spazio')], [K('K')]],
    ['Guarda indietro e spara ai blindati (tieni)', [K('Maiusc')], [K('E')], [K('J')]],
    ['Frena', [K('Q')], [K('X')]],
    ['Menu di gioco · silenzio', [K('Esc')], [K('M')]]
  ],
  touch: [
    ['Sterza', [T('◀'), T('▶')]],
    ['Quota su / giù', [T('▲'), T('▼')]],
    ['Spara', [T('Spara')]],
    ['Guarda indietro (tieni)', [T('Indietro')]],
    ['Frena', [T('Frena')]],
    ['Menu di gioco', [T('II')]]
  ],
  gamepad: [
    ['Sterza', [P('levetta')]],
    ['Quota su / giù', [P('levetta su/giù')], [P('croce')]],
    ['Spara', [P('A')]],
    ['Guarda indietro (tieni)', [P('Y')], [P('LB')]],
    ['Frena', [P('X')], [P('LT')]],
    ['Menu di gioco', [P('Start')]]
  ]
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function keyHtml(k) {
  if (k.kind === 'pad' && ['A', 'B', 'X', 'Y'].includes(k.label)) return `<span class="kb pad pad-${k.label.toLowerCase()}">${k.label}</span>`;
  return `<span class="kb ${k.kind}">${esc(k.label)}</span>`;
}

/** HTML della schermata per un livello e un tipo di input ('keyboard' | 'touch' | 'gamepad'). */
export function briefingHtml(level, device = 'keyboard') {
  const b = level.briefing || {};
  const set = CONTROLS[b.controls || level.type] || CONTROLS.platform;
  const rows = set[device] || set.keyboard;
  const deviceName = { keyboard: 'Tastiera', touch: 'Touch', gamepad: 'Gamepad' }[device] || 'Tastiera';
  const controls = rows.map(([action, ...alts]) => `<li><span class="keys">${alts.map((a) => a.map(keyHtml).join('')).join('<i>o</i>')}</span><span>${esc(action)}</span></li>`).join('');
  const rules = (b.rules || []).map((r) => `<li><span class="rule-icon">${ICONS[r.icon] || ''}</span><span>${esc(r.text)}</span></li>`).join('');
  return `
    <div class="brief-head"><small>${esc(level.name)}</small><h2>${esc(b.goal || level.subtitle || '')}</h2></div>
    <div class="brief-cols">
      <section><h3>Comandi <em>${deviceName}</em></h3><ul class="brief-controls">${controls}</ul></section>
      <section><h3>Regole</h3><ul class="brief-rules">${rules}</ul></section>
    </div>
    ${b.tip ? `<p class="brief-tip"><b>Emma:</b> «${esc(b.tip)}»</p>` : ''}
    <p class="brief-go">${device === 'touch' ? 'Tocca per iniziare' : device === 'gamepad' ? 'Premi un tasto per iniziare' : 'Premi un tasto per iniziare'}</p>`;
}
