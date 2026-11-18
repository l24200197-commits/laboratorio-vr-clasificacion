// Sonidos sintetizados con Web Audio API: sin archivos externos (sin problemas de licencias).
// Preferencia "sonido activado" guardada en localStorage (única persistencia; no se guardan partidas).
const PREF_KEY = 'lab32.sound';
let ctx = null;
let enabled = readPref();

function readPref() {
  try { return localStorage.getItem(PREF_KEY) !== 'off'; } catch { return true; }
}

export function setSoundEnabled(on) {
  enabled = Boolean(on);
  try { localStorage.setItem(PREF_KEY, enabled ? 'on' : 'off'); } catch { /* modo privado */ }
}
export const isSoundEnabled = () => enabled;

export function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch (err) {
    console.warn('[audio] Web Audio no disponible:', err);
  }
}

function tone(freq, duration, { type = 'sine', delay = 0, gain = 0.12 } = {}) {
  if (!ctx || !enabled) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Tres firmas sonoras claramente distintas: acierto (sube), error (grave), fin (arpegio). */
export const sounds = {
  success() { tone(660, 0.12); tone(880, 0.18, { delay: 0.11 }); },
  error() { tone(220, 0.18, { type: 'square', gain: 0.05 }); tone(160, 0.25, { type: 'square', gain: 0.05, delay: 0.16 }); },
  finish() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, { delay: i * 0.13 })); },
  click() { tone(1200, 0.05, { gain: 0.05 }); },
};
