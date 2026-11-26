# Hall · Chile Re-Descubre

Hall de entrada WebXR para el concurso **Chile Re-Descubre** (Taller de Diseño de Interfaces, UAI, Unidad 3).
Entras a una **casa futurista con terraza** abierta a una selva infinita (360°). Sobre el escritorio hay una computadora y un rack con **cuatro discos**: agarras uno, lo metes en la ranura y una **línea de luz** recorre la casa y el paisaje transformándolos en el ambiente del disco (Autopoiesis, Desierto, Mar, Bosque). En **realidad mixta (passthrough)** la estación de discos aparece en miniatura sobre tu mesa real y los planos detectados (piso, paredes, mesas) se visten con el ambiente.

> Estado: v0.9 (modo recorrido para celular y PC, ranuras HALL/SALIR en el cuerpo, publicación con `npm run deploy`). Antes v0.8 (Monte Verde: clase recorrida con colihuacho, narración, fuego y agua; paneles de bolsillo múltiples; sonido configurable; rocas y troncos con musgo). Casa modelada en Blender con luz horneada (Cycles) y paisajes 360 renderizados; los discos todavía son ambientes de prueba, el hito protagonista se define después.

## Versiones guardadas (etiquetas de git)
| Etiqueta | Qué es |
|---|---|
| `v0.1-hall-base` | Hall base WebXR: portales, transformación de habitación, emulador Quest 3 |
| `v0.2-casa` | Casa de Blender con luz horneada, discos agarrables y paisajes 360 |
| `v0.3-fisica` | Física de juguetes: lanzar, tazas que se rompen, pelotas, orbes, pájaros |
| `v0.4-bosque` | Mundo 2: bosque de papel recorrible |
| `v0.5-menu` | Selector de escenas, recorrido automático de la cámara, botones VR/AR con logo |
| `v0.9-recorrido` | Modo recorrido en primera persona para celular y computador (joystick táctil, arrastrar para mirar, giroscopio opcional, caminar por la casa); el colihuacho se mete en las ranuras del pecho: HALL (vuelve a la casa) y SALIR (termina el VR); Monte Verde más frondoso; `npm run deploy` publica en un paso |
| `v0.8-monteverde` | **Hito:** escena Monte Verde (villa con gran carpa de 12 habitaciones, estructura en U, fogones que se alimentan con ramitas, arroyo, gente haciendo cosas, animal grande); el colihuacho (figura geométrica que se posa en tu hombro, vuelve si lo lanzas, zumbido al agarrarlo) abre la clase con narración pausable, velocidad, preguntas y guía por paradas; hasta 3 paneles de bolsillo (se quedan donde los sueltas y despegan lento si no los usas); giro suave; panel de sonido con presets; rocas y troncos con musgo; cuerpo cristalino que se vuelve transparente si no lo miras |
| `v0.7-bolsillo` | Cuerpo con bolsillos: sacas el panel con el grip, al soltarlo flota hacia arriba; páginas Escenas / Movimiento (activar o apagar joystick, giro, arrastre, solo físico) / Mundo (hora, lluvia, densidad); orbes amarillos en los bosques; carga sin congelar el visor |
| `v0.6-escenas-vr` | Una sola página con 3 escenas (Casa, Bosque de papel, Bosque antiguo); menú 3D dentro del visor (clic del joystick) que cambia de escena sin cerrar el VR |

Para volver a una versión: `git checkout v0.3-fisica` (y `npm run build`). El menú de escenas del sitio (`src/menu.js`) lista las escenas activas; agregar una escena = una página nueva + una entrada en `ESCENAS`.

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

## Cambiar de escena
- **PC:** barra de tarjetas abajo (Ver / VR / AR). **Dentro del visor:** clic del joystick abre un panel con las escenas; apuntas con el control y aprietas el gatillo. La sesión VR no se cierra al cambiar.
- Arquitectura: `src/app.js` (visor y bucle únicos) + un módulo por escena (`world_casa.js`, `world_bosque.js` usado dos veces con distinta configuración). Una escena nueva = un módulo `create…(app)` + una entrada en `ESCENAS` (`src/menu.js`).

## Mundo 2: Bosque de papel y Mundo 3: Bosque antiguo
Escena recorrible en estilo **papel recortado en capas** (bosque valdiviano): árboles latifoliados, alerces, helechos, nalca, quila, copihues, hojarasca y ramitas, todo generado por código (`src/papel.js`, `src/bosque.js`). Un **taller** de madera sobre una plataforma con herramientas, tazas y palitos agarrables (misma física del hall), mariposas, un **picaflor chico** que visita los copihues y cruza frente a tu cara, hora del día (mañana, dorada, noche con luciérnagas) y **lluvia**.
- **Quest:** joystick izquierdo camina, derecho gira por pasos, gatillo/grip en el aire arrastra el mundo, A = lluvia, B = hora. Además puedes caminar de verdad dentro de tu área.
- **PC:** WASD + arrastrar para mirar, clic sostenido para agarrar y lanzar, L = lluvia, H = hora, R = reponer.
- Parámetros ajustables en `LOCO` y `PARAM` (velocidad, giro, ganancia del agarre, densidad, niebla).

## Cómo se hizo
1. **Blender 5.3** (modelado procedural por script, conectado con MCP): casa, mobiliario, escritorio curvo, computadores, discos y jungla de ~3.600 árboles.
2. **Luz horneada** (`herramientas/hornear_sala.py`): Cycles hornea la iluminación completa (directa + indirecta + emisión) en un atlas de textura y exporta GLB. En el visor se muestra sin luces en tiempo real → entra en la GPU de un Quest 2.
3. **Paisajes 360** (`herramientas/panorama.py`): render equirectangular por ambiente; el cielo es una esfera con un shader que mezcla dos paisajes con un frente de luz.
4. **Three.js**: carga GLB, discos con raycaster (control/mano/mouse), transformación por onda desde la ranura (`src/theme.js`, `src/casa.js`).

## Tecnologías
Three.js · WebXR Device API (`immersive-ar`, `immersive-vr`, `plane-detection`, `mesh-detection`, `anchors`, `hand-tracking`) · GLSL propio · Web Audio procedural · Blender/Cycles · Vite · IWER (emulador de Meta).

## Publicar cambios (actualizar el sitio)
```bash
npm run deploy   # compila y sube dist a gh-pages; el portafolio enlaza a esa URL, así que se actualiza solo
```
Guardar una versión: `git tag v1.0-nombre && git push --tags`.

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
