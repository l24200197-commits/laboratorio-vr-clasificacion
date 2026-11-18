// Creación de las 20 piezas. Cada pieza es UN registro (fuente única de verdad) que relaciona:
// id, categoría, malla visual, cuerpo físico, estado, mesa de origen y bote asignado.
// Las geometrías se comparten por categoría (4 en total); los materiales son por pieza porque
// cada una cambia de color de resalte de forma independiente.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { CATEGORIES, PIECES_PER_CATEGORY, PHYSICS } from './config.js';
import { createShapeKit } from './colliders.js';
import { GROUP } from './physics-world.js';

/** Estados observables de una pieza. */
export const STATE = Object.freeze({
  AVAILABLE: 'disponible',
  HELD: 'sujeta',
  FLYING: 'en vuelo',
  SETTLING: 'estabilizándose',
  CLASSIFIED: 'clasificada',
  ERROR: 'error',
  RECOVERABLE: 'recuperable',
});

export function createKits() {
  return new Map(CATEGORIES.map((c) => [c.id, createShapeKit(c.shape)]));
}

/** @returns {Map<string, PieceRecord>} */
export function buildPieces(scene, physics, kits) {
  const pieces = new Map();
  for (const cat of CATEGORIES) {
    const kit = kits.get(cat.id);
    for (let n = 1; n <= PIECES_PER_CATEGORY; n++) {
      const id = `${cat.id}-${n}`;
      const material = new THREE.MeshStandardMaterial({
        color: cat.color, roughness: 0.45, metalness: 0.05, flatShading: kit.flat,
      });
      const mesh = new THREE.Mesh(kit.geometry, material);
      mesh.name = `pieza-${id}`;
      mesh.userData = { kind: 'piece', id };
      scene.add(mesh);

      const body = new CANNON.Body({
        mass: cat.mass,
        shape: kit.shape,
        material: physics.materials.piece,
        linearDamping: PHYSICS.linearDamping,
        angularDamping: PHYSICS.angularDamping,
        collisionFilterGroup: GROUP.PIECE,
        collisionFilterMask: GROUP.STATIC | GROUP.PIECE,
        sleepSpeedLimit: PHYSICS.sleepSpeedLimit,
        sleepTimeLimit: PHYSICS.sleepTimeLimit,
      });
      body.userData = { pieceId: id };
      physics.world.addBody(body);
      physics.track(body, mesh);

      pieces.set(id, {
        id,
        category: cat.id,
        label: cat.label,
        kit,
        mesh,
        material,
        body,
        mass: cat.mass,
        assignedBin: cat.id,   // el bote que la acepta
        originTable: null,     // se asigna en cada distribución aleatoria
        state: STATE.AVAILABLE,
        holder: null,          // 'xr-0' | 'xr-1' | 'mouse' | null
        judged: false,         // ¿el intento actual ya se contabilizó? (evita dobles conteos)
        stableBin: null,       // bote en el que se está midiendo el reposo
        stableSince: 0,
        errorAt: 0,
        floorSince: 0,
        flashUntil: 0,
      });
    }
  }
  return pieces;
}

/**
 * @typedef {object} PieceRecord
 * @property {string} id
 * @property {string} category
 * @property {THREE.Mesh} mesh
 * @property {CANNON.Body} body
 * @property {string} state
 */
