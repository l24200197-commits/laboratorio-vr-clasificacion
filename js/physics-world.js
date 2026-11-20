// Mundo físico (cannon-es): gravedad, materiales de contacto, paso fijo con acumulador
// e interpolación para sincronizar los cuerpos rígidos con las mallas de Three.js.
//
// ¿Por qué paso fijo? El visor dibuja a 72/90/120 Hz y los frames no duran siempre lo mismo.
// Si la física avanzara con el delta variable del frame, las colisiones cambiarían según la
// velocidad del equipo. Con un acumulador avanzamos SIEMPRE en pasos de 1/60 s (cada uno con
// 4 subpasos de 1/240 s) y la malla se dibuja interpolando entre los dos últimos estados.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PHYSICS } from './config.js';

const _q = new THREE.Quaternion();

/** Grupos de colisión: los estáticos chocan con piezas; las piezas con todo. */
export const GROUP = Object.freeze({ STATIC: 1, PIECE: 2 });

export function createPhysics() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, PHYSICS.gravity, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true; // cuerpos en reposo se "duermen": menos cálculo y sin temblores
  world.solver.iterations = PHYSICS.solverIterations;

  const materials = {
    static: new CANNON.Material('estatico'),
    piece: new CANNON.Material('pieza'),
  };
  world.addContactMaterial(new CANNON.ContactMaterial(materials.piece, materials.static, PHYSICS.pieceStatic));
  world.addContactMaterial(new CANNON.ContactMaterial(materials.piece, materials.piece, PHYSICS.piecePiece));

  const tracked = []; // { body, mesh, prevPos, prevQuat }
  const stepHooks = []; // funciones que se ejecutan antes de cada paso fijo (sujeción cinemática)
  let accumulator = 0;
  let stepsTotal = 0;

  /** Crea un cuerpo ESTÁTICO (masa 0) con varias formas desplazadas. */
  function addStatic(parts, { position = [0, 0, 0], rotY = 0, name = 'estatico' } = {}) {
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      mass: 0,
      material: materials.static,
      collisionFilterGroup: GROUP.STATIC,
      collisionFilterMask: GROUP.PIECE,
    });
    for (const { halfExtents, offset = [0, 0, 0] } of parts) {
      body.addShape(new CANNON.Box(new CANNON.Vec3(...halfExtents)), new CANNON.Vec3(...offset));
    }
    body.position.set(...position);
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
    body.userData = { name };
    world.addBody(body);
    return body;
  }

  /** Relaciona un cuerpo dinámico con su malla para sincronizarlos cada frame. */
  function track(body, mesh) {
    tracked.push({ body, mesh, prevPos: body.position.clone(), prevQuat: body.quaternion.clone() });
  }

  /** Tras mover un cuerpo "a mano" (reinicio/recuperación) se evita interpolar desde la pose vieja. */
  function snap(body) {
    const t = tracked.find((x) => x.body === body);
    if (!t) return;
    t.prevPos.copy(body.position);
    t.prevQuat.copy(body.quaternion);
    sync(t, 1);
  }

  function sync(t, alpha) {
    const { body, mesh, prevPos, prevQuat } = t;
    mesh.position.set(
      prevPos.x + (body.position.x - prevPos.x) * alpha,
      prevPos.y + (body.position.y - prevPos.y) * alpha,
      prevPos.z + (body.position.z - prevPos.z) * alpha,
    );
    mesh.quaternion.set(prevQuat.x, prevQuat.y, prevQuat.z, prevQuat.w);
    _q.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
    mesh.quaternion.slerp(_q, alpha);
  }

  /**
   * Avanza la simulación el tiempo real transcurrido usando pasos fijos.
   * @param {number} frameDt segundos desde el frame anterior
   * @returns {number} pasos fijos ejecutados en este frame
   */
  function step(frameDt) {
    const h = PHYSICS.fixedStep;
    accumulator += Math.min(Math.max(frameDt, 0), PHYSICS.maxFrameDt);
    let n = 0;
    while (accumulator >= h && n < PHYSICS.maxStepsPerFrame) {
      for (const t of tracked) { t.prevPos.copy(t.body.position); t.prevQuat.copy(t.body.quaternion); }
      const sub = h / PHYSICS.substeps;
      for (let i = 0; i < PHYSICS.substeps; i++) {
        // Los ganchos (sujeción) fijan velocidades ANTES de cada subpaso: así el solver de contactos
        // las corrige después y nada se mete dentro de mesas o botes.
        for (const hook of stepHooks) hook(sub);
        world.step(sub);
      }
      accumulator -= h;
      n++;
    }
    if (n === PHYSICS.maxStepsPerFrame && accumulator >= h) accumulator = 0; // descarta atraso
    const alpha = accumulator / h;
    for (const t of tracked) sync(t, alpha);
    stepsTotal += n;
    return n;
  }

  return {
    world,
    materials,
    addStatic,
    track,
    snap,
    step,
    onBeforeStep: (fn) => stepHooks.push(fn),
    get simTime() { return stepsTotal * PHYSICS.fixedStep; },
  };
}
