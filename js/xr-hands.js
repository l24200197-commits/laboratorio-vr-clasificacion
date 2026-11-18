// Entrada XR (reutilizada de la práctica 3.1): seguimiento de ambas manos, rayo de apuntado,
// pinza (selectstart/selectend) y pérdida de tracking. En 3.2 la mano YA NO mueve la malla:
// calcula una pose objetivo y se la entrega al controlador físico (game.setHoldTarget).
//
// En Meta Quest Browser la pinza índice+pulgar dispara 'selectstart'/'selectend' en el
// XRInputSource de la mano. La pinza con la palma hacia la cara es el menú del sistema.
import * as THREE from 'three';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { RAY_LENGTH } from './config.js';

export function createXRHands({ renderer, scene, game, hud, store, onButton }) {
  const factory = new XRHandModelFactory();
  const raycaster = new THREE.Raycaster();
  const rotation = new THREE.Matrix4();
  const pieceMatrix = new THREE.Matrix4();
  const target = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();

  const sources = [0, 1].map((index) => {
    const controller = renderer.xr.getController(index); // espacio del rayo de apuntado
    const hand = renderer.xr.getHand(index);             // articulaciones de la mano
    hand.add(factory.createHandModel(hand, 'spheres'));  // modelo sin descargas externas
    const ray = makeRay();
    controller.add(ray);

    const s = {
      key: `xr-${index}`, controller, hand, ray,
      handedness: null, isHand: false, connected: false,
      heldId: null, offset: new THREE.Matrix4(),
    };
    controller.addEventListener('connected', (e) => {
      s.connected = true;
      s.handedness = e.data?.handedness ?? null;
      s.isHand = Boolean(e.data?.hand);
      refreshInputStatus();
    });
    controller.addEventListener('disconnected', () => {
      // Pérdida de tracking con una pieza sujeta: se suelta SIN velocidad y cae por gravedad.
      if (s.heldId) game.release(s.heldId, s.key, { inheritVelocity: false });
      s.heldId = null;
      s.connected = false;
      s.isHand = false;
      game.setHover(s.key, null);
      hud.setHover(s.key, null);
      refreshInputStatus();
    });
    controller.addEventListener('selectstart', () => onSelectStart(s));
    controller.addEventListener('selectend', () => onSelectEnd(s));
    scene.add(controller);
    scene.add(hand);
    return s;
  });

  // Cuando el juego suelta piezas por su cuenta (reinicio, pausa) se limpia el estado local.
  game.registerCanceller(() => sources.forEach((s) => { s.heldId = null; }));

  function makeRay() {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.8 }));
    line.scale.z = RAY_LENGTH;
    return line;
  }

  function refreshInputStatus() {
    const hands = { left: false, right: false };
    let controllers = false;
    for (const s of sources) {
      if (!s.connected) continue;
      if (s.isHand && (s.handedness === 'left' || s.handedness === 'right')) hands[s.handedness] = true;
      if (!s.isHand) controllers = true;
    }
    store.session.hands = hands;
    store.session.controllers = controllers;
  }

  function intersect(s) {
    rotation.identity().extractRotation(s.controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(s.controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
    const hits = raycaster.intersectObjects(game.selectables(), false);
    if (!hits.length) return null;
    return hits.find((h) => h.object.userData.kind === 'button') ?? hits[0]; // botones > piezas
  }

  function onSelectStart(s) {
    if (!s.connected || s.heldId) return; // una mano solo sujeta una pieza
    s.controller.updateMatrixWorld(true);
    const hit = intersect(s);
    if (!hit) return;
    const data = hit.object.userData;
    if (data.kind === 'button') { onButton(data.action); return; }
    if (data.kind !== 'piece' || !game.grab(data.id, s.key)) return;
    // Offset de agarre: pose de la pieza relativa al rayo de la mano en el instante de la pinza.
    const mesh = hit.object;
    pieceMatrix.compose(mesh.position, mesh.quaternion, scl.set(1, 1, 1));
    s.offset.copy(s.controller.matrixWorld).invert().multiply(pieceMatrix);
    s.heldId = data.id;
    game.setHover(s.key, null);
  }

  function onSelectEnd(s) {
    if (!s.heldId) return;
    const id = s.heldId;
    s.heldId = null;
    game.release(id, s.key); // vuelve a dinámico con la velocidad de la mano
  }

  /** Cada frame durante la sesión XR, ANTES de avanzar la física. */
  function update() {
    for (const s of sources) {
      s.ray.visible = s.connected;
      if (!s.connected) continue;
      s.controller.updateMatrixWorld(true);
      if (s.heldId) {
        target.multiplyMatrices(s.controller.matrixWorld, s.offset);
        target.decompose(pos, quat, scl);
        game.setHoldTarget(s.heldId, s.key, pos, quat);
        s.ray.scale.z = 0.12;
        continue;
      }
      const hit = intersect(s);
      s.ray.scale.z = hit ? hit.distance : RAY_LENGTH;
      const kind = hit?.object.userData.kind;
      game.setHover(s.key, kind === 'piece' ? hit.object.userData.id : null);
      hud.setHover(s.key, kind === 'button' ? hit.object.userData.action : null);
    }
  }

  return {
    update,
    releaseAll() {
      for (const s of sources) if (s.heldId) game.release(s.heldId, s.key, { inheritVelocity: false });
      sources.forEach((s) => { s.heldId = null; });
    },
    clearHover: () => sources.forEach((s) => { game.setHover(s.key, null); hud.setHover(s.key, null); }),
  };
}
