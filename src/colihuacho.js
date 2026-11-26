import * as THREE from 'three';

// ============================================================================
// COLIHUACHO — la figura geométrica que te acompaña (en todas las escenas)
//  · Trata de posarse en tu hombro. Si lo lanzas, vuela un poco y vuelve solo (suena muy leve al volver).
//  · Al agarrarlo suena un zumbido suave y se despliega el panel (en Monte Verde: la clase).
//  · En la clase recorrida te guía hasta cada parada.
// ============================================================================
export function createCompanion(app) {
  const g = new THREE.Group(); g.name = 'Colihuacho';
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0), new THREE.MeshStandardMaterial({ color: 0x35f0c0, emissive: 0x1fbf9a, emissiveIntensity: 1.0, flatShading: true, roughness: 0.35 }));
  const edge = (geo, color, op) => new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
  const shellA = edge(new THREE.OctahedronGeometry(0.105), 0xbff8ff, 0.9), shellB = edge(new THREE.DodecahedronGeometry(0.15), 0x9fffd8, 0.4);
  const sats = [0, 1, 2].map((i) => { const m = new THREE.Mesh(new THREE.TetrahedronGeometry(0.02), new THREE.MeshBasicMaterial({ color: [0xffd27a, 0xff8ad8, 0x8ad0ff][i], toneMapped: false })); g.add(m); return m; });
  const glowCv = document.createElement('canvas'); glowCv.width = glowCv.height = 64; { const x = glowCv.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCv), color: 0x6ff0c8, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6, fog: false })); glow.scale.setScalar(0.5);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.userData.comp = true;
  g.add(core, shellA, shellB, glow, hit);

  const S = { mode: 'perch', vel: new THREE.Vector3(), freeT: 0, holder: null, hist: [], lead: null, hum: null, audio: null, sceneRef: null, wait: 0 };
  const tmp = new THREE.Vector3(), perch = new THREE.Vector3(), rgt = new THREE.Vector3();
  const rc = new THREE.Raycaster();

  function stopHum() { if (S.hum) { try { S.hum.stop(); } catch { /* ya parado */ } g.remove(S.hum); S.hum = null; } }
  const api = {
    group: g, state: S,
    get held() { return S.mode === 'held'; },
    attach(scene) { S.sceneRef = scene; scene.add(g); },
    setAudio(a) { stopHum(); S.audio = a; },
    pickRay(rcIn) { const h = rcIn.intersectObject(hit, false)[0]; return h ? h.distance : -1; },
    grab(ctrl) {
      if (S.mode === 'held') return;
      S.mode = 'held'; S.holder = ctrl; S.hist.length = 0; S.vel.set(0, 0, 0); ctrl.attach(g);
      g.position.set(0, 0.02, -0.25); g.quaternion.identity();
      if (S.audio && S.audio.started) { S.hum = S.audio.loopAt(g, 'zumbido', 0.5, 0.8); }
      app.onCompanionGrab && app.onCompanionGrab();
    },
    release() {
      if (S.mode !== 'held') return;
      const v = new THREE.Vector3(); if (S.hist.length > 1) { const a = S.hist[0], z = S.hist[S.hist.length - 1], sp = z.t - a.t; if (sp > 0.02) v.copy(z.p).sub(a.p).multiplyScalar(0.9 / sp); }
      S.sceneRef.attach(g); S.vel.copy(v).clampLength(0, 5); S.mode = 'free'; S.freeT = 0; S.holder = null; stopHum();
      app.onCompanionRelease && app.onCompanionRelease();
    },
    /** Lo manda a esperar sobre un punto (guía de la clase). */
    lead(p) { S.lead = p.clone(); if (S.mode === 'perch' || S.mode === 'free') S.mode = 'lead'; },
    unlead() { S.lead = null; if (S.mode === 'lead') { S.mode = 'free'; S.freeT = 0.7; } },
    update(dt, camPos, camDir, t) {
      rgt.set(-camDir.z, 0, camDir.x).normalize();
      perch.copy(camPos).addScaledVector(rgt, 0.3).addScaledVector(camDir, -0.04); perch.y -= 0.13;
      perch.y += Math.sin(t * 1.7) * 0.012; perch.x += Math.sin(t * 1.1) * 0.01;
      if (S.mode === 'perch') { g.position.lerp(perch, 1 - Math.exp(-7 * dt)); }
      else if (S.mode === 'free') {
        S.freeT += dt; S.vel.multiplyScalar(Math.exp(-0.9 * dt));
        if (S.freeT > 0.7) { tmp.copy(perch).sub(g.position); const d = tmp.length(); S.vel.addScaledVector(tmp.normalize(), (3.5 + d * 2.5) * dt); S.vel.clampLength(0, 6); if (d < 0.16 && S.freeT > 0.9) { S.mode = 'perch'; try { S.audio && S.audio.started && S.audio.sfx('volver', g.getWorldPosition(new THREE.Vector3()), 0.5); } catch { /* sin audio */ } } }
        g.position.addScaledVector(S.vel, dt);
      } else if (S.mode === 'lead' && S.lead) {
        tmp.copy(S.lead); tmp.y += Math.sin(t * 1.3) * 0.06; const d = tmp.distanceTo(g.position), far = camPos.distanceTo(tmp) > 14;
        if (!far) g.position.addScaledVector(tmp.sub(g.position), Math.min(1, dt * 1.6 * Math.min(1.5, 0.35 + d * 0.25)));
      } else if (S.mode === 'held') {
        const p = g.getWorldPosition(new THREE.Vector3()); S.hist.push({ t: performance.now() / 1000, p }); while (S.hist.length > 2 && performance.now() / 1000 - S.hist[0].t > 0.12) S.hist.shift();
        if (S.hum) S.hum.setVolume(0.45 * (app.aud.efectos ?? 1) * (app.aud.master ?? 1) * (0.85 + 0.15 * Math.sin(t * 2)));
      }
      // vida propia: gira, respira, satélites
      shellA.rotation.set(t * 0.9, t * 0.6, 0); shellB.rotation.set(-t * 0.5, t * 0.7, t * 0.3); core.rotation.set(t * 1.2, t * 0.8, 0);
      const pulse = 1 + Math.sin(t * 3.2) * 0.08 + (app.narr && app.narr.state.playing ? Math.abs(Math.sin(t * 7)) * 0.18 : 0); core.scale.setScalar(pulse); glow.material.opacity = 0.45 + (pulse - 1) * 1.2;
      sats.forEach((m, i) => { const a = t * (1.4 + i * 0.5) + i * 2.1, r = 0.16 + i * 0.02; m.position.set(Math.cos(a) * r, Math.sin(a * 1.3) * 0.07, Math.sin(a) * r); m.rotation.set(a, a * 2, 0); });
    },
  };
  return api;
}
