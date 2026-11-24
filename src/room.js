import * as THREE from 'three';

const SKIP_LABELS = new Set(['wall art', 'window', 'door', 'door frame', 'window frame', 'screen', 'lamp', 'plant', 'other']);

/**
 * Convierte lo que el visor entiende de tu habitación (WebXR plane-detection / mesh-detection)
 * en objetos 3D, vestidos con el material del ambiente actual.
 * - Planos: rectángulos/polígonos de piso, paredes, techo, mesas (Quest 2 y 3, con Room Setup).
 * - Mallas: geometría real de la sala (Quest 3 / 3S).
 */
export class RoomScanner {
  constructor(scene, planeMaterial) {
    this.group = new THREE.Group();
    this.group.name = 'Sala::Escaneo';
    scene.add(this.group);
    this.planeMat = planeMaterial;
    this.meshMat = new THREE.MeshBasicMaterial({ color: 0x35f0c0, wireframe: true, transparent: true, opacity: 0.16, depthWrite: false });
    this.planes = new Map();
    this.meshes = new Map();
    this.stats = { planes: 0, meshes: 0, labels: {} };
  }

  update(frame, refSpace) {
    this.#updatePlanes(frame, refSpace);
    this.#updateMeshes(frame, refSpace);
  }

  #updatePlanes(frame, refSpace) {
    const set = frame.detectedPlanes;
    const labels = {};
    if (!set) { this.stats.planes = 0; this.stats.labels = labels; return; }
    const seen = new Set();
    for (const plane of set) {
      const lab0 = (plane.semanticLabel || '').toLowerCase();
      if (SKIP_LABELS.has(lab0)) continue; // cuadros, ventanas y puertas se solapan con la pared: no se visten
      seen.add(plane);
      const pose = frame.getPose(plane.planeSpace, refSpace);
      if (!pose) continue;
      let rec = this.planes.get(plane);
      if (!rec || rec.t !== plane.lastChangedTime) {
        if (rec) { this.group.remove(rec.mesh); rec.mesh.geometry.dispose(); }
        const pts = plane.polygon.map((p) => new THREE.Vector2(p.x, p.z));
        const geo = new THREE.ShapeGeometry(new THREE.Shape(pts));
        geo.rotateX(Math.PI / 2); // el polígono vive en XZ del plano; la normal queda en Y local
        const mesh = new THREE.Mesh(geo, this.planeMat);
        mesh.matrixAutoUpdate = false;
        mesh.name = `Sala::Plano_${plane.semanticLabel || plane.orientation || 'x'}`;
        this.group.add(mesh);
        rec = { mesh, t: plane.lastChangedTime };
        this.planes.set(plane, rec);
      }
      rec.mesh.matrix.fromArray(pose.transform.matrix);
      rec.mesh.matrixWorldNeedsUpdate = true;
      const lab = plane.semanticLabel || plane.orientation || 'plano';
      labels[lab] = (labels[lab] || 0) + 1;
    }
    for (const [plane, rec] of this.planes) {
      if (!seen.has(plane)) { this.group.remove(rec.mesh); rec.mesh.geometry.dispose(); this.planes.delete(plane); }
    }
    this.stats.planes = this.planes.size;
    this.stats.labels = labels;
  }

  #updateMeshes(frame, refSpace) {
    const set = frame.detectedMeshes;
    if (!set) { this.stats.meshes = 0; return; }
    const seen = new Set();
    for (const m of set) {
      seen.add(m);
      const pose = frame.getPose(m.meshSpace, refSpace);
      if (!pose) continue;
      let rec = this.meshes.get(m);
      if (!rec || rec.t !== m.lastChangedTime) {
        if (rec) { this.group.remove(rec.mesh); rec.mesh.geometry.dispose(); }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(m.vertices, 3));
        geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
        const mesh = new THREE.Mesh(geo, this.meshMat);
        mesh.matrixAutoUpdate = false;
        mesh.name = `Sala::Malla_${m.semanticLabel || 'global'}`;
        this.group.add(mesh);
        rec = { mesh, t: m.lastChangedTime };
        this.meshes.set(m, rec);
      }
      rec.mesh.matrix.fromArray(pose.transform.matrix);
      rec.mesh.matrixWorldNeedsUpdate = true;
    }
    for (const [m, rec] of this.meshes) {
      if (!seen.has(m)) { this.group.remove(rec.mesh); rec.mesh.geometry.dispose(); this.meshes.delete(m); }
    }
    this.stats.meshes = this.meshes.size;
  }

  clear() {
    for (const rec of [...this.planes.values(), ...this.meshes.values()]) { this.group.remove(rec.mesh); rec.mesh.geometry.dispose(); }
    this.planes.clear(); this.meshes.clear();
    this.stats = { planes: 0, meshes: 0, labels: {} };
  }
}
