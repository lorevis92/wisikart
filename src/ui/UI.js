import { CHARACTERS } from '../config/characters.js';
import { TRACKS, POINTS_TABLE } from '../config/tracks.js';
import { ITEMS } from '../config/items.js';
import { faceTexture } from '../core/Textures.js';
import { Assets } from '../core/AssetLoader.js';

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
    document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => game.back()));
    $('#toast');
  }

  show(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const el = $(`#screen-${name}`);
    if (el) el.classList.add('active');
    this.current = name;
    this.focus = { list: [], index: 0, cols: 1 };
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
    if (el) el.click();
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
    if (await Assets.exists('assets/ui/logo.png')) {
      for (const id of ['boot-logo', 'title-logo']) {
        const block = $(`#${id}`);
        const img = new Image();
        img.src = 'assets/ui/logo.png';
        img.alt = 'WisiKart';
        block.querySelector('.wordmark').replaceWith(img);
      }
    }
  }

  // ---------- titolo ----------
  async title() {
    this.show('title');
    const items = [...document.querySelectorAll('#main-menu .menu-item')];
    this.setFocusList(items);
    const v = $('#title-video');
    this.playVideo(v, 'assets/video/intro.mp4', {
      onFail: () => Assets.exists('assets/ui/title.png').then((ok) => { if (ok) $('#title-bg').style.backgroundImage = 'url(assets/ui/title.png)'; })
    });
    $('#title-hint').textContent = this.game.input.isTouch ? 'Tocca per scegliere. In gara usa i tasti sullo schermo.' : "Frecce o WASD per muoverti · Spazio per derapare · Maiusc per l'oggetto";
  }

  // ---------- personaggi ----------
  characters(mode, onPick) {
    this.show('chars');
    $('#chars-mode').textContent = mode === 'gp' ? 'Gran Premio · Coppa della Fuga' : mode === 'time' ? 'Prova a tempo' : 'Corsa singola';
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
    $('#tracks-mode').textContent = mode === 'time' ? 'Prova a tempo' : 'Corsa singola';
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
      const finish = () => {
        if (done) return;
        done = true;
        window.removeEventListener('keydown', finish);
        window.removeEventListener('pointerdown', finish);
        this.stopVideo(v);
        $('#loading-skip').classList.add('hidden');
        resolve();
      };
      this.playVideo(v, 'assets/video/griglia.mp4', { onFail: finish, onEnd: finish });
      window.addEventListener('keydown', finish);
      window.addEventListener('pointerdown', finish);
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
    if (mode === 'gp' && gp) sub = gp.finished ? (gp.standings[0].character.id === playerChar.id ? 'Hai vinto la Coppa della Fuga. Emma fa finta di non essere colpita.' : `Coppa finita: ${gp.standings[0].character.name} porta a casa il trofeo.`) : `Gara ${gp.raceIndex + 1} di ${gp.tracks.length} · ${me.rank === 1 ? 'Emma: "Non è stato merito mio, ma quasi."' : 'Emma: "Si può fare meglio. Lo dico con affetto."'}`;
    else if (mode === 'time') sub = isNewBest ? 'Nuovo miglior giro! Emma non commenta, quindi è impressionata.' : 'Emma: "Il cronometro non mente. Purtroppo."';
    else sub = me.rank === 1 ? 'Emma: "Complimenti. Anche se, diciamocelo, non è stato merito mio."' : me.rank <= 3 ? 'Emma: "Podio. Va bene, ma il primo posto era lì."' : 'Emma: "Ti ho visto. Ho visto tutto."';
    $('#results-sub').textContent = sub;
    const list = $('#results-list');
    list.innerHTML = '';
    const rows = mode === 'gp' && gp && gp.finished ? gp.standings.map((s, i) => ({ rank: i + 1, character: s.character, time: null, isPlayer: s.character.id === playerChar.id, pts: s.points, total: true })) : results;
    for (const r of rows) {
      const li = document.createElement('li');
      if (r.isPlayer) li.classList.add('me');
      const pts = mode === 'gp' ? (r.total ? `${r.pts} pt` : `+${POINTS_TABLE[r.rank - 1] || 0} pt`) : '';
      li.innerHTML = `<span class="rank">${r.rank}°</span><span class="dot" style="background-color:${r.character.colors.primary}"></span><span class="nm">${r.character.name}</span><span class="tm">${r.total ? '' : fmt(r.time)}</span><span class="pts">${pts}</span>`;
      const dot = li.querySelector('.dot');
      Assets.exists(r.character.portrait).then((ok) => { if (ok) dot.style.backgroundImage = `url(${r.character.portrait})`; });
      list.appendChild(li);
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
    $('#opt-music').value = settings.music;
    $('#opt-sfx').value = settings.sfx;
    $('#opt-voice').value = settings.voice;
    $('#opt-diff').value = settings.difficulty;
    $('#opt-quality').value = settings.quality;
    const read = () => onChange({
      music: +$('#opt-music').value, sfx: +$('#opt-sfx').value, voice: +$('#opt-voice').value,
      difficulty: +$('#opt-diff').value, quality: $('#opt-quality').value
    });
    ['#opt-music', '#opt-sfx', '#opt-voice', '#opt-diff', '#opt-quality'].forEach((s) => ($(s).oninput = read));
    this.setFocusList([$('#screen-options [data-back]')]);
  }

  credits() {
    this.show('credits');
    this.setFocusList([$('#screen-credits [data-back]')]);
  }

  pause(on) {
    this.overlay('pause', on);
    if (on) this.setFocusList([...document.querySelectorAll('#screen-pause .btn')]);
  }
}
