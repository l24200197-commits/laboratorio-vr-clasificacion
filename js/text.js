// Utilidades para dibujar texto en texturas (el DOM/Bootstrap NO existe dentro de VR).
import * as THREE from 'three';

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, ctx, texture };
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Plano con una etiqueta de texto centrada. */
export function makeLabel(text, { width = 0.16, height = 0.05, bg = '#0f172a', fg = '#ffffff', border = null } = {}) {
  const px = 512;
  const { ctx, texture } = makeCanvas(px, Math.round(px * (height / width)));
  const { width: cw, height: ch } = ctx.canvas;
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, cw, ch, ch * 0.25);
  ctx.fill();
  if (border) { ctx.lineWidth = 8; ctx.strokeStyle = border; ctx.stroke(); }
  ctx.fillStyle = fg;
  ctx.font = `bold ${Math.round(ch * 0.55)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cw / 2, ch / 2);
  texture.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
}
