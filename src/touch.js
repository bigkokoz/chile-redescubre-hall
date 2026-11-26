import * as THREE from 'three';

// ============================================================================
// MODO RECORRIDO (primera persona) para CELULAR y COMPUTADOR — sin visor
//  · Celular: joystick virtual a la izquierda (caminar), arrastrar el resto de la pantalla (mirar), giroscopio opcional, botones grandes.
//  · Computador: WASD + arrastrar (ya existían) y las mismas teclas M / N.
//  · Todo lo que se agarra o toca funciona con un dedo (tocar una esfera, el colihuacho, un objeto).
// ============================================================================

const UP = new THREE.Vector3(0, 1, 0);
const Q1 = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);

export function createInput() {
  const gyro = { on: false, q: new THREE.Quaternion(), ready: false };
  const move = { x: 0, y: 0 };                       // y > 0 = adelante
  const yq = new THREE.Quaternion(), eu = new THREE.Euler(), q0 = new THREE.Quaternion();
  const input = {
    move, gyro, touch: false,
    /** Orienta la cámara: con giroscopio usa el del teléfono (más el giro por arrastre); si no, yaw/pitch. */
    look(cam, pitch, yaw) {
      if (gyro.on && gyro.ready) { yq.setFromAxisAngle(UP, yaw); cam.quaternion.copy(yq).multiply(gyro.q); }
      else cam.rotation.set(pitch, yaw, 0, 'YXZ');
    },
    active() { return Math.abs(move.x) > 0.05 || Math.abs(move.y) > 0.05 || gyro.on; },
  };
  const onOrient = (e) => {
    if (e.alpha == null) return;
    const orient = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    eu.set(THREE.MathUtils.degToRad(e.beta), THREE.MathUtils.degToRad(e.alpha), -THREE.MathUtils.degToRad(e.gamma), 'YXZ');
    gyro.q.setFromEuler(eu).multiply(Q1).multiply(q0.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -THREE.MathUtils.degToRad(orient)));
    gyro.ready = true;
  };
  input.setGyro = async (on) => {
    if (on) {
      try { if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') return false; } } catch { return false; }
      addEventListener('deviceorientation', onOrient); gyro.on = true;
    } else { removeEventListener('deviceorientation', onOrient); gyro.on = false; gyro.ready = false; }
    return gyro.on;
  };
  return input;
}

/** Interfaz táctil: se activa en pantallas táctiles (o con ?touch). Devuelve controles para que app.js enlace acciones. */
export function mountTouchUI({ input, onPanel, onNext, hasStops, onMenu }) {
  // Solo teléfonos/tabletas. El navegador del Quest también reporta "pantalla táctil" y escondía el botón VR: por eso se excluye por nombre.
  const ua = navigator.userAgent || '', headset = /OculusBrowser|Quest|Pico|Wolvic|VR/i.test(ua);
  const phone = /iPhone|iPad|iPod|Android|Mobile/i.test(ua) && !headset;
  const isTouch = !headset && (phone || new URLSearchParams(location.search).has('touch'));
  if (!isTouch) return null;
  input.touch = true; document.body.classList.add('touch');
  const css = document.createElement('style');
  css.textContent = `
  #tjoy { position:fixed; left:18px; bottom:22px; width:150px; height:150px; border-radius:50%; background:rgba(255,255,255,.08); border:2px solid rgba(255,255,255,.25); z-index:9; touch-action:none; }
  #tjoy i { position:absolute; left:50%; top:50%; width:64px; height:64px; margin:-32px 0 0 -32px; border-radius:50%; background:rgba(53,240,192,.55); border:2px solid #35f0c0; }
  #tbtns { position:fixed; right:12px; top:12px; display:flex; flex-direction:column; gap:10px; z-index:9; }
  #tbtns button { width:62px; height:62px; border-radius:18px; border:1px solid rgba(255,255,255,.3); background:rgba(8,12,18,.72); color:#e9ecf3; font:700 12px system-ui,sans-serif; backdrop-filter:blur(8px); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; }
  #tbtns button b { font-size:22px; line-height:1; } #tbtns button.on { background:#35f0c0; color:#04120e; }
  #thint { position:fixed; left:50%; bottom:14px; transform:translateX(-50%); z-index:8; color:#cfd6e4; font:12px system-ui,sans-serif; background:rgba(8,12,18,.6); padding:6px 12px; border-radius:12px; pointer-events:none; text-align:center; max-width:60vw; }
  body.touch #ui { display:none; max-height:70vh; overflow:auto; left:8px; top:8px; right:84px; max-width:none; background:rgba(8,12,18,.82); padding:12px; border-radius:16px; backdrop-filter:blur(8px); }
  body.touch.ui-open #ui { display:flex; }
  body.touch #escenas { display:none; bottom:8px; left:8px; right:8px; transform:none; }
  body.touch.ui-open #escenas { display:flex; }
  body.touch.ui-open #tjoy, body.touch.ui-open #thint { display:none; }
  #tbtns .next { display:none; } body.has-stops #tbtns .next { display:flex; }
  body.touch #escenas .esc { width:200px; }
  `;
  document.head.appendChild(css);
  // joystick virtual
  const joy = document.createElement('div'); joy.id = 'tjoy'; joy.innerHTML = '<i></i>'; document.body.appendChild(joy);
  const knob = joy.firstChild; let pid = null; const R = 55;
  const set = (e) => { const r = joy.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), l = Math.hypot(dx, dy) || 1, k = Math.min(1, l / R); input.move.x = (dx / l) * k; input.move.y = (-dy / l) * k; knob.style.transform = `translate(${(dx / l) * k * R}px, ${(dy / l) * k * R}px)`; };
  joy.addEventListener('pointerdown', (e) => { pid = e.pointerId; joy.setPointerCapture(pid); set(e); e.stopPropagation(); e.preventDefault(); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === pid) { set(e); e.stopPropagation(); } });
  const end = (e) => { if (e.pointerId !== pid) return; pid = null; input.move.x = input.move.y = 0; knob.style.transform = ''; };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  // botones
  const btns = document.createElement('div'); btns.id = 'tbtns';
  const mk = (ico, txt, fn) => { const b = document.createElement('button'); b.innerHTML = `<b>${ico}</b>${txt}`; b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.onclick = (e) => { e.stopPropagation(); fn(b); }; btns.appendChild(b); return b; };
  mk('☰', 'Menú', () => { document.body.classList.toggle('ui-open'); onMenu && onMenu(); });
  mk('▤', 'Panel', () => onPanel());
  mk('➜', 'Siguiente', () => onNext()).classList.add('next');
  const g = mk('◎', 'Girar', async (b) => { const on = await input.setGyro(!input.gyro.on); b.classList.toggle('on', on); hint.textContent = on ? 'Mueve el celular para mirar · joystick para caminar' : 'Arrastra para mirar · joystick para caminar'; });
  document.body.appendChild(btns);
  const hint = document.createElement('div'); hint.id = 'thint'; hint.textContent = 'Arrastra para mirar · joystick para caminar · toca esferas y objetos'; document.body.appendChild(hint);
  setTimeout(() => hint.remove(), 14000);
  return { joy, btns };
}
