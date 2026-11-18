// Entrada de ESCRITORIO solo para inspección y pruebas de física: arrastra una pieza con el ratón
// sobre un plano horizontal elevado (rueda = subir/bajar) y suéltala para verla caer.
// Usa EXACTAMENTE la misma vía física que las manos (grab → setHoldTarget → release).
// NO sustituye la prueba con seguimiento de manos en Meta Quest 3.
import * as THREE from 'three';

export function createDesktopPointer({ renderer, camera, controls, game, hud, onButton }) {
  const el = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const point = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const KEY = 'mouse';
  let drag = null; // { id, height, quat }

  function setRay(evt) {
    const r = el.getBoundingClientRect();
    ndc.set(((evt.clientX - r.left) / r.width) * 2 - 1, -((evt.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  }

  function pick() {
    const hits = raycaster.intersectObjects(game.selectables(), false);
    return hits.find((h) => h.object.userData.kind === 'button') ?? hits[0] ?? null;
  }

  function onDown(evt) {
    if (renderer.xr.isPresenting || evt.button !== 0) return;
    setRay(evt);
    const hit = pick();
    if (!hit) return;
    const data = hit.object.userData;
    if (data.kind === 'button') { onButton(data.action); return; }
    if (data.kind !== 'piece' || !game.grab(data.id, KEY)) return;
    const mesh = hit.object;
    const height = Math.max(mesh.position.y + 0.25, 1.0); // se eleva por encima de mesas y botes
    plane.constant = -height;
    raycaster.ray.intersectPlane(plane, point);
    offset.set(mesh.position.x - point.x, 0, mesh.position.z - point.z);
    drag = { id: data.id, height, quat: mesh.quaternion.clone() };
    moveTo(evt);
    controls.enabled = false;
    el.setPointerCapture(evt.pointerId);
  }

  function moveTo(evt) {
    setRay(evt);
    plane.constant = -drag.height;
    if (raycaster.ray.intersectPlane(plane, point)) {
      game.setHoldTarget(drag.id, KEY, point.add(offset).setY(drag.height), drag.quat);
    }
  }

  function onMove(evt) {
    if (renderer.xr.isPresenting) return;
    if (drag) { moveTo(evt); return; }
    setRay(evt);
    const hit = pick();
    const kind = hit?.object.userData.kind;
    game.setHover(KEY, kind === 'piece' ? hit.object.userData.id : null);
    hud.setHover(KEY, kind === 'button' ? hit.object.userData.action : null);
    el.style.cursor = hit ? 'pointer' : 'grab';
  }

  function onWheel(evt) {
    if (!drag) return;
    evt.preventDefault();
    drag.height = THREE.MathUtils.clamp(drag.height - Math.sign(evt.deltaY) * 0.03, 0.55, 1.6);
    moveTo(evt);
  }

  function end(inheritVelocity) {
    if (!drag) return;
    const { id } = drag;
    drag = null;
    controls.enabled = true;
    game.release(id, KEY, { inheritVelocity });
  }

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', () => end(true));
  el.addEventListener('pointercancel', () => end(false));
  el.addEventListener('wheel', onWheel, { passive: false });
  game.registerCanceller(() => { if (drag) { drag = null; controls.enabled = true; } });

  return { cancel: () => end(false) };
}
