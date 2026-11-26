import * as THREE from 'three';
import * as P from './papel.js';
import { createToys, makeCup } from './juguetes.js';
import { HallAudio } from './audio.js';
import { makeHud } from './hud.js';

// ============================================================================
// BOSQUE DE PAPEL — mundo recorrible (VR). Estilo "papel recortado en capas":
// árboles/plantas son láminas con recorte (alphaTest) que miran al jugador sin girar hacia arriba (billboard cilíndrico),
// repartidas en anillos de profundidad. Todo se genera por código: nada que descargar.
// ============================================================================

export async function createBosque(app, cfg = {}) {
const { renderer, $, say } = app;
cfg = { id: 'bosque', titulo: 'Bosque de papel', ...cfg };
const ID = (k) => `${cfg.id}-${k}`;
const panel = document.createElement('div'); panel.style.display = 'none';
panel.innerHTML = `<div class="row"><button id="${ID('rain')}">Llover</button><button id="${ID('hora')}">Hora: mañana</button></div><label>Densidad de plantas <input type="range" id="${ID('dens')}" min="0.2" max="1" step="0.05" value="1"></label><label>Niebla <input type="range" id="${ID('niebla')}" min="0.4" max="2" step="0.05" value="1"></label>`;
app.extra.appendChild(panel);
let active = false;

// ---- parámetros que se pueden tocar ----
const PARAM = { densidad: 1, niebla: 1, hora: 0, lluvia: false };
const LOCO = {
  velocidad: 2.2,          // m/s con el joystick
  giroGrados: 30,          // giro por pasos
  agarreGanancia: 1.6,     // cuánto se mueve el mundo por cada cm que mueves la mano
  zonaMuerta: 0.15,
  radioMax: 48,
};
const ANT = cfg.tipo === 'antiguo';
const HORAS = ANT ? [
  { n: 'mañana', bg: 0xdcf0bc, fog: 0xd6edb2, near: 2, far: 32, tint: [1.02, 1.07, 0.92], hemi: 1.0, glow: 0xf6ffd0, glowOp: 0.3, fire: 0, mariposas: 1 },
  { n: 'hora dorada', bg: 0xf2e0a0, fog: 0xe6d596, near: 3, far: 64, tint: [1.12, 1.02, 0.76], hemi: 0.9, glow: 0xffd070, glowOp: 0.7, fire: 0.25, mariposas: 1 },
  { n: 'noche', bg: 0x061208, fog: 0x0a1c0c, near: 2, far: 36, tint: [0.4, 0.62, 0.5], hemi: 0.45, glow: 0x9fffa0, glowOp: 0.12, fire: 1, mariposas: 0 },
] : [
  { n: 'mañana', bg: 0xcfe3c4, fog: 0xcfe3c4, near: 3, far: 62, tint: [1, 1, 1], hemi: 1.0, glow: 0xffffff, glowOp: 0.25, fire: 0, mariposas: 1 },
  { n: 'hora dorada', bg: 0xf0c48a, fog: 0xe9b97c, near: 4, far: 78, tint: [1.12, 0.92, 0.72], hemi: 0.9, glow: 0xffb060, glowOp: 0.75, fire: 0.25, mariposas: 1 },
  { n: 'noche', bg: 0x06130e, fog: 0x08201a, near: 2, far: 40, tint: [0.34, 0.5, 0.56], hemi: 0.45, glow: 0x66ffd0, glowOp: 0.12, fire: 1, mariposas: 0 },
];

// ---- escena base ----
const scene = new THREE.Scene();
scene.background = new THREE.Color(HORAS[0].bg);
scene.fog = new THREE.Fog(HORAS[0].fog, HORAS[0].near, HORAS[0].far);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.03, 300);
camera.position.set(0, 1.62, 0);
const rig = new THREE.Group(); rig.name = 'Jugador'; rig.add(camera); scene.add(rig);
rig.position.set(-0.3, ANT ? 0 : 0.3, ANT ? 1.1 : 0.8);
const world = new THREE.Group(); world.name = 'Mundo'; scene.add(world);

const hemi = new THREE.HemisphereLight(0xffffff, 0x6a7a4a, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dd, 1.3); sun.position.set(-4, 8, 3); scene.add(sun);

// ---- material "papel" con tinte por hora ----
const tinted = [];       // {mat, mul}
const tint = new THREE.Color(1, 1, 1);
function reg(mat, mul = 1) { tinted.push({ mat, mul }); mat.color.setRGB(tint.r * mul, tint.g * mul, tint.b * mul); return mat; }
function billboard(mat) {
  mat.customProgramCacheKey = () => 'bill';
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', /* glsl */`
      vec3 ctr = vec3(instanceMatrix[3]);
      float sx = length(vec3(instanceMatrix[0])), sy = length(vec3(instanceMatrix[1]));
      vec3 toCam = cameraPosition - ctr; toCam.y = 0.0; toCam = normalize(toCam + vec3(1e-5));
      vec3 rgt = vec3(toCam.z, 0.0, -toCam.x);
      vec4 mvPosition = viewMatrix * vec4(ctr + rgt * transformed.x * sx + vec3(0.0, transformed.y * sy, 0.0), 1.0);
      gl_Position = projectionMatrix * mvPosition;`);
  };
  return mat;
}
const cardGeo = new THREE.PlaneGeometry(1, 1); cardGeo.translate(0, 0.5, 0);
const layers = [];
function cards(canvas, count, rMin, rMax, hMin, hMax, aspect, mul, seed, y = 0) {
  const mat = reg(billboard(new THREE.MeshBasicMaterial({ map: P.toTex(canvas), alphaTest: 0.45, side: THREE.DoubleSide, fog: true })), mul);
  const mesh = new THREE.InstancedMesh(cardGeo, mat, count);
  const r = P.rng(seed), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    let x = 0, z = 0;
    for (let k = 0; k < 8; k++) {
      const a = r() * 6.283, rad = rMin + Math.sqrt(r()) * (rMax - rMin);
      x = Math.cos(a) * rad; z = Math.sin(a) * rad;
      if (!(Math.abs(x) < 3.3 && z > -4.2 && z < 3.3)) break;      // no encima de la plataforma
    }
    const h = hMin + r() * (hMax - hMin);
    m.compose(pos.set(x, y, z), q, s.set(h * aspect, h, 1)); mesh.setMatrixAt(i, m);
  }
  mesh.frustumCulled = false; mesh.userData.full = count; scene.add(mesh); layers.push(mesh);
  return mesh;
}

// ---- árboles y plantas por anillos de profundidad ----
if (ANT) {
  // árboles antiguos: troncos enormes con raíces abiertas y musgo lima, muy cerca (visto desde abajo)
  const anc = [1, 2, 3, 4].map((k) => P.ancientCanvas(60 + k * 7));
  const ring = (n, rMin, rMax, hMin, hMax, mul, seed) => anc.forEach((c, k) => cards(c, Math.ceil(n / 4), rMin, rMax, hMin, hMax, 0.8, mul, seed + k));
  ring(9, 5.5, 9, 5, 7.5, 1.0, 100); ring(24, 9, 16, 7, 11, 0.98, 200); ring(50, 16, 28, 9, 14, 0.95, 300); ring(80, 28, 50, 11, 17, 0.92, 400);
  [1, 2].forEach((k) => cards(P.fernCanvas(20 + k), 28, 2.6, 22, 0.7, 1.3, 1.0, 1.0, 500 + k));
  cards(P.nalcaCanvas(31), 9, 4, 22, 1.0, 1.7, 1.0, 1.0, 601); cards(P.quilaCanvas(41), 8, 5, 24, 1.8, 3.0, 0.25, 0.95, 701);
} else {
const treeKinds = [['broad', 11], ['broad', 12], ['broad', 13], ['alerce', 14], ['alerce', 15], ['dead', 16]];
const treeCanvases = treeKinds.map(([k, s]) => P.treeCanvas(k, s));
function treeRing(n, rMin, rMax, hMin, hMax, mul, seed) {
  treeCanvases.forEach((c, i) => cards(c, Math.ceil(n * (i < 3 ? 0.2 : i < 5 ? 0.15 : 0.1)), rMin, rMax, hMin, hMax, 0.5, mul, seed + i));
}
treeRing(70, 6, 12, 5, 7.5, 1.0, 100);
treeRing(110, 12, 22, 7, 10.5, 0.97, 200);
treeRing(150, 22, 36, 9, 13.5, 0.94, 300);
treeRing(180, 36, 56, 11, 17, 0.9, 400);
[1, 2, 3].forEach((i) => cards(P.fernCanvas(20 + i), 55, 2.6, 24, 0.8, 1.5, 1.0, 1.0, 500 + i));
[1, 2].forEach((i) => cards(P.nalcaCanvas(30 + i), 20, 3.5, 24, 1.1, 1.9, 1.0, 1.0, 600 + i));
[1, 2].forEach((i) => cards(P.quilaCanvas(40 + i), 22, 4.5, 26, 2.0, 3.4, 0.25, 0.95, 700 + i));
}

// ---- suelo, hojarasca y ramitas ----
{
  const gt = P.toTex(P.groundCanvas(3, ANT), true); gt.repeat.set(26, 26);
  const g = new THREE.Mesh(new THREE.CircleGeometry(90, 56).rotateX(-Math.PI / 2), reg(new THREE.MeshBasicMaterial({ map: gt, fog: true }), 0.95));
  g.name = 'Suelo'; scene.add(g);
  const r = P.rng(77), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), pos = new THREE.Vector3();
  const spot = () => { for (;;) { const a = r() * 6.283, rad = 1 + Math.sqrt(r()) * 26, x = Math.cos(a) * rad, z = Math.sin(a) * rad; if (!(Math.abs(x) < 2.35 && Math.abs(z) < 2.35 || (Math.abs(x) < 1.5 && z < -2.1 && z > -3.3))) return [x, z]; } };
  const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), reg(new THREE.MeshBasicMaterial({ map: P.toTex(P.leafCanvas()), alphaTest: 0.5, side: THREE.DoubleSide, fog: true }), 1), 1700);
  const lc = ['#9a6a2e', '#c08a3a', '#7a8a3a', '#5a8a3e', '#a8542e', '#8a7a4a'];
  for (let i = 0; i < 1700; i++) {
    const [x, z] = spot(), sz = 0.07 + r() * 0.14;
    q.setFromEuler(e.set(0, r() * 6.283, 0)); m.compose(pos.set(x, 0.012 + r() * 0.01, z), q, s.set(sz, 1, sz * 0.6)); leaves.setMatrixAt(i, m); leaves.setColorAt(i, new THREE.Color(lc[(r() * lc.length) | 0]));
  }
  leaves.frustumCulled = false; scene.add(leaves);
  const tw = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.014, 0.014), reg(new THREE.MeshBasicMaterial({ fog: true }), 1), 1100);
  const tc = ['#6e5436', '#7e6240', '#5a4228', '#8a6a45'];
  for (let i = 0; i < 1100; i++) {
    const [x, z] = spot(), len = 0.12 + r() * 0.6;
    q.setFromEuler(e.set((r() - 0.5) * 0.18, r() * 6.283, (r() - 0.5) * 0.18)); m.compose(pos.set(x, 0.012 + r() * 0.02, z), q, s.set(len, 0.5 + r() * 1.1, 0.5 + r() * 1.1)); tw.setMatrixAt(i, m); tw.setColorAt(i, new THREE.Color(tc[(r() * 4) | 0]));
  }
  tw.frustumCulled = false; scene.add(tw);
}

if (ANT) {
  // montículos de musgo lima y hongos
  const r = P.rng(909), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  const mound = new THREE.SphereGeometry(1, 14, 8, 0, 6.283, 0, Math.PI / 2);
  const mounds = new THREE.InstancedMesh(mound, reg(new THREE.MeshLambertMaterial({ color: 0xffffff, fog: true }), 1), 90);
  const caps = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6, 0, 6.283, 0, Math.PI / 2), reg(new THREE.MeshLambertMaterial({ color: 0xffffff, fog: true }), 1), 70);
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.45, 1, 7).translate(0, 0.5, 0), reg(new THREE.MeshLambertMaterial({ color: 0xf1e7c8, fog: true }), 1), 70);
  const lime = ['#86c43c', '#9bd04a', '#6fae32', '#a8d85a'], capc = ['#efe3c4', '#d9693a', '#f4f0e0', '#c4562e'];
  const free = () => { for (;;) { const a = r() * 6.283, rad = 2 + Math.sqrt(r()) * 28, x = Math.cos(a) * rad, z = Math.sin(a) * rad; if (!(Math.hypot(x - 1, z + 0.8) < 1.6 || (Math.abs(x) < 1.3 && z > -0.4 && z < 2.4))) return [x, z]; } };
  for (let i = 0; i < 90; i++) { const [x, z] = free(), sz = 0.35 + r() * 1.3; q.setFromEuler(e.set(0, r() * 6.28, 0)); m.compose(pos.set(x, 0, z), q, sc.set(sz, sz * (0.28 + r() * 0.3), sz * (0.8 + r() * 0.4))); mounds.setMatrixAt(i, m); mounds.setColorAt(i, new THREE.Color(lime[(r() * 4) | 0])); }
  for (let i = 0; i < 70; i++) { const [x, z] = free(), h = 0.08 + r() * 0.2, cr = h * (0.7 + r() * 0.5); q.identity(); m.compose(pos.set(x, 0, z), q, sc.set(cr * 0.5, h, cr * 0.5)); stems.setMatrixAt(i, m); m.compose(pos.set(x, h, z), q, sc.set(cr, cr * 0.55, cr)); caps.setMatrixAt(i, m); caps.setColorAt(i, new THREE.Color(capc[(r() * 4) | 0])); }
  [mounds, caps, stems].forEach((o) => { o.frustumCulled = false; scene.add(o); });
}

// ---- plataforma de madera + taller ----
function woodCanvas(seed, w = 512, h = 512, plank = 64) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), r = P.rng(seed);
  x.fillStyle = '#b98b5a'; x.fillRect(0, 0, w, h);
  for (let p = 0; p < h; p += plank) { x.fillStyle = `hsl(${28 + r() * 8},${38 + r() * 12}%,${46 + r() * 12}%)`; x.fillRect(0, p, w, plank); x.fillStyle = '#4a3320'; x.fillRect(0, p, w, 3); }
  for (let i = 0; i < 260; i++) { x.strokeStyle = `rgba(60,40,20,${0.08 + r() * 0.12})`; x.lineWidth = 1; const yy = r() * h; x.beginPath(); x.moveTo(r() * w, yy); x.lineTo(r() * w, yy + (r() - 0.5) * 6); x.stroke(); }
  return c;
}
const woodTex = P.toTex(woodCanvas(5), true);
const wood = (rx = 2, ry = 2) => { const t = woodTex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return reg(new THREE.MeshLambertMaterial({ map: t, fog: true }), 1); };
function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); world.add(m); return m; }
const DECK_H = ANT ? 0 : 0.3;
const TABLE = ANT ? { x: 1.0, z: -0.8, w: 1.2, d: 1.2, top: 0.86 } : { x: 0.95, z: -0.35, w: 1.6, d: 0.78, top: DECK_H + 0.82 };
if (!ANT) {
box(4.4, DECK_H, 4.4, wood(3, 3), 0, DECK_H / 2, 0).name = 'Plataforma';
box(1.3, 0.2, 0.5, wood(1, 1), 0, 0.1, -2.45).name = 'Peldaño_1';
box(1.3, 0.1, 0.5, wood(1, 1), 0, 0.05, -2.95).name = 'Peldaño_2';
// mesa de taller (frente a la derecha)
box(TABLE.w, 0.06, TABLE.d, wood(2, 1), TABLE.x, TABLE.top - 0.03, TABLE.z).name = 'Mesa_tapa';
[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box(0.08, TABLE.top - DECK_H - 0.06, 0.08, wood(1, 1), TABLE.x + a * (TABLE.w / 2 - 0.08), DECK_H + (TABLE.top - DECK_H - 0.06) / 2, TABLE.z + b * (TABLE.d / 2 - 0.08)));
box(TABLE.w - 0.2, 0.05, 0.4, wood(2, 1), TABLE.x, DECK_H + 0.3, TABLE.z - 0.1).name = 'Mesa_repisa';
// tronco grande con tablero de herramientas colgado
{
  const bc = document.createElement('canvas'); bc.width = 256; bc.height = 512; const x = bc.getContext('2d'), r = P.rng(9);
  x.fillStyle = '#7a5c3a'; x.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '30,20,10' : '150,120,80'},${0.15 + r() * 0.2})`; x.fillRect(r() * 256, 0, 2 + r() * 6, 512); }
  x.fillStyle = '#4f7f3a'; for (let i = 0; i < 24; i++) { x.beginPath(); x.ellipse(r() * 256, 470 + r() * 40, 20 + r() * 30, 10 + r() * 16, 0, 0, 6.3); x.fill(); }
  const t = P.toTex(bc, true); t.repeat.set(3, 1);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 9, 18), reg(new THREE.MeshLambertMaterial({ map: t, fog: true }), 1));
  trunk.position.set(TABLE.x, 4.5, TABLE.z - 1.75); trunk.name = 'Tronco_taller'; world.add(trunk);
  // tablero con siluetas
  const pc = document.createElement('canvas'); pc.width = 512; pc.height = 320; const p = pc.getContext('2d');
  p.fillStyle = '#c9a36b'; p.fillRect(0, 0, 512, 320); p.fillStyle = 'rgba(60,40,20,0.35)';
  for (let i = 0; i < 16; i++) for (let j = 0; j < 10; j++) { p.beginPath(); p.arc(16 + i * 32, 16 + j * 32, 3, 0, 6.3); p.fill(); }
  p.fillStyle = '#1d2a1c';
  p.fillRect(60, 120, 120, 14); p.fillRect(150, 100, 16, 54); p.fillRect(60, 90, 60, 10);                      // martillo
  p.beginPath(); p.moveTo(240, 80); p.lineTo(270, 200); p.lineTo(284, 200); p.lineTo(252, 70); p.fill(); p.beginPath(); p.moveTo(300, 80); p.lineTo(270, 200); p.lineTo(256, 200); p.lineTo(288, 70); p.fill(); // alicate
  p.fillRect(360, 70, 10, 140); p.fillRect(352, 200, 26, 50);                                                  // destornillador
  p.fillStyle = '#c4162f'; p.fillRect(60, 250, 90, 10);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.06), new THREE.MeshLambertMaterial({ map: P.toTex(pc), fog: true }));
  board.position.set(TABLE.x, DECK_H + 1.9, TABLE.z - 1.13); world.add(board); board.name = 'Tablero_siluetas';
  [-0.75, 0.75].forEach((dx) => box(0.07, 1.1, 0.05, wood(1, 1), TABLE.x + dx, DECK_H + 1.9, TABLE.z - 1.12));
}
} else {
  // tocón gigante como mesa de taller + hongos
  const rc = document.createElement('canvas'); rc.width = rc.height = 256; const rx = rc.getContext('2d'); rx.fillStyle = '#c8a46a'; rx.fillRect(0, 0, 256, 256);
  for (let k = 14; k > 0; k--) { rx.strokeStyle = `rgba(90,60,30,${0.25 + (k % 3) * 0.1})`; rx.lineWidth = 3; rx.beginPath(); rx.arc(128 + (k % 2), 128, k * 8.5, 0, 6.3); rx.stroke(); }
  const topMat = reg(new THREE.MeshLambertMaterial({ map: P.toTex(rc), fog: true }), 1);
  const side = reg(new THREE.MeshLambertMaterial({ color: 0x7c6a48, fog: true }), 1);
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.82, TABLE.top, 22), side); stump.position.set(TABLE.x, TABLE.top / 2, TABLE.z); stump.name = 'Tocon_mesa'; world.add(stump);
  const topM = new THREE.Mesh(new THREE.CircleGeometry(0.64, 22).rotateX(-Math.PI / 2), topMat); topM.position.set(TABLE.x, TABLE.top + 0.002, TABLE.z); world.add(topM);
  const mossT = reg(new THREE.MeshLambertMaterial({ color: 0x8fc24a, fog: true }), 1);
  [[-0.5, 0.05, 0.3], [0.45, -0.3, 0.26], [0.2, 0.52, 0.22]].forEach(([dx, dz, rr]) => { const mm = new THREE.Mesh(new THREE.SphereGeometry(rr, 10, 6, 0, 6.283, 0, 1.5).scale(1, 0.4, 1), mossT); mm.position.set(TABLE.x + dx, TABLE.top - 0.04, TABLE.z + dz); world.add(mm); });
}
// farol de mesa
const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.1), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false })); lantern.position.set(TABLE.x - 0.62, TABLE.top + 0.08, TABLE.z - 0.22); world.add(lantern);
const glowTex = P.toTex(P.glowCanvas());
const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.0, fog: false }));
lampGlow.scale.setScalar(1.4); lampGlow.position.copy(lantern.position); world.add(lampGlow);
const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.25, fog: false }));
sunGlow.scale.setScalar(70); sunGlow.position.set(0, 16, -70); scene.add(sunGlow);

// ---- física: herramientas, tazas y palitos sobre la mesa ----
const solidsCasa = [
  { min: new THREE.Vector3(-2.2, 0, -2.2), max: new THREE.Vector3(2.2, DECK_H, 2.2) },
  { min: new THREE.Vector3(-0.65, 0, -2.7), max: new THREE.Vector3(0.65, 0.2, -2.2) },
  { min: new THREE.Vector3(-0.65, 0, -3.2), max: new THREE.Vector3(0.65, 0.1, -2.7) },
  { min: new THREE.Vector3(TABLE.x - TABLE.w / 2, TABLE.top - 0.09, TABLE.z - TABLE.d / 2), max: new THREE.Vector3(TABLE.x + TABLE.w / 2, TABLE.top, TABLE.z + TABLE.d / 2) },
  { min: new THREE.Vector3(TABLE.x - 0.55, 0, TABLE.z - 2.9), max: new THREE.Vector3(TABLE.x + 0.55, 9, TABLE.z - 1.15) },
];
const solids = ANT ? [{ min: new THREE.Vector3(TABLE.x - 0.66, 0, TABLE.z - 0.66), max: new THREE.Vector3(TABLE.x + 0.66, TABLE.top, TABLE.z + 0.66) }] : solidsCasa;
const audio = new HallAudio(camera);
scene.add(audio.sfxRoot);
const toys = createToys({ audio, parent: world, solids, onFloor: (x, z) => x * x + z * z < 95 * 95, defaults: false });
const kraft = new THREE.MeshStandardMaterial({ color: 0xb98b5a, roughness: 0.8 });
const metal = new THREE.MeshStandardMaterial({ color: 0x59606a, roughness: 0.45, metalness: 0.4 });
const red = new THREE.MeshStandardMaterial({ color: 0xd8452a, roughness: 0.6 });
const orange = new THREE.MeshStandardMaterial({ color: 0xff8a2a, roughness: 0.6 });
function part(g, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; }
function makeHammer() { const g = new THREE.Group(); part(g, new THREE.BoxGeometry(0.03, 0.03, 0.3), kraft, 0, 0, 0); part(g, new THREE.BoxGeometry(0.1, 0.05, 0.05), metal, 0, 0, 0.14); part(g, new THREE.BoxGeometry(0.03, 0.03, 0.05), metal, 0.05, 0, 0.14); return g; }
function makePliers() { const g = new THREE.Group(); const a = part(g, new THREE.BoxGeometry(0.02, 0.016, 0.2), red, 0.016, 0, -0.07, 0, 0.12); const b = part(g, new THREE.BoxGeometry(0.02, 0.016, 0.2), red, -0.016, 0, -0.07, 0, -0.12); part(g, new THREE.BoxGeometry(0.018, 0.014, 0.1), metal, 0.008, 0, 0.09, 0, -0.07); part(g, new THREE.BoxGeometry(0.018, 0.014, 0.1), metal, -0.008, 0, 0.09, 0, 0.07); part(g, new THREE.CylinderGeometry(0.014, 0.014, 0.022, 10), metal, 0, 0, 0.02, Math.PI / 2); return g; }
function makeScrewdriver() { const g = new THREE.Group(); part(g, new THREE.CylinderGeometry(0.018, 0.018, 0.1, 10), orange, 0, 0, -0.07, Math.PI / 2); part(g, new THREE.CylinderGeometry(0.005, 0.005, 0.12, 8), metal, 0, 0, 0.04, Math.PI / 2); return g; }
function makeMallet() { const g = new THREE.Group(); part(g, new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8), kraft, 0, 0, 0, Math.PI / 2); part(g, new THREE.CylinderGeometry(0.045, 0.045, 0.12, 14), orange, 0, 0, 0.12, 0, 0, Math.PI / 2); return g; }
function makeTwig(len) { const g = new THREE.Group(); part(g, new THREE.CylinderGeometry(0.008, 0.012, len, 6), new THREE.MeshStandardMaterial({ color: 0x6e5436, roughness: 1 }), 0, 0, 0, Math.PI / 2); return g; }
const tp = TABLE.top;
const put = (kind, obj, dx, dz, o) => { const b = toys.add(kind, obj, new THREE.Vector3(TABLE.x + dx * (ANT ? 0.62 : 1), tp + (o.r || 0.05) + 0.002, TABLE.z + dz * (ANT ? 0.62 : 1)), o); obj.rotation.y = o.yaw || 0; b.obj.rotation.y = o.yaw || 0; return b; };
put('martillo', makeHammer(), -0.35, 0.05, { r: 0.06, e: 0.2, yaw: 0.4 });
put('alicate', makePliers(), -0.05, 0.12, { r: 0.05, e: 0.2, yaw: -0.5 });
put('destornillador', makeScrewdriver(), 0.2, -0.05, { r: 0.04, e: 0.2, yaw: 0.9 });
put('mazo', makeMallet(), 0.5, 0.1, { r: 0.06, e: 0.2, yaw: -0.2 });
put('taza', makeCup(0xc4623a), -0.6, -0.12, { r: 0.046, e: 0.25, upright: 'yaw', color: 0xc4623a, roll: 7 });
put('taza', makeCup(0xf2ead8), -0.5, 0.2, { r: 0.046, e: 0.25, upright: 'yaw', color: 0xf2ead8, roll: 7 });
for (let i = 0; i < 4; i++) put('palito', makeTwig(0.18 + i * 0.05), 0.1 + i * 0.1, -0.28, { r: 0.02, e: 0.3, yaw: i });
// recoloca las herramientas sobre la mesa (la mesa está a TABLE.top; los objetos arrancan dormidos)

// ---- copihues colgantes + enredaderas ----
const flowerSpots = [];
{
  const r = P.rng(55), vineMat = reg(billboard(new THREE.MeshBasicMaterial({ map: P.toTex(P.vineCanvas(8)), alphaTest: 0.45, side: THREE.DoubleSide, fog: true })), 1);
  const n = ANT ? 5 : 8, vines = new THREE.InstancedMesh(cardGeo, vineMat, n), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = r() * 6.283, rad = 2.3 + r() * 3.2, x = Math.cos(a) * rad, z = Math.sin(a) * rad, h = 1.8 + r() * 1.2;
    m.compose(pos.set(x, 3.3 - h, z), q, s.set(h * 0.25, h, 1)); vines.setMatrixAt(i, m);
    flowerSpots.push(new THREE.Vector3(x, 3.3 - h * 0.45, z));
  }
  vines.frustumCulled = false; scene.add(vines);
}

// ---- mariposas ----
const butter = [];
{
  const wingGeo = new THREE.PlaneGeometry(0.11, 0.11).rotateX(-Math.PI / 2).translate(0.055, 0, 0);
  const mats = [18, 48, 200, 300].map((h, i) => reg(new THREE.MeshBasicMaterial({ map: P.toTex(P.mothCanvas(h, i + 1)), alphaTest: 0.5, side: THREE.DoubleSide, fog: true }), 1));
  const r = P.rng(21);
  for (let i = 0; i < 26; i++) {
    const g = new THREE.Group(), mat = mats[i % 4];
    const L = new THREE.Mesh(wingGeo, mat), R = new THREE.Mesh(wingGeo, mat); R.scale.x = -1;
    g.add(L, R); g.scale.setScalar(0.8 + r() * 0.8); scene.add(g);
    butter.push({ g, L, R, c: new THREE.Vector3((r() - 0.5) * 9, 0.7 + r() * 1.6, (r() - 0.5) * 9 - 1), a: [0.3 + r() * 0.5, 0.2 + r() * 0.4, 0.3 + r() * 0.5], p: [r() * 6, r() * 6, r() * 6], R1: 1.5 + r() * 3, ph: r() * 6, rate: 11 + r() * 5 });
  }
}

// ---- picaflor chico (Sephanoides sephaniodes) ----
const pica = (() => {
  const g = new THREE.Group(); g.name = 'Picaflor';
  const green = new THREE.MeshBasicMaterial({ color: 0x1fa05a }), crown = new THREE.MeshBasicMaterial({ color: 0xe8402a }), dark = new THREE.MeshBasicMaterial({ color: 0x151515 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), green); body.scale.set(0.016, 0.016, 0.04); g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xcfe6cf })); belly.scale.set(0.012, 0.01, 0.03); belly.position.set(0, -0.009, 0.004); g.add(belly);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.0155, 10, 8), green); head.position.z = 0.043; g.add(head);
  const cr = new THREE.Mesh(new THREE.SphereGeometry(0.0158, 10, 8, 0, 6.3, 0, 0.9), crown); cr.position.copy(head.position); cr.position.y += 0.001; g.add(cr);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.0028, 0.045, 6).rotateX(Math.PI / 2), dark); beak.position.z = 0.083; g.add(beak);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x14693c })); tail.position.z = -0.055; tail.scale.x = 1.6; g.add(tail);
  const wm = new THREE.MeshBasicMaterial({ color: 0xcfe6df, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const wg = new THREE.PlaneGeometry(0.075, 0.022).rotateX(-Math.PI / 2).translate(0.0375, 0, 0);
  const L = new THREE.Mesh(wg, wm), R = new THREE.Mesh(wg, wm); R.scale.x = -1; L.position.set(0.01, 0.008, 0.012); R.position.set(-0.01, 0.008, 0.012); g.add(L, R);
  g.scale.setScalar(2.6); scene.add(g);
  const st = { mode: 'hover', t: 0, dur: 2.5, A: new THREE.Vector3(), B: new THREE.Vector3(), C: new THREE.Vector3(), face: new THREE.Vector3(), flyby: false, buzz: null, wait: 5 };
  g.position.set(3, 2, -4);
  return { g, L, R, st };
})();
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
function picaNext() {
  const st = pica.st, cam = camera.getWorldPosition(tmpV).clone();
  st.A.copy(pica.g.position); st.t = 0;
  if (Math.random() < 0.34) {                       // pasada rápida frente a tu cara
    const d = camera.getWorldDirection(tmpV2); d.y = 0; d.normalize();
    const right = new THREE.Vector3().crossVectors(d, up).normalize(), s = Math.random() < 0.5 ? 1 : -1;
    const pass = cam.clone().addScaledVector(d, 0.8).addScaledVector(right, 0.05 * s); pass.y -= 0.12;
    st.A.copy(cam).addScaledVector(d, 3.2).addScaledVector(right, -7 * s); st.A.y = cam.y - 0.05;
    st.B.copy(cam).addScaledVector(d, 3.2).addScaledVector(right, 7 * s); st.B.y = cam.y + 0.2;
    st.C.copy(pass).multiplyScalar(2).sub(tmpV2.copy(st.A).add(st.B).multiplyScalar(0.5));
    st.mode = 'dart'; st.dur = 1.7; st.flyby = true; return;
  }
  const f = flowerSpots[(Math.random() * flowerSpots.length) | 0];
  st.B.copy(f).add(new THREE.Vector3(0.14, 0.02, 0.1)); st.face.copy(f);
  st.C.copy(st.A).add(st.B).multiplyScalar(0.5); st.C.y += 0.5 + Math.random() * 0.6; st.C.x += (Math.random() - 0.5) * 1.5;
  st.mode = 'dart'; st.dur = 1.1 + Math.random() * 0.8; st.flyby = false;
}
function picaUpdate(dt, t) {
  const st = pica.st; st.t += dt;
  const fl = Math.sin(t * 2 * Math.PI * 55) * 0.95; pica.L.rotation.z = fl; pica.R.rotation.z = -fl;
  if (st.mode === 'hover') {
    pica.g.position.x += Math.sin(t * 9) * 0.0006; pica.g.position.y += Math.cos(t * 7) * 0.0006;
    tmpV.copy(st.face).sub(pica.g.position); if (tmpV.lengthSq() > 1e-4) pica.g.lookAt(pica.g.position.clone().add(tmpV));
    pica.g.rotation.x += Math.sin(t * 4) * 0.02;
    if (st.t > st.dur) picaNext();
  } else {
    const u = Math.min(1, st.t / st.dur), e = st.flyby ? u : u * u * (3 - 2 * u), k = 1 - e;
    const prev = pica.g.position.clone();
    pica.g.position.set(k * k * st.A.x + 2 * k * e * st.C.x + e * e * st.B.x, k * k * st.A.y + 2 * k * e * st.C.y + e * e * st.B.y, k * k * st.A.z + 2 * k * e * st.C.z + e * e * st.B.z);
    tmpV.copy(pica.g.position).sub(prev); if (tmpV.lengthSq() > 1e-9) pica.g.lookAt(pica.g.position.clone().add(tmpV));
    if (u >= 1) { st.mode = 'hover'; st.t = 0; st.dur = st.flyby ? 0.2 : 1.8 + Math.random() * 2; if (st.flyby) { st.flyby = false; st.dur = 0.1; st.face.copy(flowerSpots[0]); } }
  }
}
picaNext();

// ---- luciérnagas y lluvia ----
const fireN = 170, fireGeo = new THREE.BufferGeometry(), firePos = new Float32Array(fireN * 3), fireSeed = [];
{ const r = P.rng(31); for (let i = 0; i < fireN; i++) { const a = r() * 6.283, rad = 1 + r() * 14; firePos.set([Math.cos(a) * rad, 0.3 + r() * 2.8, Math.sin(a) * rad], i * 3); fireSeed.push(r() * 6.28); } fireGeo.setAttribute('position', new THREE.BufferAttribute(firePos, 3)); }
const fireMat = new THREE.PointsMaterial({ map: glowTex, size: 0.2, color: 0xc8ff80, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
const fires = new THREE.Points(fireGeo, fireMat); fires.frustumCulled = false; scene.add(fires);
const RAIN_N = 2400;
const rainGeo = new THREE.BufferGeometry();
{ const p = new Float32Array(RAIN_N * 6), e = new Float32Array(RAIN_N * 2), sd = new Float32Array(RAIN_N * 2); const r = P.rng(88);
  for (let i = 0; i < RAIN_N; i++) { const x = r() * 14, y = r() * 9, z = r() * 14, s = r(); for (let k = 0; k < 2; k++) { p.set([x, y, z], i * 6 + k * 3); e[i * 2 + k] = k; sd[i * 2 + k] = s; } }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(p, 3)); rainGeo.setAttribute('aEnd', new THREE.BufferAttribute(e, 1)); rainGeo.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1)); }
const rainMat = new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 }, uCam: { value: new THREE.Vector3() }, uOn: { value: 0 }, uCol: { value: new THREE.Color(0xdfe9f0) } },
  vertexShader: /* glsl */`
    uniform float uT; uniform vec3 uCam; attribute float aEnd, aSeed;
    void main(){
      vec3 p = position;
      p.y = mod(p.y - uT * (9.0 + aSeed * 3.0), 9.0);
      vec2 xz = uCam.xz + (mod(p.xz - uCam.xz + 7.0, 14.0) - 7.0);
      vec3 w = vec3(xz.x + aEnd * 0.06, p.y + aEnd * 0.4, xz.y);
      gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
    }`,
  fragmentShader: 'uniform float uOn; uniform vec3 uCol; void main(){ gl_FragColor = vec4(uCol, 0.42 * uOn); }',
  transparent: true, depthWrite: false,
});
const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; scene.add(rain);
let rainAmb = null, windAmb = null;

// ---- estado de "hora" y clima (se mezclan suavemente) ----
const look = { bg: new THREE.Color(HORAS[0].bg), fog: new THREE.Color(HORAS[0].fog), near: HORAS[0].near, far: HORAS[0].far, tint: new THREE.Color(1, 1, 1), hemi: 1, glow: new THREE.Color(0xffffff), glowOp: 0.25, fire: 0, mari: 1, rain: 0 };
const tgtC = new THREE.Color(), tgtT = new THREE.Color();
function updateLook(dt) {
  const H = HORAS[PARAM.hora], k = Math.min(1, dt * 1.6), wet = PARAM.lluvia ? 1 : 0;
  look.bg.lerp(tgtC.setHex(H.bg), k); look.fog.lerp(tgtC.setHex(H.fog), k);
  look.near += (H.near - look.near) * k; look.far += (H.far * (1 - 0.3 * wet) - look.far) * k;
  look.tint.lerp(tgtT.setRGB(...H.tint), k); look.hemi += (H.hemi * (1 - 0.25 * wet) - look.hemi) * k;
  look.glow.lerp(tgtC.setHex(H.glow), k); look.glowOp += (H.glowOp * (1 - 0.7 * wet) - look.glowOp) * k;
  look.fire += (H.fire - look.fire) * k; look.mari += (H.mariposas * (1 - wet * 0.9) - look.mari) * k; look.rain += (wet - look.rain) * Math.min(1, dt * 2);
  scene.background.copy(look.bg); scene.fog.color.copy(look.fog);
  scene.fog.near = look.near * 0.4; scene.fog.far = look.far / PARAM.niebla;
  const wd = 1 - 0.18 * look.rain;
  tint.copy(look.tint).multiplyScalar(wd);
  for (const t of tinted) t.mat.color.setRGB(tint.r * t.mul, tint.g * t.mul, tint.b * t.mul);
  hemi.intensity = look.hemi; hemi.color.copy(look.tint).lerp(new THREE.Color(1, 1, 1), 0.4); sun.intensity = 1.3 * look.hemi;
  sunGlow.material.color.copy(look.glow); sunGlow.material.opacity = look.glowOp;
  fireMat.opacity = look.fire * 0.9; fires.visible = look.fire > 0.02;
  lampGlow.material.opacity = Math.min(0.9, 0.08 + look.fire * 0.7);
  rainMat.uniforms.uOn.value = look.rain; rain.visible = look.rain > 0.02;
  if (rainAmb) rainAmb.setVolume(0.55 * look.rain);
}
function setHora(i) { PARAM.hora = i % HORAS.length; $(ID('hora')).textContent = `Hora: ${HORAS[PARAM.hora].n}`; }
function toggleRain() { PARAM.lluvia = !PARAM.lluvia; $(ID('rain')).textContent = PARAM.lluvia ? 'Parar lluvia' : 'Llover'; startAudio(); }
function setDensidad(v) { PARAM.densidad = v; layers.forEach((m) => { m.count = Math.floor(m.userData.full * v); }); }
$(ID('rain')).onclick = toggleRain; $(ID('hora')).onclick = () => { setHora(PARAM.hora + 1); startAudio(); };
$(ID('dens')).oninput = (e) => setDensidad(+e.target.value); $(ID('niebla')).oninput = (e) => { PARAM.niebla = +e.target.value; };

// ---- audio ----
let audioOn = false;
async function startAudio() {
  if (audioOn) return; audioOn = true;
  await audio.start(new THREE.Object3D(), [], { pad: false });
  windAmb = audio.ambient('viento', 0.25); rainAmb = audio.ambient('lluvia', 0); pica.st.buzz = audio.buzzer(pica.g, 0.5);
}

// ---- interacción: agarrar / lanzar y mover el mundo ----
const raycaster = new THREE.Raycaster();
const tmpM = new THREE.Matrix4();
function pickToy(rc) { const hit = rc.intersectObjects(toys.pickables(), false)[0]; return hit ? { b: hit.object.userData.toy, dist: hit.distance } : null; }
function rayFrom(c) { tmpM.identity().extractRotation(c.matrixWorld); raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld); raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tmpM); raycaster.far = 6; return raycaster; }
const held = new Map();      // controlador -> juguete
let drag = null;             // {c, prev: Vector3 (local al rig)}
const controllers = app.controllers;
const busy = () => !active || performance.now() < app.suppressUntil || app.menuOpen();
controllers.forEach((c) => {
  const line = c.userData.line;
  const start = () => {
    if (busy()) return;
    startAudio();
    const it = pickToy(rayFrom(c));
    if (it) { toys.grab(it.b, c); held.set(c, it.b); line.visible = false; }
    else if (!drag) drag = { c, prev: c.position.clone() };
  };
  const end = () => {
    const b = held.get(c); if (b) { toys.release(b); held.delete(c); }
    line.visible = true; if (drag && drag.c === c) drag = null;
  };
  c.addEventListener('selectstart', start); c.addEventListener('selectend', end);
  c.addEventListener('squeezestart', start); c.addEventListener('squeezeend', end);
});
const yawQ = new THREE.Quaternion(), fwd = new THREE.Vector3(), rgt = new THREE.Vector3(), headW = new THREE.Vector3();
let snapLatch = false; const btnLatch = {};
function dz(v) { return Math.abs(v) < LOCO.zonaMuerta ? 0 : v; }
function locomotionXR(dt, cam) {
  const session = renderer.xr.getSession(); if (!session) return;
  cam.getWorldPosition(headW);
  for (const src of session.inputSources) {
    const gp = src.gamepad; if (!gp) continue;
    const ax = gp.axes, hand = src.handedness;
    const x = dz(ax[2] || 0), y = dz(ax[3] || 0);
    if (hand === 'left' && (x || y)) {
      cam.getWorldQuaternion(yawQ); fwd.set(0, 0, -1).applyQuaternion(yawQ); fwd.y = 0; fwd.normalize(); rgt.set(-fwd.z, 0, fwd.x);
      rig.position.addScaledVector(fwd, -y * LOCO.velocidad * dt).addScaledVector(rgt, x * LOCO.velocidad * dt);
    }
    if (hand === 'right') {
      if (Math.abs(x) > 0.7 && !snapLatch) { snapLatch = true; const a = -Math.sign(x) * THREE.MathUtils.degToRad(LOCO.giroGrados); rig.position.sub(headW).applyAxisAngle(up, a).add(headW); rig.rotation.y += a; }
      else if (Math.abs(x) < 0.3) snapLatch = false;
    }
    const b = gp.buttons;
    const edge = (idx, fn) => { const key = hand + idx; const on = !!(b[idx] && b[idx].pressed); if (on && !btnLatch[key]) fn(); btnLatch[key] = on; };
    edge(4, toggleRain); edge(5, () => setHora(PARAM.hora + 1));
  }
  if (drag) {                                  // arrastrar el mundo: la mano se queda y el mundo se mueve hacia ti
    const cur = drag.c.position, d = drag.prev.clone().sub(cur); d.y = 0;
    d.applyQuaternion(rig.quaternion).multiplyScalar(LOCO.agarreGanancia); rig.position.add(d); drag.prev.copy(cur);
  }
}
function groundHeight(x, z) {
  if (ANT) return 0;
  const onDeck = Math.abs(x) < 2.2 && Math.abs(z) < 2.2;
  const step1 = Math.abs(x) < 0.65 && z < -2.2 && z > -2.7, step2 = Math.abs(x) < 0.65 && z <= -2.7 && z > -3.2;
  return onDeck ? DECK_H : step1 ? 0.2 : step2 ? 0.1 : 0;
}

// Escritorio: mouse + teclado
let yaw = 0, pitch = -0.1, dragLook = false, lx = 0, ly = 0, mouseItem = null, mouseDist = 1, mouseHover = null;
const mouseNdc = new THREE.Vector2(), mouseHand = new THREE.Object3D(); scene.add(mouseHand);
const keys = new Set();
function ndc(e) { const r = renderer.domElement.getBoundingClientRect(); mouseNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); raycaster.setFromCamera(mouseNdc, camera); raycaster.far = 8; }
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (!active) return;
  startAudio(); if (renderer.xr.isPresenting) return; ndc(e);
  const it = pickToy(raycaster);
  if (it) { mouseItem = it.b; mouseDist = it.dist; mouseHand.position.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, mouseDist); mouseHand.quaternion.copy(camera.getWorldQuaternion(new THREE.Quaternion())); mouseHand.updateMatrixWorld(true); toys.grab(it.b, mouseHand); return; }
  dragLook = true; lx = e.clientX; ly = e.clientY;
});
addEventListener('pointerup', () => { if (!active) return; dragLook = false; if (mouseItem) { toys.release(mouseItem); mouseItem = null; } });
addEventListener('pointermove', (e) => {
  if (!active || renderer.xr.isPresenting) return; ndc(e);
  if (!mouseItem) { mouseHover = pickToy(raycaster); renderer.domElement.style.cursor = mouseHover ? 'pointer' : dragLook ? 'grabbing' : 'grab'; }
  if (!dragLook) return;
  yaw -= (e.clientX - lx) * 0.004; pitch = Math.max(-1.3, Math.min(1.3, pitch - (e.clientY - ly) * 0.004)); lx = e.clientX; ly = e.clientY;
});
addEventListener('keydown', (e) => {
  if (!active) return;
  startAudio(); keys.add(e.key.toLowerCase());
  if (e.key === 'l' || e.key === 'L') toggleRain(); if (e.key === 'h' || e.key === 'H') setHora(PARAM.hora + 1); if (e.key === 'r' || e.key === 'R') toys.resetAll();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
let lastInput = performance.now(), idleBlend = 0;
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true }));
addEventListener('pointermove', (e) => { if (e.buttons) lastInput = performance.now(); });

// ---- sesión VR (la inicia app.js) ----
let hudUntil = 0;
const hud = makeHud(); hud.mesh.visible = false; scene.add(hud.mesh);

// ---- bucle ----
let tAcc = 0, fpsT = 0, fpsN = 0, fps = 0, hudT = 0;
function update(dt) {
  tAcc += dt; const t = tAcc;
  const xrOn = renderer.xr.isPresenting, cam = xrOn ? renderer.xr.getCamera() : camera;
  fpsT += dt; fpsN++; if (fpsT > 0.5) { fps = Math.round(fpsN / fpsT); fpsT = 0; fpsN = 0; }
  if (!xrOn) {
    const idle = performance.now() - lastInput > 4000; idleBlend += ((idle ? 1 : 0) - idleBlend) * Math.min(1, dt * (idle ? 0.6 : 4));
    camera.rotation.set(pitch + idleBlend * 0.08 * Math.sin(t * 0.13), yaw + idleBlend * 0.9 * Math.sin(t * 0.09), 0, 'YXZ');
    camera.position.set(idleBlend * 0.35 * Math.sin(t * 0.11), 1.62, idleBlend * 0.25 * Math.sin(t * 0.07));
    const sp = (keys.has('shift') ? 2 : 1) * LOCO.velocidad * dt;
    fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); rgt.set(-fwd.z, 0, fwd.x);
    if (keys.has('w') || keys.has('arrowup')) rig.position.addScaledVector(fwd, sp); if (keys.has('s') || keys.has('arrowdown')) rig.position.addScaledVector(fwd, -sp);
    if (keys.has('d') || keys.has('arrowright')) rig.position.addScaledVector(rgt, sp); if (keys.has('a') || keys.has('arrowleft')) rig.position.addScaledVector(rgt, -sp);
  } else locomotionXR(dt, cam);
  const rr = Math.hypot(rig.position.x, rig.position.z); if (rr > LOCO.radioMax) { rig.position.x *= LOCO.radioMax / rr; rig.position.z *= LOCO.radioMax / rr; }
  rig.position.y += (groundHeight(rig.position.x, rig.position.z) - rig.position.y) * Math.min(1, dt * 10);

  toys.hoverSet.clear();
  if (xrOn) controllers.forEach((c) => { if (!held.has(c)) { const it = pickToy(rayFrom(c)); if (it) toys.hoverSet.add(it.b); } });
  else if (mouseHover && !mouseItem) toys.hoverSet.add(mouseHover.b);
  if (mouseItem) { raycaster.setFromCamera(mouseNdc, camera); mouseHand.position.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, mouseDist); mouseHand.quaternion.copy(camera.getWorldQuaternion(new THREE.Quaternion())); mouseHand.updateMatrixWorld(true); }
  toys.update(dt, null);

  updateLook(dt);
  const camW = cam.getWorldPosition(tmpV).clone();
  rainMat.uniforms.uT.value = t; rainMat.uniforms.uCam.value.copy(camW);
  picaUpdate(dt, t);
  for (const b of butter) {
    const f = (tt) => tmpV2.set(b.c.x + Math.sin(tt * b.a[0] + b.p[0]) * b.R1, b.c.y + Math.sin(tt * b.a[1] + b.p[1]) * 0.45, b.c.z + Math.cos(tt * b.a[2] + b.p[2]) * b.R1);
    const p0 = f(t).clone(), p1 = f(t + 0.08);
    b.g.position.copy(p0); b.g.lookAt(p1); b.g.visible = look.mari > 0.05; b.g.scale.setScalar((0.9 + (b.ph % 1)) * 0.9 * Math.min(1, look.mari + 0.2));
    const a = Math.sin(t * b.rate + b.ph) * 0.9 + 0.2; b.L.rotation.z = a; b.R.rotation.z = -a;
  }
  { const pa = fires.geometry.attributes.position; for (let i = 0; i < fireN; i++) { pa.array[i * 3 + 1] += Math.sin(t * 0.7 + fireSeed[i]) * 0.0016; pa.array[i * 3] += Math.cos(t * 0.5 + fireSeed[i] * 2) * 0.0012; } pa.needsUpdate = true; }
  if (xrOn) {
    hud.mesh.visible = performance.now() < hudUntil;
    hudT += dt; if (hudT > 0.5) { hudT = 0; hud.set([cfg.titulo.toUpperCase(), `${fps} fps · ${HORAS[PARAM.hora].n}${PARAM.lluvia ? ' · lluvia' : ''}`, 'Joy izq: caminar · der: girar', 'Gatillo en el aire: arrastrar mundo', 'A: lluvia · B: hora · clic joystick: escenas'], '#9fe8b0'); }
    hud.follow(cam, dt);
  }
}
function applyActive(on) {
  active = on; panel.style.display = on ? '' : 'none'; audio.listener.setMasterVolume(on ? 1 : 0);
  if (on) { controllers.forEach((c) => rig.add(c)); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); camera.position.set(0, renderer.xr.isPresenting ? 0 : 1.62, 0); if (renderer.xr.isPresenting) hudUntil = performance.now() + 25000; renderer.setClearColor(0x000000, 1); app.setInfo({ titulo: cfg.titulo, intro: cfg.intro || '', hint: cfg.hint || '' }); }
}
window.__bosque = { THREE, scene, camera, rig, toys, PARAM, LOCO, setHora, toggleRain, setDensidad, pica, look: (y, p) => { yaw = y; pitch = p; } };
return {
  id: cfg.id, scene, camera, update, hasAR: false,
  enter: () => applyActive(true), exit: () => applyActive(false),
  onXRStart: () => { camera.position.set(0, 0, 0); hudUntil = performance.now() + 25000; }, onXRStop: () => { camera.position.set(0, 1.62, 0); },
};
}
