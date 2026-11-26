# Hall · Chile Re-Descubre

Hall de entrada WebXR para el concurso **Chile Re-Descubre** (Taller de Diseño de Interfaces, UAI, Unidad 3).
Entras a una **casa futurista con terraza** abierta a una selva infinita (360°). Sobre el escritorio hay una computadora y un rack con **cuatro discos**: agarras uno, lo metes en la ranura y una **línea de luz** recorre la casa y el paisaje transformándolos en el ambiente del disco (Autopoiesis, Desierto, Mar, Bosque). En **realidad mixta (passthrough)** la estación de discos aparece en miniatura sobre tu mesa real y los planos detectados (piso, paredes, mesas) se visten con el ambiente.

> Estado: v0.3 (física de juguetes + pájaros). Casa modelada en Blender con luz horneada (Cycles) y paisajes 360 renderizados; los discos todavía son ambientes de prueba, el hito protagonista se define después.

## Cómo se usa
- **Meta Quest 3 / Quest 2:** abrir la URL en el Quest Browser → *Entrar en VR* (la casa) o *Entrar en AR (passthrough)* (estación sobre tu mesa). Con el control (gatillo o grip) o pellizcando: apuntar un disco, agarrarlo y soltarlo cerca de la ranura de la computadora (un toque rápido también lo inserta).
- **PC (vista previa):** arrastrar para mirar, clic en un disco para insertarlo. Teclas **1–4** = discos, **0** = volver a la casa.
- **PC con visor simulado:** `?emu` en la URL activa un Quest 3 emulado con una habitación sintética (planos y malla).

## Objetos que se agarran y se lanzan (v0.3)
- **Discos:** agárralos y suéltalos cerca de la ranura para insertarlos. Si los lanzas, rebotan con la casa y, al tocar el piso, vuelven solos al rack.
- **Tazas de café:** se rompen si chocan fuerte (piso, paredes, mesas): salen trozos de cerámica y gotas de café, y reaparecen sobre el escritorio.
- **Pelotas:** rebotan. **Orbes de luz:** flotan y cambian de color con el ambiente.
- **Pájaros:** una bandada cruza la sala por el ventanal cada ~30 s y otras pasan lejos por el cielo; su color cambia con el ambiente.
- Física propia y liviana (esferas contra cajas, 120 Hz) en `src/juguetes.js`; sonidos procedurales en `src/audio.js`; pájaros en `src/pajaros.js`. Tecla **R** repone los objetos.

## Cómo se hizo
1. **Blender 5.3** (modelado procedural por script, conectado con MCP): casa, mobiliario, escritorio curvo, computadores, discos y jungla de ~3.600 árboles.
2. **Luz horneada** (`herramientas/hornear_sala.py`): Cycles hornea la iluminación completa (directa + indirecta + emisión) en un atlas de textura y exporta GLB. En el visor se muestra sin luces en tiempo real → entra en la GPU de un Quest 2.
3. **Paisajes 360** (`herramientas/panorama.py`): render equirectangular por ambiente; el cielo es una esfera con un shader que mezcla dos paisajes con un frente de luz.
4. **Three.js**: carga GLB, discos con raycaster (control/mano/mouse), transformación por onda desde la ranura (`src/theme.js`, `src/casa.js`).

## Tecnologías
Three.js · WebXR Device API (`immersive-ar`, `immersive-vr`, `plane-detection`, `mesh-detection`, `anchors`, `hand-tracking`) · GLSL propio · Web Audio procedural · Blender/Cycles · Vite · IWER (emulador de Meta).

## Desarrollo
```bash
npm install
npm run dev          # https en la red local (certificado autofirmado): abrirlo desde el Quest
NO_SSL=1 npm run dev # http en localhost, para el PC
npm run build        # genera dist/ para GitHub Pages
```

## Notas técnicas
- Quest 2: passthrough en blanco y negro; planos con *Room Setup*. Quest 3: color, profundidad y malla de la habitación.
- iPhone/Safari no soporta WebXR AR: queda como vista previa 3D.
- Video de la cápsula (1 min): _pendiente_.
