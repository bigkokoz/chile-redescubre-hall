import * as THREE from 'three';
import { ESCENAS } from './menu.js';

// ============================================================================
// CUERPO + PANEL DE BOLSILLO (VR)
//  - Un cuerpo sencillo bajo tu cabeza (lo ves al mirar hacia abajo) con dos bolsillos en la cadera.
//  - Metes la mano en un bolsillo y aprietas el grip: sacas un panel. Lo sostienes con esa mano y tocas con la otra (gatillo).
//  - Al soltar el grip, el panel flota hacia arriba (gravedad invertida), se desvanece y vuelve al bolsillo.
//  - El panel tiene 3 páginas: Escenas, Movimiento (activar/desactivar cómo te mueves) y Mundo (hora, lluvia, densidad).
// ============================================================================

const W = 1600, H = 820;
const PAGES = ['Escenas', 'Movimiento', 'Mundo'];

export function createBody(controllers) {
  const group = new THREE.Group(); group.name = 'Cuerpo';
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2f8f8a }), pants = new THREE.MeshLambertMaterial({ color: 0x3b4658 }), belt = new THREE.MeshLambertMaterial({ color: 0x5a4228 }), skin = new THREE.MeshLambertMaterial({ color: 0xe8c9a8 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.36, 4, 12), shirt); torso.scale.z = 0.72; torso.position.y = -0.02; group.add(torso);
  const bt = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.014, 6, 24).rotateX(Math.PI / 2), belt); bt.scale.z = 0.75; bt.position.y = -0.3; group.add(bt);
  [-1, 1].forEach((s) => { const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.5, 4, 8), pants); l.position.set(s * 0.085, -0.68, 0); group.add(l); });
  const ringMat = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: 0x35f0c0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
  const rings = [-1, 1].map((s, i) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.065, 0.095, 28).rotateY(Math.PI / 2), ringMat[i]); m.position.set(s * 0.165, -0.28, 0.02); group.add(m); return m; });
  // manos visibles en los controles
  controllers.forEach((c) => {
    const h = new THREE.Group(); h.name = 'Mano';
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), skin); palm.scale.set(1, 0.7, 1.25); h.add(palm);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.05, 10).rotateX(Math.PI / 2), shirt); cuff.position.z = 0.06; h.add(cuff);
    h.position.set(0, 0, 0.04); c.add(h);
  });
  const state = { yaw: 0, init: false };
  const pockets = [new THREE.Vector3(), new THREE.Vector3()];
  const tmpP = new THREE.Vector3();
  return {
    group, pockets,
    update(dt, camPos, camDir) {
      const target = Math.atan2(-camDir.x, -camDir.z);
      if (!state.init) { state.yaw = target; state.init = true; }
      let d = target - state.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); state.yaw += d * Math.min(1, dt * 2.5);
      const a = state.yaw, fwdX = -Math.sin(a), fwdZ = -Math.cos(a), rgtX = Math.cos(a), rgtZ = -Math.sin(a);
      group.rotation.y = a;
      group.position.set(camPos.x + fwdX * -0.2, camPos.y - 0.56, camPos.z + fwdZ * -0.2);
      [-1, 1].forEach((s, i) => pockets[i].set(group.position.x + rgtX * s * 0.18 + fwdX * 0.02, group.position.y - 0.28, group.position.z + rgtZ * s * 0.18 + fwdZ * 0.02));
      let near = [false, false];
      controllers.forEach((c) => { c.getWorldPosition(tmpP); for (let i = 0; i < 2; i++) if (tmpP.distanceTo(pockets[i]) < 0.26) near[i] = true; });
      const tt = performance.now() * 0.004;
      rings.forEach((m, i) => { ringMat[i].opacity = near[i] ? 0.95 : 0.3; m.scale.setScalar(near[i] ? 1.25 + Math.sin(tt) * 0.08 : 1); });
    },
    nearPocket(p, r = 0.26) { return pockets.findIndex((q) => q.distanceTo(p) < r); },
  };
}

export function createPanel(app) {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false, fog: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, H / W), mat); mesh.renderOrder = 1000; mesh.name = 'Panel_bolsillo';
  const imgs = ESCENAS.map((e) => { const im = new Image(); im.onload = () => draw(); im.src = import.meta.env.BASE_URL + e.thumb; return im; });
  let page = 0, hover = -1, els = [], current = '', mode = 'closed', holder = null, sceneRef = null, t = 0, redrawT = 0;
  const vel = new THREE.Vector3(), hist = [];

  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const loco = () => app.loco;
  const ctl = () => app.activeControls && app.activeControls();

  function build() {
    els = [];
    PAGES.forEach((p, i) => els.push({ x: 24 + i * 290, y: 16, w: 270, h: 66, type: 'tab', label: p, active: page === i, onClick: () => { page = i; } }));
    const y0 = 118, rowH = 74, gap = 14, X = 24, RW = W - 48;
    const toggle = (row, label, get, set) => els.push({ x: X, y: y0 + row * (rowH + gap), w: RW, h: rowH, type: 'toggle', label, on: get(), onClick: () => set(!get()) });
    const stepper = (row, label, get, fmt, dec, inc) => { const y = y0 + row * (rowH + gap); els.push({ x: X, y, w: RW, h: rowH, type: 'row', label, value: fmt(get()) }); els.push({ x: W - 420, y: y + 8, w: 100, h: rowH - 16, type: 'btn', label: '−', onClick: dec }); els.push({ x: W - 124, y: y + 8, w: 100, h: rowH - 16, type: 'btn', label: '+', onClick: inc }); };
    const btn = (row, col, cols, label, onClick, active = false) => { const w = (RW - (cols - 1) * 16) / cols; els.push({ x: X + col * (w + 16), y: y0 + row * (rowH + gap), w, h: rowH, type: 'btn', label, onClick, active }); };
    if (page === 0) {
      const n = ESCENAS.length, g = 22, cw = (W - 48 - g * (n - 1)) / n, cy = y0 + 4, ch = H - cy - 26;
      ESCENAS.forEach((e, i) => els.push({ x: 24 + i * (cw + g), y: cy, w: cw, h: ch, type: 'card', scene: e, idx: i, onClick: () => app.selectScene(e.id) }));
    } else if (page === 1) {
      const L = loco();
      toggle(0, 'Caminar con el joystick izquierdo', () => L.joystick, (v) => { L.joystick = v; app.saveLoco(); });
      toggle(1, 'Girar por pasos con el joystick derecho', () => L.snap, (v) => { L.snap = v; app.saveLoco(); });
      toggle(2, 'Arrastrar el mundo (gatillo o grip en el aire)', () => L.grab, (v) => { L.grab = v; app.saveLoco(); });
      stepper(3, 'Velocidad al caminar', () => L.speed, (v) => `${v.toFixed(1)} m/s`, () => { L.speed = Math.max(0.8, +(L.speed - 0.4).toFixed(1)); app.saveLoco(); }, () => { L.speed = Math.min(4, +(L.speed + 0.4).toFixed(1)); app.saveLoco(); });
      stepper(4, 'Fuerza del arrastre', () => L.gain, (v) => `×${v.toFixed(1)}`, () => { L.gain = Math.max(0.8, +(L.gain - 0.4).toFixed(1)); app.saveLoco(); }, () => { L.gain = Math.min(3, +(L.gain + 0.4).toFixed(1)); app.saveLoco(); });
      btn(5, 0, 2, 'Solo movimiento físico (apaga todo)', () => { L.joystick = L.snap = L.grab = false; app.saveLoco(); }, !L.joystick && !L.snap && !L.grab);
      btn(5, 1, 2, 'Activar todo', () => { L.joystick = L.snap = L.grab = true; app.saveLoco(); });
    } else {
      const C = ctl();
      if (!C) els.push({ x: X, y: y0, w: RW, h: rowH * 2, type: 'note', label: 'Esta escena no tiene clima. En la casa usa los discos para cambiar de ambiente.' });
      else {
        const wcol = (RW - 32) / 3;
        C.horas.forEach((nm, i) => els.push({ x: X + i * (wcol + 16), y: y0, w: wcol, h: rowH, type: 'btn', label: nm[0].toUpperCase() + nm.slice(1), active: C.hora() === i, onClick: () => C.setHora(i) }));
        toggle(1, 'Lluvia', () => C.lluvia(), () => C.toggleRain());
        stepper(2, 'Densidad de plantas', () => C.densidad(), (v) => `${Math.round(v * 100)}%`, () => C.setDensidad(Math.max(0.2, +(C.densidad() - 0.2).toFixed(2))), () => C.setDensidad(Math.min(1, +(C.densidad() + 0.2).toFixed(2))));
        stepper(3, 'Niebla', () => C.niebla(), (v) => `×${v.toFixed(1)}`, () => C.setNiebla(Math.max(0.4, +(C.niebla() - 0.2).toFixed(1))), () => C.setNiebla(Math.min(2, +(C.niebla() + 0.2).toFixed(1))));
      }
    }
  }

  function draw() {
    build();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(6,9,14,0.92)'; rr(0, 0, W, H, 36); ctx.fill();
    ctx.strokeStyle = '#35f0c0'; ctx.lineWidth = 4; rr(2, 2, W - 4, H - 4, 34); ctx.stroke();
    els.forEach((e, i) => {
      const hv = hover === i;
      if (e.type === 'tab') { ctx.fillStyle = e.active ? '#35f0c0' : hv ? '#22303c' : '#141c26'; rr(e.x, e.y, e.w, e.h, 18); ctx.fill(); ctx.fillStyle = e.active ? '#04120e' : '#cfd6e4'; ctx.font = '700 34px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(e.label, e.x + e.w / 2, e.y + 45); ctx.textAlign = 'left'; }
      else if (e.type === 'toggle') { ctx.fillStyle = hv ? '#22303c' : '#141c26'; rr(e.x, e.y, e.w, e.h, 18); ctx.fill(); ctx.fillStyle = '#eef2f8'; ctx.font = '600 32px system-ui, sans-serif'; ctx.fillText(e.label, e.x + 26, e.y + 48); ctx.fillStyle = e.on ? '#35f0c0' : '#3a4452'; rr(e.x + e.w - 250, e.y + 12, 226, e.h - 24, 24); ctx.fill(); ctx.fillStyle = e.on ? '#04120e' : '#9aa3b8'; ctx.font = '800 28px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(e.on ? 'ACTIVADO' : 'APAGADO', e.x + e.w - 137, e.y + 47); ctx.textAlign = 'left'; }
      else if (e.type === 'row') { ctx.fillStyle = '#141c26'; rr(e.x, e.y, e.w, e.h, 18); ctx.fill(); ctx.fillStyle = '#eef2f8'; ctx.font = '600 32px system-ui, sans-serif'; ctx.fillText(e.label, e.x + 26, e.y + 48); ctx.fillStyle = '#35f0c0'; ctx.font = '800 34px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(e.value, W - 272, e.y + 48); ctx.textAlign = 'left'; }
      else if (e.type === 'btn') { ctx.fillStyle = e.active ? '#35f0c0' : hv ? '#2c3d4c' : '#1a2430'; rr(e.x, e.y, e.w, e.h, 18); ctx.fill(); ctx.lineWidth = hv ? 5 : 2; ctx.strokeStyle = hv ? '#ffffff' : 'rgba(255,255,255,0.25)'; rr(e.x, e.y, e.w, e.h, 18); ctx.stroke(); ctx.fillStyle = e.active ? '#04120e' : '#eef2f8'; ctx.font = '700 32px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(e.label, e.x + e.w / 2, e.y + e.h / 2 + 11); ctx.textAlign = 'left'; }
      else if (e.type === 'note') { ctx.fillStyle = '#9aa3b8'; ctx.font = '30px system-ui, sans-serif'; ctx.fillText(e.label, e.x + 10, e.y + 40); }
      else if (e.type === 'card') {
        const s = e.scene, here = s.id === current, im = imgs[e.idx];
        ctx.save(); rr(e.x, e.y, e.w, e.h, 24); ctx.clip(); ctx.fillStyle = hv ? '#1d2a36' : '#121a24'; ctx.fillRect(e.x, e.y, e.w, e.h);
        const th = e.h * 0.56; if (im.complete && im.naturalWidth) { const k = Math.max(e.w / im.naturalWidth, th / im.naturalHeight), iw = im.naturalWidth * k, ih = im.naturalHeight * k; ctx.drawImage(im, e.x + (e.w - iw) / 2, e.y + (th - ih) / 2, iw, ih); } ctx.restore();
        ctx.lineWidth = hv ? 7 : here ? 5 : 2; ctx.strokeStyle = hv ? '#ffffff' : here ? '#35f0c0' : 'rgba(255,255,255,0.25)'; rr(e.x, e.y, e.w, e.h, 24); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.65)'; rr(e.x + 14, e.y + 14, 82, 36, 10); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '600 24px system-ui, sans-serif'; ctx.fillText(s.ver, e.x + 28, e.y + 40);
        if (here) { ctx.fillStyle = '#35f0c0'; rr(e.x + e.w - 120, e.y + 14, 106, 36, 10); ctx.fill(); ctx.fillStyle = '#04120e'; ctx.font = '700 24px system-ui, sans-serif'; ctx.fillText('aquí', e.x + e.w - 98, e.y + 40); }
        ctx.fillStyle = '#eef2f8'; ctx.font = '700 36px system-ui, sans-serif'; ctx.fillText(s.titulo, e.x + 20, e.y + th + 50);
        ctx.fillStyle = '#9aa3b8'; ctx.font = '24px system-ui, sans-serif'; let line = '', yy = e.y + th + 88;
        s.desc.split(' ').forEach((w) => { const tt = line + w + ' '; if (ctx.measureText(tt).width > e.w - 40) { ctx.fillText(line, e.x + 20, yy); line = w + ' '; yy += 30; } else line = tt; }); ctx.fillText(line, e.x + 20, yy);
      }
    });
    ctx.fillStyle = '#6f7a90'; ctx.font = '24px system-ui, sans-serif'; ctx.fillText('Suelta el grip y el panel se va flotando hacia arriba · también puedes caminar de verdad por tu área', 24, H - 14);
    tex.needsUpdate = true;
  }
  draw();

  const rc = new THREE.Raycaster(), tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  function pick(ctrl) {
    if (mode === 'closed') return -1;
    tmpM.identity().extractRotation(ctrl.matrixWorld);
    rc.ray.origin.setFromMatrixPosition(ctrl.matrixWorld); rc.ray.direction.set(0, 0, -1).applyMatrix4(tmpM); rc.far = 8;
    const h = rc.intersectObject(mesh, false)[0]; if (!h || !h.uv) return -1;
    const px = h.uv.x * W, py = (1 - h.uv.y) * H;
    for (let i = 0; i < els.length; i++) { const e = els[i]; if (e.type !== 'note' && e.type !== 'row' && px >= e.x && px <= e.x + e.w && py >= e.y && py <= e.y + e.h) return i; }
    return -1;
  }
  const api = {
    mesh, pick,
    get mode() { return mode; },
    get holder() { return holder; },
    get visible() { return mode !== 'closed'; },
    get blocking() { return mode === 'held' || mode === 'docked'; },
    setCurrent(id) { current = id; draw(); },
    click(i) { const e = els[i]; if (e && e.onClick) { e.onClick(); draw(); } },
    /** Panel delante de la cara (clic del joystick). */
    showFront(scene, cam) {
      const p = cam.getWorldPosition(new THREE.Vector3()), d = cam.getWorldDirection(new THREE.Vector3()); d.y = 0; d.normalize();
      this.hide(); sceneRef = scene; scene.add(mesh); mesh.scale.setScalar(1.45); mesh.rotation.set(0, 0, 0);
      mesh.position.copy(p).addScaledVector(d, 1.2); mesh.position.y = p.y - 0.1; mesh.lookAt(p.x, mesh.position.y + 0.02, p.z); mesh.material.opacity = 1; mode = 'docked'; draw();
    },
    /** Sacado del bolsillo: queda en la mano que aprieta el grip. */
    hold(ctrl, scene) {
      this.hide(); sceneRef = scene; scene.add(mesh); mesh.scale.setScalar(0.66); ctrl.add(mesh);
      mesh.position.set(0, 0.1, -0.36); mesh.rotation.set(-0.6, 0, 0); mesh.material.opacity = 1; mode = 'held'; holder = ctrl; hist.length = 0; draw();
    },
    /** Soltar: se va flotando hacia arriba (gravedad invertida). */
    release() {
      if (mode === 'held') {
        mesh.updateMatrixWorld(true);
        const v = new THREE.Vector3(); if (hist.length > 1) { const a = hist[0], z = hist[hist.length - 1], sp = z.t - a.t; if (sp > 0.02) v.copy(z.p).sub(a.p).multiplyScalar(0.6 / sp); }
        sceneRef.attach(mesh); vel.copy(v).clampLength(0, 3); vel.y += 0.45;
      } else if (mode === 'docked') vel.set(0, 0.5, 0); else return;
      holder = null; mode = 'floating'; t = 0;
    },
    hide() { mesh.parent && mesh.parent.remove(mesh); mode = 'closed'; holder = null; hover = -1; },
    update(dt, ctrls) {
      if (mode === 'closed') return;
      if (mode === 'held') { hist.push({ t: performance.now() / 1000, p: mesh.getWorldPosition(new THREE.Vector3()) }); while (hist.length > 2 && performance.now() / 1000 - hist[0].t > 0.12) hist.shift(); }
      if (mode === 'floating') {
        t += dt; vel.y += 1.1 * dt; vel.multiplyScalar(Math.exp(-0.3 * dt)); mesh.position.addScaledVector(vel, dt); mesh.rotation.y += 0.35 * dt; mesh.rotation.z += 0.12 * dt;
        mesh.material.opacity = Math.max(0, 1 - Math.max(0, t - 0.9) / 2.1); if (t > 3) { this.hide(); return; }
      }
      let h = -1; for (const c of ctrls) { if (c === holder) continue; const i = pick(c); if (i >= 0) h = i; }
      redrawT += dt;
      if (h !== hover) { hover = h; draw(); redrawT = 0; } else if (redrawT > 0.6) { redrawT = 0; draw(); }
      if (mode === 'held') { /* nada: sigue la mano */ }
    },
    setPage(i) { page = i; draw(); },
  };
  return api;
}
