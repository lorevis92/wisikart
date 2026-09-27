import * as THREE from 'three';

const _t = new THREE.Vector3();

export class AIDriver {
  constructor(kart, track, difficulty = 1) {
    this.kart = kart;
    this.track = track;
    this.difficulty = difficulty; // 0.7 facile, 1 normale, 1.2 difficile
    this.lane = (Math.random() - 0.5) * (track.halfW * 1.1);
    this.laneTimer = 2 + Math.random() * 4;
    this.itemTimer = 1 + Math.random() * 2;
    this.driftTimer = 0;
    this.skill = 0.75 + Math.random() * 0.25;
  }

  update(dt, karts, player, race) {
    const k = this.kart, tr = this.track, N = tr.N;
    const inp = k.input;
    // cambia corsia ogni tanto (per superare o schivare)
    this.laneTimer -= dt;
    if (this.laneTimer <= 0) {
      this.laneTimer = 2 + Math.random() * 5;
      this.lane = (Math.random() - 0.5) * (tr.halfW * 1.2);
    }
    // schiva ostacoli (grappoli) davanti
    for (const h of race.items.hazards) {
      const d = (h.idx - k.trackIdx + N) % N;
      if (d < 25 && Math.abs(h.lateral - this.lane) < 2.5) this.lane = h.lateral + (h.lateral > 0 ? -4 : 4);
    }
    const look = Math.round(6 + Math.abs(k.speed) * 0.45);
    const s = tr.samples[(k.trackIdx + look) % N];
    _t.copy(s.pos).addScaledVector(s.right, THREE.MathUtils.clamp(this.lane, -tr.halfW + 1, tr.halfW - 1));
    const dx = _t.x - k.pos.x, dz = _t.z - k.pos.z;
    const desired = Math.atan2(dx, dz);
    let diff = Math.atan2(Math.sin(desired - k.heading), Math.cos(desired - k.heading));
    inp.steer = THREE.MathUtils.clamp(-diff * 2.2, -1, 1);

    // curvatura più avanti per decidere gas e derapata
    const s2 = tr.samples[(k.trackIdx + look * 2) % N];
    const s0 = tr.samples[k.trackIdx];
    const turn = Math.abs(Math.atan2(s0.tangent.x * s2.tangent.z - s0.tangent.z * s2.tangent.x, s0.tangent.dot(s2.tangent)));
    let throttle = 1;
    if (turn > 0.75 && k.speed > k.maxSpeed * 0.8) throttle = 0.6;
    // derapata nelle curve lunghe
    this.driftTimer -= dt;
    const wantDrift = turn > 0.32 && k.speed > 18 && Math.abs(inp.steer) > 0.35;
    if (wantDrift && !k.drifting && this.driftTimer <= 0 && Math.random() < this.skill) {
      inp.drift = true;
      this.driftTimer = 0.5;
    } else if (k.drifting) {
      const tooMuch = Math.sign(inp.steer) !== k.driftDir && Math.abs(inp.steer) > 0.6;
      if (turn < 0.12 || tooMuch || k.driftCharge > 2.6) { inp.drift = false; this.driftTimer = 0.8; }
    } else inp.drift = false;

    // elastico: rispetto al giocatore
    let band = 1;
    if (player && !player.finished) {
      const gap = (player.progress - k.progress) / N; // giri di distanza
      band = THREE.MathUtils.clamp(1 + gap * 0.55, 0.86, 1.12);
    }
    k.maxSpeedAI = k.maxSpeed;
    inp.throttle = Math.min(1, throttle * band * this.difficulty);
    if (inp.throttle > 1) inp.throttle = 1;
    // per l'elastico oltre il 100% usiamo un piccolo boost passivo
    k.aiBoostFactor = band > 1 ? band : 1;

    // oggetti
    inp.item = false;
    if (k.item) {
      this.itemTimer -= dt;
      if (this.itemTimer <= 0) {
        const ahead = karts.find((o) => o !== k && o.progress > k.progress && o.progress - k.progress < N * 0.25);
        const behind = karts.find((o) => o !== k && o.progress < k.progress && k.progress - o.progress < 40);
        const it = k.item;
        let use = false;
        if (it === 'missile' || it === 'cannone') use = !!ahead;
        else if (it === 'grappoli') use = !!behind || Math.random() < 0.2;
        else if (it === 'pugno') use = !!ahead && ahead.progress - k.progress < 30;
        else if (it === 'turbo') use = turn < 0.4;
        else use = true;
        if (use) { inp.item = true; this.itemTimer = 1.5 + Math.random() * 3; }
        else this.itemTimer = 0.6;
      }
    }
  }
}
