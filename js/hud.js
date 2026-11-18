// Panel score 3D dentro de VR: textura de canvas sobre un plano + botones 3D seleccionables.
// Bootstrap/DOM no existen dentro del visor; todo lo que se ve en VR es geometría de Three.js.
// El canvas solo se redibuja cuando cambia lo que muestra (≈1 vez por segundo con el reloj).
import * as THREE from 'three';
import { HUD } from './config.js';
import { makeCanvas, roundRect } from './text.js';

const PHASE_COLOR = { listo: '#94a3b8', 'en curso': '#38bdf8', 'en pausa': '#f59e0b', completado: '#22c55e' };
const TONE_COLOR = { info: '#e2e8f0', ok: '#86efac', error: '#fca5a5', done: '#86efac' };
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function createHud(scene) {
  const [cw, ch] = HUD.canvas;
  const { canvas, ctx, texture } = makeCanvas(cw, ch);
  const height = HUD.width * (ch / cw);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(HUD.width, height), new THREE.MeshBasicMaterial({ map: texture }));
  panel.position.set(...HUD.position);
  panel.rotation.x = HUD.tiltX;
  panel.name = 'panel-score';
  scene.add(panel);

  const defs = [
    { action: 'start', text: 'Comenzar', color: '#16a34a' },
    { action: 'reset', text: 'Reiniciar', color: '#0ea5e9' },
    { action: 'recover', text: 'Recuperar', color: '#f59e0b' },
    { action: 'exit', text: 'Salir de VR', color: '#f43f5e' },
  ];
  const buttons = defs.map((d, i) => makeButton(d, (i - 1.5) * 0.29));
  for (const b of buttons) scene.add(b);

  const hovers = new Map();
  let lastKey = '';

  function makeButton(def, x) {
    const { ctx: c, texture: tex } = makeCanvas(512, 160);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.085, 0.02), new THREE.MeshBasicMaterial({ map: tex }));
    mesh.position.set(x, HUD.buttonY, HUD.position[2] + 0.03);
    mesh.userData = { kind: 'button', action: def.action };
    mesh.name = `boton-${def.action}`;
    mesh.setLabel = (text, enabled = true) => {
      if (mesh.userData.text === text && mesh.userData.enabled === enabled) return;
      mesh.userData.text = text;
      mesh.userData.enabled = enabled;
      c.clearRect(0, 0, 512, 160);
      c.fillStyle = enabled ? def.color : '#475569';
      roundRect(c, 4, 4, 504, 152, 40);
      c.fill();
      c.fillStyle = '#fff';
      c.font = `bold 62px ${FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(text, 256, 84);
      tex.needsUpdate = true;
    };
    mesh.setLabel(def.text);
    return mesh;
  }

  function draw(v) {
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#0b1220';
    roundRect(ctx, 0, 0, cw, ch, 36);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = PHASE_COLOR[v.phase] ?? '#38bdf8';
    ctx.stroke();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    // Encabezado
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `bold 46px ${FONT}`;
    ctx.fillText('3.2 Interacción virtual', 36, 28);
    ctx.font = `26px ${FONT}`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Toma con pinza · suelta dentro del bote de su figura', 36, 86);
    pill(v.phase.toUpperCase(), PHASE_COLOR[v.phase], cw - 36, 30);

    // Totales y reloj
    ctx.fillStyle = '#94a3b8';
    ctx.font = `bold 28px ${FONT}`;
    ctx.fillText('ACIERTOS', 36, 136);
    ctx.fillText('TIEMPO GLOBAL', 560, 136);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 92px ${FONT}`;
    ctx.fillText(`${v.hits}/${v.total}`, 36, 168);
    ctx.fillText(v.clock, 560, 168);

    // Progreso por bote
    let y = 290;
    ctx.font = `bold 28px ${FONT}`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('BOTE', 36, y);
    ctx.fillText('PROGRESO', 330, y);
    ctx.fillText('LLENADO (desde inicio)', 640, y);
    y += 44;
    for (const c of v.categories) {
      const hex = `#${c.color.toString(16).padStart(6, '0')}`;
      ctx.fillStyle = hex;
      ctx.beginPath();
      ctx.arc(54, y + 22, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e2e8f0';
      ctx.font = `bold 36px ${FONT}`;
      ctx.fillText(c.label, 84, y + 3);
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = k < c.n ? hex : '#1e293b';
        roundRect(ctx, 330 + k * 46, y + 6, 38, 32, 8);
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${c.n}/5`, 572, y + 3);
      ctx.fillStyle = c.timeMs === null ? '#64748b' : '#86efac';
      ctx.fillText(c.time, 640, y + 3);
      y += 58;
    }

    // Métricas
    y += 10;
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `bold 36px ${FONT}`;
    ctx.fillText(`Errores ${v.errors}   ·   Intentos ${v.attempts}   ·   Precisión ${v.precision.toFixed(1)} %`, 36, y);

    // Mensaje
    y += 62;
    ctx.fillStyle = '#111a2e';
    roundRect(ctx, 28, y, cw - 56, 70, 18);
    ctx.fill();
    ctx.fillStyle = TONE_COLOR[v.tone] ?? '#e2e8f0';
    ctx.font = `bold 32px ${FONT}`;
    ctx.fillText(fit(v.message, cw - 96), 48, y + 18);

    // Estado de manos
    y += 92;
    ctx.font = `26px ${FONT}`;
    ctx.fillStyle = v.handsOk ? '#86efac' : '#fca5a5';
    ctx.fillText(fit(v.handsText, cw - 72), 36, y);
    texture.needsUpdate = true;
  }

  function pill(text, color, right, top) {
    ctx.font = `bold 30px ${FONT}`;
    const w = ctx.measureText(text).width + 40;
    ctx.fillStyle = color;
    roundRect(ctx, right - w, top, w, 50, 25);
    ctx.fill();
    ctx.fillStyle = '#0b1220';
    ctx.fillText(text, right - w + 20, top + 10);
  }

  function fit(text, maxWidth) {
    let t = text;
    while (ctx.measureText(t).width > maxWidth && t.length > 4) t = `${t.slice(0, -2)}…`;
    return t;
  }

  function updateButtons(phase) {
    const start = buttons[0];
    if (phase === 'listo') start.setLabel('Comenzar');
    else if (phase === 'en pausa') start.setLabel('Continuar');
    else if (phase === 'en curso') start.setLabel('En curso', false);
    else start.setLabel('Completado', false);
  }

  return {
    panel,
    buttons,
    update(view) {
      const { states, elapsedMs, ...visible } = view; // lo que no se dibuja no fuerza redibujado
      const key = JSON.stringify(visible);
      if (key === lastKey) return;
      lastKey = key;
      updateButtons(view.phase);
      draw(view);
    },
    setHover(source, action) {
      if (action) hovers.set(source, action); else hovers.delete(source);
      const active = new Set(hovers.values());
      for (const b of buttons) {
        const on = active.has(b.userData.action);
        b.material.color.setHex(on ? 0xfff3a0 : 0xffffff);
        b.scale.setScalar(on ? 1.08 : 1);
      }
    },
  };
}
