// Distribución aleatoria de las 20 piezas en las 4 mesas (5 por mesa, categorías mezcladas,
// sin superposiciones). Funciones puras: reciben datos y un generador aleatorio, devuelven datos.
import { TABLE, PIECES_PER_TABLE, MAX_SAME_CATEGORY_PER_TABLE } from './config.js';

/** Barajado Fisher–Yates (no modifica la lista original). */
export function shuffle(list, rng = Math.random) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Reparte piezas en grupos de 5 por mesa, sin más de 2 de la misma categoría por mesa. */
export function assignTables(pieceInfos, tableIds, rng = Math.random) {
  if (pieceInfos.length !== tableIds.length * PIECES_PER_TABLE) {
    throw new Error(`Se esperaban ${tableIds.length * PIECES_PER_TABLE} piezas y hay ${pieceInfos.length}`);
  }
  for (let attempt = 0; attempt < 500; attempt++) {
    const order = shuffle(pieceInfos, rng);
    const groups = tableIds.map((_, t) => order.slice(t * PIECES_PER_TABLE, (t + 1) * PIECES_PER_TABLE));
    const mixed = groups.every((g) => {
      const counts = {};
      for (const p of g) counts[p.category] = (counts[p.category] ?? 0) + 1;
      return Math.max(...Object.values(counts)) <= MAX_SAME_CATEGORY_PER_TABLE;
    });
    if (mixed) return new Map(tableIds.map((id, t) => [id, groups[t]]));
  }
  throw new Error('No se pudo generar una distribución mezclada');
}

/**
 * Busca un punto libre (coordenadas LOCALES de la mesa) a distancia ≥ minSpacing de `occupied`.
 * @param {Array<{x:number,z:number}>} occupied  puntos locales ya usados
 * @returns {{x:number, z:number} | null}
 */
export function findFreeSpot(occupied, rng = Math.random, tries = 300) {
  const hx = TABLE.width / 2 - TABLE.spawnMargin;
  const hz = TABLE.depth / 2 - TABLE.spawnMargin;
  for (let i = 0; i < tries; i++) {
    const p = { x: (rng() * 2 - 1) * hx, z: (rng() * 2 - 1) * hz };
    if (occupied.every((o) => Math.hypot(o.x - p.x, o.z - p.z) >= TABLE.minSpacing)) return p;
  }
  return null;
}

/**
 * Genera la distribución completa.
 * @returns {Array<{pieceId:string, tableId:string, x:number, z:number, yaw:number}>}
 */
export function generateLayout(pieceInfos, tableIds, rng = Math.random) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const byTable = assignTables(pieceInfos, tableIds, rng);
    const layout = [];
    let ok = true;
    for (const [tableId, group] of byTable) {
      const used = [];
      for (const p of group) {
        const spot = findFreeSpot(used, rng);
        if (!spot) { ok = false; break; }
        used.push(spot);
        layout.push({ pieceId: p.id, tableId, x: spot.x, z: spot.z, yaw: rng() * Math.PI * 2 });
      }
      if (!ok) break;
    }
    if (ok) return layout;
  }
  throw new Error('No se encontró una distribución sin superposiciones');
}

/** Firma compacta para comprobar que un reinicio produjo una configuración distinta. */
export function layoutSignature(layout) {
  return layout
    .map((l) => `${l.pieceId}@${l.tableId}:${l.x.toFixed(2)},${l.z.toFixed(2)}`)
    .sort()
    .join('|');
}
