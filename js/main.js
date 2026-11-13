// Punto de entrada: inicializa renderer, escena, estado, entradas y sesión WebXR.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PIECES } from './config.js';
import { createStore } from './state.js';
import { buildEnvironment, buildPieces, buildTargets } from './scene.js';
import { createHud } from './hud.js';
import { createLabController } from './lab.js';
import { createXRHands } from './xr-hands.js';
import { createDesktopPointer } from './desktop-pointer.js';
import { createPageUI, detectXR } from './page-ui.js';
import { sounds, unlockAudio } from './audio.js';

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
  camera.position.set(0, 1.45, 0.35);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.9, -0.7);
  controls.enableDamping = true;
  controls.update();

  buildEnvironment(scene);
  const labGroup = new THREE.Group(); // en el origen: coordenadas locales = mundo
  scene.add(labGroup);

  const store = createStore(PIECES.map((p) => p.id));
  const pieces = buildPieces(labGroup);
  const targets = buildTargets(labGroup);
  const hud = createHud(labGroup);
  const lab = createLabController({ store, pieces, targets, hud, sounds });

  const onButton = (action) => {
    if (action === 'reset') lab.reset();
    else if (action === 'exit') exitVR();
  };

  const xrHands = createXRHands({ renderer, scene, labGroup, lab, hud, store, onButton });
  createDesktopPointer({ renderer, camera, controls, labGroup, lab, hud, onButton });

  // --- Sesión WebXR -------------------------------------------------------
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
      await renderer.xr.setSession(session);
      currentSession = session;
      store.session.xrActive = true;
      controls.enabled = false;
      ui.setInSession(true);
      ui.setButton({ enabled: true, text: 'Salir de VR' });
    } catch (err) {
      console.error(err);
      ui.showError(`No se pudo abrir la sesión VR (${err.name}): ${err.message}`);
      ui.setButton({ enabled: true, text: 'Entrar a VR' });
    }
  }

  function exitVR() {
    renderer.xr.getSession()?.end().catch((err) => console.warn('Fin de sesión:', err));
  }

  // También se ejecuta si el sistema cierra la sesión (menú del visor).
  function onSessionEnd() {
    currentSession?.removeEventListener('end', onSessionEnd);
    currentSession = null;
    xrHands.cancelAll();   // detiene arrastres pendientes sin corromper el estado
    xrHands.clearHover();
    store.session.xrActive = false;
    store.session.hands = { left: false, right: false };
    store.session.controllers = false;
    controls.enabled = true;
    ui.setInSession(false);
    ui.setButton({ enabled: true, text: 'Entrar a VR' });
  }

  ui.els.btn.addEventListener('click', () => (currentSession ? exitVR() : enterVR()));

  // --- Tamaño y ciclo de animación -----------------------------------------
  function resize() {
    if (renderer.xr.isPresenting) return;
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  // setAnimationLoop es obligatorio en WebXR (usa requestAnimationFrame de la sesión).
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    if (renderer.xr.isPresenting) xrHands.update();
    else controls.update();
    lab.tick(now);
    renderer.render(scene, camera);
  });

  ui.setLoaded();

  const xr = await detectXR();
  ui.setStatus(xr.level, xr.text);
  ui.setButton(xr.vr ? { enabled: true, text: 'Entrar a VR' } : { enabled: false, text: 'VR no disponible' });
}
