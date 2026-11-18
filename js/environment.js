// Ambiente del laboratorio: luces, piso (con colisionador) y paredes decorativas.
import * as THREE from 'three';

export function buildEnvironment(scene, physics) {
  scene.background = new THREE.Color(0x0d1526); // entorno virtual opaco (sin passthrough)

  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(1, 3, 1.5);
  scene.add(sun);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(4, 48),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'piso';
  scene.add(floor);

  // Cuadrícula sutil: da referencia de escala y hace visible el movimiento de las piezas en el suelo.
  const grid = new THREE.GridHelper(8, 32, 0x334155, 0x243044);
  grid.position.y = 0.001;
  scene.add(grid);

  // Anillo de la zona de trabajo (el usuario no necesita desplazarse fuera de él).
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.45, 48),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.003, 0.05);
  scene.add(ring);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x15233d });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(7, 3), wallMat);
  back.position.set(0, 1.5, -2.6);
  scene.add(back);

  // Piso físico: caja estática gruesa con la cara superior en y = 0.
  physics.addStatic([{ halfExtents: [5, 0.25, 5], offset: [0, -0.25, 0] }], { name: 'piso' });
}
