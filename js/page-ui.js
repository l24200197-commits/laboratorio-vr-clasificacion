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
  const SHAPE = { esfera: 'sphere', cubo: 'box', piramide: 'pyramid', hexagonal: 'hex' };
  const cards = CATEGORIES.map((c) => `
    <div class="bin-card" data-card="${c.id}" style="--c:#${c.color.toString(16).padStart(6, '0')}">
      <div class="bin-head"><span class="shape shape-${SHAPE[c.id] ?? 'sphere'}" aria-hidden="true"></span><strong>${c.label}</strong><span class="bin-n" data-n="${c.id}">0/5</span></div>
      <div class="segs" aria-hidden="true">${'<i></i>'.repeat(5)}</div>
      <small data-t="${c.id}">Llenado: pendiente</small>
    </div>`).join('');
  els.mirror.innerHTML = `
    <div class="console-top"><span>CLASIFICADOR DE FIGURAS</span><span class="phase-chip" data-f="phase">listo</span></div>
    <div class="console-body">
      <div class="console-left">
        <div class="ring" data-f="ring"><div><b data-f="hits">0</b><small>de 20 aciertos</small></div></div>
        <div class="clock"><small>TIEMPO</small><b data-f="clock">00:00</b></div>
        <div class="stats">
          <div><b data-f="errors">0</b><small>ERRORES</small></div>
          <div><b data-f="attempts">0</b><small>INTENTOS</small></div>
          <div><b data-f="precision">0%</b><small>PRECISIÓN</small></div>
        </div>
      </div>
      <div class="console-right">
        <div class="bins">${cards}</div>
        <p class="msg" data-f="message"></p>
      </div>
    </div>`;
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
      els.mirror.dataset.phase = v.phase;
      q('[data-f=phase]').textContent = v.phase;
      q('[data-f=hits]').textContent = v.hits;
      q('[data-f=ring]').style.setProperty('--p', `${(v.hits / v.total) * 100}%`);
      q('[data-f=clock]').textContent = v.clock;
      q('[data-f=errors]').textContent = v.errors;
      q('[data-f=attempts]').textContent = v.attempts;
      q('[data-f=precision]').textContent = `${v.precision.toFixed(0)}%`;
      const msg = q('[data-f=message]');
      msg.textContent = v.message;
      msg.dataset.tone = v.tone;
      for (const c of v.categories) {
        q(`[data-n="${c.id}"]`).textContent = `${c.n}/5`;
        q(`[data-t="${c.id}"]`).textContent = c.timeMs === null ? 'Llenado: pendiente' : `Lleno en ${c.time}`;
        const card = q(`[data-card="${c.id}"]`);
        card.classList.toggle('full', c.n >= 5);
        card.querySelectorAll('.segs i').forEach((seg, k) => seg.classList.toggle('on', k < c.n));
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
