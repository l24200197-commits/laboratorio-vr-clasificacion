// Estado de la PARTIDA: fase, métricas y cronómetro. El estado de cada pieza vive en su registro
// (pieces.js); los aciertos se DERIVAN contando piezas 'clasificada', así no existe un contador
// paralelo que pueda desincronizarse o sumar dos veces.
import { CATEGORIES } from './config.js';
import { precision } from './rules.js';
import { STATE } from './pieces.js';

export const PHASE = Object.freeze({
  READY: 'listo',
  RUNNING: 'en curso',
  PAUSED: 'en pausa',
  DONE: 'completado',
});

export function createStore() {
  const fresh = () => ({
    phase: PHASE.READY,
    message: 'Pulsa «Comenzar» en el panel para iniciar',
    tone: 'info',          // info | ok | error | done
    errors: 0,             // intentos equivocados CONFIRMADOS (uno por intento)
    binTimes: new Map(CATEGORIES.map((c) => [c.id, null])), // ms desde el inicio hasta 5/5
    timer: { accumulated: 0, startedAt: null }, // startedAt != null ⇒ corriendo
    finalMs: null,
  });

  let s = fresh();
  // Datos de sesión XR: se conservan entre reinicios.
  const session = { xrActive: false, hands: { left: false, right: false }, controllers: false };

  const api = {
    session,
    get: () => s,
    reset() { s = fresh(); },

    elapsed(now) {
      const t = s.timer;
      return t.accumulated + (t.startedAt !== null ? now - t.startedAt : 0);
    },
    start(now) {
      if (s.timer.startedAt === null) s.timer.startedAt = now;
      s.phase = PHASE.RUNNING;
    },
    pause(now) {
      if (s.timer.startedAt !== null) {
        s.timer.accumulated += now - s.timer.startedAt;
        s.timer.startedAt = null;
      }
      s.phase = PHASE.PAUSED;
    },
    finish(now) {
      api.pause(now);
      s.finalMs = s.timer.accumulated;
      s.phase = PHASE.DONE;
    },

    setMessage(message, tone = 'info') { s.message = message; s.tone = tone; },
    addError() { s.errors += 1; },
    setBinTime(categoryId, ms) { if (s.binTimes.get(categoryId) === null) s.binTimes.set(categoryId, ms); },

    /** Métricas derivadas a partir de los registros de piezas. */
    metrics(pieces) {
      const perCategory = new Map(CATEGORIES.map((c) => [c.id, 0]));
      let hits = 0;
      for (const p of pieces.values()) {
        if (p.state === STATE.CLASSIFIED) { hits++; perCategory.set(p.category, perCategory.get(p.category) + 1); }
      }
      const attempts = hits + s.errors;
      return { hits, perCategory, errors: s.errors, attempts, precision: precision(hits, attempts) };
    },
  };
  return api;
}
