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

export class HallAudio {
  constructor(camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.started = false;
    this.pad = null;
    this.chimes = [];
  }
  /** Llamar dentro de un gesto del usuario (clic / entrar a XR). */
  async start(coreObject, portalObjects) {
    if (this.started) return;
    this.started = true;
    const ctx = THREE.AudioContext.getContext();
    try { await ctx.resume(); } catch { /* ignore */ }
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
  chime(i) {
    const a = this.chimes[i];
    if (!a || !this.started) return;
    if (a.isPlaying) a.stop();
    a.play();
  }
}
