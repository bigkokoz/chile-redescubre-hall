import * as THREE from 'three';
import { THEMES, shared as themeShared, ThemeState, makeSurfaceMaterial } from './theme.js';
import { buildCasa } from './casa.js';
import { createToys } from './juguetes.js';
import { createBirds } from './pajaros.js';
import { RoomScanner } from './room.js';
import { HallAudio } from './audio.js';
import { makeHud } from './hud.js';

export async function createCasa(app) {
const { renderer, $, say } = app;

// ---------- Escena base ----------
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
const audio = new HallAudio(camera); audio.prefs = app.aud;
scene.add(audio.sfxRoot);
const audioObjs = [casa.slotAnchor, ...casa.discs.map((d) => d.holder)];
const toys = createToys({ casa, audio });
const birds = createBirds(scene, audio);
const mouseHand = new THREE.Object3D(); mouseHand.name = 'Mano::Mouse'; scene.add(mouseHand);

// ---------- Modo: vista previa (PC) / vr / ar ----------
let mode = 'preview';
let stationPlaced = false, arT = 0;
function setMode(m) {
  mode = m;
  casa.setMode(m);
  birds.setVisible(m !== 'ar');
  scanner.group.visible = m === 'ar';
  renderer.setClearColor(0x04050a, m === 'ar' ? 0 : 1);
  if (m !== 'ar') { scanner.clear(); } else { stationPlaced = false; arT = 0; }
}
let active = false;
const panel = document.createElement('div'); panel.innerHTML = '<div id="themes"></div>'; panel.style.display = 'none'; app.extra.appendChild(panel);
const themesEl = panel.firstElementChild;

// ---------- Ambientes ----------
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
function pickItem(rc) {
  const hit = rc.intersectObjects([...casa.discMeshes(), ...toys.pickables()], false)[0];
  if (!hit) return null;
  const toy = hit.object.userData.toy;
  return toy ? { kind: 'toy', ref: toy, dist: hit.distance } : { kind: 'disc', ref: casa.discOf(hit.object), dist: hit.distance };
}
function grabItem(it, hand) { if (it.kind === 'disc') { casa.grab(it.ref, hand); toys.track(it.ref.holder); } else toys.grab(it.ref, hand); }
function releaseItem(it) {
  if (it.kind === 'disc') casa.release(it.ref, toys.untrack(it.ref.holder));
  else toys.release(it.ref);
}
function rayFromController(ctrl) {
  tmpM.identity().extractRotation(ctrl.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tmpM);
  raycaster.far = 6;
  return raycaster;
}
const held = new Map();
const controllers = app.controllers;
const busy = () => !active || performance.now() < app.suppressUntil || app.menuOpen();
controllers.forEach((c) => {
  const line = c.userData.line;
  const start = () => {
    if (busy()) return;
    audio.start(casa.slotAnchor, audioObjs);
    const it = pickItem(rayFromController(c));
    if (it) { grabItem(it, c); held.set(c, it); line.visible = false; }
  };
  const end = () => {
    const it = held.get(c);
    if (it) { releaseItem(it); held.delete(c); }
    line.visible = true;
  };
  c.addEventListener('selectstart', start); c.addEventListener('selectend', end);
  c.addEventListener('squeezestart', start); c.addEventListener('squeezeend', end);
});
raycaster.far = Infinity;

// Mouse en vista previa: arrastrar el fondo = mirar; mantener sobre un objeto = agarrarlo y lanzarlo
let yaw = 0, pitch = -0.12, dragging = false, lx = 0, ly = 0;
const mouseNdc = new THREE.Vector2(); let mouseHover = null, mouseItem = null, mouseDist = 1;
function setRayFromMouse(e) {
  const r = renderer.domElement.getBoundingClientRect();
  mouseNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(mouseNdc, camera); raycaster.far = 50;
}
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!active) return;
  audio.start(casa.slotAnchor, audioObjs);
  if (mode === 'preview') {
    setRayFromMouse(e);
    const it = pickItem(raycaster);
    if (it) { mouseItem = it; mouseDist = it.dist; mouseHand.position.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, mouseDist); mouseHand.quaternion.copy(camera.quaternion); mouseHand.updateMatrixWorld(true); grabItem(it, mouseHand); return; }
  }
  dragging = true; lx = e.clientX; ly = e.clientY;
});
addEventListener('pointerup', () => {
  if (!active) return;
  dragging = false;
  if (mouseItem) { releaseItem(mouseItem); mouseItem = null; }
});
addEventListener('pointermove', (e) => {
  if (!active) return;
  if (mode === 'preview') {
    setRayFromMouse(e);
    if (!mouseItem) { mouseHover = pickItem(raycaster); renderer.domElement.style.cursor = mouseHover ? 'pointer' : (dragging ? 'grabbing' : 'grab'); }
  }
  if (!dragging || mode !== 'preview') return;
  yaw -= (e.clientX - lx) * 0.004; pitch = Math.max(-1.2, Math.min(1.2, pitch - (e.clientY - ly) * 0.004));
  lx = e.clientX; ly = e.clientY;
});
addEventListener('keydown', (e) => {
  if (!active) return;
  audio.start(casa.slotAnchor, audioObjs);
  const i = '1234'.indexOf(e.key);
  if (i >= 0) casa.insert(casa.discs[i]);
  if (e.key === '0') ejectHome();
  if (e.key === 'r' || e.key === 'R') toys.resetAll();
});
// ---------- Recorrido automático: cuando nadie toca nada, la cámara pasea por la sala ----------
const P3 = (a) => a.map((p) => new THREE.Vector3(...p));
const TOUR_POS = new THREE.CatmullRomCurve3(P3([[0, 1.62, 0.2], [0.8, 1.55, -0.15], [2.4, 1.6, -0.3], [2.5, 1.7, -1.9], [0.3, 1.7, -1.9], [-2.3, 1.7, -1.5], [-2.4, 1.6, -0.3], [-1.5, 1.5, 1.0], [-0.3, 1.55, 0.8]]), true, 'centripetal');
const TOUR_LOOK = new THREE.CatmullRomCurve3(P3([[0, 1.3, -1.4], [0.2, 1.0, -1.35], [0.3, 1.2, -1.5], [0.5, 1.6, -3.5], [0, 1.5, -30], [-1.0, 1.2, -1.0], [-1.0, 1.1, -1.2], [0.5, 0.8, 2.2], [0, 1.2, -1.4]]), true, 'centripetal');
let lastInput = performance.now(), tourBlend = 0, tourT = 0;
const poke = () => { if (!active) return; lastInput = performance.now(); if (tourBlend > 0.15) { const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ'); yaw = e.y; pitch = e.x; } };
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => addEventListener(ev, poke, { passive: true }));
addEventListener('pointermove', (e) => { if (e.buttons) poke(); });
const tM4 = new THREE.Matrix4(), tQa = new THREE.Quaternion(), tQb = new THREE.Quaternion(), tE = new THREE.Euler(), tPm = new THREE.Vector3(0, 1.62, 0), tP = new THREE.Vector3(), tL = new THREE.Vector3(), tUp = new THREE.Vector3(0, 1, 0);
function previewCamera(dt) {
  const idle = performance.now() - lastInput > 3500;
  tourBlend += ((idle ? 1 : 0) - tourBlend) * Math.min(1, dt * (idle ? 0.8 : 4));
  if (tourBlend < 0.002) { camera.position.copy(tPm); camera.rotation.set(pitch, yaw, 0, 'YXZ'); return; }
  tourT += dt * Math.min(1, tourBlend * 1.2);
  const u = (tourT / 95) % 1;
  TOUR_POS.getPoint(u, tP); TOUR_LOOK.getPoint(u, tL);
  tQa.setFromEuler(tE.set(pitch, yaw, 0, 'YXZ'));
  tM4.lookAt(tP, tL, tUp); tQb.setFromRotationMatrix(tM4);
  const e = tourBlend * tourBlend * (3 - 2 * tourBlend);
  camera.position.lerpVectors(tPm, tP, e); camera.quaternion.slerpQuaternions(tQa, tQb, e);
}

// ---------- Bucle ----------
const tmpV = new THREE.Vector3();
let hudT = 0, lastIdx = -1, enabledFeatures = [];
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
function update(dt, frame) {
  if (audio.pad) audio.pad.setVolume(0.55 * (app.aud.ambiente ?? 1) * (app.aud.master ?? 1));
  themeShared.uTime.value += dt;
  const t = themeShared.uTime.value;

  if (mode === 'preview') previewCamera(dt);
  themeState.update(dt);
  if (lastIdx !== themeState.index) { lastIdx = themeState.index; markTheme(); }

  const xrOn = renderer.xr.isPresenting;
  const cam = xrOn ? renderer.xr.getCamera() : camera;

  // Disco bajo el rayo (resaltado)
  const hover = new Set();
  toys.hoverSet.clear();
  const markHover = (it) => { if (!it) return; if (it.kind === 'disc') hover.add(it.ref.i); else toys.hoverSet.add(it.ref); };
  if (xrOn) controllers.forEach((c) => { if (!held.has(c)) markHover(pickItem(rayFromController(c))); });
  else if (mode === 'preview' && !mouseItem) markHover(mouseHover);
  if (mouseItem) {
    raycaster.setFromCamera(mouseNdc, camera);
    mouseHand.position.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, mouseDist);
    mouseHand.quaternion.copy(camera.quaternion); mouseHand.updateMatrixWorld(true);
  }

  if (frame && mode === 'ar') {
    scanner.update(frame, renderer.xr.getReferenceSpace());
    arT += dt;
    if (!stationPlaced) stationPlaced = placeStationAR(cam);
  }
  scanner.meshMat.color.copy(themeState.colA);

  casa.update(dt, t, themeState, cam.getWorldPosition(tmpV), hover);
  toys.update(dt, themeState);
  birds.update(dt, themeState.index, cam.getWorldPosition(tmpV));
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
      mode === 'ar' ? `Planos: ${scanner.stats.planes}${labels ? ` (${labels})` : ''}` : 'Agarra y lanza: discos, tazas, pelotas',
      mode === 'ar' ? `Mallas: ${scanner.stats.meshes}` : 'Clic del joystick: escenas',
      enabledFeatures.length ? `Func: ${enabledFeatures.filter((f) => f !== 'local-floor').join(' ')}` : '',
    ].filter(Boolean), th.a);
  }
}

function applyActive(on, xrKind) {
  active = on; panel.style.display = on ? '' : 'none';
  audio.listener.setMasterVolume(on ? 1 : 0);
  if (on) { controllers.forEach((c) => scene.add(c)); setMode(xrKind || 'preview'); enabledFeatures = app.features || []; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); app.setInfo({ titulo: 'Casa del hall', intro: 'Una casa con terraza a la selva. Agarra un disco, mételo en la computadora y todo se transforma. También puedes lanzar tazas, pelotas y orbes.', hint: 'Vista previa en PC: arrastra el fondo para mirar. Mantén el clic sobre un objeto para agarrarlo y suéltalo moviendo el mouse para lanzarlo (clic corto en un disco = insertarlo). Teclas 1–4 = discos, 0 = volver a la casa, R = reponer objetos.' }); }
}

// Para depurar desde la consola
window.__hall = { THREE, toys, birds, scene, camera, renderer, casa, themeState, scanner, chooseTheme, look: (y, p) => { yaw = y; pitch = p; } };

return {
  id: 'casa', scene, camera, update, hasAR: true, audio, startAudio: () => audio.start(casa.slotAnchor, audioObjs),
  enter: (xrKind) => applyActive(true, xrKind), exit: () => applyActive(false),
  onXRStart: (k) => { setMode(k); enabledFeatures = app.features || []; }, onXRStop: () => setMode('preview'),
};
}
