// Construcción de la escena: ambiente, mesa, piezas y destinos. Solo geometrías de Three.js
// (sin modelos descargados): ligero para Quest 3 y sin dependencias de licencias.
import * as THREE from 'three';
import { LAB, PIECES, PIECE_ROW_Z, TARGETS, TARGET_ROW_Z } from './config.js';
import { makeLabel } from './text.js';

const SHAPES = {
  box: { make: () => new THREE.BoxGeometry(0.09, 0.09, 0.09), half: 0.045 },
  sphere: { make: () => new THREE.SphereGeometry(0.05, 24, 16), half: 0.05 },
  cone: { make: () => new THREE.ConeGeometry(0.055, 0.11, 24), half: 0.055 },
  cylinder: { make: () => new THREE.CylinderGeometry(0.045, 0.045, 0.1, 24), half: 0.05 },
  prism: { make: () => new THREE.CylinderGeometry(0.062, 0.062, 0.1, 3), half: 0.05 },
};

function shapeOf(name) {
  const s = SHAPES[name];
  if (!s) throw new Error(`Forma no soportada: ${name}`);
  return s;
}

export function buildEnvironment(scene) {
  scene.background = new THREE.Color(0x0d1526); // fondo virtual OPACO (sin passthrough)

  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(1, 3, 1);
  scene.add(sun);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(4, 48),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Anillo que delimita la zona de trabajo
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.45, 1.5, 64),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.5 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;
  scene.add(ring);

  // Pared de fondo suave
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 3),
    new THREE.MeshStandardMaterial({ color: 0x15233d }),
  );
  wall.position.set(0, 1.5, -2.5);
  scene.add(wall);

  scene.add(buildTable());
}

function buildTable() {
  const { width, depth, centerZ } = LAB.table;
  const top = LAB.tableTopY;
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, depth), wood);
  slab.position.set(0, top - 0.02, centerZ);
  group.add(slab);
  const legGeo = new THREE.BoxGeometry(0.05, top - 0.04, 0.05);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = new THREE.Mesh(legGeo, wood);
    leg.position.set(sx * (width / 2 - 0.05), (top - 0.04) / 2, centerZ + sz * (depth / 2 - 0.05));
    group.add(leg);
  }
  return group;
}

/** @returns {Map<string, {config, mesh, material, startPosition, startQuaternion, flashUntil:number}>} */
export function buildPieces(parent) {
  const pieces = new Map();
  for (const cfg of PIECES) {
    const shape = shapeOf(cfg.shape);
    const material = new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.45, metalness: 0.1 });
    const mesh = new THREE.Mesh(shape.make(), material);
    mesh.name = `pieza-${cfg.id}`;
    mesh.userData = { kind: 'piece', id: cfg.id };
    mesh.position.set(cfg.startX, LAB.tableTopY + shape.half, PIECE_ROW_Z);
    parent.add(mesh);
    pieces.set(cfg.id, {
      config: cfg,
      mesh,
      material,
      startPosition: mesh.position.clone(),
      startQuaternion: mesh.quaternion.clone(),
      flashUntil: 0,
    });
  }
  return pieces;
}

/** @returns {Map<string, {id, pieceId, position, quaternion, pad, ghost, baseColor, flashUntil:number}>} */
export function buildTargets(parent) {
  const targets = new Map();
  const byId = new Map(PIECES.map((p) => [p.id, p]));
  for (const cfg of TARGETS) {
    const piece = byId.get(cfg.pieceId);
    if (!piece) throw new Error(`Destino ${cfg.id} apunta a pieza inexistente`);
    const shape = shapeOf(piece.shape);
    const baseColor = new THREE.Color(piece.color).multiplyScalar(0.45).getHex();

    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.008, 32),
      new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.6 }),
    );
    pad.position.set(cfg.x, LAB.tableTopY + 0.004, TARGET_ROW_Z);
    parent.add(pad);

    // Silueta: misma forma en alambre -> la relación no depende solo del color.
    const ghost = new THREE.Mesh(
      shape.make(),
      new THREE.MeshBasicMaterial({ color: piece.color, wireframe: true, transparent: true, opacity: 0.45 }),
    );
    ghost.position.set(cfg.x, LAB.tableTopY + shape.half, TARGET_ROW_Z);
    parent.add(ghost);

    const label = makeLabel(piece.label, { width: 0.15, height: 0.04, border: `#${piece.color.toString(16).padStart(6, '0')}` });
    label.position.set(cfg.x, LAB.tableTopY + 0.002, TARGET_ROW_Z + 0.11);
    label.rotation.x = -Math.PI / 2;
    parent.add(label);

    targets.set(cfg.id, {
      id: cfg.id,
      pieceId: cfg.pieceId,
      label: piece.label,
      position: ghost.position.clone(),
      quaternion: ghost.quaternion.clone(),
      pad,
      ghost,
      baseColor,
      flashUntil: 0,
    });
  }
  return targets;
}
