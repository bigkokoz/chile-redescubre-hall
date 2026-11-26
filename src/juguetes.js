import * as THREE from 'three';

// Física simple para objetos agarrables: esferas contra cajas (AABB) + piso.
// Todo se simula en el espacio LOCAL de la "estación" (x = Blender x, y = Blender z, z = -Blender y),
// así funciona igual a escala real (VR) o en miniatura sobre tu mesa (AR).

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const bx = (x0, x1, y0, y1, z0, z1) => ({ min: V(x0, y0, z0), max: V(x1, y1, z1) });
const UP = V(0, 1, 0);
const G = 9.8;
const DT = 1 / 120;

const SOLIDS = [
  // escritorio y lo que tiene encima
  // tapa del escritorio (en U, medida del modelo): franjas de 10 cm
  bx(-0.05, 0.05, 0.6, 0.8, -2.35, -2.25), bx(-0.65, 0.65, 0.6, 0.8, -2.25, -2.15), bx(-0.95, 0.95, 0.6, 0.8, -2.15, -2.05), bx(-1.15, 1.15, 0.6, 0.8, -2.05, -1.95), bx(-1.35, 1.35, 0.6, 0.8, -1.95, -1.85), bx(-1.45, 1.45, 0.6, 0.8, -1.85, -1.75), bx(-1.65, 1.65, 0.6, 0.8, -1.75, -1.65), bx(-1.75, 1.75, 0.6, 0.8, -1.65, -1.55), bx(-1.85, 1.85, 0.6, 0.8, -1.55, -1.45), bx(-1.95, 1.95, 0.6, 0.8, -1.45, -1.35), bx(-1.95, -0.35, 0.6, 0.8, -1.35, -1.25), bx(0.35, 1.95, 0.6, 0.8, -1.35, -1.25), bx(-1.75, -0.65, 0.6, 0.8, -1.25, -1.15), bx(0.65, 1.75, 0.6, 0.8, -1.25, -1.15), bx(-1.65, -0.85, 0.6, 0.8, -1.15, -1.05), bx(0.85, 1.65, 0.6, 0.8, -1.15, -1.05), bx(-1.55, -0.95, 0.6, 0.8, -1.05, -0.95), bx(0.95, 1.55, 0.6, 0.8, -1.05, -0.95), bx(-1.45, -1.05, 0.6, 0.8, -0.95, -0.85), bx(1.05, 1.45, 0.6, 0.8, -0.95, -0.85), bx(-1.25, -1.15, 0.6, 0.8, -0.85, -0.75), bx(1.15, 1.25, 0.6, 0.8, -0.85, -0.75),
  bx(-1.94, -1.01, 0, 0.8, -1.64, -0.81),            // pedestal izq
  bx(1.01, 1.94, 0, 0.8, -1.64, -0.81),              // pedestal der
  bx(-0.23, 0.23, 0.78, 0.93, -1.87, -1.57),         // computador
  bx(-0.79, 0.79, 0.8, 1.36, -2.08, -1.81),          // pantalla central
  bx(-1.5, -0.73, 0.89, 1.27, -1.74, -1.16),         // pantalla izq
  bx(0.73, 1.5, 0.89, 1.27, -1.74, -1.16),           // pantalla der
  bx(-1.05, -0.4, 0.76, 0.89, -1.62, -1.23),         // rack de discos
  // living
  bx(-1.3, 1.3, 0, 0.56, 1.55, 2.45), bx(-1.25, 1.25, 0, 1.03, 2.29, 2.47),   // sofá
  bx(-0.55, 0.55, 0, 0.44, 0.3, 1.4),                // mesa de centro
  bx(-2.1, -1.5, 0, 0.43, 0.2, 0.8),                 // pouf
  bx(1.9, 2.8, 0, 0.56, 0.2, 1.2),                   // sillón
  bx(-2.07, -1.63, 0, 0.3, 1.73, 2.17),              // mesita
  // paredes, techo, ventanal
  bx(-3.6, 3.6, 0, 3.2, 2.5, 2.9),                   // muro fondo
  bx(-3.6, -3.2, 0, 3.2, -3.0, 2.9), bx(3.2, 3.6, 0, 3.2, -3.0, 2.9),   // muros laterales
  bx(-3.6, 3.6, 2.8, 3.2, -3.0, 2.9),                // cielo
  bx(-3.2, -0.84, 0, 2.9, -3.1, -2.95), bx(0.84, 3.2, 0, 2.9, -3.1, -2.95),   // vidrios del ventanal
  bx(-3.6, 3.6, 2.7, 3.2, -3.1, -2.95),              // dintel
  // terraza
  bx(-0.35, 0.35, 0, 0.47, -5.25, -4.55),            // mesa
  bx(-1.95, -1.25, 0, 0.4, -5.7, -4.1), bx(1.25, 1.95, 0, 0.4, -5.7, -4.1),   // reposeras
  bx(-3.4, -1.8, 0, 0.53, -6.38, -6.02), bx(-0.8, 0.8, 0, 0.53, -6.38, -6.02), bx(1.8, 3.4, 0, 0.53, -6.38, -6.02),
  bx(-3.9, 3.9, 0, 1.05, -6.6, -6.4),                // baranda frontal
  bx(-3.95, -3.75, 0, 1.05, -6.6, -3.0), bx(3.75, 3.95, 0, 1.05, -6.6, -3.0), // barandas laterales
];

const onFloor = (x, z) => z > -6.5 && z < 2.6 && Math.abs(x) < (z > -3.0 ? 3.3 : 3.8);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const tmpN = new THREE.Vector3(), tmpD = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion();
const tmpE = new THREE.Euler();

export function makeCup(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.0, side: THREE.DoubleSide });
  g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.032, 0.09, 20, 1, true), mat), { name: 'Taza::Cuerpo' }));
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.032, 20), mat); base.rotation.x = Math.PI / 2; base.position.y = -0.045; g.add(base);
  const cafe = new THREE.Mesh(new THREE.CircleGeometry(0.039, 20), new THREE.MeshStandardMaterial({ color: 0x2a1608, roughness: 0.2 }));
  cafe.rotation.x = -Math.PI / 2; cafe.position.y = 0.032; g.add(cafe);
  const asa = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0065, 8, 16, Math.PI), mat);
  asa.position.set(0.045, 0, 0); asa.rotation.z = -Math.PI / 2; g.add(asa);
  g.traverse((o) => { o.castShadow = false; });
  return g;
}
export function makeBall(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: 0.18 });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 18, 14), mat));
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.0405, 0.0045, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  band.rotation.x = Math.PI / 2; g.add(band);
  return g;
}
export function makeOrb() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  g.add(core, halo);
  g.userData.parts = [core.material, halo.material];
  return g;
}

export function createToys({ casa = null, audio, parent: parentOpt = null, solids = null, onFloor: floorFn = null, defaults = true }) {
  const parent = parentOpt || casa.estacion;
  const SOL = solids || SOLIDS;
  const FLOOR = floorFn || onFloor;
  const discList = casa ? casa.discs : [];
  const all = [];          // juguetes
  const frags = [];        // pedazos que se rompen
  const shardGeo = new THREE.TetrahedronGeometry(0.028);
  const dropGeo = new THREE.SphereGeometry(0.0085, 6, 5);
  const dropMat = new THREE.MeshBasicMaterial({ color: 0x3a1d0a });
  const worldPos = (o) => o.getWorldPosition(new THREE.Vector3());

  function add(kind, obj, home, o = {}) {
    const b = {
      kind, obj, home: home.clone(), vel: V(0, 0, 0), ang: V(0, 0, 0),
      r: o.r ?? 0.04, e: o.e ?? 0.4, g: o.g ?? G, drag: o.drag ?? 0.05, roll: o.roll ?? 5,
      upright: o.upright || null, color: o.color, state: 'free', sleep: true,
      hover: 0, pop: 1, respawn: 0, lastSnd: 0, idle: 0, hist: [],
    };
    obj.position.copy(home); parent.add(obj);
    obj.traverse((m) => { if (m.isMesh) m.userData.toy = b; });
    all.push(b);
    return b;
  }

  // ---- los juguetes ----
  if (defaults) {
  [0xf2ead8, 0xc4623a, 0x2f8f8a].forEach((c, i) => {
    add('taza', makeCup(c), V([1.12, 1.34, 1.24][i], 0.845, [-1.1, -1.12, -1.0][i]), { r: 0.046, e: 0.25, upright: 'yaw', color: c, roll: 7 });
  });
  [0xff5a3c, 0xffd23c, 0x3cb6ff].forEach((c, i) => {
    add('pelota', makeBall(c), V([-1.14, -1.32, -1.24][i], 0.84, [-1.1, -1.1, -1.0][i]), { r: 0.04, e: 0.78, roll: 0.5, color: c });
  });
  [[-1.55, 1.2, -1.25], [1.6, 1.25, -1.25], [0.0, 1.75, -1.6]].forEach((p) => {
    add('orbe', makeOrb(), V(...p), { r: 0.06, e: 0.9, g: 0, drag: 0.7, roll: 0.5 });
  });
  }

  // ---- sonido / efectos ----
  const sfx = (kind, b, vol = 1) => { try { audio.sfx(kind, worldPos(b.obj || b), vol); } catch { /* sin audio aún */ } };

  function burst(pos, vel, color) {
    const mat = frags.cache?.[color] || (frags.cache = frags.cache || {}, frags.cache[color] = new THREE.MeshStandardMaterial({ color, roughness: 0.4, side: THREE.DoubleSide }));
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(shardGeo, mat);
      m.scale.set(0.6 + Math.random() * 1.2, 0.3 + Math.random() * 0.7, 0.6 + Math.random() * 1.2);
      parent.add(m); m.position.copy(pos);
      const v = V(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(1.0 + Math.random() * 1.6).addScaledVector(vel, 0.3);
      frags.push({ obj: m, vel: v, ang: V((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20), r: 0.012, e: 0.35, g: G, drag: 0.1, roll: 6, life: 4.5 + Math.random() * 1.5, t: 0, sleep: false, kind: 'trozo', hist: [] });
    }
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(dropGeo, dropMat);
      parent.add(m); m.position.copy(pos);
      const v = V(Math.random() - 0.5, Math.random() * 0.8 + 0.3, Math.random() - 0.5).normalize().multiplyScalar(0.7 + Math.random() * 1.1).addScaledVector(vel, 0.4);
      frags.push({ obj: m, vel: v, ang: V(0, 0, 0), r: 0.008, e: 0.1, g: G, drag: 0.3, roll: 9, life: 1.6 + Math.random(), t: 0, sleep: false, kind: 'gota', hist: [] });
    }
  }

  function shatter(b) {
    const pos = b.obj.position.clone();
    burst(pos, b.vel, b.color);
    sfx('crash', b, 1);
    b.state = 'dead'; b.obj.visible = false; b.respawn = 2.4; b.vel.set(0, 0, 0);
  }

  function reset(b) {
    b.state = 'free'; b.sleep = true; b.vel.set(0, 0, 0); b.ang.set(0, 0, 0); b.idle = 0;
    b.obj.position.copy(b.home); b.obj.quaternion.identity(); b.obj.visible = true; b.pop = 0;
    sfx('pop', b, 0.7);
  }

  // ---- física ----
  function contact(b, n, depth) {
    const p = b.obj.position, v = b.vel;
    p.addScaledVector(n, depth);
    const vn = v.dot(n);
    if (vn < 0) {
      const e = -vn < 0.7 ? 0 : b.e;
      v.addScaledVector(n, -(1 + e) * vn);
      tmpD.copy(v).addScaledVector(n, -v.dot(n));
      v.addScaledVector(tmpD, -0.08);
      b.impact = Math.max(b.impact || 0, -vn);
    }
    if (n.y > 0.6) b.ground = true;
  }

  function collide(b) {
    const p = b.obj.position, r = b.r;
    if (p.y - r < 0 && p.y > -0.4 && FLOOR(p.x, p.z)) contact(b, UP, r - p.y);
    for (let i = 0; i < SOL.length; i++) {
      const s = SOL[i];
      if (p.x + r < s.min.x || p.x - r > s.max.x || p.y + r < s.min.y || p.y - r > s.max.y || p.z + r < s.min.z || p.z - r > s.max.z) continue;
      tmpC.set(clamp(p.x, s.min.x, s.max.x), clamp(p.y, s.min.y, s.max.y), clamp(p.z, s.min.z, s.max.z));
      tmpD.copy(p).sub(tmpC);
      const l2 = tmpD.lengthSq();
      if (l2 >= r * r) continue;
      if (l2 > 1e-10) { const l = Math.sqrt(l2); tmpN.copy(tmpD).multiplyScalar(1 / l); contact(b, tmpN, r - l); }
      else {
        // el centro quedó dentro: salir por la cara más cercana
        const d = [p.x - s.min.x, s.max.x - p.x, p.y - s.min.y, s.max.y - p.y, p.z - s.min.z, s.max.z - p.z];
        let k = 0; for (let j = 1; j < 6; j++) if (d[j] < d[k]) k = j;
        tmpN.set(0, 0, 0); tmpN.setComponent(k >> 1, k % 2 === 0 ? -1 : 1); contact(b, tmpN, d[k] + r);
      }
    }
  }

  function settle(b, dt) {
    if (!b.upright || b.vel.lengthSq() > 4) return;
    tmpE.setFromQuaternion(b.obj.quaternion, 'YXZ');
    if (b.upright === 'yaw') tmpQ.setFromEuler(tmpE.set(0, tmpE.y, 0, 'YXZ'));
    else { tmpQ.setFromAxisAngle(UP, b.yaw0 || 0).multiply(b.flat); }
    b.obj.quaternion.slerp(tmpQ, 1 - Math.exp(-10 * dt));
  }

  function step(b, dt) {
    if (b.sleep) return;
    b.vel.y -= b.g * dt;
    b.vel.multiplyScalar(Math.exp(-b.drag * dt));
    if (b.kind === 'orbe') { const t = performance.now() * 0.001; b.vel.x += Math.sin(t * 0.7 + b.home.x * 3) * 0.05 * dt; b.vel.y += Math.cos(t * 0.5 + b.home.x) * 0.05 * dt; }
    b.obj.position.addScaledVector(b.vel, dt);
    b.ground = false; b.impact = 0;
    collide(b);
    if (b.ground) {
      const k = Math.exp(-b.roll * dt); b.vel.x *= k; b.vel.z *= k;
      if (b.kind === 'pelota') b.ang.set(b.vel.z, 0, -b.vel.x).multiplyScalar(1 / b.r); else b.ang.multiplyScalar(Math.exp(-6 * dt));
      settle(b, dt);
    } else b.ang.multiplyScalar(Math.exp(-0.2 * dt));
    const w = b.ang.length();
    if (w > 1e-4) { tmpQ2.setFromAxisAngle(tmpN.copy(b.ang).multiplyScalar(1 / w), w * dt); b.obj.quaternion.premultiply(tmpQ2); }
    if (b.ground && b.vel.lengthSq() < 0.0016 && b.ang.lengthSq() < 0.1 && b.kind !== 'orbe') { b.vel.set(0, 0, 0); b.ang.set(0, 0, 0); b.sleep = true; }
    if (b.impact > 0.6) onImpact(b);
  }

  function onImpact(b) {
    const now = performance.now();
    if (b.kind === 'taza' && b.impact > 2.3) { shatter(b); return; }
    if (b.kind === 'trozo' || b.kind === 'gota') return;
    if (now - b.lastSnd < 90) return;
    b.lastSnd = now;
    const vol = Math.min(1, b.impact / 5);
    if (b.kind === 'pelota') sfx('bounce', b, 0.4 + vol);
    else if (b.kind === 'orbe') sfx('pop', b, 0.3 + vol * 0.5);
    else if (b.kind === 'disc') sfx('clink', b, 0.5 + vol);
    else sfx('clink', b, 0.4 + vol);
  }

  // ---- discos lanzados (los administra casa.js, la física es de acá) ----
  function discBody(d) {
    if (d.body && d.body.vel === d.vel) return d.body;
    const flat = d.homeQuat.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -Math.PI / 2));
    d.body = { kind: 'disc', obj: d.holder, vel: d.vel, ang: d.ang, r: 0.05, e: 0.4, g: G, drag: 0.05, roll: 6, upright: 'flat', flat, yaw0: Math.random() * 6.28, sleep: false, hist: [], disc: d };
    return d.body;
  }

  // ---- agarre ----
  const held = new Map();                 // Object3D -> historial
  const track = (obj) => held.set(obj, []);
  function untrack(obj) {
    const h = held.get(obj); held.delete(obj);
    const v = V(0, 0, 0);
    if (h && h.length > 1) {
      const a = h[0], z = h[h.length - 1], span = z.t - a.t;
      if (span > 0.02) {
        const vw = z.p.clone().sub(a.p).multiplyScalar(1 / span);
        const l0 = parent.worldToLocal(z.p.clone()), l1 = parent.worldToLocal(z.p.clone().add(vw));
        v.copy(l1).sub(l0);
        if (v.length() > 11) v.setLength(11);
      }
    }
    return v;
  }

  const api = {
    all, add, reset,
    pickables: () => all.filter((b) => b.state === 'free' && b.obj.visible && b.pop >= 0.95).flatMap((b) => { const ms = []; b.obj.traverse((m) => { if (m.isMesh) ms.push(m); }); return ms; }),
    track, untrack,
    grab(b, hand) {
      b.state = 'held'; b.sleep = false; b.vel.set(0, 0, 0); b.ang.set(0, 0, 0);
      hand.attach(b.obj); track(b.obj);
    },
    release(b) {
      const v = untrack(b.obj);
      parent.attach(b.obj);
      b.state = 'free'; b.sleep = false; b.vel.copy(v);
      b.ang.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
      if (b.kind === 'pelota') b.ang.set(0, 0, 0);
      b.idle = 0;
    },
    resetAll() { all.forEach((b) => { if (b.state !== 'held') reset(b); }); },
    setOrbColor(c) { all.forEach((b) => { if (b.kind === 'orbe') b.obj.userData.parts.forEach((m) => m.color.copy(c)); }); },
    hoverSet: new Set(),

    update(dt, themeState) {
      // historial de objetos en la mano
      const now = performance.now() / 1000;
      for (const [obj, h] of held) {
        h.push({ t: now, p: worldPos(obj) });
        while (h.length > 2 && now - h[0].t > 0.12) h.shift();
      }
      // juguetes
      accum += dt;
      let n = 0;
      while (accum >= DT && n++ < 8) {
        accum -= DT;
        for (const b of all) if (b.state === 'free') step(b, DT);
        discList.forEach((d) => { if (d.state === 'free') step(discBody(d), DT); });
        for (let i = frags.length - 1; i >= 0; i--) { const f = frags[i]; if (!f.sleep) step(f, DT); }
      }
      if (n >= 8) accum = 0;
      // casa de los juguetes
      for (const b of all) {
        if (b.state === 'dead') { b.respawn -= dt; if (b.respawn <= 0) reset(b); continue; }
        const p = b.obj.position;
        if (b.state === 'free') {
          if (p.y < -6 || p.lengthSq() > 2500) reset(b);
          if (b.sleep && p.distanceToSquared(b.home) > 0.04) { b.idle += dt; if (b.idle > 35) reset(b); } else b.idle = 0;
        }
        b.hover += ((api.hoverSet.has(b) ? 1 : 0) - b.hover) * Math.min(1, dt * 12);
        b.pop = Math.min(1, b.pop + dt * 3.5);
        const pe = b.pop < 1 ? (1 - Math.pow(1 - b.pop, 3)) * (1 + 0.25 * Math.sin(b.pop * Math.PI)) : 1;
        b.obj.scale.setScalar(pe * (1 + 0.12 * b.hover));
      }
      // discos lanzados: vuelven al rack al tocar el piso (o si se pierden)
      discList.forEach((d) => {
        if (d.state !== 'free') return;
        d.freeT = (d.freeT || 0) + dt;
        const b = discBody(d);
        if (b.ground && b.obj.position.y < 0.12) d.floorT = (d.floorT || 0) + dt;
        const lost = b.obj.position.y < -4 || b.obj.position.lengthSq() > 2500;
        if (d.floorT > 0.7 || lost || d.freeT > 60) { d.floorT = 0; sfx('pop', d.holder, 0.5); casa.sendHome(d); }
      });
      // pedazos
      for (let i = frags.length - 1; i >= 0; i--) {
        const f = frags[i]; f.t += dt;
        const k = f.life - f.t;
        if (k < 0.8) f.obj.scale.setScalar(Math.max(0.001, k / 0.8));
        if (k <= 0) { parent.remove(f.obj); frags.splice(i, 1); }
      }
      if (themeState) api.setOrbColor(themeState.colA);
    },
  };
  let accum = 0;
  return api;
}
