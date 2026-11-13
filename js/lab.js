// Controlador del laboratorio: máquina de estados de piezas y reto.
// Las entradas (manos XR o ratón) SOLO llaman grab / drop / releaseToStart / setHover;
// toda decisión de negocio ocurre aquí.
import * as THREE from 'three';
import { LAB } from './config.js';
import { validateDrop } from './rules.js';
import { STATUS, PHASE, formatTime } from './state.js';

const C = { none: 0x000000, hover: 0xffffff, error: 0xff1a1a, ok: 0x22c55e };

export function createLabController({ store, pieces, targets, hud, sounds }) {
  const targetList = [...targets.values()];
  const hovers = new Map();      // fuente -> id de pieza apuntada
  const cancellers = new Set();  // funciones de las entradas para soltar sin validar
  const grabPositions = new Map();
  const tmp = new THREE.Vector3();
  const [minB, maxB] = [new THREE.Vector3(...LAB.dragBounds.min), new THREE.Vector3(...LAB.dragBounds.max)];

  function grab(id, holder, now = performance.now()) {
    const p = store.piece(id);
    if (!p || p.status !== STATUS.AVAILABLE) return false; // bloqueada, colocada o ya sujeta por otra mano
    store.setPiece(id, STATUS.SELECTED, holder);
    grabPositions.set(id, pieces.get(id).mesh.getWorldPosition(new THREE.Vector3()));
    store.startTimer(now);
    if (store.get().phase === PHASE.PENDING) store.setPhase(PHASE.ACTIVE, 'Lleva la pieza a su destino');
    return true;
  }

  function isHeld(id) {
    const s = store.piece(id)?.status;
    return s === STATUS.SELECTED || s === STATUS.MOVING;
  }

  function drop(id, now = performance.now()) {
    if (!isHeld(id)) return;
    const piece = pieces.get(id);
    piece.mesh.position.clamp(minB, maxB); // limita el área de trabajo
    const result = validateDrop(piece.mesh.position, piece.config.target, targetList, LAB.snapTolerance);
    if (result.ok) place(piece, now);
    else reject(piece, result, now);
  }

  function place(piece, now) {
    const target = targets.get(piece.config.target);
    piece.mesh.position.copy(target.position); // snap-to-target
    piece.mesh.quaternion.copy(target.quaternion);
    store.setPiece(piece.config.id, STATUS.PLACED, null);
    const n = store.placedCount();
    if (n === store.total) {
      store.stopTimer(now);
      store.setPhase(PHASE.DONE, `¡Completado! Tiempo final ${formatTime(store.elapsedMs(now))}`);
      sounds.finish();
    } else {
      store.setPhase(PHASE.ACTIVE, `¡Correcto! ${piece.config.label} ensamblado (${n}/${store.total})`);
      sounds.success();
    }
  }

  function reject(piece, result, now) {
    const until = now + LAB.feedbackMs;
    piece.flashUntil = until;
    let msg;
    if (result.reason === 'destino') {
      const t = targets.get(result.nearestId);
      t.flashUntil = until;
      msg = `Error: ${piece.config.label} no va en el destino ${t.label}`;
    } else {
      msg = `Error: muy lejos del destino (${(result.distance * 100).toFixed(0)} cm > ${(LAB.snapTolerance * 100).toFixed(0)} cm)`;
    }
    resetTransform(piece);
    store.setPiece(piece.config.id, STATUS.AVAILABLE, null);
    store.setPhase(PHASE.ERROR, msg, until);
    sounds.error();
  }

  /** Pérdida de tracking / cancelación: devuelve la pieza sin validar ni sumar. */
  function releaseToStart(id) {
    if (!isHeld(id)) return;
    resetTransform(pieces.get(id));
    store.setPiece(id, STATUS.AVAILABLE, null);
    store.setPhase(PHASE.ACTIVE, 'Seguimiento perdido: la pieza volvió a su lugar');
  }

  function resetTransform(piece) {
    piece.mesh.position.copy(piece.startPosition);
    piece.mesh.quaternion.copy(piece.startQuaternion);
  }

  function reset() {
    for (const cancel of cancellers) cancel(); // suelta selecciones activas primero
    for (const p of pieces.values()) { resetTransform(p); p.flashUntil = 0; }
    for (const t of targets.values()) t.flashUntil = 0;
    hovers.clear();
    grabPositions.clear();
    store.reset();
    sounds.click();
  }

  function setHover(source, id) {
    if (id) hovers.set(source, id); else hovers.delete(source);
  }

  function updateMovingStatus() {
    for (const [id, start] of grabPositions) {
      const p = store.piece(id);
      if (p.status !== STATUS.SELECTED) { if (p.status !== STATUS.MOVING) grabPositions.delete(id); continue; }
      if (pieces.get(id).mesh.getWorldPosition(tmp).distanceTo(start) > 0.01) store.setPiece(id, STATUS.MOVING, p.holder);
    }
  }

  function applyVisuals(now) {
    const hovered = new Set(hovers.values());
    for (const p of pieces.values()) {
      const st = store.piece(p.config.id).status;
      let color = C.none;
      let intensity = 0;
      if (st === STATUS.PLACED) { color = C.ok; intensity = 0.6; }
      else if (p.flashUntil > now) { color = C.error; intensity = 0.9; }
      else if (st === STATUS.SELECTED || st === STATUS.MOVING) { color = C.hover; intensity = 0.25; }
      else if (hovered.has(p.config.id)) { color = C.hover; intensity = 0.4; }
      p.material.emissive.setHex(color);
      p.material.emissiveIntensity = intensity;
    }
    for (const t of targets.values()) {
      const placed = store.piece(t.pieceId).status === STATUS.PLACED;
      t.pad.material.color.setHex(placed ? C.ok : t.flashUntil > now ? C.error : t.baseColor);
      t.ghost.visible = !placed;
    }
  }

  function tick(now) {
    store.tick(now);
    updateMovingStatus();
    applyVisuals(now);
    const s = store.get();
    const { hands, controllers, xrActive } = store.session;
    let handsText = 'Manos: (vista previa de escritorio)';
    let handsOk = true;
    if (xrActive) {
      handsOk = hands.left || hands.right;
      handsText = `Mano izq: ${hands.left ? 'detectada' : 'no detectada'} · Mano der: ${hands.right ? 'detectada' : 'no detectada'}`;
      if (controllers) handsText += ' · deja los controles';
    }
    hud.update({
      placed: store.placedCount(),
      total: store.total,
      time: formatTime(store.elapsedMs(now)),
      phase: s.phase,
      message: s.message,
      handsText,
      handsOk,
    });
  }

  /** Objetos que el rayo puede seleccionar: botones + piezas disponibles (nunca piso/mesa). */
  function selectables() {
    const list = [...hud.buttons];
    for (const p of pieces.values()) if (store.piece(p.config.id).status === STATUS.AVAILABLE) list.push(p.mesh);
    return list;
  }

  return {
    grab, drop, releaseToStart, reset, setHover, tick, selectables,
    registerCanceller: (fn) => cancellers.add(fn),
    pieceMesh: (id) => pieces.get(id)?.mesh,
  };
}

/** Prioridad: si el rayo toca un botón, gana el botón; si no, la pieza más cercana. */
export function pickHit(hits) {
  if (!hits.length) return null;
  return hits.find((h) => h.object.userData.kind === 'button') ?? hits[0];
}
