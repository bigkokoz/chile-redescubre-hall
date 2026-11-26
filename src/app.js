import * as THREE from 'three';
import { maybeInstallEmulator } from './emu.js';
import { createCasa } from './world_casa.js';
import { createBosque } from './world_bosque.js';
import { mountMenu, ESCENAS, vrButtonHTML, arButtonHTML } from './menu.js';
import { createVRMenu } from './vrmenu.js';

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

const vrMenu = createVRMenu();
const app = {
  renderer, $, say, controllers, extra: $('extra'), features: [], suppressUntil: 0,
  menuOpen: () => vrMenu.open,
  setInfo: ({ titulo, intro, hint }) => { $('titulo').textContent = titulo || ''; $('intro').textContent = intro || ''; $('hint').textContent = hint || ''; },
};

const BOSQUE_HINT = 'PC: arrastra para mirar, WASD para caminar, mantén clic en un objeto para agarrarlo y suéltalo moviendo el mouse para lanzarlo. L = lluvia, H = hora, R = reponer objetos. Quest: joystick izq camina, der gira, gatillo/grip en el aire arrastra el mundo, A = lluvia, B = hora.';
const FACTORY = {
  casa: () => createCasa(app),
  bosque: () => createBosque(app, { id: 'bosque', titulo: 'Bosque de papel', intro: 'Un taller en medio del bosque valdiviano. Camina, agarra herramientas y tazas, mira las mariposas y espera al picaflor.', hint: BOSQUE_HINT }),
  antiguo: () => createBosque(app, { id: 'antiguo', tipo: 'antiguo', titulo: 'Bosque antiguo', intro: 'Troncos enormes con raíces y musgo bajo la niebla verde. Un tocón hace de mesa de taller.', hint: BOSQUE_HINT }),
};
const worlds = {}; let active = null, xrKind = null, loading = null;
const menu = mountMenu({ onSelect: (id) => select(id), onVR: async (id) => { await select(id); startXR('vr'); }, onAR: async (id) => { await select(id); startXR('ar'); } });
$('btnVR').innerHTML = vrButtonHTML; $('btnAR').innerHTML = arButtonHTML;

async function load(id) {
  if (worlds[id]) return worlds[id];
  say(`Cargando ${ESCENAS.find((e) => e.id === id).titulo}…`);
  worlds[id] = await FACTORY[id]();
  say('Listo.');
  return worlds[id];
}
async function select(id) {
  if (active && active.id === id) return;
  if (loading) await loading;
  loading = load(id); const w = await loading; loading = null;
  if (active) { active.exit(); vrMenu.hide(); }
  active = w; w.enter(xrKind);
  menu.setCurrent(id); vrMenu.setCurrent(id);
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
    session.addEventListener('end', () => { xrKind = null; setPresenting(false); active && active.onXRStop && active.onXRStop(); vrMenu.hide(); say('Sesión terminada.'); });
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

// ---- menú dentro del visor ----
controllers.forEach((c) => {
  c.addEventListener('selectstart', () => {
    if (!vrMenu.open) return;
    app.suppressUntil = performance.now() + 150;
    const i = vrMenu.pick(c);
    if (i >= 0) { vrMenu.hide(); select(ESCENAS[i].id); }
  });
});
const latch = {};
function pollXRInput() {
  const session = renderer.xr.getSession(); if (!session) return;
  for (const src of session.inputSources) {
    const gp = src.gamepad; if (!gp || !gp.buttons[3]) continue;     // clic del joystick = abrir/cerrar el menú
    const on = !!gp.buttons[3].pressed, key = src.handedness;
    if (on && !latch[key]) { app.suppressUntil = performance.now() + 150; if (vrMenu.open) vrMenu.hide(); else vrMenu.show(active.scene, renderer.xr.getCamera()); }
    latch[key] = on;
  }
}

addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); Object.values(worlds).forEach((w) => { w.camera.aspect = innerWidth / innerHeight; w.camera.updateProjectionMatrix(); }); });

// ---- arranque ----
const q = new URLSearchParams(location.search);
const first = FACTORY[q.get('escena')] ? q.get('escena') : 'casa';
await select(first);
// precarga las otras escenas livianas en segundo plano (el botón VR de otra tarjeta entra más rápido)
setTimeout(() => ESCENAS.filter((e) => e.id !== first && e.id !== 'casa').reduce((p, e) => p.then(() => new Promise((r) => setTimeout(r, 600))).then(() => load(e.id)).catch(() => {}), Promise.resolve()), 2500);
if (q.has('vr') || q.has('ar')) {
  const kind = q.has('vr') ? 'vr' : 'ar';
  const d = document.createElement('div'); d.id = 'splash';
  d.innerHTML = `<button>${kind === 'vr' ? vrButtonHTML : arButtonHTML}</button><p>Toca para entrar en ${kind === 'vr' ? 'realidad virtual. Ponte el visor primero.' : 'realidad mixta (passthrough).'}</p>`;
  d.querySelector('button').onclick = () => { d.remove(); startXR(kind); };
  document.body.appendChild(d);
}

// ---- bucle ----
const clock = new THREE.Clock();
renderer.setAnimationLoop((_, frame) => {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (renderer.xr.isPresenting) { pollXRInput(); vrMenu.update(controllers); }
  active.update(dt, frame);
  renderer.render(active.scene, active.camera);
});
window.__app = { app, worlds, select, startXR, renderer, vrMenu, get active() { return active; } };
