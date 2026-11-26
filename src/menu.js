// Selector de escenas compartido por todas las páginas del Hall.
// Cada escena es una página; "VR" en otra escena la abre y muestra una pantalla "Toca para entrar en VR"
// (el navegador exige un toque del usuario para iniciar VR, y ese toque se pierde al cambiar de página).

export const ESCENAS = [
  { id: 'casa', titulo: 'Casa del hall', ver: 'v0.3', desc: 'Discos que transforman la casa · tazas que se rompen · paisajes 360', thumb: 'thumbs/casa.jpg', ar: true },
  { id: 'bosque', titulo: 'Bosque de papel', ver: 'v0.4', desc: 'Taller en el bosque valdiviano · camina, agarra, picaflor y lluvia', thumb: 'thumbs/bosque.jpg', ar: false },
  { id: 'antiguo', titulo: 'Bosque antiguo', ver: 'v0.6', desc: 'Troncos enormes con raíces y musgo lima · niebla verde · tocón de taller', thumb: 'thumbs/antiguo.jpg', ar: false },
  { id: 'viaje', titulo: 'El viaje a Monte Verde', ver: 'v1.1', desc: 'Tira la palanca de la máquina del tiempo: del valle de hoy al campamento de hace 14.800 años · clase con narradora', thumb: 'thumbs/viaje.jpg', ar: false },
];

const ICON_VR = '<svg viewBox="0 0 48 28" width="34" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="40" height="19" rx="7"/><circle cx="16" cy="13.5" r="4.6"/><circle cx="32" cy="13.5" r="4.6"/><path d="M21 22.5l1.8-3h2.4l1.8 3"/></svg>';
const ICON_AR = '<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3l11 6v14l-11 6-11-6V9z"/><path d="M16 15l11-6M16 15L5 9M16 15v14"/></svg>';
export const vrButtonHTML = `${ICON_VR}<b>VR</b>`;
export const arButtonHTML = `${ICON_AR}<b>AR</b>`;

const CSS = `
#escenas { position:fixed; left:50%; bottom:14px; transform:translateX(-50%); z-index:6; display:flex; gap:12px; max-width:calc(100vw - 24px); overflow-x:auto; padding:2px; }
#escenas.hidden { display:none; }
#escenas .esc { flex:0 0 auto; width:236px; background:rgba(8,12,18,.78); border:1px solid rgba(255,255,255,.16); border-radius:16px; overflow:hidden; backdrop-filter:blur(10px); color:#e9ecf3; font:13px/1.35 system-ui,sans-serif; }
#escenas .esc.on { border-color:#35f0c0; box-shadow:0 0 0 1px #35f0c0 inset; }
#escenas .th { height:92px; background:#111 center/cover; position:relative; }
#escenas .th i { position:absolute; left:8px; top:8px; font-style:normal; font-size:11px; background:#000a; padding:2px 7px; border-radius:6px; }
#escenas .th em { position:absolute; right:8px; top:8px; font-style:normal; font-size:11px; background:#35f0c0; color:#04120e; padding:2px 7px; border-radius:6px; font-weight:700; }
#escenas .in { padding:9px 11px 11px; }
#escenas .in h3 { margin:0 0 2px; font-size:15px; }
#escenas .in p { margin:0 0 8px; color:#8b93a7; font-size:11.5px; min-height:30px; }
#escenas .bt { display:flex; gap:7px; }
#escenas .bt button { flex:1; display:inline-flex; align-items:center; justify-content:center; gap:7px; text-decoration:none; color:#e9ecf3; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.18); border-radius:10px; padding:7px 8px; cursor:pointer; font:600 13px system-ui,sans-serif; }
#escenas .bt button:hover { background:rgba(255,255,255,.17); }
#escenas .bt .vr { background:#35f0c0; color:#04120e; border-color:transparent; letter-spacing:.07em; font-weight:800; }
#escenas .bt .vr:hover { background:#6bf6d4; }
#escenas .bt .vr b, #escenas .bt .ar b { font-weight:800; font-size:14px; }
#splash { position:fixed; inset:0; z-index:20; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; background:rgba(4,5,10,.82); backdrop-filter:blur(8px); color:#e9ecf3; font-family:system-ui,sans-serif; text-align:center; }
#splash button { display:inline-flex; align-items:center; gap:14px; font:800 30px system-ui,sans-serif; letter-spacing:.08em; padding:20px 36px; border-radius:20px; border:0; background:#35f0c0; color:#04120e; cursor:pointer; }
#splash p { margin:0; color:#8b93a7; max-width:420px; }
`;

/** Barra de escenas (escritorio). Todo ocurre en la misma página: elegir una escena no recarga ni cierra el VR. */
export function mountMenu({ onSelect, onVR, onAR }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const nav = document.createElement('nav'); nav.id = 'escenas'; nav.setAttribute('aria-label', 'Escenas del hall');
  const cards = {};
  ESCENAS.forEach((e) => {
    const card = document.createElement('div'); card.className = 'esc';
    card.innerHTML = `<div class="th" style="background-image:url('${e.thumb}')"><i>${e.ver}</i><em>aquí</em></div>
      <div class="in"><h3>${e.titulo}</h3><p>${e.desc}</p><div class="bt"></div></div>`;
    const bt = card.querySelector('.bt');
    const mk = (cls, html, title, fn) => { const el = document.createElement('button'); el.className = cls; el.innerHTML = html; el.title = title; el.onclick = fn; bt.appendChild(el); return el; };
    mk('ver', 'Ver', `Abrir ${e.titulo}`, () => onSelect(e.id));
    mk('vr', vrButtonHTML, 'Entrar en realidad virtual', () => onVR(e.id));
    if (e.ar) mk('ar', arButtonHTML, 'Entrar en realidad mixta (passthrough)', () => onAR(e.id));
    nav.appendChild(card); cards[e.id] = card;
  });
  document.body.appendChild(nav);
  return {
    el: nav, hide: (h) => nav.classList.toggle('hidden', h),
    setCurrent: (id) => Object.entries(cards).forEach(([k, c]) => { c.classList.toggle('on', k === id); c.querySelector('.ver').style.display = k === id ? 'none' : ''; c.querySelector('em').style.display = k === id ? '' : 'none'; }),
  };
}

/** Si la URL trae ?vr=1 (o ?ar=1), muestra "Toca para entrar" y llama a start(kind) con ese toque. */
export function maybeSplash(start, available) {
  const q = new URLSearchParams(location.search);
  const kind = q.has('vr') ? 'vr' : q.has('ar') ? 'ar' : null;
  if (!kind) return;
  const wait = () => { if (available && !available(kind)) { setTimeout(wait, 400); return; } show(); };
  const show = () => {
    const d = document.createElement('div'); d.id = 'splash';
    d.innerHTML = `<button>${kind === 'vr' ? vrButtonHTML : arButtonHTML}</button><p>${kind === 'vr' ? 'Toca para entrar en realidad virtual. Ponte el visor primero.' : 'Toca para entrar en realidad mixta (passthrough).'}</p><a href="#" style="color:#8b93a7;font-size:13px">cancelar</a>`;
    d.querySelector('button').onclick = () => { d.remove(); start(kind); };
    d.querySelector('a').onclick = (e) => { e.preventDefault(); d.remove(); };
    document.body.appendChild(d);
  };
  setTimeout(wait, 600);
}
