# Hall · Chile Re-Descubre

Hall de entrada WebXR para el concurso **Chile Re-Descubre** (Taller de Diseño de Interfaces, UAI, Unidad 3).
Desde el hall se elige un ambiente de Chile y **tu habitación real se transforma**: los planos y mallas que detecta el visor (piso, paredes, techo, mesas) se visten con el ambiente elegido (Laboratorio, Desierto, Mar, Bosque).

> Estado: v0.1, base del hall. Los portales aún no enlazan a hitos; el hito protagonista se define después.

## Cómo se usa
- **Meta Quest 3 / Quest 2:** abrir la URL en el Quest Browser → *Entrar en AR (passthrough)* para ver tu pieza real, o *Entrar en VR* para el hall cerrado. Apuntar un portal con el control (o pellizcar con la mano) cambia el ambiente.
- **PC (vista previa):** arrastrar para mirar, clic en un portal o teclas 1–4.
- **PC con visor simulado:** `?emu` en la URL activa un Quest 3 emulado con una habitación sintética (planos y malla).

## Tecnologías
Three.js · WebXR Device API (`immersive-ar`, `immersive-vr`, `plane-detection`, `mesh-detection`, `anchors`, `hand-tracking`) · shaders GLSL propios · Web Audio procedural · Vite · IWER (emulador de Meta).

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
