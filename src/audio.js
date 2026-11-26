import * as THREE from 'three';

// Audio 100% procedural (sin archivos): un pad ambiental en el núcleo y un "chime" por portal.
const SR_DUR = 8; // segundos; todas las frecuencias son k/8 Hz para que el loop empalme sin clic

function makePadBuffer(ctx) {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.floor(sr * SR_DUR), sr);
  const d = buf.getChannelData(0);
  const freqs = [55, 110, 110.125, 165, 220, 330.25];
  const amps = [0.9, 0.7, 0.5, 0.45, 0.3, 0.14];
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    let s = 0;
    for (let k = 0; k < freqs.length; k++) s += amps[k] * Math.sin(2 * Math.PI * freqs[k] * t);
    const lfo = 0.65 + 0.35 * Math.sin(2 * Math.PI * t / SR_DUR);
    d[i] = (s / 3.2) * lfo * 0.5;
  }
  return buf;
}

function makeChimeBuffer(ctx, f) {
  const sr = ctx.sampleRate;
  const dur = 2.4;
  const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    const env = Math.exp(-t * 2.2) * Math.min(1, t * 80);
    d[i] = env * (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.01 * t) + 0.15 * Math.sin(2 * Math.PI * f * 3.0 * t)) * 0.35;
  }
  return buf;
}

// Efectos procedurales (golpes, vidrio/cerámica, rebote, pop, pío)
function makeSfx(ctx) {
  const sr = ctx.sampleRate;
  const mk = (dur, fn) => {
    const b = ctx.createBuffer(1, Math.floor(sr * dur), sr); const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = fn(i / sr, i);
    return b;
  };
  const S = (f, t) => Math.sin(2 * Math.PI * f * t);
  const noise = () => Math.random() * 2 - 1;
  return {
    crash: mk(1.0, (t) => (noise() * Math.exp(-t * 9) * 0.55 + (S(1830, t) + 0.8 * S(2760, t) + 0.6 * S(4130, t) + 0.5 * S(5320, t)) * Math.exp(-t * 16) * 0.14 + S(140, t) * Math.exp(-t * 25) * 0.4) * Math.min(1, t * 400)),
    clink: mk(0.3, (t) => (S(3180, t) * 0.22 + S(4710, t) * 0.14) * Math.exp(-t * 30) + S(170, t) * Math.exp(-t * 35) * 0.5 + noise() * Math.exp(-t * 80) * 0.2),
    bounce: mk(0.22, (t) => S(300 - 800 * t, t) * Math.exp(-t * 22) * 0.7),
    pop: mk(0.22, (t) => S(480 + 1800 * t, t) * Math.exp(-t * 14) * 0.45),
    buzz: mk(2.0, (t) => (S(220, t) + 0.6 * S(440, t) + 0.35 * S(660, t)) * (0.55 + 0.45 * S(55, t)) * 0.22),
    lluvia: mk(4.0, () => noise() * 0.5),
    viento: (() => { let a = 0; return mk(6.0, (t) => { a += (noise() - a) * 0.02; return a * (0.7 + 0.3 * S(1 / 6, t)) * 2.2; }); })(),
    viento2: (() => { let l = 0, l2 = 0; return mk(8.0, (t) => { l += (noise() - l) * 0.012; l2 += (l - l2) * 0.05; return l2 * (0.55 + 0.45 * Math.sin(2 * Math.PI * t / 8)) * 7; }); })(),
    fuego: (() => { let l = 0, pop = 0; return mk(4.0, (t) => { l += (noise() - l) * 0.04; if (Math.random() < 0.0009) pop = 1; pop *= 0.992; return l * 0.5 + noise() * pop * 0.5 * (Math.random() < 0.3 ? 1 : 0.2); }); })(),
    zumbido: mk(4.0, (t) => (S(196, t) * 0.5 + S(294, t) * 0.32 + S(392, t) * 0.2 + S(588, t) * 0.08) * (0.7 + 0.3 * S(2, t)) * 0.3),
    volver: mk(0.9, (t) => (S(660, t) * 0.5 + S(990, t) * 0.25) * Math.exp(-t * 5) * Math.min(1, t * 60) * 0.35),
    trino: mk(0.7, (t) => S(3300 + 600 * Math.sin(t * 9), t) * (0.5 + 0.5 * S(26, t)) * Math.exp(-Math.pow((t - 0.3) * 4.5, 2)) * 0.3),
    chucao: mk(1.1, (t) => { const n = (t0, f0, f1, d) => { const u = (t - t0) / d; if (u < 0 || u > 1) return 0; return S(f0 + (f1 - f0) * u, t) * Math.sin(Math.PI * u) * 0.35; }; return n(0.0, 2100, 1700, 0.26) + n(0.32, 1900, 1500, 0.24) + n(0.62, 2400, 1300, 0.4); }),
    rio: (() => { let l = 0, l2 = 0; return mk(4.0, (t) => { const n = noise(); l += (n - l) * 0.16; l2 += (l - l2) * 0.5; return (l2 * 1.6 + n * 0.12) * (0.75 + 0.25 * S(0.5, t)); }); })(),
    murmullo: (() => { let b1 = 0, b2 = 0, b3 = 0; return mk(6.0, (t) => { const n = noise(); b1 += (n - b1) * 0.09; b2 += (n - b2) * 0.22; b3 += (n - b3) * 0.38; const band = (b2 - b1) * 3.0 + (b3 - b2) * 1.6; const syl = Math.max(0, S(2.3, t) * 0.6 + S(3.7, t) * 0.5 + S(5.2, t) * 0.4) * (0.4 + 0.6 * Math.max(0, S(0.5, t))); return band * syl * 1.2; }); })(),
    hojas: (() => { let prev = 0; return mk(6.0, (t) => { const n = noise(); const y = (n - prev) * 0.5; prev = n; return y * (0.35 + 0.65 * Math.abs(S(1 / 6, t))) * 0.9; }); })(),
    grillos: mk(3.0, (t) => S(4300, t) * (S(18, t) > 0.15 ? 1 : 0) * (0.55 + 0.45 * S(1, t)) * 0.5),
    chirp: mk(0.3, (t) => S(3200 + 2200 * Math.sin(t * 28) , t) * Math.exp(-t * 9) * (0.5 + 0.5 * Math.sin(t * 90)) * 0.28 * Math.min(1, t * 200)),
  };
}

export class HallAudio {
  constructor(camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.started = false;
    this.pad = null;
    this.chimes = [];
    this.sfxRoot = new THREE.Group(); this.sfxRoot.name = 'Audio::SFX';
    this.pool = []; this.poolI = 0; this.bufs = null; this.prefs = null;
  }
  /** Reproduce un efecto en una posición de mundo (si el audio ya arrancó). */
  sfx(kind, worldPos, vol = 1) {
    if (!this.started || !this.bufs || !this.bufs[kind]) return;
    const cat = ['chirp', 'trino', 'chucao'].includes(kind) ? 'pajaros' : kind === 'volver' ? 'companion' : 'efectos';
    const P = this.prefs, k = P ? (P[cat] ?? 1) * (P.master ?? 1) : 1;
    if (k <= 0.001) return;
    const a = this.pool[this.poolI++ % this.pool.length];
    if (a.isPlaying) a.stop();
    a.parent.position.copy(worldPos);
    a.setBuffer(this.bufs[kind]); a.setVolume(vol * k); a.play();
  }
  /** Llamar dentro de un gesto del usuario (clic / entrar a XR). */
  async start(coreObject, portalObjects, opts = {}) {
    if (this.started) return;
    this.started = true;
    const ctx = THREE.AudioContext.getContext();
    try { await ctx.resume(); } catch { /* ignore */ }
    this.bufs = makeSfx(ctx);
    for (let i = 0; i < 10; i++) {
      const h = new THREE.Object3D(); this.sfxRoot.add(h);
      const a = new THREE.PositionalAudio(this.listener); a.setRefDistance(1.2); a.setRolloffFactor(1.1); h.add(a); this.pool.push(a);
    }
    if (opts.pad === false) return;
    this.pad = new THREE.PositionalAudio(this.listener);
    this.pad.setBuffer(makePadBuffer(ctx));
    this.pad.setLoop(true);
    this.pad.setRefDistance(0.8);
    this.pad.setRolloffFactor(0.8);
    this.pad.setVolume(0.55);
    coreObject.add(this.pad);
    this.pad.play();
    const notes = [261.63, 329.63, 392.0, 523.25];
    portalObjects.forEach((p, i) => {
      const a = new THREE.PositionalAudio(this.listener);
      a.setBuffer(makeChimeBuffer(ctx, notes[i % notes.length]));
      a.setRefDistance(0.6);
      a.setRolloffFactor(1.2);
      a.setVolume(0.8);
      p.add(a);
      this.chimes[i] = a;
    });
  }
  /** Ambiente no posicional en bucle ('lluvia' | 'viento'); devuelve el nodo para subir/bajar el volumen. */
  ambient(kind, vol = 0.3) {
    if (!this.bufs) return null;
    const a = new THREE.Audio(this.listener); a.setBuffer(this.bufs[kind]); a.setLoop(true); a.setVolume(vol); a.play(); return a;
  }
  /** Sonido en bucle pegado a un objeto (fuego, zumbido del colihuacho). */
  loopAt(obj, kind, vol = 0.3, ref = 1.5) {
    if (!this.bufs || !this.bufs[kind]) return null;
    const a = new THREE.PositionalAudio(this.listener); a.setBuffer(this.bufs[kind]); a.setLoop(true); a.setRefDistance(ref); a.setRolloffFactor(1.4); a.setVolume(vol); obj.add(a); a.play(); return a;
  }
  /** Zumbido posicional pegado a un objeto (picaflor). */
  buzzer(obj, vol = 0.5) {
    if (!this.bufs) return null;
    const a = new THREE.PositionalAudio(this.listener); a.setBuffer(this.bufs.buzz); a.setLoop(true); a.setRefDistance(0.5); a.setRolloffFactor(1.6); a.setVolume(vol); obj.add(a); a.play(); return a;
  }
  chime(i) {
    const a = this.chimes[i];
    if (!a || !this.started) return;
    if (a.isPlaying) a.stop();
    a.play();
  }
}
