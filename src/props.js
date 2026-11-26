import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './papel.js';

// ============================================================================
// ROCAS Y TRONCOS CON MUSGO — recursos 3D generados por código (sin descargas)
//  · Roca: esfera deformada con ruido, aplastada abajo, color de piedra con liquen y musgo en las caras que miran al cielo.
//  · Tronco caído: cilindro con corteza (relieve y vetas), un extremo cortado con anillos y otro astillado, muñones de ramas y musgo encima.
// Instanciados (pocos objetos distintos, muchas copias) para que el Quest 2 los aguante.
// ============================================================================

const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = (t) => t * t * (3 - 2 * t), a = u(xf), b = u(yf), c = u(zf), L = (p, q, t) => p + (q - p) * t;
  const h = (i, j, k) => hash(xi + i, yi + j, zi + k);
  return L(L(L(h(0, 0, 0), h(1, 0, 0), a), L(h(0, 1, 0), h(1, 1, 0), a), b), L(L(h(0, 0, 1), h(1, 0, 1), a), L(h(0, 1, 1), h(1, 1, 1), a), b), c);
}
const fbm = (x, y, z) => vnoise(x, y, z) * 0.55 + vnoise(x * 2.1, y * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3, z * 4.3) * 0.15;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const MOSS = [new THREE.Color('#5f9a34'), new THREE.Color('#7fb843'), new THREE.Color('#4a7d2a'), new THREE.Color('#98c957')];

export function makeRock(seed, mossy = 0.6) {
  const r = rng(seed), g = new THREE.IcosahedronGeometry(1, 5), p = g.attributes.position, off = r() * 50;
  const sx = 0.8 + r() * 0.7, sy = 0.5 + r() * 0.5, sz = 0.8 + r() * 0.7;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = fbm(x * 1.5 + off, y * 1.5 + off, z * 1.5 + off), k = 0.7 + n * 0.75;
    const ridge = Math.abs(vnoise(x * 3 + off, y * 3, z * 3) - 0.5) * 0.25;   // grietas
    x *= k - ridge; y *= (k - ridge) * (y < 0 ? 0.45 : 1); z *= k - ridge;
    p.setXYZ(i, x * sx, y * sy, z * sz);
  }
  const ng = g.toNonIndexed(); ng.computeVertexNormals();
  const pos = ng.attributes.position, nor = ng.attributes.normal, col = new Float32Array(pos.count * 3), base = new THREE.Color().setHSL(0.08 + r() * 0.07, 0.06 + r() * 0.06, 0.38 + r() * 0.14), c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {       // un color por cara (aspecto facetado de piedra)
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3, cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const ny = (nor.getY(i) + nor.getY(i + 1) + nor.getY(i + 2)) / 3, n = fbm(cx * 3 + off, cy * 3, cz * 3);
    c.copy(base).multiplyScalar(0.8 + n * 0.5);
    const lichen = smooth(0.72, 0.8, vnoise(cx * 7 + off, cy * 7, cz * 7)); if (lichen > 0) c.lerp(new THREE.Color(r() < 0.5 ? '#c9c19a' : '#a8b08a'), lichen * 0.5);
    const m = smooth(0.15 - mossy * 0.35, 0.65 - mossy * 0.2, ny + (n - 0.5) * 0.7) * Math.min(1, 0.4 + mossy);
    if (m > 0) c.lerp(MOSS[(n * 4) | 0], m);
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b; }
  }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return ng;
}

export function makeLog(seed, mossy = 0.6) {
  const r = rng(seed), len = 1, rad = 0.5 + r() * 0.12, off = r() * 40;
  const cyl = new THREE.CylinderGeometry(rad * (0.85 + r() * 0.15), rad, len, 16, 10).rotateZ(Math.PI / 2);   // eje en X
  const p = cyl.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, y), rr = Math.hypot(y, z);
    if (rr > 0.001) {
      const bark = 1 + (vnoise(a * 5 + off, x * 3, 0) - 0.5) * 0.22 + Math.sin(a * 9 + off) * 0.04;     // costillas de la corteza
      let k = bark + (fbm(x * 2 + off, a, 0) - 0.5) * 0.12;
      if (x > 0.46) k *= 1 - (hash(a * 3, off, x) * 0.25) * (x - 0.46) * 8;                                // extremo astillado
      p.setY(i, y * k); p.setZ(i, z * k);
      if (x > 0.46 && rr < rad * 0.9) p.setX(i, x + (hash(y * 9, z * 9, off) - 0.5) * 0.09);               // astillas
    }
  }
  const parts = [cyl];
  for (let k = 0; k < 2 + ((r() * 2) | 0); k++) {                    // muñones de ramas
    const s = new THREE.CylinderGeometry(0.05 + r() * 0.04, 0.09 + r() * 0.04, 0.22 + r() * 0.2, 7); s.translate(0, 0.14, 0);
    s.rotateX(Math.PI / 2 * (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.5)); s.translate(-0.4 + r() * 0.7, 0, 0); parts.push(s);
  }
  const g = mergeGeometries(parts.map((q) => (q.index ? q.toNonIndexed() : q)), false);
  g.computeVertexNormals();
  const pos = g.attributes.position, nor = g.attributes.normal, col = new Float32Array(pos.count * 3), c = new THREE.Color(), bark0 = new THREE.Color('#4a3a28'), bark1 = new THREE.Color('#7a6446'), wood = new THREE.Color('#c8a878');
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3, cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const nx = (nor.getX(i) + nor.getX(i + 1) + nor.getX(i + 2)) / 3, ny = (nor.getY(i) + nor.getY(i + 1) + nor.getY(i + 2)) / 3, n = fbm(cx * 5 + off, cy * 6, cz * 6);
    if (Math.abs(nx) > 0.85 && Math.abs(cx) > 0.45) {                                             // tapa cortada: anillos de crecimiento
      const rr = Math.hypot(cy, cz); c.copy(wood).multiplyScalar(0.85 + 0.25 * Math.sin(rr * 55 + off)); if (cx < 0) c.lerp(new THREE.Color('#6a5a40'), 0.35);
    } else {
      c.copy(bark0).lerp(bark1, n * 1.3); c.multiplyScalar(0.75 + 0.5 * vnoise(cx * 2, cy * 9, cz * 9));
      const m = smooth(0.0 - mossy * 0.2, 0.55 - mossy * 0.15, ny + (n - 0.5) * 0.9) * Math.min(1, 0.3 + mossy); if (m > 0) c.lerp(MOSS[(n * 4) | 0], m);
    }
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = c.r; col[(i + k) * 3 + 1] = c.g; col[(i + k) * 3 + 2] = c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * Reparte rocas y troncos. opts: { scene, reg, avoid(x,z), mossy, rocks, logs, rMin, rMax, bigRocks, place?(rnd)->[x,z], fixedLogs?:[{x,z,rot,len,rad}], seed }
 */
export function scatterProps(o) {
  const { scene, reg, avoid, mossy = 0.6, rocks = 40, logs = 16, rMin = 4, rMax = 40, bigRocks = 5, place = null, fixedLogs = [], seed = 123 } = o;
  const r = rng(seed), rockMat = reg(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: true }), 0.92);
  const out = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), pos = new THREE.Vector3();
  const spot = () => { for (let k = 0; k < 20; k++) { const a = r() * 6.283, rad = rMin + Math.sqrt(r()) * (rMax - rMin); const xz = place ? place(r) : [Math.cos(a) * rad, Math.sin(a) * rad]; if (!avoid || !avoid(xz[0], xz[1])) return xz; } return null; };
  const V = 6, rockGeos = [...Array(V)].map((_, i) => makeRock(seed + i * 17, mossy));
  const per = Math.max(1, Math.ceil(rocks / V)), rockMeshes = rockGeos.map((g) => new THREE.InstancedMesh(g, rockMat, per));
  rockMeshes.forEach((im, vi) => { let n = 0; for (let i = 0; i < per; i++) { const xz = spot(); if (!xz) continue; const big = i < bigRocks / V * 1.0 + 0.5 && r() < 0.5, sz = big ? 0.9 + r() * 1.1 : 0.14 + Math.pow(r(), 2) * 0.7; q.setFromEuler(e.set((r() - 0.5) * 0.4, r() * 6.283, (r() - 0.5) * 0.4)); m.compose(pos.set(xz[0], sz * 0.12, xz[1]), q, s.set(sz, sz * (0.8 + r() * 0.5), sz)); im.setMatrixAt(n++, m); } im.count = n; im.frustumCulled = false; scene.add(im); out.push(im); });
  const logMat = reg(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, fog: true }), 0.92);
  const logGeos = [...Array(4)].map((_, i) => makeLog(seed + 900 + i * 31, mossy)), lper = Math.max(1, Math.ceil((logs + fixedLogs.length) / 4));
  const logMeshes = logGeos.map((g) => new THREE.InstancedMesh(g, logMat, lper)), cnt = [0, 0, 0, 0];
  const putLog = (x, z, rot, len, rad, vi) => { q.setFromEuler(e.set((r() - 0.5) * 0.12, rot, (r() - 0.5) * 0.1)); m.compose(pos.set(x, rad * 0.55, z), q, s.set(len, rad * 2, rad * 2)); logMeshes[vi].setMatrixAt(cnt[vi]++, m); };
  fixedLogs.forEach((f, i) => putLog(f.x, f.z, f.rot, f.len, f.rad, i % 4));
  for (let i = 0; i < logs; i++) { const xz = spot(); if (xz) putLog(xz[0], xz[1], r() * 6.283, 1.6 + r() * 3.2, 0.13 + r() * 0.2, i % 4); }
  logMeshes.forEach((im, vi) => { im.count = cnt[vi]; im.frustumCulled = false; scene.add(im); out.push(im); });
  return out;
}
