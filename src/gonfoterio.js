import * as THREE from 'three';

// ============================================================================
// GONFOTERIO (Notiomastodon) en 3D: pariente extinto de los elefantes que habitó el sur de Sudamérica.
// Es una figura de formas simples (elipsoides, cilindros), con las patas y la trompa animadas. Adelante = +z.
// ============================================================================
export function makeGonfoterio() {
  const root = new THREE.Group(); root.name = 'Gonfoterio';
  const fur = new THREE.MeshLambertMaterial({ color: 0x6a4a34 }), furD = new THREE.MeshLambertMaterial({ color: 0x45301f }), skin = new THREE.MeshLambertMaterial({ color: 0x7b6552 });
  const ivory = new THREE.MeshLambertMaterial({ color: 0xece0c4 }), dark = new THREE.MeshBasicMaterial({ color: 0x120c08 });
  // elipsoide algo irregular (pelaje)
  const lump = (rx, ry, rz, mat, seed = 1, amp = 0.05) => {
    const g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position; let s = seed;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = 1 + amp * (Math.sin(x * 5 + s) * Math.sin(y * 6 + s * 2) + Math.sin(z * 7 + s * 3) * 0.7); p.setXYZ(i, x * rx * n, y * ry * n, z * rz * n); }
    g.computeVertexNormals(); return new THREE.Mesh(g, mat);
  };
  const at = (m, x, y, z, parent = root) => { m.position.set(x, y, z); parent.add(m); return m; };
  at(lump(0.98, 0.98, 1.7, fur, 1), 0, 1.95, -0.1);                 // cuerpo
  at(lump(0.86, 0.5, 1.5, furD, 2, 0.09), 0, 1.38, -0.05);         // faldón de pelo bajo la panza
  at(lump(0.7, 0.5, 0.7, fur, 3), 0, 2.55, 0.5);                    // lomo
  at(lump(0.58, 0.64, 0.72, fur, 4), 0, 2.12, 1.6);                 // cabeza
  at(lump(0.46, 0.4, 0.5, furD, 5, 0.08), 0, 2.58, 1.5);            // frente alta
  [-1, 1].forEach((s) => {
    at(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), dark), s * 0.5, 2.18, 1.95);   // ojos
    const ear = lump(0.05, 0.3, 0.26, furD, 6); at(ear, s * 0.58, 2.2, 1.2); ear.rotation.z = s * 0.35;   // orejas
  });
  // trompa: cadena de segmentos que se balancean
  const trunk = []; { let parent = new THREE.Group(); parent.position.set(0, 1.95, 2.18); root.add(parent);
    for (let i = 0; i < 8; i++) { const r0 = 0.2 - i * 0.017, r1 = 0.2 - (i + 1) * 0.017, len = 0.3; const seg = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 9, 1).translate(0, -len / 2, 0), i % 2 ? skin : fur); seg.userData.base = i === 0 ? -0.3 : -0.1; parent.add(seg); trunk.push(seg); const nx = new THREE.Group(); nx.position.set(0, -len, 0); seg.add(nx); parent = nx; } }
  // colmillos
  [-1, 1].forEach((s) => { const c = new THREE.CatmullRomCurve3([new THREE.Vector3(s * 0.26, 1.78, 2.05), new THREE.Vector3(s * 0.4, 1.46, 2.6), new THREE.Vector3(s * 0.5, 1.4, 3.15), new THREE.Vector3(s * 0.46, 1.62, 3.6)]); const t = new THREE.Mesh(new THREE.TubeGeometry(c, 14, 0.062, 8), ivory); root.add(t); });
  // patas
  const legs = []; [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], i) => {
    const hip = new THREE.Group(); hip.position.set(sx * 0.6, 1.5, sz * 0.95 - 0.1); root.add(hip);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.27, 1.5, 10).translate(0, -0.75, 0), furD); hip.add(leg);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.34, 0.1, 10).translate(0, -1.5, 0), skin); hip.add(foot);
    legs.push({ hip, ph: (sx * sz > 0) ? 0 : Math.PI });
  });
  // cola
  const tail = new THREE.Group(); tail.position.set(0, 2.5, -1.75); root.add(tail);
  tail.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.9, 6).translate(0, -0.45, 0), furD)); at(lump(0.07, 0.16, 0.07, furD, 7), 0, -0.98, 0, tail);
  let walk = 0;
  return {
    group: root,
    /** t = reloj, speed = m/s (0 = parado) */
    update(t, dt, speed) {
      walk += dt * Math.min(speed, 1.2) * 3.2; const amp = Math.min(1, speed / 0.35) * 0.42;
      legs.forEach((l) => { l.hip.rotation.x = Math.sin(walk + l.ph) * amp; });
      root.children[0].position.y = 1.95 + Math.abs(Math.sin(walk)) * 0.03 * Math.min(1, speed / 0.35);
      trunk.forEach((s, i) => { s.rotation.x = s.userData.base + Math.sin(t * 1.1 - i * 0.55) * (0.05 + i * 0.012) * (1 + Math.min(1, speed)); s.rotation.z = Math.sin(t * 0.7 - i * 0.4) * 0.04 * (i + 1) * 0.25; });
      tail.rotation.x = 0.15 + Math.sin(t * 1.8) * 0.12;
    },
  };
}
