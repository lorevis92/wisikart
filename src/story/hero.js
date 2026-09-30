import * as THREE from 'three';
import { CHARACTERS } from '../config/characters.js';
import { Assets } from '../core/AssetLoader.js';

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

/**
 * Il personaggio con cui si gioca la Storia (per ora sempre Whiskey basic). guitar = vinta da Infinity Guitars
 * (save.storyGuitar): da lì in poi Whiskey la porta sempre sulla schiena (vedi attachGuitar).
 */
export function storyHero({ guitar = false } = {}) {
  return { ...WHISKEY_BASIC, guitar };
}

export const GUITAR_URL = 'assets/story/canair/chitarra.glb';

/**
 * Aggiunge la chitarra al personaggio: `root` è il gruppo che si gira col personaggio (davanti = +Z).
 * where = 'back' (a tracolla, di traverso sulla schiena) o 'front' (imbracciata, per suonare).
 * Ritorna il gruppo della chitarra (una chitarra semplice se il modello manca).
 */
export async function attachGuitar(root, where = 'back', height = 1.8) {
  const k = height / 1.8;
  let m = await Assets.model(GUITAR_URL, { targetHeight: 1.0 * k });
  if (!m) {
    m = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * k, 0.24 * k, 0.1 * k, 16), new THREE.MeshStandardMaterial({ color: 0xc0392b }));
    body.rotation.x = Math.PI / 2;
    body.position.y = 0.25 * k;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.06 * k, 0.6 * k, 0.04 * k), new THREE.MeshStandardMaterial({ color: 0x5a3a22 }));
    neck.position.y = 0.7 * k;
    m.add(body, neck);
  }
  m.position.y -= 0.5 * k; // il centro della chitarra nel punto di aggancio
  const g = new THREE.Group();
  g.add(m);
  if (where === 'back') {
    g.position.set(0, 1.12 * k, -0.24 * k);
    g.rotation.set(0.1, Math.PI, 0.55);
  } else {
    g.position.set(0.05 * k, 1.0 * k, 0.3 * k);
    g.rotation.set(0.15, 0, -1.05); // di traverso davanti, manico verso sinistra e in alto
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.add(g);
  return g;
}
