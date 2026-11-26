import * as THREE from 'three';
import { ESCENAS } from './menu.js';

// ============================================================================
// CUERPO + PANEL DE BOLSILLO (VR)
//  - Cuerpo de figura geométrica exótica (cristal facetado) bajo tu cabeza: solo se ve al mirar hacia abajo, si no se vuelve transparente.
//  - Dos bolsillos en la cadera: mano dentro + grip (o pellizco con las manos) = sacas el panel. Al soltarlo flota hacia arriba y se desvanece.
//  - Páginas: Escenas · Movimiento · Sonido · Mundo · Clase (la clase solo existe en Monte Verde).
// ============================================================================

const W = 1600, H = 820;
const LABEL = { escenas: 'Escenas', movimiento: 'Movimiento', sonido: 'Sonido', mundo: 'Mundo', clase: 'Clase', hallazgos: 'Arqueólogo' };

export function createBody(controllers) {
  const group = new THREE.Group(); group.name = 'Cuerpo';
  const mats = [];
  const cristal = (color, em, op) => { const m = new THREE.MeshStandardMaterial({ color, emissive: em, emissiveIntensity: 0.55, flatShading: true, roughness: 0.3, metalness: 0.2, transparent: true, opacity: op, depthWrite: false }); mats.push({ m, op }); return m; };
  const lineMat = (color, op) => { const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }); mats.push({ m, op }); return m; };
  const solid = (geo, mat, line, x, y, z, sx = 1, sy = 1, sz = 1) => { const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); group.add(mesh); const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo), line); l.position.copy(mesh.position); l.scale.copy(mesh.scale); group.add(l); return mesh; };
  const teal = cristal(0x2fd6b4, 0x138a74, 0.62), violet = cristal(0x8a7bff, 0x4a3ac8, 0.55), amber = cristal(0xffc36a, 0xb06a10, 0.6);
  const ln = lineMat(0xd8fff6, 0.95);
  solid(new THREE.IcosahedronGeometry(0.17, 0), teal, ln, 0, 0.0, 0, 1, 1.45, 0.72);          // pecho
  solid(new THREE.OctahedronGeometry(0.19, 0), violet, ln, 0, -0.34, 0, 1, 0.62, 0.7);        // pelvis
  [-1, 1].forEach((s) => { solid(new THREE.OctahedronGeometry(0.09, 0), teal, ln, s * 0.09, -0.7, 0, 1, 3.4, 1); solid(new THREE.TetrahedronGeometry(0.075, 0), amber, ln, s * 0.1, -1.06, 0.03, 1, 1, 1.4); });
  const ringMat = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: 0x35f0c0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
  const rings = [-1, 1].map((s, i) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.065, 0.095, 28).rotateY(Math.PI / 2), ringMat[i]); m.position.set(s * 0.17, -0.17, 0.04); group.add(m); return m; });
  // ranuras del pecho: metes al colihuacho y sales al Hall o sales del VR (como el disco en la ranura)
  const slotDefs = [{ id: 'hall', label: 'HALL', x: -0.1, color: 0x8a7bff }, { id: 'salir', label: 'SALIR', x: 0.1, color: 0xff8a6a }];
  const slotRing = slotDefs.map((d) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.05, 24), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })); m.position.set(d.x, 0.12, -0.17); m.rotation.y = Math.PI; group.add(m); return m; });
  const slotLabel = slotDefs.map((d) => { const cv = document.createElement('canvas'); cv.width = 160; cv.height = 56; const x = cv.getContext('2d'); x.font = '700 38px system-ui, sans-serif'; x.textAlign = 'center'; x.fillStyle = '#' + d.color.toString(16).padStart(6, '0'); x.fillText(d.label, 80, 42); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, depthTest: false, toneMapped: false })); s.scale.set(0.11, 0.04, 1); s.position.set(d.x, 0.19, -0.17); group.add(s); return s; });
  const slotW = [new THREE.Vector3(), new THREE.Vector3()];
  let slotHi = -1;
  // manos visibles en los controles (poliedros claros)
  const handMat = new THREE.MeshStandardMaterial({ color: 0xf3e6d0, emissive: 0x33261a, flatShading: true, roughness: 0.5 });
  controllers.forEach((c) => {
    const h = new THREE.Group(); h.name = 'Mano';
    const palm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 0), handMat); palm.scale.set(1, 0.7, 1.3); h.add(palm); h.position.set(0, 0, 0.04); c.add(h);
    c.addEventListener('connected', (e) => { c.userData.src = e.data; h.visible = !(e.data && e.data.hand); });   // con manos reales no dibujamos la esfera
  });
  const state = { yaw: 0, init: false, fade: 0 };
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
      // el cuerpo aparece al mirar hacia abajo y se vuelve transparente cuando dejas de mirarlo
      const look = THREE.MathUtils.clamp((-camDir.y - 0.3) / 0.3, 0, 1);
      state.fade += (look - state.fade) * Math.min(1, dt * (look > state.fade ? 6 : 2.2));
      mats.forEach(({ m, op }) => { m.opacity = op * state.fade; });
      group.children.forEach((c) => { if (c.isMesh && c.material.transparent && !ringMat.includes(c.material)) c.visible = state.fade > 0.01; if (c.isLineSegments) c.visible = state.fade > 0.01; });
      [-1, 1].forEach((s, i) => pockets[i].set(group.position.x + rgtX * s * 0.19 + fwdX * 0.04, group.position.y - 0.17, group.position.z + rgtZ * s * 0.19 + fwdZ * 0.04));
      group.updateMatrixWorld(true);
      slotDefs.forEach((d, i) => slotW[i].set(d.x, 0.12, -0.17).applyMatrix4(group.matrixWorld));
      slotRing.forEach((m, i) => { m.material.opacity = (slotHi === i ? 0.95 : 0.12 + 0.45 * state.fade); m.scale.setScalar(slotHi === i ? 1.5 + Math.sin(performance.now() * 0.01) * 0.1 : 1); slotLabel[i].material.opacity = state.fade * (slotHi === i ? 1 : 0.8); });
      const near = [false, false];
      controllers.forEach((c) => { c.getWorldPosition(tmpP); for (let i = 0; i < 2; i++) if (tmpP.distanceTo(pockets[i]) < 0.26) near[i] = true; });
      const tt = performance.now() * 0.004;
      rings.forEach((m, i) => { ringMat[i].opacity = near[i] ? 0.95 : 0.12 + 0.2 * state.fade; m.scale.setScalar(near[i] ? 1.25 + Math.sin(tt) * 0.08 : 1); });
    },
    nearPocket(p, r = 0.26) { return pockets.findIndex((q) => q.distanceTo(p) < r); },
    slotAt(p, r = 0.2) { return slotW.findIndex((q) => q.distanceTo(p) < r); },
    slotPos(i) { return slotW[i].clone(); },
    highlight(i) { slotHi = i; },
  };
}

export function createPanel(app) {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false, fog: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, H / W), mat); mesh.renderOrder = 1000; mesh.name = 'Panel_bolsillo';
  const imgs = ESCENAS.map((e) => { const im = new Image(); im.onload = () => draw(); im.src = import.meta.env.BASE_URL + e.thumb; return im; });
  let page = 'escenas', hover = -1, els = [], current = '', mode = 'closed', holder = null, sceneRef = null, t = 0, redrawT = 0, idle = 0;
  const vel = new THREE.Vector3(), hist = [];

  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const wrap = (text, maxW) => { const out = []; let line = ''; text.split(' ').forEach((w) => { const tt = line + w + ' '; if (ctx.measureText(tt).width > maxW && line) { out.push(line.trim()); line = w + ' '; } else line = tt; }); if (line.trim()) out.push(line.trim()); return out; };
  const pageKeys = () => ['escenas', 'movimiento', 'sonido', 'mundo', ...(app.activeStops && app.activeStops() ? ['clase'] : []), ...(app.activeFinds && app.activeFinds() ? ['hallazgos'] : [])];
  const L = () => app.loco, A = () => app.aud, C = () => app.activeControls && app.activeControls();

  function build() {
    els = [];
    const keys = pageKeys(); if (!keys.includes(page)) page = 'escenas';
    const tw = Math.min(290, (W - 48 - 12 * (keys.length - 1)) / keys.length);
    keys.forEach((k, i) => els.push({ x: 24 + i * (tw + 12), y: 16, w: tw, h: 66, type: 'tab', label: LABEL[k], active: page === k, onClick: () => { page = k; } }));
    const y0 = 118, X = 24, RW = W - 48;
    let rowH = 74, gap = 14; if (page === 'sonido') { rowH = 62; gap = 8; }
    const rowY = (row) => y0 + row * (rowH + gap);
    const toggle = (row, label, get, set) => els.push({ x: X, y: rowY(row), w: RW, h: rowH, type: 'toggle', label, on: get(), onClick: () => set(!get()) });
    const stepper = (row, label, get, fmt, dec, inc) => { const y = rowY(row); els.push({ x: X, y, w: RW, h: rowH, type: 'row', label, value: fmt(get()) }); els.push({ x: W - 420, y: y + 7, w: 100, h: rowH - 14, type: 'btn', label: '−', onClick: dec }); els.push({ x: W - 124, y: y + 7, w: 100, h: rowH - 14, type: 'btn', label: '+', onClick: inc }); };
    const btn = (row, col, cols, label, onClick, active = false) => { const w = (RW - (cols - 1) * 16) / cols; els.push({ x: X + col * (w + 16), y: rowY(row), w, h: rowH, type: 'btn', label, onClick, active }); };
    if (page === 'escenas') {
      const n = ESCENAS.length, g = 18, cw = (W - 48 - g * (n - 1)) / n, cy = y0 + 4, ch = H - cy - 40;
      ESCENAS.forEach((e, i) => els.push({ x: 24 + i * (cw + g), y: cy, w: cw, h: ch, type: 'card', scene: e, idx: i, onClick: () => app.selectScene(e.id) }));
    } else if (page === 'movimiento') {
      toggle(0, 'Caminar con el joystick izquierdo', () => L().joystick, (v) => { L().joystick = v; app.saveLoco(); });
      toggle(1, 'Girar con el joystick derecho', () => L().snap, (v) => { L().snap = v; app.saveLoco(); });
      toggle(2, 'Giro suave (apagado = por pasos)', () => L().smooth, (v) => { L().smooth = v; app.saveLoco(); });
      toggle(3, 'Arrastrar el mundo (gatillo o grip en el aire)', () => L().grab, (v) => { L().grab = v; app.saveLoco(); });
      stepper(4, 'Velocidad al caminar', () => L().speed, (v) => `${v.toFixed(1)} m/s`, () => { L().speed = Math.max(0.8, +(L().speed - 0.4).toFixed(1)); app.saveLoco(); }, () => { L().speed = Math.min(4, +(L().speed + 0.4).toFixed(1)); app.saveLoco(); });
      stepper(5, 'Velocidad del giro suave', () => L().turnSpeed, (v) => `${Math.round(v)}°/s`, () => { L().turnSpeed = Math.max(20, L().turnSpeed - 15); app.saveLoco(); }, () => { L().turnSpeed = Math.min(160, L().turnSpeed + 15); app.saveLoco(); });
      btn(6, 0, 2, 'Solo movimiento físico (apaga todo)', () => { const l = L(); l.joystick = l.snap = l.grab = false; app.saveLoco(); }, !L().joystick && !L().snap && !L().grab);
      btn(6, 1, 2, 'Activar todo', () => { const l = L(); l.joystick = l.snap = l.grab = true; app.saveLoco(); });
    } else if (page === 'sonido') {
      const pr = (nm) => app.setAudPreset(nm);
      btn(0, 0, 5, 'Sutil', () => pr('sutil')); btn(0, 1, 5, 'Completo', () => pr('completo')); btn(0, 2, 5, 'Narración', () => pr('narracion')); btn(0, 3, 5, 'Silencio', () => pr('silencio')); btn(0, 4, 5, '🔊 Probar', () => app.testSound());
      const row = (i, label, key) => stepper(i, label, () => A()[key], (v) => `${Math.round(v * 100)}%`, () => { A()[key] = Math.max(0, +(A()[key] - 0.1).toFixed(2)); app.saveAud(); }, () => { A()[key] = Math.min(1, +(A()[key] + 0.1).toFixed(2)); app.saveAud(); });
      row(1, 'Volumen general', 'master'); row(2, 'Ambiente (viento, lluvia, fuego)', 'ambiente'); row(3, 'Pájaros', 'pajaros'); row(4, 'Grillos de noche', 'grillos'); row(5, 'Zumbido del picaflor', 'picaflor'); row(6, 'Golpes, rebotes y colihuacho', 'efectos'); row(7, 'Narración de la clase', 'narracion'); row(8, 'Río y agua', 'rio');
    } else if (page === 'mundo') {
      const c = C();
      if (!c) els.push({ x: X, y: y0, w: RW, h: rowH * 2, type: 'note', label: 'Esta escena no tiene clima. En la casa usa los discos para cambiar de ambiente.' });
      else {
        const n = c.horas.length, wcol = (RW - 16 * (n - 1)) / n;
        c.horas.forEach((nm, i) => els.push({ x: X + i * (wcol + 16), y: y0, w: wcol, h: rowH, type: 'btn', label: nm[0].toUpperCase() + nm.slice(1), active: c.hora() === i, onClick: () => c.setHora(i) }));
        let rw = 1;
        if (c.lluvia) toggle(rw++, 'Lluvia', () => c.lluvia(), () => c.toggleRain());
        if (c.densidad && c.setDensidad && !c.sinDensidad) stepper(rw++, 'Densidad de plantas', () => c.densidad(), (v) => `${Math.round(v * 100)}%`, () => c.setDensidad(Math.max(0.2, +(c.densidad() - 0.2).toFixed(2))), () => c.setDensidad(Math.min(1, +(c.densidad() + 0.2).toFixed(2))));
        stepper(rw++, 'Niebla', () => c.niebla(), (v) => `×${v.toFixed(1)}`, () => c.setNiebla(Math.max(0.4, +(c.niebla() - 0.2).toFixed(1))), () => c.setNiebla(Math.min(2, +(c.niebla() + 0.2).toFixed(1))));
      }
    } else if (page === 'hallazgos') {
      const F = app.activeFinds();
      F.list.forEach((h, i) => btn(Math.floor(i / 2), i % 2, 2, h.titulo, () => F.show(i), F.sel === i));
      els.push({ x: X, y: 470, w: RW, h: 300, type: 'finddesc' });
    } else if (page === 'clase') {
      const N = app.narr, st = N.state, stops = app.activeStops(), cur = app.stopIndex();
      els.push({ x: X, y: 126, w: RW, h: 330, type: 'lesson' });
      const cy = 470, bw = 150;
      els.push({ x: X, y: cy, w: bw, h: 70, type: 'btn', label: '⏮ Frase', onClick: () => N.prev() });
      els.push({ x: X + bw + 12, y: cy, w: 230, h: 70, type: 'btn', label: st.playing ? '⏸ Pausa' : '▶ Seguir', active: st.playing, onClick: () => N.toggle() });
      els.push({ x: X + bw + 254, y: cy, w: bw, h: 70, type: 'btn', label: 'Frase ⏭', onClick: () => N.next() });
      els.push({ x: W - 420, y: cy, w: 100, h: 70, type: 'btn', label: '−', onClick: () => N.setRate(st.rate - 0.2) });
      els.push({ x: W - 124, y: cy, w: 100, h: 70, type: 'btn', label: '+', onClick: () => N.setRate(st.rate + 0.2) });
      els.push({ x: W - 316, y: cy, w: 190, h: 70, type: 'rate', label: `Vel ×${st.rate.toFixed(1)}` });
      const qa = cur >= 0 ? stops[cur].qa : []; const qw = (RW - 16) / 2;
      qa.forEach(([q, a], i) => els.push({ x: X + i * (qw + 16), y: 556, w: qw, h: 76, type: 'btn', label: q, small: true, onClick: () => N.answer(q, a) }));
      if (!qa.length) els.push({ x: X, y: 556, w: RW, h: 76, type: 'note', label: 'Acércate a una esfera luminosa o pide la primera parada con «Siguiente parada».' });
      els.push({ x: X, y: 650, w: 330, h: 70, type: 'btn', label: '◀ Parada anterior', onClick: () => app.gotoStop(Math.max(0, (cur < 0 ? 1 : cur) - 1)) });
      els.push({ x: X + 346, y: 650, w: 520, h: 70, type: 'btn', label: cur < 0 ? 'Comenzar la clase ▶' : 'Siguiente parada ▶', active: true, onClick: () => app.gotoStop(Math.min(stops.length - 1, cur + 1)) });
      els.push({ x: X + 882, y: 650, w: 330, h: 70, type: 'btn', label: '↺ Leer de nuevo', onClick: () => (cur >= 0 ? app.playStop(cur) : null) });
    }
  }

  function draw() {
    build();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(6,9,14,0.92)'; rr(0, 0, W, H, 36); ctx.fill();
    ctx.strokeStyle = '#35f0c0'; ctx.lineWidth = 4; rr(2, 2, W - 4, H - 4, 34); ctx.stroke();
    els.forEach((e, i) => {
      const hv = hover === i;
      if (e.type === 'tab') { ctx.fillStyle = e.active ? '#35f0c0' : hv ? '#22303c' : '#141c26'; rr(e.x, e.y, e.w, e.h, 18); ctx.fill(); ctx.fillStyle = e.active ? '#04120e' : '#cfd6e4'; ctx.font = `700 ${pageKeys().length > 5 ? 28 : 32}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(e.label, e.x + e.w / 2, e.y + 44); ctx.textAlign = 'left'; }
      else if (e.type === 'toggle') { ctx.fillStyle = hv ? '#22303c' : '#141c26'; rr(e.x, e.y, e.w, e.h, 18); ctx.fill(); ctx.fillStyle = '#eef2f8'; ctx.font = '600 32px system-ui, sans-serif'; ctx.fillText(e.label, e.x + 26, e.y + e.h / 2 + 11); ctx.fillStyle = e.on ? '#35f0c0' : '#3a4452'; rr(e.x + e.w - 250, e.y + 10, 226, e.h - 20, 24); ctx.fill(); ctx.fillStyle = e.on ? '#04120e' : '#9aa3b8'; ctx.font = '800 28px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(e.on ? 'ACTIVADO' : 'APAGADO', e.x + e.w - 137, e.y + e.h / 2 + 10); ctx.textAlign = 'left'; }
      else if (e.type === 'row') { ctx.fillStyle = '#141c26'; rr(e.x, e.y, e.w, e.h, 18); ctx.fill(); ctx.fillStyle = '#eef2f8'; ctx.font = '600 31px system-ui, sans-serif'; ctx.fillText(e.label, e.x + 26, e.y + e.h / 2 + 11); ctx.fillStyle = '#35f0c0'; ctx.font = '800 33px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(e.value, W - 272, e.y + e.h / 2 + 11); ctx.textAlign = 'left'; }
      else if (e.type === 'btn') { ctx.fillStyle = e.active ? '#35f0c0' : hv ? '#2c3d4c' : '#1a2430'; rr(e.x, e.y, e.w, e.h, 18); ctx.fill(); ctx.lineWidth = hv ? 5 : 2; ctx.strokeStyle = hv ? '#ffffff' : 'rgba(255,255,255,0.25)'; rr(e.x, e.y, e.w, e.h, 18); ctx.stroke(); ctx.fillStyle = e.active ? '#04120e' : '#eef2f8'; ctx.font = `700 ${e.small ? 27 : 31}px system-ui, sans-serif`; ctx.textAlign = 'center'; if (e.small) { const ls = wrap(e.label, e.w - 40); ls.slice(0, 2).forEach((l, k) => ctx.fillText(l, e.x + e.w / 2, e.y + e.h / 2 + 9 - (ls.length > 1 ? 14 : 0) + k * 32)); } else ctx.fillText(e.label, e.x + e.w / 2, e.y + e.h / 2 + 11); ctx.textAlign = 'left'; }
      else if (e.type === 'rate') { ctx.fillStyle = '#35f0c0'; ctx.font = '700 28px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(e.label, e.x + e.w / 2, e.y + e.h / 2 + 10); ctx.textAlign = 'left'; }
      else if (e.type === 'note') { ctx.fillStyle = '#9aa3b8'; ctx.font = '30px system-ui, sans-serif'; wrap(e.label, e.w - 20).forEach((l, k) => ctx.fillText(l, e.x + 10, e.y + 40 + k * 38)); }
      else if (e.type === 'finddesc') {
        const F = app.activeFinds(), h = F && F.sel >= 0 ? F.list[F.sel] : null;
        ctx.fillStyle = '#101822'; rr(e.x, e.y, e.w, e.h, 18); ctx.fill();
        ctx.fillStyle = '#35f0c0'; ctx.font = '800 38px system-ui, sans-serif'; ctx.fillText(h ? h.titulo : 'Menú del arqueólogo', e.x + 24, e.y + 52);
        ctx.fillStyle = h ? '#ffffff' : '#9aa3b8'; ctx.font = '29px system-ui, sans-serif';
        wrap(h ? h.texto.join(' ') : 'Elige algo de lo que se encontró en Monte Verde: aparece una réplica delante de ti (puedes agarrarla y lanzarla) y la narradora cuenta qué es y qué se sabe.', e.w - 48).slice(0, 6).forEach((l, k) => ctx.fillText(l, e.x + 24, e.y + 104 + k * 38));
      }
      else if (e.type === 'lesson') {
        const st = app.narr.state, stops = app.activeStops(), cur = app.stopIndex(), s = cur >= 0 ? stops[cur] : null;
        ctx.fillStyle = '#101822'; rr(e.x, e.y, e.w, e.h, 18); ctx.fill();
        ctx.fillStyle = '#35f0c0'; ctx.font = '800 40px system-ui, sans-serif'; ctx.fillText(s ? `${cur + 1}/${stops.length} · ${s.titulo}` : 'Clase recorrida · Monte Verde', e.x + 24, e.y + 52);
        if (st.mode === 'answer') { ctx.fillStyle = '#ffd27a'; ctx.font = '600 28px system-ui, sans-serif'; ctx.fillText('Pregunta: ' + st.answerQ, e.x + 24, e.y + 92); }
        else { ctx.fillStyle = '#6f7a90'; ctx.font = '24px system-ui, sans-serif'; ctx.fillText(app.narr.state.files ? 'Voz: narradora chilena. Si no suena, lee el texto: avanza solo.' : app.narr.state.hasVoice ? 'Voz: la del visor. Si no suena, lee el texto: avanza solo.' : 'Modo lectura: este visor no trae voz, el texto avanza solo.', e.x + 24, e.y + 90); }
        if (!st.sentences.length) { ctx.fillStyle = '#9aa3b8'; ctx.font = '32px system-ui, sans-serif'; wrap('Toca una esfera luminosa del pueblo o aprieta «Comenzar la clase recorrida». El colihuacho te lleva a cada parada y te la explica.', e.w - 48).forEach((l, k) => ctx.fillText(l, e.x + 24, e.y + 150 + k * 42)); }
        else {
          const prev = st.sentences[st.idx - 1], cur2 = st.sentences[st.idx], next = st.sentences[st.idx + 1];
          let y = e.y + 130;
          if (prev) { ctx.fillStyle = '#6f7a90'; ctx.font = '26px system-ui, sans-serif'; wrap(prev, e.w - 60).slice(-2).forEach((l) => { ctx.fillText(l, e.x + 24, y); y += 32; }); }
          y += 10; ctx.fillStyle = '#ffffff'; ctx.font = '600 40px system-ui, sans-serif'; wrap(cur2, e.w - 60).slice(0, 4).forEach((l) => { ctx.fillText(l, e.x + 24, y); y += 50; });
          if (next) { y += 8; ctx.fillStyle = '#6f7a90'; ctx.font = '26px system-ui, sans-serif'; wrap(next, e.w - 60).slice(0, 2).forEach((l) => { ctx.fillText(l, e.x + 24, y); y += 32; }); }
          ctx.fillStyle = '#26323f'; rr(e.x + 24, e.y + e.h - 26, e.w - 48, 10, 5); ctx.fill(); ctx.fillStyle = '#35f0c0'; rr(e.x + 24, e.y + e.h - 26, (e.w - 48) * ((st.idx + 1) / st.sentences.length), 10, 5); ctx.fill();
        }
      } else if (e.type === 'card') {
        const s = e.scene, here = s.id === current, im = imgs[e.idx];
        ctx.save(); rr(e.x, e.y, e.w, e.h, 24); ctx.clip(); ctx.fillStyle = hv ? '#1d2a36' : '#121a24'; ctx.fillRect(e.x, e.y, e.w, e.h);
        const th = e.h * 0.5; if (im.complete && im.naturalWidth) { const k = Math.max(e.w / im.naturalWidth, th / im.naturalHeight), iw = im.naturalWidth * k, ih = im.naturalHeight * k; ctx.drawImage(im, e.x + (e.w - iw) / 2, e.y + (th - ih) / 2, iw, ih); } ctx.restore();
        ctx.lineWidth = hv ? 7 : here ? 5 : 2; ctx.strokeStyle = hv ? '#ffffff' : here ? '#35f0c0' : 'rgba(255,255,255,0.25)'; rr(e.x, e.y, e.w, e.h, 24); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.65)'; rr(e.x + 10, e.y + 10, 70, 32, 9); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '600 21px system-ui, sans-serif'; ctx.fillText(s.ver, e.x + 20, e.y + 33);
        if (here) { ctx.fillStyle = '#35f0c0'; rr(e.x + e.w - 90, e.y + 10, 80, 32, 9); ctx.fill(); ctx.fillStyle = '#04120e'; ctx.font = '700 21px system-ui, sans-serif'; ctx.fillText('aquí', e.x + e.w - 76, e.y + 33); }
        ctx.fillStyle = '#eef2f8'; ctx.font = '700 29px system-ui, sans-serif'; wrap(s.titulo, e.w - 28).slice(0, 2).forEach((l, k) => ctx.fillText(l, e.x + 14, e.y + th + 38 + k * 32));
        ctx.fillStyle = '#9aa3b8'; ctx.font = '21px system-ui, sans-serif'; wrap(s.desc, e.w - 28).slice(0, 4).forEach((l, k) => ctx.fillText(l, e.x + 14, e.y + th + 112 + k * 26));
      }
    });
    ctx.fillStyle = '#6f7a90'; ctx.font = '23px system-ui, sans-serif'; ctx.fillText('Suelta el grip y el panel se va flotando hacia arriba · también puedes caminar de verdad por tu área', 24, H - 14);
    tex.needsUpdate = true;
  }
  draw();

  const rc = new THREE.Raycaster(), tmpM = new THREE.Matrix4();
  function pickWith(r) {
    if (mode === 'closed') return -1;
    const h = r.intersectObject(mesh, false)[0]; if (!h || !h.uv) return -1;
    const px = h.uv.x * W, py = (1 - h.uv.y) * H;
    for (let i = 0; i < els.length; i++) { const e = els[i]; if (!['note', 'row', 'lesson', 'rate', 'finddesc'].includes(e.type) && px >= e.x && px <= e.x + e.w && py >= e.y && py <= e.y + e.h) return i; }
    return -1;
  }
  function pick(ctrl) { tmpM.identity().extractRotation(ctrl.matrixWorld); rc.ray.origin.setFromMatrixPosition(ctrl.matrixWorld); rc.ray.direction.set(0, 0, -1).applyMatrix4(tmpM); rc.far = 8; return pickWith(rc); }
  const api = {
    mesh, pick, pickWith,
    get mode() { return mode; },
    get holder() { return holder; },
    get visible() { return mode !== 'closed'; },
    get blocking() { return mode === 'held'; },
    /** ¿Está el punto p (mundo) dentro del volumen del panel? Sirve para volver a agarrarlo con la mano. */
    contains(p, pad = 0.12) { if (mode === 'closed') return false; mesh.updateMatrixWorld(true); const l = mesh.worldToLocal(p.clone()), s = mesh.scale.x; return Math.abs(l.x) * s < 0.5 * s + pad && Math.abs(l.y) * s < (H / W) * 0.5 * s + pad && Math.abs(l.z) * s < 0.28; },
    setCurrent(id) { current = id; draw(); },
    setPage(k) { page = k; draw(); },
    redraw() { if (mode !== 'closed') draw(); },
    click(i) { idle = 0; const e = els[i]; if (e && e.onClick) { e.onClick(); draw(); } },
    showFront(scene, cam) {
      const p = cam.getWorldPosition(new THREE.Vector3()), d = cam.getWorldDirection(new THREE.Vector3()); d.y = 0; d.normalize();
      this.hide(); sceneRef = scene; scene.add(mesh); mesh.scale.setScalar(1.45); mesh.rotation.set(0, 0, 0);
      mesh.position.copy(p).addScaledVector(d, 1.2); mesh.position.y = p.y - 0.1; mesh.lookAt(p.x, mesh.position.y + 0.02, p.z); mesh.material.opacity = 1; mode = 'docked'; idle = 0; draw();
    },
    hold(ctrl, scene) {
      this.hide(); sceneRef = scene; scene.add(mesh); mesh.scale.setScalar(0.66); ctrl.add(mesh);
      mesh.position.set(0, 0.1, -0.36); mesh.rotation.set(-0.6, 0, 0); mesh.material.opacity = 1; mode = 'held'; holder = ctrl; hist.length = 0; idle = 0; draw();
    },
    /** Soltar con suavidad: se queda flotando donde está (en uso). Lanzarlo o dejar de usarlo: despega lento hacia arriba. */
    release() {
      if (mode === 'held') {
        mesh.updateMatrixWorld(true);
        const v = new THREE.Vector3(); if (hist.length > 1) { const a = hist[0], z = hist[hist.length - 1], sp = z.t - a.t; if (sp > 0.02) v.copy(z.p).sub(a.p).multiplyScalar(1 / sp); }
        sceneRef.attach(mesh); holder = null;
        if (v.length() > 1.2) { vel.copy(v).multiplyScalar(0.5).clampLength(0, 3); vel.y += 0.3; mode = 'floating'; t = 0; } else { mode = 'docked'; idle = 0; vel.set(0, 0, 0); }
      } else if (mode === 'docked') { vel.set(0, 0.12, 0); mode = 'floating'; t = 0; }
    },
    hide() { mesh.parent && mesh.parent.remove(mesh); mode = 'closed'; holder = null; hover = -1; },
    update(dt, ctrls) {
      if (mode === 'closed') return;
      if (mode === 'held') { hist.push({ t: performance.now() / 1000, p: mesh.getWorldPosition(new THREE.Vector3()) }); while (hist.length > 2 && performance.now() / 1000 - hist[0].t > 0.12) hist.shift(); }
      if (mode === 'floating') {
        t += dt; vel.y += 0.22 * dt; vel.multiplyScalar(Math.exp(-0.2 * dt)); mesh.position.addScaledVector(vel, dt); mesh.rotation.y += 0.12 * dt; mesh.rotation.z += 0.04 * dt;
        mesh.material.opacity = Math.max(0, 1 - Math.max(0, t - 2.5) / 7.5); if (t > 10) { this.hide(); return; }
      }
      let h = -1; for (const c of ctrls) { if (c === holder) continue; const i = pick(c); if (i >= 0) h = i; }
      if (mode === 'docked') {         // si no lo usas (ni apuntas ni la clase está sonando), despega solo y lento
        const reading = page === 'clase' && app.narr && app.narr.state.playing;
        if (h >= 0 || reading) idle = 0; else idle += dt;
        if (idle > 14) { vel.set(0, 0.1, 0); mode = 'floating'; t = 0; }
      }
      redrawT += dt;
      if (h !== hover) { hover = h; draw(); redrawT = 0; } else if (redrawT > 0.6) { redrawT = 0; draw(); }
    },
  };
  return api;
}
