import * as THREE from 'three';
import { TRACKS } from '../src/config/tracks.js';
for (const t of TRACKS) {
  if (t.locked) continue;
  const curve = new THREE.CatmullRomCurve3(t.points.map(p => new THREE.Vector3(...p)), true, 'centripetal', 0.5);
  const N = 800;
  const pts = curve.getSpacedPoints(N);
  const len = curve.getLength();
  let minR = 1e9, minRt = 0, maxSlope = 0;
  for (let i = 1; i < N - 1; i++) {
    const a = pts[i-1], b = pts[i], c = pts[i+1];
    const ab = new THREE.Vector2(b.x-a.x, b.z-a.z), bc = new THREE.Vector2(c.x-b.x, c.z-b.z);
    const ang = Math.abs(Math.atan2(ab.x*bc.y-ab.y*bc.x, ab.dot(bc)));
    const seg = (ab.length()+bc.length())/2;
    const R = ang > 1e-6 ? seg/ang : 1e9;
    if (R < minR) { minR = R; minRt = i/N; }
    const slope = Math.abs(b.y-a.y)/ab.length();
    if (slope > maxSlope) maxSlope = slope;
  }
  // self intersection check on 2D segments with index distance > 40
  let inter = 0;
  const seg = (i) => [pts[i], pts[(i+1)%N]];
  const cross = (p,q,r)=> (q.x-p.x)*(r.z-p.z)-(q.z-p.z)*(r.x-p.x);
  for (let i=0;i<N;i++) for (let j=i+40;j<N;j++) {
    if (i===0 && j>N-40) continue;
    const [a,b]=seg(i),[c,d]=seg(j);
    const dx = Math.hypot(a.x-c.x,a.z-c.z); if (dx>40) continue;
    if (cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0) inter++;
  }
  // min horizontal distance between non-adjacent sections (road overlap)
  let minD = 1e9;
  for (let i=0;i<N;i+=4) for (let j=i+60;j<N;j+=4) {
    if (i<30 && j>N-30) continue;
    const d = Math.hypot(pts[i].x-pts[j].x, pts[i].z-pts[j].z);
    if (d<minD) minD=d;
  }
  console.log(`${t.id}: length=${len.toFixed(0)}m minRadius=${minR.toFixed(1)} at t=${minRt.toFixed(2)} maxSlope=${(maxSlope*100).toFixed(1)}% intersections=${inter} minGap=${minD.toFixed(1)}m`);
}
