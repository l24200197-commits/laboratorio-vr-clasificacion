// Interfaz HTML (Bootstrap) de la portada. Solo existe FUERA de VR.
import { CATEGORIES } from './config.js';

export function createPageUI() {
  const $ = (id) => {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Falta el elemento #${id} en index.html`);
    return el;
  };
  const els = {
    btn: $('btn-enter-vr'),
    btnText: $('btn-enter-text'),
    spinner: $('btn-enter-spinner'),
    reset: $('btn-reset'),
    sound: $('sound-toggle'),
    status: $('xr-status'),
    error: $('error-box'),
    loading: $('loading'),
    overlay: $('xr-overlay'),
    mirror: $('score-mirror'),
  };

  // Marcador espejo accesible (lector de pantalla / escritorio); el marcador oficial está en VR.
  const rows = CATEGORIES.map((c) => `<tr><th scope="row"><span class="dot" style="--c:#${c.color.toString(16).padStart(6, '0')}"></span>${c.label}</th><td data-n="${c.id}">0/5</td><td data-t="${c.id}">pendiente</td></tr>`).join('');
  els.mirror.innerHTML = `
    <p class="mb-1"><strong data-f="phase">listo</strong> · Aciertos <strong data-f="hits">0/20</strong> · Tiempo <strong data-f="clock">00:00</strong></p>
    <p class="mb-2 small">Errores <span data-f="errors">0</span> · Intentos <span data-f="attempts">0</span> · Precisión <span data-f="precision">0.0 %</span></p>
    <table class="table table-sm table-dark mb-2"><thead><tr><th scope="col">Bote</th><th scope="col">Progreso</th><th scope="col">Llenado</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="small mb-0" data-f="message"></p>`;
  const q = (sel) => els.mirror.querySelector(sel);

  return {
    els,
    setStatus(level, text) {
      els.status.className = `alert alert-${level} mb-0 py-2`;
      els.status.textContent = text;
    },
    setButton({ enabled, text, busy = false }) {
      els.btn.disabled = !enabled;
      els.btnText.textContent = text;
      els.spinner.classList.toggle('d-none', !busy);
    },
    showError(message) {
      els.error.textContent = message;
      els.error.classList.remove('d-none');
    },
    clearError() { els.error.classList.add('d-none'); },
    setLoaded() { els.loading.remove(); },
    setInSession(active) { els.overlay.classList.toggle('d-none', !active); },
    updateMirror(v) {
      q('[data-f=phase]').textContent = v.phase;
      q('[data-f=hits]').textContent = `${v.hits}/${v.total}`;
      q('[data-f=clock]').textContent = v.clock;
      q('[data-f=errors]').textContent = v.errors;
      q('[data-f=attempts]').textContent = v.attempts;
      q('[data-f=precision]').textContent = `${v.precision.toFixed(1)} %`;
      q('[data-f=message]').textContent = v.message;
      for (const c of v.categories) {
        q(`[data-n="${c.id}"]`).textContent = `${c.n}/5`;
        q(`[data-t="${c.id}"]`).textContent = c.time;
      }
    },
  };
}

/** Detección de capacidades en tiempo de ejecución (no por user-agent). */
export async function detectXR() {
  if (!window.isSecureContext) {
    return { vr: false, level: 'danger', text: 'Se requiere HTTPS (o localhost) para WebXR.' };
  }
  if (!('xr' in navigator)) {
    return { vr: false, level: 'warning', text: 'Este navegador no expone WebXR. Usa Meta Quest Browser. Solo vista previa NO inmersiva.' };
  }
  try {
    const vr = await navigator.xr.isSessionSupported('immersive-vr');
    return vr
      ? { vr: true, level: 'success', text: 'immersive-vr compatible. El seguimiento de manos solo se confirma dentro del visor.' }
      : { vr: false, level: 'warning', text: 'immersive-vr no soportado en este dispositivo. Solo vista previa NO inmersiva.' };
  } catch (err) {
    return { vr: false, level: 'danger', text: `Error al consultar WebXR: ${err.message}` };
  }
}
