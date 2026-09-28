# WiSiVERSE

Il mondo di Whiskey, in browser (three.js + Vite). Il gioco ha due parti, scelte dal menu principale:

- **Storia** (la parte principale, selezionata all'avvio): Whiskey a piedi tra i pianeti, a cominciare dalla piazza 3D di Niaboc e dallo Stadio di Space Ball.
- **WisiKart**: la sezione delle gare in kart, con sei Whiskey, quattro circuiti e due coppe (Gran Premio, corsa singola, prova a tempo), avversari IA, oggetti, derapate e mini‑turbo.

Più opzioni e crediti; voce di Emma e musica generata in tempo reale in tutto il gioco.

Il repository, le cartelle e la chiave di salvataggio nel browser (`wisikart.save.v1`) mantengono il vecchio nome WisiKart, così record e progressi non si perdono.

## Menu

- **Menu principale** (titolo WiSiVERSE, sfondo `ui/wisiverse-title.png`, logo `ui/wisiverse-logo.png`): Storia (copertina `ui/card-storia.png`), WisiKart (copertina `ui/card-wisikart.png`), Opzioni, Crediti. Le copertine hanno il titolo già nell'immagine: le card mostrano solo l'immagine intera (stessa altezza, larghezza in proporzione) e una piccola etichetta. Storia porta direttamente alla piazza di Niaboc.
- **Sottomenu WisiKart** (logo WisiKart, video `video/intro.mp4` come sfondo): Gran Premio, Corsa singola, Prova a tempo, Torna al menu principale.
- Uscendo da una gara (risultati o pausa) si torna al sottomenu WisiKart; uscendo dalla Storia (pausa della piazza o del livello) si torna al menu principale. Finito un livello si ricompare nella piazza, davanti al suo ingresso.

## WisiKart

### Circuiti

| Circuito | Tema | Lunghezza | Note |
|---|---|---|---|
| **Spazio Vettore Omega 65** | tunnel | 3,2 km | pareti magnetiche, autovettori che fluttuano |
| **Canair – Promontorio Utgenra** | aperto, tramonto | 2,6 km | statue di Oremo, fontana, tavola calda |
| **Niaboc – Deposito Valvo Go** | aperto, notte | 2,4 km | città sotto le due lune: palazzi con finestre accese e neon, lampioni, deposito Valvo Go, portale al neon sopra la pista, blindato |
| **Lago di Retah** | aperto, pianeta piatto | 2,7 km | lago calmo a sinistra della seconda metà, tavola calda con autovettori parcheggiati, blindati dei cacciatori di taglie, relitto |

### Coppe (Gran Premio)

Nel Gran Premio, dopo il personaggio si sceglie la coppa. Punti per gara: 10, 8, 6, 4, 2, 1; a fine coppa la classifica mostra i punti gara per gara.

- **Coppa della Fuga**: Omega 65 → Canair.
- **Coppa delle Galassie Unite**: Niaboc → Omega 65 → Retah → Canair.

## Storia

La parte principale del WiSiVERSE (prima voce del menu principale), separata dalle gare: parte da una **piazza 3D di Niaboc** da attraversare a piedi, in terza persona come un mini Super Mario 64: cielo notturno con le due lune, palette e palazzi della pista di Niaboc, fontana al centro. Cinque ingressi, attivati camminandoci dentro (nessun menu), in un ordine obbligato: **Stadio di Space Ball** (`story/niaboc/stadio-esterno.glb`, livello 1) → **Deposito Valvo & Go** (`props/valvo-go.glb`, livello 2, chiuso finché non vinci lo stadio) → **Portale di Niaboc** (`props/portale-niaboc.glb`, subito dietro il deposito, sigillato finché non finisci il deposito; poi per ora solo un messaggio). **Vicoli notturni** (`story/niaboc/arco-vicoli.glb`) e **Biblioteca** (`story/niaboc/biblioteca.glb`) restano chiusi con lucchetto: si apriranno quando Whiskey tornerà a Niaboc. I livelli completati sono salvati (`save.story`) e al ricaricamento lucchetti e ordine si ricostruiscono. La piazza è descritta in `src/story/worlds.js`. Comandi in piazza: Frecce / WASD, Spazio o K per saltare, Q / E per girare la telecamera.

Nella Storia si gioca sempre con **Whiskey basic** (`story/characters/basic.glb`), il personaggio di partenza. I sei Whiskey del kart sono le sue "forme", che si sbloccheranno più avanti nella storia (capitoli 8-9): i loro modelli per la Storia sono già in `story/characters/<id>.glb`, ma per ora non si scelgono (`src/story/hero.js`). Nel kart restano giocabili i sei Whiskey, con i modelli del kart.

I modelli della Storia hanno lo **scheletro**: camminata, corsa, salto, scale e lancio sono animati sulle ossa vere (`src/story/Rig.js`, nomi in stile Mixamo con riconoscimento anche di nomi diversi; se a riposo un braccio è alzato viene portato lungo il fianco, se le ginocchia sono mal posizionate non si piegano, e se piede e ginocchio stanno sopra l'anca, come nella Monna con la veste lunga, le gambe restano ferme e il corpo dondola a ogni passo mentre braccia, busto e testa si animano sulle ossa). Un modello senza scheletro si anima come corpo rigido; senza file resta la versione procedurale con la faccia di `faceTexture`.

**Livello 1 – Stadio di Space Ball**: gradinate (file di sedili, alcune crollano; tifosi da scavalcare; sciarpe da saltare o da passarci sotto; bottiglie e secchi dagli spalti), campo (palle spaziali a pendolo, porte da passare sotto e una porta alta da cui saltare il fossato, bottigliera), tunnel degli spogliatoi (scale, grate, tre steward da evitare o stordire, cassa di bottiglie) e arena in cima con il **Tifoso Supremo**: lancia sedili a parabola (il bersaglio rosso a terra dice dove cadranno), ogni tanto uno lascia una bottiglia; servono tre bottigliate.

**Livello 2 – Deposito Valvo & Go** (asset in `story/valvo/`): platform industriale senza boss, in tre sezioni. **Scaffali**: casse impilate come piattaforme (`cassa.glb`), nastri trasportatori che trascinano e cambiano verso (le frecce lampeggiano prima), carrelli-droide che pattugliano (`carrello.glb`, si stordiscono con una bottigliata), bottiglie sulle casse e casse con monete da aprire a bottigliate. **Sala valvole**: getti di vapore a intervalli fissi (`valvola.glb`); quello verso l'alto è un trampolino per le grate alte, quello laterale respinge; leve da colpire con una bottiglia per aprire le paratie; in fondo il badge (`badge.png`). **Hangar a tempo**: preso il badge scatta l'allarme, le saracinesche scendono una dopo l'altra (si passa solo scivolando, **giù mentre corri**), timer e bordo rosso nell'HUD, droidi che spuntano; restare chiusi dietro una saracinesca costa una vita e fa ripartire l'hangar. In fondo l'autovettore sotto il faro (`props/autovettore.glb`): Emma si accende con una battuta (voce `welcome.wav` in attesa di quelle dedicate) e si torna in piazza.

Comandi: **Frecce / A D** cammina · **Spazio / K** salta (più lo tieni, più salti in alto) · **Su / Giù** sulle scale · **Giù mentre corri** scivola · **Maiusc / E / J** lancia · **Esc** pausa. HUD: vite, bottiglie, monete, badge, vita del boss, timer dell'allarme. Le cadute nel vuoto riportano all'ultimo checkpoint; a zero vite il livello riparte da capo.

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
| `ui/wisiverse-logo.png`, `ui/wisiverse-title.png` | logo e sfondo del WiSiVERSE | boot e menu principale |
| `ui/card-storia.png`, `ui/card-wisikart.png` | copertine della Storia e di WisiKart | menu principale |
| `ui/logo.png`, `ui/title.png` | logo WisiKart e sua illustrazione | sottomenu WisiKart (l'illustrazione se manca il video) |
| `items/*.png` | icone oggetti | HUD |
| `audio/voice/*.wav` | 6 battute di Emma (welcome, start, lastlap, hit, hitother, win) | annunci in gara |
| `story/stadio/*` | sfondi (gradinate, campo, tunnel) e modelli (tifoso, steward, bottiglia) della Storia, elencati in `public/assets/story/manifest.json` | modalità Storia |
| `video/intro.mp4`, `finale.mp4`, `griglia.mp4` | video | sfondo del sottomenu WisiKart, finale del Gran Premio, griglia di partenza di Omega 65 |
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
  story/worlds.js       piazze dei pianeti: ingressi, modelli, messaggi, ordine di sblocco
  story/valvo.js        dati del livello 2 (Deposito Valvo & Go) e sue entità (valvo-entities.js)
  story/Hub.js          piazza 3D in terza persona: movimento, collisioni, ingressi, telecamera
  story/Rig.js          personaggi con scheletro: caricamento, riconoscimento delle ossa, pose animate
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
