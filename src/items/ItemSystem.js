import * as THREE from 'three';
import { rollItem } from '../config/items.js';

const _v = new THREE.Vector3();

export class ItemSystem {
  constructor(scene, track, audio) {
    this.scene = scene;
    this.track = track;
    this.audio = audio;
    this.projectiles = [];
    this.hazards = [];
    this.effects = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.events = [];
    this._geo = {
      missile: new THREE.ConeGeometry(0.4, 1.6, 10),
      orb: new THREE.SphereGeometry(0.7, 14, 12),
      grape: new THREE.SphereGeometry(0.55, 10, 10)
    };
  }

  /** chiamato quando un kart raccoglie una scatola: assegna dopo l'animazione */
  grant(kart, rank, total) {
    kart.item = rollItem(rank, total);
  }

  use(kart, karts) {
    const it = kart.item;
    if (!it) return;
    kart.item = null;
    this.events.push({ type: 'use', item: it, kart });
    switch (it) {
      case 'missile': this._missile(kart, karts); break;
      case 'cannone': this._cannon(kart); break;
      case 'grappoli': this._grapes(kart); break;
      case 'perla': this._flash(kart, karts); break;
      case 'nebbia': this._fog(kart, karts); break;
      case 'pugno': this._punch(kart, karts); break;
      case 'turbo': kart.boost = Math.max(kart.boost, 1.8); kart.boostPower = 1.12; break;
    }
  }

  _missile(kart, karts) {
    const N = this.track.N;
    let target = null, best = Infinity;
    for (const o of karts) {
      if (o === kart) continue;
      const gap = (o.progress - kart.progress);
      if (gap > 0 && gap < best) { best = gap; target = o; }
    }
    const mesh = new THREE.Mesh(this._geo.missile, new THREE.MeshStandardMaterial({ color: 0xff5a2a, emissive: 0xff3300, emissiveIntensity: 1.2 }));
    const glow = new THREE.PointLight(0xff6a2a, 2, 12);
    mesh.add(glow);
    mesh.position.copy(kart.pos).y += 1;
    this.group.add(mesh);
    this.projectiles.push({ kind: 'missile', mesh, owner: kart, target, idx: kart.trackIdx, lateral: kart.lateral, speed: 62, life: 9, t: 0 });
  }

  _cannon(kart) {
    const mesh = new THREE.Mesh(this._geo.orb, new THREE.MeshStandardMaterial({ color: 0x8ff0ff, emissive: 0x2bd4ff, emissiveIntensity: 2, transparent: true, opacity: 0.9 }));
    mesh.add(new THREE.PointLight(0x4fd8ff, 3, 14));
    mesh.position.copy(kart.pos).y += 1;
    this.group.add(mesh);
    const dir = kart.forward(new THREE.Vector3()).clone();
    this.projectiles.push({ kind: 'orb', mesh, owner: kart, dir, speed: 75 + Math.max(0, kart.speed), life: 3, t: 0 });
  }

  _grapes(kart) {
    const N = this.track.N;
    for (let i = 0; i < 3; i++) {
      const idx = (kart.trackIdx - 3 - i * 2 + N) % N;
      const lat = kart.lateral + (i - 1) * 1.6;
      const s = this.track.samples[idx];
      const mesh = new THREE.Group();
      for (let j = 0; j < 5; j++) {
        const b = new THREE.Mesh(this._geo.grape, new THREE.MeshStandardMaterial({ color: 0x6b2fa0, roughness: 0.3 }));
        b.position.set((j % 2) * 0.5 - 0.25, 0.4 + Math.floor(j / 2) * 0.35, (j % 3) * 0.3 - 0.3);
        mesh.add(b);
      }
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.1, 3), new THREE.MeshStandardMaterial({ color: 0x3fa34d }));
      leaf.position.y = 1.2;
      mesh.add(leaf);
      mesh.position.copy(s.pos).addScaledVector(s.right, lat).addScaledVector(s.normal, 0.2);
      this.group.add(mesh);
      this.hazards.push({ kind: 'grape', mesh, idx, lateral: lat, owner: kart, life: 45 });
    }
  }

  _flash(kart, karts) {
    for (const o of karts) {
      if (o === kart) continue;
      const wasBlind = o.blind > 0;
      o.blind = 2.4;
      if (o.isPlayer && !wasBlind) this.events.push({ type: 'blind', kart: o });
      if (!o.isPlayer) o.input.steer += (Math.random() - 0.5) * 1.2; // l'IA sbanda un po'
    }
    this.effects.push({ kind: 'flash', t: 0, pos: kart.pos.clone(), color: 0xfff3c4 });
  }

  _fog(kart, karts) {
    for (const o of karts) {
      if (o === kart) continue;
      o.slow = 3.2;
    }
    // nuvole di nebbia sulla pista davanti ai rivali
    const N = this.track.N;
    for (const o of karts) {
      if (o === kart) continue;
      const s = this.track.samples[(o.trackIdx + 8) % N];
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(4, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd8e0e8, transparent: true, opacity: 0.55, depthWrite: false }));
      cloud.position.copy(s.pos).addScaledVector(s.normal, 2);
      this.group.add(cloud);
      this.effects.push({ kind: 'cloud', mesh: cloud, t: 0, life: 3.5 });
    }
    if (karts.some((o) => o.isPlayer && o !== kart)) this.events.push({ type: 'fog' });
  }

  _punch(kart, karts) {
    kart.boost = Math.max(kart.boost, 1.2);
    kart.boostPower = 1.25;
    kart.punching = 1.2;
    kart.invuln = 1.4;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.18, 8, 24), new THREE.MeshBasicMaterial({ color: 0x3f77ff, transparent: true, opacity: 0.9 }));
    ring.rotation.x = Math.PI / 2;
    this.effects.push({ kind: 'ring', mesh: ring, t: 0, life: 0.6, follow: kart });
    this.group.add(ring);
  }

  update(dt, karts, playerKart) {
    const N = this.track.N, tr = this.track;
    for (const k of karts) if (k.punching) k.punching = Math.max(0, k.punching - dt);
    // proiettili
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.t += dt;
      if (p.kind === 'missile') {
        // segue la linea della pista verso il bersaglio
        const targetLat = p.target ? THREE.MathUtils.lerp(p.lateral, p.target.lateral, Math.min(1, p.t * 0.7)) : p.lateral;
        p.lateral = targetLat;
        const stepIdx = (p.speed * dt) / (tr.length / N);
        p.idxF = (p.idxF ?? p.idx) + stepIdx;
        p.idx = Math.floor(p.idxF) % N;
        const s = tr.samples[p.idx];
        const s2 = tr.samples[(p.idx + 1) % N];
        const f = p.idxF - Math.floor(p.idxF);
        _v.copy(s.pos).lerp(s2.pos, f).addScaledVector(s.right, p.lateral).addScaledVector(s.normal, 1.0 + Math.sin(p.t * 8) * 0.15);
        p.mesh.position.copy(_v);
        p.mesh.lookAt(_v.clone().add(s.tangent));
        p.mesh.rotateX(Math.PI / 2);
        if (p.target && p.target.finished) p.target = null;
      } else {
        p.mesh.position.addScaledVector(p.dir, p.speed * dt);
        const pr = tr.project(p.mesh.position, p.owner.trackIdx);
        p.mesh.position.y = pr.height + 1;
        if (Math.abs(pr.lateral) > tr.wallDist) p.life = 0;
        p.mesh.scale.setScalar(1 + Math.sin(p.t * 20) * 0.1);
      }
      // colpisce?
      let hit = false;
      for (const k of karts) {
        if (k === p.owner && p.t < 0.6) continue;
        if (k.pos.distanceToSquared(p.mesh.position) < 2.4 * 2.4) {
          if (k.applySpinout(1)) this.events.push({ type: 'hit', victim: k, by: p.owner, item: p.kind });
          hit = true;
          break;
        }
      }
      if (hit || p.life <= 0) {
        this._burst(p.mesh.position, p.kind === 'missile' ? 0xff7a3a : 0x6fe8ff);
        this.group.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
    // pericoli
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.life -= dt;
      h.mesh.rotation.y += dt;
      let hit = false;
      for (const k of karts) {
        if (k === h.owner && h.life > 44) continue;
        if (k.pos.distanceToSquared(h.mesh.position) < 2.0 * 2.0) {
          if (k.applySpinout(0.8)) this.events.push({ type: 'hit', victim: k, by: h.owner, item: 'grappoli' });
          hit = true;
          break;
        }
      }
      if (hit || h.life <= 0) {
        this._burst(h.mesh.position, 0xb07ad8);
        this.group.remove(h.mesh);
        this.hazards.splice(i, 1);
      }
    }
    // effetti
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.t += dt;
      if (e.kind === 'ring') {
        e.mesh.position.copy(e.follow.pos).y += 0.8;
        e.mesh.scale.setScalar(1 + e.t * 6);
        e.mesh.material.opacity = Math.max(0, 0.9 - e.t * 1.5);
      } else if (e.kind === 'cloud') {
        e.mesh.material.opacity = Math.max(0, 0.55 * (1 - e.t / e.life));
        e.mesh.scale.setScalar(1 + e.t * 0.4);
      } else if (e.kind === 'burst') {
        e.mesh.scale.setScalar(1 + e.t * 10);
        e.mesh.material.opacity = Math.max(0, 0.8 - e.t * 2.5);
      }
      if (e.life !== undefined && e.t > e.life) {
        if (e.mesh) this.group.remove(e.mesh);
        this.effects.splice(i, 1);
      } else if (e.kind === 'flash' && e.t > 0.5) this.effects.splice(i, 1);
    }
  }

  _burst(pos, color) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
    m.position.copy(pos);
    this.group.add(m);
    this.effects.push({ kind: 'burst', mesh: m, t: 0, life: 0.35 });
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
