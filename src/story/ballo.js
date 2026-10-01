// Livello della Storia: il locale da ballo (Canair, la stessa notte del Red Fox). Movimento a tempo di musica,
// alla Crypt of the NecroDancer: la pista è una griglia e Whiskey fa un passo solo se la freccia arriva vicino al
// battito. Hes fa strada verso il centro; note luminose da raccogliere (come le monete dei platform). La
// tolleranza si stringe mentre ci si avvicina al centro, e la notte si deforma. Niente game over: fuori tempo si
// perde il passo. Raggiunta Hes al centro, dissolvenza e il giorno dopo (next). Motore: DanceMode.js.

const VOCE = 'assets/story/voce/';
const C = 'assets/story/canair/';

// il percorso di Hes: una spirale dalla pista verso il centro (caselle della griglia, da -6 a +6)
function spiral() {
  const corners = [[0, 4], [4, 4], [4, -4], [-4, -4], [-4, 2], [2, 2], [2, -2], [-2, -2], [-2, 0], [0, 0]];
  const path = [corners[0]];
  for (let k = 1; k < corners.length; k++) {
    let [i, j] = path[path.length - 1];
    const [ti, tj] = corners[k];
    while (i !== ti || j !== tj) {
      i += Math.sign(ti - i); j += Math.sign(tj - j);
      path.push([i, j]);
    }
  }
  return path;
}
const PATH = spiral();
// note: una casella sì e una no lungo il percorso, più qualcuna fuori strada
const NOTES = [...PATH.filter((_, k) => k > 0 && k % 2 === 0 && k < PATH.length - 1), [-5, 5], [5, -5], [-5, -5], [5, 5], [0, -6], [6, 0], [-6, 0]];

export const BALLO = {
  id: 'ballo', // stesso id dell'ingresso in piazza: è la chiave del salvataggio
  type: 'dance',
  name: 'Il locale da ballo',
  subtitle: 'Soffitto a stelle, una pista e Hes che non si volta mai a controllare se la segui.',
  preview: C + 'locale-ballo.png',
  music: 'canair',
  loadingText: 'Accendo le stelle sul soffitto…',
  completeMessage: 'La notte finisce. O forse no.',
  next: 'sogno', // dissolvenza e il giorno dopo

  background: C + 'locale-ballo.png',
  models: { hes: { url: C + 'hes.glb', h: 1.72 } },
  song: 'ballo', // cassa dritta (AudioEngine.js): il battito su cui muoversi
  grid: 6, // caselle da -6 a +6
  start: { i: 0, j: 6 },
  path: PATH,
  notes: NOTES,
  window: [0.2, 0.12], // tolleranza sul battito (s): all'inizio, e arrivati al centro
  lead: 3, // Hes avanza solo se Whiskey è entro 3 caselle; sennò lo aspetta
  fadeTime: 2.6,

  briefing: {
    goal: 'Segui Hes fino al centro della pista',
    controls: 'dance',
    rules: [
      { icon: 'beat', text: 'Ti muovi solo a tempo: premi una freccia quando il cerchio pulsa (sul battito). Un passo per battito.' },
      { icon: 'offbeat', text: 'Fuori tempo non succede niente di grave: perdi il passo e quello dopo. Niente game over.' },
      { icon: 'narrow', text: 'All’inizio il tempo è largo; più ti avvicini al centro, più devi essere preciso.' },
      { icon: 'coin', text: 'Raccogli le note luminose sulla pista: contano come monete.' },
      { icon: 'hes', text: 'Hes fa strada verso il centro e ti aspetta se resti indietro. Raggiungila al centro.' }
    ],
    tip: 'Ascolta la cassa, non i piedi. I piedi mentono.'
  },

  voices: {
    ritmo: { url: VOCE + 'ballo-ritmo.wav', text: 'Segui il ritmo, non la fretta. La pista non scappa, tu sì, se sbagli passo.' }
  }
};
