import * as THREE from 'three';
import * as P from './papel.js';
import * as M from './papel_mv.js';
import { MV_STOPS } from './mv_data.js';

// ============================================================================
// MONTE VERDE — la villa (interpretación artística con datos publicados)
// Gran carpa de 12 habitaciones, estructura en U con huesos y plantas medicinales, fogones interactivos,
// arroyo, algas, herramientas, gente haciendo cosas y un animal grande cruzando. Paradas con esferas informativas.
// ============================================================================

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildVillage({ scene, world, reg, toys, audio, aud, camera, tint }) {
  const woodMat = reg(new THREE.MeshLambertMaterial({ color: 0x8a6a45, fog: true }), 0.55);
  const darkWood = reg(new THREE.MeshLambertMaterial({ color: 0x5f4a30, fog: true }), 0.55);
  const hideTex = P.toTex(M.hideCanvas(), true);
  const hideMat = reg(new THREE.MeshLambertMaterial({ map: hideTex, side: THREE.DoubleSide, fog: true }), 0.8);
  const ivory = reg(new THREE.MeshLambertMaterial({ color: 0xe8dcc0, fog: true }), 0.7);
  const stoneMat = reg(new THREE.MeshLambertMaterial({ color: 0x8a8d90, fog: true }), 0.6);
  const add = (o) => { world.add(o); return o; };

  // ---- ayudas de geometría ----
  const beam = (a, b, r, mat) => {
    const d = b.clone().sub(a), len = d.length(), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, len, 7), mat);
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); return add(m);
  };
  const quad = (p0, p1, p2, p3, mat, ru, rv) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...p0.toArray(), ...p1.toArray(), ...p2.toArray(), ...p3.toArray()], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, ru, 0, ru, rv, 0, rv], 2)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
    return add(new THREE.Mesh(g, mat));
  };
  const tusk = (pts, r = 0.07) => add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V3(...p))), 20, r, 8), ivory));

  // ---- la gran carpa: 12 habitaciones en 2 hileras de 6 (14 m x 7 m) ----
  const X0 = -7, DX = 14 / 6, ZF = -5.5, ZR = -9, ZB = -12.5, YR = 2.9, YF = 1.5, YB = 0.4;
  for (let i = 0; i <= 6; i++) {
    const x = X0 + i * DX;
    beam(V3(x, 0, ZF), V3(x, YF, ZF), 0.055, woodMat);                 // poste frontal
    beam(V3(x, 0, ZR), V3(x, YR, ZR), 0.06, woodMat);                  // poste central (cumbrera)
    beam(V3(x, YR, ZR), V3(x, YF, ZF), 0.04, darkWood);                // cabrio frontal
    beam(V3(x, YR, ZR), V3(x, YB, ZB), 0.04, darkWood);                // cabrio trasero
  }
  beam(V3(X0, YR, ZR), V3(-X0, YR, ZR), 0.07, woodMat); beam(V3(X0, YF, ZF), V3(-X0, YF, ZF), 0.05, woodMat);
  quad(V3(X0, YF, ZF), V3(-X0, YF, ZF), V3(-X0, YR, ZR), V3(X0, YR, ZR), hideMat, 5, 1.2).name = 'Carpa_techo_frente';
  quad(V3(X0, YR, ZR), V3(-X0, YR, ZR), V3(-X0, YB, ZB), V3(X0, YB, ZB), hideMat, 5, 1.4).name = 'Carpa_techo_fondo';
  // 12 habitaciones: esteras de piso + cortinillas bajas entre algunas
  const mat0 = reg(new THREE.MeshLambertMaterial({ color: 0xb59a68, fog: true }), 0.55);
  const rr = P.rng(31);
  for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
    const cx = X0 + (i + 0.5) * DX, cz = row ? -10.75 : -7.25, mat = new THREE.Mesh(new THREE.PlaneGeometry(DX * 0.78, 2.5).rotateX(-Math.PI / 2), mat0);
    mat.position.set(cx, 0.03, cz); mat.rotation.y = (rr() - 0.5) * 0.08; add(mat);
  }
  for (let i = 1; i < 6; i++) if (i % 2) quad(V3(X0 + i * DX, 0, ZF - 0.2), V3(X0 + i * DX, 0, ZB + 0.4), V3(X0 + i * DX, 1.15, ZB + 0.4), V3(X0 + i * DX, 1.15, ZF - 0.2), hideMat, 2, 0.4);
  // colmillos cruzados a la entrada (recreación: la ficha no dice cómo se usaron)
  tusk([[-1.0, 0, -4.6], [-1.3, 1.1, -4.6], [-0.6, 2.2, -4.6], [0.5, 2.7, -4.6]]); tusk([[1.0, 0, -4.6], [1.3, 1.1, -4.6], [0.6, 2.2, -4.6], [-0.5, 2.7, -4.6]]);

  // ---- estructura en U (oeste) con huesos y hierbas ----
  const uPts = [];
  for (let z = -1.2; z >= -4.8; z -= 0.5) uPts.push([-13.9, z]);
  for (let x = -13.9; x <= -10.4; x += 0.5) { uPts.push([x, -1.2]); uPts.push([x, -4.8]); }
  uPts.forEach(([x, z], i) => beam(V3(x, 0, z), V3(x, 1.25 + (i % 3) * 0.12, z), 0.04, i % 2 ? woodMat : darkWood));
  const gravel = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 3.5).rotateX(-Math.PI / 2), reg(new THREE.MeshLambertMaterial({ color: 0x9a9070, fog: true }), 0.55)); gravel.position.set(-12.1, 0.025, -3.0); add(gravel);
  const rb = P.rng(77);
  for (let i = 0; i < 9; i++) { const b = beam(V3(-13 + rb() * 2.4, 0.05, -2.1 - rb() * 2), V3(-13 + rb() * 2.4, 0.22 + rb() * 0.3, -2.1 - rb() * 2), 0.05 + rb() * 0.04, ivory); b.position.y += 0.02; }
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), ivory); skull.scale.set(1.2, 0.8, 0.9); skull.position.set(-12.4, 0.3, -3.6); add(skull);
  tusk([[-12.9, 0.1, -3.9], [-12.3, 0.6, -4.4], [-11.2, 0.5, -4.5], [-10.7, 0.0, -4.3]], 0.06); tusk([[-12.9, 0.1, -3.3], [-12.4, 0.7, -3.0], [-11.4, 0.6, -2.9], [-10.9, 0.0, -3.0]], 0.06);
  beam(V3(-13.9, 1.9, -1.2), V3(-13.9, 1.9, -4.8), 0.035, woodMat);
  const herb = reg(new THREE.MeshLambertMaterial({ color: 0x4f8a3a, fog: true }), 1);
  for (let i = 0; i < 9; i++) { const z = -1.5 - i * 0.37; beam(V3(-13.9, 1.9, z), V3(-13.9, 1.55, z), 0.008, darkWood); const c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 6).rotateX(Math.PI), herb); c.position.set(-13.9, 1.4, z); add(c); }
  const mort = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.2, 10), stoneMat); mort.position.set(-11.4, 0.12, -1.9); add(mort);

  // ---- fogones (A y B delante de la carpa; C dentro de la U) ----
  const flameTex = P.toTex(M.flameCanvas()), emberGeo = new THREE.BufferGeometry(), emberN = 24;
  const fires = [];
  function makeFire(x, z, interactive) {
    const g = new THREE.Group(); g.position.set(x, 0, z); add(g);
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283, s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12 + (i % 3) * 0.02, 0), stoneMat); s.position.set(Math.cos(a) * 0.42, 0.07, Math.sin(a) * 0.42); s.rotation.set(i, i * 2, 0); g.add(s); }
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.7, 6), darkWood); l.rotation.set(Math.PI / 2, 0, i * 1.05); l.position.y = 0.09; g.add(l); }
    const flames = [0, 1, 2].map((i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: [0xffb050, 0xffd070, 0xff7a30][i], blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false })); s.center.set(0.5, 0.05); g.add(s); return s; });
    const ep = new Float32Array(emberN * 3), seeds = []; for (let i = 0; i < emberN; i++) { ep.set([(Math.random() - 0.5) * 0.4, Math.random() * 1.6, (Math.random() - 0.5) * 0.4], i * 3); seeds.push(Math.random()); }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
    const embers = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0xffa040, size: 0.05, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); embers.frustumCulled = false; g.add(embers);
    const light = new THREE.PointLight(0xff8a3c, 2.0, 9, 1.6); light.position.y = 0.7; g.add(light);
    const f = { g, x, z, energy: 0.7, base: 0.7, flames, embers, ep, seeds, light, interactive, snd: null };
    fires.push(f); return f;
  }
  makeFire(-3.2, -4.4, true); makeFire(3.2, -4.4, true); makeFire(-12.1, -3.0, false);

  // ramitas para alimentar el fuego (objetos que se agarran y se lanzan; al caer en la llama, la avivan)
  const twigMat = new THREE.MeshStandardMaterial({ color: 0x6e5436, roughness: 1 });
  const makeTwig = (len) => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, len, 6), twigMat); m.rotation.x = Math.PI / 2; g.add(m); return g; };
  [[-3.2, -4.4], [3.2, -4.4]].forEach(([fx, fz], k) => { for (let i = 0; i < 6; i++) { const a = i * 1.05 + k, d = 0.9 + (i % 3) * 0.12; const o = makeTwig(0.22 + (i % 3) * 0.06); toys.add('palito', o, V3(fx + Math.cos(a) * d, 0.03, fz + Math.sin(a) * d), { r: 0.025, e: 0.3, roll: 8 }); o.rotation.y = a; } });

  // ---- arroyo (agua que corre) con riberas de grava ----
  const waterTex = P.toTex(M.waterCanvas(), true), CZ = (x) => -17 + 2.2 * Math.sin(x * 0.11);
  const ribbon = (halfW, y, mat, vScale) => {
    const N = 80, pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) { const x = -45 + (i / N) * 90, z = CZ(x), dz = CZ(x + 0.1) - z, nx = -dz, nz = 0.1, l = Math.hypot(nx, nz); pos.push(x + (nx / l) * -halfW, y, z + (nz / l) * -halfW, x + (nx / l) * halfW, y, z + (nz / l) * halfW); uv.push(0, i / N * vScale, 1, i / N * vScale); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return add(new THREE.Mesh(g, mat));
  };
  ribbon(2.3, 0.018, reg(new THREE.MeshBasicMaterial({ color: 0xa89a74, fog: true }), 1), 1).name = 'Riberas';
  waterTex.repeat.set(1, 30); ribbon(1.35, 0.03, new THREE.MeshBasicMaterial({ map: waterTex, fog: true }), 1).name = 'Arroyo';
  const waterMats = [];   // el arroyo no se tiñe con la hora (se ve igual): su luz la da la niebla

  // ---- algas secándose + útiles (hide, raederas, piedras) ----
  beam(V3(5.0, 0, -12.2), V3(5.0, 1.7, -12.2), 0.04, woodMat); beam(V3(6.8, 0, -12.2), V3(6.8, 1.7, -12.2), 0.04, woodMat); beam(V3(4.9, 1.65, -12.2), V3(6.9, 1.65, -12.2), 0.03, woodMat);
  const algaMat = reg(new THREE.MeshLambertMaterial({ color: 0x2f4a2c, fog: true }), 1), algae = [];
  for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.7 + (i % 4) * 0.12, 0.012), algaMat); m.geometry.translate(0, -0.4, 0); m.position.set(5.0 + i * 0.14, 1.64, -12.2); add(m); algae.push(m); }
  beam(V3(5.2, 0, -5.6), V3(6.2, 1.5, -5.1), 0.035, woodMat); beam(V3(7.2, 0, -5.6), V3(6.2, 1.5, -5.1), 0.035, woodMat); beam(V3(5.4, 1.2, -5.55), V3(7.0, 1.2, -5.55), 0.03, woodMat);
  quad(V3(5.35, 0.9, -5.52), V3(7.05, 0.9, -5.52), V3(6.95, 1.45, -5.3), V3(5.45, 1.45, -5.3), hideMat, 1.6, 1);
  const rs = P.rng(5); for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06 + rs() * 0.06, 0), stoneMat); s.position.set(5.6 + rs() * 1.3, 0.06, -4.4 - rs() * 0.9); add(s); }

  // ---- gente haciendo cosas ----
  const cardMat = (canvas, extra = {}) => reg(new THREE.MeshBasicMaterial({ map: P.toTex(canvas), alphaTest: 0.45, side: THREE.DoubleSide, fog: true, ...extra }), 1);
  const people = [];
  function person(x, z, o = {}) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const sc = o.scale || 1, body = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 1.64).translate(0, 0.82, 0), cardMat(M.personCanvas(o.seed || 1, { basket: o.basket })));
    const arm = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.53).translate(0, -0.265, 0), cardMat(M.armCanvas(o.seed || 1, o.tool || 0)));
    arm.position.set(0.1, 1.08, 0.01); g.add(body, arm); g.scale.setScalar(sc); if (o.crouch) g.scale.y = sc * 0.66; add(g);
    people.push({ g, arm, o, x0: x, z0: z, ph: Math.random() * 6, body }); return g;
  }
  person(3.9, -3.5, { seed: 1, crouch: true, act: 'fire' }); person(-4.0, -3.6, { seed: 2, crouch: true, act: 'sit' }); person(-2.4, -3.3, { seed: 9, crouch: true, act: 'sit' });
  person(1.6, -4.6, { seed: 3, act: 'wave' }); person(6.1, -4.1, { seed: 4, crouch: true, tool: 1, act: 'scrape' }); person(-11.3, -1.9, { seed: 5, crouch: true, tool: 1, act: 'grind' });
  person(5.6, -13.0, { seed: 6, basket: true, act: 'walk', path: [[5.6, -13.4], [1.6, -6.4]], speed: 0.55 }); person(4.6, -11.8, { seed: 7, basket: true, act: 'walk', path: [[5.6, -13.4], [1.6, -6.4]], speed: 0.5 });
  person(2.0, -14.0, { seed: 8, scale: 0.62, act: 'sway' }); person(-9.7, -3.0, { seed: 10, act: 'stand' });

  // ---- animal grande que cruza al fondo ----
  const gomp = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 3.6).translate(0, 1.8, 0), cardMat(M.gompCanvas(5)));
  gomp.position.set(-32, 0, -27); add(gomp); let gx = -32, gdir = 1;

  // ---- paradas (esferas informativas) ----
  const glowTex = P.toTex(P.glowCanvas()), stops = [], hitMeshes = [];
  MV_STOPS.forEach((s, i) => {
    const g = new THREE.Group(); g.position.set(...s.pos); add(g);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), new THREE.MeshBasicMaterial({ color: 0x9fffe0, toneMapped: false, fog: false })); g.add(core);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x6ff0c8, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55, fog: false })); halo.scale.setScalar(0.5); g.add(halo);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.userData.stop = i; g.add(hit); hitMeshes.push(hit);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const cx = cv.getContext('2d'); cx.fillStyle = 'rgba(8,14,12,0.78)'; cx.beginPath(); cx.roundRect(4, 4, 504, 120, 30); cx.fill(); cx.fillStyle = '#9fffe0'; cx.font = '700 40px system-ui, sans-serif'; cx.textAlign = 'center'; cx.fillText(`${i + 1}/${MV_STOPS.length}`, 256, 50); cx.fillStyle = '#fff'; cx.font = '600 34px system-ui, sans-serif'; cx.fillText(s.titulo.length > 30 ? s.titulo.slice(0, 29) + '…' : s.titulo, 256, 98);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: P.toTex(cv), transparent: true, depthTest: false, fog: false })); label.scale.set(0.95, 0.24, 1); label.position.y = 0.34; label.renderOrder = 900; g.add(label);
    stops.push({ i, g, core, halo, label, base: new THREE.Vector3(...s.pos), visited: false, data: s });
  });

  const api = {
    stops, fires, people, gomp,
    pickStop(rc) { const h = rc.intersectObjects(hitMeshes, false)[0]; return h ? h.object.userData.stop : -1; },
    markVisited(i) { const s = stops[i]; if (s) { s.visited = true; s.core.material.color.set(0xffd27a); s.halo.material.color.set(0xffb050); } },
    onAudioStart() { fires.forEach((f) => { if (!f.snd) f.snd = audio.loopAt(f.g, 'fuego', 0.5, 2.2); }); },
    update(dt, t, camPos) {
      // fogones: llama, brasas, luz y alimentación con ramitas
      for (const f of fires) {
        f.energy += (f.base - f.energy) * Math.min(1, dt * 0.18);
        if (f.interactive) for (const b of toys.all) {
          if (b.kind !== 'palito' || b.state !== 'free') continue; const p = b.obj.position; const dx = p.x - f.x, dz = p.z - f.z;
          if (dx * dx + dz * dz < 0.28 && p.y < 0.75) { b.state = 'dead'; b.obj.visible = false; b.respawn = 9; f.energy = Math.min(2.2, f.energy + 0.6); try { audio.sfx('pop', f.g.position, 0.4); } catch { /* sin audio */ } }
        }
        const e = f.energy, fl = 1 + Math.sin(t * 13 + f.x) * 0.08 + Math.sin(t * 21 + f.z) * 0.06;
        f.flames.forEach((s, i) => { s.scale.set((0.5 + i * -0.08) * (0.6 + e * 0.5) * fl, (1.0 - i * 0.2) * (0.55 + e * 0.6) * fl, 1); s.material.rotation = Math.sin(t * (8 + i * 3) + i) * 0.08; });
        f.light.intensity = (1.2 + e * 1.3) * (0.9 + Math.sin(t * 17 + f.x) * 0.1);
        for (let i = 0; i < emberN; i++) { let y = f.ep[i * 3 + 1] + dt * (0.5 + f.seeds[i]) * (0.6 + e * 0.5); if (y > 1.8 + e) y = 0.1; f.ep[i * 3 + 1] = y; f.ep[i * 3] += Math.sin(t * 2 + f.seeds[i] * 9) * 0.0016; }
        f.embers.geometry.attributes.position.needsUpdate = true; f.embers.material.opacity = 0.5 + e * 0.3;
        if (f.snd) f.snd.setVolume(Math.min(1, 0.22 + e * 0.12) * (aud.ambiente ?? 1) * (aud.master ?? 1));
      }
      waterTex.offset.y -= dt * 0.35;
      algae.forEach((m, i) => { m.rotation.z = Math.sin(t * 1.3 + i * 0.7) * 0.07; });
      // gente
      for (const p of people) {
        const { g, arm, o } = p, cx = camPos.x - g.position.x, cz = camPos.z - g.position.z; g.rotation.y = Math.atan2(cx, cz);
        const a = o.act; let r = 0;
        if (a === 'fire') r = -1.05 + Math.sin(t * 9 + p.ph) * 0.22; else if (a === 'scrape') r = -1.2 + Math.sin(t * 2.6 + p.ph) * 0.4; else if (a === 'grind') r = -1.3 + Math.sin(t * 3.4 + p.ph) * 0.16;
        else if (a === 'wave') r = 2.5 + Math.sin(t * 3.2) * 0.3; else if (a === 'sway' || a === 'stand') r = Math.sin(t * 1.2 + p.ph) * 0.06; else if (a === 'sit') r = -0.15 + Math.sin(t * 0.8 + p.ph) * 0.05;
        arm.rotation.z = r;
        if (a === 'walk') {
          const [A, B] = o.path, L = Math.hypot(B[0] - A[0], B[1] - A[1]); p.u = ((p.u ?? Math.random()) + (p.dir ?? 1) * o.speed * dt / L); if (p.u > 1) { p.u = 1; p.dir = -1; } else if (p.u < 0) { p.u = 0; p.dir = 1; } p.dir = p.dir ?? 1;
          g.position.set(A[0] + (B[0] - A[0]) * p.u, Math.abs(Math.sin(t * 5 + p.ph)) * 0.035, A[1] + (B[1] - A[1]) * p.u);
        }
      }
      // animal grande
      gx += gdir * 0.55 * dt; if (gx > 34) gdir = -1; else if (gx < -34) gdir = 1;
      gomp.position.x = gx; gomp.position.y = Math.abs(Math.sin(t * 1.2)) * 0.06; gomp.rotation.y = Math.atan2(camPos.x - gx, camPos.z - gomp.position.z) + (gdir < 0 ? Math.PI : 0) * 0;
      gomp.scale.x = gdir; gomp.rotation.z = Math.sin(t * 1.2) * 0.012;
      // paradas: flotan y muestran el nombre al acercarte
      for (const s of stops) {
        s.g.position.y = s.base.y + Math.sin(t * 1.1 + s.i) * 0.05; const d = camPos.distanceTo(s.g.position);
        s.label.material.opacity = THREE.MathUtils.clamp((6 - d) / 2.5, 0, 1); s.halo.scale.setScalar(0.45 + Math.sin(t * 2 + s.i) * 0.06);
      }
    },
  };
  return api;
}
