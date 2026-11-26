import * as THREE from 'three';

// Bandadas procedurales: una cruza la sala por la puerta del ventanal, otras pasan lejos por el cielo.
// Color por ambiente: casa = siluetas oscuras, autopoiesis = bioluminiscentes, desierto = cóndores, mar = gaviotas, bosque = bandurrias.
const COLORS = [0x1c2a30, 0x8ffff0, 0x3d2817, 0xf4f6f8, 0x1f3322];

function wingGeo() {
  // ala triangular con raíz en el origen, apunta a +x (se aletea rotando en z)
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, -0.07, 0, 0, 0.1, 0.55, 0.02, 0.06, 0, 0, -0.07, 0.55, 0.02, 0.06, 0, 0, 0.1]), 3));
  g.computeVertexNormals();
  return g;
}

export function createBirds(scene, audio) {
  const root = new THREE.Group(); root.name = 'Pajaros'; scene.add(root);
  const mat = new THREE.MeshBasicMaterial({ color: COLORS[0], side: THREE.DoubleSide, toneMapped: false });
  const bodyGeo = new THREE.ConeGeometry(0.04, 0.3, 6); bodyGeo.rotateX(Math.PI / 2);
  const wGeo = wingGeo();
  const flocks = [];

  function makeBird() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(bodyGeo, mat));
    const L = new THREE.Mesh(wGeo, mat), R = new THREE.Mesh(wGeo, mat); R.scale.x = -1;
    g.add(L, R);
    root.add(g);
    return { g, L, R, phase: Math.random() * 6.28, rate: 9 + Math.random() * 3 };
  }

  function spawn(points, { n = 5, speed = 4.5, scale = 1.4, chirp = false } = {}) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    const birds = [...Array(n)].map((_, i) => ({ ...makeBird(), off: new THREE.Vector3((i - (n - 1) / 2) * 0.55 * scale, (Math.random() - 0.5) * 0.25 * scale, Math.abs(i - (n - 1) / 2) * 0.55 * scale) }));
    flocks.push({ curve, len: curve.getLength(), speed, t: 0, scale, birds, chirp, chirpT: 0.5 });
  }

  const rnd = (a, b) => a + Math.random() * (b - a);
  function roomFlock() {
    const s = Math.random() < 0.5 ? 1 : -1;
    spawn([
      new THREE.Vector3(s * 14, 5.5, -48), new THREE.Vector3(s * 3, 2.7, -12), new THREE.Vector3(s * 0.5, 2.2, -3.6),
      new THREE.Vector3(-s * 1.2, 2.3, -0.4), new THREE.Vector3(-s * 1.8, 2.1, 1.6), new THREE.Vector3(s * 0.2, 2.35, 1.9),
      new THREE.Vector3(s * 0.7, 2.1, -1.2), new THREE.Vector3(0, 1.9, -3.6), new THREE.Vector3(-s * 5, 3.4, -14), new THREE.Vector3(-s * 20, 8, -50),
    ], { n: 5, speed: 3.6, scale: 0.55, chirp: true });
  }
  function farFlock() {
    const dir = Math.random() < 0.5 ? 1 : -1, d = rnd(45, 90), y = rnd(14, 38);
    const a = rnd(-0.9, 0.9);   // rumbo
    const pts = [-1, -0.5, 0, 0.5, 1].map((k) => new THREE.Vector3(Math.sin(a + k * 0.6 * dir) * d, y + k * 4 + Math.sin(k * 3) * 2, -Math.cos(a + k * 0.6 * dir) * d));
    spawn(pts, { n: Math.floor(rnd(5, 9)), speed: rnd(7, 11), scale: 5 });
  }

  let tRoom = 4, tFar = 1.5, vis = true;
  const tmp = new THREE.Vector3(), tan = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3();
  const cc = new THREE.Color();
  return {
    root,
    trigger() { roomFlock(); farFlock(); },
    setVisible(v) { vis = v; root.visible = v; },
    update(dt, themeIndex, camPos) {
      cc.setHex(COLORS[themeIndex] ?? COLORS[0]); mat.color.lerp(cc, Math.min(1, dt * 2.5));
      if (!vis) return;
      tRoom -= dt; tFar -= dt;
      if (tRoom <= 0) { roomFlock(); tRoom = rnd(26, 42); }
      if (tFar <= 0) { farFlock(); tFar = rnd(12, 20); }
      for (let i = flocks.length - 1; i >= 0; i--) {
        const f = flocks[i]; f.t += dt;
        const u = (f.t * f.speed) / f.len;
        if (u >= 1) { f.birds.forEach((b) => root.remove(b.g)); flocks.splice(i, 1); continue; }
        f.curve.getPointAt(u, pos); f.curve.getTangentAt(u, tan);
        side.crossVectors(up, tan).normalize();
        f.birds.forEach((b) => {
          tmp.copy(pos).addScaledVector(side, b.off.x).addScaledVector(up, b.off.y).addScaledVector(tan, -b.off.z);
          b.g.position.copy(tmp);
          b.g.scale.setScalar(f.scale);
          b.g.lookAt(tmp.x + tan.x, tmp.y + tan.y, tmp.z + tan.z);
          const fl = Math.sin(f.t * b.rate + b.phase) * 0.75;
          b.L.rotation.z = fl; b.R.rotation.z = -fl;
        });
        if (f.chirp) {
          f.chirpT -= dt;
          if (f.chirpT <= 0 && pos.distanceTo(camPos) < 12) { f.chirpT = rnd(0.5, 1.3); try { audio.sfx('chirp', pos.clone(), 0.5); } catch { /* sin audio */ } }
        }
      }
    },
  };
}
