// Reglas de clasificación PURAS (sin escena, sin DOM): fáciles de leer, explicar y probar.
import { RULES } from './config.js';

/**
 * Devuelve el bote cuyo VOLUMEN INTERIOR ÚTIL contiene el centro de la pieza, o null.
 * "Útil" = dentro de las paredes (con margen), por encima del fondo y por debajo del borde:
 * una pieza apoyada sobre el borde o fuera de la base NO cuenta.
 * @param {{x:number,y:number,z:number}} pos
 * @param {Iterable<{cx:number,cz:number,half:number,baseY:number,rimY:number}>} bins
 */
export function binContaining(pos, bins) {
  for (const b of bins) {
    const lim = b.half - RULES.insideMargin;
    if (Math.abs(pos.x - b.cx) < lim
      && Math.abs(pos.z - b.cz) < lim
      && pos.y > b.baseY
      && pos.y < b.rimY - RULES.rimMargin) return b;
  }
  return null;
}

/** ¿El cuerpo está prácticamente quieto? (o dormido por el motor físico) */
export function isSlow(linearSpeed, angularSpeed, sleeping = false) {
  return sleeping || (linearSpeed < RULES.stableLinear && angularSpeed < RULES.stableAngular);
}

/** Resultado de un intento confirmado: acierto si la categoría coincide con la del bote. */
export function judge(pieceCategory, binCategory) {
  return pieceCategory === binCategory ? 'acierto' : 'error';
}

/** Precisión = aciertos / intentos confirmados × 100; 0 % si no hay intentos. */
export function precision(hits, attempts) {
  return attempts > 0 ? (hits / attempts) * 100 : 0;
}

export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(1)} s`;
}
