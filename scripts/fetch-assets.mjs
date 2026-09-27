// Scarica tutti gli asset elencati nei manifest: public/assets/manifest.json (kart)
// e public/assets/story/manifest.json (modalità Storia). Ogni percorso è relativo alla cartella del suo manifest.
// Uso: npm run assets
// I file già presenti vengono saltati. Funziona con Node 18+ (fetch nativo).
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');
const manifests = [assets, join(assets, 'story')];
const entries = [];
for (const root of manifests) {
  let manifest;
  try { manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')); } catch { continue; }
  for (const [rel, url] of Object.entries(manifest.files)) entries.push([root, rel, url]);
}

let ok = 0, skipped = 0, failed = 0, todo = 0;
for (const [root, rel, url] of entries) {
  const dest = join(root, rel);
  try {
    await stat(dest);
    skipped++;
    continue;
  } catch {}
  // voci segnaposto ("TODO"): il gioco usa la versione procedurale finché non c'è l'URL
  if (!/^https?:\/\//.test(url)) {
    console.log(`… ${rel}: URL da completare, uso il segnaposto procedurale`);
    todo++;
    continue;
  }
  try {
    process.stdout.write(`↓ ${rel} ... `);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    console.log(`${(buf.length / 1024).toFixed(0)} KB`);
    ok++;
  } catch (e) {
    console.log(`ERRORE (${e.message})`);
    failed++;
  }
}
console.log(`\nScaricati: ${ok}  Già presenti: ${skipped}  Da completare: ${todo}  Falliti: ${failed}`);
if (failed) console.log('Per i file falliti puoi scaricarli a mano dal link nel manifest e metterli nel percorso indicato.');
