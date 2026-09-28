import { CHARACTERS } from '../config/characters.js';

// Il protagonista della Storia. Si parte sempre con Whiskey basic (story/characters/basic.glb):
// piazza di Niaboc e livelli usano lui. I sei Whiskey del kart sono le sue "forme", che si sbloccheranno
// più avanti nella storia (capitoli 8-9); per ora nella Storia non si scelgono.
// Nel kart (WisiKart) restano giocabili i sei Whiskey, con i loro modelli del kart.

export const WHISKEY_BASIC = {
  id: 'basic',
  name: 'Whiskey',
  // colori usati solo dal ripiego procedurale (se manca basic.glb); la faccia resta quella di faceTexture
  colors: { primary: '#2b3a6b', secondary: '#f5b942', skin: '#5b8cf0', hair: '#1a1410' },
  look: { hair: 'none', hat: 'none' }
};

/** Le forme di Whiskey: stessi id dei piloti del kart, modelli in story/characters/<id>.glb. */
export const WHISKEY_FORMS = CHARACTERS.map((c) => ({ ...c, unlockChapter: 8 }));

/** Il personaggio con cui si gioca la Storia (per ora sempre Whiskey basic). */
export function storyHero() {
  return WHISKEY_BASIC;
}
