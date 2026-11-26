import * as THREE from 'three';
import { THEMES, shared, ThemeState, makeSurfaceMaterial } from './theme.js';
import { buildCasa } from './casa.js';
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
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.03, 1200);
camera.position.set(0, 1.62, 0);
scene.add(camera);

const themeState = new ThemeState();
say('Cargando la casa…');
const casa = await buildCasa(scene, say);
const planeMaterial = makeSurfaceMaterial({ alpha: 0.85 });
const scanner = new RoomScanner(scene, planeMaterial);
scanner.group.visible = false;
const hud = makeHud();
scene.add(hud.mesh);
const audio = new HallAudio(camera);
const audioObjs = [casa.slotAnchor, ...casa.discs.map((d) => d.holder)];

// ---------- Modo: vista previa (PC) / vr / ar ----------
let mode = 'preview';
let stationPlaced = false, arT = 0;
function setMode(m) {
  mode = m;
  casa.setMode(m);
  scanner.group.visible = m === 'ar';
  renderer.setClearColor(0x04050a, m === 'ar' ? 0 : 1);
  if (m !== 'ar') { scanner.clear(); } else { stationPlaced = false; arT = 0; }
  $('ui').classList.toggle('hidden', m !== 'preview');
}
setMode('preview');

// ---------- Ambientes ----------
const themesEl = $('themes');
let prevTheme = 0;
THEMES.forEach((t, i) => {
  const b = document.createElement('button');
  b.textContent = t.name;
  b.onclick = () => { audio.start(casa.slotAnchor, audioObjs); chooseTheme(i); };
  themesEl.appendChild(b);
});
function markTheme() {
  [...themesEl.children].forEach((b, i) => b.classList.toggle('on', i === themeState.index));
}
function chooseTheme(i) {
  if (i === themeState.index && themeState.waveR >= 50) return;
  const origin = casa.slotWorld();
  casa.beginTheme(i, prevTheme);
  if (themeState.set(i, origin)) { prevTheme = i; audio.chime(i); markTheme(); }
}
// al terminar la animación de inserción se dispara el cambio
casa.onInserted = (d) => chooseTheme(d.themeIndex);
function ejectHome() { casa.eject(); chooseTheme(0); }
markTheme();

// ---------- Interacción: rayo del control/mano o del mouse ----------
const raycaster = new THREE.Raycaster();
const tmpM = new THREE.Matrix4();
function pickDisc(rc) {
  const hit = rc.intersectObjects(casa.discMeshes(), false)[0];
  return hit ? casa.discOf(hit.object) : null;
}
function rayFromController(ctrl) {
  tmpM.identity().extractRotation(ctrl.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tmpM);
  raycaster.far = 6;
  return raycaster;
}
const held = new Map();
const controllers = [0, 1].map((i) => {
  const c = renderer.xr.getController(i);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1.2)]),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }),
  );
  line.name = 'Control::Rayo';
  c.add(line);
  const start = () => {
    audio.start(casa.slotAnchor, audioObjs);
    const d = pickDisc(rayFromController(c));
    if (d) { casa.grab(d, c); held.set(c, d); line.visible = false; }
  };
  const end = () => {
    const d = held.get(c);
    if (d) { casa.release(d); held.delete(c); }
    line.visible = true;
  };
  c.addEventListener('selectstart', start); c.addEventListener('selectend', end);
  c.addEventListener('squeezestart', start); c.addEventListener('squeezeend', end);
  scene.add(c);
  return c;
});
raycaster.far = Infinity;

// Mouse en vista previa: arrastrar = mirar, clic en un disco = insertarlo
let yaw = 0, pitch = -0.12, dragging = false, moved = 0, lx = 0, ly = 0;
const mouseNdc = new THREE.Vector2(); let mouseHover = null;
function setRayFromMouse(e) {
  const r = renderer.domElement.getBoundingClientRect();
  mouseNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(mouseNdc, camera); raycaster.far = 50;
}
renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; audio.start(casa.slotAnchor, audioObjs); });
addEventListener('pointerup', (e) => {
  if (!dragging) return; dragging = false;
  if (moved < 5 && mode === 'preview') {
    setRayFromMouse(e);
    const d = pickDisc(raycaster);
    if (d) casa.insert(d);
  }
});
addEventListener('pointermove', (e) => {
  if (mode === 'preview') { setRayFromMouse(e); mouseHover = pickDisc(raycaster); renderer.domElement.style.cursor = mouseHover ? 'pointer' : (dragging ? 'grabbing' : 'grab'); }
  if (!dragging || mode !== 'preview') return;
  moved += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly);
  yaw -= (e.clientX - lx) * 0.004; pitch = Math.max(-1.2, Math.min(1.2, pitch - (e.clientY - ly) * 0.004));
  lx = e.clientX; ly = e.clientY;
});
addEventListener('keydown', (e) => {
  audio.start(casa.slotAnchor, audioObjs);
  const i = '1234'.indexOf(e.key);
  if (i >= 0) casa.insert(casa.discs[i]);
  if (e.key === '0') ejectHome();
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
    audio.start(casa.slotAnchor, audioObjs);
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
let hudT = 0, lastIdx = -1;
function placeStationAR(cam) {
  // 1) una mesa real detectada (Quest) 2) si no, 0.9 m delante a 0.75 m de altura
  let point = null;
  for (const [plane, rec] of scanner.planes) {
    if ((plane.semanticLabel || '').toLowerCase() === 'table') {
      const e = rec.mesh.matrix.elements; point = new THREE.Vector3(e[12], e[13], e[14]); break;
    }
  }
  const camPos = cam.getWorldPosition(new THREE.Vector3());
  const dir = cam.getWorldDirection(new THREE.Vector3()); dir.y = 0; dir.normalize();
  if (!point) { if (arT < 2.5) return false; point = camPos.clone().addScaledVector(dir, 0.9); point.y = 0.75; }
  const yaw = Math.atan2(camPos.x - point.x, camPos.z - point.z);
  casa.placeOnTable(point, yaw);
  return true;
}
renderer.setAnimationLoop((_, frame) => {
  const dt = Math.min(clock.getDelta(), 0.1);
  shared.uTime.value += dt;
  const t = shared.uTime.value;

  if (mode === 'preview') camera.rotation.set(pitch, yaw, 0, 'YXZ');
  themeState.update(dt);
  if (lastIdx !== themeState.index) { lastIdx = themeState.index; markTheme(); }

  const xrOn = renderer.xr.isPresenting;
  const cam = xrOn ? renderer.xr.getCamera() : camera;

  // Disco bajo el rayo (resaltado)
  const hover = new Set();
  if (xrOn) controllers.forEach((c) => { if (!held.has(c)) { const d = pickDisc(rayFromController(c)); if (d) hover.add(d.i); } });
  else if (mode === 'preview' && mouseHover) hover.add(mouseHover.i);

  if (frame && mode === 'ar') {
    scanner.update(frame, renderer.xr.getReferenceSpace());
    arT += dt;
    if (!stationPlaced) stationPlaced = placeStationAR(cam);
  }
  scanner.meshMat.color.copy(themeState.colA);

  casa.update(dt, t, themeState, cam.getWorldPosition(tmpV), hover);
  hud.mesh.visible = xrOn;
  hud.follow(cam, dt);

  hudT += dt;
  if (hudT > 0.4) {
    hudT = 0;
    const th = THEMES[themeState.index];
    const labels = Object.entries(scanner.stats.labels).map(([k, v]) => `${k} ${v}`).join(', ');
    hud.set([
      `HALL · ${mode === 'ar' ? 'Realidad mixta' : mode === 'vr' ? 'VR' : 'Vista previa'}`,
      `Ambiente: ${th.name}`,
      mode === 'ar' ? `Planos: ${scanner.stats.planes}${labels ? ` (${labels})` : ''}` : 'Agarra un disco y mételo en la ranura',
      mode === 'ar' ? `Mallas: ${scanner.stats.meshes}` : '',
      enabledFeatures.length ? `Func: ${enabledFeatures.filter((f) => f !== 'local-floor').join(' ')}` : '',
    ].filter(Boolean), th.a);
  }
  renderer.render(scene, camera);
});

// Para depurar desde la consola
window.__hall = { THREE, scene, camera, renderer, casa, themeState, scanner, chooseTheme, look: (y, p) => { yaw = y; pitch = p; } };
