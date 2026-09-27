import * as THREE from 'three';

const _t = new THREE.Vector3();
const clamp = THREE.MathUtils.clamp;

// soglie della derapata (sterzo equivalente e durata minima della curva in secondi)
export const DRIFT = { start: 0.12, run: 0.26, duration: 0.9, end: 0.1 };

/**
 * Dati di guida precalcolati per pista (una volta sola, condivisi da tutti gli avversari):
 * curvatura con segno per campione (>0 = curva a destra, in 1/m) e una traiettoria ideale
 * che taglia verso l'interno delle curve.
 */
function racingData(track) {
  if (track._aiData) return track._aiData;
  const N = track.N, S = track.samples, step = track.length / N;
  const raw = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = S[(i - 2 + N) % N].tangent, b = S[(i + 2) % N].tangent;
    const ang = Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z);
    raw[i] = ang / (4 * step);
  }
  const smooth = (src, r) => {
    const out = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let sum = 0;
      for (let d = -r; d <= r; d++) sum += src[(i + d + N) % N];
      out[i] = sum / (2 * r + 1);
    }
    return out;
  };
  const curv = smooth(raw, 3);
  // curvatura media su ~75 m: indica da che parte sta l'interno della curva che si sta affrontando
  const wide = smooth(raw, 25);
  const lim = track.halfW - 2.2;
  const line = new Float32Array(N);
  for (let i = 0; i < N; i++) line[i] = clamp(wide[i] * 700, -lim, lim);
  track._aiData = { curv, line: smooth(line, 6), step };
  return track._aiData;
}

export class AIDriver {
  constructor(kart, track, difficulty = 1) {
    this.kart = kart;
    this.track = track;
    kart.ai = this;
    this.difficulty = difficulty; // 0.85 tranquilla, 1 normale, 1.12 cattiva (× variazione per pilota)
    // 0 = tranquilla … 1 = cattiva
    this.aggr = clamp((difficulty - 0.85) / 0.27, 0, 1);
    this.skill = clamp(0.62 + this.aggr * 0.33 + (Math.random() - 0.5) * 0.1, 0.5, 1);
    this.pace = 0.9 + this.aggr * 0.11; // frazione della velocità massima del kart
    this.data = racingData(track);
    this.lineBias = (Math.random() - 0.5) * 1.6; // ognuno la sua traiettoria, di poco
    this.lat = kart.lateral;
    this.avoid = 0; // scostamento temporaneo (sorpasso, schivata)
    this.avoidTimer = 0;
    this.driftPlan = -1; // indice di fine della curva per cui è stata decisa la derapata
    this.plan = null;
    this.setupDir = 0;
    this.itemHeld = 0;
    this.itemDelay = 0;
    this.anger = 0; // dopo essere stato colpito: più reattivo e vendicativo
    this.attacker = null;
    this.wary = 0;
    this.wobble = Math.random() * 10;
    this.seen = new WeakMap();
    this.ramTarget = null;
  }

  /** Chiamato dalla gara quando questo kart viene colpito da un oggetto. */
  onHit(by) {
    this.anger = 8;
    this.wary = 12;
    if (by && by !== this.kart) this.attacker = by;
    this.driftPlan = -1;
    this.plan = null;
  }

  update(dt, karts, player, race) {
    const k = this.kart, tr = this.track, N = tr.N, D = this.data;
    const inp = k.input;
    this.anger = Math.max(0, this.anger - dt);
    this.wary = Math.max(0, this.wary - dt);
    this.wobble += dt;
    // colpito da qualsiasi cosa (anche un pugno, che non passa dagli eventi della gara): reagisci
    if (k.spin > 0 && !this.spinning) this.onHit(k.hitBy || this.attacker);
    this.spinning = k.spin > 0;
    k.hitBy = null;
    const v = Math.max(0, k.speed);
    const idx = k.trackIdx;

    // ---------- traiettoria: linea ideale + sorpassi e schivate ----------
    const lookSamples = Math.round(clamp(7 + v * 0.42, 8, 26) / D.step);
    const aheadIdx = (idx + lookSamples) % N;
    let desiredLat = D.line[aheadIdx] * (0.6 + this.skill * 0.4) + this.lineBias;
    // in derapata il kart gira più del necessario: punta all'esterno e lascia che la curva lo porti dentro
    if (k.drifting) desiredLat = -k.driftDir * (tr.halfW - 1.5);
    else if (this.setupDir) desiredLat = -this.setupDir * (tr.halfW - 2);
    this.avoidTimer -= dt;
    if (this.avoidTimer <= 0) this.avoid *= Math.max(0, 1 - dt * 2);
    const ram = k.punching > 0 && this.ramTarget && !this.ramTarget.finished && this.ramTarget.progress > k.progress - 4;
    if (ram) {
      // pugno in corso: dritto addosso al bersaglio
      desiredLat = this.ramTarget.lateral;
      this.avoid = 0;
    } else this._avoidTraffic(karts, race, desiredLat);
    desiredLat = clamp(desiredLat + this.avoid, -tr.halfW + 1.2, tr.halfW - 1.2);
    // la corsia cambia con gradualità: niente zig-zag
    this.lat = THREE.MathUtils.damp(this.lat, desiredLat, ram ? 9 : 2.6, dt);

    // ---------- sterzo: inseguimento puro verso il punto davanti ----------
    const s = tr.samples[aheadIdx];
    _t.copy(s.pos).addScaledVector(s.right, this.lat);
    // speronamento: mira al kart, leggermente avanti rispetto a dove si trova
    if (ram) _t.copy(this.ramTarget.pos).addScaledVector(this.ramTarget.forward(new THREE.Vector3()), Math.max(0, this.ramTarget.speed) * 0.25);
    const dx = _t.x - k.pos.x, dz = _t.z - k.pos.z;
    const L = Math.max(6, Math.hypot(dx, dz));
    const diff = Math.atan2(Math.sin(Math.atan2(dx, dz) - k.heading), Math.cos(Math.atan2(dx, dz) - k.heading));
    const sf = Math.min(1, v / 14) || 0.3;
    const yaw = (2 * Math.max(v, 8) * Math.sin(diff)) / L; // velocità di imbardata richiesta
    let sDes = -yaw / (k.turnRate * sf);
    // abbagliato dal lampo: guida a occhio, come il giocatore
    if (k.blind > 0) sDes += Math.sin(this.wobble * 5.3) * 0.45 + Math.sin(this.wobble * 2.1) * 0.25;
    else sDes += Math.sin(this.wobble * 1.7) * (1 - this.skill) * 0.08;

    // ---------- derapata pianificata ----------
    let cmd = clamp(sDes, -1, 1);
    inp.drift = this._drift(dt, sDes, v, idx);
    if (k.drifting && inp.drift) {
      // controsterzo calcolato: nella derapata l'imbardata è dir·0,95 + sterzo·0,55
      cmd = clamp((sDes / 0.95 - 0.95 * k.driftDir) / 0.55, -1, 1);
    } else if (inp.drift && !k.drifting) {
      cmd = Math.sign(sDes) * Math.max(0.55, Math.abs(cmd));
    }
    inp.steer = THREE.MathUtils.damp(inp.steer, cmd, k.drifting ? 10 : 14, dt);

    // ---------- gas: velocità obiettivo dalla curvatura (frenata modulata) ----------
    const band = this._band(player);
    k.aiBoostFactor = this.pace * band;
    // velocità massima di adesso: col turbo attivo (mini-turbo, pad, pugno) il tetto sale, e non va sprecato
    const vMax = k.maxSpeed * k.aiBoostFactor * (k.boost > 0 ? 1.32 * k.boostPower : 1) * (k.slow > 0 ? 0.62 : 1);
    const grip = k.turnRate * (0.86 + this.skill * 0.1) * (k.drifting ? 1.3 : 1);
    const decel = 11 + this.skill * 4;
    let vTarget = vMax;
    const brakeLook = Math.min(N - 1, Math.round((v * v) / (2 * decel) / D.step) + 6);
    for (let j = 1; j <= brakeLook; j += 2) {
      const c = Math.abs(D.curv[(idx + j) % N]);
      if (c < 1e-4) continue;
      const vCorner = grip / c;
      const vAllowed = Math.sqrt(vCorner * vCorner + 2 * decel * j * D.step);
      if (vAllowed < vTarget) vTarget = vAllowed;
    }
    // fuori strada o contro il muro: rientra senza forzare
    if (Math.abs(k.lateral) > tr.halfW + 1) vTarget = Math.min(vTarget, vMax * 0.8);
    let throttle = clamp(vTarget / vMax, 0.35, 1);
    if (v > vTarget + 7) throttle = -0.35; // troppo veloce per la curva: frena davvero
    inp.throttle = throttle;

    // ---------- oggetti ----------
    inp.item = false;
    if (k.item && k.spin <= 0) this._items(dt, karts, race);
    else this.itemHeld = 0;
  }

  /** Elastico: chi è dietro al giocatore spinge di più, chi è molto avanti rallenta un filo. */
  _band(player) {
    if (!player || player.finished) return 1;
    const gap = (player.progress - this.kart.progress) / this.track.N; // in giri
    const lo = 0.88 + this.aggr * 0.09, hi = 1.03 + this.aggr * 0.07;
    return clamp(1 + gap * (0.4 + this.aggr * 0.3), lo, hi);
  }

  /** Sorpassa i kart lenti davanti, schiva grappoli e colpi ionici in arrivo. */
  _avoidTraffic(karts, race, desiredLat) {
    const k = this.kart, tr = this.track, N = tr.N;
    const set = (off, t) => { this.avoid = off; this.avoidTimer = t; };
    // kart più lento davanti sulla stessa linea: affianca dal lato con più spazio
    for (const o of karts) {
      if (o === k || o.finished) continue;
      const gap = o.progress - k.progress;
      if (gap <= 0 || gap > 7) continue;
      const dl = o.lateral - (desiredLat + this.avoid);
      if (Math.abs(dl) < 2.6 && o.speed < k.speed + 0.5) {
        const passRight = o.lateral < 0 ? true : o.lateral > 0 ? false : Math.random() < 0.5;
        const target = o.lateral + (passRight ? 3.3 : -3.3);
        if (Math.abs(target) < tr.halfW - 1) set(target - desiredLat, 1.0);
      }
    }
    // grappoli sulla traiettoria (dopo essere stato colpito, margine più largo)
    const margin = this.wary > 0 ? 3.0 : 2.3;
    for (const h of race.items.hazards) {
      const d = (h.idx - k.trackIdx + N) % N;
      if (d > 32) continue;
      // ogni grappolo lo si vede o non lo si vede (più facile se bravi o appena scottati)
      if (!this.seen.has(h)) this.seen.set(h, Math.random() < 0.5 + this.skill * 0.35 + (this.wary > 0 ? 0.25 : 0));
      if (!this.seen.get(h)) continue;
      const cur = desiredLat + this.avoid;
      if (Math.abs(h.lateral - cur) < margin) {
        const away = h.lateral > 0 ? h.lateral - margin - 1.2 : h.lateral + margin + 1.2;
        set(clamp(away, -tr.halfW + 1.2, tr.halfW - 1.2) - desiredLat, 0.8);
      }
    }
    // colpo ionico in arrivo da dietro sulla stessa corsia: scarta
    for (const p of race.items.projectiles) {
      if (p.kind !== 'orb' || p.owner === k) continue;
      _t.subVectors(k.pos, p.mesh.position);
      const dist = _t.length();
      if (dist > 55 || _t.dot(p.dir) < 0) continue;
      const lateralMiss = Math.abs(_t.x * p.dir.z - _t.z * p.dir.x);
      if (lateralMiss < 2.6 && Math.random() < 0.4 + this.skill * 0.5) {
        const side = k.lateral > 0 ? -1 : 1;
        set(side * 4.5, 0.7);
      }
    }
  }

  /** Decide se tenere premuta la derapata. */
  _drift(dt, sDes, v, idx) {
    const k = this.kart, tr = this.track, N = tr.N, D = this.data;
    if (k.drifting) {
      const dir = k.driftDir;
      const along = sDes * dir; // quanto il punto da inseguire sta ancora nel verso della derapata
      if (k.driftCharge >= 2.35) return false; // mini-turbo arancione pronto: rilascia
      // sta per uscire dalla carreggiata: largo all'esterno, o stretto all'interno con la linea che chiede di aprire
      // (all'interno si può salire sul cordolo: non rallenta)
      const lat = k.lateral * dir;
      if (lat < -(tr.halfW - 0.4) && along > 0) return false;
      if (lat > tr.halfW + 0.9 && along < DRIFT.end) return false;
      // fine della curva misurata all'ingresso (non lo sterzo istantaneo, che in derapata oscilla)
      const left = this.driftPlan < 0 ? -1 : (this.driftPlan - idx + N) % N;
      const ending = left < 0 || left > N / 2 || left < 3 || along < -0.35;
      if (ending) {
        if (k.driftCharge >= 1.12) return false; // blu pronto: rilascia a fine curva
        return along > -0.6 && k.driftCharge > 0.55; // manca poco al blu: tieni ancora (i bordi sono controllati sopra)
      }
      return true;
    }
    const plan = this._planCurve(v, idx);
    this.setupDir = 0;
    if (!plan || !plan.go) return false;
    const toStart = (plan.start - idx + N) % N;
    if (toStart > N / 2 || toStart <= 4) {
      // dentro la curva pianificata: si parte se lo sterzo va già nel verso giusto
      if (v < 20 || k.spin > 0 || k.hop > 0 || sDes * plan.dir < DRIFT.start) return false;
      this.driftPlan = plan.end;
      return true;
    }
    // curva in arrivo: allargati all'esterno per entrare in derapata
    if (toStart * D.step < 70) this.setupDir = plan.dir;
    return false;
  }

  /**
   * Cerca la prossima curva abbastanza lunga da valere una derapata (almeno DRIFT.duration secondi
   * con sterzo necessario oltre DRIFT.run) e decide una volta sola, in base all'abilità, se farla.
   */
  _planCurve(v, idx) {
    const k = this.kart, N = this.track.N, D = this.data;
    const p = this.plan;
    if (p && (p.end - idx + N) % N < N / 2) return p; // curva ancora davanti o in corso
    this.plan = null;
    const speed = Math.max(v, 25);
    const scan = Math.round(90 / D.step);
    for (let j = 2; j < scan; j++) {
      const i0 = (idx + j) % N;
      const dir = Math.sign(D.curv[i0]);
      if ((speed * D.curv[i0] * dir) / k.turnRate <= DRIFT.run) continue;
      let run = 0, gaps = 0, end = i0;
      const maxJ = Math.round((speed * 3.5) / D.step);
      for (let m = 0; m < maxJ; m++) {
        const i = (i0 + m) % N;
        if ((speed * D.curv[i] * dir) / k.turnRate > DRIFT.run) { run += 1 + gaps; gaps = 0; end = i; }
        else if (++gaps > 6) break;
      }
      if ((run * D.step) / speed < DRIFT.duration) { j += run + gaps; continue; }
      end = (end + 3) % N; // un filo di margine: la derapata parte appena prima della curva
      // i più bravi derapano quasi sempre
      this.plan = { dir, start: i0, end, go: Math.random() < 0.45 + this.skill * 0.55 };
      return this.plan;
    }
    return null;
  }

  _items(dt, karts, race) {
    const k = this.kart, tr = this.track, N = tr.N, D = this.data;
    const inp = k.input;
    if (this.itemHeld === 0) this.itemDelay = (1.1 - this.aggr * 0.75) * (0.6 + Math.random() * 0.6);
    this.itemHeld += dt;
    const reactive = this.anger > 0 ? 0.35 : 1;
    if (this.itemHeld < this.itemDelay * reactive) return;

    // chi c'è davanti e dietro, chiunque sia (non solo il giocatore)
    let ahead = null, aheadGap = Infinity, behind = null, behindGap = Infinity;
    for (const o of karts) {
      if (o === k || o.finished) continue;
      const g = o.progress - k.progress;
      if (g > 0 && g < aheadGap) { aheadGap = g; ahead = o; }
      if (g < 0 && -g < behindGap) { behindGap = -g; behind = o; }
    }
    const near = (g) => g < 60; // ~180 m
    const held = this.itemHeld;
    // vendetta: se chi ti ha colpito è a tiro davanti, è lui il bersaglio
    const revenge = this.anger > 0 && this.attacker && !this.attacker.finished && this.attacker.progress > k.progress;
    const straightAhead = () => {
      let m = 0;
      for (let j = 2; j < 26; j += 2) m = Math.max(m, Math.abs(D.curv[(k.trackIdx + j) % N]));
      return m < 0.012;
    };
    let use = false;
    switch (k.item) {
      case 'missile':
        // insegue il primo davanti: basta che ci sia qualcuno a tiro
        use = !!ahead && (aheadGap < N * 0.3 || held > 8) || (revenge && this.attacker === ahead);
        break;
      case 'cannone': {
        // tiro dritto: serve un bersaglio davanti, allineato
        const target = revenge ? this.attacker : ahead;
        if (target && target.progress - k.progress < 30) {
          _t.subVectors(target.pos, k.pos);
          const dist = _t.length();
          const f = k.forward(new THREE.Vector3());
          const miss = Math.abs(_t.x * f.z - _t.z * f.x);
          use = _t.dot(f) > 0 && (miss < 1.8 + dist * 0.015 || (straightAhead() && Math.abs(target.lateral - k.lateral) < 2));
        }
        if (!use && held > 12 && ahead && near(aheadGap)) use = true;
        break;
      }
      case 'pugno': {
        // scatto che fa girare chi tocchi: davanti vicino, o affiancato
        const beside = karts.find((o) => o !== k && !o.finished && Math.abs(o.progress - k.progress) < 3 && Math.abs(o.lateral - k.lateral) < 3.5);
        const target = revenge && this.attacker.progress - k.progress < 6 ? this.attacker : ahead && aheadGap < 6 ? ahead : null;
        use = !!target || !!beside || (held > 10 && straightAhead());
        this.ramTarget = target || beside || null;
        break;
      }
      case 'grappoli':
        // dietro a chi insegue, anche solo per rallentarlo
        use = (behind && behindGap < 30 && Math.abs(behind.lateral - k.lateral) < 3) || (behind && behindGap < 10) || held > 6;
        break;
      case 'nebbia':
        // rallenta tutti: conviene quando c'è gente vicina, davanti o dietro
        use = (ahead && near(aheadGap)) || (behind && behindGap < 40) || held > 3;
        break;
      case 'perla':
        // abbaglia tutti: meglio se qualcuno è vicino o sta per entrare in curva
        use = (ahead && aheadGap < 45) || (behind && behindGap < 25) || held > 4;
        break;
      case 'turbo':
        use = (!k.drifting && straightAhead()) || Math.abs(k.lateral) > tr.halfW + 1 || held > 8;
        break;
      default:
        use = true;
    }
    if (use) {
      inp.item = true;
      this.itemHeld = 0;
    }
  }
}
