// AUTOPRUEBA (index.html?autoprueba): ejecuta el motor físico REAL y las reglas REALES con entradas
// SIMULADAS (un "holder" de prueba que usa la misma vía grab → setHoldTarget → release que las manos).
// Avanza el tiempo de forma acelerada y determinista (60 pasos = 1 s simulado).
// Sirve como evidencia de escritorio; NO prueba el seguimiento de manos del Meta Quest 3.
import { CATEGORIES, PIECES_PER_CATEGORY, PIECES_PER_TABLE, TABLE, MAX_SAME_CATEGORY_PER_TABLE } from './config.js';
import { STATE } from './pieces.js';

export async function runSelfTest({ physics, game, store, pieces, bins, tables }) {
  const out = [];
  let failed = 0;
  let now = 1_000_000;
  const H = 'prueba';
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const check = (name, ok, detail = '') => {
    if (!ok) failed++;
    out.push(`${ok ? 'PASA ' : 'FALLA'} · ${name}${detail ? ` — ${detail}` : ''}`);
  };
  const stepTimes = [];
  const sim = (seconds, onStep) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      const t0 = performance.now();
      physics.step(1 / 60);
      stepTimes.push(performance.now() - t0);
      now += 1000 / 60;
      onStep?.();
      game.update(now);
    }
  };
  const yieldUI = () => new Promise((r) => setTimeout(r, 0));
  const m = () => store.metrics(pieces);

  /** Lleva una pieza (sujeción cinemática) por una trayectoria y la suelta. */
  function carry(id, to, { inherit = false, seconds = 1.2 } = {}) {
    if (!game.grab(id, H)) return false;
    const b = pieces.get(id).body;
    const from = { x: b.position.x, y: b.position.y, z: b.position.z };
    const liftY = Math.max(from.y, to.y) + 0.25;
    const n = Math.round(seconds * 60);
    let k = 0;
    sim(seconds, () => {
      const u = Math.min(1, ++k / n);
      // sube, se desplaza y baja (como un usuario real)
      const p = u < 0.25
        ? { x: from.x, y: from.y + (liftY - from.y) * (u / 0.25), z: from.z }
        : u < 0.8
          ? { x: from.x + (to.x - from.x) * ((u - 0.25) / 0.55), y: liftY, z: from.z + (to.z - from.z) * ((u - 0.25) / 0.55) }
          : { x: to.x, y: liftY + (to.y - liftY) * ((u - 0.8) / 0.2), z: to.z };
      game.setHoldTarget(id, H, p, null);
    });
    return game.release(id, H, { inheritVelocity: inherit });
  }
  const binOf = (cat) => bins.get(cat);
  const SLOTS = [[-0.07, -0.07], [0.07, -0.07], [-0.07, 0.07], [0.07, 0.07], [0, 0]];
  const slotAbove = (bin, k) => ({ x: bin.cx + SLOTS[k % 5][0], y: bin.rimY + 0.1, z: bin.cz + SLOTS[k % 5][1] });
  const restingOnTables = () => [...pieces.values()].filter((r) => {
    const t = tables.find((tb) => tb.holds(r.body.position));
    return t && Math.abs(r.body.position.y - (t.topY + r.kit.restHeight)) < 0.012;
  }).length;

  // 1-2. Estructura y distribución inicial
  const layout = game.layout;
  check('4 mesas', tables.length === 4);
  check('20 piezas, 5 por categoría', pieces.size === 20
    && CATEGORIES.every((c) => [...pieces.values()].filter((p) => p.category === c.id).length === PIECES_PER_CATEGORY));
  const perTable = tables.map((t) => layout.filter((l) => l.tableId === t.id));
  check('5 piezas por mesa', perTable.every((g) => g.length === PIECES_PER_TABLE), perTable.map((g) => g.length).join(','));
  check(`categorías mezcladas (≤${MAX_SAME_CATEGORY_PER_TABLE} iguales por mesa)`, perTable.every((g) => {
    const c = {}; g.forEach((l) => { const k = pieces.get(l.pieceId).category; c[k] = (c[k] ?? 0) + 1; });
    return Math.max(...Object.values(c)) <= MAX_SAME_CATEGORY_PER_TABLE;
  }));
  const minGap = Math.min(...perTable.flatMap((g) => g.flatMap((a, i) => g.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.z - b.z)))));
  check('sin superposición al generar', minGap >= TABLE.minSpacing, `separación mínima ${minGap.toFixed(3)} m`);

  // 3. Asentamiento por gravedad
  sim(2.5);
  const rest = restingOnTables();
  check('las 20 piezas se asientan sobre las mesas (ni flotan ni caen)', rest === 20, `${rest}/20 en reposo sobre mesa`);
  await yieldUI();

  // 4. No se puede tomar antes de «Jugar»; el mismo botón pausa y reanuda
  check('no se toma ninguna pieza antes de Jugar', game.grab([...pieces.keys()][0], H) === false);
  game.toggle(now);
  check('Jugar inicia la partida', store.get().phase === 'en curso');
  game.toggle(now);
  check('Pausa detiene la partida', store.get().phase === 'en pausa');
  game.toggle(now);
  check('Seguir la reanuda', store.get().phase === 'en curso');

  // 5. Anti-atravesamiento con la pieza sujeta
  const tId = [...pieces.keys()].find((id) => pieces.get(id).category === 'cubo');
  const tRec = pieces.get(tId);
  const tTable = tableById.get(tRec.originTable);
  game.grab(tId, H);
  const p0 = tRec.body.position.clone();
  sim(0.6, () => game.setHoldTarget(tId, H, { x: p0.x, y: tTable.topY - 0.2, z: p0.z }, null));
  const lowest = tRec.body.position.y;
  check('pieza sujeta no atraviesa el tablero', lowest > tTable.topY, `centro a ${(lowest - tTable.topY).toFixed(3)} m sobre la mesa`);
  game.release(tId, H, { inheritVelocity: false });
  sim(1);
  check('al soltarla recupera la física dinámica', tRec.body.type === 1 && tRec.state !== STATE.HELD, `tipo=${tRec.body.type}`);

  const wallBin = binOf('esfera');
  game.grab(tId, H);
  // Se llega por ARRIBA al lado izquierdo del bote (sin cruzar los demás), se baja por debajo del
  // borde y después se empuja la pieza hacia el centro: la pared debe detenerla.
  sim(0.8, () => game.setHoldTarget(tId, H, { x: wallBin.cx - 0.4, y: 1.1, z: wallBin.cz }, null));
  sim(0.6, () => game.setHoldTarget(tId, H, { x: wallBin.cx - 0.4, y: 0.68, z: wallBin.cz }, null));
  sim(0.8, () => game.setHoldTarget(tId, H, { x: wallBin.cx, y: 0.68, z: wallBin.cz }, null));
  const px = tRec.body.position.x;
  check('pieza sujeta no atraviesa la pared del bote', px < wallBin.cx - wallBin.half, `x=${px.toFixed(3)}, pared interior en ${(wallBin.cx - wallBin.half).toFixed(3)}`);
  game.release(tId, H, { inheritVelocity: false });
  sim(2);
  await yieldUI();

  // 6. Acierto: una esfera en su bote
  const filled = new Map(CATEGORIES.map((c) => [c.id, 0]));
  const sphereId = [...pieces.keys()].find((id) => pieces.get(id).category === 'esfera');
  carry(sphereId, slotAbove(binOf('esfera'), filled.get('esfera')));
  filled.set('esfera', 1);
  let bounced = false;
  sim(2.5);
  check('esfera soltada en su bote ⇒ clasificada', pieces.get(sphereId).state === STATE.CLASSIFIED, pieces.get(sphereId).state);
  check('acierto contado una vez (1/20, esfera 1/5)', m().hits === 1 && m().perCategory.get('esfera') === 1);
  sim(3);
  check('sin doble conteo tras 3 s más en el bote', m().hits === 1 && m().attempts === 1);
  check('pieza clasificada ya no es seleccionable', !game.selectables().includes(pieces.get(sphereId).mesh));

  // 7. Tres errores
  const wrong = [['cubo', 'esfera'], ['piramide', 'cubo'], ['hexagonal', 'piramide']];
  const wrongIds = [];
  for (const [cat, binCat] of wrong) {
    const id = [...pieces.keys()].find((k) => pieces.get(k).category === cat && !wrongIds.includes(k) && pieces.get(k).state === STATE.AVAILABLE);
    wrongIds.push(id);
    carry(id, slotAbove(binOf(binCat), 4));
    sim(2);
  }
  check('3 depósitos erróneos ⇒ 3 errores', m().errors === 3, `errores=${m().errors}`);
  check('los errores no suman aciertos', m().hits === 1);
  sim(1);
  check('cada error se registra una sola vez', m().errors === 3);
  sim(4);
  const back = wrongIds.filter((id) => pieces.get(id).state === STATE.AVAILABLE || pieces.get(id).state === STATE.FLYING);
  check('retorno controlado de las piezas erróneas a una mesa', back.length === 3, back.length + '/3');
  sim(1.5);
  check('errores sin cambio tras el retorno', m().errors === 3 && m().attempts === 4, `intentos=${m().attempts}`);
  await yieldUI();

  // 8. Caída al suelo, rebote y recuperación
  const floorId = [...pieces.keys()].find((k) => pieces.get(k).category === 'cubo' && pieces.get(k).state === STATE.AVAILABLE);
  const fRec = pieces.get(floorId);
  carry(floorId, { x: 0, y: 0.9, z: 0.35 });
  let minY = Infinity;
  let vyUp = 0;
  sim(1.5, () => { minY = Math.min(minY, fRec.body.position.y); if (minY < 0.1) vyUp = Math.max(vyUp, fRec.body.velocity.y); });
  bounced = vyUp > 0.05;
  check('cae por gravedad hasta el suelo', minY < 0.06, `y mínima ${minY.toFixed(3)} m`);
  check('rebota (restitución) al tocar el suelo', bounced, `vy máx. tras impacto ${vyUp.toFixed(2)} m/s`);
  sim(1);
  check('pieza en el suelo ⇒ recuperable', fRec.state === STATE.RECOVERABLE, fRec.state);
  sim(4.5);
  check('se recupera automáticamente a una mesa', fRec.state === STATE.AVAILABLE && fRec.body.position.y > 0.7, `${fRec.state}, y=${fRec.body.position.y.toFixed(2)}`);
  sim(1);
  await yieldUI();

  // 9. Completar las 20 piezas
  for (const cat of CATEGORIES) {
    for (const r of [...pieces.values()].filter((p) => p.category === cat.id)) {
      if (r.state === STATE.CLASSIFIED) continue;
      carry(r.id, slotAbove(binOf(cat.id), filled.get(cat.id)));
      filled.set(cat.id, filled.get(cat.id) + 1);
      sim(1.8);
    }
    await yieldUI();
  }
  sim(1);
  const mm = m();
  const s = store.get();
  check('total 20/20', mm.hits === 20, `${mm.hits}/20`);
  check('cada bote 5/5', CATEGORIES.every((c) => mm.perCategory.get(c.id) === 5), CATEGORIES.map((c) => `${c.id}:${mm.perCategory.get(c.id)}`).join(' '));
  check('estado final «completado»', s.phase === 'completado');
  const times = CATEGORIES.map((c) => s.binTimes.get(c.id));
  check('4 tiempos de llenado registrados y ≤ tiempo global', times.every((t) => t !== null && t <= s.finalMs),
    times.map((t) => `${(t / 1000).toFixed(1)}s`).join(', ') + ` · global ${(s.finalMs / 1000).toFixed(1)}s`);
  check('precisión = 20/23 × 100', Math.abs(mm.precision - (20 / 23) * 100) < 1e-9, `${mm.precision.toFixed(2)} % (errores ${mm.errors}, intentos ${mm.attempts})`);
  const frozen = store.elapsed(now);
  sim(2);
  check('el cronómetro se detiene en 20/20', store.elapsed(now) === frozen);
  const inside = [...pieces.values()].every((r) => {
    const b = bins.get(r.category);
    return Math.abs(r.body.position.x - b.cx) < b.half && Math.abs(r.body.position.z - b.cz) < b.half && r.body.position.y > b.baseY && r.body.position.y < b.rimY;
  });
  check('las 20 piezas permanecen visibles dentro de su bote', inside);
  await yieldUI();

  // 10. Reinicio
  const sig = game.signature;
  game.reset();
  check('reinicio genera otra distribución', game.signature !== sig);
  check('reinicio restablece marcador y cronómetro', m().hits === 0 && m().errors === 0 && store.get().phase === 'listo'
    && store.elapsed(now) === 0 && [...store.get().binTimes.values()].every((t) => t === null));
  sim(2.5);
  check('tras reiniciar, 20 piezas en reposo sobre las mesas', restingOnTables() === 20, `${restingOnTables()}/20`);

  // Rendimiento de la física (CPU de esta computadora, no del visor)
  stepTimes.sort((a, b) => a - b);
  const avg = stepTimes.reduce((a, b) => a + b, 0) / stepTimes.length;
  out.push(`INFO  · paso físico (4 subpasos) en este equipo: media ${avg.toFixed(2)} ms, p95 ${stepTimes[Math.floor(stepTimes.length * 0.95)].toFixed(2)} ms, ${stepTimes.length} pasos`);

  const summary = failed === 0 ? `AUTOPRUEBA OK (${out.length - 1} comprobaciones)` : `AUTOPRUEBA CON ${failed} FALLO(S)`;
  out.unshift(summary);
  const pre = document.createElement('pre');
  pre.id = 'autoprueba';
  pre.className = 'container small p-3 border rounded';
  pre.dataset.result = failed === 0 ? 'ok' : 'fail';
  pre.textContent = out.join('\n');
  document.querySelector('main')?.prepend(pre);
  document.title = summary;
  console.log(out.join('\n'));
  return { failed, lines: out };
}
