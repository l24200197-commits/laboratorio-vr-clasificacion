// Reglas de negocio PURAS (sin Three.js de escena ni DOM): fáciles de probar y explicar.
//
// La distancia medida es la distancia euclidiana 3D (m) entre el centro de la pieza al soltarla
// y el punto de referencia (centro) de cada destino.

/**
 * @param {{distanceTo: Function}} piecePosition  posición de la pieza (THREE.Vector3)
 * @param {string} expectedTargetId              destino asignado a la pieza
 * @param {Array<{id:string, position:any}>} targets
 * @param {number} tolerance                     metros
 * @returns {{ok:boolean, reason:'ok'|'distancia'|'destino', nearestId:string|null, distance:number}}
 */
export function validateDrop(piecePosition, expectedTargetId, targets, tolerance) {
  if (!(tolerance > 0)) throw new RangeError('La tolerancia debe ser > 0');
  if (!Array.isArray(targets) || targets.length === 0) throw new TypeError('No hay destinos');

  let nearest = null;
  let best = Infinity;
  for (const t of targets) {
    const d = piecePosition.distanceTo(t.position);
    if (d < best) { best = d; nearest = t; }
  }

  if (best > tolerance) return { ok: false, reason: 'distancia', nearestId: nearest.id, distance: best };
  if (nearest.id !== expectedTargetId) return { ok: false, reason: 'destino', nearestId: nearest.id, distance: best };
  return { ok: true, reason: 'ok', nearestId: nearest.id, distance: best };
}
