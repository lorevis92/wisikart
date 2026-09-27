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
    this.touch = { left: false, right: false, accel: false, drift: false, jump: false, up: false, down: false };
    // modalità Storia (platform): assi grezzi e salto con fronte di salita
    this.axisX = 0;
    this.axisY = 0;
    this.jumpHeld = false;
    this.jumpPressed = false;
    this.upPressed = false;
    this.isTouch = matchMedia('(pointer: coarse)').matches;
    this.menuEvents = [];
    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
    window.addEventListener('blur', () => this.keys.clear());
  }

  _key(e, down) {
    const k = e.code;
    if (down && !e.repeat) {
      if (k === 'ShiftLeft' || k === 'ShiftRight' || k === 'KeyE' || k === 'KeyJ') this.itemPressed = true;
      if (k === 'Escape' || k === 'KeyP') this.pausePressed = true;
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
      const on = (e) => { e.preventDefault(); if (name === 'item') this.itemPressed = true; else if (name === 'pause') this.pausePressed = true; else set(name, true); };
      const off = (e) => { e.preventDefault(); if (name !== 'item' && name !== 'pause') set(name, false); };
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
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gps && gps[0];
    if (gp) {
      const ax = gp.axes[0] || 0;
      if (Math.abs(ax) > 0.15) st += ax;
      if (gp.buttons[0]?.pressed || (gp.buttons[7]?.value || 0) > 0.2) th = Math.max(th, gp.buttons[7]?.value || 1);
      if (gp.buttons[2]?.pressed || (gp.buttons[6]?.value || 0) > 0.2) th = -1;
      if (gp.buttons[1]?.pressed || gp.buttons[5]?.pressed) drift = true;
      if (gp.buttons[3]?.pressed || gp.buttons[4]?.pressed) { if (!this._gpItem) this.itemPressed = true; this._gpItem = true; } else this._gpItem = false;
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
