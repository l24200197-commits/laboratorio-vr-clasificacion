// Cuatro mesas estáticas: malla visual + UN cuerpo estático por mesa con tablero y patas.
import * as THREE from 'three';
import { TABLE, TABLES } from './config.js';
import { makeLabel } from './text.js';

/**
 * @returns {Array<{id, label, x, z, rotY, topY, width, depth, toWorld:(lx:number, lz:number)=>THREE.Vector3}>}
 */
export function buildTables(scene, physics) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
  const { width: w, depth: d, topY, thickness: t, colliderThickness: ct, legSize: ls } = TABLE;
  const legH = topY - t;
  const slabGeo = new THREE.BoxGeometry(w, t, d);
  const legGeo = new THREE.BoxGeometry(ls, legH, ls);
  const legOffsets = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [sx * (w / 2 - ls), sz * (d / 2 - ls)]);

  return TABLES.map((cfg) => {
    const group = new THREE.Group();
    group.name = cfg.id;
    group.position.set(cfg.x, 0, cfg.z);
    group.rotation.y = cfg.rotY;

    const slab = new THREE.Mesh(slabGeo, wood);
    slab.position.y = topY - t / 2;
    group.add(slab);
    for (const [lx, lz] of legOffsets) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, legH / 2, lz);
      group.add(leg);
    }

    // Rótulo en el canto que mira al centro del laboratorio.
    const label = makeLabel(cfg.label, { width: 0.18, height: 0.045, border: '#38bdf8' });
    label.position.set(0, topY - t / 2, d / 2 + 0.002);
    group.add(label);
    scene.add(group);

    // Colisionador: tablero más grueso que el visual (crece hacia abajo) + cuatro patas.
    physics.addStatic(
      [
        { halfExtents: [w / 2, ct / 2, d / 2], offset: [0, topY - ct / 2, 0] },
        ...legOffsets.map(([lx, lz]) => ({ halfExtents: [ls / 2, (topY - ct) / 2, ls / 2], offset: [lx, (topY - ct) / 2, lz] })),
      ],
      { position: [cfg.x, 0, cfg.z], rotY: cfg.rotY, name: cfg.id },
    );

    const toWorld = (lx, lz) => new THREE.Vector3(lx, topY, lz).applyAxisAngle(UP, cfg.rotY).add(new THREE.Vector3(cfg.x, 0, cfg.z));
    const toLocal = (p) => new THREE.Vector3(p.x - cfg.x, p.y, p.z - cfg.z).applyAxisAngle(UP, -cfg.rotY);
    /** ¿El punto (centro de una pieza) descansa sobre esta mesa? */
    const holds = (p) => {
      const l = toLocal(p);
      return Math.abs(l.x) < w / 2 && Math.abs(l.z) < d / 2 && p.y > topY && p.y < topY + 0.15;
    };
    return { ...cfg, topY, width: w, depth: d, toWorld, toLocal, holds };
  });
}

const UP = new THREE.Vector3(0, 1, 0);
