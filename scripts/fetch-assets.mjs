// Scarica tutti gli asset elencati in public/assets/manifest.json.
// Uso: npm run assets
// I file già presenti vengono saltati. Funziona con Node 18+ (fetch nativo).
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const entries = Object.entries(manifest.files);

let ok = 0, skipped = 0, failed = 0;
for (const [rel, url] of entries) {
  const dest = join(root, rel);
  try {
    await stat(dest);
    skipped++;
    continue;
  } catch {}
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
console.log(`\nScaricati: ${ok}  Già presenti: ${skipped}  Falliti: ${failed}`);
if (failed) console.log('Per i file falliti puoi scaricarli a mano dal link nel manifest e metterli nel percorso indicato.');
