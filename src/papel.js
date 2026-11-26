import * as THREE from 'three';

// Texturas de "papel recortado" dibujadas por código (canvas 2D): árboles, helechos, nalca, quila, copihue, mariposas.
// Todas con borde oscuro (el grosor del papel) y grano; se usan con alphaTest, así son baratas en el Quest.

export const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export function toTex(c, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
function grain(ctx, w, h, r, n = 3500) {
  ctx.save(); ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
  ctx.restore();
}
const EDGE = '#1d2a1c';
const GREENS = ['#5f9a4a', '#7bb35a', '#3f7f45', '#6aa356'];
const BARK = ['#8a6a45', '#7a5c3a'];

function stroke2(ctx, fn, color, width) {          // dibuja la misma forma: borde oscuro grueso y luego relleno
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = EDGE; ctx.lineWidth = width + 5; fn(); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = width; fn(); ctx.stroke();
}

export function treeCanvas(kind, seed) {
  const w = 512, h = 1024, c = mk(w, h), ctx = c.getContext('2d'), r = rng(seed);
  const leaves = [], segs = [];
  const bark = BARK[(r() * 2) | 0];
  const tw = kind === 'alerce' ? 46 : 38 + r() * 18;
  segs.push([w / 2 + (r() - 0.5) * 10, h, w / 2 + (r() - 0.5) * 24, h * (kind === 'conifer' ? 0.08 : 0.5), tw, tw * 0.55]);
  if (kind === 'alerce') {
    // conífero columnar: ramas colgantes en pisos
    const top = h * 0.06;
    for (let i = 0; i < 22; i++) {
      const y = top + (i / 22) * h * 0.78, side = i % 2 ? 1 : -1, len = 40 + (i / 22) * 150 * (0.7 + r() * 0.5);
      segs.push([w / 2, y, w / 2 + side * len, y + len * 0.45, 9, 5]);
      for (let k = 0; k < 7; k++) leaves.push([w / 2 + side * len * (0.3 + k * 0.1), y + len * 0.45 * (0.3 + k * 0.1) + 10, 18 + r() * 14, 10 + r() * 8, '#4a8a5a']);
    }
  } else if (kind === 'dead') {
    const br = (x, y, a, l, wd, d) => { const x2 = x + Math.sin(a) * l, y2 = y - Math.cos(a) * l; segs.push([x, y, x2, y2, wd, wd * 0.7]); if (d > 0) { br(x2, y2, a + 0.5 + r() * 0.4, l * 0.7, wd * 0.7, d - 1); br(x2, y2, a - 0.5 - r() * 0.4, l * 0.7, wd * 0.7, d - 1); } };
    br(w / 2, h * 0.5, 0.15, h * 0.2, 20, 4); br(w / 2, h * 0.62, -0.7, h * 0.16, 14, 3); br(w / 2, h * 0.6, 0.8, h * 0.15, 14, 3);
  } else {
    // latifoliado (coihue / ulmo): tronco + ramas + copas de papel
    const br = (x, y, a, l, wd, d) => {
      const x2 = x + Math.sin(a) * l, y2 = y - Math.cos(a) * l; segs.push([x, y, x2, y2, wd, wd * 0.65]);
      if (d > 0) { br(x2, y2, a + 0.35 + r() * 0.5, l * 0.72, wd * 0.66, d - 1); br(x2, y2, a - 0.35 - r() * 0.5, l * 0.72, wd * 0.66, d - 1); if (r() < 0.5) br(x2, y2, a + (r() - 0.5) * 0.4, l * 0.6, wd * 0.6, d - 1); }
      else for (let i = 0; i < 4; i++) leaves.push([x2 + (r() - 0.5) * 70, y2 + (r() - 0.5) * 50, 24 + r() * 26, 16 + r() * 18, GREENS[(r() * 4) | 0]]);
    };
    const tx = w / 2 + (r() - 0.5) * 24, ty = h * 0.5;
    br(tx, ty, (r() - 0.5) * 0.2, h * 0.17, tw * 0.55, 4); br(tx, ty + 30, -0.6 - r() * 0.3, h * 0.13, tw * 0.4, 3); br(tx, ty + 10, 0.6 + r() * 0.3, h * 0.13, tw * 0.4, 3);
  }
  for (const L of leaves) L[1] = Math.max(L[1], L[3] + 10);   // que las copas no se corten en el borde de la lámina
  for (const s of segs) { s[1] = Math.max(s[1], 12); s[3] = Math.max(s[3], 12); }
  for (const L of leaves) { ctx.fillStyle = EDGE; ctx.beginPath(); ctx.ellipse(L[0], L[1], L[2] + 3, L[3] + 3, r() * 3, 0, 6.3); ctx.fill(); }
  for (const s of segs) stroke2(ctx, () => { ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }, bark, s[4]);
  for (const L of leaves) { ctx.fillStyle = L[4]; ctx.beginPath(); ctx.ellipse(L[0], L[1], L[2], L[3], r() * 3, 0, 6.3); ctx.fill(); }
  // musgo en la base del tronco
  ctx.fillStyle = '#4f7f3a'; for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.ellipse(w / 2 + (r() - 0.5) * 70, h - 6 - r() * 120, 12 + r() * 14, 7 + r() * 8, 0, 0, 6.3); ctx.fill(); }
  grain(ctx, w, h, r);
  return c;
}

export function fernCanvas(seed) {
  const w = 512, h = 512, c = mk(w, h), ctx = c.getContext('2d'), r = rng(seed);
  const n = 6 + ((r() * 3) | 0);
  const fronds = [];
  for (let f = 0; f < n; f++) {
    const a = -1.25 + (f / (n - 1)) * 2.5 + (r() - 0.5) * 0.2, len = 200 + r() * 140;
    const x0 = w / 2, y0 = h - 8, cx = x0 + Math.sin(a) * len * 0.55, cy = y0 - len * 0.9, x1 = x0 + Math.sin(a) * len, y1 = y0 - len * 0.55;
    fronds.push({ x0, y0, cx, cy, x1, y1, col: GREENS[(r() * 4) | 0], len });
  }
  const leaflets = (F, pass) => {
    for (let i = 1; i < 22; i++) {
      const t = i / 22, x = (1 - t) * (1 - t) * F.x0 + 2 * (1 - t) * t * F.cx + t * t * F.x1, y = (1 - t) * (1 - t) * F.y0 + 2 * (1 - t) * t * F.cy + t * t * F.y1;
      const sz = 26 * (1 - t * 0.75), ang = Math.atan2(F.cy - F.y0, F.cx - F.x0);
      for (const side of [-1, 1]) {
        ctx.fillStyle = pass ? F.col : EDGE; ctx.beginPath();
        ctx.ellipse(x + side * sz * 0.55, y - sz * 0.15, sz + (pass ? 0 : 3), sz * 0.3 + (pass ? 0 : 3), side * 0.5 - 0.2, 0, 6.3); ctx.fill();
      }
    }
  };
  for (const F of fronds) { leaflets(F, 0); }
  for (const F of fronds) { stroke2(ctx, () => { ctx.beginPath(); ctx.moveTo(F.x0, F.y0); ctx.quadraticCurveTo(F.cx, F.cy, F.x1, F.y1); }, '#4a6a3a', 5); leaflets(F, 1); }
  grain(ctx, w, h, r, 2500);
  return c;
}

export function nalcaCanvas(seed) {
  const w = 512, h = 512, c = mk(w, h), ctx = c.getContext('2d'), r = rng(seed);
  const leaf = (cx, cy, R, col) => {
    const lobes = 11, pts = [];
    for (let i = 0; i < lobes * 2; i++) { const a = (i / (lobes * 2)) * 6.283, rr = R * (i % 2 ? 0.78 : 1.0 + r() * 0.08); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8]); }
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    ctx.fillStyle = EDGE; ctx.lineWidth = 8; ctx.strokeStyle = EDGE; ctx.stroke(); ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = 'rgba(20,50,20,0.55)'; ctx.lineWidth = 3;
    for (let i = 0; i < lobes; i++) { const a = (i / lobes) * 6.283; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.74); ctx.stroke(); }
  };
  stroke2(ctx, () => { ctx.beginPath(); ctx.moveTo(w * 0.35, h); ctx.lineTo(w * 0.38, h * 0.52); }, '#5c8a3e', 12);
  stroke2(ctx, () => { ctx.beginPath(); ctx.moveTo(w * 0.62, h); ctx.lineTo(w * 0.66, h * 0.62); }, '#5c8a3e', 12);
  leaf(w * 0.66, h * 0.45, 125, GREENS[1]); leaf(w * 0.38, h * 0.34, 150, GREENS[0]);
  grain(ctx, w, h, r, 2500);
  return c;
}

export function quilaCanvas(seed) {
  const w = 256, h = 1024, c = mk(w, h), ctx = c.getContext('2d'), r = rng(seed);
  for (let i = 0; i < 9; i++) {
    const x = 40 + (i / 8) * 176 + (r() - 0.5) * 20, top = 40 + r() * 280, lean = (r() - 0.5) * 60;
    stroke2(ctx, () => { ctx.beginPath(); ctx.moveTo(x, h); ctx.quadraticCurveTo(x + lean * 0.3, h * 0.55, x + lean, top); }, '#b9a24a', 8);
    for (let k = 0; k < 7; k++) { const t = 0.15 + k * 0.12, px = x + lean * t * t, py = h - (h - top) * t; ctx.strokeStyle = '#6e5c24'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px - 6, py); ctx.lineTo(px + 6, py); ctx.stroke();
      if (k > 1) { ctx.fillStyle = GREENS[(r() * 4) | 0]; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(px + s * 20, py - 8, 24, 7, s * -0.5, 0, 6.3); ctx.fill(); } } }
  }
  grain(ctx, w, h, r, 1800);
  return c;
}

export function vineCanvas(seed) {      // enredadera colgante con copihues
  const w = 256, h = 1024, c = mk(w, h), ctx = c.getContext('2d'), r = rng(seed);
  stroke2(ctx, () => { ctx.beginPath(); ctx.moveTo(w * 0.5, 0); ctx.bezierCurveTo(w * 0.2, h * 0.3, w * 0.8, h * 0.6, w * 0.5, h * 0.95); }, '#4a7a3a', 7);
  for (let i = 0; i < 13; i++) {
    const t = 0.06 + i * 0.07, y = h * t, x = w * 0.5 + Math.sin(t * 7) * w * 0.26;
    ctx.fillStyle = GREENS[(r() * 4) | 0]; ctx.beginPath(); ctx.ellipse(x + (i % 2 ? 24 : -24), y, 24, 10, (i % 2 ? 0.5 : -0.5), 0, 6.3); ctx.fill();
    if (i % 4 === 2) { // copihue: campana roja que se abre abajo, con labio blanco
      const bell = () => { ctx.beginPath(); ctx.moveTo(x - 8, y + 6); ctx.lineTo(x + 8, y + 6); ctx.bezierCurveTo(x + 12, y + 28, x + 26, y + 40, x + 27, y + 58); ctx.quadraticCurveTo(x, y + 68, x - 27, y + 58); ctx.bezierCurveTo(x - 26, y + 40, x - 12, y + 28, x - 8, y + 6); ctx.closePath(); };
      ctx.lineJoin = 'round'; ctx.strokeStyle = EDGE; ctx.lineWidth = 6; bell(); ctx.stroke();
      ctx.fillStyle = '#c4162f'; bell(); ctx.fill();
      ctx.strokeStyle = '#f4ede0'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - 25, y + 58); ctx.quadraticCurveTo(x, y + 67, x + 25, y + 58); ctx.stroke();
    }
  }
  grain(ctx, w, h, r, 1500);
  return c;
}

export function mothCanvas(hue, seed) {      // ala de mariposa (media figura; se espeja con scale.x)
  const w = 128, h = 128, c = mk(w, h), ctx = c.getContext('2d'), r = rng(seed);
  const col = `hsl(${hue},75%,58%)`, col2 = `hsl(${(hue + 40) % 360},80%,70%)`;
  const wing = () => { ctx.beginPath(); ctx.moveTo(4, 64); ctx.bezierCurveTo(30, 0, 120, 6, 116, 52); ctx.bezierCurveTo(112, 70, 70, 66, 4, 64); ctx.moveTo(4, 66); ctx.bezierCurveTo(60, 70, 110, 80, 90, 118); ctx.bezierCurveTo(60, 126, 20, 100, 4, 66); };
  ctx.fillStyle = EDGE; ctx.strokeStyle = EDGE; ctx.lineWidth = 6; wing(); ctx.stroke(); ctx.fill();
  ctx.fillStyle = col; wing(); ctx.fill();
  ctx.fillStyle = col2; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(40 + r() * 60, 20 + r() * 80, 5 + r() * 8, 0, 6.3); ctx.fill(); }
  return c;
}

export function leafCanvas() {
  const c = mk(64, 64), ctx = c.getContext('2d');
  ctx.fillStyle = EDGE; ctx.beginPath(); ctx.ellipse(32, 32, 28, 14, 0.6, 0, 6.3); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(32, 32, 24, 10, 0.6, 0, 6.3); ctx.fill();
  return c;
}

export function groundCanvas(seed = 3, lime = false) {
  const w = 1024, h = 1024, c = mk(w, h), ctx = c.getContext('2d'), r = rng(seed);
  ctx.fillStyle = lime === 'turba' ? '#6a6a3c' : lime ? '#86b043' : '#6f8f4e'; ctx.fillRect(0, 0, w, h);
  const blobs = lime === 'turba' ? [['#4f5a30', 26], ['#7a7040', 20], ['#3a3226', 14], ['#8a8a50', 12], ['#5c6a38', 24], ['#9a8a58', 8]] : lime ? [['#6fa032', 26], ['#9bc653', 22], ['#7a8a3a', 10], ['#5a8a2c', 24], ['#b3d46a', 14]] : [['#5c8442', 26], ['#7fa05a', 18], ['#8a7a4a', 10], ['#4e7a3c', 24], ['#9a8a58', 8]];
  for (let i = 0; i < 520; i++) { const b = blobs[(r() * blobs.length) | 0]; ctx.fillStyle = b[0]; ctx.globalAlpha = 0.35 + r() * 0.4; ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 20 + r() * 70, 14 + r() * 40, r() * 3, 0, 6.3); ctx.fill(); }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 9000; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)'; ctx.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2); }
  return c;
}

export function glowCanvas() {
  const c = mk(64, 64), ctx = c.getContext('2d'), g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return c;
}

// Árbol antiguo: tronco enorme y retorcido, raíces que se abren por el suelo, musgo lima y ramas con copas (como la referencia elegida)
export function ancientCanvas(seed) {
  const w = 640, h = 800, c = mk(w, h), ctx = c.getContext('2d'), r = rng(seed);
  const BK = ['#8b7a52', '#7c6c46', '#9a8a5e'], DK = '#5b4c30', LM = ['#86c43c', '#9bd04a', '#6fae32', '#b0dc62'];
  const cx = w / 2 + (r() - 0.5) * 30;
  const hw = (y) => { const t = y / h; return w * (0.15 + 0.07 * Math.sin(t * 9 + seed) * 0.4 + 0.1 * t * t + 0.16 * Math.pow(Math.max(0, t - 0.78) / 0.22, 2)); };
  const wob = (y, s) => Math.sin(y * 0.05 + s) * 7 + Math.sin(y * 0.021 + s * 2) * 12;
  // raíces
  const roots = [];
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1, x0 = cx + side * (20 + r() * 90), y0 = h * (0.74 + r() * 0.1), len = 160 + r() * 200, a = side * (0.5 + r() * 0.8), w0 = 54 + r() * 38;
    roots.push({ x0, y0, x1: x0 + side * Math.cos(a) * len, y1: Math.min(h - 6, y0 + 70 + Math.abs(Math.sin(a)) * len * 0.6), cx: x0 + side * len * 0.35, cy: y0 + 10 + r() * 40, w0 });
  }
  const bez = (R, t) => [(1 - t) * (1 - t) * R.x0 + 2 * (1 - t) * t * R.cx + t * t * R.x1, (1 - t) * (1 - t) * R.y0 + 2 * (1 - t) * t * R.cy + t * t * R.y1];
  const drawRoot = (R, pass) => { for (let i = 0; i < 28; i++) { const t = i / 28, [x, y] = bez(R, t), [x2, y2] = bez(R, (i + 1) / 28); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(5, R.w0 * (1 - t * 0.92)) + (pass ? 0 : 7); ctx.strokeStyle = pass ? BK[(i + R.w0) % 3 | 0] : '#26301a'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke(); } };
  roots.forEach((R) => drawRoot(R, 0));
  // tronco
  const trunk = () => { ctx.beginPath(); for (let y = 0; y <= h; y += 16) ctx.lineTo(cx - hw(y) + wob(y, 1), y); for (let y = h; y >= 0; y -= 16) ctx.lineTo(cx + hw(y) + wob(y, 4), y); ctx.closePath(); };
  ctx.lineJoin = 'round'; ctx.lineWidth = 8; ctx.strokeStyle = '#26301a'; trunk(); ctx.stroke(); ctx.fillStyle = BK[0]; trunk(); ctx.fill();
  roots.forEach((R) => drawRoot(R, 1));
  // ramas retorcidas con copa
  const leaves = [];
  for (let b = 0; b < 3; b++) {
    const side = b % 2 ? 1 : -1, y0 = h * (0.16 + b * 0.16), x0 = cx + side * hw(y0) * 0.9, len = 150 + r() * 130, ang = side * (0.9 + r() * 0.5);
    const R = { x0, y0, x1: x0 + side * Math.cos(ang - 0.4) * len, y1: y0 - 30 - r() * 90, cx: x0 + side * len * 0.55, cy: y0 + 20 + r() * 50, w0: 46 - b * 8 };
    drawRoot(R, 0); drawRoot(R, 1);
    for (let k = 0; k < 9; k++) leaves.push([R.x1 + (r() - 0.5) * 120, R.y1 + (r() - 0.5) * 80, 14 + r() * 20, 9 + r() * 12, LM[(r() * 4) | 0]]);
  }
  for (const L of leaves) { ctx.fillStyle = '#26301a'; ctx.beginPath(); ctx.ellipse(L[0], L[1], L[2] + 4, L[3] + 4, r() * 3, 0, 6.3); ctx.fill(); }
  for (const L of leaves) { ctx.fillStyle = L[4]; ctx.beginPath(); ctx.ellipse(L[0], L[1], L[2], L[3], r() * 3, 0, 6.3); ctx.fill(); }
  // copa que tapa el borde superior del tronco
  for (let k = 0; k < 90; k++) { const f = Math.pow(r(), 1.6); leaves.push([cx + (r() - 0.5) * w * 0.8, f * 150 + 4, 18 + r() * 30, 12 + r() * 18, LM[(r() * 4) | 0]]); }
  for (const L of leaves.slice(-90)) { ctx.fillStyle = '#26301a'; ctx.beginPath(); ctx.ellipse(L[0], L[1], L[2] + 4, L[3] + 4, r() * 3, 0, 6.3); ctx.fill(); }
  for (const L of leaves.slice(-90)) { ctx.fillStyle = L[4]; ctx.beginPath(); ctx.ellipse(L[0], L[1], L[2], L[3], r() * 3, 0, 6.3); ctx.fill(); }
  // arrugas de la corteza y luz
  ctx.save(); ctx.beginPath(); trunk(); ctx.clip();
  for (let i = 0; i < 60; i++) { const x = cx + (r() - 0.5) * hw(h * 0.6) * 2, y = r() * h; ctx.strokeStyle = r() < 0.6 ? 'rgba(40,30,15,0.5)' : 'rgba(210,190,130,0.35)'; ctx.lineWidth = 2 + r() * 4; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (r() - 0.5) * 30, y + 50, x + (r() - 0.5) * 20, y + 90 + r() * 100); ctx.stroke(); }
  ctx.restore();
  // musgo lima: montoncitos de manchas pequeñas sobre raíces, base y repisas del tronco
  const clump = (x, y, n, spread) => { for (let k = 0; k < n; k++) { const ox = (r() - 0.5) * spread, oy = (r() - 0.5) * spread * 0.5, sz = 5 + r() * 11; ctx.fillStyle = '#3f6b1a'; ctx.beginPath(); ctx.ellipse(x + ox, y + oy + 3, sz + 1, sz * 0.7 + 1, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = LM[(r() * 4) | 0]; ctx.beginPath(); ctx.ellipse(x + ox, y + oy, sz, sz * 0.7, 0, 0, 6.3); ctx.fill(); } };
  for (let i = 0; i < 46; i++) { const R = roots[(r() * roots.length) | 0], t = r() * 0.85, [x, y] = bez(R, t); clump(x, y - R.w0 * (1 - t) * 0.32, 5, 34); }
  for (let i = 0; i < 12; i++) { const y = h * (0.5 + r() * 0.45); clump(cx + (r() - 0.5) * hw(y) * 1.7, y, 4, 36); }
  grain(ctx, w, h, r, 4500);
  return c;
}
