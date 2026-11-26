import * as THREE from 'three';
import { ESCENAS } from './menu.js';

// Menú de escenas dentro del visor: un panel flotante con una tarjeta por escena.
// Se abre/cierra con el clic del joystick; apuntas con el control y aprietas el gatillo.
export function createVRMenu() {
  const W = 1600, H = 640;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6 * H / W), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false, fog: false }));
  mesh.renderOrder = 1000; mesh.name = 'Menu_escenas';
  const imgs = ESCENAS.map((e) => { const im = new Image(); im.onload = () => draw(); im.src = import.meta.env.BASE_URL + e.thumb; return im; });
  const n = ESCENAS.length, gap = 22, padX = 28, cardW = (W - padX * 2 - gap * (n - 1)) / n, cardY = 130, cardH = H - cardY - 28;
  let hover = -1, current = '', open = false;

  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(6,9,14,0.88)'; rr(0, 0, W, H, 36); ctx.fill();
    ctx.strokeStyle = '#35f0c0'; ctx.lineWidth = 4; rr(2, 2, W - 4, H - 4, 34); ctx.stroke();
    ctx.fillStyle = '#35f0c0'; ctx.font = '700 44px system-ui, sans-serif'; ctx.fillText('ESCENAS', padX, 70);
    ctx.fillStyle = '#9aa3b8'; ctx.font = '28px system-ui, sans-serif'; ctx.fillText('Apunta con el control y aprieta el gatillo · clic del joystick = cerrar', padX, 108);
    ESCENAS.forEach((e, i) => {
      const x = padX + i * (cardW + gap), here = e.id === current, hv = hover === i;
      ctx.save(); rr(x, cardY, cardW, cardH, 24); ctx.clip();
      ctx.fillStyle = hv ? '#1d2a36' : '#121a24'; ctx.fillRect(x, cardY, cardW, cardH);
      const im = imgs[i], th = cardH * 0.55;
      if (im.complete && im.naturalWidth) { const s = Math.max(cardW / im.naturalWidth, th / im.naturalHeight), iw = im.naturalWidth * s, ih = im.naturalHeight * s; ctx.drawImage(im, x + (cardW - iw) / 2, cardY + (th - ih) / 2, iw, ih); }
      ctx.restore();
      ctx.lineWidth = hv ? 7 : here ? 5 : 2; ctx.strokeStyle = hv ? '#ffffff' : here ? '#35f0c0' : 'rgba(255,255,255,0.25)'; rr(x, cardY, cardW, cardH, 24); ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; rr(x + 14, cardY + 14, 82, 36, 10); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '600 24px system-ui, sans-serif'; ctx.fillText(e.ver, x + 28, cardY + 40);
      if (here) { ctx.fillStyle = '#35f0c0'; rr(x + cardW - 120, cardY + 14, 106, 36, 10); ctx.fill(); ctx.fillStyle = '#04120e'; ctx.font = '700 24px system-ui, sans-serif'; ctx.fillText('aquí', x + cardW - 98, cardY + 40); }
      ctx.fillStyle = '#eef2f8'; ctx.font = '700 36px system-ui, sans-serif'; ctx.fillText(e.titulo, x + 20, cardY + th + 52);
      ctx.fillStyle = '#9aa3b8'; ctx.font = '24px system-ui, sans-serif';
      const words = e.desc.split(' '); let line = '', yy = cardY + th + 90;
      words.forEach((w) => { const t = line + w + ' '; if (ctx.measureText(t).width > cardW - 40) { ctx.fillText(line, x + 20, yy); line = w + ' '; yy += 30; } else line = t; }); ctx.fillText(line, x + 20, yy);
    });
    tex.needsUpdate = true;
  }
  draw();

  const rc = new THREE.Raycaster(), tmpM = new THREE.Matrix4();
  /** Índice de tarjeta bajo el rayo del control (o -1). */
  function pick(ctrl) {
    if (!open) return -1;
    tmpM.identity().extractRotation(ctrl.matrixWorld);
    rc.ray.origin.setFromMatrixPosition(ctrl.matrixWorld); rc.ray.direction.set(0, 0, -1).applyMatrix4(tmpM); rc.far = 8;
    const h = rc.intersectObject(mesh, false)[0]; if (!h || !h.uv) return -1;
    const px = h.uv.x * W, py = (1 - h.uv.y) * H;
    for (let i = 0; i < n; i++) { const x = padX + i * (cardW + gap); if (px >= x && px <= x + cardW && py >= cardY && py <= cardY + cardH) return i; }
    return -1;
  }
  return {
    mesh, pick,
    get open() { return open; },
    setCurrent(id) { current = id; draw(); },
    show(scene, cam) {
      const p = cam.getWorldPosition(new THREE.Vector3()), d = cam.getWorldDirection(new THREE.Vector3()); d.y = 0; d.normalize();
      mesh.position.copy(p).addScaledVector(d, 1.25); mesh.position.y = p.y - 0.12; mesh.lookAt(p.x, mesh.position.y + 0.02, p.z);
      scene.add(mesh); open = true; draw();
    },
    hide() { mesh.parent && mesh.parent.remove(mesh); open = false; hover = -1; },
    update(ctrls) {
      let h = -1; for (const c of ctrls) { const i = pick(c); if (i >= 0) h = i; }
      if (h !== hover) { hover = h; draw(); }
    },
  };
}
