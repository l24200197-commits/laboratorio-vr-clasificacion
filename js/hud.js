// Consola de clasificación 3D (marcador dentro de VR): textura de canvas sobre un plano + botonera
// vertical de mosaicos con icono. Bootstrap/DOM no existen dentro del visor; todo es geometría Three.js.
// El canvas solo se redibuja cuando cambia lo que muestra (≈1 vez por segundo con el reloj).
//
// Diseño: panel claro tipo "papel" con anillo de progreso global, reloj, tres métricas y una
// tarjeta por bote (icono de la figura, contador, barra segmentada y tiempo de llenado).
import * as THREE from 'three';
import { HUD } from './config.js';
import { makeCanvas, roundRect } from './text.js';

const INK = '#1f2328';
const PAPER = '#f3efe6';
const LINE = '#ddd6c8';
const MUTED = '#6b6f76';
const PHASE_COLOR = { listo: '#8a8f98', 'en curso': '#0f9d8a', 'en pausa': '#e08a00', completado: '#2e9e44' };
const TONE = {
  info: { bg: '#e9e4d8', bar: '#8a8f98' },
  ok: { bg: '#dcf1e2', bar: '#2e9e44' },
  error: { bg: '#fadedb', bar: '#d1435b' },
  done: { bg: '#dcf1e2', bar: '#2e9e44' },
};
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const hexOf = (c) => `#${c.toString(16).padStart(6, '0')}`;

/** Icono de cada figura (mismo `shape` que en config.js). */
const SHAPE_OF = { esfera: 'sphere', cubo: 'box', piramide: 'pyramid', hexagonal: 'hexPrism' };

export function createHud(scene) {
  const [cw, ch] = HUD.canvas;
  const { ctx, texture } = makeCanvas(cw, ch);
  const height = HUD.width * (ch / cw);
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(HUD.width, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
  );
  panel.position.set(...HUD.position);
  panel.name = 'consola-marcador';
  scene.add(panel);

  // Botonera vertical a la derecha del panel, girada hacia el usuario.
  const defs = [
    { action: 'toggle', text: 'Jugar', icon: 'play', color: '#0f9d8a' },
    { action: 'reset', text: 'Nueva ronda', icon: 'refresh', color: '#4f5bd5' },
    { action: 'recover', text: 'Rescatar', icon: 'lift', color: '#e08a00' },
    { action: 'exit', text: 'Cerrar VR', icon: 'close', color: '#d1435b' },
  ];
  const { x: bx, gap, size, rotY } = HUD.buttons;
  const buttons = defs.map((d, i) => makeButton(d, HUD.position[1] + ((defs.length - 1) / 2 - i) * gap));
  for (const b of buttons) scene.add(b);

  const hovers = new Map();
  let lastKey = '';

  function makeButton(def, y) {
    const { ctx: c, texture: tex } = makeCanvas(512, 180);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size[0], size[1]),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
    );
    mesh.position.set(bx, y, HUD.position[2] + 0.02);
    mesh.rotation.y = rotY;
    mesh.userData = { kind: 'button', action: def.action };
    mesh.name = `boton-${def.action}`;
    mesh.setLabel = (text, enabled = true, icon = def.icon) => {
      const key = `${text}|${enabled}|${icon}`;
      if (mesh.userData.key === key) return;
      mesh.userData.key = key;
      mesh.userData.enabled = enabled;
      c.clearRect(0, 0, 512, 180);
      c.fillStyle = enabled ? INK : '#4a4e55';
      roundRect(c, 6, 6, 500, 168, 84);
      c.fill();
      // Disco de color con el icono
      c.fillStyle = enabled ? def.color : '#7d828a';
      c.beginPath();
      c.arc(90, 90, 66, 0, Math.PI * 2);
      c.fill();
      drawIcon(c, icon, 90, 90, 30);
      c.fillStyle = enabled ? PAPER : '#b9bcc1';
      c.font = `bold 54px ${FONT}`;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(text, 176, 93, 316);
      tex.needsUpdate = true;
    };
    mesh.setLabel(def.text);
    return mesh;
  }

  function draw(v) {
    const accent = PHASE_COLOR[v.phase] ?? PHASE_COLOR['en curso'];
    ctx.clearRect(0, 0, cw, ch);

    // Fondo y marco del color de la fase
    ctx.fillStyle = PAPER;
    roundRect(ctx, 5, 5, cw - 10, ch - 10, 40);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = accent;
    ctx.stroke();

    // Banda superior
    ctx.save();
    roundRect(ctx, 5, 5, cw - 10, ch - 10, 40);
    ctx.clip();
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, cw, 96);
    ctx.restore();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = PAPER;
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText('CLASIFICADOR DE FIGURAS', 40, 52);
    const titleEnd = 40 + ctx.measureText('CLASIFICADOR DE FIGURAS').width + 28;
    const chipLeft = chip(v.phase.toUpperCase(), accent, cw - 34, 52);
    ctx.font = `22px ${FONT}`;
    ctx.fillStyle = '#b9bcc1';
    ctx.textAlign = 'left';
    ctx.fillText(fit('pellizca · lleva · suelta', chipLeft - titleEnd - 24), titleEnd, 54);

    // --- Columna izquierda: anillo de aciertos, reloj y métricas
    const gx = 215, gy = 280, gr = 128;
    ctx.lineCap = 'round';
    ctx.lineWidth = 28;
    ctx.strokeStyle = LINE;
    ctx.beginPath();
    ctx.arc(gx, gy, gr, 0, Math.PI * 2);
    ctx.stroke();
    if (v.hits > 0) {
      ctx.strokeStyle = accent;
      ctx.beginPath();
      ctx.arc(gx, gy, gr, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * v.hits) / v.total);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = `800 104px ${FONT}`;
    ctx.fillText(String(v.hits), gx, gy - 14);
    ctx.fillStyle = MUTED;
    ctx.font = `600 24px ${FONT}`;
    ctx.fillText(`de ${v.total} aciertos`, gx, gy + 50);

    ctx.fillStyle = '#e9e4d8';
    roundRect(ctx, 40, 438, 350, 104, 24);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = MUTED;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText('TIEMPO', 64, 470);
    ctx.fillStyle = INK;
    ctx.font = `700 60px ${MONO}`;
    ctx.fillText(v.clock, 64, 514);

    const stats = [
      ['ERRORES', String(v.errors), v.errors ? '#d1435b' : INK],
      ['INTENTOS', String(v.attempts), INK],
      ['PRECISIÓN', `${v.precision.toFixed(0)}%`, '#0f9d8a'],
    ];
    stats.forEach(([label, value, color], i) => {
      const x = 40 + i * 120;
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, x, 560, 110, 96, 20);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = color;
      ctx.font = `800 40px ${FONT}`;
      ctx.fillText(value, x + 55, 598);
      ctx.fillStyle = MUTED;
      ctx.font = `700 16px ${FONT}`;
      ctx.fillText(label, x + 55, 636);
    });

    // --- Derecha: tarjetas de bote 2 × 2
    const cardW = 360, cardH = 214, x0 = 420, y0 = 122, g = 20;
    v.categories.forEach((c, i) => {
      const x = x0 + (i % 2) * (cardW + g);
      const y = y0 + Math.floor(i / 2) * (cardH + g);
      card(c, x, y, cardW, cardH);
    });

    // Mensaje
    const tone = TONE[v.tone] ?? TONE.info;
    const my = y0 + 2 * cardH + g + 16;
    ctx.fillStyle = tone.bg;
    roundRect(ctx, x0, my, 2 * cardW + g, 66, 18);
    ctx.fill();
    ctx.fillStyle = tone.bar;
    roundRect(ctx, x0, my, 12, 66, 6);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText(fit(v.message, 2 * cardW + g - 52), x0 + 30, my + 34);

    // Estado de manos
    ctx.font = `600 21px ${FONT}`;
    ctx.fillStyle = v.handsOk ? '#2e7d32' : '#c62828';
    ctx.fillText(fit(v.handsText, 2 * cardW + g - 20), x0 + 10, my + 92);
    texture.needsUpdate = true;
  }

  function card(c, x, y, w, h) {
    const color = hexOf(c.color);
    const full = c.n >= 5;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x, y, w, h, 24);
    ctx.fill();
    ctx.lineWidth = full ? 5 : 3;
    ctx.strokeStyle = full ? '#2e9e44' : LINE;
    ctx.stroke();

    shapeIcon(ctx, SHAPE_OF[c.id] ?? 'sphere', x + 48, y + 52, 24, color);
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = `800 26px ${FONT}`;
    ctx.fillText(fit(c.label, 175), x + 82, y + 52);
    ctx.textAlign = 'right';
    ctx.font = `800 46px ${FONT}`;
    ctx.fillStyle = full ? '#2e9e44' : INK;
    ctx.fillText(`${c.n}/5`, x + w - 24, y + 54);

    const segW = (w - 48 - 4 * 8) / 5;
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = k < c.n ? color : '#ece6da';
      roundRect(ctx, x + 24 + k * (segW + 8), y + 108, segW, 30, 10);
      ctx.fill();
    }
    ctx.textAlign = 'left';
    ctx.font = `600 23px ${FONT}`;
    ctx.fillStyle = c.timeMs === null ? MUTED : '#2e7d32';
    ctx.fillText(c.timeMs === null ? 'Llenado: pendiente' : `Lleno en ${c.time}`, x + 24, y + 176);
  }

  function chip(text, color, right, cy) {
    ctx.font = `800 26px ${FONT}`;
    const w = ctx.measureText(text).width + 44;
    ctx.fillStyle = color;
    roundRect(ctx, right - w, cy - 24, w, 48, 24);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(text, right - w + 22, cy + 1);
    return right - w;
  }

  function fit(text, maxWidth) {
    let t = text;
    while (ctx.measureText(t).width > maxWidth && t.length > 4) t = `${t.slice(0, -2)}…`;
    return t;
  }

  function updateButtons(phase) {
    const toggle = buttons[0];
    if (phase === 'listo') toggle.setLabel('Jugar', true, 'play');
    else if (phase === 'en curso') toggle.setLabel('Jugando', false, 'play');
    else if (phase === 'en pausa') toggle.setLabel('Seguir', true, 'play');
    else toggle.setLabel('Terminado', false, 'check');
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
        b.material.color.setHex(on ? 0xd9fff6 : 0xffffff);
        b.scale.setScalar(on ? 1.07 : 1);
      }
    },
  };
}

/** Iconos vectoriales (los emoji/símbolos Unicode no son fiables en el navegador del visor). */
function drawIcon(c, icon, x, y, s) {
  c.save();
  c.translate(x, y);
  c.fillStyle = '#ffffff';
  c.strokeStyle = '#ffffff';
  c.lineWidth = s * 0.28;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  switch (icon) {
    case 'play':
      c.moveTo(-s * 0.55, -s * 0.8); c.lineTo(s * 0.85, 0); c.lineTo(-s * 0.55, s * 0.8); c.closePath(); c.fill();
      break;
    case 'pause':
      c.rect(-s * 0.65, -s * 0.75, s * 0.45, s * 1.5); c.rect(s * 0.2, -s * 0.75, s * 0.45, s * 1.5); c.fill();
      break;
    case 'refresh':
      c.arc(0, 0, s * 0.72, -Math.PI * 0.35, Math.PI * 1.35); c.stroke();
      c.beginPath();
      c.moveTo(s * 0.95, -s * 0.95); c.lineTo(s * 0.62, -s * 0.18); c.lineTo(-s * 0.05, -s * 0.72); c.closePath(); c.fill();
      break;
    case 'lift': // flecha hacia arriba saliendo de una bandeja
      c.moveTo(-s * 0.85, s * 0.2); c.lineTo(-s * 0.85, s * 0.85); c.lineTo(s * 0.85, s * 0.85); c.lineTo(s * 0.85, s * 0.2); c.stroke();
      c.beginPath(); c.moveTo(0, s * 0.45); c.lineTo(0, -s * 0.85); c.stroke();
      c.beginPath(); c.moveTo(-s * 0.5, -s * 0.4); c.lineTo(0, -s * 0.9); c.lineTo(s * 0.5, -s * 0.4); c.stroke();
      break;
    case 'close':
      c.moveTo(-s * 0.7, -s * 0.7); c.lineTo(s * 0.7, s * 0.7); c.moveTo(s * 0.7, -s * 0.7); c.lineTo(-s * 0.7, s * 0.7); c.stroke();
      break;
    case 'check':
      c.moveTo(-s * 0.8, 0); c.lineTo(-s * 0.2, s * 0.6); c.lineTo(s * 0.85, -s * 0.6); c.stroke();
      break;
    default:
  }
  c.restore();
}

/** Silueta 2D de cada figura para las tarjetas. */
function shapeIcon(c, shape, x, y, r, color) {
  c.save();
  c.translate(x, y);
  c.fillStyle = color;
  c.beginPath();
  if (shape === 'sphere') c.arc(0, 0, r, 0, Math.PI * 2);
  else if (shape === 'box') c.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
  else if (shape === 'pyramid') { c.moveTo(0, -r); c.lineTo(r, r * 0.85); c.lineTo(-r, r * 0.85); c.closePath(); }
  else for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; c[k ? 'lineTo' : 'moveTo'](r * Math.cos(a), r * Math.sin(a)); }
  c.fill();
  c.restore();
}
