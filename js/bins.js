// Cuatro recipientes ABIERTOS: base y cuatro paredes físicas separadas (sin tapa ni colisionador
// invisible en la boca), sobre un pedestal. Cada uno tiene color, rótulo y un icono de su figura.
import * as THREE from 'three';
import { BIN, CATEGORIES } from './config.js';
import { makeCanvas, roundRect } from './text.js';

/**
 * @returns {Map<string, {id, category, label, color, cx, cz, half, baseY, rimY,
 *   rimMaterial, flashUntil:number, flashColor:number, setCount:(n:number)=>void}>}
 */
export function buildBins(scene, physics, kitsByCategory) {
  const bins = new Map();
  const a = BIN.innerSize / 2;
  const { wallThickness: t, wallHeight: H, baseTopY: yb, baseThickness: bt, baseColliderThickness: bct, pedestalSize: ps } = BIN;
  const outer = BIN.innerSize + 2 * t;

  CATEGORIES.forEach((cat, i) => {
    const cx = BIN.xs[i];
    const cz = BIN.z;
    const group = new THREE.Group();
    group.name = `bote-${cat.id}`;
    group.position.set(cx, 0, cz);

    const color = new THREE.Color(cat.color);
    const wallMat = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.55), roughness: 0.6 });
    const baseMat = new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.3), roughness: 0.8 });
    const rimMat = new THREE.MeshBasicMaterial({ color: cat.color });

    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); group.add(m); return m; };
    // Pedestal + base + paredes (la boca queda completamente abierta)
    add(new THREE.BoxGeometry(ps, yb - bt, ps), baseMat, 0, (yb - bt) / 2, 0);
    add(new THREE.BoxGeometry(outer, bt, outer), baseMat, 0, yb - bt / 2, 0);
    const wallX = new THREE.BoxGeometry(outer, H, t);
    const wallZ = new THREE.BoxGeometry(t, H, BIN.innerSize);
    add(wallX, wallMat, 0, yb + H / 2, -(a + t / 2));
    add(wallX, wallMat, 0, yb + H / 2, a + t / 2);
    add(wallZ, wallMat, -(a + t / 2), yb + H / 2, 0);
    add(wallZ, wallMat, a + t / 2, yb + H / 2, 0);
    // Borde luminoso: marca la boca y sirve de retroalimentación (verde/rojo)
    const rimX = new THREE.BoxGeometry(outer + 0.004, 0.012, t + 0.004);
    const rimZ = new THREE.BoxGeometry(t + 0.004, 0.012, BIN.innerSize);
    add(rimX, rimMat, 0, yb + H, -(a + t / 2));
    add(rimX, rimMat, 0, yb + H, a + t / 2);
    add(rimZ, rimMat, -(a + t / 2), yb + H, 0);
    add(rimZ, rimMat, a + t / 2, yb + H, 0);

    // Letrero vertical detrás de la boca: nombre + contador + icono de la figura
    const sign = makeSign(cat);
    sign.mesh.position.set(0, yb + H + 0.085, -(a + t));
    group.add(sign.mesh);
    const icon = new THREE.Mesh(kitsByCategory.get(cat.id).geometry, new THREE.MeshStandardMaterial({ color: cat.color, roughness: 0.4 }));
    icon.scale.setScalar(0.55);
    icon.position.set(0, yb + H + 0.2, -(a + t));
    group.add(icon);
    scene.add(group);

    // Física: un cuerpo estático con 6 cajas (pedestal, fondo grueso, 4 paredes)
    physics.addStatic(
      [
        { halfExtents: [ps / 2, (yb - bct) / 2, ps / 2], offset: [0, (yb - bct) / 2, 0] },
        { halfExtents: [outer / 2, bct / 2, outer / 2], offset: [0, yb - bct / 2, 0] },
        { halfExtents: [outer / 2, H / 2, t / 2], offset: [0, yb + H / 2, -(a + t / 2)] },
        { halfExtents: [outer / 2, H / 2, t / 2], offset: [0, yb + H / 2, a + t / 2] },
        { halfExtents: [t / 2, H / 2, a], offset: [-(a + t / 2), yb + H / 2, 0] },
        { halfExtents: [t / 2, H / 2, a], offset: [a + t / 2, yb + H / 2, 0] },
      ],
      { position: [cx, 0, cz], name: `bote-${cat.id}` },
    );

    bins.set(cat.id, {
      id: `bote-${cat.id}`,
      category: cat.id,
      label: cat.label,
      color: cat.color,
      cx, cz, half: a, baseY: yb, rimY: yb + H,
      rimMaterial: rimMat,
      flashUntil: 0,
      flashColor: cat.color,
      icon,
      setCount: sign.setCount,
    });
  });
  return bins;
}

function makeSign(cat) {
  const { ctx, texture } = makeCanvas(512, 160);
  const hex = `#${cat.color.toString(16).padStart(6, '0')}`;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.094),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
  );
  let last = -1;
  function setCount(n) {
    if (n === last) return;
    last = n;
    ctx.clearRect(0, 0, 512, 160);
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, 4, 4, 504, 152, 30);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = n >= 5 ? '#22c55e' : hex;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold 58px system-ui, sans-serif';
    ctx.fillText(cat.label, 28, 82);
    ctx.textAlign = 'right';
    ctx.fillStyle = n >= 5 ? '#86efac' : '#e2e8f0';
    ctx.fillText(`${n}/5`, 486, 82);
    texture.needsUpdate = true;
  }
  setCount(0);
  return { mesh, setCount };
}
