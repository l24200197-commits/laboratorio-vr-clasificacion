// Sujeción física de piezas (aproximación técnica, documentada):
//
// 1. Al TOMAR: el cuerpo SIGUE SIENDO DINÁMICO. (Antes pasaba a CINEMÁTICO, pero cannon-es no
//    resuelve contactos cinemático–estático: las esquinas de la pieza atravesaban mesas y botes, y
//    al tener masa "infinita" aplastaba a otras piezas contra el tablero.)
// 2. Mientras está SUJETO: la entrada (mano o ratón) solo fija una pose OBJETIVO. Antes de CADA
//    subpaso se aplica una FUERZA de resorte-amortiguador (limitada) hacia el objetivo, que además
//    anula la gravedad y usa la velocidad de la mano para no quedarse atrás. El solver de contactos
//    actúa después, así que la forma COMPLETA (no solo su centro) choca con mesas, paredes y piezas.
//    Nunca se escribe mesh.position: la malla sigue al cuerpo.
// 3. El objetivo además se recorta con un rayo contra mesas, botes y piso, para que la mano no
//    "tire" de la pieza hacia el interior de una superficie (evita empujes y temblores).
// 4. Al SOLTAR: se quita la compensación de gravedad y se le da la velocidad media de los últimos
//    0.1 s, limitada para evitar lanzamientos explosivos; desde ahí solo actúan gravedad y colisiones.
import * as CANNON from 'cannon-es';
import { PHYSICS, WORK_BOUNDS } from './config.js';
import { GROUP } from './physics-world.js';

export function createHoldController(physics) {
  const holds = new Map(); // pieceId -> { record, target, targetQuat, history }
  const rayResult = new CANNON.RaycastResult();
  const rayOpts = { collisionFilterMask: GROUP.STATIC, skipBackfaces: true };
  const from = new CANNON.Vec3();
  const to = new CANNON.Vec3();
  const tmp = new CANNON.Vec3();
  const acc = new CANNON.Vec3();
  const qInv = new CANNON.Quaternion();
  const dq = new CANNON.Quaternion();
  const [bMin, bMax] = [WORK_BOUNDS.min, WORK_BOUNDS.max];
  let time = 0;

  physics.onBeforeStep(drive);

  function begin(record) {
    const b = record.body;
    b.type = CANNON.Body.DYNAMIC;
    b.allowSleep = false;
    b.velocity.setZero();
    b.angularVelocity.setZero();
    b.wakeUp();
    holds.set(record.id, {
      record,
      target: b.position.clone(),
      targetQuat: b.quaternion.clone(),
      targetVel: new CANNON.Vec3(), // velocidad de la mano (prealimentación: sin retraso al mover)
      targetAt: time,
      history: [{ t: time, p: b.position.clone() }],
    });
  }

  /** La entrada solo comunica a dónde DEBERÍA ir la pieza (objetos con x,y,z[,w]). */
  function setTarget(id, pos, quat) {
    const h = holds.get(id);
    if (!h) return;
    const dt = time - h.targetAt;
    if (dt > 1e-4) {
      h.targetVel.set((pos.x - h.target.x) / dt, (pos.y - h.target.y) / dt, (pos.z - h.target.z) / dt);
      limit(h.targetVel, PHYSICS.maxHeldSpeed);
      h.targetAt = time;
    }
    h.target.set(pos.x, pos.y, pos.z);
    if (quat) h.targetQuat.set(quat.x, quat.y, quat.z, quat.w);
  }

  /**
   * Resorte-amortiguador hacia la pose objetivo, aplicado como FUERZA antes de cada subpaso.
   * A diferencia de imponer la velocidad, una fuerza limitada nunca le gana al solver de contactos:
   * si la mano atraviesa una mesa, la pieza se queda apoyada encima en lugar de meterse.
   */
  function drive(h) {
    time += h;
    const { holdStiffness: w, holdMaxAccel, holdAngularStiffness: wr, holdMaxAngularAccel } = PHYSICS;
    for (const hold of holds.values()) {
      const { record } = hold;
      const b = record.body;
      if (time - hold.targetAt > 0.05) hold.targetVel.setZero(); // la mano dejó de moverse
      to.set(
        clamp(hold.target.x, bMin[0], bMax[0]),
        clamp(hold.target.y, bMin[1], bMax[1]),
        clamp(hold.target.z, bMin[2], bMax[2]),
      );
      preventTunneling(b.position, to, record.kit);

      // a = ω²·(objetivo − posición) + 2ω·(v_mano − v)   (amortiguamiento crítico)
      to.vsub(b.position, acc);
      acc.scale(w * w, acc);
      hold.targetVel.vsub(b.velocity, tmp);
      tmp.scale(2 * w, tmp);
      acc.vadd(tmp, acc);
      limit(acc, holdMaxAccel);
      acc.vsub(physics.world.gravity, acc); // + compensación de la gravedad
      acc.scale(b.mass, acc);
      b.force.vadd(acc, b.force);
      if (b.velocity.length() > PHYSICS.maxHeldSpeed) limit(b.velocity, PHYSICS.maxHeldSpeed);

      // Rotación: dq = objetivo · actual⁻¹ → eje-ángulo → par de torsión con el mismo esquema
      b.quaternion.conjugate(qInv);
      hold.targetQuat.mult(qInv, dq);
      if (dq.w < 0) { dq.x = -dq.x; dq.y = -dq.y; dq.z = -dq.z; dq.w = -dq.w; }
      const s = Math.hypot(dq.x, dq.y, dq.z);
      const angle = s > 1e-6 ? 2 * Math.atan2(s, dq.w) : 0;
      if (s > 1e-6) acc.set(dq.x / s, dq.y / s, dq.z / s).scale(angle * wr * wr, acc); else acc.setZero();
      b.angularVelocity.scale(-2 * wr, tmp);
      acc.vadd(tmp, acc);
      limit(acc, holdMaxAngularAccel);
      acc.scale((b.inertia.x + b.inertia.y + b.inertia.z) / 3, acc);
      b.torque.vadd(acc, b.torque);
      limit(b.angularVelocity, PHYSICS.maxHeldAngular);

      hold.history.push({ t: time - h, p: b.position.clone() });
      while (hold.history.length > 2 && hold.history[0].t < time - 0.3) hold.history.shift();
    }
  }

  function preventTunneling(current, target, kit) {
    const world = physics.world;
    // a) Barrido: del centro actual al objetivo
    from.copy(current);
    if (world.raycastClosest(from, target, rayOpts, rayResult)) {
      const { hitPointWorld: p, hitNormalWorld: n } = rayResult;
      target.set(p.x + n.x * kit.clearance, p.y + n.y * kit.clearance, p.z + n.z * kit.clearance);
    }
    // b) Sonda vertical: la base de la pieza no puede quedar por debajo de una superficie
    from.set(target.x, target.y + 0.05, target.z);
    tmp.set(target.x, target.y - kit.restHeight, target.z);
    if (world.raycastClosest(from, tmp, rayOpts, rayResult)) {
      target.y = Math.max(target.y, rayResult.hitPointWorld.y + kit.restHeight);
    }
  }

  /**
   * Suelta la pieza y la devuelve a la simulación dinámica.
   * @param {boolean} inheritVelocity false ⇒ cae desde el reposo (pérdida de tracking, reinicio)
   */
  function end(id, { inheritVelocity = true } = {}) {
    const hold = holds.get(id);
    if (!hold) return false;
    holds.delete(id);
    const b = hold.record.body;
    b.type = CANNON.Body.DYNAMIC;
    b.allowSleep = true;
    b.force.setZero(); // quita la fuerza de sujeción pendiente
    b.torque.setZero();
    if (inheritVelocity) {
      b.velocity.copy(estimateVelocity(hold, b.position));
      limit(b.velocity, PHYSICS.maxReleaseSpeed);
      limit(b.angularVelocity, PHYSICS.maxReleaseAngular);
    } else {
      b.velocity.setZero();
      b.angularVelocity.setZero();
    }
    b.wakeUp();
    return true;
  }

  function estimateVelocity(hold, currentPos) {
    const out = new CANNON.Vec3();
    const old = hold.history.find((s) => s.t >= time - PHYSICS.releaseWindow);
    if (!old || time - old.t < 1e-3) return out;
    currentPos.vsub(old.p, out);
    out.scale(1 / (time - old.t), out);
    return out;
  }

  return {
    begin,
    end,
    setTarget,
    isHeld: (id) => holds.has(id),
    heldIds: () => [...holds.keys()],
  };
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function limit(vec, max) {
  const len = vec.length();
  if (len > max) vec.scale(max / len, vec);
}
