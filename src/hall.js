import * as THREE from 'three';
import { THEMES, shared, makeSurfaceMaterial } from './theme.js';

const CORE_POS = new THREE.Vector3(0, 1.5, -2.0);

/** Hall: núcleo luminoso + 4 portales (uno por ambiente) + partículas + (VR) cielo y plataforma. */
export function buildHall(scene) {
  const root = new THREE.Group();
  root.name = 'Hall';
  scene.add(root);

  // ---------- Núcleo ----------
  const core = new THREE.Group();
  core.name = 'Hall::Nucleo';
  core.position.copy(CORE_POS);
  root.add(core);

  const coreMat = new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime, uCol: { value: new THREE.Color(THEMES[0].a) }, uCol2: { value: new THREE.Color(THEMES[0].b) } },
    vertexShader: /* glsl */`
      uniform float uTime; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 p = position;
        float n = sin(p.x*9.0+uTime*1.3)*sin(p.y*8.0-uTime*1.1)*sin(p.z*10.0+uTime*0.9);
        p += normal * n * 0.018;
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        vN = normalize(normalMatrix * normal); vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCol, uCol2; varying vec3 vN; varying vec3 vV;
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        vec3 c = mix(uCol, uCol2, f) * (0.45 + f * 1.8);
        gl_FragColor = vec4(c, 0.35 + 0.65 * f);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 4), coreMat);
  orb.name = 'Hall::Nucleo_orbe';
  core.add(orb);

  const ringMats = [];
  const rings = [0.26, 0.33, 0.41].map((r, i) => {
    const m = new THREE.MeshBasicMaterial({ color: THEMES[0].a, transparent: true, opacity: 0.7 - i * 0.12, depthWrite: false });
    ringMats.push(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0035, 8, 128), m);
    ring.name = `Hall::Nucleo_anillo${i + 1}`;
    ring.rotation.set(i * 1.1, i * 0.7, 0);
    core.add(ring);
    return ring;
  });

  // ---------- Portales ----------
  const portals = [];
  const portalGroup = new THREE.Group();
  portalGroup.name = 'Hall::Portales';
  root.add(portalGroup);
  THEMES.forEach((t, i) => {
    const g = new THREE.Group();
    g.name = `Hall::Portal_${t.name}`;
    const x = (i - 1.5) * 0.5;
    g.position.set(x, 1.3, -1.15 + x * x * 0.22);
    g.lookAt(0, 1.3, 0.2);
    const frameMat = new THREE.MeshBasicMaterial({ color: t.a, transparent: true, opacity: 0.95 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.011, 12, 72), frameMat);
    ring.name = 'marco';
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.19, 56), makeSurfaceMaterial({ alpha: 1.5, circle: true, fixedMode: i }));
    disc.name = 'disco';
    disc.userData.themeIndex = i;
    const label = makeLabel(t.name, t.a);
    label.position.set(0, -0.3, 0);
    g.add(ring, disc, label);
    g.userData = { themeIndex: i, base: g.position.clone(), disc, ring, frameMat, hover: 0 };
    portalGroup.add(g);
    portals.push(g);
  });

  // ---------- Partículas ----------
  const N = 1400;
  const pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 5;
    pos[i * 3 + 1] = Math.random() * 3.2;
    pos[i * 3 + 2] = -4 + Math.random() * 5.2;
    seed[i] = Math.random();
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const pMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime, uCol: { value: new THREE.Color(THEMES[0].b) },
      uSpeed: { value: 0.25 }, uSway: { value: 1 }, uSize: { value: 22 }, uPixel: { value: 900 },
    },
    vertexShader: /* glsl */`
      attribute float aSeed; uniform float uTime, uSpeed, uSway, uSize, uPixel; varying float vA;
      void main(){
        vec3 p = position;
        p.y = mod(p.y + uTime * uSpeed * (0.3 + aSeed * 0.9), 3.2);
        p.x += sin(uTime * 0.5 * uSway + aSeed * 40.0) * 0.15 * uSway;
        p.z += cos(uTime * 0.4 * uSway + aSeed * 31.0) * 0.15 * uSway;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * (0.4 + aSeed) * uPixel / 900.0 / max(0.3, -mv.z) * 0.9;
        gl_Position = projectionMatrix * mv;
        vA = smoothstep(0.0, 0.4, p.y) * smoothstep(3.2, 2.6, p.y) * (0.35 + 0.65 * aSeed);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCol; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(uCol, vA * smoothstep(0.5, 0.0, d));
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(pGeo, pMat);
  particles.frustumCulled = false;
  particles.name = 'Hall::Particulas';
  root.add(particles);

  // ---------- VR: cielo + plataforma ----------
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color('#04050a') }, uBot: { value: new THREE.Color('#0b1a1a') }, uTime: shared.uTime },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uBot; uniform float uTime; varying vec3 vD;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      void main(){
        float k = smoothstep(-0.2, 0.9, vD.y);
        vec3 c = mix(uBot, uTop, k);
        vec3 q = floor(vD * 140.0);
        float star = step(0.9965, h(q)) * (0.5 + 0.5 * sin(uTime * 2.0 + h(q + 3.0) * 30.0));
        c += star * vec3(0.8, 0.9, 1.0) * smoothstep(-0.1, 0.5, vD.y);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 20), skyMat);
  sky.name = 'Hall::Cielo_VR';
  sky.renderOrder = -10;
  sky.visible = false;
  root.add(sky);

  const platform = new THREE.Mesh(new THREE.CircleGeometry(3.2, 64).rotateX(-Math.PI / 2), makeSurfaceMaterial({ alpha: 0.85 }));
  platform.position.set(0, 0, -1.2);
  platform.name = 'Hall::Plataforma_VR';
  platform.visible = false;
  root.add(platform);

  // ---------- Vista previa en PC: sala sintética ----------
  const previewRoom = new THREE.Mesh(new THREE.BoxGeometry(5, 2.7, 6).translate(0, 1.35, -1.2), makeSurfaceMaterial({ alpha: 0.7, side: THREE.BackSide }));
  previewRoom.name = 'Hall::Sala_vista_previa';
  root.add(previewRoom);

  const meshPortalDiscs = portals.map((p) => p.userData.disc);

  function update(dt, t, themeState, camWorldPos) {
    orb.rotation.y += dt * 0.25;
    rings.forEach((r, i) => { r.rotation.x += dt * (0.2 + i * 0.12); r.rotation.y += dt * (0.15 - i * 0.07); });
    core.position.y = CORE_POS.y + Math.sin(t * 0.8) * 0.03;
    coreMat.uniforms.uCol.value.copy(themeState.colA);
    coreMat.uniforms.uCol2.value.copy(themeState.colB);
    ringMats.forEach((m) => m.color.copy(themeState.colA));
    const th = THEMES[themeState.index].particles;
    pMat.uniforms.uCol.value.copy(themeState.colB);
    pMat.uniforms.uSpeed.value += (th.speed - pMat.uniforms.uSpeed.value) * Math.min(1, dt * 2);
    pMat.uniforms.uSway.value += (th.sway - pMat.uniforms.uSway.value) * Math.min(1, dt * 2);
    pMat.uniforms.uSize.value += (th.size - pMat.uniforms.uSize.value) * Math.min(1, dt * 2);
    skyMat.uniforms.uTop.value.copy(themeState.colA).multiplyScalar(0.06);
    skyMat.uniforms.uBot.value.copy(themeState.colA).multiplyScalar(0.28);
    portals.forEach((g, i) => {
      const u = g.userData;
      u.hover += ((u.hoverTarget ? 1 : 0) - u.hover) * Math.min(1, dt * 10);
      g.position.y = u.base.y + Math.sin(t * 1.1 + i * 1.7) * 0.025;
      const s = 1 + u.hover * 0.12 + (themeState.index === i ? 0.05 : 0);
      g.scale.setScalar(s);
      u.frameMat.opacity = 0.65 + 0.35 * Math.max(u.hover, themeState.index === i ? 1 : 0);
    });
  }

  return {
    root, core, portals, discs: meshPortalDiscs, sky, platform, previewRoom, update,
    corePos: CORE_POS, planeMaterial: platform.material,
  };
}

function makeLabel(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = '600 34px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = color; x.shadowBlur = 12; x.fillStyle = '#ffffff';
  x.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.075), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  m.name = 'etiqueta';
  return m;
}
