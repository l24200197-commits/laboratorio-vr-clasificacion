// Sujeción física de piezas (aproximación técnica, documentada):
//
// 1. Al TOMAR: el cuerpo pasa de DINÁMICO a CINEMÁTICO. Un cuerpo cinemático no siente gravedad
//    ni lo empujan otros, pero SÍ empuja a las piezas dinámicas y tiene colisionador activo.
// 2. Mientras está SUJETO: la entrada (mano o ratón) solo fija una pose OBJETIVO. Antes de cada paso
//    fijo se calcula la velocidad lineal/angular necesaria para llegar a ese objetivo en 1/60 s
//    (limitada a maxHeldSpeed). Nunca se escribe mesh.position: la malla sigue al cuerpo.
// 3. Anti-atravesamiento: cannon-es NO resuelve contactos cinemático–estático, así que se lanza un
//    rayo (raycast físico) desde la posición actual hasta el objetivo contra mesas, botes y piso; si
//    choca, el objetivo se detiene antes de la superficie. Una segunda sonda vertical evita hundir
//    la pieza en el tablero o en el fondo de un bote.
// 4. Al SOLTAR: vuelve a DINÁMICO (misma masa) con la velocidad media de los últimos 0.1 s,
//    limitada para evitar lanzamientos explosivos; desde ahí solo actúan gravedad y colisiones.
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
  const qInv = new CANNON.Quaternion();
  const dq = new CANNON.Quaternion();
  const [bMin, bMax] = [WORK_BOUNDS.min, WORK_BOUNDS.max];
  let time = 0;

  physics.onBeforeStep(drive);

  function begin(record) {
    const b = record.body;
    b.type = CANNON.Body.KINEMATIC;
    b.allowSleep = false;
    b.velocity.setZero();
    b.angularVelocity.setZero();
    b.wakeUp();
    holds.set(record.id, {
      record,
      target: b.position.clone(),
      targetQuat: b.quaternion.clone(),
      history: [{ t: time, p: b.position.clone() }],
    });
  }

  /** La entrada solo comunica a dónde DEBERÍA ir la pieza (objetos con x,y,z[,w]). */
  function setTarget(id, pos, quat) {
    const h = holds.get(id);
    if (!h) return;
    h.target.set(pos.x, pos.y, pos.z);
    if (quat) h.targetQuat.set(quat.x, quat.y, quat.z, quat.w);
  }

  function drive(h) {
    time += h;
    for (const hold of holds.values()) {
      const { record } = hold;
      const b = record.body;
      to.set(
        clamp(hold.target.x, bMin[0], bMax[0]),
        clamp(hold.target.y, bMin[1], bMax[1]),
        clamp(hold.target.z, bMin[2], bMax[2]),
      );
      preventTunneling(b.position, to, record.kit);

      to.vsub(b.position, tmp);
      tmp.scale(1 / h, tmp);
      limit(tmp, PHYSICS.maxHeldSpeed);
      b.velocity.copy(tmp);

      // Rotación: dq = objetivo · actual⁻¹ → eje-ángulo → velocidad angular
      b.quaternion.conjugate(qInv);
      hold.targetQuat.mult(qInv, dq);
      if (dq.w < 0) { dq.x = -dq.x; dq.y = -dq.y; dq.z = -dq.z; dq.w = -dq.w; }
      const s = Math.hypot(dq.x, dq.y, dq.z);
      if (s > 1e-6) {
        const angle = 2 * Math.atan2(s, dq.w);
        b.angularVelocity.set(dq.x / s, dq.y / s, dq.z / s);
        b.angularVelocity.scale(angle / h, b.angularVelocity);
        limit(b.angularVelocity, PHYSICS.maxHeldAngular);
      } else {
        b.angularVelocity.setZero();
      }

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
