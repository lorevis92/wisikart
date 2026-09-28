# Note per Claude Code

- Progetto: **WiSiVERSE**, il gioco completo del mondo di Whiskey. Vite + three.js, vanilla JS (ES modules), nessun framework UI.
- Due modalità, scelte dal menu principale:
  - **Storia** (la parte principale): piazza 3D di Niaboc in terza persona, livelli platform 2.5D (per ora lo Stadio di Space Ball), personaggi con scheletro. Codice in `src/story/`: `Hub.js` (piazza), `worlds.js` (ingressi della piazza), `StoryMode.js` + `Player.js` + `entities.js` (livelli platform), `stadio.js` (dati del livello 1), `Rig.js` (personaggi con scheletro: ossa e pose animate).
  - **WisiKart**: la sezione con le gare in kart, dentro `src/` come prima (`race/`, `kart/`, `ai/`, `items/`, `track/`, `config/`). Circuiti e coppe in `src/config/tracks.js`; verificali con `node scripts/check-tracks.mjs`.
  - `src/main.js` gestisce stati e passaggi tra menu, Storia e WisiKart; le schermate sono in `src/ui/UI.js` e `index.html`.
- Asset: manifest principale `public/assets/manifest.json` (kart, UI, video) e manifest della Storia `public/assets/story/manifest.json` (percorsi relativi a `public/assets/story/`). `npm run assets` scarica entrambi; i file binari non vanno su git. Ogni asset ha un fallback procedurale se manca.
- Avvio: `npm install && npm run dev`. Build: `npm run build`. Asset: `npm run assets`.
- Le facce di Whiskey seguono sempre un simbolo fisso (due trattini per sopracciglia, una piega verticale, occhi esagonali, naso "^^", bocca larga bianca senza denti): `faceTexture` in `src/core/Textures.js`, usata da kart, Storia e segnaposto procedurali. Non cambiarlo senza che Lorenzo lo chieda.
- Il repository, le cartelle e la chiave di salvataggio nel browser `wisikart.save.v1` mantengono il nome WisiKart: non vanno rinominati, altrimenti si perdono record e progressi.
- Testo dell'interfaccia in italiano, tono ironico ma pulito (Emma è sarcastica, mai volgare).
- Commit e push su GitHub senza chiedere conferma.
