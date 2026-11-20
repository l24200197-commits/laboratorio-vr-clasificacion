// Punto de entrada: renderer, escena, mundo físico, laboratorio, entradas y sesión WebXR.
// Orden por frame: entrada (pose objetivo) → física de paso fijo → reglas/marcador → render.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createPhysics } from './physics-world.js';
import { buildEnvironment } from './environment.js';
import { buildTables } from './tables.js';
import { buildBins } from './bins.js';
import { buildPieces, createKits } from './pieces.js';
import { createHoldController } from './grab.js';
import { createStore } from './state.js';
import { createHud } from './hud.js';
import { createGame } from './game.js';
import { createXRHands } from './xr-hands.js';
import { createDesktopPointer } from './desktop-pointer.js';
import { createPageUI, detectXR } from './page-ui.js';
import { sounds, unlockAudio, setSoundEnabled, isSoundEnabled } from './audio.js';

const ui = createPageUI();
window.addEventListener('error', (e) => ui.showError(`Error: ${e.message}`));
window.addEventListener('unhandledrejection', (e) => ui.showError(`Error: ${e.reason?.message ?? e.reason}`));

init().catch((err) => {
  console.error(err);
  ui.showError(`No se pudo iniciar la aplicación: ${err.message}. Revisa Console/Network (import map / CDN).`);
  ui.setButton({ enabled: false, text: 'No disponible' });
});

async function init() {
  const container = document.getElementById('preview');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 50);
  camera.position.set(0, 1.9, 1.35);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.0, -0.85);
  controls.enableDamping = true;
  controls.update();

  // --- Mundo físico y laboratorio --------------------------------------------
  const physics = createPhysics();
  buildEnvironment(scene, physics);
  const tables = buildTables(scene, physics);
  const kits = createKits();
  const bins = buildBins(scene, physics, kits);
  const pieces = buildPieces(scene, physics, kits);
  const holds = createHoldController(physics);
  const store = createStore();
  const hud = createHud(scene);
  const game = createGame({ physics, store, pieces, bins, tables, holds, hud, sounds });

  const onButton = (action) => {
    const now = performance.now();
    if (action === 'toggle') game.toggle(now);
    else if (action === 'reset') game.reset();
    else if (action === 'recover') game.recover();
    else if (action === 'exit') exitVR();
  };

  const xrHands = createXRHands({ renderer, scene, game, hud, store, onButton });
  createDesktopPointer({ renderer, camera, controls, game, hud, onButton });

  // --- Sesión WebXR -------------------------------------------------------------
  let currentSession = null;

  async function enterVR() {
    unlockAudio(); // requiere gesto del usuario
    ui.clearError();
    ui.setButton({ enabled: false, text: 'Iniciando VR…', busy: true });
    try {
      const session = await navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking', 'bounded-floor'],
      });
      session.addEventListener('end', onSessionEnd);
      session.addEventListener('visibilitychange', () => {
        // El visor muestra un menú del sistema o se quita: no corre el tiempo.
        if (session.visibilityState !== 'visible') game.pause(performance.now(), 'Visor en segundo plano');
      });
      await renderer.xr.setSession(session);
      // Recentrado (botón Meta mantenido): cambia el sistema de referencia ⇒ se suelta lo sujeto.
      renderer.xr.getReferenceSpace()?.addEventListener('reset', () => {
        xrHands.releaseAll();
        game.releaseAll();
      });
      currentSession = session;
      store.session.xrActive = true;
      controls.enabled = false;
      ui.setInSession(true);
      ui.setButton({ enabled: true, text: 'Cerrar VR' });
    } catch (err) {
      console.error(err);
      ui.showError(`No se pudo abrir la sesión VR (${err.name}): ${err.message}`);
      ui.setButton({ enabled: true, text: 'Entrar a VR' });
    }
  }

  function exitVR() {
    renderer.xr.getSession()?.end().catch((err) => console.warn('Fin de sesión:', err));
  }

  // También se ejecuta si el sistema cierra la sesión (menú del visor, quitarse el visor).
  function onSessionEnd() {
    currentSession?.removeEventListener('end', onSessionEnd);
    currentSession = null;
    xrHands.releaseAll();
    xrHands.clearHover();
    game.pause(performance.now(), 'Saliste de VR: partida en pausa');
    store.session.xrActive = false;
    store.session.hands = { left: false, right: false };
    store.session.controllers = false;
    controls.enabled = true;
    ui.setInSession(false);
    ui.setButton({ enabled: true, text: 'Entrar a VR' });
  }

  ui.els.btn.addEventListener('click', () => (currentSession ? exitVR() : enterVR()));
  ui.els.reset.addEventListener('click', () => { unlockAudio(); game.reset(); });
  ui.els.sound.checked = isSoundEnabled();
  ui.els.sound.addEventListener('change', () => setSoundEnabled(ui.els.sound.checked));
  container.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !renderer.xr.isPresenting) game.pause(performance.now(), 'Pestaña oculta');
  });

  // --- Tamaño y ciclo de animación -----------------------------------------------
  function resize() {
    if (renderer.xr.isPresenting) return;
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  const clock = new THREE.Clock();
  let mirrorAt = 0;
  const loop = { paused: false };

  // setAnimationLoop es obligatorio en WebXR (usa el requestAnimationFrame de la sesión).
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    if (loop.paused) { renderer.render(scene, camera); return; } // autoprueba en curso
    const now = performance.now();
    if (renderer.xr.isPresenting) xrHands.update();
    else controls.update();
    physics.step(dt);
    game.update(now);
    if (now - mirrorAt > 250) { mirrorAt = now; ui.updateMirror(game.snapshot(now)); }
    renderer.render(scene, camera);
  });

  ui.setLoaded();
  const xr = await detectXR();
  ui.setStatus(xr.level, xr.text);
  ui.setButton(xr.vr ? { enabled: true, text: 'Entrar a VR' } : { enabled: false, text: 'VR no disponible' });

  // Autoprueba automática de física y reglas (?autoprueba). Entradas simuladas, NO manos reales.
  if (new URLSearchParams(location.search).has('autoprueba')) {
    const { runSelfTest } = await import('./selftest.js');
    loop.paused = true;
    try {
      await runSelfTest({ physics, game, store, pieces, bins, tables });
    } finally {
      loop.paused = false;
    }
  }
}
