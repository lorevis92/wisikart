# WiSiVERSE

Il mondo di Whiskey, in browser (three.js + Vite). Il gioco ha due parti, scelte dal menu principale:

- **Storia** (la parte principale, selezionata all'avvio): Whiskey a piedi tra i pianeti, a cominciare dalla piazza 3D di Niaboc e dallo Stadio di Space Ball.
- **WisiKart**: la sezione delle gare in kart, con sei Whiskey, quattro circuiti e due coppe (Gran Premio, corsa singola, prova a tempo), avversari IA, oggetti, derapate e mini‑turbo.

Più opzioni e crediti; voce di Emma e musica generata in tempo reale in tutto il gioco.

Il repository, le cartelle e la chiave di salvataggio nel browser (`wisikart.save.v1`) mantengono il vecchio nome WisiKart, così record e progressi non si perdono.

## Menu

- **Menu principale** (titolo WiSiVERSE, sfondo `ui/wisiverse-title.png`, logo `ui/wisiverse-logo.png`): Storia (copertina `ui/card-storia.png`), WisiKart (copertina `ui/card-wisikart.png`), Opzioni, Crediti. Le copertine hanno il titolo già nell'immagine: le card mostrano solo l'immagine intera (stessa altezza, larghezza in proporzione) e una piccola etichetta. Storia porta direttamente alla piazza del pianeta in cui si trova Whiskey (Niaboc, poi Retah).
- **Sottomenu WisiKart** (logo WisiKart, video `video/intro.mp4` come sfondo): Gran Premio, Corsa singola, Prova a tempo, Torna al menu principale.
- Uscendo da una gara (risultati o menu di gioco) si torna al sottomenu WisiKart; uscendo dalla Storia (menu di gioco della piazza o del livello) si torna al menu principale. Finito un livello si ricompare nella piazza, davanti al suo ingresso.
- **Menu di gioco** (Esc, Start sul gamepad, tasto **II** nell'angolo in alto a destra): si apre ovunque si giochi, in piazza, nei livelli, in gara, durante i caricamenti e anche sopra cinematiche e video (che si fermano). Voci: Riprendi, Istruzioni (solo nei livelli della Storia), Ricomincia, i comandi audio ed Esci, con conferma ("Vuoi davvero uscire? I progressi di questo livello andranno persi"). Si naviga con frecce, croce del gamepad o tocco; sulle righe audio Invio/A accende e spegne, sinistra/destra regolano il volume; Esc o B tornano indietro.
- **Audio**: Musica, Voce di Emma ed Effetti hanno ciascuno interruttore e volume; in più **Silenzio totale** e **Sottotitoli** (attivi di default). **M** silenzia o riaccende tutto, sempre e ovunque. L'**altoparlante** nell'angolo in alto a destra, sempre visibile: il primo tocco silenzia tutto, il secondo apre il pannello audio (in gioco è il menu di gioco, fuori un pannello a parte). Spegnere la voce di Emma interrompe subito la battuta e svuota la coda; i sottotitoli restano. Le impostazioni si salvano con il resto e valgono in ogni schermata, Opzioni comprese (che usano le stesse righe).

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

La parte principale del WiSiVERSE (prima voce del menu principale), separata dalle gare: parte da una **piazza 3D di Niaboc** da attraversare a piedi, in terza persona come un mini Super Mario 64: cielo notturno con le due lune, palette e palazzi della pista di Niaboc, fontana al centro. Cinque ingressi, attivati camminandoci dentro (nessun menu), in un ordine obbligato: **Stadio di Space Ball** (`story/niaboc/stadio-esterno.glb`, livello 1) → **Deposito Valvo & Go** (`props/valvo-go.glb`, livello 2, chiuso finché non vinci lo stadio) → **Portale: corsa al varco** (`props/portale-niaboc.glb`, subito dietro il deposito, livello 3, sigillato finché non finisci il deposito). **Vicoli notturni** (`story/niaboc/arco-vicoli.glb`) e **Biblioteca** (`story/niaboc/biblioteca.glb`) restano chiusi con lucchetto: si apriranno quando Whiskey tornerà a Niaboc. I livelli completati sono salvati (`save.story`) e al ricaricamento lucchetti e ordine si ricostruiscono. La piazza è descritta in `src/story/worlds.js`. Comandi in piazza: Frecce / WASD, Spazio o K per saltare, Q / E per girare la telecamera.

**Retah**: vinto il Portale e finita la cinematica del tunnel si atterra su Retah (`save.storyWorld`; i salvataggi che avevano già finito il Portale ci arrivano da soli) e per ora non si torna a Niaboc. Seconda piazza 3D, stessa camminata: pianura di sabbia piatta al tramonto (cielo `tracks/retah/sky.png`, colori del circuito di Retah), un lago calmo sul lato est con la riva che ferma il passo, cespugli bassi, la **tavola calda** al centro (`props/tavola-calda.glb`) con tre autovettori parcheggiati, due blindati fermi e minacciosi con le luci rosse (`props/blindato.glb`) e un relitto inclinato mezzo insabbiato (`props/relitto.glb`). Due ingressi: la **Tavola calda** (livello 4, aperta) e l'**autovettore di Emma** sul retro (livello 5, chiuso finché non si finisce la rissa). Niente livelli bonus. Finito il livello 5: "Il viaggio verso Canair è in arrivo".

Nella Storia si gioca sempre con **Whiskey basic** (`story/characters/basic.glb`), il personaggio di partenza. I sei Whiskey del kart sono le sue "forme", che si sbloccheranno più avanti nella storia (capitoli 8-9): i loro modelli per la Storia sono già in `story/characters/<id>.glb`, ma per ora non si scelgono (`src/story/hero.js`). Nel kart restano giocabili i sei Whiskey, con i modelli del kart.

I modelli della Storia hanno lo **scheletro**: camminata, corsa, salto, scale e lancio sono animati sulle ossa vere (`src/story/Rig.js`, nomi in stile Mixamo con riconoscimento anche di nomi diversi; se a riposo un braccio è alzato viene portato lungo il fianco, se le ginocchia sono mal posizionate non si piegano, e se piede e ginocchio stanno sopra l'anca, come nella Monna con la veste lunga, le gambe restano ferme e il corpo dondola a ogni passo mentre braccia, busto e testa si animano sulle ossa). Un modello senza scheletro si anima come corpo rigido; senza file resta la versione procedurale con la faccia di `faceTexture`.

**Livello 1 – Stadio di Space Ball**: gradinate (file di sedili, alcune crollano; tifosi da scavalcare; sciarpe da saltare o da passarci sotto; bottiglie e secchi dagli spalti), campo (palle spaziali a pendolo, porte da passare sotto e una porta alta da cui saltare il fossato, bottigliera), tunnel degli spogliatoi (scale, grate, tre steward da evitare o stordire, cassa di bottiglie) e arena in cima con il **Tifoso Supremo**: lancia sedili a parabola (il bersaglio rosso a terra dice dove cadranno), ogni tanto uno lascia una bottiglia; servono tre bottigliate.

**Livello 2 – Deposito Valvo & Go** (asset in `story/valvo/`): platform industriale senza boss, in tre sezioni. **Scaffali**: casse impilate come piattaforme (`cassa.glb`), nastri trasportatori che trascinano e cambiano verso (le frecce lampeggiano prima), carrelli-droide che pattugliano (`carrello.glb`, si stordiscono con una bottigliata), bottiglie sulle casse e casse con monete da aprire a bottigliate. **Sala valvole**: getti di vapore a intervalli fissi (`valvola.glb`); quello verso l'alto è un trampolino per le grate alte, quello laterale respinge; leve da colpire con una bottiglia per aprire le paratie; in fondo il badge (`badge.png`). **Hangar a tempo**: preso il badge scatta l'allarme, le saracinesche scendono una dopo l'altra (si passa solo scivolando, **giù mentre corri**), timer e bordo rosso nell'HUD, droidi che spuntano; restare chiusi dietro una saracinesca costa una vita e fa ripartire l'hangar. In fondo l'autovettore sotto il faro (`props/autovettore.glb`): Emma si accende con una battuta (voce `welcome.wav` in attesa di quelle dedicate) e si torna in piazza.

**Livello 3 – Portale: corsa al varco** (primo livello di volo, `src/story/FlightMode.js` + `portale.js`): si pilota Emma (`props/autovettore.glb`) sul circuito di Niaboc di WisiKart (stessa pista, stesso ambiente notturno, senza scatole oggetti e senza il portale a metà giro). Un solo giro contro il **gong di mezzogiorno**. Il timer parte volutamente troppo corto (12,5 s): **il tempo lo danno gli anelli**, +3 s ciascuno e in catena +4 dal terzo di fila e +5 dal quarto (il suono sale di tono); mancarne uno non toglie tempo ma azzera la catena. **Anelli dorati** in punti scomodi (sotto il ponte, rasoterra dopo una barriera, dove la pattuglia stringe): tempo come gli altri, turbo breve e 5 monete; facoltativi, ma sono il modo di recuperare un errore. Taratura verificata con piloti automatici: tutti gli anelli normali = 7,3 s di margine (argento); con i dorati 21 s (oro); un anello mancato a metà si recupera prendendo i dorati; 3 o più mancati senza recupero non arrivano. **Pattuglia**: il caposquadra (più grosso, luci bianche) lampeggia e lancia blocchi d'energia in linea retta; le due gregarie fanno la **tenaglia** (luci ambra, poi si stringono ai lati, poi si aprono); si superano o si spostano sparando, un urto costa 2 s e velocità, passarci vicino è una **Sfiorata** (+0,5 s). Barriere di energia nella seconda metà e un **ponte basso** da passare sopra o sotto; un tratto **dentro un capannone** buio con archi al neon (lì la quota ha un soffitto) e una **picchiata** nel tratto in discesa più ripido. Linee di velocità, scia luminosa, campo visivo che si allarga col turbo, scosse negli urti; negli ultimi 10 secondi bordo rosso, gong che batte come un cuore e musica che accelera (tema `volo`). In fondo il Portale al neon: lampo bianco, cinematica del tunnel (`video/intro.mp4`), **medaglie** (bronzo, argento, oro secondo tempo rimasto, anelli e monete; la migliore si salva in `save.storyMedals` e compare sull'ingresso in piazza), poi la piazza; arrivando tardi si rifà il giro. Emma commenta in tempo reale con le sue battute (`story/voce/volo-*.wav`), una alla volta. Comandi in volo: **Sinistra / Destra** sterza, **Su / Giù** quota, **Spazio / K** spara (tenuto = raffica), **Maiusc / E / J** frena; su touch **Spara** e **Frena**, sul gamepad A spara e X frena.

**Livello 4 – Rissa alla tavola calda** (`src/story/BrawlMode.js` + `rissa.js`, asset in `story/retah/`): brawler ad arena su un solo ambiente, telecamera fissa, sfondo `tavola-interno.png` (un pavimento invisibile raccoglie le ombre). Ci si muove a destra/sinistra **e in profondità**. Whiskey: **pugno** in combo di tre colpi (il terzo è un calcio che manda a terra; in aria diventa un calcio volante), **salto** (schiva i pugni), **bottiglie** contate (3, massimo 6; i nemici battuti a volte ne lasciano cadere due), e raccoglie e lancia **sgabelli** e **piatti** dell'arena (`sgabello.glb`, `piatto.glb`; tornano al loro posto a ogni ondata). Tre ondate: sei **scagnozzi** (`scagnozzo.glb`, con scheletro) che entrano in gruppo; due **cacciatori col manganello** (`cacciatore.glb`, senza scheletro: corpo rigido e manganello animato a parte), più resistenti e con un colpo più lungo, e a metà del primo arriva uno scagnozzo; il **capo** (`capo.glb`) con barra della vita: i colpi leggeri non lo fermano, e ogni 4,5 s segna un **bersaglio rosso a terra** dove si trova Whiskey e lancia la rete: presi dentro si perde una vita intera, schivarla è l'unico modo; a metà vita entrano due scagnozzi. Il **juke-box** (`jukebox.glb`), colpito con un pugno o un lancio, stordisce tutti i nemici per 4 s, una volta per ondata. Vite come negli altri livelli (3, più quelle guadagnate con le monete in volo) e una barra di salute sotto i cuori (6 colpi; +2 tra un'ondata e l'altra). Vinta la terza ondata si accende la porta della cucina: ci si esce e il livello finisce. Un colpo nemico già caricato non si interrompe con un pugno leggero (ci si scambia i colpi). Tema musicale `rissa` (arcade, 152 bpm). Emma parla dagli auricolari (`story/voce/rissa-*.wav`): entrata, ondate, capo, juke-box, colpito, fine, vita persa. Taratura con piloti automatici: chi combatte e schiva la rete finisce perdendo una vita, chi non schiva la rete ne perde due, chi sta fermo perde.

**Livello 5 – Inseguimento sul lago** (`src/story/ChaseMode.js`, che estende il motore del Portale, + `inseguimento.js`): volo con l'autovettore sul circuito di Retah di WisiKart, a bassa quota sopra sabbia e lago, libero di alzarsi. Niente timer: si sopravvive fino allo **spazio vettore** in fondo al giro. Due **blindati** inseguono da dietro: **Spara** mira da solo il blindato più vicino, sei colpi e "Preso uno!" (resta indietro e per un po' non lancia, poi ha qualche secondo di corazza). **Missili**: avviso con la direzione ("Missile da sinistra!"), lancio, il missile insegue fino a 0,8 s dall'impatto e poi va dritto: quando compare **Scarta!** ci si sposta di lato o in quota. **Cannone ionico**: barra di carica in alto (16 s); a barra piena 2,8 s di conto alla rovescia, poi un raggio largo scende sul percorso: al sicuro solo **subito dietro un riparo** (cespugli alti e relitti, 18 in tutto, con una colonna di luce verde che si vede da lontano e, col cannone carico, la zona sicura illuminata a terra) e non più in alto di lui; sbatterci contro rallenta ma non costa cuori. Salute a **cinque cuori** (missile 1, raggio 2): a zero si riparte dall'ultimo checkpoint (tre sul giro). **Finale scritto**: negli ultimi 380 m la barra resta quasi piena, Emma chiama lo spazio vettore, ci si tuffa dentro e un attimo dopo il raggio colpisce l'imbocco alle spalle; poi la cinematica (`video/intro.mp4`) e la piazza di Retah. Tema `volo`; battute `story/voce/insegui-*.wav`. Taratura con piloti automatici: giro di circa 65-80 s; chi schiva al momento giusto non prende missili, chi non schiva ne prende circa due su tre, chi ignora i ripari prende tutti i raggi.

**Sottotitoli di Emma**: nei livelli con le sue battute (volo, rissa, inseguimento) il testo compare in basso, una battuta alla volta; restano anche con la voce spenta (opzione **Sottotitoli** nel menu). I testi dei sottotitoli di Retah sono scritti a partire dal nome di ogni battuta: se l'audio dice altro, vanno allineati in `rissa.js` e `inseguimento.js`.

**Monete**: sono un totale unico della Storia, portato avanti tra i livelli e salvato a ogni raccolta (`save.storyCoins`). Ogni 100 monete, una vita in più (messaggio e cuori che si illuminano); se succede in un livello di volo, la vita vale nel prossimo livello a piedi.

**Istruzioni**: prima di ogni livello compare una schermata con obiettivo, comandi con i tasti disegnati per l'input in uso (tastiera, touch o gamepad), regole con icone e un consiglio di Emma; un tasto qualsiasi la chiude, e dal menu di gioco si riapre con **Istruzioni**. I contenuti stanno nei dati del livello (`briefing`), la schermata in `src/story/briefing.js`.

Comandi: **Frecce / A D** cammina · **Spazio / K** salta (più lo tieni, più salti in alto) · **Su / Giù** sulle scale · **Giù mentre corri** scivola · **Maiusc / E / J** lancia · **Esc** menu di gioco · **M** silenzio. Nella rissa: **F / L** pugno (X sul gamepad, tasto Pugno su touch), **Su / Giù** in profondità. HUD: vite, bottiglie, monete, badge, vita del boss, timer dell'allarme. Le cadute nel vuoto riportano all'ultimo checkpoint; a zero vite il livello riparte da capo.

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
| `story/retah/*` | sfondo della tavola calda, scagnozzo, cacciatore, capo, sgabello, piatto, juke-box | livello 4 (rissa) |
| `story/voce/*.wav` | battute di Emma dei livelli (volo, rissa, inseguimento) | sottotitoli e voce nei livelli |
| `video/intro.mp4`, `finale.mp4`, `griglia.mp4` | video | sfondo del sottomenu WisiKart, finale del Gran Premio, griglia di partenza di Omega 65 |
| `tracks/<id>/griglia.mp4` | video della griglia di partenza (Niaboc, Canair, Retah) | schermata di caricamento della pista |

Se un modello GLB guarda dalla parte sbagliata, cambia `modelRotY` in `src/config/characters.js` (valori tipici: `0`, `Math.PI`, `±Math.PI/2`). L'altezza dei modelli viene normalizzata automaticamente.

## Comandi

Frecce/WASD guida · **Spazio** derapata (tieni premuto in curva, rilascia per il turbo: blu dopo ~1 s, arancione dopo ~2,3 s) · **Maiusc / E** oggetto · **C** guarda indietro · **Esc** menu di gioco · **M** silenzio. Su touch compaiono i tasti sullo schermo (menu e audio nell'angolo in alto a destra). Gamepad supportato (A gas, X freno, B/RB derapata, Y/LB oggetto, Start menu di gioco).

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
  story/portale.js      dati del livello 3 (volo: anelli, barriere, pattuglia, battute di Emma)
  story/FlightMode.js   livelli di volo sul circuito del kart: guida, anelli, gong
  story/ChaseMode.js    inseguimento in volo (estende FlightMode): blindati, missili, cannone ionico, ripari, checkpoint
  story/inseguimento.js dati del livello 5 (inseguimento sul lago di Retah)
  story/BrawlMode.js    brawler ad arena: combo, lanci, ondate, juke-box, rete del capo
  story/rissa.js        dati del livello 4 (rissa alla tavola calda)
  story/emma.js         battute di Emma nei livelli: una alla volta, sottotitoli, voce spenta
  story/briefing.js     schermata di istruzioni prima di ogni livello (comandi per input, icone)
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
