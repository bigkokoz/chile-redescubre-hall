import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as P from './papel.js';
import * as M from './papel_mv.js';
import { createToys, makeCup, makeOrb } from './juguetes.js';
import { HallAudio } from './audio.js';
import { VIAJE_STOPS, COMIDA, HALLAZGOS, HUMO } from './viaje_data.js';
import { makeGonfoterio } from './gonfoterio.js';
import { splitSentences } from './narrador.js';
import { visionCanvas } from './humo_img.js';

// ============================================================================
// EL VIAJE A MONTE VERDE — mundo hecho en Blender (luz horneada, como la Casa).
// Empiezas en el presente (pradera, mesa de taller y una palanca "MÁQUINA DEL TIEMPO"). Al tirarla, una ola de luz transforma el valle
// en cómo pudo ser hace ~14.800 años: bosque denso, río con repisa, muro de roca, un campamento chico con gente, fuego y comida.
// Todo se mide en metros; coordenadas del visor (x, y arriba, z) = Blender (x, z, -y).
// ============================================================================

const asset = (p) => new URL(p, document.baseURI).href;
const sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// forma del río (misma que en Blender; y_blender = -z)
const g0 = (x) => -0.012 * x, yc = (x) => -13 + 3.2 * Math.sin(x * 0.085 + 0.6), rapid = (x) => 1.3 * sst(8, 17, x);
const bed = (x) => g0(x) - 1.35 - rapid(x), halfw = (x) => 2 + 1.3 * sst(6, 12, x) * (1 - sst(17, 25, x));
const WATER_UP = 0.55;                           // el agua sube 55 cm sobre el cauce
const NX = 180, NY = 180, XA = -45, XB = 45, YA = -42, YB = 48;
const bl = (a) => new THREE.Vector3(a[0], a[2], -a[1]);   // Blender → visor

export async function createViaje(app) {
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const { renderer, $, say } = app;
  const loader = new GLTFLoader();
  const loadGlb = (f) => new Promise((res, rej) => loader.load(asset(`models/mv/${f}`), res, undefined, rej));
  const getJson = (f) => fetch(asset(`models/mv/${f}`)).then((r) => r.json());
  say('Cargando el valle de hoy…');
  const [hb, hoyT, hoyO, layH, layA] = await Promise.all([fetch(asset('models/mv/alturas.bin')).then((r) => r.arrayBuffer()), loadGlb('hoy_terreno.glb'), loadGlb('hoy_objetos.glb'), getJson('layout_hoy.json'), getJson('layout_antes.json')]);
  const H = new Float32Array(hb);
  function ground(x, z) {
    const fx = (x - XA) / (XB - XA) * NX, fy = (-z - YA) / (YB - YA) * NY, i = Math.max(0, Math.min(NX - 1, Math.floor(fx))), j = Math.max(0, Math.min(NY - 1, Math.floor(fy)));
    const u = Math.max(0, Math.min(1, fx - i)), v = Math.max(0, Math.min(1, fy - j)), a = (ii, jj) => H[jj * (NX + 1) + ii];
    return a(i, j) * (1 - u) * (1 - v) + a(i + 1, j) * u * (1 - v) + a(i, j + 1) * (1 - u) * v + a(i + 1, j + 1) * u * v;
  }

  // ---- escena ----
  const scene = new THREE.Scene();
  const COL = { hoyBg: new THREE.Color(0xd3dde4), pastBg: new THREE.Color(0xc2d8c4), hoyFog: [26, 150], pastFog: [6, 96] };
  scene.background = COL.hoyBg.clone(); scene.fog = new THREE.Fog(COL.hoyBg.clone(), COL.hoyFog[0], COL.hoyFog[1]);
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.03, 700);
  const rig = new THREE.Group(); rig.name = 'Jugador'; rig.add(camera); scene.add(rig);
  const FIRE = bl(layH.fuego); FIRE.y = ground(FIRE.x, FIRE.z);
  rig.position.set(FIRE.x, 0, FIRE.z - 3.4); rig.position.y = ground(rig.position.x, rig.position.z);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7a8a5a, 1.0));
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.0); sun.position.set(-4, 8, 3); scene.add(sun);
  const gH = new THREE.Group(), gP = new THREE.Group(); gH.name = 'Presente'; gP.name = 'Pasado'; scene.add(gH, gP);

  // ---- ola del tiempo: los materiales hornados se recortan según el radio de la ola ----
  const W = { c: { value: new THREE.Vector3() }, r: { value: -1 }, rev: { value: 0 } };
  function wavify(mat, past) {
    mat.customProgramCacheKey = () => 'viaje' + (past ? 'P' : 'H');
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uWC = W.c; sh.uniforms.uWR = W.r; sh.uniforms.uRev = W.rev;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform vec3 uWC; uniform float uWR; uniform float uRev;')
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          float wd = distance(vWP.xz, uWC.xz); bool ins = wd < uWR; bool pastVis = (ins == (uRev < 0.5));
          ${past ? 'if (!pastVis) discard;' : 'if (pastVis) discard;'}`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          if (uWR > 0.0 && uWR < 300.0) { float ring = smoothstep(1.7 + uWR * 0.025, 0.0, abs(wd - uWR)); gl_FragColor.rgb += ring * vec3(0.2, 1.0, 0.8); }`);
    };
  }
  const prep = (gltf, past, parent) => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return; const m = o.material, nm = new THREE.MeshBasicMaterial({ map: m.map, side: m.side, fog: true });
      if (m.map) m.map.anisotropy = 4; wavify(nm, past); o.material = nm; o.frustumCulled = false;
    });
    parent.add(gltf.scene);
  };
  prep(hoyT, false, gH); prep(hoyO, false, gH);
  const pastAt = (p) => { const wd = Math.hypot(p.x - W.c.value.x, p.z - W.c.value.z); return (wd < W.r.value) === (W.rev.value < 0.5); };

  // ---- agua con corriente (cauce más hondo, un rápido con espuma) ----
  const waterTex = P.toTex(M.waterCanvas(), true); waterTex.repeat.set(1, 16);
  const foamCv = document.createElement('canvas'); foamCv.width = foamCv.height = 256; { const x = foamCv.getContext('2d'), r = P.rng(7); x.clearRect(0, 0, 256, 256); for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(255,255,255,${0.12 + r() * 0.35})`; x.beginPath(); x.ellipse(r() * 256, r() * 256, 3 + r() * 16, 1 + r() * 4, 0, 0, 6.3); x.fill(); } }
  const foamTex = P.toTex(foamCv, true); foamTex.repeat.set(1, 5);
  const ribbon = (x0, x1, pad, mat, vs) => {
    const N = Math.round((x1 - x0) / 0.75), pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) { const x = x0 + (x1 - x0) * i / N, w = halfw(x) + pad, zc = -yc(x), y = bed(x) + WATER_UP; pos.push(x, y, zc - w, x, y, zc + w); uv.push(0, x * vs, 1, x * vs); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; return m;
  };
  const water = ribbon(-45, 45, 0.5, new THREE.MeshBasicMaterial({ map: waterTex, transparent: true, opacity: 0.86, fog: true }), 0.22); water.name = 'Agua'; scene.add(water);
  const foam = ribbon(7, 19, 0.3, new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }), 0.4); foam.position.y = 0.05; scene.add(foam);

  // ---- bordes: suelo lejano, montañas y bosque lejano (solo existen "con el tiempo") ----
  const farGround = new THREE.Mesh(new THREE.CircleGeometry(220, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x8c9a5a, fog: true })); farGround.position.y = 5.2; scene.add(farGround);
  function mountainsCanvas(past) {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 384; const x = c.getContext('2d'), r = P.rng(past ? 11 : 12);
    const ridge = (base, amp, seed, col, snowAbove, f) => {
      const ph = [r() * 6, r() * 6, r() * 6]; const h = (u) => base - amp * (0.55 + 0.3 * Math.sin(u * f + ph[0]) + 0.22 * Math.sin(u * f * 2.3 + ph[1]) + 0.12 * Math.sin(u * f * 5.1 + ph[2]));
      x.fillStyle = col; x.beginPath(); x.moveTo(0, 384); for (let u = 0; u <= 2048; u += 8) x.lineTo(u, h(u / 2048 * 6.2832)); x.lineTo(2048, 384); x.closePath(); x.fill();
      if (snowAbove != null) { x.fillStyle = 'rgba(250,252,255,0.96)'; for (let u = 0; u < 2048; u += 8) { const y = h(u / 2048 * 6.2832); if (y < snowAbove) { x.beginPath(); x.moveTo(u, y); x.lineTo(u + 8, h((u + 8) / 2048 * 6.2832)); x.lineTo(u + 8, y + (snowAbove - y) * 0.9 + 6 * Math.sin(u)); x.lineTo(u, y + (snowAbove - y) * 0.9 + 6 * Math.cos(u)); x.fill(); } } }
    };
    if (past) { ridge(300, 250, 1, '#9fb3c8', 150, 3); ridge(335, 160, 2, '#5e7a6a', null, 4.4); ridge(370, 90, 3, '#2f4a38', null, 6.2); }
    else { ridge(320, 130, 1, '#a9b7c4', null, 3); ridge(350, 80, 2, '#97a070', null, 5); ridge(375, 50, 3, '#8a8a52', null, 7); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
  }
  const mkMount = (past) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(300, 300, 170, 48, 1, true), new THREE.MeshBasicMaterial({ map: mountainsCanvas(past), transparent: true, side: THREE.BackSide, fog: false, depthWrite: false })); m.position.y = 50; m.renderOrder = -1; scene.add(m); return m; };
  const mountH = mkMount(false), mountP = mkMount(true);
  // bosque lejano de recortes (se pone a crecer con la ola)
  const tintMats = [];
  function billboard(mat) {
    mat.customProgramCacheKey = () => 'bill2';
    mat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', /* glsl */`
      vec3 ctr = vec3(instanceMatrix[3]); float sx = length(vec3(instanceMatrix[0])), sy = length(vec3(instanceMatrix[1]));
      vec3 toCam = cameraPosition - ctr; toCam.y = 0.0; toCam = normalize(toCam + vec3(1e-5)); vec3 rgt = vec3(toCam.z, 0.0, -toCam.x);
      vec4 mvPosition = viewMatrix * vec4(ctr + rgt * transformed.x * sx + vec3(0.0, transformed.y * sy, 0.0), 1.0); gl_Position = projectionMatrix * mvPosition;`); };
    return mat;
  }
  const farForest = new THREE.Group(); farForest.name = 'Bosque_lejano'; scene.add(farForest);
  { const cardGeo = new THREE.PlaneGeometry(1, 1); cardGeo.translate(0, 0.5, 0);
    const tcs = [['broad', 11], ['broad', 12], ['alerce', 14], ['alerce', 15], ['dead', 16]].map(([k, s]) => P.treeCanvas(k, s));
    tcs.forEach((cv, k) => {
      const mat = billboard(new THREE.MeshBasicMaterial({ map: P.toTex(cv), alphaTest: 0.45, side: THREE.DoubleSide, fog: true, color: new THREE.Color(0.9, 1, 0.9) })), n = 70, im = new THREE.InstancedMesh(cardGeo, mat, n), r = P.rng(300 + k), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
      for (let i = 0; i < n; i++) { const a = r() * 6.283, rad = 50 + Math.sqrt(r()) * 70, h = 13 + r() * 12; m.compose(p.set(Math.cos(a) * rad, 5.0, Math.sin(a) * rad), q, s.set(h * 0.55, h, 1)); im.setMatrixAt(i, m); }
      im.frustumCulled = false; farForest.add(im);
    }); }
  farForest.visible = false;

  // ---- gente (figuras recortadas con movimiento sutil) ----
  const texLoader = new THREE.TextureLoader();
  const ALT = { anciano: 1.15, joven: 1.0, muele1: 1.0, muele2: 1.0, talla: 1.0, bayas1: 1.15, bayas2: 1.15, bayas3: 1.15, canasto: 1.65, algas: 1.65, gonfoterio: 3.0 };
  const peopleList = [];
  async function sprite(name, pos, o = {}) {
    const t = await texLoader.loadAsync(asset(`gente/${name}.png`)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const alt = o.alt || ALT[name], w = alt * t.image.width / t.image.height;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, alt).translate(0, alt / 2, 0), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, fog: true }));
    m.position.copy(pos); m.visible = false; m.scale.setScalar(0.001); gP.add(m); peopleList.push({ m, name, p0: pos.clone(), ph: Math.random() * 6.28, pop: 0, work: /muele|talla/.test(name), walk: o.walk });
  }
  {
    const seats = layA.asientos, job = [];
    layA.puestos.forEach((p) => { if (p.a) { const s = seats[+p.a.slice(-1)]; job.push(sprite(p.sprite, new THREE.Vector3(s[0], s[2] - 0.12, -s[1]))); } else job.push(sprite(p.sprite, bl(p.pos))); });
    job.push(sprite('bayas3', new THREE.Vector3(3.0, ground(3, 4.6), 4.6)), sprite('muele2', new THREE.Vector3(-1.6, ground(-1.6, 3.0), 3.0)), sprite('canasto', new THREE.Vector3(-2.6, ground(-2.6, 7.2), 7.2)));
    await Promise.all(job);
  }
  // el gonfoterio es un modelo 3D que camina por la orilla norte del río (con patas y trompa animadas)
  const gonfo = makeGonfoterio(); gonfo.group.visible = false; gonfo.group.scale.setScalar(0.001); gP.add(gonfo.group);
  const gonfoS = { x: -24, z: 0, head: Math.PI / 2, pop: 0, sp: 0 }; gonfoS.z = -(yc(gonfoS.x) + halfw(gonfoS.x) + 5.5);
  const gonfoX = (t) => -34 + (Math.sin(t * 0.04 + 1) * 0.5 + 0.5) * 22;      // va y viene entre x=-34 y x=-12

  // ---- fuego (solo en el pasado) ----
  const flameTex = P.toTex(M.flameCanvas()), glowTex = P.toTex(P.glowCanvas());
  const fireG = new THREE.Group(); fireG.position.copy(FIRE); gP.add(fireG);
  const flames = [0, 1, 2].map((i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: [0xffb050, 0xffd070, 0xff7a30][i], blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false })); s.center.set(0.5, 0.05); fireG.add(s); return s; });
  const fireLight = new THREE.PointLight(0xff8a3c, 2.2, 10, 1.6); fireLight.position.y = 0.7; fireG.add(fireLight);
  const emberN = 24, ep = new Float32Array(emberN * 3), eSeed = []; for (let i = 0; i < emberN; i++) { ep.set([(Math.random() - 0.5) * 0.4, Math.random() * 1.6, (Math.random() - 0.5) * 0.4], i * 3); eSeed.push(Math.random()); }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
  const embers = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0xffa040, size: 0.05, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); embers.frustumCulled = false; fireG.add(embers);
  let fireE = 0.8;
  const smokeCv = document.createElement('canvas'); smokeCv.width = smokeCv.height = 64; { const x = smokeCv.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(200,200,200,0.9)'); g.addColorStop(0.5, 'rgba(160,160,160,0.35)'); g.addColorStop(1, 'rgba(120,120,120,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
  const smokeTex = P.toTex(smokeCv), smoke = [];
  for (let i = 0; i < 16; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0, fog: true })); fireG.add(sp); smoke.push({ sp, t: i / 16 * 6, dur: 6, sx: Math.random() - 0.5 }); }
  const moteN = 140, motePos = new Float32Array(moteN * 3), moteSeed = [];
  for (let i = 0; i < moteN; i++) { const a = Math.random() * 6.283, r = 1 + Math.random() * 13; motePos.set([FIRE.x + Math.cos(a) * r, FIRE.y + 0.3 + Math.random() * 3.5, FIRE.z + Math.sin(a) * r], i * 3); moteSeed.push(Math.random() * 6.28); }
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: glowTex, size: 0.09, color: 0xe8ffb0, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); motes.frustumCulled = false; gP.add(motes);

  // ---- máquina del tiempo (palanca) y cristal de regreso ----
  const CON = bl(layH.consola), LEVER = new THREE.Vector3(CON.x, CON.y + 0.955, CON.z);
  const lever = new THREE.Group(); lever.position.copy(LEVER); gH.add(lever);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.5, 8).translate(0, 0.25, 0), new THREE.MeshBasicMaterial({ color: 0xcfd6dc }));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10).translate(0, 0.52, 0), new THREE.MeshBasicMaterial({ color: 0xd8452a, toneMapped: false })); lever.add(rod, knob); lever.rotation.x = 0.7;
  const knobHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: P.toTex(P.glowCanvas()), color: 0xff6a3a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, fog: false })); knobHalo.position.set(0, 0.52, 0); knobHalo.scale.setScalar(0.3); lever.add(knobHalo);
  wavify(rod.material, false); wavify(knob.material, false);          // la palanca se disuelve con la ola, como todo lo del presente
  const leverHit = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6).translate(0, 0.4, 0), new THREE.MeshBasicMaterial({ visible: false })); lever.add(leverHit);
  const label = (txt, sub, w = 1.5) => { const c = document.createElement('canvas'); c.width = 768; c.height = 192; const x = c.getContext('2d'); x.fillStyle = 'rgba(8,14,12,0.82)'; x.beginPath(); x.roundRect(4, 4, 760, 184, 36); x.fill(); x.strokeStyle = '#35f0c0'; x.lineWidth = 6; x.stroke(); x.textAlign = 'center'; x.fillStyle = '#9fffe0'; x.font = '800 70px system-ui, sans-serif'; x.fillText(txt, 384, 92); x.fillStyle = '#fff'; x.font = '600 44px system-ui, sans-serif'; x.fillText(sub, 384, 156); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: P.toTex(c), transparent: true, depthTest: false, fog: false })); s.scale.set(w, w * 0.25, 1); s.renderOrder = 900; return s; };
  const leverLabel = label('MÁQUINA DEL TIEMPO', 'tira la palanca', 1.25); leverLabel.position.set(CON.x, CON.y + 1.95, CON.z); gH.add(leverLabel);
  const crystalPos = new THREE.Vector3(FIRE.x - 1.3, FIRE.y + 1.4, FIRE.z + 0.4);
  const crystal = new THREE.Group(); crystal.position.copy(crystalPos); gP.add(crystal);
  const cMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0x6ff0c8, toneMapped: false, fog: false })); crystal.add(cMesh);
  const cWire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.24)), new THREE.LineBasicMaterial({ color: 0xbff8ff, fog: false })); crystal.add(cWire);
  const cHit = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); crystal.add(cHit);
  const cLabel = label('VOLVER AL PRESENTE', 'toca el cristal', 0.9); cLabel.position.y = 0.55; crystal.add(cLabel);

  // ---- la historia del humo: tocas el fuego y el humo muestra imágenes mientras la narradora cuenta cómo pudieron llegar los antepasados ----
  const humoLabel = label('HISTORIA DEL HUMO', 'toca el fuego', 1.1); humoLabel.position.set(0, 2.15, 0); fireG.add(humoLabel);
  const visTex = HUMO.map((c) => P.toTex(visionCanvas(c.img)));
  const vision = new THREE.Sprite(new THREE.SpriteMaterial({ map: visTex[0], transparent: true, depthWrite: false, opacity: 0, fog: false })); vision.scale.set(4.6, 2.875, 1); vision.position.set(0, 3.3, 0); vision.renderOrder = 50; fireG.add(vision);
  const HS = { amt: 0, shown: -1, fade: 0, map: HUMO.flatMap((c, i) => splitSentences(c.t).map(() => i)), texto: HUMO.flatMap((c) => c.t) };
  const humoLive = () => { const ns = app.narr.state; return !!(ns.stop && ns.stop.id === 'humo' && ns.sentences.length && !(!ns.playing && ns.idx >= ns.sentences.length - 1)); };
  function startHumo() {
    if (T.era !== 'antes' || T.moving) return; if (humoLive() && app.narr.state.playing) { app.narr.pause(); return; }
    app.narr.play({ id: 'humo', titulo: 'La historia del humo', texto: HS.texto, qa: [] }); fireE = Math.min(2.2, fireE + 0.5);
  }

  // ---- audio ----
  const audio = new HallAudio(camera); audio.prefs = app.aud; scene.add(audio.sfxRoot);
  let audioOn = false, rivA = null, rivB = null, murm = null, fuegoS = null, wind = null, lp = null, lpTarget = 20000;
  const rivEm = new THREE.Object3D(), rivEm2 = new THREE.Object3D(); rivEm2.position.set(12, bed(12) + 0.8, -yc(12)); scene.add(rivEm, rivEm2);
  async function startAudio() {
    if (audioOn) return; audioOn = true;
    await audio.start(new THREE.Object3D(), [], { pad: false });
    const ctx = THREE.AudioContext.getContext(); lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000;
    rivA = audio.loopAt(rivEm, 'rio', 0.5, 3); rivB = audio.loopAt(rivEm2, 'rio', 0.7, 5);
    [rivA, rivB].forEach((a) => a && a.setFilter(lp));
    murm = audio.loopAt(fireG, 'murmullo', 0.35, 2.2); fuegoS = audio.loopAt(fireG, 'fuego', 0.4, 2.0); wind = audio.ambient('viento2', 0.08);
  }

  // ---- paradas (esferas con la clase) ----
  const VS = VIAJE_STOPS.map((s) => { const x = s.pos[0], z = s.pos[2]; return { ...s, pos: [x, ground(x, z) + s.pos[1], z] }; });
  const stopObjs = [], stopHits = [];
  VS.forEach((s, i) => {
    const g = new THREE.Group(); g.position.set(...s.pos); (i === 0 ? gH : gP).add(g);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), new THREE.MeshBasicMaterial({ color: 0x9fffe0, toneMapped: false, fog: false })); g.add(core);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x6ff0c8, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55, fog: false })); halo.scale.setScalar(0.5); g.add(halo);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.userData.stop = i; g.add(hit); stopHits.push(hit);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const cx = cv.getContext('2d'); cx.fillStyle = 'rgba(8,14,12,0.78)'; cx.beginPath(); cx.roundRect(4, 4, 504, 120, 30); cx.fill(); cx.fillStyle = '#9fffe0'; cx.font = '700 40px system-ui, sans-serif'; cx.textAlign = 'center'; cx.fillText(`${i + 1}/${VS.length}`, 256, 50); cx.fillStyle = '#fff'; cx.font = '600 34px system-ui, sans-serif'; cx.fillText(s.titulo.length > 30 ? s.titulo.slice(0, 29) + '…' : s.titulo, 256, 98);
    const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: P.toTex(cv), transparent: true, depthTest: false, fog: false })); lab.scale.set(0.95, 0.24, 1); lab.position.y = 0.34; lab.renderOrder = 900; g.add(lab);
    stopObjs.push({ i, g, core, halo, lab, base: g.position.clone(), visited: false });
  });

  // ---- juguetes: herramientas sobre la mesa (hoy) y comida en los canastos (pasado) ----
  const TAB = bl(layH.mesa), TOP = 0.88;
  const solidsH = [{ min: new THREE.Vector3(TAB.x - 0.95, 0.8, TAB.z - 0.43), max: new THREE.Vector3(TAB.x + 0.95, TOP, TAB.z + 0.43) }, { min: new THREE.Vector3(CON.x - 0.28, 0, CON.z - 0.2), max: new THREE.Vector3(CON.x + 0.28, 0.955, CON.z + 0.2) }];
  const floorHere = (x, z) => Math.hypot(x - FIRE.x, z - FIRE.z) < 16;
  const toysH = createToys({ audio, parent: gH, solids: solidsH, onFloor: floorHere, defaults: false });
  const toysP = createToys({ audio, parent: gP, solids: [], onFloor: floorHere, defaults: false });
  const std = (c, r = 0.8, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const part = (g, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  const kraft = std(0xb98b5a), metal = std(0x59606a, 0.45, 0.4), red = std(0xd8452a, 0.6);
  const putH = (kind, obj, dx, dz, o) => { const b = toysH.add(kind, obj, new THREE.Vector3(TAB.x + dx, TOP + (o.r || 0.05) + 0.002, TAB.z + dz), o); obj.rotation.y = o.yaw || 0; return b; };
  { const h = new THREE.Group(); part(h, new THREE.BoxGeometry(0.03, 0.03, 0.3), kraft, 0, 0, 0); part(h, new THREE.BoxGeometry(0.1, 0.05, 0.05), metal, 0, 0, 0.14); putH('martillo', h, -0.45, 0.05, { r: 0.06, e: 0.2, yaw: 0.4 });
    const p = new THREE.Group(); part(p, new THREE.BoxGeometry(0.02, 0.016, 0.2), red, 0.016, 0, -0.07, 0, 0.12); part(p, new THREE.BoxGeometry(0.02, 0.016, 0.2), red, -0.016, 0, -0.07, 0, -0.12); part(p, new THREE.BoxGeometry(0.018, 0.014, 0.1), metal, 0, 0, 0.09); putH('alicate', p, -0.1, 0.12, { r: 0.05, e: 0.2, yaw: -0.5 });
    putH('taza', makeCup(0xc4623a), 0.35, -0.12, { r: 0.046, e: 0.25, upright: 'yaw', color: 0xc4623a, roll: 7 }); putH('taza', makeCup(0xf2ead8), 0.55, 0.15, { r: 0.046, e: 0.25, upright: 'yaw', color: 0xf2ead8, roll: 7 });
    [[-0.5, 1.5, 0.5], [0.3, 1.8, 0.9], [1.4, 1.5, -0.2]].forEach(([dx, dy, dz]) => { const o = makeOrb(); o.userData.parts.forEach((m) => m.color.set(0xffd23c)); toysH.add('orbe', o, new THREE.Vector3(TAB.x + dx, dy, TAB.z + dz), { r: 0.07, e: 0.9, g: 0, drag: 0.7, roll: 0.5 }); }); }
  const FOODS = {
    papa: () => { const g = new THREE.Group(); const m = part(g, new THREE.IcosahedronGeometry(0.045, 1), std(0x9a7a48, 1)); m.scale.set(1.25, 0.8, 1); return [g, 0.04]; },
    bayas: () => { const g = new THREE.Group(); [[0, 0, 0], [0.025, 0.01, 0.01], [-0.02, 0.012, 0.02], [0.005, 0.03, -0.01]].forEach(([x, y, z]) => part(g, new THREE.SphereGeometry(0.02, 8, 6), std(0xb02a4a, 0.5), x, y, z)); return [g, 0.035]; },
    alga: () => { const g = new THREE.Group(); part(g, new THREE.BoxGeometry(0.13, 0.012, 0.06), std(0x2f4a2c, 1)); part(g, new THREE.BoxGeometry(0.09, 0.012, 0.05), std(0x3d5a34, 1), 0.01, 0.01, 0.02, 0, 0.5); return [g, 0.02]; },
    carne: () => { const g = new THREE.Group(); part(g, new THREE.BoxGeometry(0.11, 0.035, 0.055), std(0x8a2a22, 0.7)); part(g, new THREE.CylinderGeometry(0.006, 0.006, 0.16, 5), kraft, 0, 0.022, 0, 0, 0, Math.PI / 2); return [g, 0.03]; },
    nuez: () => { const g = new THREE.Group(); part(g, new THREE.SphereGeometry(0.026, 8, 6), std(0x6a4a2a, 0.8)); return [g, 0.026]; },
    hongo: () => { const g = new THREE.Group(); part(g, new THREE.CylinderGeometry(0.012, 0.016, 0.05, 7), std(0xf1e7c8), 0, 0.025, 0); part(g, new THREE.SphereGeometry(0.035, 10, 6, 0, 6.3, 0, 1.6), std(0xc4562e), 0, 0.05, 0); return [g, 0.04]; },
  };
  // ---- menú del arqueólogo: réplicas de lo que se encontró (aparecen frente a ti y se pueden agarrar y lanzar) ----
  const REPL = {
    madera: () => { const g = new THREE.Group(); part(g, new THREE.BoxGeometry(0.34, 0.035, 0.09), std(0x7a5a38, 1)); part(g, new THREE.CylinderGeometry(0.014, 0.01, 0.3, 6), std(0x6a4a2c, 1), 0.07, 0.04, 0.02, Math.PI / 2, 0, 0.5); return [g, 0.045]; },
    piel: () => { const g = new THREE.Group(); const m = part(g, new THREE.BoxGeometry(0.22, 0.01, 0.16), std(0x8a6a4a, 1)); m.rotation.y = 0.2; part(g, new THREE.BoxGeometry(0.1, 0.012, 0.08), std(0x6a4c32, 1), 0.04, 0.008, 0.03, 0, 0.6); return [g, 0.03]; },
    hueso: () => { const g = new THREE.Group(); const bone = std(0xe6dcc4, 0.85); part(g, new THREE.CylinderGeometry(0.022, 0.022, 0.26, 8), bone, 0, 0, 0, 0, 0, Math.PI / 2); [-1, 1].forEach((s) => { part(g, new THREE.SphereGeometry(0.035, 8, 6), bone, s * 0.13, 0.015, 0); part(g, new THREE.SphereGeometry(0.035, 8, 6), bone, s * 0.13, -0.015, 0); }); return [g, 0.04]; },
    hoja: () => { const g = new THREE.Group(); const m = part(g, new THREE.SphereGeometry(0.07, 10, 6), std(0x4f7a3a, 0.9)); m.scale.set(1, 0.08, 0.55); part(g, new THREE.CylinderGeometry(0.004, 0.004, 0.16, 4), std(0x3a5a2a), 0, 0.006, 0, 0, 0, Math.PI / 2); return [g, 0.02]; },
    papa: () => FOODS.papa(), alga: () => FOODS.alga(),
    piedra: () => { const g = new THREE.Group(); part(g, new THREE.IcosahedronGeometry(0.05, 1), std(0x8a8a86, 1)); return [g, 0.05]; },
    carbon: () => { const g = new THREE.Group(); [[0, 0, 0, 0.035], [0.05, 0, 0.02, 0.025], [-0.03, 0, 0.045, 0.028]].forEach(([x, y, z, r]) => { const m = part(g, new THREE.DodecahedronGeometry(r, 0), std(0x1a1816, 1), x, y, z); m.scale.y = 0.7; }); return [g, 0.035]; },
  };
  const spawnedFind = {}, fwdF = new THREE.Vector3(), camWF = new THREE.Vector3();
  const finds = {
    list: HALLAZGOS, sel: -1,
    show(i) {
      const h = HALLAZGOS[i]; if (!h) return; finds.sel = i;
      app.narr.play({ id: 'hallazgo-' + h.id, titulo: h.titulo, texto: h.texto, qa: [] });
      const ts = toysNow(), key = h.kind + T.era, prev = spawnedFind[key]; if (prev) { prev.state = 'dead'; prev.obj.visible = false; prev.respawn = 1e9; }
      camera.getWorldPosition(camWF); camera.getWorldDirection(fwdF); fwdF.y = 0; fwdF.normalize();
      const [obj, r] = REPL[h.kind](), p = camWF.clone().addScaledVector(fwdF, 0.7); p.y = camWF.y - 0.4;
      const b = ts.add(h.kind, obj, p, { r, e: 0.2, roll: 6 }); b.sleep = false; b.idle = 0; spawnedFind[key] = b;
      try { audio.sfx('pop', p, 0.5); } catch { /* sin audio */ }
    },
  };
  layA.canastos.forEach((c, k) => {
    const base = bl(c); ['papa', 'bayas', 'alga', 'carne', 'nuez', 'hongo'].forEach((kind, i) => {
      if ((i + k) % 3 === 0 && i > 3) return; const [obj, r] = FOODS[kind](); const a = i / 6 * 6.283 + k;
      toysP.add(kind, obj, new THREE.Vector3(base.x + Math.cos(a) * 0.14, base.y + 0.16 + (i % 2) * 0.06, base.z + Math.sin(a) * 0.14), { r, e: 0.2, roll: 6 });
    });
  });
  { const twig = (len) => { const g = new THREE.Group(); part(g, new THREE.CylinderGeometry(0.01, 0.014, len, 6), std(0x6e5436, 1), 0, 0, 0, Math.PI / 2); return g; };
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.4, d = 0.95 + (i % 3) * 0.12; const o = twig(0.22 + (i % 3) * 0.06); toysP.add('palito', o, new THREE.Vector3(FIRE.x + Math.cos(a) * d, FIRE.y + 0.03, FIRE.z + Math.sin(a) * d), { r: 0.025, e: 0.3, roll: 8 }); o.rotation.y = a; } }

  // ---- estado del viaje ----
  // charge = segundos desde que tiras la palanca (la máquina "carga" ~2 s) antes de que salga la ola; DUR = lo que dura la ola
  const T = { era: 'hoy', moving: false, t: 0, dir: 1, blend: 0, charge: 0, pastReady: false, wantTravel: false, pending: -1 };
  const CHARGE = 2.2, DUR = 10;
  let pastLoadErr = '';
  const pastP = Promise.all([loadGlb('antes_terreno.glb'), loadGlb('antes_objetos.glb')]).then(([t, o]) => { prep(t, true, gP); prep(o, true, gP); T.pastReady = true; if (T.wantTravel) { T.wantTravel = false; pullLever(); } }).catch((e) => { pastLoadErr = String(e.message || e); say('No se pudo cargar el pasado: ' + pastLoadErr); });
  /** parte la ola de tiempo desde la máquina (al ir) o desde el cristal (al volver) */
  function travel(to) {
    if (T.moving || T.era === to) return;
    if (to === 'antes' && !T.pastReady) { T.wantTravel = true; say('La máquina se está calentando… (cargando el pasado)'); return; }
    T.wantTravel = false; T.moving = true; T.t = 0; T.dir = to === 'antes' ? 1 : -1; T.target = to;
    W.c.value.copy(to === 'antes' ? CON : crystalPos); W.rev.value = to === 'antes' ? 0 : 1; W.r.value = 0.01;
    try { audio.sfx('zumbido', W.c.value, 0.8); } catch { /* sin audio */ }
  }
  /** tirar la palanca: la palanca baja (se ve), la máquina vibra y se enciende, y recién ahí sale la ola */
  function pullLever() {
    if (T.moving || T.charge > 0 || T.era !== 'hoy') return;
    if (!T.pastReady) { T.wantTravel = true; say('La máquina se está calentando… (cargando el pasado)'); return; }
    T.charge = 0.001; try { audio.sfx('zumbido', LEVER, 0.9); audio.sfx('pop', LEVER, 0.7); } catch { /* sin audio */ }
  }
  const mv = {
    stops: VS, cur: -1,
    needsTravel: (i) => i > 0 && T.era !== 'antes',
    play(i) {
      const s = VS[i]; if (!s) return;
      if (i > 0 && T.era !== 'antes') { T.pending = i; if (T.moving || T.charge > 0) return; pullLever(); return; }
      mv.cur = i; markVisited(i); app.narr.play(s); app.onStopPlay && app.onStopPlay(i);
    },
  };
  function markVisited(i) { const s = stopObjs[i]; if (s) { s.visited = true; s.core.material.color.set(0xffd27a); s.halo.material.color.set(0xffb050); } }
  const village = {
    pickStop(rc) { let best = -1, bd = 0.55; stopObjs.forEach((s) => { if (!s.g.visible) return; const d = rayDist(rc, s.g.getWorldPosition(new THREE.Vector3())); if (d < bd) { bd = d; best = s.i; } }); return best; },
    markVisited, onAudioStart() {}, update() {},
  };

  // ---- reglas de movimiento: el muro de roca y el cauce hondo no se cruzan ----
  const MARGIN = { x: 40, zMin: -38, zMax: 44 };
  function canStand(x, z) {
    if (Math.abs(x) > MARGIN.x || z < MARGIN.zMin || z > MARGIN.zMax) return false;
    const by = -z; if (by < yc(x) - halfw(x) - 0.2) return false;        // muro de roca al sur
    return ground(x, z) >= bed(x) + 0.28;                                  // el centro del cauce es muy hondo
  }
  const headW = new THREE.Vector3();
  /** mueve al jugador (dx, dz) si la cabeza queda en un lugar permitido; si no, resbala por el muro; si ya estaba atrapado, deja salir */
  function move(dx, dz) {
    const ox = headW.x, oz = headW.z; let mx = dx, mz = dz;
    if (!canStand(ox + dx, oz + dz) && canStand(ox, oz)) { if (canStand(ox + dx, oz)) mz = 0; else if (canStand(ox, oz + dz)) mx = 0; else { mx = 0; mz = 0; } }
    rig.position.x += mx; rig.position.z += mz; headW.x += mx; headW.z += mz;
  }

  // ---- interacción ----
  const raycaster = new THREE.Raycaster(), tmpM = new THREE.Matrix4();
  const toysNow = () => (T.era === 'hoy' ? toysH : toysP);
  const pickToy = (rc) => { const hit = rc.intersectObjects(toysNow().pickables(), false)[0]; return hit ? { b: hit.object.userData.toy, dist: hit.distance } : null; };
  const rayFrom = (c) => { tmpM.identity().extractRotation(c.matrixWorld); raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld); raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tmpM); raycaster.far = 6; return raycaster; };
  const _c = new THREE.Vector3(), _p = new THREE.Vector3();
  /** distancia del rayo a un punto (0.. si está delante del rayo y cerca); -1 si queda detrás o lejos */
  function rayDist(rc, pt) { _c.copy(pt).sub(rc.ray.origin); const t = _c.dot(rc.ray.direction); if (t < 0.05 || t > 7) return 9; _p.copy(rc.ray.direction).multiplyScalar(t).add(rc.ray.origin); return _p.distanceTo(pt); }
  const wp = (o, off) => o.localToWorld(_c.copy(off || new THREE.Vector3()).clone());
  const hitsObj = (rc, o) => { if (!(o.parent && o.parent.visible)) return false; const pt = o === leverHit ? wp(lever, new THREE.Vector3(0, 0.45, 0)) : wp(o); return rayDist(rc, pt) < (o === leverHit ? 0.38 : 0.6); };
  /** gesto sobre algo del mundo: palanca, cristal, parada. Devuelve true si lo usó. */
  function useWorld(rc) {
    if (T.era === 'hoy' && !T.moving && hitsObj(rc, leverHit)) { pullLever(); return true; }
    if (T.era === 'antes' && !T.moving && hitsObj(rc, cHit)) { travel('hoy'); return true; }
    const si = village.pickStop(rc); if (si >= 0) { mv.play(si); return true; }
    if (fireAim(rc)) { startHumo(); return true; }
    return false;
  }
  const _f = new THREE.Vector3();
  const fireAim = (rc) => fireG.visible && T.era === 'antes' && !T.moving && rayDist(rc, _f.set(FIRE.x, FIRE.y + 0.6, FIRE.z)) < 0.7;
  function foodTalk(b) { const txt = T.era === 'antes' && COMIDA[b.kind]; if (!txt || app.narr.state.playing) return; app.narr.play({ id: 'comida', titulo: 'Comida del campamento', texto: [txt], qa: [] }); }
  const held = new Map(); let drag = null;
  const busy = () => !active || performance.now() < app.suppressUntil || app.menuOpen();
  app.controllers.forEach((c) => {
    const line = c.userData.line;
    const start = () => {
      if (busy()) return; startAudio();
      if (useWorld(rayFrom(c))) return;
      const it = pickToy(rayFrom(c));
      if (it) { toysNow().grab(it.b, c); foodTalk(it.b); held.set(c, { b: it.b, ts: toysNow() }); line.visible = false; } else if (!drag && app.loco.grab) drag = { c, prev: c.position.clone() };
    };
    const end = () => { const h = held.get(c); if (h) { h.ts.release(h.b); held.delete(c); } line.visible = true; if (drag && drag.c === c) drag = null; };
    c.addEventListener('selectstart', start); c.addEventListener('selectend', end); c.addEventListener('squeezestart', start); c.addEventListener('squeezeend', end);
  });
  const yawQ = new THREE.Quaternion(), fwd = new THREE.Vector3(), rgt = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tmpV = new THREE.Vector3();
  let snapLatch = false; const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
  function locomotionXR(dt, cam) {
    const session = renderer.xr.getSession(); if (!session) return; cam.getWorldPosition(headW);
    for (const src of session.inputSources) {
      const gp = src.gamepad; if (!gp) continue; const ax = gp.axes, hand = src.handedness, x = dz(ax[2] || 0), y = dz(ax[3] || 0);
      if (hand === 'left' && (x || y) && app.loco.joystick) { cam.getWorldQuaternion(yawQ); fwd.set(0, 0, -1).applyQuaternion(yawQ); fwd.y = 0; fwd.normalize(); rgt.set(-fwd.z, 0, fwd.x); const sp = app.loco.speed * (gp.buttons[3] && gp.buttons[3].pressed ? 2.2 : 1) * dt; move(-fwd.x * y * sp + rgt.x * x * sp, -fwd.z * y * sp + rgt.z * x * sp); }   // apretar el joystick caminando = correr
      if (hand === 'right' && app.loco.snap) {
        if (app.loco.smooth) { if (x) { const a = -x * THREE.MathUtils.degToRad(app.loco.turnSpeed) * dt; rig.position.sub(headW).applyAxisAngle(up, a).add(headW); rig.rotation.y += a; } }
        else if (Math.abs(x) > 0.7 && !snapLatch) { snapLatch = true; const a = -Math.sign(x) * THREE.MathUtils.degToRad(app.loco.snapDeg); rig.position.sub(headW).applyAxisAngle(up, a).add(headW); rig.rotation.y += a; } else if (Math.abs(x) < 0.3) snapLatch = false;
      }
    }
    if (drag && !app.loco.grab) drag = null;
    if (drag) { const cur = drag.c.position, d = drag.prev.clone().sub(cur); d.y = 0; d.applyQuaternion(rig.quaternion).multiplyScalar(app.loco.gain); move(d.x, d.z); drag.prev.copy(cur); }
  }
  // escritorio / celular
  let active = false, yaw = Math.PI, pitch = -0.08, dragLook = false, lx = 0, ly = 0, lookId = -1, mouseItem = null, mouseDist = 1, mouseHover = null;
  const mouseNdc = new THREE.Vector2(), mouseHand = new THREE.Object3D(); scene.add(mouseHand); const keys = new Set();
  function ndc(e) { const r = renderer.domElement.getBoundingClientRect(); mouseNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); raycaster.setFromCamera(mouseNdc, camera); raycaster.far = 8; }
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (!active) return; startAudio(); if (renderer.xr.isPresenting) return; ndc(e);
    if (useWorld(raycaster)) return;
    const it = pickToy(raycaster);
    if (it) { mouseItem = { b: it.b, ts: toysNow() }; mouseDist = it.dist; mouseHand.position.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, mouseDist); mouseHand.quaternion.copy(camera.getWorldQuaternion(new THREE.Quaternion())); mouseHand.updateMatrixWorld(true); mouseItem.ts.grab(it.b, mouseHand); foodTalk(it.b); return; }
    dragLook = true; lx = e.clientX; ly = e.clientY; lookId = e.pointerId;
  });
  addEventListener('pointerup', () => { if (!active) return; dragLook = false; if (mouseItem) { mouseItem.ts.release(mouseItem.b); mouseItem = null; } });
  addEventListener('pointermove', (e) => {
    if (!active || renderer.xr.isPresenting) return; ndc(e);
    if (!mouseItem) { mouseHover = pickToy(raycaster); const over = (T.era === 'hoy' && hitsObj(raycaster, leverHit)) || (T.era === 'antes' && hitsObj(raycaster, cHit)) || village.pickStop(raycaster) >= 0 || fireAim(raycaster); renderer.domElement.style.cursor = mouseHover || over ? 'pointer' : dragLook ? 'grabbing' : 'grab'; }
    if (!dragLook || e.pointerId !== lookId) return; yaw -= (e.clientX - lx) * 0.004; pitch = Math.max(-1.3, Math.min(1.3, pitch - (e.clientY - ly) * 0.004)); lx = e.clientX; ly = e.clientY;
  });
  addEventListener('keydown', (e) => { if (!active) return; startAudio(); keys.add(e.key.toLowerCase()); if (e.key === 't' || e.key === 'T') { if (T.era === 'hoy') pullLever(); else travel('hoy'); } if (e.key === 'r' || e.key === 'R') toysNow().resetAll(); if ((e.key === 'h' || e.key === 'H') && T.era === 'antes') startHumo(); });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  // ---- bucle ----
  const eased = (u) => u * u * (3 - 2 * u);
  const col1 = new THREE.Color(), tNow = { t: 0 }; let chirpT = 6, autoT = 0, aimed = -1;
  const camW = new THREE.Vector3(), tmpA = new THREE.Vector3();
  function update(dt) {
    tNow.t += dt; const t = tNow.t, xrOn = renderer.xr.isPresenting, cam = camera;
    // movimiento
    headW.set(rig.position.x, 0, rig.position.z);
    if (!xrOn) {
      app.input.look(camera, pitch, yaw); { const jm = app.input.move; if (jm.x || jm.y) { camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize(); rgt.set(-fwd.z, 0, fwd.x); move((fwd.x * jm.y + rgt.x * jm.x) * app.loco.speed * dt, (fwd.z * jm.y + rgt.z * jm.x) * app.loco.speed * dt); } }
      camera.position.set(0, 1.62, 0);
      const sp = (keys.has('shift') ? 2 : 1) * app.loco.speed * dt; fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); rgt.set(-fwd.z, 0, fwd.x);
      if (keys.has('w') || keys.has('arrowup')) move(fwd.x * sp, fwd.z * sp); if (keys.has('s') || keys.has('arrowdown')) move(-fwd.x * sp, -fwd.z * sp);
      if (keys.has('d') || keys.has('arrowright')) move(rgt.x * sp, rgt.z * sp); if (keys.has('a') || keys.has('arrowleft')) move(-rgt.x * sp, -rgt.z * sp);
    } else locomotionXR(dt, cam);
    rig.position.y += (ground(rig.position.x, rig.position.z) - rig.position.y) * Math.min(1, dt * 10);
    cam.getWorldPosition(camW);
    // viaje
    if (T.moving) {
      T.t += dt / DUR; const u = Math.min(1, T.t), R = (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2) * 150; W.r.value = R;   // lenta al principio, rápida en el medio, suave al final
      { const k = sst(0.1, 0.88, u); T.blend = T.dir > 0 ? k : 1 - k; } motes.material.size = 0.09 + 0.14 * Math.sin(Math.PI * u);
      if (u >= 1) {
        T.moving = false; T.era = T.target; T.blend = T.era === 'antes' ? 1 : 0; W.r.value = T.era === 'antes' ? 1e5 : -1; W.rev.value = 0;
        say(T.era === 'antes' ? 'Hace ~14.800 años. Acércate a las esferas luminosas.' : 'De vuelta en el presente.'); app.panelRedraw && app.panelRedraw();
        if (T.era === 'antes') { const i = T.pending > 0 ? T.pending : (stopObjs[1].visited ? -1 : 1); T.pending = -1; if (i > 0) mv.play(i); }
      }
    }
    if (T.charge > 0) {            // la palanca baja, la máquina vibra y el pomo se enciende; al terminar sale la ola
      T.charge += dt; const k = Math.min(1, T.charge / 0.9), sh = Math.min(1, T.charge / CHARGE); lever.rotation.x = 0.7 - 1.4 * eased(k);
      knobHalo.material.opacity = 0.95 * sh; knobHalo.scale.setScalar(0.3 + sh * 0.7 + Math.sin(t * 28) * 0.05); lever.position.x = LEVER.x + Math.sin(t * 70) * 0.006 * sh;
      if (T.charge >= CHARGE) { T.charge = 0; travel('antes'); }
    } else if (T.era === 'hoy' && !T.moving) { lever.rotation.x += (0.7 - lever.rotation.x) * Math.min(1, dt * 3); lever.position.x = LEVER.x; knobHalo.material.opacity *= 0.92; }
    // mezcla de cielo / niebla / lejanías
    const b = T.blend; col1.copy(COL.hoyBg).lerp(COL.pastBg, b); scene.background.copy(col1); scene.fog.color.copy(col1);
    scene.fog.near = COL.hoyFog[0] + (COL.pastFog[0] - COL.hoyFog[0]) * b; scene.fog.far = (COL.hoyFog[1] + (COL.pastFog[1] - COL.hoyFog[1]) * b) / (app.viajeNiebla || 1);
    mountH.material.opacity = 1 - b; mountP.material.opacity = b; mountH.visible = b < 0.99; mountP.visible = b > 0.01;
    farForest.visible = b > 0.02; farForest.scale.y = Math.max(0.001, sst(0.15, 0.95, b)); farGround.material.color.setHex(0x8c9a5a).lerp(col1.setHex(0x3f5f34), b);
    // lo que depende de dónde está la ola
    const campPast = pastAt(FIRE);
    fireG.visible = campPast; crystal.visible = campPast && !T.moving; leverLabel.visible = !T.moving && T.charge === 0 && !pastAt(CON); lever.visible = T.era === 'hoy' || T.moving;
    gP.visible = T.era === 'antes' || T.moving; gH.visible = T.era === 'hoy' || T.moving;   // solo se dibuja la época en que estás (ahorra mucho en el Quest)
    toysH.hoverSet.clear(); toysP.hoverSet.clear();
    aimed = -1; if (xrOn) app.controllers.forEach((c) => { const a = village.pickStop(rayFrom(c)); if (a >= 0) aimed = a; }); else if (!dragLook) { const a = village.pickStop(raycaster); if (a >= 0) aimed = a; }
    stopObjs.forEach((s) => { const vis = s.i === 0 ? !pastAt(CON) : pastAt(tmpA.set(s.base.x, 0, s.base.z)); s.g.visible = vis && !(s.i === 0 && T.moving); s.g.position.y = s.base.y + Math.sin(t * 1.1 + s.i) * 0.05; const d = camW.distanceTo(s.g.position); s.lab.material.opacity = THREE.MathUtils.clamp((6 - d) / 2.5, 0, 1); s.halo.scale.setScalar((0.45 + Math.sin(t * 2 + s.i) * 0.06) * (aimed === s.i ? 1.9 : 1)); s.lab.material.opacity = Math.max(s.lab.material.opacity, aimed === s.i ? 1 : 0); });
    for (const p of peopleList) {
      const on = pastAt(p.p0); p.pop += ((on ? 1 : 0) - p.pop) * Math.min(1, dt * 3); p.m.visible = p.pop > 0.03;
      if (!p.m.visible) continue;
      let x = p.p0.x, z = p.p0.z, flip = 1;
      if (p.walk) { const k = Math.sin(t * 0.045 + 1) * 0.5 + 0.5; x = -38 + k * 20; z = -(yc(x) + halfw(x) + 5); flip = Math.cos(t * 0.045 + 1) >= 0 ? 1 : -1; p.m.position.set(x, ground(x, z) + Math.abs(Math.sin(t * 1.6)) * 0.05, z); }
      p.m.rotation.set(0, Math.atan2(camW.x - p.m.position.x, camW.z - p.m.position.z), (p.work ? 0.05 * Math.sin(t * 3.4 + p.ph) : 0.012 * Math.sin(t * 0.9 + p.ph)) * (p.walk ? 0.3 : 1), 'YXZ');
      p.m.scale.set(p.pop * flip, p.pop * (1 + 0.012 * Math.sin(t * 1.7 + p.ph)), p.pop);
    }
    // gonfoterio 3D: camina despacio por la orilla norte (para en los extremos y se da la vuelta)
    { const gp = new THREE.Vector3(gonfoS.x, 0, gonfoS.z), on = pastAt(gp); gonfoS.pop += ((on ? 1 : 0) - gonfoS.pop) * Math.min(1, dt * 2.5); gonfo.group.visible = gonfoS.pop > 0.03;
      if (gonfo.group.visible) {
        const nx = gonfoX(t), vx = (nx - gonfoS.x) / Math.max(dt, 1e-3), spd = Math.min(1.1, Math.abs(vx)); gonfoS.x = nx; gonfoS.z = -(yc(nx) + halfw(nx) + 5.5);
        const want = vx >= 0 ? Math.PI / 2 : -Math.PI / 2; if (spd > 0.08) { let d = want - gonfoS.head; d = Math.atan2(Math.sin(d), Math.cos(d)); gonfoS.head += d * Math.min(1, dt * 1.6); }
        gonfoS.sp += (spd - gonfoS.sp) * Math.min(1, dt * 2); gonfo.update(t, dt, gonfoS.sp);
        gonfo.group.position.set(gonfoS.x, ground(gonfoS.x, gonfoS.z), gonfoS.z); gonfo.group.rotation.y = gonfoS.head; gonfo.group.scale.setScalar(gonfoS.pop);
      } else gonfoS.x = gonfoX(t); }
    // historia del humo: el humo se espesa y muestra la imagen del capítulo que se está contando
    { const live = humoLive() && T.era === 'antes' && !T.moving, ns = app.narr.state; HS.amt += ((live ? 1 : 0) - HS.amt) * Math.min(1, dt * 1.6);
      if (live) { const ch = HS.map[Math.min(ns.idx, HS.map.length - 1)] ?? 0; if (ch !== HS.shown) { HS.fade -= dt * 2.4; if (HS.fade <= 0) { HS.fade = 0; HS.shown = ch; vision.material.map = visTex[ch]; vision.material.needsUpdate = true; } } else HS.fade = Math.min(1, HS.fade + dt * 2.4); }
      vision.visible = fireG.visible && HS.amt > 0.02; vision.material.opacity = HS.amt * HS.fade * 0.96; const bob = 1 + Math.sin(t * 0.9) * 0.015; vision.scale.set(4.6 * bob, 2.875 * bob, 1); vision.position.y = 3.3 + Math.sin(t * 0.7) * 0.08;
      const dl = camW.distanceTo(FIRE); humoLabel.visible = fireG.visible && !live && !app.narr.state.playing; humoLabel.material.opacity = THREE.MathUtils.clamp((7 - dl) / 2.5, 0, 1); }
    // fuego
    if (fireG.visible) {
      fireE += (0.8 - fireE) * Math.min(1, dt * 0.18);
      for (const bt of toysP.all) { if (bt.kind !== 'palito' || bt.state !== 'free') continue; const p = bt.obj.position, dx = p.x - FIRE.x, dz2 = p.z - FIRE.z; if (dx * dx + dz2 * dz2 < 0.28 && p.y < FIRE.y + 0.75) { bt.state = 'dead'; bt.obj.visible = false; bt.respawn = 9; fireE = Math.min(2.2, fireE + 0.6); try { audio.sfx('pop', FIRE, 0.4); } catch { /* sin audio */ } } }
      const fl = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 21) * 0.06;
      flames.forEach((s, i) => { s.scale.set((0.5 - i * 0.08) * (0.6 + fireE * 0.5) * fl, (1.0 - i * 0.2) * (0.55 + fireE * 0.6) * fl, 1); s.material.rotation = Math.sin(t * (8 + i * 3) + i) * 0.08; });
      fireLight.intensity = (1.2 + fireE * 1.4) * (0.9 + Math.sin(t * 17) * 0.1);
      for (let i = 0; i < emberN; i++) { let y = ep[i * 3 + 1] + dt * (0.5 + eSeed[i]) * (0.6 + fireE * 0.5); if (y > 1.8 + fireE) y = 0.1; ep[i * 3 + 1] = y; ep[i * 3] += Math.sin(t * 2 + eSeed[i] * 9) * 0.0016; }
      eg.attributes.position.needsUpdate = true;
    }
    if (fireG.visible) for (const sm of smoke) { sm.t += dt; if (sm.t > sm.dur) { sm.t = 0; sm.sx = Math.random() - 0.5; } const u = sm.t / sm.dur; sm.sp.position.set(sm.sx * u * 1.6 + u * 1.2, 0.9 + u * 3.2, Math.sin(sm.t + sm.sx * 9) * 0.25 * u); sm.sp.scale.setScalar((0.35 + u * 1.7) * (1 + HS.amt * 0.6)); sm.sp.material.opacity = Math.sin(Math.PI * Math.min(1, u * 1.15)) * 0.2 * (0.5 + fireE * 0.5) * (1 + HS.amt * 1.8); }
    if (motes.visible) { const pa = moteGeo.attributes.position.array; for (let i = 0; i < moteN; i++) { pa[i * 3 + 1] += Math.sin(t * 0.6 + moteSeed[i]) * 0.0016; pa[i * 3] += Math.cos(t * 0.4 + moteSeed[i] * 2) * 0.0014; pa[i * 3 + 2] += Math.sin(t * 0.3 + moteSeed[i] * 3) * 0.0012; } moteGeo.attributes.position.needsUpdate = true; }
    crystal.rotation.y = t * 0.8; cWire.rotation.set(t * 0.5, -t * 0.7, 0); crystal.position.y = crystalPos.y + Math.sin(t * 1.3) * 0.06;
    waterTex.offset.y -= dt * 0.3; foamTex.offset.y -= dt * 0.9;
    // juguetes
    const ts = toysNow(); if (xrOn) app.controllers.forEach((c) => { if (!held.has(c)) { const it = pickToy(rayFrom(c)); if (it) ts.hoverSet.add(it.b); } }); else if (mouseHover && !mouseItem) ts.hoverSet.add(mouseHover.b);
    if (mouseItem) { raycaster.setFromCamera(mouseNdc, camera); mouseHand.position.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, mouseDist); mouseHand.quaternion.copy(camera.getWorldQuaternion(new THREE.Quaternion())); mouseHand.updateMatrixWorld(true); }
    toysH.update(dt, null); toysP.update(dt, null);
    gP.traverse(() => {}); // (sin efecto: el pasado se recorta por shader)
    // sonido por cercanía: el río se amortigua dentro de una carpa; los murmullos solo se oyen cerca del fuego
    if (audioOn) {
      const AV = (k) => (app.aud[k] ?? 1) * (app.aud.master ?? 1);
      rivEm.position.set(Math.max(-40, Math.min(40, camW.x)), bed(camW.x) + 0.8, -yc(Math.max(-40, Math.min(40, camW.x))));
      let inTent = false; if (T.era === 'antes') (layA.carpas || []).forEach((c) => { if (Math.hypot(camW.x - c[0], camW.z + c[1]) < c[3] - 0.35) inTent = true; });
      lpTarget = inTent ? 420 : 20000; if (lp) lp.frequency.value += (lpTarget - lp.frequency.value) * Math.min(1, dt * 6);
      const rv = AV('ambiente'), rr = AV('rio'); if (rivA) rivA.setVolume(0.8 * rr * (inTent ? 0.7 : 1)); if (rivB) rivB.setVolume(1.1 * rr * (inTent ? 0.7 : 1));
      const pa = campPast ? T.blend : 0; if (murm) murm.setVolume(0.32 * pa * rv * (inTent ? 0.35 : 1)); if (fuegoS) fuegoS.setVolume(Math.min(1, 0.2 + fireE * 0.12) * pa * rv); if (wind) wind.setVolume(0.08 * rv * (1 - 0.5 * T.blend));
      chirpT -= dt; if (chirpT <= 0 && T.blend > 0.9) { chirpT = 6 + Math.random() * 9; const a = Math.random() * 6.283, d = 7 + Math.random() * 9; try { audio.sfx(['chirp', 'trino', 'chucao'][(Math.random() * 3) | 0], new THREE.Vector3(camW.x + Math.cos(a) * d, 3 + Math.random() * 4, camW.z + Math.sin(a) * d), 0.3); } catch { /* sin audio */ } }
    }
    // la clase explica sola al acercarte a una esfera nueva
    autoT -= dt;
    if (autoT <= 0) { autoT = 0.4; if (!app.narr.state.playing && !T.moving) for (const s of stopObjs) { if (!s.visited && s.g.visible && camW.distanceTo(s.g.position) < 2.2) { mv.play(s.i); break; } } }
  }
  const applyActive = (on) => {
    active = on; audio.listener.setMasterVolume(on ? 1 : 0);
    if (on) { app.controllers.forEach((c) => rig.add(c)); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); camera.position.set(0, renderer.xr.isPresenting ? 0 : 1.62, 0); renderer.setClearColor(0x000000, 1); app.setInfo({ titulo: 'El viaje a Monte Verde', intro: 'Empiezas en el presente. Tira la palanca de la máquina del tiempo y viaja a un campamento de hace unos 14.800 años: camina por la orilla del río, siéntate junto al fuego, toca el fuego para oír la historia del humo, agarra la comida y escucha la clase.', hint: 'Palanca roja = viajar. Esferas luminosas = paradas (la clase te explica sola al acercarte). Fuego = historia del humo. Panel > Arqueólogo = réplicas de lo que se encontró. PC: arrastra para mirar, WASD camina, T = viajar, H = historia del humo, M = panel. Quest: joystick izq camina (apretarlo = correr), der gira, gatillo = tirar la palanca / agarrar.' }); }
  };
  window.__viaje = { THREE, scene, camera, rig, W, T, travel, pullLever, startHumo, finds, gonfo, gonfoS, HS, ground, mv, peopleList, toysP, toysH, look: (y, p) => { yaw = y; pitch = p; } };
  await tick();
  return {
    id: 'viaje', scene, camera, rig, update, hasAR: false, audio, startAudio, stops: VS, mv, village, hasToys: true, finds,
    controls: {
      horas: ['Presente', 'Hace 14.800 años'], hora: () => (T.era === 'antes' || (T.moving && T.dir > 0) ? 1 : 0), setHora: (i) => { if (i === 1) { if (T.era === 'hoy') pullLever(); } else travel('hoy'); },
      sinDensidad: true, niebla: () => app.viajeNiebla || 1, setNiebla: (v) => { app.viajeNiebla = v; },
    },
    enter: () => applyActive(true), exit: () => applyActive(false), onXRStart: () => { camera.position.set(0, 0, 0); if (!T.xrTurned) { rig.rotation.y = Math.PI; T.xrTurned = true; } }, onXRStop: () => { camera.position.set(0, 1.62, 0); rig.rotation.y = 0; T.xrTurned = false; },
    get pastError() { return pastLoadErr; }, pastP,
  };
}
