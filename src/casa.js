import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { THEMES, shared, WAVE_MAX } from './theme.js';

const BASE = `${import.meta.env.BASE_URL}models/`;
export const ROOM_SHIFT_Z = 0.55;           // acerca la sala al jugador (el escritorio queda al alcance)
const SLOT_FRONT = 0.2;                     // distancia previa a la ranura
const SLOT_DEPTH = -0.07;                   // cuánto entra el disco

const NIDS = ['casa', 'autopoiesis', 'desierto', 'mar', 'bosque'];
const PANOS = { casa: 'pano_casa.jpg', autopoiesis: 'pano_autopoiesis.jpg', desierto: 'pano_desierto.jpg', mar: 'pano_mar.jpg', bosque: 'pano_bosque.jpg' };
// Gradación de color de la sala por ambiente (multiplica la luz horneada)
const GRADE = [
  [1.0, 1.0, 1.0],      // casa
  [0.55, 1.0, 0.95],    // autopoiesis (laboratorio)
  [1.2, 0.85, 0.55],    // desierto
  [0.55, 0.82, 1.2],    // mar
  [0.7, 1.08, 0.68],    // bosque
];
const tint = {
  old: { value: new THREE.Vector3(1, 1, 1) },
  new: { value: new THREE.Vector3(1, 1, 1) },
  accent: { value: new THREE.Color(THEMES[0].a) },
};

const ease = (t) => t * t * (3 - 2 * t);

function waveify(mat) {
  mat.customProgramCacheKey = () => 'casawave';
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uOrigin: shared.uOrigin, uWaveR: shared.uWaveR, uTintOld: tint.old, uTintNew: tint.new, uAccent: tint.accent });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp; uniform vec3 uOrigin, uTintOld, uTintNew, uAccent; uniform float uWaveR;')
      .replace('#include <opaque_fragment>', /* glsl */`
        float dW = length(vWp - uOrigin);
        float kW = uWaveR < 50.0 ? smoothstep(-0.15, 0.15, uWaveR - dW) : 1.0;
        outgoingLight *= mix(uTintOld, uTintNew, kW);
        if (uWaveR < 50.0) outgoingLight += uAccent * exp(-pow((uWaveR - dW) * 4.0, 2.0)) * 1.5;
        #include <opaque_fragment>`);
  };
}

function loadGLB(url) {
  return new Promise((res, rej) => new GLTFLoader().load(url, res, undefined, rej));
}
function loadTex(url) {
  return new Promise((res, rej) => new THREE.TextureLoader().load(url, res, undefined, rej));
}

/** Casa de Blender: sala horneada + estación (consola y discos) + paisaje 360 que se transforma. */
export async function buildCasa(scene, progress = () => {}) {
  const root = new THREE.Group(); root.name = 'Casa'; scene.add(root);
  const layout = await (await fetch(`${BASE}layout.json`)).json();
  const toGl = ([x, y, z]) => new THREE.Vector3(x, z, -y);

  progress('Cargando sala…');
  const salaGltf = await loadGLB(`${BASE}sala.glb`);
  const sala = salaGltf.scene; sala.name = 'Casa::Sala';
  sala.position.z = ROOM_SHIFT_Z;
  root.add(sala);

  progress('Cargando consola…');
  const consGltf = await loadGLB(`${BASE}consola.glb`);
  const discGltf = await loadGLB(`${BASE}discos.glb`);
  const estacion = new THREE.Group(); estacion.name = 'Casa::Estacion';
  estacion.position.z = ROOM_SHIFT_Z;
  root.add(estacion);
  estacion.add(consGltf.scene);

  // Luz horneada: material sin luz + onda de transformación
  [sala, consGltf.scene].forEach((g) => g.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.material;
    const m = new THREE.MeshBasicMaterial({ map: src.map, toneMapped: false });
    if (m.map) { m.map.anisotropy = 4; }
    waveify(m);
    o.material = m; o.matrixAutoUpdate = false; o.updateMatrix();
  }));

  // Discos (dinámicos, con luz de escena)
  const lights = new THREE.Group(); lights.name = 'Casa::Luces_discos'; estacion.add(lights);
  lights.add(new THREE.HemisphereLight(0xffeedd, 0x203040, 1.6));
  const key = new THREE.DirectionalLight(0xfff0dd, 1.6); key.position.set(-1, 3, 2); lights.add(key);
  const slotPos = toGl(layout.ranura);
  const slotLight = new THREE.PointLight(0x35f0c0, 0.0, 1.2, 2); slotLight.position.copy(slotPos).add(new THREE.Vector3(0, 0.1, 0.15)); lights.add(slotLight);

  const discs = [];
  ['Autopoiesis', 'Desierto', 'Mar', 'Bosque'].forEach((name, i) => {
    const node = discGltf.scene.children.find((c) => c.name.startsWith(`Disco_${name}`));
    const holder = new THREE.Group(); holder.name = `Disco::${name}`;
    holder.position.copy(node.position); holder.quaternion.copy(node.quaternion); holder.scale.copy(node.scale);
    node.position.set(0, 0, 0); node.quaternion.identity(); node.scale.set(1, 1, 1);
    holder.add(node);
    node.traverse((o) => {
      if (o.isMesh) {
        o.material = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => m.clone());
        if (o.material.length === 1) o.material = o.material[0];
        o.userData.discIndex = i;
        o.geometry.computeBoundingSphere();
      }
    });
    estacion.add(holder);
    const d = {
      i, name, themeIndex: i + 1, holder,
      homePos: holder.position.clone(), homeQuat: holder.quaternion.clone(), homeScale: holder.scale.clone(),
      state: 'rack', anim: null, hover: 0, hoverTarget: false, meshes: [],
    };
    node.traverse((o) => { if (o.isMesh) d.meshes.push(o); });
    discs.push(d);
  });

  // Brillo de la ranura (cinta aditiva)
  const glowMat = new THREE.MeshBasicMaterial({ color: THEMES[0].a, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const slotGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.07), glowMat);
  slotGlow.position.copy(slotPos).add(new THREE.Vector3(0, 0, 0.02)); slotGlow.name = 'Casa::Ranura_brillo';
  estacion.add(slotGlow);
  const slotAnchor = new THREE.Object3D(); slotAnchor.position.copy(slotPos); slotAnchor.name = 'Casa::Ranura'; estacion.add(slotAnchor);

  // ---------- Paisaje 360 ----------
  progress('Cargando paisajes…');
  const panos = {};
  await Promise.all(NIDS.map(async (id) => {
    try {
      const t = await loadTex(BASE + PANOS[id]);
      t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
      t.wrapS = THREE.RepeatWrapping; panos[id] = t;
    } catch { panos[id] = null; }
  }));
  const fallback = panos.casa || [...Object.values(panos)].find(Boolean);
  const texOf = (idx) => panos[NIDS[idx]] || fallback;
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { tA: { value: texOf(0) }, tB: { value: texOf(0) }, uP: { value: 1 }, uDir: { value: new THREE.Vector3(0, -0.2, -1) }, uCol: { value: new THREE.Color(THEMES[0].a) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: /* glsl */`
      uniform sampler2D tA, tB; uniform float uP; uniform vec3 uDir, uCol; varying vec3 vD;
      vec2 eq(vec3 d){ return vec2(0.5 + atan(d.x, -d.z) / 6.2831853, 0.5 + asin(clamp(d.y, -1.0, 1.0)) / 3.1415927); }
      void main(){
        vec3 d = normalize(vD);
        vec2 uv = eq(d);
        vec3 a = texture2D(tA, uv).rgb, b = texture2D(tB, uv).rgb;
        float ang = acos(clamp(dot(d, uDir), -1.0, 1.0)) / 3.1415927;
        float front = uP * 1.1;
        float k = 1.0 - smoothstep(front - 0.025, front, ang);
        vec3 c = mix(a, b, k);
        if (uP < 0.999) c += uCol * exp(-pow((ang - front) * 32.0, 2.0)) * 1.6;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 28), skyMat);
  sky.frustumCulled = false; sky.renderOrder = -20; sky.name = 'Casa::Paisaje_360';
  root.add(sky);

  // ---------- Polvo de luz ----------
  const N = 700;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 6.4; pos[i * 3 + 1] = Math.random() * 3.0; pos[i * 3 + 2] = -3.2 + Math.random() * 5.6;
    seed[i] = Math.random();
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const pMat = new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime, uCol: { value: new THREE.Color(THEMES[0].b) }, uSpeed: { value: 0.12 }, uSize: { value: 18 } },
    vertexShader: /* glsl */`
      attribute float aSeed; uniform float uTime, uSpeed, uSize; varying float vA;
      void main(){
        vec3 p = position;
        p.y = mod(p.y + uTime * uSpeed * (0.3 + aSeed), 3.0);
        p.x += sin(uTime * 0.4 + aSeed * 40.0) * 0.12; p.z += cos(uTime * 0.35 + aSeed * 31.0) * 0.12;
        vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * (0.4 + aSeed) / max(0.4, -mv.z);
        gl_Position = projectionMatrix * mv;
        vA = smoothstep(0.0, 0.4, p.y) * smoothstep(3.0, 2.4, p.y) * (0.3 + 0.7 * aSeed);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCol; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        gl_FragColor = vec4(uCol, vA * smoothstep(0.5, 0.0, d) * 0.8);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(pGeo, pMat); particles.frustumCulled = false; particles.position.z = ROOM_SHIFT_Z; particles.name = 'Casa::Polvo';
  root.add(particles);

  // ---------- API ----------
  const tmpV = new THREE.Vector3();
  const slotWorld = () => slotAnchor.getWorldPosition(new THREE.Vector3());
  const flatQuat = (d) => d.homeQuat.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));

  const api = {
    root, sala, estacion, discs, slotAnchor, sky, particles, layout,
    inserted: -1,
    onInserted: () => {},
    slotWorld,
    discMeshes: () => discs.flatMap((d) => (d.state === 'rack' || d.state === 'flyHome' ? d.meshes : [])),
    discOf: (mesh) => discs[mesh.userData.discIndex],

    /** Mantiene el disco en la mano / rayo */
    grab(d, controller) {
      d.state = 'held'; d.anim = null;
      controller.attach(d.holder);
      d.heldAt = performance.now();
    },
    /** Soltó el disco: si está cerca de la ranura (o fue un toque corto) se inserta; si no, vuelve al rack */
    release(d) {
      const quick = performance.now() - (d.heldAt || 0) < 380;
      const near = d.holder.getWorldPosition(tmpV).distanceTo(slotWorld()) < 0.55;
      estacion.attach(d.holder);
      if (quick || near) api.insert(d); else api.sendHome(d);
    },
    sendHome(d) {
      estacion.attach(d.holder);
      d.state = 'flyHome';
      d.anim = { t: 0, dur: 0.7, from: d.holder.position.clone(), fromQ: d.holder.quaternion.clone(), to: d.homePos, toQ: d.homeQuat, onEnd: () => { d.state = 'rack'; } };
      d.holder.visible = true;
      if (api.inserted === d.i) api.inserted = -1;
    },
    insert(d) {
      if (d.state === 'inserting' || d.state === 'inserted') return;
      // si hay otro disco dentro, sale
      const prev = discs.find((x) => x.state === 'inserted');
      if (prev) api.sendHome(prev);
      estacion.attach(d.holder);
      const flat = flatQuat(d);
      const pre = slotPos.clone().add(new THREE.Vector3(0, 0, SLOT_FRONT));
      const end = slotPos.clone().add(new THREE.Vector3(0, 0, SLOT_DEPTH));
      d.state = 'inserting';
      d.anim = {
        t: 0, dur: 0.55, from: d.holder.position.clone(), fromQ: d.holder.quaternion.clone(), to: pre, toQ: flat,
        onEnd: () => {
          d.anim = {
            t: 0, dur: 0.4, from: pre, fromQ: flat, to: end, toQ: flat,
            onEnd: () => { d.state = 'inserted'; d.holder.visible = false; api.inserted = d.i; api.onInserted(d); },
          };
        },
      };
    },
    /** Sacar el disco y volver a la casa original */
    eject() { const d = discs.find((x) => x.state === 'inserted' || x.state === 'inserting'); if (d) api.sendHome(d); },

    setMode(m) {
      sala.visible = m !== 'ar'; sky.visible = m !== 'ar'; particles.visible = m !== 'ar';
      if (m !== 'ar') { estacion.scale.setScalar(1); estacion.rotation.set(0, 0, 0); estacion.position.set(0, 0, ROOM_SHIFT_Z); }
    },
    /** Pone la estación sobre una mesa real (modo AR) en miniatura */
    placeOnTable(point, yaw, scale = 0.32) {
      estacion.scale.setScalar(scale);
      estacion.rotation.set(0, yaw, 0);
      // el origen de la estación está en el jugador; la consola queda ~1.5 m delante: centrarla sobre el punto
      const centre = new THREE.Vector3(0, 0, -1.45).multiplyScalar(scale).applyEuler(estacion.rotation);
      estacion.position.set(point.x - centre.x, point.y - 0.76 * scale, point.z - centre.z);
    },

    update(dt, t, themeState, camPos, hoverIndices) {
      // ola y gradación
      const th = THEMES[themeState.index];
      tint.accent.value.copy(themeState.colA);
      if (themeState.waveR >= 50) tint.old.value.copy(tint.new.value);
      skyMat.uniforms.uP.value = themeState.waveR >= 50 ? 1 : Math.min(1, themeState.waveR / WAVE_MAX);
      skyMat.uniforms.uCol.value.copy(themeState.colA);
      if (themeState.waveR >= 50) skyMat.uniforms.tA.value = skyMat.uniforms.tB.value;
      sky.position.copy(camPos);
      skyMat.uniforms.uDir.value.copy(slotWorld().sub(camPos).normalize());
      pMat.uniforms.uCol.value.copy(themeState.colB);

      // discos
      let heldNear = false;
      discs.forEach((d) => {
        d.hover += ((hoverIndices.has(d.i) ? 1 : 0) - d.hover) * Math.min(1, dt * 10);
        if (d.anim) {
          d.anim.t += dt / d.anim.dur;
          const k = ease(Math.min(1, d.anim.t));
          d.holder.position.lerpVectors(d.anim.from, d.anim.to, k);
          if (d.state === 'flyHome' || d.state === 'inserting') d.holder.position.y += Math.sin(k * Math.PI) * 0.06;
          d.holder.quaternion.slerpQuaternions(d.anim.fromQ, d.anim.toQ, k);
          if (d.anim.t >= 1) { const e = d.anim.onEnd; d.anim = null; e && e(); }
        }
        if (d.state === 'held' && d.holder.getWorldPosition(tmpV).distanceTo(slotWorld()) < 0.55) heldNear = true;
        const em = d.hover * 0.55 + (d.state === 'held' ? 0.5 : 0);
        d.meshes.forEach((mm) => (Array.isArray(mm.material) ? mm.material : [mm.material]).forEach((mat) => {
          if (mat.emissive) { mat.emissive.set(THEMES[d.themeIndex].a); mat.emissiveIntensity = em; }
        }));
      });
      const pulse = 0.35 + 0.2 * Math.sin(t * 3);
      const busy = discs.some((d) => d.state === 'inserting');
      glowMat.opacity += ((heldNear ? 0.9 : busy ? 1.0 : pulse * 0.25) - glowMat.opacity) * Math.min(1, dt * 8);
      glowMat.color.copy(themeState.colA);
      slotLight.intensity += ((heldNear || busy ? 2.0 : 0.15) - slotLight.intensity) * Math.min(1, dt * 8);
      slotLight.color.copy(themeState.colA);
    },

    /** Prepara el cambio de ambiente (llamar justo antes de themeState.set) */
    beginTheme(index, previousIndex) {
      tint.old.value.copy(tint.new.value);
      tint.new.value.set(...GRADE[index]);
      skyMat.uniforms.tA.value = texOf(previousIndex);
      skyMat.uniforms.tB.value = texOf(index);
    },
  };
  return api;
}
