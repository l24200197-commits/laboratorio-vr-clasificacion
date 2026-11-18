// Kits de figura: para cada tipo se generan JUNTAS la geometría visual (Three.js) y la forma de
// colisión (cannon-es) a partir de las MISMAS medidas, para que lo que se ve coincida con lo que choca.
//
// Malla visual  = triángulos que se dibujan (apariencia).
// Colisionador  = forma matemática simple que usa el motor físico para detectar contactos.
// Cuerpo rígido = masa + posición + velocidades + uno o más colisionadores.
//
// | Figura         | Colisionador                         | Precisión                               |
// |----------------|--------------------------------------|-----------------------------------------|
// | Esfera         | CANNON.Sphere                        | Exacta                                  |
// | Cubo           | CANNON.Box                           | Exacta                                  |
// | Pirámide       | ConvexPolyhedron de 5 vértices       | Exacta (la pirámide ya es convexa)      |
// | Prisma hexag.  | ConvexPolyhedron de 12 vértices      | Exacta (mismos vértices que la malla)   |
//
// En los ConvexPolyhedron el origen del cuerpo debe quedar DENTRO de la figura y cada cara debe
// listarse en sentido antihorario visto desde fuera; orientFaces() lo garantiza automáticamente.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { SHAPE_SIZES } from './config.js';

const kits = {
  sphere() {
    const { radius: r } = SHAPE_SIZES.sphere;
    return {
      geometry: new THREE.SphereGeometry(r, 24, 16),
      shape: new CANNON.Sphere(r),
      restHeight: r,  // distancia del centro a la superficie de apoyo
      clearance: r,   // radio aproximado usado para que la pieza sujeta no atraviese superficies
      flat: false,
    };
  },

  box() {
    const { size: s } = SHAPE_SIZES.box;
    return {
      geometry: new THREE.BoxGeometry(s, s, s),
      shape: new CANNON.Box(new CANNON.Vec3(s / 2, s / 2, s / 2)),
      restHeight: s / 2,
      clearance: s / 2,
      flat: true,
    };
  },

  pyramid() {
    // Pirámide de base cuadrada. El origen se coloca en el CENTROIDE (a 1/4 de la altura),
    // porque cannon-es asume que el centro de masa coincide con el origen del cuerpo.
    const { radius: r, height: h } = SHAPE_SIZES.pyramid;
    const geometry = new THREE.ConeGeometry(r, h, 4, 1).translate(0, h / 4, 0);
    const verts = [];
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2; // mismo ángulo que usa ConeGeometry (x = r·sin, z = r·cos)
      verts.push([r * Math.sin(a), -h / 4, r * Math.cos(a)]);
    }
    verts.push([0, (3 * h) / 4, 0]);
    const faces = [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]];
    return {
      geometry,
      shape: convex(verts, faces),
      restHeight: h / 4,
      clearance: 0.035,
      flat: true,
    };
  },

  hexPrism() {
    const { radius: r, height: h } = SHAPE_SIZES.hexPrism;
    const geometry = new THREE.CylinderGeometry(r, r, h, 6, 1);
    const verts = [];
    for (const y of [h / 2, -h / 2]) {
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        verts.push([r * Math.sin(a), y, r * Math.cos(a)]);
      }
    }
    const faces = [[0, 1, 2, 3, 4, 5], [6, 7, 8, 9, 10, 11]];
    for (let k = 0; k < 6; k++) {
      const n = (k + 1) % 6;
      faces.push([k, n, 6 + n, 6 + k]);
    }
    return {
      geometry,
      shape: convex(verts, faces),
      restHeight: h / 2,
      clearance: 0.04,
      flat: true,
    };
  },
};

/** Crea el kit visual + físico de una figura. */
export function createShapeKit(shapeName) {
  const make = kits[shapeName];
  if (!make) throw new Error(`Figura no soportada: ${shapeName}. Usa: ${Object.keys(kits).join(', ')}`);
  return make();
}

export const SUPPORTED_SHAPES = Object.keys(kits);

function convex(vertList, faces) {
  const vertices = vertList.map(([x, y, z]) => new CANNON.Vec3(x, y, z));
  return new CANNON.ConvexPolyhedron({ vertices, faces: orientFaces(vertices, faces) });
}

/** Invierte las caras cuya normal apunte hacia el interior (requisito de cannon-es). */
export function orientFaces(vertices, faces) {
  const ab = new CANNON.Vec3();
  const bc = new CANNON.Vec3();
  const n = new CANNON.Vec3();
  return faces.map((face) => {
    const [a, b, c] = face.map((i) => vertices[i]);
    b.vsub(a, ab);
    c.vsub(b, bc);
    ab.cross(bc, n);
    const centroid = new CANNON.Vec3();
    for (const i of face) centroid.vadd(vertices[i], centroid);
    centroid.scale(1 / face.length, centroid);
    return n.dot(centroid) < 0 ? [...face].reverse() : face;
  });
}
