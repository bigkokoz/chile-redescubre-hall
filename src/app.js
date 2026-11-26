import * as THREE from 'three';
import { maybeInstallEmulator } from './emu.js';
import { createCasa } from './world_casa.js';
import { createBosque } from './world_bosque.js';
import { createViaje } from './world_viaje.js';
import { mountMenu, ESCENAS, vrButtonHTML, arButtonHTML } from './menu.js';
import { createBody, createPanel } from './bolsillo.js';
import { createCompanion } from './colihuacho.js';
import { createNarrator } from './narrador.js';
import { createInput, mountTouchUI } from './touch.js';

// ============================================================================
// Hall: una sola página, un solo visor, varias escenas. Cambiar de escena NO cierra la sesión VR.
// Cada escena es un "mundo" (world_*.js) con { scene, camera, update, enter, exit, onXRStart, onXRStop }.
// ============================================================================

const $ = (id) => document.getElementById(id);
const say = (t) => { $('status').textContent = t; };
await maybeInstallEmulator();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.setClearColor(0x04050a, 1);
document.body.appendChild(renderer.domElement);

// Controles compartidos (los mundos los cuelgan de su propia escena al entrar)
const controllers = [0, 1].map((i) => {
  const c = renderer.xr.getController(i);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1.2)]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }));
  line.name = 'Control::Rayo'; c.add(line); c.userData.line = line;
  return c;
});

// Cómo te mueves (se cambia desde el panel de bolsillo o desde las casillas del escritorio; se recuerda)
const LOCO_DEF = { joystick: true, snap: true, smooth: true, grab: true, speed: 2.2, gain: 1.6, snapDeg: 30, turnSpeed: 75 };
let savedLoco = {}; try { savedLoco = JSON.parse(localStorage.getItem('hall.loco') || '{}'); } catch { /* sin guardado */ }
const loco = { ...LOCO_DEF, ...savedLoco };
const saveLoco = () => { try { localStorage.setItem('hall.loco', JSON.stringify(loco)); } catch { /* ignorar */ } syncLocoDom(); };
// Sonido: cada categoría se puede bajar o apagar (por defecto todo muy sutil; sin zumbido de picaflor ni grillos)
const AUD_DEF = { master: 1, ambiente: 0.35, rio: 0.6, pajaros: 0.55, grillos: 0, picaflor: 0, efectos: 0.8, narracion: 1 };
let savedAud = {}; try { savedAud = JSON.parse(localStorage.getItem('hall.aud') || '{}'); } catch { /* sin guardado */ }
const aud = { ...AUD_DEF, ...savedAud };
const saveAud = () => { try { localStorage.setItem('hall.aud', JSON.stringify(aud)); } catch { /* ignorar */ } };
const AUD_PRESETS = {
  sutil: { rio: 0.5, ambiente: 0.35, pajaros: 0.55, grillos: 0, picaflor: 0, efectos: 0.7, narracion: 1 },
  completo: { rio: 0.9, ambiente: 0.8, pajaros: 0.85, grillos: 0.5, picaflor: 0.4, efectos: 1, narracion: 1 },
  narracion: { rio: 0.1, ambiente: 0.12, pajaros: 0.15, grillos: 0, picaflor: 0, efectos: 0.4, narracion: 1 },
  silencio: { rio: 0, ambiente: 0, pajaros: 0, grillos: 0, picaflor: 0, efectos: 0, narracion: 0 },
};
let active = null, xrKind = null;
const guide = { target: -1 };
const input = createInput();
const app = {
  renderer, $, say, controllers, extra: $('extra'), features: [], suppressUntil: 0, loco, saveLoco, aud, saveAud, guide, input,
  setAudPreset: (n) => { Object.assign(aud, AUD_PRESETS[n]); saveAud(); },
  activeStops: () => (active && active.stops) || null,
  activeFinds: () => (active && active.finds) || null,
  stopIndex: () => (active && active.mv ? active.mv.cur : -1),
  playStop: (i) => { if (active && active.mv) active.mv.play(i); },
  gotoStop: (i) => {     // el colihuacho te guía hasta la parada; al llegar, la explica solo
    if (!active || !active.village) return; const st = active.stops[i]; if (!st) return;
    if (active.mv && active.mv.needsTravel && active.mv.needsTravel(i)) { active.mv.play(i); return; }     // desde el presente: viaja y explica al llegar
    guide.target = i; companion.lead(new THREE.Vector3(st.pos[0], st.pos[1] + 0.15, st.pos[2])); say(`Sigue al colihuacho: ${st.titulo}`);
  },
  onStopPlay: () => { guide.target = -1; companion.unlead(); const p = panels.find((x) => x.visible) || panel; p.setPage('clase'); if (!p.visible) p.showFront(active.scene, active.camera); else p.redraw(); },
  onCompanionGrab: () => { const p = panels.find((x) => x.visible) || panel; p.showFront(active.scene, active.camera); p.setPage(active.stops ? 'clase' : 'escenas'); },
  onCompanionRelease: () => { panels.forEach((p) => { if (p.mode === 'docked') p.release(); }); },
  onNarrationEnd: () => { panel.redraw(); },
  // meter al colihuacho en una ranura del pecho: HALL = vuelve a la casa del hall; SALIR = termina la sesión VR (ves tu entorno)
  onCompanionDrop: (p) => {
    body.highlight(-1); const i = body.slotAt(p); if (i < 0) return false;
    companion.insertAt(body.slotPos(i), () => { if (i === 0) select('casa'); else { const ss = renderer.xr.getSession(); if (ss) ss.end(); } });
    return true;
  },
  menuOpen: () => panels.some((p) => p.blocking),
  selectScene: (id) => select(id),
  activeControls: () => (active && active.controls) || null,
  setInfo: ({ titulo, intro, hint }) => { $('titulo').textContent = titulo || ''; $('intro').textContent = intro || ''; $('hint').textContent = hint || ''; },
};

const BOSQUE_HINT = 'PC: arrastra para mirar, WASD para caminar, mantén clic en un objeto para agarrarlo y suéltalo moviendo el mouse para lanzarlo. L = lluvia, H = hora, R = reponer objetos. Quest: joystick izq camina, der gira, gatillo/grip en el aire arrastra el mundo, A = lluvia, B = hora.';
const FACTORY = {
  casa: () => createCasa(app),
  viaje: () => createViaje(app),
  bosque: () => createBosque(app, { id: 'bosque', titulo: 'Bosque de papel', intro: 'Un taller en medio del bosque valdiviano. Camina, agarra herramientas y tazas, mira las mariposas y espera al picaflor.', hint: BOSQUE_HINT }),
  antiguo: () => createBosque(app, { id: 'antiguo', tipo: 'antiguo', titulo: 'Bosque antiguo', intro: 'Troncos enormes con raíces y musgo bajo la niebla verde. Un tocón hace de mesa de taller.', hint: BOSQUE_HINT }),
};
const panels = [createPanel(app)], panel = panels[0];
app.panelRedraw = () => panels.forEach((p) => p.redraw && p.redraw());
const takePanel = () => { let p = panels.find((x) => !x.visible); if (!p && panels.length < 3) { p = createPanel(app); panels.push(p); p.setCurrent(active ? active.id : ''); } return p || panels[panels.length - 1]; };
const body = createBody(controllers);
const companion = createCompanion(app);
const narr = createNarrator(app); app.narr = narr; narr.onChange = () => panel.redraw();
const primeVoice = () => narr.prime(); addEventListener('pointerdown', primeVoice, { once: true }); addEventListener('keydown', primeVoice, { once: true });
const worlds = {}, loads = {};
const menu = mountMenu({ onSelect: (id) => select(id), onVR: async (id) => { await select(id); startXR('vr'); }, onAR: async (id) => { await select(id); startXR('ar'); } });
$('btnVR').innerHTML = vrButtonHTML; $('btnAR').innerHTML = arButtonHTML;

function load(id) {
  // una sola carga por escena (si dos llamadas coinciden, comparten la misma promesa)
  return (loads[id] ??= (async () => {
    say(`Cargando ${ESCENAS.find((e) => e.id === id).titulo}…`);
    worlds[id] = await FACTORY[id]();
    say('Listo.');
    return worlds[id];
  })());
}
async function select(id) {
  if (active && active.id === id) return;
  const w = await load(id);
  if (active) { active.exit(); panels.forEach((p) => p.hide()); active.scene.remove(body.group); narr.stopAll(); guide.target = -1; companion.unlead(); }
  active = w; w.enter(xrKind); w.scene.add(body.group); companion.attach(w.scene); companion.setAudio(w.audio || null);
  menu.setCurrent(id); panels.forEach((p) => p.setCurrent(id));
  const u = new URL(location.href); u.searchParams.set('escena', id); u.searchParams.delete('vr'); u.searchParams.delete('ar'); history.replaceState(null, '', u);
  document.body.classList.toggle('has-stops', !!w.stops);
  if (xrKind) w.onXRStart && w.onXRStart(xrKind === 'ar' && !w.hasAR ? 'vr' : xrKind);
  say('Listo.');
}

// ---- sesiones XR ----
async function startXR(kind) {
  if (renderer.xr.isPresenting || !navigator.xr) return;
  const init = kind === 'ar'
    ? { requiredFeatures: ['local-floor'], optionalFeatures: ['plane-detection', 'mesh-detection', 'anchors', 'hit-test', 'hand-tracking'] }
    : { requiredFeatures: ['local-floor'], optionalFeatures: ['bounded-floor', 'hand-tracking'] };
  try {
    narr.prime(); active.startAudio && active.startAudio();
    const session = await navigator.xr.requestSession(kind === 'ar' ? 'immersive-ar' : 'immersive-vr', init);
    app.features = session.enabledFeatures ? [...session.enabledFeatures] : [];
    session.addEventListener('end', () => { xrKind = null; setPresenting(false); active && active.onXRStop && active.onXRStop(); panels.forEach((p) => p.hide()); say('Sesión terminada.'); });
    await renderer.xr.setSession(session);
    xrKind = kind; setPresenting(true); active.onXRStart && active.onXRStart(kind === 'ar' && !active.hasAR ? 'vr' : kind);
  } catch (err) { console.error(err); say(`No se pudo iniciar ${kind.toUpperCase()}: ${err.message || err}`); }
}
function setPresenting(on) { $('ui').classList.toggle('hidden', on); menu.hide(on); }
$('btnVR').onclick = () => startXR('vr');
$('btnAR').onclick = () => startXR('ar');
const btnS = $('btnSonido'); const syncS = () => { btnS.textContent = aud.master > 0 ? '🔊 Sonido' : '🔇 Silencio'; }; btnS.onclick = () => { aud.master = aud.master > 0 ? 0 : 1; saveAud(); syncS(); }; syncS();
let support = { ar: false, vr: false };
(async () => {
  if (!navigator.xr) { say('Este navegador no tiene WebXR. Estás en vista previa. Abre esta página en el Meta Quest.'); return; }
  const [ar, vr] = await Promise.all([navigator.xr.isSessionSupported('immersive-ar').catch(() => false), navigator.xr.isSessionSupported('immersive-vr').catch(() => false)]);
  support = { ar, vr }; $('btnAR').disabled = !ar; $('btnVR').disabled = !vr;
  say(ar || vr ? `Listo: ${ar ? 'AR (passthrough)' : ''}${ar && vr ? ' y ' : ''}${vr ? 'VR' : ''} disponible.` : 'Tu navegador tiene WebXR pero ninguna sesión disponible. Vista previa.');
})();

// ---- panel de bolsillo, colihuacho y manos ----
const rcAim = new THREE.Raycaster(), mAim = new THREE.Matrix4();
const aimFrom = (c) => { mAim.identity().extractRotation(c.matrixWorld); rcAim.ray.origin.setFromMatrixPosition(c.matrixWorld); rcAim.ray.direction.set(0, 0, -1).applyMatrix4(mAim); rcAim.far = 8; return rcAim; };
const isHand = (c) => !!(c.userData.src && c.userData.src.hand);
const handNear = (c) => c.getWorldPosition(new THREE.Vector3());
// ¿hay un panel ya sacado justo donde está la mano? (para volver a agarrarlo) / ¿la mano está en un bolsillo? (para sacar otro)
function grabPanelWith(c) {
  const p = handNear(c), exist = panels.find((x) => x.visible && x.mode !== 'held' && x.contains(p));
  if (exist) { exist.hold(c, active.scene); return true; }
  if (body.nearPocket(p) >= 0) { takePanel().hold(c, active.scene); return true; }
  return false;
}
controllers.forEach((c) => {
  c.addEventListener('selectstart', () => {          // gatillo / pellizco
    if (!active) return;
    active.startAudio && active.startAudio(); narr.prime();
    for (const p of panels) if (p.visible) { const i = p.pick(c); if (i >= 0) { app.suppressUntil = performance.now() + 150; p.click(i); return; } }
    if (!companion.held && companion.pickRay(aimFrom(c)) >= 0) { app.suppressUntil = performance.now() + 250; companion.grab(c); return; }
    if (isHand(c) && renderer.xr.isPresenting && grabPanelWith(c)) app.suppressUntil = performance.now() + 250;   // con las manos: pellizcar dentro del bolsillo o sobre un panel
  });
  c.addEventListener('selectend', () => { if (companion.state.holder === c) companion.release(); if (isHand(c)) panels.forEach((p) => { if (p.holder === c) p.release(); }); });
  c.addEventListener('squeezestart', () => {         // grip: sacar un panel del bolsillo o volver a agarrar uno que flota
    if (!active || !renderer.xr.isPresenting) return;
    if (grabPanelWith(c)) app.suppressUntil = performance.now() + 250;
  });
  c.addEventListener('squeezeend', () => panels.forEach((p) => { if (p.holder === c) p.release(); }));
});
// escritorio: clic en el panel, clic en el colihuacho, M = panel, N = siguiente parada
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (renderer.xr.isPresenting || !active) return;
  const r = renderer.domElement.getBoundingClientRect(), ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  rcAim.setFromCamera(ndc, active.camera); rcAim.far = 30;
  for (const p of panels) if (p.visible) { const i = p.pickWith(rcAim); if (i >= 0) { p.click(i); e.stopImmediatePropagation(); return; } }
  if (companion.pickRay(rcAim) >= 0) { app.onCompanionGrab(); e.stopImmediatePropagation(); }
}, true);
const togglePanelDesktop = () => { if (panels.some((p) => p.visible)) panels.forEach((p) => p.release()); else { panel.showFront(active.scene, active.camera); if (active.stops) panel.setPage('clase'); } };
mountTouchUI({ input, onPanel: togglePanelDesktop, onNext: () => { if (active.stops) app.gotoStop(Math.min(active.stops.length - 1, app.stopIndex() + 1)); }, hasStops: true });
addEventListener('keydown', (e) => {
  if (!active || renderer.xr.isPresenting) return;
  if (e.key === 'm' || e.key === 'M') { if (panels.some((p) => p.visible)) panels.forEach((p) => p.release()); else { panel.showFront(active.scene, active.camera); if (active.stops) panel.setPage('clase'); } }
  if ((e.key === 'n' || e.key === 'N') && active.stops) app.gotoStop(Math.min(active.stops.length - 1, app.stopIndex() + 1));
});
const latch = {};
function pollXRInput() {
  const session = renderer.xr.getSession(); if (!session) return;
  for (const src of session.inputSources) {
    const gp = src.gamepad; if (!gp || !gp.buttons[3]) continue;     // clic del joystick = panel delante de ti / mandarlo a volar
    const on = !!gp.buttons[3].pressed, key = src.handedness, mag = Math.hypot(gp.axes[2] || 0, gp.axes[3] || 0);
    if (on && !latch[key] && mag < 0.45) { /* con el joystick empujado, apretarlo es correr: no abre el panel */ app.suppressUntil = performance.now() + 150; if (panels.some((p) => p.visible)) panels.forEach((p) => p.release()); else panel.showFront(active.scene, active.camera); }
    latch[key] = on;
  }
}
// casillas de movimiento del escritorio
const LOCO_DOM = { 'loco-joy': 'joystick', 'loco-snap': 'snap', 'loco-grab': 'grab' };
function syncLocoDom() { Object.entries(LOCO_DOM).forEach(([id, k]) => { const el = $(id); if (el) el.checked = !!loco[k]; }); }
Object.entries(LOCO_DOM).forEach(([id, k]) => { const el = $(id); if (el) el.onchange = () => { loco[k] = el.checked; saveLoco(); }; });
if ($('loco-fis')) $('loco-fis').onclick = () => { loco.joystick = loco.snap = loco.grab = false; saveLoco(); };
syncLocoDom();
window.addEventListener('error', (e) => say('Error: ' + (e.message || e)));
window.addEventListener('unhandledrejection', (e) => say('Error: ' + ((e.reason && e.reason.message) || e.reason)));

addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); Object.values(worlds).forEach((w) => { w.camera.aspect = innerWidth / innerHeight; w.camera.updateProjectionMatrix(); }); });

// ---- arranque ----
const q = new URLSearchParams(location.search);
const wanted = q.get('escena') === 'monteverde' ? 'viaje' : q.get('escena');
const first = FACTORY[wanted] ? wanted : 'casa';
await select(first);
if (q.has('vr') || q.has('ar')) {
  const kind = q.has('vr') ? 'vr' : 'ar';
  const d = document.createElement('div'); d.id = 'splash';
  d.innerHTML = `<button>${kind === 'vr' ? vrButtonHTML : arButtonHTML}</button><p>Toca para entrar en ${kind === 'vr' ? 'realidad virtual. Ponte el visor primero.' : 'realidad mixta (passthrough).'}</p>`;
  d.querySelector('button').onclick = () => { d.remove(); startXR(kind); };
  document.body.appendChild(d);
}

// ---- bucle ----
const clock = new THREE.Clock();
let errCount = 0;
const camPosV = new THREE.Vector3(), camDirV = new THREE.Vector3(), mHead = new THREE.Matrix4();
renderer.setAnimationLoop((_, frame) => {
  const dt = Math.min(clock.getDelta(), 0.1);
  try {
    const xr = renderer.xr.isPresenting;
    body.group.visible = xr;
    panels.forEach((p) => p.update(dt, controllers));
    active.update(dt, frame);                 // aquí se mueve la plataforma del jugador (joystick, arrastre, giro)
    // cabeza: pose EXACTA de este cuadro (antes se leía la del cuadro anterior y el cuerpo quedaba atrasado)
    let have = false;
    if (xr && frame) {
      const ref = renderer.xr.getReferenceSpace(), vp = ref && frame.getViewerPose(ref);
      if (vp) { mHead.fromArray(vp.transform.matrix); if (active.rig) { active.rig.updateMatrixWorld(true); mHead.premultiply(active.rig.matrixWorld); } camPosV.setFromMatrixPosition(mHead); camDirV.set(0, 0, -1).transformDirection(mHead); have = true; }
    }
    if (!have) { const cam = active.camera; cam.getWorldPosition(camPosV); cam.getWorldDirection(camDirV); }
    if (xr) { pollXRInput(); body.update(dt, camPosV, camDirV); body.highlight(companion.held ? body.slotAt(companion.group.getWorldPosition(new THREE.Vector3())) : -1); }
    companion.update(dt, camPosV, camDirV, performance.now() / 1000);
    if (guide.target >= 0 && active.stops) { const s = active.stops[guide.target]; if (Math.hypot(camPosV.x - s.pos[0], camPosV.z - s.pos[2]) < 4.5) { const i = guide.target; guide.target = -1; active.mv.play(i); } }
  } catch (e) { if (errCount++ < 5) { console.error(e); say('Error en la escena: ' + (e.message || e)); } }
  renderer.render(active.scene, active.camera);      // siempre se dibuja, aunque algo falle
});
window.__app = { app, worlds, select, startXR, renderer, panel, panels, body, loco, companion, narr, aud, get active() { return active; } };

