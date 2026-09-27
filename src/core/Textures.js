import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tex(c, repeat = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let seed = 1;
function rnd() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

export function roadTexture(base = '#4a4a50', line = '#f2e9d0', tunnel = false) {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  // grana
  seed = 7;
  for (let i = 0; i < 9000; i++) {
    const v = 20 + rnd() * 40;
    g.fillStyle = `rgba(${v},${v},${v + 8},${0.12 + rnd() * 0.2})`;
    g.fillRect(rnd() * 512, rnd() * 512, 2 + rnd() * 3, 2 + rnd() * 3);
  }
  // linea centrale tratteggiata
  g.fillStyle = line;
  for (let y = 0; y < 512; y += 128) g.fillRect(250, y + 20, 12, 70);
  if (tunnel) {
    g.strokeStyle = 'rgba(120,150,255,0.35)';
    g.lineWidth = 3;
    for (let y = 0; y < 512; y += 64) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(512, y);
      g.stroke();
    }
  }
  return tex(c, [1, 1]);
}

export function curbTexture(a = '#e84c5a', b = '#fff3d6') {
  const c = canvas(64, 256);
  const g = c.getContext('2d');
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? a : b;
    g.fillRect(0, i * 64, 64, 64);
  }
  return tex(c, [1, 1]);
}

export function tunnelWallTexture(base = '#231a4d', glow = '#7a5cff') {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = glow;
  g.lineWidth = 3;
  g.shadowColor = glow;
  g.shadowBlur = 10;
  g.globalAlpha = 0.7;
  for (let i = 0; i <= 512; i += 128) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 512);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i);
    g.lineTo(512, i);
    g.stroke();
  }
  g.shadowBlur = 0;
  g.globalAlpha = 1;
  return tex(c, [1, 1]);
}

/** Punto tondo e sfumato per i Points (di default three.js disegna quadratini dai bordi netti). */
let _dot = null;
export function dotTexture() {
  if (_dot) return _dot;
  const c = canvas(64, 64);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  _dot = new THREE.CanvasTexture(c);
  _dot.colorSpace = THREE.SRGBColorSpace;
  return _dot;
}

export function grassTexture(base = '#5aa64b') {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  seed = 3;
  for (let i = 0; i < 2500; i++) {
    const k = rnd();
    g.fillStyle = k < 0.5 ? 'rgba(40,110,40,0.35)' : 'rgba(150,210,90,0.25)';
    g.fillRect(rnd() * 256, rnd() * 256, 2, 4 + rnd() * 5);
  }
  return tex(c, [60, 60]);
}

export function rockTexture(base = '#a3774a') {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  seed = 5;
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(0,0,0,${rnd() * 0.25})`;
    g.fillRect(rnd() * 256, rnd() * 256, 8 + rnd() * 30, 3 + rnd() * 6);
  }
  return tex(c, [8, 8]);
}

export function windowsTexture(base = '#d8c9a8', lit = '#ffd27a', dark = '#3b3a4a') {
  const c = canvas(256, 512);
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 512);
  seed = 9;
  for (let y = 24; y < 512; y += 52) {
    for (let x = 20; x < 256; x += 48) {
      g.fillStyle = rnd() < 0.55 ? lit : dark;
      g.fillRect(x, y, 26, 34);
    }
  }
  return tex(c, [1, 1]);
}

export function boostTexture() {
  const c = canvas(128, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#1b6b55';
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#43e0b0';
  for (let y = 0; y < 256; y += 64) {
    g.beginPath();
    g.moveTo(10, y + 50);
    g.lineTo(64, y + 10);
    g.lineTo(118, y + 50);
    g.lineTo(64, y + 30);
    g.closePath();
    g.fill();
  }
  return tex(c);
}

export function skyGradientTexture(top, mid, bottom, stars = false, moons = false) {
  const c = canvas(1024, 512);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, top);
  grad.addColorStop(0.55, mid);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);
  if (stars) {
    seed = 21;
    for (let i = 0; i < 700; i++) {
      const a = 0.3 + rnd() * 0.7;
      g.fillStyle = `rgba(255,255,255,${a})`;
      const s = rnd() < 0.1 ? 3 : 1.5;
      g.fillRect(rnd() * 1024, rnd() * 300, s, s);
    }
  }
  if (moons) {
    g.fillStyle = '#ffb6c9';
    g.shadowColor = '#ff8fb0';
    g.shadowBlur = 40;
    g.beginPath();
    g.arc(700, 110, 48, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e8ecff';
    g.shadowColor = '#ffffff';
    g.beginPath();
    g.arc(300, 150, 22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = top;
    g.beginPath();
    g.arc(310, 143, 19, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

// La faccia di Whiskey: simbolo grafico fisso (sopracciglia, piega, occhi, naso ^^, bocca bianca).
export function faceTexture(skin = '#5b8cf0', opts = {}) {
  const { pupils = true, eyeOpen = 1, sly = true, blush = false } = opts;
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = skin;
  g.fillRect(0, 0, 256, 256);
  // solo la metà frontale è "viso": disegniamo centrato
  const cx = 128, cy = 118;
  g.strokeStyle = '#151428';
  g.fillStyle = '#151428';
  g.lineWidth = 6;
  g.lineCap = 'round';
  // sopracciglia: due trattini inclinati
  g.beginPath();
  g.moveTo(cx - 52, cy - 46);
  g.lineTo(cx - 22, cy - 38);
  g.moveTo(cx + 52, cy - 46);
  g.lineTo(cx + 22, cy - 38);
  g.stroke();
  // piega verticale della fronte
  g.beginPath();
  g.moveTo(cx, cy - 46);
  g.lineTo(cx, cy - 30);
  g.stroke();
  // occhi: contorno esagonale arrotondato, riempimento bianco, pupilla
  const eye = (ex) => {
    g.beginPath();
    g.moveTo(ex - 24, cy - 8);
    g.lineTo(ex - 12, cy - 20 * eyeOpen);
    g.lineTo(ex + 12, cy - 20 * eyeOpen);
    g.lineTo(ex + 24, cy - 8);
    g.lineTo(ex + 12, cy + 6 * eyeOpen);
    g.lineTo(ex - 12, cy + 6 * eyeOpen);
    g.closePath();
    g.fillStyle = '#ffffff';
    g.fill();
    g.lineWidth = 5;
    g.stroke();
    if (pupils) {
      g.fillStyle = '#151428';
      g.beginPath();
      g.arc(ex + (sly ? 6 : 0), cy - 4, 6, 0, Math.PI * 2);
      g.fill();
    }
    if (sly) {
      // palpebra pesante
      g.fillStyle = skin;
      g.fillRect(ex - 22, cy - 20 * eyeOpen - 3, 44, 9);
      g.beginPath();
      g.moveTo(ex - 24, cy - 8);
      g.lineTo(ex - 12, cy - 20 * eyeOpen);
      g.lineTo(ex + 12, cy - 20 * eyeOpen);
      g.lineTo(ex + 24, cy - 8);
      g.strokeStyle = '#151428';
      g.stroke();
    }
  };
  eye(cx - 36);
  eye(cx + 36);
  // naso ^^ minuscolo
  g.strokeStyle = '#151428';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(cx - 10, cy + 22);
  g.lineTo(cx - 5, cy + 16);
  g.lineTo(cx, cy + 22);
  g.lineTo(cx + 5, cy + 16);
  g.lineTo(cx + 10, cy + 22);
  g.stroke();
  // bocca: sorriso largo, interno bianco senza denti disegnati
  g.beginPath();
  g.moveTo(cx - 56, cy + 34);
  g.quadraticCurveTo(cx, cy + 82, cx + 56, cy + 34);
  g.quadraticCurveTo(cx, cy + 50, cx - 56, cy + 34);
  g.closePath();
  g.fillStyle = '#ffffff';
  g.fill();
  g.lineWidth = 5;
  g.stroke();
  if (blush) {
    g.fillStyle = 'rgba(255,120,150,0.55)';
    g.beginPath();
    g.arc(cx - 62, cy + 26, 14, 0, Math.PI * 2);
    g.arc(cx + 62, cy + 26, 14, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
