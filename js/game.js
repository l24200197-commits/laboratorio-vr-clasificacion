// Controlador del laboratorio. Las entradas (manos XR, ratón, autoprueba) SOLO llaman
// grab / setHoldTarget / release y los botones; toda decisión de reglas ocurre aquí.
//
// Cómo se evita contar dos veces:
//  1. Un ACIERTO cambia la pieza a 'clasificada', estado terminal: deja de validarse, deja de ser
//     seleccionable y su cuerpo se congela en reposo dentro del bote (sigue siendo colisionador).
//     Los aciertos no se suman en un contador: se CUENTAN las piezas 'clasificada'.
//  2. Cada intento tiene la bandera `judged`. Al confirmar un ERROR se marca judged = true y ya no
//     se vuelve a evaluar, aunque siga rebotando o tocando paredes. Solo se reinicia cuando la
//     pieza se vuelve a tomar o regresa a una mesa (= nuevo intento).
//  3. La confirmación exige reposo CONTINUO durante RULES.stableMs dentro del volumen útil: los
//     contactos repetidos o rebotes reinician el temporizador en lugar de generar eventos.
import * as CANNON from 'cannon-es';
import { CATEGORIES, PIECES_PER_CATEGORY, RULES, SPAWN_LIFT } from './config.js';
import { STATE } from './pieces.js';
import { PHASE } from './state.js';
import { binContaining, isSlow, judge, formatClock, formatSeconds } from './rules.js';
import { generateLayout, layoutSignature, findFreeSpot } from './spawner.js';

const COLOR = { hover: 0xffffff, held: 0x9ad8ff, ok: 0x22c55e, error: 0xff1a1a, recover: 0xff9f1a, settling: 0x38bdf8 };
const Y_AXIS = new CANNON.Vec3(0, 1, 0);

export function createGame({ physics, store, pieces, bins, tables, holds, hud, sounds, rng = Math.random }) {
  const binList = [...bins.values()];
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const hovers = new Map();     // fuente de entrada -> id de pieza apuntada
  const cancellers = new Set(); // limpian el estado local de cada entrada
  const total = pieces.size;
  let lastSignature = '';
  let lastLayout = [];

  // ---------------------------------------------------------------- distribución
  function newLayout() {
    const infos = [...pieces.values()].map((p) => ({ id: p.id, category: p.category }));
    let layout;
    for (let i = 0; i < 10; i++) {
      layout = generateLayout(infos, tables.map((t) => t.id), rng);
      if (layoutSignature(layout) !== lastSignature) break;
    }
    lastSignature = layoutSignature(layout);
    lastLayout = layout;
    for (const l of layout) {
      const r = pieces.get(l.pieceId);
      r.originTable = l.tableId;
      placeOnTable(r, tableById.get(l.tableId), l, l.yaw);
    }
  }

  function placeOnTable(r, table, spot, yaw) {
    if (holds.isHeld(r.id)) holds.end(r.id, { inheritVelocity: false });
    const p = table.toWorld(spot.x, spot.z);
    const b = r.body;
    b.type = CANNON.Body.DYNAMIC;
    b.allowSleep = true;
    b.position.set(p.x, p.y + r.kit.restHeight + SPAWN_LIFT, p.z);
    b.quaternion.setFromAxisAngle(Y_AXIS, yaw); // pirámides y prismas nacen apoyados en su base
    b.velocity.setZero();
    b.angularVelocity.setZero();
    b.wakeUp();
    physics.snap(b);
    Object.assign(r, {
      state: STATE.AVAILABLE, holder: null, judged: false, stableBin: null,
      stableSince: 0, errorAt: 0, floorSince: 0, flashUntil: 0,
    });
  }

  /** Recuperación: devuelve la pieza a un hueco libre de su mesa de origen (o de otra). */
  function returnToTable(r, reason) {
    const order = [r.originTable, ...tables.map((t) => t.id).filter((id) => id !== r.originTable)];
    for (const id of order) {
      const table = tableById.get(id);
      const occupied = [];
      for (const o of pieces.values()) {
        if (o === r || o.state === STATE.HELD) continue;
        if (table.holds(o.body.position)) { const l = table.toLocal(o.body.position); occupied.push({ x: l.x, z: l.z }); }
      }
      const spot = findFreeSpot(occupied, rng);
      if (!spot) continue;
      placeOnTable(r, table, spot, rng() * Math.PI * 2);
      r.originTable = id;
      store.setMessage(`${r.label} devuelta a ${table.label} (${reason})`, 'info');
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- partida
  function start(now) {
    const phase = store.get().phase;
    if (phase === PHASE.READY || phase === PHASE.PAUSED) {
      store.start(now);
      store.setMessage(phase === PHASE.READY ? '¡Adelante! Toma una figura y llévala a su bote' : 'Partida reanudada', 'info');
      sounds.click();
    }
  }

  function pause(now, reason) {
    if (store.get().phase !== PHASE.RUNNING) return;
    releaseAll();
    store.pause(now);
    store.setMessage(`${reason} · pulsa «Continuar»`, 'info');
  }

  function reset() {
    for (const c of cancellers) c();
    for (const id of holds.heldIds()) holds.end(id, { inheritVelocity: false });
    hovers.clear();
    store.reset();
    newLayout();
    for (const b of binList) { b.setCount(0); b.flashUntil = 0; }
    store.setMessage('Nueva distribución lista. Pulsa «Comenzar»', 'info');
    sounds.click();
  }

  /** Devuelve a las mesas todas las piezas en error, en el suelo o recuperables. */
  function recover() {
    let n = 0;
    for (const r of pieces.values()) {
      if (r.state === STATE.ERROR || r.state === STATE.RECOVERABLE || (r.judged && r.state !== STATE.CLASSIFIED)) {
        if (returnToTable(r, 'botón Recuperar')) n++;
      }
    }
    store.setMessage(n ? `${n} pieza(s) devueltas a las mesas` : 'No hay piezas que recuperar', 'info');
    sounds.click();
  }

  function finish(now) {
    store.finish(now);
    const m = store.metrics(pieces);
    store.setMessage(
      `¡Completado ${m.hits}/${total} en ${formatClock(store.get().finalMs)} · precisión ${m.precision.toFixed(1)} % · ${m.errors} error(es)`,
      'done',
    );
    sounds.finish();
  }

  // ---------------------------------------------------------------- manipulación
  function canGrab(r) {
    return r && store.get().phase === PHASE.RUNNING && r.state !== STATE.CLASSIFIED && r.state !== STATE.HELD;
  }

  function grab(id, holder) {
    const r = pieces.get(id);
    const phase = store.get().phase;
    if (phase !== PHASE.RUNNING) {
      store.setMessage(phase === PHASE.DONE ? 'Partida terminada: pulsa «Reiniciar»' : 'Pulsa «Comenzar» / «Continuar» primero', 'info');
      return false;
    }
    if (!canGrab(r)) return false; // clasificada o ya sujeta por la otra mano
    holds.begin(r);
    Object.assign(r, { state: STATE.HELD, holder, judged: false, stableBin: null, floorSince: 0 });
    hovers.delete(holder);
    return true;
  }

  function setHoldTarget(id, holder, pos, quat) {
    const r = pieces.get(id);
    if (r?.state === STATE.HELD && r.holder === holder) holds.setTarget(id, pos, quat);
  }

  function release(id, holder, { inheritVelocity = true } = {}) {
    const r = pieces.get(id);
    if (!r || r.state !== STATE.HELD || r.holder !== holder) return false;
    holds.end(id, { inheritVelocity });
    Object.assign(r, { state: STATE.FLYING, holder: null, judged: false });
    return true;
  }

  /** Suelta todo sin velocidad (pérdida de tracking, recentrado, pausa, salida de VR). */
  function releaseAll() {
    for (const c of cancellers) c();
    for (const r of pieces.values()) if (r.state === STATE.HELD) release(r.id, r.holder, { inheritVelocity: false });
  }

  // ---------------------------------------------------------------- validación física
  function outOfBounds(p) {
    return !Number.isFinite(p.x + p.y + p.z) || p.y < RULES.outOfBounds.minY || Math.hypot(p.x, p.z) > RULES.outOfBounds.radius;
  }

  function validate(now) {
    for (const r of pieces.values()) {
      if (r.state === STATE.CLASSIFIED || r.state === STATE.HELD) continue;
      const b = r.body;
      const pos = b.position;
      if (outOfBounds(pos)) { returnToTable(r, 'fuera de límites'); continue; }

      if (r.judged) { // error ya registrado: solo aviso y retorno controlado
        if (r.state === STATE.ERROR && now - r.errorAt >= RULES.errorNoticeMs) r.state = STATE.RECOVERABLE;
        if (RULES.autoReturnWrongMs > 0 && now - r.errorAt >= RULES.autoReturnWrongMs) returnToTable(r, 'retorno tras error');
        continue;
      }

      const slow = isSlow(b.velocity.length(), b.angularVelocity.length(), b.sleepState === CANNON.Body.SLEEPING);
      const bin = binContaining(pos, binList);
      if (bin) {
        r.floorSince = 0;
        if (!slow) { r.stableBin = null; r.state = STATE.FLYING; continue; }
        if (r.stableBin !== bin) { r.stableBin = bin; r.stableSince = now; r.state = STATE.SETTLING; continue; }
        if (now - r.stableSince >= RULES.stableMs) confirm(r, bin, now);
        continue;
      }
      r.stableBin = null;
      if (!slow) { r.state = STATE.FLYING; r.floorSince = 0; continue; }
      if (pos.y < RULES.floorY) {
        r.state = STATE.RECOVERABLE;
        r.floorSince ||= now;
        if (now - r.floorSince >= RULES.floorReturnMs) returnToTable(r, 'pieza en el suelo');
      } else {
        r.state = STATE.AVAILABLE;
        r.floorSince = 0;
      }
    }
  }

  function confirm(r, bin, now) {
    r.judged = true;
    bin.flashUntil = now + RULES.flashMs;
    r.flashUntil = now + RULES.flashMs;
    if (judge(r.category, bin.category) === 'acierto') {
      r.state = STATE.CLASSIFIED;
      // Bloqueo: el cuerpo ya reposa dentro del bote; se congela para que ningún choque posterior
      // lo saque y desincronice el marcador. Sigue siendo sólido para las demás piezas.
      r.body.type = CANNON.Body.KINEMATIC;
      r.body.velocity.setZero();
      r.body.angularVelocity.setZero();
      bin.flashColor = COLOR.ok;
      const m = store.metrics(pieces);
      const n = m.perCategory.get(r.category);
      bin.setCount(n);
      if (n === PIECES_PER_CATEGORY) store.setBinTime(r.category, store.elapsed(now));
      if (m.hits === total) { finish(now); return; }
      store.setMessage(`¡Correcto! ${r.label} en su bote (${n}/5 · total ${m.hits}/${total})`, 'ok');
      sounds.success();
    } else {
      r.state = STATE.ERROR;
      r.errorAt = now;
      store.addError();
      bin.flashColor = COLOR.error;
      store.setMessage(`Error: ${r.label} no va en el bote ${bin.label}`, 'error');
      sounds.error();
    }
  }

  // ---------------------------------------------------------------- visual y HUD
  function applyVisuals(now) {
    const hovered = new Set(hovers.values());
    for (const r of pieces.values()) {
      let color = 0;
      let k = 0;
      switch (r.state) {
        case STATE.CLASSIFIED: color = COLOR.ok; k = r.flashUntil > now ? 0.8 : 0.35; break;
        case STATE.ERROR: color = COLOR.error; k = 0.5 + 0.4 * Math.sin(now / 70); break;
        case STATE.RECOVERABLE: color = COLOR.recover; k = 0.35; break;
        case STATE.HELD: color = COLOR.held; k = 0.35; break;
        case STATE.SETTLING: color = COLOR.settling; k = 0.2; break;
        default: if (hovered.has(r.id)) { color = COLOR.hover; k = 0.4; }
      }
      if (hovered.has(r.id) && r.state !== STATE.HELD && r.state !== STATE.CLASSIFIED) { color = COLOR.hover; k = 0.45; }
      r.material.emissive.setHex(color);
      r.material.emissiveIntensity = k;
    }
    for (const b of binList) b.rimMaterial.color.setHex(b.flashUntil > now ? b.flashColor : b.color);
  }

  function snapshot(now) {
    const s = store.get();
    const m = store.metrics(pieces);
    return {
      phase: s.phase,
      clock: formatClock(store.elapsed(now)),
      elapsedMs: store.elapsed(now),
      hits: m.hits,
      total,
      errors: m.errors,
      attempts: m.attempts,
      precision: m.precision,
      categories: CATEGORIES.map((c) => {
        const t = s.binTimes.get(c.id);
        return { id: c.id, label: c.label, color: c.color, n: m.perCategory.get(c.id), timeMs: t, time: t === null ? 'pendiente' : formatSeconds(t) };
      }),
      message: s.message,
      tone: s.tone,
      states: Object.fromEntries([...pieces.values()].map((r) => [r.id, r.state])),
    };
  }

  function update(now) {
    if (store.get().phase === PHASE.RUNNING) validate(now);
    else for (const r of pieces.values()) if (r.state !== STATE.CLASSIFIED && outOfBounds(r.body.position)) returnToTable(r, 'fuera de límites');
    applyVisuals(now);
    hud.update({ ...snapshot(now), ...handsInfo() });
  }

  function handsInfo() {
    const { hands, controllers, xrActive } = store.session;
    if (!xrActive) return { handsText: 'Vista previa de escritorio (NO inmersiva): sin seguimiento de manos', handsOk: true };
    let text = `Mano izq: ${hands.left ? 'detectada' : 'no detectada'} · Mano der: ${hands.right ? 'detectada' : 'no detectada'}`;
    if (controllers) text += ' · deja los controles';
    return { handsText: text, handsOk: hands.left || hands.right };
  }

  /** Objetos que el rayo puede seleccionar: botones + piezas tomables (nunca mesas, piso o botes). */
  function selectables() {
    const list = [...hud.buttons];
    if (store.get().phase === PHASE.RUNNING) for (const r of pieces.values()) if (canGrab(r)) list.push(r.mesh);
    return list;
  }

  newLayout();

  return {
    start, pause, reset, recover, grab, setHoldTarget, release, releaseAll, update, snapshot, selectables,
    setHover(source, id) { if (id) hovers.set(source, id); else hovers.delete(source); },
    registerCanceller: (fn) => cancellers.add(fn),
    get layout() { return lastLayout; },
    get signature() { return lastSignature; },
  };
}
