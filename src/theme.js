import * as THREE from 'three';

// Ambientes del hall. Más adelante cada uno se enlaza a un hito.
export const THEMES = [
  { id: 'casa',     name: 'Casa',        mode: 0, a: '#ffb35c', b: '#ffe2b0', particles: { speed: 0.12, sway: 1.0, size: 18 } },
  { id: 'lab',      name: 'Autopoiesis', mode: 0, a: '#35f0c0', b: '#8b7cff', particles: { speed: 0.25, sway: 1.0, size: 22 } },
  { id: 'desierto', name: 'Desierto',    mode: 1, a: '#ff8a2b', b: '#ffd98a', particles: { speed: 0.10, sway: 3.0, size: 14 } },
  { id: 'mar',      name: 'Mar',         mode: 2, a: '#1f8fff', b: '#6ff3ff', particles: { speed: 0.55, sway: 1.4, size: 26 } },
  { id: 'bosque',   name: 'Bosque',      mode: 3, a: '#3fd16b', b: '#d6ff70', particles: { speed: 0.18, sway: 2.2, size: 20 } },
];

// Uniforms compartidos por todas las superficies (planos reales, piso VR, sala de vista previa).
export const shared = {
  uTime: { value: 0 },
  uOldMode: { value: 0 }, uNewMode: { value: 0 },
  uOldA: { value: new THREE.Color(THEMES[0].a) }, uOldB: { value: new THREE.Color(THEMES[0].b) },
  uNewA: { value: new THREE.Color(THEMES[0].a) }, uNewB: { value: new THREE.Color(THEMES[0].b) },
  uOrigin: { value: new THREE.Vector3(0, 1.3, -1.5) },
  uWaveR: { value: 99 },
};

export const WAVE_SPEED = 2.4; // m/s
export const WAVE_MAX = 10;    // m

const VERT = /* glsl */`
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */`
uniform float uTime, uOldMode, uNewMode, uWaveR, uAlpha, uCircle;
uniform vec3 uOldA, uOldB, uNewA, uNewB, uOrigin;
varying vec3 vW; varying vec3 vN; varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p){ return vec2(hash(p), hash(p + vec2(17.3, 9.1))); }

// Voronoi: x = distancia al borde de la celda, y = id de la celda
vec2 vor(vec2 x){
  vec2 n = floor(x), f = fract(x);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(n + g);
      o = 0.5 + 0.5 * sin(uTime * 0.5 + 6.2831 * o);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = hash(n + g); }
      else if (d < d2) { d2 = d; }
    }
  }
  return vec2(sqrt(d2) - sqrt(d1), id);
}

vec4 pat(float mode, vec2 p, vec3 A, vec3 B){
  if (mode < 0.5) {            // LABORATORIO: membranas celulares
    vec2 v = vor(p * 2.6);
    float edge = 1.0 - smoothstep(0.0, 0.09, v.x);
    vec3 c = mix(A, B, v.y);
    return vec4(c * (0.55 + edge * 1.5), 0.10 + 0.55 * edge + 0.12 * v.y);
  } else if (mode < 1.5) {     // DESIERTO: dunas con grano
    float s = sin(p.x * 5.0 + sin(p.y * 2.3 + uTime * 0.15) * 2.2);
    float ridge = smoothstep(0.75, 1.0, abs(s));
    float grain = hash(floor(p * 90.0) + floor(uTime * 8.0)) * 0.18;
    return vec4(mix(A, B, ridge) + grain, 0.14 + 0.45 * ridge + 0.10 * grain);
  } else if (mode < 2.5) {     // MAR: cáusticas
    vec2 q = p * 3.0;
    float c = sin(q.x * 1.7 + uTime * 0.9) + sin(q.y * 2.1 - uTime * 1.1)
            + sin((q.x + q.y) * 1.3 + uTime * 0.6) + sin(length(q) * 2.0 - uTime);
    float line = pow(1.0 - abs(sin(c * 1.3)), 6.0);
    return vec4(mix(A, B, line), 0.16 + 0.60 * line);
  } else {                     // BOSQUE: mosaico de hojas + luciérnagas
    vec2 v = vor(p * 3.2);
    float vein = 1.0 - smoothstep(0.0, 0.06, v.x);
    vec3 col = mix(A * 0.55, A, v.y) + B * vein * 0.9;
    float fire = step(0.985, hash(floor(p * 14.0) + floor(uTime * 0.7))) * (0.5 + 0.5 * sin(uTime * 3.0 + v.y * 20.0));
    return vec4(col + B * fire, 0.22 + 0.30 * v.y + 0.40 * vein + 0.50 * fire);
  }
}

void main(){
  vec3 n = normalize(vN);
  vec2 p = abs(n.y) > 0.6 ? vW.xz : (abs(n.x) > abs(n.z) ? vW.zy : vW.xy);
  vec4 col = pat(uNewMode, p, uNewA, uNewB);
  if (uWaveR < 50.0) {
    vec4 cOld = pat(uOldMode, p, uOldA, uOldB);
    float d = length(vW - uOrigin);
    float k = smoothstep(-0.15, 0.15, uWaveR - d);   // 1 donde la ola ya pasó
    col = mix(cOld, col, k);
    float front = exp(-pow((uWaveR - d) * 5.0, 2.0));
    col.rgb += front * 0.9;
    col.a += front * 0.5;
  }
  if (uCircle > 0.5) {
    float r = length(vUv * 2.0 - 1.0);
    if (r > 1.0) discard;
    col.a *= smoothstep(1.0, 0.82, r);
  }
  gl_FragColor = vec4(col.rgb, clamp(col.a * uAlpha, 0.0, 1.0));
  #include <colorspace_fragment>
}`;

/** Material "tema": se transforma con la ola desde el portal elegido. */
export function makeSurfaceMaterial({ alpha = 0.55, circle = false, side = THREE.DoubleSide, fixedMode = null } = {}) {
  const uniforms = { ...shared, uAlpha: { value: alpha }, uCircle: { value: circle ? 1 : 0 } };
  if (fixedMode !== null) {
    // Vista previa de un ambiente fijo (discos de los portales): no depende de la ola global.
    const t = THEMES[fixedMode];
    uniforms.uNewMode = { value: t.mode };
    uniforms.uNewA = { value: new THREE.Color(t.a) };
    uniforms.uNewB = { value: new THREE.Color(t.b) };
    uniforms.uWaveR = { value: 99 };
  }
  return new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, side,
  });
}

/** Controla el cambio de ambiente y avanza la ola. */
export class ThemeState {
  constructor() {
    this.index = 0;
    this.waveR = 99;
    this.target = { speed: 0.25, sway: 1, size: 22 };
    this.colA = new THREE.Color(THEMES[0].a);
    this.colB = new THREE.Color(THEMES[0].b);
    this.onChange = () => {};
  }
  set(index, originWorld) {
    if (index === this.index && this.waveR >= WAVE_MAX) return false;
    const prev = THEMES[this.index];
    const next = THEMES[index];
    shared.uOldMode.value = prev.mode; shared.uOldA.value.set(prev.a); shared.uOldB.value.set(prev.b);
    shared.uNewMode.value = next.mode; shared.uNewA.value.set(next.a); shared.uNewB.value.set(next.b);
    if (originWorld) shared.uOrigin.value.copy(originWorld);
    this.waveR = 0; shared.uWaveR.value = 0;
    this.index = index;
    this.onChange(index, next);
    return true;
  }
  update(dt) {
    if (this.waveR < WAVE_MAX) {
      this.waveR += WAVE_SPEED * dt;
      if (this.waveR >= WAVE_MAX) {
        this.waveR = 99;
        const t = THEMES[this.index];
        shared.uOldMode.value = t.mode; shared.uOldA.value.set(t.a); shared.uOldB.value.set(t.b);
      }
      shared.uWaveR.value = this.waveR;
    }
    const t = THEMES[this.index];
    this.colA.lerp(new THREE.Color(t.a), Math.min(1, dt * 2.5));
    this.colB.lerp(new THREE.Color(t.b), Math.min(1, dt * 2.5));
  }
}
