import * as THREE from 'three';
import { THEMES, shared, ThemeState } from './theme.js';
import { buildHall } from './hall.js';
import { RoomScanner } from './room.js';
import { HallAudio } from './audio.js';
import { makeHud } from './hud.js';
import { maybeInstallEmulator } from './emu.js';

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const say = (t) => { statusEl.textContent = t; };

await maybeInstallEmulator();

// ---------- Escena base ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.setClearColor(0x04050a, 1);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.03, 100);
camera.position.set(0, 1.6, 0.4);
scene.add(camera);

const themeState = new ThemeState();
const hall = buildHall(scene);
const scanner = new RoomScanner(scene, hall.planeMaterial);
scanner.group.visible = false;
const hud = makeHud();
scene.add(hud.mesh);
const audio = new HallAudio(camera);

// ---------- Modo: vista previa (PC) / vr / ar ----------
let mode = 'preview';
function setMode(m) {
  mode = m;
  hall.sky.visible = m === 'vr';
  hall.platform.visible = m === 'vr';
  hall.previewRoom.visible = m === 'preview';
  scanner.group.visible = m === 'ar';
  renderer.setClearColor(0x04050a, m === 'ar' ? 0 : 1);
  if (m !== 'ar') scanner.clear();
  $('ui').classList.toggle('hidden', m !== 'preview');
}
setMode('preview');

// ---------- Ambientes ----------
const themesEl = $('themes');
THEMES.forEach((t, i) => {
  const b = document.createElement('button');
  b.textContent = `${i + 1} · ${t.name}`;
  b.onclick = () => chooseTheme(i, hall.portals[i].getWorldPosition(new THREE.Vector3()));
  themesEl.appendChild(b);
});
function markTheme() {
  [...themesEl.children].forEach((b, i) => b.classList.toggle('on', i === themeState.index));
}
function chooseTheme(i, origin) {
  if (themeState.set(i, origin)) { audio.chime(i); markTheme(); }
}
markTheme();

// ---------- Interacción: rayo del control/mano o del mouse ----------
const raycaster = new THREE.Raycaster();
const tmpM = new THREE.Matrix4();
function pick(rc) {
  const hit = rc.intersectObjects(hall.discs, false)[0];
  return hit ? hit.object.userData.themeIndex : -1;
}
function rayFromController(ctrl) {
  tmpM.identity().extractRotation(ctrl.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tmpM);
  return raycaster;
}
const controllers = [0, 1].map((i) => {
  const c = renderer.xr.getController(i);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1.6)]),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }),
  );
  line.name = 'Control::Rayo';
  c.add(line);
  c.addEventListener('select', () => {
    const idx = pick(rayFromController(c));
    if (idx >= 0) chooseTheme(idx, hall.portals[idx].getWorldPosition(new THREE.Vector3()));
  });
  scene.add(c);
  return c;
});

// Mouse en vista previa: arrastrar = mirar, clic = elegir portal
let yaw = 0, pitch = 0, dragging = false, moved = 0, lx = 0, ly = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; audio.start(hall.core, hall.portals); });
addEventListener('pointerup', (e) => {
  if (!dragging) return; dragging = false;
  if (moved < 5 && mode === 'preview') {
    const r = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const idx = pick(raycaster);
    if (idx >= 0) chooseTheme(idx, hall.portals[idx].getWorldPosition(new THREE.Vector3()));
  }
});
addEventListener('pointermove', (e) => {
  if (!dragging || mode !== 'preview') return;
  moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly);
  yaw -= (e.clientX - lx) * 0.004; pitch = Math.max(-1.2, Math.min(1.2, pitch - (e.clientY - ly) * 0.004));
  lx = e.clientX; ly = e.clientY;
});
addEventListener('keydown', (e) => {
  const i = '1234'.indexOf(e.key);
  if (i >= 0) { audio.start(hall.core, hall.portals); chooseTheme(i, hall.portals[i].getWorldPosition(new THREE.Vector3())); }
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- Sesiones XR ----------
const btnAR = $('btnAR'), btnVR = $('btnVR');
let enabledFeatures = [];
async function enter(kind) {
  const xr = navigator.xr;
  const init = kind === 'ar'
    ? { requiredFeatures: ['local-floor'], optionalFeatures: ['plane-detection', 'mesh-detection', 'anchors', 'hit-test', 'hand-tracking'] }
    : { requiredFeatures: ['local-floor'], optionalFeatures: ['bounded-floor', 'hand-tracking'] };
  try {
    audio.start(hall.core, hall.portals);
    const session = await xr.requestSession(kind === 'ar' ? 'immersive-ar' : 'immersive-vr', init);
    enabledFeatures = session.enabledFeatures ? [...session.enabledFeatures] : [];
    session.addEventListener('end', () => { setMode('preview'); say('Sesión terminada.'); });
    await renderer.xr.setSession(session);
    setMode(kind);
  } catch (err) {
    console.error(err);
    say(`No se pudo iniciar ${kind.toUpperCase()}: ${err.message || err}`);
  }
}
btnAR.onclick = () => enter('ar');
btnVR.onclick = () => enter('vr');

async function detect() {
  if (!navigator.xr) { say('Este navegador no tiene WebXR. Estás en vista previa. Abre esta página en el Meta Quest.'); return; }
  const [ar, vr] = await Promise.all([
    navigator.xr.isSessionSupported('immersive-ar').catch(() => false),
    navigator.xr.isSessionSupported('immersive-vr').catch(() => false),
  ]);
  btnAR.disabled = !ar; btnVR.disabled = !vr;
  say(ar || vr ? `Listo: ${ar ? 'AR (passthrough)' : ''}${ar && vr ? ' y ' : ''}${vr ? 'VR' : ''} disponible.` : 'Tu navegador tiene WebXR pero ninguna sesión disponible. Vista previa.');
}
detect();

// ---------- Bucle ----------
const clock = new THREE.Clock();
const tmpV = new THREE.Vector3();
let hudT = 0;
renderer.setAnimationLoop((_, frame) => {
  const dt = Math.min(clock.getDelta(), 0.1);
  shared.uTime.value += dt;
  const t = shared.uTime.value;

  if (mode === 'preview') {
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }
  themeState.update(dt);
  markThemeIfChanged();

  const xrOn = renderer.xr.isPresenting;
  const cam = xrOn ? renderer.xr.getCamera() : camera;

  // Hover de portales con el rayo
  hall.portals.forEach((p) => { p.userData.hoverTarget = false; });
  if (xrOn) controllers.forEach((c) => { const i = pick(rayFromController(c)); if (i >= 0) hall.portals[i].userData.hoverTarget = true; });

  if (frame && mode === 'ar') scanner.update(frame, renderer.xr.getReferenceSpace());
  scanner.meshMat.color.copy(themeState.colA);

  hall.update(dt, t, themeState, cam.getWorldPosition(tmpV));
  hud.follow(cam, dt);

  hudT += dt;
  if (hudT > 0.4) {
    hudT = 0;
    const th = THEMES[themeState.index];
    const labels = Object.entries(scanner.stats.labels).map(([k, v]) => `${k} ${v}`).join(', ');
    hud.set([
      `HALL · ${mode === 'ar' ? 'Realidad mixta' : mode === 'vr' ? 'VR' : 'Vista previa'}`,
      `Ambiente: ${th.name}`,
      mode === 'ar' ? `Planos: ${scanner.stats.planes}${labels ? ` (${labels})` : ''}` : 'Planos: solo en modo AR',
      mode === 'ar' ? `Mallas: ${scanner.stats.meshes}` : '',
      enabledFeatures.length ? `Func: ${enabledFeatures.filter((f) => f !== 'local-floor').join(' ')}` : '',
    ].filter(Boolean), th.a);
  }
  renderer.render(scene, camera);
});

let lastIdx = -1;
function markThemeIfChanged() { if (lastIdx !== themeState.index) { lastIdx = themeState.index; markTheme(); } }

// Para depurar desde la consola
window.__hall = { THREE, scene, camera, renderer, hall, themeState, scanner, chooseTheme };
