import * as THREE from 'three';

// Panel flotante de estado (visible dentro del visor): modo, ambiente, planos y mallas detectados.
export function makeHud() {
  const W = 640, H = 300;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46 * H / W), mat);
  mesh.renderOrder = 999;

  let last = '';
  function set(lines, accent = '#35f0c0') {
    const key = lines.join('|') + accent;
    if (key === last) return;
    last = key;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(6,8,14,0.78)';
    roundRect(ctx, 0, 0, W, H, 28); ctx.fill();
    ctx.strokeStyle = accent; ctx.lineWidth = 3;
    roundRect(ctx, 1.5, 1.5, W - 3, H - 3, 27); ctx.stroke();
    ctx.fillStyle = accent; ctx.font = '600 30px system-ui, sans-serif';
    ctx.fillText(lines[0], 28, 54);
    ctx.fillStyle = '#e9ecf3'; ctx.font = '26px system-ui, sans-serif';
    lines.slice(1).forEach((l, i) => ctx.fillText(l, 28, 100 + i * 40));
    tex.needsUpdate = true;
  }

  const tmpP = new THREE.Vector3(), tmpD = new THREE.Vector3(), target = new THREE.Vector3();
  /** Mantiene el panel ~0.85 m delante y un poco abajo de la cabeza, con suavizado. */
  function follow(cam, dt) {
    cam.getWorldPosition(tmpP);
    cam.getWorldDirection(tmpD);
    tmpD.y = Math.max(-0.2, Math.min(0.2, tmpD.y)); tmpD.normalize();
    target.copy(tmpP).addScaledVector(tmpD, 0.85); target.y = tmpP.y - 0.55;
    mesh.position.lerp(target, Math.min(1, dt * 3));
    mesh.lookAt(tmpP);
  }
  set(['Hall', 'iniciando…']);
  return { mesh, set, follow };
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
