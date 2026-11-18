// Configuración de la práctica 3.2: DATOS, no lógica. Cambiar valores aquí no obliga a tocar reglas.
// Unidades: metros, kilogramos, segundos. Espacio de referencia 'local-floor' (y = 0 es el piso).
// El usuario está de pie en el origen mirando hacia -Z.

/**
 * Las CUATRO categorías elegidas. Para cambiar una figura basta con editar esta lista
 * (shape debe existir en js/colliders.js: sphere | box | pyramid | hexPrism).
 * El orden define también el orden de los botes de izquierda a derecha.
 */
export const CATEGORIES = [
  { id: 'esfera', label: 'ESFERA', shape: 'sphere', color: 0x29a3d9, mass: 0.15 },
  { id: 'cubo', label: 'CUBO', shape: 'box', color: 0xe4572e, mass: 0.18 },
  { id: 'piramide', label: 'PIRÁMIDE', shape: 'pyramid', color: 0xf2c14e, mass: 0.12 },
  { id: 'hexagonal', label: 'PRISMA HEX', shape: 'hexPrism', color: 0x7bc950, mass: 0.15 },
];

export const PIECES_PER_CATEGORY = 5; // 4 × 5 = 20 piezas
export const PIECES_PER_TABLE = 5;    // 4 mesas × 5 = 20 piezas
export const MAX_SAME_CATEGORY_PER_TABLE = 2; // obliga a que cada mesa tenga categorías mezcladas

/** Dimensiones de las figuras (todas ≈ 8 cm: caben 5 en cada bote y se pueden tomar con la mano). */
export const SHAPE_SIZES = {
  sphere: { radius: 0.04 },
  box: { size: 0.07 },
  pyramid: { radius: 0.055, height: 0.085 }, // radius = distancia del eje a cada esquina de la base
  hexPrism: { radius: 0.042, height: 0.08 },
};

/** Cuatro mesas: dos laterales y dos al fondo, con los botes en medio. */
export const TABLE = {
  width: 1.0,
  depth: 0.5,
  topY: 0.75,
  thickness: 0.04,         // grosor visual del tablero
  colliderThickness: 0.12, // el colisionador es más grueso hacia abajo para evitar "túneles"
  legSize: 0.05,
  spawnMargin: 0.08,       // distancia mínima del centro de una pieza al borde de la mesa
  minSpacing: 0.14,        // distancia mínima entre centros de piezas al generar
};
export const TABLES = [
  { id: 'mesa-1', label: 'MESA 1', x: -1.1, z: -0.35, rotY: Math.PI / 2 },
  { id: 'mesa-2', label: 'MESA 2', x: -0.55, z: -1.25, rotY: 0 },
  { id: 'mesa-3', label: 'MESA 3', x: 0.55, z: -1.25, rotY: 0 },
  { id: 'mesa-4', label: 'MESA 4', x: 1.1, z: -0.35, rotY: -Math.PI / 2 },
];

/** Cuatro botes abiertos, uno por categoría (mismo orden que CATEGORIES). */
export const BIN = {
  z: -0.55,
  xs: [-0.54, -0.18, 0.18, 0.54],
  baseTopY: 0.55,          // altura del fondo interior
  innerSize: 0.26,         // lado interior útil (26 × 26 cm)
  wallHeight: 0.2,         // borde superior a 0.75 m, igual que las mesas
  wallThickness: 0.03,
  baseThickness: 0.03,     // grosor visual del fondo
  baseColliderThickness: 0.08,
  pedestalSize: 0.12,
};

export const PHYSICS = {
  gravity: -9.81,
  fixedStep: 1 / 60,       // paso fijo de simulación
  substeps: 2,             // cada paso de 1/60 s se divide en 2 subpasos de 1/120 s (menos penetración)
  maxStepsPerFrame: 4,     // si un frame tarda mucho no se intenta "alcanzar" todo el tiempo perdido
  maxFrameDt: 0.1,
  solverIterations: 12,
  pieceStatic: { friction: 0.5, restitution: 0.25 },
  piecePiece: { friction: 0.4, restitution: 0.2 },
  linearDamping: 0.05,
  angularDamping: 0.3,     // también hace de "fricción de rodadura" (cannon-es no la modela)
  sleepSpeedLimit: 0.05,
  sleepTimeLimit: 0.6,
  // Sujeción cinemática
  maxHeldSpeed: 4,         // m/s: la pieza sujeta nunca se desplaza más rápido (sin saltos)
  maxHeldAngular: 20,      // rad/s
  maxReleaseSpeed: 3,      // m/s: velocidad máxima al soltar
  maxReleaseAngular: 10,   // rad/s
  releaseWindow: 0.1,      // s de historial para estimar la velocidad de lanzamiento
};

/** Volumen permitido para la pieza sujeta (se recorta el objetivo de la mano). */
export const WORK_BOUNDS = { min: [-1.9, 0.05, -2.0], max: [1.9, 2.1, 0.9] };

export const RULES = {
  stableMs: 700,           // tiempo continuo en reposo dentro del bote para validar
  stableLinear: 0.06,      // m/s
  stableAngular: 0.9,      // rad/s
  insideMargin: 0.005,     // el centro debe quedar a > 5 mm de las paredes interiores
  rimMargin: 0.01,         // y al menos 1 cm por debajo del borde
  errorNoticeMs: 1500,     // duración del aviso rojo
  autoReturnWrongMs: 5000, // retorno controlado a la mesa tras un error (0 = desactivado)
  floorY: 0.3,             // por debajo de esta altura la pieza se considera en el suelo
  floorReturnMs: 4000,     // retorno automático de piezas en reposo en el suelo
  outOfBounds: { minY: -0.5, radius: 5 },
  flashMs: 900,
};

export const HUD = {
  position: [0, 1.66, -1.72],
  tiltX: 0,
  width: 1.15,
  canvas: [1024, 820],
  buttonY: 1.1,
};

export const RAY_LENGTH = 3;
export const SPAWN_LIFT = 0.004; // las piezas nacen 4 mm sobre la mesa y se asientan por gravedad
