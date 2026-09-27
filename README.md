# WisiKart

Il kart racer del WiSiVERSE: sei Whiskey, quattro circuiti, due coppe. Gioco completo in browser (three.js + Vite): menu, Gran Premio, corsa singola, prova a tempo, opzioni, crediti, gara con oggetti, avversari IA, derapate e mini‑turbo, voce di Emma, musica generata in tempo reale.

## Circuiti

| Circuito | Tema | Lunghezza | Note |
|---|---|---|---|
| **Spazio Vettore Omega 65** | tunnel | 3,2 km | pareti magnetiche, autovettori che fluttuano |
| **Canair – Promontorio Utgenra** | aperto, tramonto | 2,6 km | statue di Oremo, fontana, tavola calda |
| **Niaboc – Deposito Valvo Go** | aperto, notte | 2,4 km | città sotto le due lune: palazzi con finestre accese e neon, lampioni, deposito Valvo Go, portale al neon sopra la pista, blindato |
| **Lago di Retah** | aperto, pianeta piatto | 2,7 km | lago calmo a sinistra della seconda metà, tavola calda con autovettori parcheggiati, blindati dei cacciatori di taglie, relitto |

## Coppe (Gran Premio)

Nel Gran Premio, dopo il personaggio si sceglie la coppa. Punti per gara: 10, 8, 6, 4, 2, 1; a fine coppa la classifica mostra i punti gara per gara.

- **Coppa della Fuga**: Omega 65 → Canair.
- **Coppa delle Galassie Unite**: Niaboc → Omega 65 → Retah → Canair.

## Storia

Modalità separata dal kart (voce **Storia** nel menu), che parte dalla **mappa del pianeta** in stile Super Mario World: l'illustrazione di Niaboc (`story/niaboc/mappa.png`) con le sfide sopra, da scegliere con le frecce o con un tocco. Stadio di Space Ball (giocabile), Portale di Niaboc (chiuso finché non vinci lo stadio), Deposito Valvo Go, Vicoli notturni e Biblioteca (in arrivo). Le sfide sono in `src/story/worlds.js`.

I livelli sono platform 2.5D a scorrimento laterale con Whiskey a piedi, che cammina, salta e lancia bottiglie. Il personaggio è l'ultimo scelto nel kart (altrimenti la Monna) ed è il suo vero modello `characters/<id>.glb`: al caricamento si tiene solo il personaggio dal busto in su (il kart viene scartato dalla geometria), con gambe e bacino nei suoi colori. Senza GLB si usa la versione procedurale con la faccia di `faceTexture`.

**Livello 1 – Stadio di Space Ball**: gradinate (file di sedili, alcune crollano; tifosi da scavalcare; sciarpe da saltare o da passarci sotto; bottiglie e secchi dagli spalti), campo (palle spaziali a pendolo, porte da passare sotto e una porta alta da cui saltare il fossato, bottigliera), tunnel degli spogliatoi (scale, grate, tre steward da evitare o stordire, cassa di bottiglie) e arena in cima con il **Tifoso Supremo**: lancia sedili a parabola (il bersaglio rosso a terra dice dove cadranno), ogni tanto uno lascia una bottiglia; servono tre bottigliate.

Comandi: **Frecce / A D** cammina · **Spazio / K** salta (più lo tieni, più salti in alto) · **Su / Giù** sulle scale · **Maiusc / E / J** lancia · **Esc** pausa. HUD: vite, bottiglie, vita del boss. Le cadute nel vuoto riportano all'ultimo checkpoint; a zero vite il livello riparte da capo.

## Avvio rapido

```bash
npm install
npm run assets   # scarica immagini, modelli 3D, voci e video da Higgsfield (vedi sotto)
npm run dev      # apre http://localhost:5173
```

Per la versione da pubblicare: `npm run build` produce la cartella `dist/` (statica, pronta per Vercel: c'è già `vercel.json`).

Il gioco funziona anche **senza** scaricare gli asset: usa modelli e texture procedurali come segnaposto (le facce di Whiskey col simbolo fisso, kart semplici, statue e edifici stilizzati). Appena un file esiste nel percorso giusto, viene usato al posto del segnaposto.

## Asset: dove vanno i file

Tutti sotto `public/assets/`. Il file `public/assets/manifest.json` elenca ogni file con l'URL da cui scaricarlo; `npm run assets` li scarica tutti. Se un download fallisce, scarica a mano e metti il file nel percorso indicato.

| Cartella | Contenuto | Usato per |
|---|---|---|
| `characters/<id>.png` | ritratto (monna, bacco, perla, viandante, divoratore, panciotto) | selezione personaggio, risultati |
| `characters/<id>.glb` | modello 3D personaggio + kart | in gara (se manca: kart procedurale con faccia Whiskey) |
| `props/*.glb` | valvo-go, autovettore, tavola-calda, blindato, oremo-giovane, oremo-anziano, portale-niaboc, relitto | scenografia dei circuiti |
| `tracks/<id>/sky.png` | cielo panoramico 16:9 | sfondo delle piste aperte (Canair, Niaboc, Retah) |
| `tracks/<id>/preview.png` | anteprima | selezione pista, caricamento |
| `ui/logo.png`, `ui/title.png` | logo e sfondo del titolo | boot e schermata iniziale |
| `items/*.png` | icone oggetti | HUD |
| `audio/voice/*.wav` | 6 battute di Emma (welcome, start, lastlap, hit, hitother, win) | annunci in gara |
| `story/stadio/*` | sfondi (gradinate, campo, tunnel) e modelli (tifoso, steward, bottiglia) della Storia, elencati in `public/assets/story/manifest.json` | modalità Storia |
| `video/intro.mp4`, `finale.mp4`, `griglia.mp4` | video | sfondo del titolo, finale del Gran Premio, griglia di partenza di Omega 65 |
| `tracks/<id>/griglia.mp4` | video della griglia di partenza (Niaboc, Canair, Retah) | schermata di caricamento della pista |

Se un modello GLB guarda dalla parte sbagliata, cambia `modelRotY` in `src/config/characters.js` (valori tipici: `0`, `Math.PI`, `±Math.PI/2`). L'altezza dei modelli viene normalizzata automaticamente.

## Comandi

Frecce/WASD guida · **Spazio** derapata (tieni premuto in curva, rilascia per il turbo: blu dopo ~1 s, arancione dopo ~2,3 s) · **Maiusc / E** oggetto · **C** guarda indietro · **Esc** pausa. Su touch compaiono i tasti sullo schermo. Gamepad supportato (A gas, X freno, B/RB derapata, Y/LB oggetto, Start pausa).

## Struttura del codice

```
src/
  main.js               stato del gioco, renderer, bloom, Gran Premio, salvataggi (localStorage)
  config/characters.js  i sei piloti: statistiche, colori, oggetto preferito, asset
  config/items.js       oggetti e probabilità per posizione
  config/tracks.js      circuiti: punti di controllo, palette, scenario (world), oggetti di scena, coppe
  core/Textures.js      texture procedurali (asfalto, cordoli, tunnel, erba, faccia di Whiskey)
  core/AssetLoader.js   carica texture/GLB/audio con fallback se il file manca
  core/Input.js         tastiera, touch, gamepad, navigazione menu
  track/Track.js        costruisce la pista dalla spline: strada, cordoli, tunnel o mondo aperto (città, lampioni, lago), scatole, pad
  track/Props.js        oggetti di scena (GLB o versione procedurale)
  kart/Kart.js          fisica arcade e resa del kart
  ai/AIDriver.js        avversari
  items/ItemSystem.js   missile, colpo ionico, grappoli, lampo, nebbia, pugno, turbo
  race/Race.js          conto alla rovescia, giri, classifica, telecamera, arrivo
  audio/AudioEngine.js  musica in tempo reale, effetti, motore, voci di Emma
  ui/UI.js + style.css  tutte le schermate e l'HUD
  story/StoryMode.js    modalità Storia: scena, telecamera laterale, danni, checkpoint, boss, HUD
  story/Player.js       Whiskey platform: fisica (coyote, salto variabile, scale) e animazioni
  story/entities.js     sedili che crollano, tifosi, sciarpe, pendoli, steward, boss, pickup, proiettili
  story/stadio.js       dati del livello 1 (misure pensate sulla fisica del salto)
  story/worlds.js       mappe dei pianeti: immagine e sfide (livelli, portali, bonus)
scripts/fetch-assets.mjs  scarica gli asset di entrambi i manifest (kart e Storia)
scripts/check-tracks.mjs  controlla le piste (lunghezza, raggio minimo, incroci)
```

## Aggiungere un circuito

1. In `src/config/tracks.js` aggiungi una voce con `points` (curva chiusa), `theme` (`open` o `tunnel`), `palette`, `startT`, `itemBoxes`, `boostPads`, `props`, `music`.
2. Per il tema aperto, l'oggetto opzionale `world` regola lo scenario (senza, vale il paesaggio di Canair): `night` (finestre accese, neon, luna), `flat` (terreno piatto), `trees`/`rocks`/`bushes`, `city` (tratti con palazzi), `neon`, `lamps`, `lake` (`{ from, to, side, reach }`), `fog`. La spiegazione completa è in testa al file.
3. `node scripts/check-tracks.mjs` per verificare che non ci siano incroci e che il raggio minimo sia sopra ~25 m.
4. Per metterla in una coppa, aggiungi il suo `id` a `CUPS` in fondo allo stesso file.

## Strumenti di test

In console del browser: `wisikart.race.autopilot = true` fa guidare l'IA al posto tuo; `wisikart.simulate(30)` fa avanzare la gara di 30 secondi senza aspettare i frame. Utile per provare le piste velocemente.
