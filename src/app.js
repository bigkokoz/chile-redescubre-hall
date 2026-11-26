import * as THREE from 'three';
import { maybeInstallEmulator } from './emu.js';
import { createCasa } from './world_casa.js';
import { createBosque } from './world_bosque.js';
import { mountMenu, ESCENAS, vrButtonHTML, arButtonHTML } from './menu.js';
import { createBody, createPanel } from './bolsillo.js';

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
const LOCO_DEF = { joystick: true, snap: true, grab: true, speed: 2.2, gain: 1.6, snapDeg: 30 };
let savedLoco = {}; try { savedLoco = JSON.parse(localStorage.getItem('hall.loco') || '{}'); } catch { /* sin guardado */ }
const loco = { ...LOCO_DEF, ...savedLoco };
const saveLoco = () => { try { localStorage.setItem('hall.loco', JSON.stringify(loco)); } catch { /* ignorar */ } syncLocoDom(); };
const app = {
  renderer, $, say, controllers, extra: $('extra'), features: [], suppressUntil: 0, loco, saveLoco,
  menuOpen: () => panel.blocking,
  selectScene: (id) => select(id),
  activeControls: () => (active && active.controls) || null,
  setInfo: ({ titulo, intro, hint }) => { $('titulo').textContent = titulo || ''; $('intro').textContent = intro || ''; $('hint').textContent = hint || ''; },
};

const BOSQUE_HINT = 'PC: arrastra para mirar, WASD para caminar, mantén clic en un objeto para agarrarlo y suéltalo moviendo el mouse para lanzarlo. L = lluvia, H = hora, R = reponer objetos. Quest: joystick izq camina, der gira, gatillo/grip en el aire arrastra el mundo, A = lluvia, B = hora.';
const FACTORY = {
  casa: () => createCasa(app),
  bosque: () => createBosque(app, { id: 'bosque', titulo: 'Bosque de papel', intro: 'Un taller en medio del bosque valdiviano. Camina, agarra herramientas y tazas, mira las mariposas y espera al picaflor.', hint: BOSQUE_HINT }),
  antiguo: () => createBosque(app, { id: 'antiguo', tipo: 'antiguo', titulo: 'Bosque antiguo', intro: 'Troncos enormes con raíces y musgo bajo la niebla verde. Un tocón hace de mesa de taller.', hint: BOSQUE_HINT }),
};
const panel = createPanel(app);
const body = createBody(controllers);
const worlds = {}, loads = {}; let active = null, xrKind = null;
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
  if (active) { active.exit(); panel.hide(); active.scene.remove(body.group); }
  active = w; w.enter(xrKind); w.scene.add(body.group);
  menu.setCurrent(id); panel.setCurrent(id);
  const u = new URL(location.href); u.searchParams.set('escena', id); u.searchParams.delete('vr'); u.searchParams.delete('ar'); history.replaceState(null, '', u);
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
    const session = await navigator.xr.requestSession(kind === 'ar' ? 'immersive-ar' : 'immersive-vr', init);
    app.features = session.enabledFeatures ? [...session.enabledFeatures] : [];
    session.addEventListener('end', () => { xrKind = null; setPresenting(false); active && active.onXRStop && active.onXRStop(); panel.hide(); say('Sesión terminada.'); });
    await renderer.xr.setSession(session);
    xrKind = kind; setPresenting(true); active.onXRStart && active.onXRStart(kind === 'ar' && !active.hasAR ? 'vr' : kind);
  } catch (err) { console.error(err); say(`No se pudo iniciar ${kind.toUpperCase()}: ${err.message || err}`); }
}
function setPresenting(on) { $('ui').classList.toggle('hidden', on); menu.hide(on); }
$('btnVR').onclick = () => startXR('vr');
$('btnAR').onclick = () => startXR('ar');
let support = { ar: false, vr: false };
(async () => {
  if (!navigator.xr) { say('Este navegador no tiene WebXR. Estás en vista previa. Abre esta página en el Meta Quest.'); return; }
  const [ar, vr] = await Promise.all([navigator.xr.isSessionSupported('immersive-ar').catch(() => false), navigator.xr.isSessionSupported('immersive-vr').catch(() => false)]);
  support = { ar, vr }; $('btnAR').disabled = !ar; $('btnVR').disabled = !vr;
  say(ar || vr ? `Listo: ${ar ? 'AR (passthrough)' : ''}${ar && vr ? ' y ' : ''}${vr ? 'VR' : ''} disponible.` : 'Tu navegador tiene WebXR pero ninguna sesión disponible. Vista previa.');
})();

// ---- panel de bolsillo dentro del visor ----
controllers.forEach((c) => {
  c.addEventListener('selectstart', () => {          // gatillo: pulsar un botón del panel
    if (!panel.visible) return;
    const i = panel.pick(c);
    if (i >= 0) { app.suppressUntil = performance.now() + 150; panel.click(i); }
  });
  c.addEventListener('squeezestart', () => {         // grip con la mano en un bolsillo: sacar el panel
    if (!active || !renderer.xr.isPresenting) return;
    const p = c.getWorldPosition(new THREE.Vector3());
    if (body.nearPocket(p) >= 0) { app.suppressUntil = performance.now() + 250; panel.hold(c, active.scene); }
  });
  c.addEventListener('squeezeend', () => { if (panel.holder === c) panel.release(); });
});
const latch = {};
function pollXRInput() {
  const session = renderer.xr.getSession(); if (!session) return;
  for (const src of session.inputSources) {
    const gp = src.gamepad; if (!gp || !gp.buttons[3]) continue;     // clic del joystick = panel delante de ti / mandarlo a volar
    const on = !!gp.buttons[3].pressed, key = src.handedness;
    if (on && !latch[key]) { app.suppressUntil = performance.now() + 150; if (panel.visible) panel.release(); else panel.showFront(active.scene, renderer.xr.getCamera()); }
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
const first = FACTORY[q.get('escena')] ? q.get('escena') : 'casa';
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
renderer.setAnimationLoop((_, frame) => {
  const dt = Math.min(clock.getDelta(), 0.1);
  try {
    const xr = renderer.xr.isPresenting;
    body.group.visible = xr;
    if (xr) {
      pollXRInput();
      const cam = renderer.xr.getCamera();
      body.update(dt, cam.getWorldPosition(new THREE.Vector3()), cam.getWorldDirection(new THREE.Vector3()));
    }
    panel.update(dt, controllers);
    active.update(dt, frame);
  } catch (e) { if (errCount++ < 5) { console.error(e); say('Error en la escena: ' + (e.message || e)); } }
  renderer.render(active.scene, active.camera);      // siempre se dibuja, aunque algo falle
});
window.__app = { app, worlds, select, startXR, renderer, panel, body, loco, get active() { return active; } };
