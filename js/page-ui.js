// Interfaz HTML (Bootstrap) de la portada. Solo existe FUERA de VR.

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
    status: $('xr-status'),
    error: $('error-box'),
    loading: $('loading'),
    overlay: $('xr-overlay'),
  };

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
  };
}

/** Detección de capacidades en tiempo de ejecución (no por user-agent). */
export async function detectXR() {
  if (!window.isSecureContext) {
    return { vr: false, level: 'danger', text: 'Se requiere HTTPS (o localhost) para WebXR.' };
  }
  if (!('xr' in navigator)) {
    return { vr: false, level: 'warning', text: 'Este navegador no expone WebXR. Usa Meta Quest Browser. Vista previa disponible.' };
  }
  try {
    const vr = await navigator.xr.isSessionSupported('immersive-vr');
    return vr
      ? { vr: true, level: 'success', text: 'immersive-vr compatible. El seguimiento de manos se confirma al entrar.' }
      : { vr: false, level: 'warning', text: 'immersive-vr no soportado en este dispositivo. Solo vista previa.' };
  } catch (err) {
    return { vr: false, level: 'danger', text: `Error al consultar WebXR: ${err.message}` };
  }
}
