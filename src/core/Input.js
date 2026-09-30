// Se il browser non dà `code` (layout particolari, desktop remoto) si ricava dal tasto
const KEY_FALLBACK = {
  ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
  ' ': 'Space', Spacebar: 'Space', Enter: 'Enter', Escape: 'Escape', Esc: 'Escape', Backspace: 'Backspace', Shift: 'ShiftLeft'
};
for (const ch of 'abcdefghijklmnopqrstuvwxyz') KEY_FALLBACK[ch] = KEY_FALLBACK[ch.toUpperCase()] = 'Key' + ch.toUpperCase();

// corsie dei livelli ritmici: tasti e pulsanti del gamepad (X, A, B, Y), da sinistra a destra
const LANE_KEYS = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
const LANE_PAD = [2, 0, 1, 3];

export class Input {
  constructor() {
    this.keys = new Set();
    this.throttle = 0;
    this.steer = 0;
    this.drift = false;
    this.itemPressed = false;
    this.lookBack = false;
    this._axisYPrev = 0;
    this.pausePressed = false;
    this.mutePressed = false; // M: silenzio immediato di tutto l'audio
    this.attackPressed = false; // pugno (rissa): F / L, tasto X del gamepad, tasto touch
    this.touch = { left: false, right: false, accel: false, drift: false, jump: false, up: false, down: false, item: false, attack: false };
    this.brakeHeld = false;
    // livelli ritmici: quattro corsie (D F J K, quattro zone touch, X A B Y del gamepad), tenute e appena premute
    this.lanes = [false, false, false, false];
    this.lanePressed = [false, false, false, false];
    this.touchLanes = [false, false, false, false];
    this._padLanes = [false, false, false, false];
    // modalità Storia (platform): assi grezzi e salto con fronte di salita
    this.axisX = 0;
    this.axisY = 0;
    this.jumpHeld = false;
    this.jumpPressed = false;
    this.upPressed = false;
    this.isTouch = matchMedia('(pointer: coarse)').matches;
    // ultimo tipo di input usato: decide quali tasti mostrare nelle istruzioni
    this.lastDevice = this.isTouch ? 'touch' : 'keyboard';
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') this.lastDevice = 'touch'; });
    this.menuEvents = [];
    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll(); });
    this._pads = new Map(); // calibrazione per gamepad: assi a riposo e tasti "armati"
  }

  /** Rilascia tutto: tasti, tasti touch, salto. Evita comandi rimasti incastrati (cambio finestra, inizio livello). */
  releaseAll() {
    this.keys.clear();
    for (const k in this.touch) this.touch[k] = false;
    this.jumpHeld = false;
    this.jumpPressed = this.upPressed = this.itemPressed = this.attackPressed = false;
    for (let i = 0; i < 4; i++) this.lanePressed[i] = this.touchLanes[i] = false;
  }

  /** Zona touch di una corsia premuta o rilasciata (la disegna la UI sopra le corsie). */
  setTouchLane(i, on) {
    if (on && !this.touchLanes[i]) this.lanePressed[i] = true;
    this.touchLanes[i] = on;
    if (on) this.lastDevice = 'touch';
  }

  /**
   * Gamepad ripulito: solo mappatura standard, assi misurati rispetto alla posizione a riposo
   * (con zona morta) e tasti validi solo dopo essere stati visti rilasciati almeno una volta.
   * Un controller starato o un dispositivo "fantasma" con un asse fermo o il tasto A sempre giù
   * altrimenti annulla le frecce e blocca il salto.
   */
  _pad() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    const raw = gps && [...gps].find((g) => g && g.connected && g.mapping === 'standard');
    if (!raw) return null;
    let cal = this._pads.get(raw.index);
    if (!cal || cal.id !== raw.id) {
      cal = { id: raw.id, rest: raw.axes.map((a) => (Math.abs(a) > 0.5 ? a : 0)), armed: raw.buttons.map((b) => !b.pressed) };
      this._pads.set(raw.index, cal);
    }
    const axes = raw.axes.map((a, i) => {
      const v = a - (cal.rest[i] || 0);
      return Math.abs(v) < 0.25 ? 0 : Math.max(-1, Math.min(1, v));
    });
    const buttons = raw.buttons.map((b, i) => {
      if (!b.pressed && (b.value || 0) < 0.1) cal.armed[i] = true;
      return cal.armed[i] ? { pressed: b.pressed, value: b.value || 0 } : { pressed: false, value: 0 };
    });
    if (buttons.some((b) => b.pressed) || axes.some((a) => a !== 0)) this.lastDevice = 'gamepad';
    return { axes, buttons };
  }

  _key(e, down) {
    const k = e.code && e.code !== 'Unidentified' ? e.code : KEY_FALLBACK[e.key] || e.key;
    if (down) this.lastDevice = 'keyboard';
    if (down && !e.repeat) {
      if (k === 'ShiftLeft' || k === 'ShiftRight' || k === 'KeyE' || k === 'KeyJ') this.itemPressed = true;
      if (k === 'Escape' || k === 'KeyP') this.pausePressed = true;
      if (k === 'KeyM') this.mutePressed = true;
      if (k === 'KeyF' || k === 'KeyL') this.attackPressed = true;
      const lane = LANE_KEYS.indexOf(k);
      if (lane >= 0) this.lanePressed[lane] = true;
      // navigazione menu
      if (k === 'ArrowUp' || k === 'KeyW') this.menuEvents.push('up');
      if (k === 'ArrowDown' || k === 'KeyS') this.menuEvents.push('down');
      if (k === 'ArrowLeft' || k === 'KeyA') this.menuEvents.push('left');
      if (k === 'ArrowRight' || k === 'KeyD') this.menuEvents.push('right');
      if (k === 'Enter' || k === 'Space') this.menuEvents.push('ok');
      if (k === 'Escape' || k === 'Backspace') this.menuEvents.push('back');
    }
    if (down) this.keys.add(k); else this.keys.delete(k);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
  }

  bindTouch(root) {
    const set = (name, v) => { this.touch[name] = v; };
    root.querySelectorAll('[data-touch]').forEach((b) => {
      const name = b.dataset.touch;
      // 'item' registra sia la pressione (lancio) sia il tenuto (freno nei livelli di volo)
      const on = (e) => { e.preventDefault(); if (name === 'item') { this.itemPressed = true; set('item', true); } else if (name === 'pause') this.pausePressed = true; else { if (name === 'attack') this.attackPressed = true; set(name, true); } };
      const off = (e) => { e.preventDefault(); if (name !== 'pause') set(name, false); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('pointerleave', off);
    });
  }

  update() {
    const k = this.keys;
    let th = 0, st = 0;
    if (k.has('ArrowUp') || k.has('KeyW')) th += 1;
    if (k.has('ArrowDown') || k.has('KeyS')) th -= 1;
    if (k.has('ArrowLeft') || k.has('KeyA')) st -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) st += 1;
    let drift = k.has('Space') || k.has('ShiftRight') && false;
    this.lookBack = k.has('KeyC');
    // touch
    if (this.touch.accel) th = 1;
    if (this.touch.left) st -= 1;
    if (this.touch.right) st += 1;
    if (this.touch.drift) drift = true;
    // gamepad
    const gp = this._pad();
    if (gp) {
      const ax = gp.axes[0] || 0;
      if (Math.abs(ax) > 0.15 && st === 0) st += ax; // la tastiera ha la precedenza
      if (gp.buttons[0]?.pressed || (gp.buttons[7]?.value || 0) > 0.2) th = Math.max(th, gp.buttons[7]?.value || 1);
      if (gp.buttons[2]?.pressed || (gp.buttons[6]?.value || 0) > 0.2) th = -1;
      if (gp.buttons[1]?.pressed || gp.buttons[5]?.pressed) drift = true;
      if (gp.buttons[3]?.pressed || gp.buttons[4]?.pressed) { if (!this._gpItem) this.itemPressed = true; this._gpItem = true; } else this._gpItem = false;
      if (gp.buttons[2]?.pressed) { if (!this._gpAttack) this.attackPressed = true; this._gpAttack = true; } else this._gpAttack = false;
      if (gp.buttons[9]?.pressed) { if (!this._gpPause) this.pausePressed = true; this._gpPause = true; } else this._gpPause = false;
      if (gp.buttons[12]?.pressed) { if (!this._gpUp) this.menuEvents.push('up'); this._gpUp = true; } else this._gpUp = false;
      if (gp.buttons[13]?.pressed) { if (!this._gpDown) this.menuEvents.push('down'); this._gpDown = true; } else this._gpDown = false;
      if (gp.buttons[14]?.pressed) { if (!this._gpLeft) this.menuEvents.push('left'); this._gpLeft = true; } else this._gpLeft = false;
      if (gp.buttons[15]?.pressed) { if (!this._gpRight) this.menuEvents.push('right'); this._gpRight = true; } else this._gpRight = false;
      if (gp.buttons[0]?.pressed) { if (!this._gpOk) this.menuEvents.push('ok'); this._gpOk = true; } else this._gpOk = false;
      if (gp.buttons[1]?.pressed) { if (!this._gpBack) this.menuEvents.push('back'); this._gpBack = true; } else this._gpBack = false;
    }
    // platform: su/giù per le scale, salto con Spazio/K, touch o A del gamepad
    let ay = 0;
    if (k.has('ArrowUp') || k.has('KeyW') || this.touch.up) ay += 1;
    if (k.has('ArrowDown') || k.has('KeyS') || this.touch.down) ay -= 1;
    let jump = k.has('Space') || k.has('KeyK') || this.touch.jump;
    if (gp) {
      const ay2 = gp.axes[1] || 0;
      if (Math.abs(ay2) > 0.5) ay -= Math.sign(ay2);
      if (gp.buttons[12]?.pressed) ay += 1;
      if (gp.buttons[13]?.pressed) ay -= 1;
      if (gp.buttons[0]?.pressed) jump = true;
    }
    this.axisX = Math.max(-1, Math.min(1, st));
    ay = Math.max(-1, Math.min(1, ay));
    if (ay > 0.5 && this._axisYPrev <= 0.5) this.upPressed = true;
    this._axisYPrev = ay;
    this.axisY = ay;
    if (jump && !this.jumpHeld) this.jumpPressed = true;
    this.jumpHeld = jump;
    // freno (livelli di volo): lo stesso tasto dell'oggetto, tenuto
    this.brakeHeld = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyE') || k.has('KeyJ') || !!this.touch.item ||
      !!(gp && (gp.buttons[2]?.pressed || gp.buttons[3]?.pressed || (gp.buttons[6]?.value || 0) > 0.3));
    // inseguimento: guarda indietro (tenuto: Maiusc / E / J / C, tasto touch Indietro, Y o LB) e freno (Q / X,
    // tasto touch Frena, X o grilletto sinistro del gamepad)
    this.lookHeld = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyE') || k.has('KeyJ') || k.has('KeyC') || !!this.touch.item ||
      !!(gp && (gp.buttons[3]?.pressed || gp.buttons[4]?.pressed));
    this.chaseBrake = k.has('KeyQ') || k.has('KeyX') || !!this.touch.attack ||
      !!(gp && (gp.buttons[2]?.pressed || (gp.buttons[6]?.value || 0) > 0.3));
    // corsie: tenute (tastiera, touch, gamepad) e fronti di salita del gamepad
    for (let i = 0; i < 4; i++) {
      const pad = !!(gp && gp.buttons[LANE_PAD[i]]?.pressed);
      if (pad && !this._padLanes[i]) this.lanePressed[i] = true;
      this._padLanes[i] = pad;
      this.lanes[i] = k.has(LANE_KEYS[i]) || this.touchLanes[i] || pad;
    }
    // smorzamento dello sterzo per la tastiera
    const target = Math.max(-1, Math.min(1, st));
    this.steer += (target - this.steer) * (target === 0 ? 0.35 : 0.22);
    if (Math.abs(this.steer) < 0.01) this.steer = 0;
    this.throttle = th;
    this.drift = drift;
  }

  consumeMenu() {
    const e = this.menuEvents;
    this.menuEvents = [];
    return e;
  }
}
