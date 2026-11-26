import { rng, toTex } from './papel.js';

// Texturas de papel recortado para la escena Monte Verde: gente, animal grande, pieles, agua y fuego.
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const EDGE = '#1d2a1c';
const HIDE = ['#8a5a34', '#9b6a3e', '#7a4e2c', '#a87a4a'];
function grain(ctx, w, h, r, n = 3000) {
  ctx.save(); ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < n; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)'; ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  ctx.restore();
}

export function personCanvas(seed, o = {}) {
  const w = 256, h = 512, c = mk(w, h), ctx = c.getContext('2d'), r = rng(seed);
  const skin = o.skin || ['#c58f66', '#b87c54', '#d09a72'][seed % 3];
  const hide = o.hide || HIDE[seed % 4];
  const poly = (pts, fill, lw = 6) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = EDGE; ctx.stroke(); ctx.fillStyle = fill; ctx.fill(); };
  poly([[98, 330], [124, 330], [120, 500], [92, 500]], skin); poly([[134, 330], [160, 330], [166, 500], [138, 500]], skin);
  ctx.fillStyle = '#6a4a2a'; for (const x of [95, 142]) for (let k = 0; k < 4; k++) ctx.fillRect(x, 400 + k * 22, 26, 8);
  const top = 170;
  poly([[92, top], [164, top], [196, 330], [162, 346], [128, 332], [94, 346], [60, 330]], hide);
  ctx.strokeStyle = 'rgba(30,18,8,0.55)'; ctx.lineWidth = 3; ctx.setLineDash([8, 7]); ctx.beginPath(); ctx.moveTo(128, top + 8); ctx.lineTo(128, 330); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(80 + r() * 100, top + 40 + r() * 120, 12 + r() * 14, 8 + r() * 8, r() * 3, 0, 6.3); ctx.fill(); }
  ctx.fillStyle = EDGE; ctx.beginPath(); ctx.ellipse(128, top - 2, 44, 20, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#c9b48a'; ctx.beginPath(); ctx.ellipse(128, top - 2, 40, 16, 0, 0, 6.3); ctx.fill();
  const hy = top - 52;
  ctx.fillStyle = EDGE; ctx.beginPath(); ctx.arc(128, hy, 43, 0, 6.3); ctx.fill(); ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(128, hy, 38, 0, 6.3); ctx.fill();
  ctx.fillStyle = '#1b1612'; ctx.beginPath(); ctx.arc(128, hy - 6, 40, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(128, hy - 6); ctx.fill(); ctx.fillRect(86, hy - 8, 10, 52); ctx.fillRect(160, hy - 8, 10, 52);
  ctx.beginPath(); ctx.arc(114, hy + 4, 3.2, 0, 6.3); ctx.arc(142, hy + 4, 3.2, 0, 6.3); ctx.fill();
  if (o.basket) {
    poly([[176, 240], [236, 232], [226, 330], [182, 332]], '#b08a50'); ctx.strokeStyle = 'rgba(60,40,15,0.6)'; ctx.lineWidth = 3;
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(180, 250 + k * 14); ctx.lineTo(232, 244 + k * 14); ctx.stroke(); }
    ctx.fillStyle = '#2f6a3a'; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.ellipse(190 + k * 8, 236 - (k % 2) * 8, 10, 22, 0.3 * (k - 3), 0, 6.3); ctx.fill(); }
  }
  grain(ctx, w, h, r, 2500);
  return c;
}
export function armCanvas(seed, tool = 0) {   // brazo con manga de piel; pivote en el hombro (arriba)
  const w = 96, h = 256, c = mk(w, h), ctx = c.getContext('2d'), r = rng(seed);
  ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = EDGE;
  ctx.beginPath(); ctx.moveTo(30, 6); ctx.lineTo(66, 6); ctx.lineTo(60, 150); ctx.lineTo(36, 150); ctx.closePath(); ctx.stroke(); ctx.fillStyle = HIDE[seed % 4]; ctx.fill();
  ctx.beginPath(); ctx.moveTo(36, 150); ctx.lineTo(60, 150); ctx.lineTo(57, 214); ctx.lineTo(39, 214); ctx.closePath(); ctx.stroke(); ctx.fillStyle = ['#c58f66', '#b87c54', '#d09a72'][seed % 3]; ctx.fill();
  ctx.beginPath(); ctx.arc(48, 224, 14, 0, 6.3); ctx.stroke(); ctx.fill();
  if (tool === 1) { ctx.fillStyle = EDGE; ctx.fillRect(40, 226, 16, 22); ctx.fillStyle = '#8a8f98'; ctx.beginPath(); ctx.moveTo(30, 254); ctx.lineTo(66, 254); ctx.lineTo(48, 236); ctx.fill(); }
  grain(ctx, w, h, r, 500);
  return c;
}
export function gompCanvas(seed = 5) {   // animal grande tipo gonfoterio (silueta de papel, mira a la derecha)
  const w = 1024, h = 640, c = mk(w, h), ctx = c.getContext('2d'), r = rng(seed);
  const fur = '#6b5646', fur2 = '#5a4638', ivory = '#e8dcc0';
  const shape = (fn, fill, lw = 8) => { ctx.beginPath(); fn(); ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = EDGE; ctx.stroke(); ctx.fillStyle = fill; ctx.fill(); };
  [250, 330].forEach((x) => shape(() => { ctx.moveTo(x, 360); ctx.lineTo(x + 62, 360); ctx.lineTo(x + 58, 590); ctx.quadraticCurveTo(x + 30, 612, x - 6, 590); ctx.closePath(); }, fur2));
  [560, 650].forEach((x) => shape(() => { ctx.moveTo(x, 360); ctx.lineTo(x + 66, 360); ctx.lineTo(x + 62, 590); ctx.quadraticCurveTo(x + 32, 612, x - 6, 590); ctx.closePath(); }, fur));
  shape(() => { ctx.moveTo(180, 400); ctx.bezierCurveTo(150, 250, 330, 130, 520, 150); ctx.bezierCurveTo(690, 160, 790, 250, 800, 400); ctx.bezierCurveTo(720, 450, 300, 450, 180, 400); }, fur);
  shape(() => { ctx.moveTo(760, 250); ctx.bezierCurveTo(800, 120, 940, 120, 960, 240); ctx.bezierCurveTo(985, 330, 930, 400, 840, 392); ctx.bezierCurveTo(780, 380, 750, 320, 760, 250); }, fur);
  shape(() => { ctx.moveTo(900, 330); ctx.bezierCurveTo(990, 380, 1000, 470, 960, 560); ctx.lineTo(924, 556); ctx.bezierCurveTo(950, 480, 940, 440, 870, 410); ctx.closePath(); }, fur2);
  shape(() => { ctx.moveTo(880, 350); ctx.bezierCurveTo(960, 440, 1010, 430, 1018, 360); ctx.lineTo(1002, 356); ctx.bezierCurveTo(985, 400, 950, 410, 905, 340); ctx.closePath(); }, ivory, 6);
  shape(() => { ctx.ellipse(800, 270, 34, 52, 0.3, 0, 6.3); }, fur2, 6);
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(878, 256, 7, 0, 6.3); ctx.fill();
  ctx.strokeStyle = 'rgba(30,20,12,0.45)'; ctx.lineWidth = 3; for (let i = 0; i < 70; i++) { const x = 220 + r() * 560, y = 200 + r() * 200; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 8, y + 26 + r() * 20); ctx.stroke(); }
  grain(ctx, w, h, r, 5000);
  return c;
}
export function hideCanvas(seed = 8) {
  const w = 512, h = 512, c = mk(w, h), ctx = c.getContext('2d'), r = rng(seed);
  ctx.fillStyle = '#9a6a3e'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    const x = r() * w, y = r() * h, s = 70 + r() * 90; ctx.fillStyle = HIDE[(r() * 4) | 0]; ctx.strokeStyle = 'rgba(30,18,8,0.7)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283 + r() * 0.5, rr = s * (0.6 + r() * 0.5); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.setLineDash([9, 7]); ctx.strokeStyle = 'rgba(240,220,180,0.55)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
  }
  grain(ctx, w, h, r, 4000);
  return c;
}
export function waterCanvas() {          // se repite sin cortes; se anima corriendo el offset
  const w = 256, h = 256, c = mk(w, h), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#2f7a86'); g.addColorStop(0.5, '#3f9aa0'); g.addColorStop(1, '#2f7a86'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.lineCap = 'round';
  for (let k = 0; k < 9; k++) for (const oy of [-h, 0, h]) {
    const y0 = (k + 0.5) * h / 9 + oy, ph = k * 1.7, amp = 5 + (k % 3) * 3;
    ctx.strokeStyle = k % 2 ? 'rgba(235,250,250,0.75)' : 'rgba(180,225,230,0.55)'; ctx.lineWidth = 4 + (k % 3) * 2;
    ctx.beginPath(); for (let x = 0; x <= w; x += 8) { const y = y0 + Math.sin(x / w * 6.283 * 2 + ph) * amp; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  }
  return c;
}
export function flameCanvas() {
  const w = 128, h = 256, c = mk(w, h), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 190, 6, 64, 170, 120); g.addColorStop(0, 'rgba(255,250,200,1)'); g.addColorStop(0.35, 'rgba(255,190,60,0.95)'); g.addColorStop(0.7, 'rgba(255,90,20,0.55)'); g.addColorStop(1, 'rgba(255,60,10,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(64, 6); ctx.bezierCurveTo(100, 90, 126, 150, 100, 220); ctx.quadraticCurveTo(64, 258, 28, 220); ctx.bezierCurveTo(2, 150, 28, 90, 64, 6); ctx.fill();
  return c;
}
export { toTex };
