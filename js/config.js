// Configuración del laboratorio: datos, no lógica. Cambiar aquí NO requiere reescribir reglas.
// Unidades en metros (espacio de referencia 'local-floor': y = 0 es el piso).

export const LAB = {
  // Tolerancia de colocación: distancia máxima (m) entre el CENTRO de la pieza
  // y el CENTRO de referencia de su destino al momento de soltarla.
  snapTolerance: 0.07,
  feedbackMs: 1300, // duración de la señal roja de error
  tableTopY: 0.78,
  table: { width: 1.3, depth: 0.6, centerZ: -0.6 },
  // Área permitida para soltar piezas (se recorta al soltar).
  dragBounds: { min: [-0.9, 0.6, -1.0], max: [0.9, 1.7, -0.2] },
  hud: { position: [0, 1.48, -1.15], width: 0.9, height: 0.45 },
  rayLength: 3,
};

// Cinco piezas distintas por forma, color y etiqueta.
export const PIECES = [
  { id: 'cubo', label: 'CUBO', shape: 'box', color: 0xe4572e, startX: -0.48, target: 'destino-cubo' },
  { id: 'esfera', label: 'ESFERA', shape: 'sphere', color: 0x29a3d9, startX: -0.24, target: 'destino-esfera' },
  { id: 'cono', label: 'CONO', shape: 'cone', color: 0xf2c14e, startX: 0, target: 'destino-cono' },
  { id: 'cilindro', label: 'CILINDRO', shape: 'cylinder', color: 0x7bc950, startX: 0.24, target: 'destino-cilindro' },
  { id: 'prisma', label: 'PRISMA', shape: 'prism', color: 0x9b5de5, startX: 0.48, target: 'destino-prisma' },
];
export const PIECE_ROW_Z = -0.4;

// Destinos en orden distinto al de las piezas para que no sea trivial.
export const TARGETS = [
  { id: 'destino-cilindro', pieceId: 'cilindro', x: -0.48 },
  { id: 'destino-prisma', pieceId: 'prisma', x: -0.24 },
  { id: 'destino-cubo', pieceId: 'cubo', x: 0 },
  { id: 'destino-esfera', pieceId: 'esfera', x: 0.24 },
  { id: 'destino-cono', pieceId: 'cono', x: 0.48 },
];
export const TARGET_ROW_Z = -0.78;
