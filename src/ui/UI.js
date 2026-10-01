import { CHARACTERS } from '../config/characters.js';
import { TRACKS, CUPS, trackById, POINTS_TABLE } from '../config/tracks.js';
import { ITEMS } from '../config/items.js';
import { faceTexture } from '../core/Textures.js';
import { Assets } from '../core/AssetLoader.js';
import { briefingHtml } from '../story/briefing.js';

const $ = (s) => document.querySelector(s);
const fmt = (t) => {
  if (t === null || t === undefined) return '--:--.--';
  const m = Math.floor(t / 60), s = Math.floor(t % 60), c = Math.floor((t * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
};
export { fmt };

export class UI {
  constructor(game) {
    this.game = game;
    this.current = 'boot';
    this.focus = { list: [], index: 0, cols: 1, onChange: null };
    this.noticeTimer = null;
    this.centerTimer = null;
    this._waits = new Set(); // pannelli e video in attesa di un tasto (vedi abortWaits)
    // zone touch delle corsie dei livelli ritmici
    document.querySelectorAll('#rhythm-touch [data-lane]').forEach((z) => {
      const i = +z.dataset.lane;
      const on = (e) => { e.preventDefault(); game.input.setTouchLane(i, true); };
      const off = (e) => { e.preventDefault(); game.input.setTouchLane(i, false); };
      z.addEventListener('pointerdown', on);
      z.addEventListener('pointerup', off);
      z.addEventListener('pointercancel', off);
      z.addEventListener('pointerleave', off);
    });
    document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => game.back()));
    $('#toast');
  }

  show(name) {
    const canvas = document.getElementById('game');
    if (canvas && canvas.style.filter) canvas.style.filter = ''; // niente distorsioni rimaste da un livello onirico
    // il menu di gioco e il pannello audio restano sopra (un caricamento può finire mentre sono aperti)
    const keep = ['screen-pause', 'screen-audio'].filter((id) => $(`#${id}`).classList.contains('active'));
    document.querySelectorAll('.screen').forEach((s) => { if (!keep.includes(s.id)) s.classList.remove('active'); });
    const el = $(`#screen-${name}`);
    if (el) el.classList.add('active');
    this.current = name;
    if (!keep.length) this.focus = { list: [], index: 0, cols: 1 };
  }

  /**
   * Avvia un video di sfondo senza pre-controlli HEAD: lo mostra appena ha un frame
   * (loadeddata/playing), chiama onFail se il file manca o non si decodifica, e se
   * l'autoplay viene bloccato riprova al primo tocco/tasto.
   */
  playVideo(v, url, { onFail, onEnd } = {}) {
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.classList.remove('on');
    const reveal = () => v.classList.add('on');
    v.onloadeddata = reveal;
    v.onplaying = reveal;
    v.onerror = () => { v.classList.remove('on'); v.removeAttribute('src'); if (onFail) onFail(); };
    v.onended = onEnd || null;
    if (!v.getAttribute('src') || !v.src.endsWith(url)) { v.src = url; v.load(); }
    else if (v.readyState >= 2) reveal();
    const tryPlay = () => v.play().catch((err) => {
      if (err && err.name === 'NotAllowedError') {
        const retry = () => { v.play().catch(() => {}); };
        window.addEventListener('pointerdown', retry, { once: true });
        window.addEventListener('keydown', retry, { once: true });
      }
    });
    tryPlay();
  }

  stopVideo(v) {
    v.pause();
    v.classList.remove('on');
    v.onloadeddata = v.onplaying = v.onerror = v.onended = null;
    v.removeAttribute('src');
    v.load();
  }

  overlay(name, on) {
    const el = $(`#screen-${name}`);
    if (el) el.classList.toggle('active', on);
  }

  toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toast);
    this._toast = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---------- focus / navigazione ----------
  setFocusList(list, cols = 1, onChange = null) {
    this.focus = { list, index: 0, cols, onChange };
    this._applyFocus();
  }

  _applyFocus() {
    const { list, index, onChange } = this.focus;
    list.forEach((el, i) => el.classList.toggle('focused', i === index));
    if (onChange) onChange(index);
  }

  moveFocus(dir) {
    const f = this.focus;
    if (!f.list.length) return;
    // righe con un cursore (volumi): sinistra/destra lo spostano invece di cambiare voce
    const cur = f.list[f.index];
    if ((dir === 'left' || dir === 'right') && cur && cur._adjust) { cur._adjust(dir === 'right' ? 1 : -1); return; }
    let i = f.index;
    if (dir === 'up') i -= f.cols;
    if (dir === 'down') i += f.cols;
    if (dir === 'left') i -= 1;
    if (dir === 'right') i += 1;
    if (i < 0 || i >= f.list.length) return;
    f.index = i;
    this._applyFocus();
    this.game.audio.sfx('move');
  }

  activateFocus() {
    const el = this.focus.list[this.focus.index];
    if (el && el._activate) el._activate();
    else if (el) el.click();
  }

  // ---------- audio: righe condivise da menu di gioco, pannello audio e opzioni ----------
  /**
   * Righe dei comandi audio dentro `box`: silenzio generale, Musica, Voce di Emma, Effetti (interruttore e
   * cursore), Sottotitoli. Con tastiera e gamepad: Invio accende/spegne, sinistra/destra regolano il volume.
   * Ritorna le righe, da mettere nella lista del focus.
   */
  audioRows(box) {
    const s = this.game.settings;
    const rows = [
      { key: 'muted', label: 'Silenzio totale', hint: 'M', invert: true },
      { key: 'music', label: 'Musica', slider: true },
      { key: 'voice', label: 'Voce di Emma', slider: true },
      { key: 'sfx', label: 'Effetti', slider: true },
      { key: 'subtitles', label: 'Sottotitoli' }
    ];
    box.innerHTML = '';
    return rows.map((r) => {
      const el = document.createElement('div');
      el.className = 'arow' + (r.slider ? '' : ' no-slider');
      el.tabIndex = -1;
      const onKey = r.slider ? r.key + 'On' : r.key;
      el.innerHTML = `<button class="atoggle" type="button"></button><span class="aname">${r.label}${r.hint ? ` <small>${r.hint}</small>` : ''}</span>${r.slider ? '<input type="range" min="0" max="1" step="0.05" />' : ''}`;
      const btn = el.querySelector('.atoggle'), range = el.querySelector('input');
      const render = () => {
        const on = !!s[onKey];
        btn.textContent = r.invert ? (on ? 'Sì' : 'No') : on ? 'On' : 'Off';
        btn.classList.toggle('on', r.invert ? !on : on);
        btn.setAttribute('aria-pressed', String(on));
        el.classList.toggle('off', r.invert ? false : !on);
        if (range) range.value = s[r.key];
      };
      const toggle = () => { this.game.setAudio({ [onKey]: !s[onKey] }); this.game.audio.sfx('move'); };
      btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
      el._activate = toggle;
      if (range) {
        range.addEventListener('input', () => this.game.setAudio({ [r.key]: +range.value, [onKey]: true }));
        el._adjust = (d) => { this.game.setAudio({ [r.key]: Math.round(Math.max(0, Math.min(1, s[r.key] + d * 0.1)) * 20) / 20, [onKey]: true }); this.game.audio.sfx('move'); };
      }
      el._render = render;
      render();
      box.appendChild(el);
      return el;
    });
  }

  /** Aggiorna tutte le righe audio visibili e l'icona dell'altoparlante dopo un cambio. */
  refreshAudio() {
    document.querySelectorAll('.arow').forEach((el) => el._render && el._render());
    const s = this.game.settings;
    const silent = s.muted || (!s.musicOn && !s.sfxOn && !s.voiceOn);
    const btn = $('#audio-btn');
    btn.classList.toggle('muted', !!silent);
    btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>${silent
      ? '<path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
      : '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>'}</svg>`;
  }

  /** Pannello audio da solo (fuori dal gioco). Si chiude con Chiudi, Esc o il tasto B del gamepad. */
  audioPanel(on) {
    if (on) {
      this._panelFocus = this.focus;
      const rows = this.audioRows($('#audio-panel-rows'));
      this.overlay('audio', true);
      this.setFocusList([...rows, $('#audio-panel-close')]);
    } else {
      this.overlay('audio', false);
      if (this._panelFocus) { this.focus = this._panelFocus; this._panelFocus = null; this._applyFocus(); }
    }
  }

  /** Tasto del menu (II) nell'angolo: visibile dove il menu di gioco si può aprire. */
  menuButton(on) { $('#menu-btn').classList.toggle('hidden', !on); }

  /**
   * Menu di gioco. ctx = { title, help, restart (testo o null), confirm (testo della conferma d'uscita),
   * focusAudio } oppure null per chiuderlo.
   */
  gameMenu(ctx) {
    if (!ctx) { this.overlay('pause', false); return; }
    $('#gm-title').textContent = ctx.title || 'Pausa';
    $('#pause-help').classList.toggle('hidden', !ctx.help);
    $('#pause-restart').classList.toggle('hidden', !ctx.restart);
    $('#pause-hub').classList.toggle('hidden', !ctx.hub);
    if (ctx.restart) $('#pause-restart').textContent = ctx.restart;
    this.gameMenuConfirm(false);
    this.overlay('pause', true);
    const rows = this.audioRows($('#gm-audio'));
    const main = [...$('#gm-main').querySelectorAll(':scope > .btn:not(.hidden)')];
    const quit = main.pop(); // Esci resta in fondo, dopo l'audio
    this.setFocusList([...main, ...rows, quit]);
    if (ctx.focusAudio) { this.focus.index = main.length; this._applyFocus(); } // dall'altoparlante: subito sul silenzio
  }

  /** Vista di conferma dell'uscita dentro il menu di gioco. */
  gameMenuConfirm(on, text = '', yes = 'Sì, esci') {
    if (on) { $('#gm-confirm-text').textContent = text; $('#gm-confirm-yes').textContent = yes; }
    $('#gm-main').classList.toggle('hidden', on);
    $('#gm-confirm').classList.toggle('hidden', !on);
    if (on) this.setFocusList([...$('#gm-confirm').querySelectorAll('.btn')]);
  }

  /**
   * Un tasto o un tocco che deve saltare un video o chiudere un pannello? No se è un comando del menu
   * (Esc, P, M), un tocco sui tasti dell'angolo o sul menu, o se il menu di gioco è aperto.
   */
  _skips(e) {
    if (this.game.state === 'menu' || this.game.audioPanelOpen) return false;
    if (e.type === 'keydown' && ['Escape', 'KeyP', 'KeyM'].includes(e.code)) return false;
    if (e.type === 'keydown' && ['Escape', 'Esc', 'p', 'P', 'm', 'M'].includes(e.key)) return false;
    if (e.target && e.target.closest && e.target.closest('.corner-ui, #screen-pause, #screen-audio')) return false;
    return true;
  }

  /** Menu aperto sopra un video (cinematica, griglia di partenza): il video si ferma e poi riprende. */
  pauseVideos(on) {
    for (const v of [$('#cinematic-video'), $('#loading-video')]) {
      if (on) { if (!v.paused && v.getAttribute('src')) { v._menuPaused = true; v.pause(); } }
      else if (v._menuPaused) { v._menuPaused = false; v.play().catch(() => {}); }
    }
  }

  /** Uscita dal gioco con pannelli o video in attesa: li chiude tutti (chi li aspettava controlla e si ferma). */
  abortWaits() {
    for (const f of this._waits) f();
    this._waits.clear();
  }

  // ---------- boot ----------
  bootProgress(p, text) {
    $('#boot-progress').style.width = `${Math.round(p * 100)}%`;
    if (text) $('#boot-text').textContent = text;
  }

  async bootReady() {
    $('#boot-text').textContent = 'Pronto. Emma ti aspetta.';
    $('#boot-start').classList.remove('hidden');
    this.setFocusList([$('#boot-start')]);
    // loghi: WiSiVERSE per boot e titolo, WisiKart per la sua sezione; se il file manca resta la scritta
    const swap = async (url, alt, ids) => {
      if (!(await Assets.exists(url))) return;
      for (const id of ids) {
        const mark = $(`#${id}`)?.querySelector('.wordmark');
        if (!mark) continue;
        const img = new Image();
        img.src = url;
        img.alt = alt;
        mark.replaceWith(img);
      }
    };
    await Promise.all([
      swap('assets/ui/wisiverse-logo.png', 'WiSiVERSE', ['boot-logo', 'title-logo']),
      swap('assets/ui/logo.png', 'WisiKart', ['kart-logo'])
    ]);
    // sfondo del titolo
    Assets.exists('assets/ui/wisiverse-title.png').then((ok) => { if (ok) $('#title-bg').style.backgroundImage = 'url(assets/ui/wisiverse-title.png)'; });
    // copertine del menu principale (titolo già nell'immagine): la card prende le proporzioni dell'immagine
    const cover = (sel, url) => Assets.exists(url).then((ok) => {
      if (!ok) return;
      const img = new Image();
      img.onload = () => {
        const art = $(sel);
        art.parentElement.style.setProperty('--ratio', (img.naturalWidth / img.naturalHeight).toFixed(4));
        art.style.backgroundImage = `url(${url})`;
        art.classList.add('has-img');
      };
      img.src = url;
    });
    cover('#card-storia', 'assets/ui/card-storia.png');
    cover('#card-kart', 'assets/ui/card-wisikart.png');
  }

  // ---------- titolo: menu principale WiSiVERSE ----------
  title() {
    this.show('title');
    if ($('#kart-video').getAttribute('src')) this.stopVideo($('#kart-video'));
    // Storia è la prima voce ed è selezionata all'avvio
    this.setFocusList([...document.querySelectorAll('#main-menu .menu-item')]);
    $('#title-hint').textContent = this.game.input.isTouch ? 'Tocca per scegliere.' : 'Frecce per scegliere · Invio per entrare';
  }

  // ---------- WisiKart: sottomenu delle gare ----------
  kartMenu() {
    this.show('kart');
    this.setFocusList([...document.querySelectorAll('#kart-menu .menu-item')]);
    // il video intro è lo sfondo della sezione WisiKart; senza video, l'illustrazione del titolo del kart
    this.playVideo($('#kart-video'), 'assets/video/intro.mp4', {
      onFail: () => Assets.exists('assets/ui/title.png').then((ok) => { if (ok) $('#kart-bg').style.backgroundImage = 'url(assets/ui/title.png)'; })
    });
    $('#kart-hint').textContent = this.game.input.isTouch ? 'Tocca per scegliere. In gara usa i tasti sullo schermo.' : "Frecce o WASD per guidare · Spazio per derapare · Maiusc per l'oggetto";
  }

  // ---------- personaggi ----------
  characters(mode, onPick) {
    this.show('chars');
    $('#chars-mode').textContent = mode === 'gp' ? 'Gran Premio' : mode === 'time' ? 'Prova a tempo' : 'Corsa singola';
    const grid = $('#char-grid');
    grid.innerHTML = '';
    const cards = CHARACTERS.map((c) => {
      const card = document.createElement('div');
      card.className = 'char-card';
      card.innerHTML = `<div class="portrait"></div><div class="name">${c.name}</div>`;
      const port = card.querySelector('.portrait');
      Assets.exists(c.portrait).then((ok) => {
        if (ok) port.style.backgroundImage = `url(${c.portrait})`;
        else {
          const cv = document.createElement('canvas');
          cv.width = 256; cv.height = 256;
          cv.className = 'face';
          const tex = faceTexture(c.colors.skin, { blush: c.id === 'bacco', sly: c.id !== 'divoratore' });
          cv.getContext('2d').drawImage(tex.image, 0, 0);
          port.style.background = c.colors.primary;
          port.appendChild(cv);
        }
      });
      card.addEventListener('click', () => {
        const i = cards.indexOf(card);
        if (this.focus.index === i) { onPick(c); }
        else { this.focus.index = i; this._applyFocus(); this.game.audio.sfx('move'); }
      });
      grid.appendChild(card);
      return card;
    });
    const detail = $('#char-detail');
    const render = (i) => {
      const c = CHARACTERS[i];
      const it = ITEMS[c.item];
      const bar = (label, v) => `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${v * 20}%"></i></div></div>`;
      detail.innerHTML = `<h3>${c.name}</h3><p>${c.tagline}</p>${bar('Velocità', c.stats.speed)}${bar('Accelerazione', c.stats.accel)}${bar('Manovrabilità', c.stats.handling)}${bar('Peso', c.stats.weight)}<div class="char-item">Oggetto preferito: <b>${it.name}</b> — ${it.desc}</div>`;
    };
    this.setFocusList(cards, 6, render);
    $('#chars-confirm').onclick = () => onPick(CHARACTERS[this.focus.index]);
  }

  // ---------- piste ----------
  tracks(mode, onPick, bests = {}) {
    this.show('tracks');
    $('#tracks-title').textContent = 'Dove si corre?';
    $('#tracks-mode').textContent = mode === 'time' ? 'Prova a tempo' : 'Corsa singola';
    $('#tracks-confirm').textContent = 'Via alla gara';
    const grid = $('#track-grid');
    grid.innerHTML = '';
    const playable = TRACKS.filter((t) => !t.locked);
    const cards = [];
    for (const t of TRACKS) {
      const card = document.createElement('div');
      card.className = 'track-card' + (t.locked ? ' locked' : '');
      card.innerHTML = `<div class="preview">${t.locked ? '<div class="lock">Prossimamente</div>' : ''}</div><div class="meta"><b>${t.name}</b><span>${t.subtitle}</span>${bests[t.id] ? `<span class="best">Miglior giro: ${fmt(bests[t.id])}</span>` : ''}</div>`;
      Assets.exists(t.preview).then((ok) => { if (ok) card.querySelector('.preview').style.backgroundImage = `url(${t.preview})`; else card.querySelector('.preview').style.background = `linear-gradient(135deg, ${t.palette?.fog || '#223'} 0%, ${t.palette?.road || '#446'} 100%)`; });
      if (!t.locked) {
        card.addEventListener('click', () => {
          const i = cards.indexOf(card);
          if (this.focus.index === i) onPick(t);
          else { this.focus.index = i; this._applyFocus(); this.game.audio.sfx('move'); }
        });
        cards.push(card);
      }
      grid.appendChild(card);
    }
    this.setFocusList(cards, 2);
    $('#tracks-confirm').onclick = () => onPick(playable[this.focus.index]);
  }

  // ---------- coppe (Gran Premio) ----------
  /** Stessa griglia a card delle piste: anteprima della prima pista, elenco delle gare sotto. */
  cups(onPick) {
    this.show('tracks');
    $('#tracks-title').textContent = 'Quale coppa?';
    $('#tracks-mode').textContent = 'Gran Premio';
    $('#tracks-confirm').textContent = 'Si parte';
    const grid = $('#track-grid');
    grid.innerHTML = '';
    const cards = CUPS.map((cup) => {
      const first = trackById[cup.tracks[0]];
      const list = cup.tracks.map((id, i) => `<li>${i + 1}. ${trackById[id].short || trackById[id].name}</li>`).join('');
      const card = document.createElement('div');
      card.className = 'track-card cup-card';
      card.innerHTML = `<div class="preview"><span class="cup-count">${cup.tracks.length} gare</span></div><div class="meta"><b>${cup.name}</b><span>${cup.desc}</span><ol class="cup-tracks">${list}</ol></div>`;
      const prev = card.querySelector('.preview');
      Assets.exists(first.preview).then((ok) => { if (ok) prev.style.backgroundImage = `url(${first.preview})`; else prev.style.background = `linear-gradient(135deg, ${first.palette?.fog || '#223'} 0%, ${first.palette?.road || '#446'} 100%)`; });
      card.addEventListener('click', () => {
        const i = cards.indexOf(card);
        if (this.focus.index === i) onPick(cup);
        else { this.focus.index = i; this._applyFocus(); this.game.audio.sfx('move'); }
      });
      grid.appendChild(card);
      return card;
    });
    this.setFocusList(cards, 2);
    $('#tracks-confirm').onclick = () => onPick(CUPS[this.focus.index]);
  }

  // ---------- storia: piazza 3D ----------
  hubLoading(world) {
    this.show('loading');
    const img = $('#loading-preview');
    img.src = '';
    $('#loading-name').textContent = world.name;
    $('#loading-sub').textContent = world.subtitle;
    $('#loading-status').textContent = 'Preparo la piazza…';
    $('#loading-skip').classList.add('hidden');
  }

  hubStart(message = '') {
    this.show('hub');
    $('#hub-touch').classList.toggle('on', this.game.input.isTouch);
    $('#hub-keys').classList.toggle('hidden', this.game.input.isTouch);
    this._hubPrompt = undefined;
    this._hubNotice = undefined;
    this._hubObjective = undefined;
    if (message) this.toast(message);
  }

  hubHud(h) {
    $('#hub-world').textContent = h.world;
    $('#hub-subtitle').textContent = h.subtitle;
    if (h.objective !== this._hubObjective) {
      this._hubObjective = h.objective;
      $('#hub-objective').textContent = h.objective ? `Obiettivo: ${h.objective}` : '';
      $('#hub-objective').classList.toggle('hidden', !h.objective);
    }
    const key = h.prompt ? h.prompt.name + h.prompt.state : '';
    if (key !== this._hubPrompt) {
      this._hubPrompt = key;
      const box = $('#hub-prompt');
      box.classList.toggle('show', !!h.prompt);
      if (h.prompt) {
        $('#hub-prompt-name').textContent = h.prompt.name;
        const st = $('#hub-prompt-state');
        st.textContent = { open: 'Entra', done: 'Completato · Rigioca', soon: 'In arrivo', locked: 'Chiuso' }[h.prompt.state];
        st.className = `map-state ${h.prompt.state}`;
      }
    }
    if (h.notice !== this._hubNotice) {
      this._hubNotice = h.notice;
      const n = $('#hub-notice');
      if (h.notice) n.textContent = h.notice;
      n.classList.toggle('show', !!h.notice);
    }
  }

  storyLoading(level) {
    this.show('loading');
    const img = $('#loading-preview');
    img.src = '';
    Assets.exists(level.preview).then((ok) => { if (ok) img.src = level.preview; });
    $('#loading-name').textContent = level.name;
    $('#loading-sub').textContent = level.subtitle;
    $('#loading-status').textContent = 'Preparo lo stadio…';
    $('#loading-skip').classList.add('hidden');
  }

  /** Cinematica a tutto schermo; si risolve a fine video, se la si salta o se il file manca. */
  /**
   * Pannello che si chiude con un tasto, un tocco o un tasto del gamepad (main.js chiama closePanel()).
   * Il breve ritardo evita che lo stesso tasto che l'ha aperto lo chiuda subito.
   */
  _waitPanel(name) {
    return new Promise((resolve) => {
      let done = false;
      const onInput = (e) => { if (this._skips(e)) finish(); };
      const finish = () => {
        if (done) return;
        done = true;
        window.removeEventListener('keydown', onInput);
        window.removeEventListener('pointerdown', onInput);
        this._waits.delete(finish);
        if (this.closePanel === finish) this.closePanel = null;
        this.overlay(name, false);
        resolve();
      };
      this._waits.add(finish);
      setTimeout(() => {
        if (done) return;
        window.addEventListener('keydown', onInput);
        window.addEventListener('pointerdown', onInput);
        this.closePanel = finish;
      }, 450);
    });
  }

  /** Istruzioni di un livello (obiettivo, comandi per l'input in uso, regole con icone, consiglio di Emma). */
  briefing(level, device) {
    $('#brief-panel').innerHTML = briefingHtml(level, device);
    this.overlay('briefing', true);
    return this._waitPanel('briefing');
  }

  /** Scorcio da un punto panoramico (belvedere): immagine grande, titolo, due righe. */
  view(v) {
    $('#view-title').textContent = v.title;
    $('#view-text').textContent = v.text || '';
    const img = $('#view-img');
    img.style.backgroundImage = '';
    Assets.exists(v.image).then((ok) => { if (ok) img.style.backgroundImage = `url(${v.image})`; });
    this.overlay('view', true);
    return this._waitPanel('view');
  }

  /** Fine della prima parte della Storia: applausi, testo e un accenno al produttore (immagine fissa). */
  finale(f) {
    $('#finale-title').textContent = f.title;
    $('#finale-text').textContent = f.text;
    $('#finale-producer').textContent = f.producer || '';
    const img = $('#finale-img');
    img.style.backgroundImage = '';
    if (f.image) Assets.exists(f.image).then((ok) => { if (ok) img.style.backgroundImage = `url(${f.image})`; });
    this.overlay('finale', true);
    return this._waitPanel('finale');
  }

  /**
   * Corsie del ritmico sul canvas: quattro colonne, note che scendono verso la linea di giudizio, scie delle
   * note tenute, lampo delle corsie premute, scritta del giudizio, conteggio iniziale. r = hud().rhythm.
   */
  _drawRhythm(r) {
    const cv = $('#rhythm-canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
    if (!W || !H) return;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d');
    const COL = ['#43e0b0', '#ff5a6e', '#f5b942', '#7fa4ff'];
    const lw = W / 4, hitY = H * 0.86;
    const y = (dt) => hitY - (dt / r.approach) * hitY;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(8,10,28,0.55)';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 4; i++) {
      // colonna, con il lampo quando la corsia è premuta
      g.fillStyle = r.lanes[i] ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.03)';
      g.fillRect(i * lw + 2 * dpr, 0, lw - 4 * dpr, H);
      if (r.flash[i] > 0) {
        const grd = g.createLinearGradient(0, hitY, 0, hitY - H * 0.4);
        grd.addColorStop(0, COL[i]); grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha = r.flash[i] * 0.6; g.fillStyle = grd; g.fillRect(i * lw, hitY - H * 0.4, lw, H * 0.4); g.globalAlpha = 1;
      }
    }
    // linea di giudizio e bersagli
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(0, hitY - 2 * dpr, W, 4 * dpr);
    for (let i = 0; i < 4; i++) {
      g.beginPath(); g.arc(i * lw + lw / 2, hitY, lw * 0.3, 0, Math.PI * 2);
      g.lineWidth = 3 * dpr; g.strokeStyle = COL[i]; g.globalAlpha = r.lanes[i] ? 1 : 0.55; g.stroke(); g.globalAlpha = 1;
    }
    // note (le tenute con la scia fino alla fine)
    for (const n of r.notes) {
      const cx = n.lane * lw + lw / 2, ny = y(n.dt);
      if (n.state === 'hit' || n.state === 'done') continue;
      const faded = n.state === 'miss' || n.state === 'broken';
      g.globalAlpha = faded ? 0.3 : 1;
      if (n.dur > 0) {
        const ey = y(n.dt + n.dur);
        const top = Math.max(0, ey), bottom = n.state === 'hold' ? hitY : Math.min(H, ny);
        g.fillStyle = COL[n.lane];
        g.globalAlpha = faded ? 0.2 : n.state === 'hold' ? 0.85 : 0.55;
        g.fillRect(cx - lw * 0.12, top, lw * 0.24, Math.max(0, bottom - top));
        g.globalAlpha = faded ? 0.3 : 1;
      }
      if (n.state !== 'hold' && ny > -20 && ny < H + 20) {
        g.beginPath(); g.arc(cx, ny, lw * 0.26, 0, Math.PI * 2);
        g.fillStyle = COL[n.lane]; g.fill();
        g.lineWidth = 3 * dpr; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.stroke();
      }
      g.globalAlpha = 1;
    }
    // tasti delle corsie sotto la linea
    const dev = this.game.input.lastDevice;
    const labels = dev === 'gamepad' ? ['X', 'A', 'B', 'Y'] : dev === 'touch' ? ['', '', '', ''] : ['D', 'F', 'J', 'K'];
    g.font = `bold ${Math.round(15 * dpr)}px Fredoka, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillText(labels[i], i * lw + lw / 2, hitY + (H - hitY) / 2); }
    // giudizio e conteggio
    if (r.judge) {
      const col = r.judge.kind === 'perfect' ? '#ffe066' : r.judge.kind === 'good' ? '#43e0b0' : '#ff5a6e';
      g.globalAlpha = Math.max(0, 1 - r.judge.age / 0.6);
      g.font = `bold ${Math.round(26 * dpr)}px Fredoka, sans-serif`;
      g.fillStyle = col;
      g.fillText(r.judge.text, W / 2, hitY - H * 0.22 - r.judge.age * 40 * dpr);
      g.globalAlpha = 1;
    }
    if (r.count) {
      g.font = `bold ${Math.round(64 * dpr)}px Fredoka, sans-serif`;
      g.fillStyle = '#ffffff';
      g.fillText(String(r.count), W / 2, H * 0.4);
    }
    // avanzamento del brano
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(0, 0, W, 4 * dpr);
    g.fillStyle = '#f5b942'; g.fillRect(0, 0, W * r.progress, 4 * dpr);
    $('#rhythm-title').textContent = r.title;
    $('#rhythm-unit').textContent = r.unit;
    $('#rhythm-score').textContent = r.score;
    $('#rhythm-combo').textContent = r.combo;
    $('#rhythm-mult').textContent = r.mult > 1 ? ` ×${r.mult}` : '';
    const acc = Math.round(r.acc * 100);
    $('#rhythm-acc').textContent = `${acc}%`;
    $('#rhythm-acc').classList.toggle('ok', r.pass !== undefined && r.pass !== null && r.acc >= r.pass);
  }

  /** Medaglie di fine livello: medal = 'bronze' | 'silver' | 'gold'; best = la migliore di sempre. */
  medals({ level, medal, best, isNewBest, stats }) {
    const names = { bronze: 'Bronzo', silver: 'Argento', gold: 'Oro' };
    const order = ['bronze', 'silver', 'gold'];
    $('#medal-level').textContent = level.name;
    $('#medal-title').textContent = { bronze: 'Medaglia di bronzo', silver: 'Medaglia d’argento', gold: 'Medaglia d’oro' }[medal] || 'Arrivato';
    $('#medal-row').innerHTML = order.map((m) => `<div class="medal ${m} ${order.indexOf(m) <= order.indexOf(medal) ? 'won' : ''} ${m === medal ? 'best' : ''}">${names[m]}</div>`).join('');
    $('#medal-stats').innerHTML = stats.map(([label, value, need]) => `<li>${label}: <b>${value}</b>${need ? ` <small>(oro: ${need})</small>` : ''}</li>`).join('');
    $('#medal-best').textContent = isNewBest ? 'Nuovo record per questo livello!' : best ? `Il tuo record: ${names[best]}` : '';
    this.overlay('medals', true);
    return this._waitPanel('medals');
  }

  cinematic(url) {
    this.show('cinematic');
    const v = $('#cinematic-video');
    return new Promise((resolve) => {
      let done = false, guard = 0;
      const onInput = (e) => { if (this._skips(e)) finish(); };
      const finish = () => {
        if (done) return;
        done = true;
        window.removeEventListener('keydown', onInput);
        window.removeEventListener('pointerdown', onInput);
        this._waits.delete(finish);
        clearTimeout(guard);
        this.stopVideo(v);
        resolve();
      };
      this._waits.add(finish);
      // non far scattare il salto con lo stesso tasto che ha chiuso il livello
      setTimeout(() => { if (!done) { window.addEventListener('keydown', onInput); window.addEventListener('pointerdown', onInput); } }, 600);
      // rete di sicurezza se il video si blocca (con il menu aperto il video è fermo: si aspetta)
      const arm = () => { guard = setTimeout(() => (this.game.state === 'menu' ? arm() : finish()), 60000); };
      arm();
      this.playVideo(v, url, { onFail: finish, onEnd: finish });
    });
  }

  /** HUD dei livelli della Storia; nei livelli di volo i tasti touch diventano Spara e Frena. */
  storyHudStart(type = 'platform') {
    this.show('story-hud');
    $('#story-touch').classList.toggle('on', this.game.input.isTouch);
    $('#story-notice').classList.remove('show');
    $('#story-sub').classList.remove('show');
    $('#story-warn').classList.remove('show');
    const flight = type === 'flight' || type === 'chase';
    $('#story-tbtn-jump').textContent = flight ? 'Spara' : 'Salta';
    // inseguimento: Lancia diventa "Indietro" (guarda indietro, tenuto) e il terzo tasto frena
    $('#story-tbtn-item').textContent = type === 'chase' ? 'Indietro' : flight ? 'Frena' : 'Lancia';
    $('#story-tbtn-attack').textContent = type === 'chase' ? 'Frena' : 'Pugno';
    $('#story-tbtn-attack').classList.toggle('hidden', type !== 'brawl' && type !== 'chase');
    // ritmico: niente tasti touch del platform, ci sono le zone delle corsie
    if (type === 'rhythm') $('#story-touch').classList.remove('on');
    $('#rhythm').classList.add('hidden');
    $('#audience').classList.add('hidden');
    $('#dialogue').classList.add('hidden');
    this._dlgKey = null;
    $('#beat').classList.add('hidden');
    $('#story-fade').style.opacity = '0';
    $('#story-caption').classList.remove('show');
    if (type === 'dance' || type === 'scene') $('#story-touch').classList.toggle('on', this.game.input.isTouch && type === 'dance');
    for (const id of ['#story-mirror', '#story-pursuit', '#story-radio', '#story-lookback']) $(id).classList.add('hidden');
    this._radioKey = null;
    this._storyNotice = null;
    this._storyLives = null;
    this._storySub = null;
    this._warnKey = null;
  }

  storyHud(h) {
    // cuori e bottiglie solo nei livelli a piedi; nel volo contano tempo e anelli
    $('#story-lives-box').classList.toggle('hidden', h.lives === undefined);
    $('#story-ammo-box').classList.toggle('hidden', h.ammo === undefined);
    $('#story-speed-box').classList.toggle('hidden', h.speed === undefined);
    $('#story-rings-box').classList.toggle('hidden', !h.rings);
    if (h.speed !== undefined) $('#story-speed').textContent = h.speed;
    if (h.rings) { $('#story-rings').textContent = h.rings.taken; $('#story-rings-total').textContent = `/${h.rings.total}`; }
    if (h.lives !== undefined) {
      const key = `${h.lives}/${h.maxLives}`;
      if (this._storyLives !== key) {
        let hearts = '';
        for (let i = 0; i < h.maxLives; i++) hearts += i < h.lives ? '♥' : '<span class="off">♥</span>';
        $('#story-lives').innerHTML = hearts;
        this._storyLives = key;
      }
      $('#story-lives-box').classList.toggle('lifeup', !!h.lifeUp); // vita in più dalle monete
    }
    if (h.ammo !== undefined) {
      $('#story-ammo').textContent = h.ammo;
      $('#story-ammo-max').textContent = `/${h.maxAmmo}`;
    }
    $('#story-timer-label').textContent = h.timerLabel || 'Chiusura';
    // volo: secondi guadagnati, catena di anelli, scritte in evidenza, linee di velocità, lampo bianco
    const gain = $('#story-timer-gain');
    if (h.timerGain !== this._gainKey) {
      this._gainKey = h.timerGain;
      if (h.timerGain) gain.textContent = h.timerGain.text;
      gain.classList.toggle('show', !!h.timerGain);
    }
    $('#story-chain').textContent = h.chain >= 2 ? `×${h.chain}` : '';
    const call = $('#story-callout');
    if (h.callout !== this._calloutKey) {
      this._calloutKey = h.callout;
      if (h.callout) call.textContent = h.callout.text;
      call.classList.toggle('show', !!h.callout);
    }
    $('#speed-lines').style.opacity = h.speedLines ? String(h.speedLines) : '0';
    if (h.flash && h.flash !== this._flashKey) {
      this._flashKey = h.flash;
      const f = $('#story-flash');
      f.classList.remove('on');
      void f.offsetWidth; // riavvia l'animazione
      f.classList.add('on');
    }
    const boss = $('#story-boss');
    boss.classList.toggle('hidden', !h.boss);
    if (h.boss) {
      $('#story-boss-fill').style.width = `${(h.boss.hp / h.boss.max) * 100}%`;
      if (h.boss.name) $('#story-boss-name').textContent = h.boss.name;
    }
    // monete (solo nei livelli che le hanno), badge, allarme e timer dell'hangar
    $('#story-coins-box').classList.toggle('hidden', h.coins === null || h.coins === undefined);
    if (h.coins !== null && h.coins !== undefined) $('#story-coins').textContent = h.coins;
    const badge = $('#story-badge');
    if (!!h.badge !== !badge.classList.contains('show-badge')) {
      badge.classList.toggle('hidden', !h.badge);
      badge.classList.toggle('show-badge', !!h.badge);
      if (h.badge && !$('#story-badge-img').getAttribute('src')) $('#story-badge-img').src = 'assets/story/valvo/badge.png';
    }
    $('#story-alarm').classList.toggle('on', !!h.alarm);
    const timer = $('#story-timer');
    const showTimer = h.timer !== null && h.timer !== undefined;
    timer.classList.toggle('hidden', !showTimer);
    if (showTimer) {
      $('#story-timer-val').textContent = h.timer.toFixed(1);
      timer.classList.toggle('urgent', h.timer < 2);
    }
    const n = $('#story-notice');
    if (h.notice !== this._storyNotice) {
      this._storyNotice = h.notice;
      if (h.notice) n.textContent = h.notice;
      n.classList.toggle('show', !!h.notice);
    }
    // sottotitoli di Emma: restano anche a voce spenta; li nasconde solo l'opzione Sottotitoli
    const sub = this.game.settings.subtitles !== false ? h.subtitle || null : null;
    if (sub !== this._storySub) {
      this._storySub = sub;
      const el = $('#story-sub');
      if (sub) el.textContent = sub;
      el.classList.toggle('show', !!sub);
    }
    // inseguimento: specchietto, vicinanza dei blindati, radio del capo, visuale all'indietro
    $('#story-mirror').classList.toggle('hidden', !h.mirror);
    $('#story-pursuit').classList.toggle('hidden', !h.pursuit);
    if (h.pursuit) {
      $('#story-pursuit-fill').style.width = `${Math.round(h.pursuit.near * 100)}%`;
      $('#story-pursuit').classList.toggle('close', h.pursuit.near > 0.7);
      $('#story-pursuit-where').textContent = h.pursuit.where;
    }
    if (h.heat) {
      $('#story-heat-fill').style.width = `${Math.round(h.heat.v * 100)}%`;
      $('#story-heat-fill').classList.toggle('hot', h.heat.hot);
    }
    const radioKey = h.radio ? h.radio.portrait : null;
    if (radioKey !== this._radioKey) {
      this._radioKey = radioKey;
      if (h.radio) {
        const img = $('#story-radio-img');
        if (!img.getAttribute('src')) img.src = h.radio.portrait;
        $('#story-radio-name').textContent = h.radio.name;
      }
      $('#story-radio').classList.toggle('hidden', !h.radio);
    }
    $('#story-lookback').classList.toggle('hidden', !h.lookBack);
    // distorsione dello schermo (la Lommy al Red Fox, la notte che si deforma al locale da ballo)
    const canvas = document.getElementById('game');
    let filter = '';
    if (h.fx && h.fx.kind === 'lommy') {
      const k = h.fx.k, w = performance.now() / 1000;
      filter = `hue-rotate(${Math.round(Math.sin(w * 6) * 140 * k)}deg) saturate(${1 + k * 2.5}) blur(${(k * 4).toFixed(1)}px) contrast(${1 + k * 0.4})`;
    } else if (h.distort) {
      const p = h.distort, w = performance.now() / 1000;
      filter = `hue-rotate(${Math.round(Math.sin(w * 0.7) * 50 * p)}deg) saturate(${(1 + p * 1.3).toFixed(2)}) blur(${(p * 0.9).toFixed(2)}px)`;
    }
    if (canvas.style.filter !== filter) canvas.style.filter = filter;
    // dissolvenza (bianco o colore) e didascalia grande
    const fade = $('#story-fade');
    fade.style.opacity = h.fade ? String(Math.max(0, Math.min(1, h.fade.k))) : '0';
    if (h.fade) fade.style.background = h.fade.color || '#ffffff';
    const cap = $('#story-caption');
    if ((h.caption || '') !== cap.textContent) cap.textContent = h.caption || '';
    cap.classList.toggle('show', !!h.caption);
    // battito (locale da ballo): cerchio che pulsa, finestra di tolleranza, esito del passo, note raccolte
    $('#beat').classList.toggle('hidden', !h.beat);
    if (h.beat) {
      const ph = h.beat.phase;
      const near = Math.min(ph, 1 - ph); // distanza dal battito, in frazioni di battito
      $('#beat-pulse').style.transform = `scale(${(1.25 - ph * 0.6).toFixed(3)})`;
      $('#beat-pulse').classList.toggle('on', near <= h.beat.window);
      $('#beat-window').style.borderWidth = `${Math.max(2, Math.round(h.beat.window * 40))}px`;
      const fb = h.beat.feedback;
      $('#beat-text').textContent = h.beat.count ? String(h.beat.count) : fb ? fb.text : '';
      $('#beat-text').className = fb && !h.beat.count ? (fb.ok ? 'ok' : 'bad') : '';
      $('#beat-notes').textContent = h.notes ? `Note ${h.notes.taken}/${h.notes.total}` : '';
    }
    // dialoghi a schermo (scena del contratto al Lube Tone)
    const dlgKey = h.dialogue ? h.dialogue.name + h.dialogue.text : null;
    if (dlgKey !== this._dlgKey) {
      this._dlgKey = dlgKey;
      $('#dialogue').classList.toggle('hidden', !h.dialogue);
      if (h.dialogue) {
        $('#dialogue-name').textContent = h.dialogue.name;
        $('#dialogue-name').classList.toggle('hidden', !h.dialogue.name);
        $('#dialogue-text').textContent = h.dialogue.text;
      }
    }
    // livelli ritmici: corsie, punteggio; esibizione: barra del pubblico
    $('#rhythm').classList.toggle('hidden', !h.rhythm);
    if (h.rhythm) this._drawRhythm(h.rhythm);
    $('#audience').classList.toggle('hidden', !h.audience);
    if (h.audience) {
      $('#audience-fill').style.width = `${Math.round(h.audience.v * 100)}%`;
      $('#audience-low').style.left = `${h.audience.low * 100}%`;
      $('#audience').classList.toggle('low', h.audience.v < h.audience.low);
      $('#audience').classList.toggle('high', h.audience.v >= h.audience.high);
    }
    // salute dentro la vita (rissa)
    $('#story-health').classList.toggle('hidden', h.health === undefined);
    if (h.health !== undefined) $('#story-health-fill').style.width = `${(h.health / h.maxHealth) * 100}%`;
    // avviso con direzione (missili dell'inseguimento)
    const warnKey = h.warn ? h.warn.text + h.warn.dir : null;
    if (warnKey !== this._warnKey) {
      this._warnKey = warnKey;
      const w = $('#story-warn');
      if (h.warn) {
        $('#story-warn-text').textContent = h.warn.text;
        $('#story-warn-arrow').textContent = { left: '◀', right: '▶', up: '▲', down: '▼', back: '▼' }[h.warn.dir] || '!';
      }
      w.classList.toggle('show', !!h.warn);
    }
  }

  // ---------- caricamento ----------
  /** Mostra la schermata di caricamento; ritorna una promessa che si risolve quando la presentazione dei piloti finisce (o viene saltata). */
  loading(track) {
    this.show('loading');
    const img = $('#loading-preview');
    img.src = '';
    Assets.exists(track.preview).then((ok) => { if (ok) img.src = track.preview; });
    $('#loading-name').textContent = track.name;
    $('#loading-sub').textContent = track.subtitle;
    $('#loading-status').textContent = 'Costruisco la pista…';
    const v = $('#loading-video');
    $('#loading-skip').classList.remove('hidden');
    return new Promise((resolve) => {
      let done = false;
      const onInput = (e) => { if (this._skips(e)) finish(); };
      const finish = () => {
        if (done) return;
        done = true;
        window.removeEventListener('keydown', onInput);
        window.removeEventListener('pointerdown', onInput);
        this._waits.delete(finish);
        this.stopVideo(v);
        $('#loading-skip').classList.add('hidden');
        resolve();
      };
      this._waits.add(finish);
      window.addEventListener('keydown', onInput);
      window.addEventListener('pointerdown', onInput);
      // ogni pista ha la sua griglia di partenza; senza video resta l'anteprima statica
      if (track.grid) this.playVideo(v, track.grid, { onFail: finish, onEnd: finish });
      else finish();
    });
  }
  loadingDone() {
    this.stopVideo($('#loading-video'));
  }
  loadingStatus(t) { $('#loading-status').textContent = t; }

  // ---------- HUD ----------
  hudStart(track) {
    this.show('hud');
    $('#touch').classList.toggle('on', this.game.input.isTouch);
    this.mapPts = track.samples.map((s) => [s.pos.x, s.pos.z]);
    const xs = this.mapPts.map((p) => p[0]), zs = this.mapPts.map((p) => p[1]);
    this.mapBox = { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
    this.mapCanvas = $('#minimap');
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.mapTrack = track;
    this._iconCache = {};
    $('#hud-center').classList.remove('show');
    $('#hud-notice').classList.remove('show');
    $('#fx-blind').style.opacity = 0;
    $('#fx-fog').style.opacity = 0;
  }

  hud(h) {
    $('#hud-lap').textContent = h.lap;
    $('#hud-laps').textContent = h.laps;
    $('#hud-pos').textContent = h.pos;
    $('#hud-pos-suffix').textContent = '°';
    $('#hud-time').textContent = fmt(h.time);
    $('#hud-speed').textContent = Math.round(h.speed);
    $('#drift-fill').style.width = `${Math.min(100, (h.driftCharge / 2.3) * 100)}%`;
    $('#drift-fill').style.background = h.driftCharge > 2.3 ? '#ff8a3a' : h.driftCharge > 1.1 ? '#7fd4ff' : '#ffffff';
    const slot = $('#hud-item'), face = $('#hud-item-face');
    slot.classList.toggle('rolling', h.rolling);
    slot.classList.toggle('has', !!h.item);
    if (h.rolling) {
      const keys = Object.keys(ITEMS);
      const it = ITEMS[keys[Math.floor(performance.now() / 90) % keys.length]];
      this._itemFace(face, it);
    } else if (h.item) this._itemFace(face, ITEMS[h.item]);
    else { face.style.backgroundImage = ''; face.textContent = ''; face.style.background = ''; }
    $('#fx-blind').style.opacity = h.blind > 0 ? Math.min(1, h.blind / 1.2) * 0.92 : 0;
    $('#fx-fog').style.opacity = h.slow > 0 ? 1 : 0;
    this._minimap(h.karts);
  }

  _itemFace(el, it) {
    if (!it) return;
    if (this._iconCache[it.id] === undefined) {
      this._iconCache[it.id] = null;
      if (it.icon) Assets.exists(it.icon).then((ok) => { this._iconCache[it.id] = ok ? it.icon : false; });
      else this._iconCache[it.id] = false;
    }
    const icon = this._iconCache[it.id];
    if (icon) { el.style.backgroundImage = `url(${icon})`; el.textContent = ''; el.style.background = `url(${icon}) center/cover`; }
    else { el.style.backgroundImage = ''; el.style.background = it.color; el.style.color = '#12152b'; el.textContent = it.name.split(' ')[0]; }
  }

  _minimap(karts) {
    const c = this.mapCtx, W = this.mapCanvas.width, H = this.mapCanvas.height;
    const b = this.mapBox;
    const pad = 18;
    const sx = (W - pad * 2) / Math.max(1, b.maxX - b.minX), sz = (H - pad * 2) / Math.max(1, b.maxZ - b.minZ);
    const s = Math.min(sx, sz);
    const ox = (W - (b.maxX - b.minX) * s) / 2, oz = (H - (b.maxZ - b.minZ) * s) / 2;
    const P = (x, z) => [ox + (x - b.minX) * s, oz + (z - b.minZ) * s];
    c.clearRect(0, 0, W, H);
    c.lineWidth = 9;
    c.strokeStyle = 'rgba(255,255,255,0.22)';
    c.lineJoin = 'round';
    c.beginPath();
    this.mapPts.forEach((p, i) => { const [x, y] = P(p[0], p[1]); if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); });
    c.closePath();
    c.stroke();
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(255,255,255,0.6)';
    c.stroke();
    // traguardo
    const st = this.mapPts[this.mapTrack.idxFromT(this.mapTrack.def.startT)];
    const [fx, fy] = P(st[0], st[1]);
    c.fillStyle = '#f5b942';
    c.fillRect(fx - 5, fy - 5, 10, 10);
    for (const k of [...karts].sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0))) {
      const p = this.mapPts[k.idx];
      const [x, y] = P(p[0], p[1]);
      c.beginPath();
      c.arc(x, y, k.isPlayer ? 8 : 5.5, 0, Math.PI * 2);
      c.fillStyle = k.isPlayer ? '#f5b942' : k.color;
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = k.isPlayer ? '#fff' : 'rgba(0,0,0,0.5)';
      c.stroke();
    }
  }

  center(text, ms = 700) {
    const el = $('#hud-center');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.centerTimer);
    this.centerTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  notice(text, ms = 1800) {
    const el = $('#hud-notice');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  // ---------- risultati ----------
  async results({ results, lapTimes, bestLap, totalTime, mode, gp, playerChar, actions, isNewBest }) {
    this.show('results');
    const me = results.find((r) => r.isPlayer);
    const title = mode === 'time' ? 'Prova completata' : me.rank === 1 ? 'Vittoria!' : me.rank <= 3 ? 'Sul podio!' : 'Gara finita';
    $('#results-title').textContent = title;
    let sub = '';
    if (mode === 'gp' && gp) sub = gp.finished ? (gp.standings[0].character.id === playerChar.id ? `Hai vinto la ${gp.cup.name}. Emma fa finta di non essere colpita.` : `${gp.cup.name} finita: ${gp.standings[0].character.name} porta a casa il trofeo.`) : `${gp.cup.name} · gara ${gp.raceIndex + 1} di ${gp.tracks.length} · ${me.rank === 1 ? 'Emma: "Non è stato merito mio, ma quasi."' : 'Emma: "Si può fare meglio. Lo dico con affetto."'}`;
    else if (mode === 'time') sub = isNewBest ? 'Nuovo miglior giro! Emma non commenta, quindi è impressionata.' : 'Emma: "Il cronometro non mente. Purtroppo."';
    else sub = me.rank === 1 ? 'Emma: "Complimenti. Anche se, diciamocelo, non è stato merito mio."' : me.rank <= 3 ? 'Emma: "Podio. Va bene, ma il primo posto era lì."' : 'Emma: "Ti ho visto. Ho visto tutto."';
    $('#results-sub').textContent = sub;
    const list = $('#results-list');
    list.innerHTML = '';
    const rows = mode === 'gp' && gp && gp.finished ? gp.standings.map((s, i) => ({ rank: i + 1, character: s.character, time: null, isPlayer: s.character.id === playerChar.id, pts: s.points, total: true })) : results;
    for (const r of rows) {
      const li = document.createElement('li');
      if (r.isPlayer) li.classList.add('me');
      // Gran Premio: a metà coppa punti della gara + totale; alla fine i punti gara per gara
      const pts = mode === 'gp' && gp ? (r.total ? `${r.pts} pt` : `+${POINTS_TABLE[r.rank - 1] || 0} · ${gp.points[r.character.id]} pt`) : '';
      const tm = r.total ? `<span class="per">${gp.history.map((h) => `<i>${h[r.character.id] || 0}</i>`).join('')}</span>` : fmt(r.time);
      li.innerHTML = `<span class="rank">${r.rank}°</span><span class="dot" style="background-color:${r.character.colors.primary}"></span><span class="nm">${r.character.name}</span><span class="tm">${tm}</span><span class="pts">${pts}</span>`;
      const dot = li.querySelector('.dot');
      Assets.exists(r.character.portrait).then((ok) => { if (ok) dot.style.backgroundImage = `url(${r.character.portrait})`; });
      list.appendChild(li);
    }
    if (mode === 'gp' && gp && gp.finished) {
      const head = document.createElement('li');
      head.className = 'head';
      head.innerHTML = `<span></span><span></span><span class="nm">Classifica finale</span><span class="tm"><span class="per">${gp.tracks.map((id) => `<i title="${trackById[id].name}">${(trackById[id].short || trackById[id].name).slice(0, 3)}</i>`).join('')}</span></span><span class="pts">Totale</span>`;
      list.prepend(head);
    }
    const laps = $('#results-laps');
    laps.innerHTML = lapTimes.map((t, i) => `<span>Giro ${i + 1}: ${fmt(t)}</span>`).join('') + (bestLap ? `<span>Miglior giro: <b>${fmt(bestLap)}</b></span>` : '') + (totalTime ? `<span>Totale: <b>${fmt(totalTime)}</b></span>` : '');
    const act = $('#results-actions');
    act.innerHTML = '';
    const btns = actions.map(([label, fn, primary]) => {
      const b = document.createElement('button');
      b.className = 'btn' + (primary ? ' primary' : '');
      b.textContent = label;
      b.onclick = fn;
      act.appendChild(b);
      return b;
    });
    this.setFocusList(btns);
    const v = $('#results-video');
    if (mode === 'gp' && gp && gp.finished) this.playVideo(v, 'assets/video/finale.mp4');
    else this.stopVideo(v);
  }

  // ---------- opzioni ----------
  options(settings, onChange) {
    this.show('options');
    // audio: le stesse righe del menu di gioco (valgono ovunque e si salvano subito)
    const rows = this.audioRows($('#opt-audio'));
    $('#opt-diff').value = settings.difficulty;
    $('#opt-quality').value = settings.quality;
    const read = () => onChange({ difficulty: +$('#opt-diff').value, quality: $('#opt-quality').value });
    ['#opt-diff', '#opt-quality'].forEach((s) => ($(s).oninput = read));
    this.setFocusList([...rows, $('#screen-options [data-back]')]);
  }

  credits() {
    this.show('credits');
    this.setFocusList([$('#screen-credits [data-back]')]);
  }

}
