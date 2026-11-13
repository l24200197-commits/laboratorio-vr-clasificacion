# Laboratorio virtual de manipulación y ensamblaje 3D

Práctica **3.1 Introducción a las aplicaciones VR** · Meta Quest 3 · Three.js r160 + WebXR · Bootstrap 5.3

Aplicación web **100 % estática** de realidad virtual inmersiva (`immersive-vr`). El usuario toma cinco piezas geométricas con **seguimiento de manos** (rayo + pinza índice-pulgar), las arrastra y las suelta en su destino. Incluye validación, *snap-to-target*, sonido, contador 0/5, cronómetro, reinicio y salida de VR desde un panel 3D.

- Repositorio: `https://github.com/<usuario>/<repositorio>`
- GitHub Pages: `https://<usuario>.github.io/<repositorio>/`

## Requisitos
- Meta Quest 3 con Meta Quest Browser actualizado y **seguimiento de manos activado**.
- Para desarrollo: Visual Studio Code + extensión Live Server + Git. **Sin Node.js, npm, bundlers ni backend.**

## Ejecución local (sin compilación)
1. Abrir la carpeta en VS Code.
2. Clic derecho en `index.html` → **Open with Live Server** (`http://127.0.0.1:5500/`). No usar `file://`: los módulos ES fallan.
3. En escritorio se ve la portada y una **vista previa 3D de depuración** (arrastrar piezas con ratón). Esto **no es VR**.

> `localhost` de la PC **no** es el `localhost` del visor. La prueba de manos se hace en el Quest con la URL HTTPS de GitHub Pages.

## Publicación en GitHub Pages
1. Crear repositorio **público** y subir los archivos a la rama `main` (raíz).
2. *Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/(root)` → Save*.
3. Esperar 1-2 min y abrir `https://<usuario>.github.io/<repositorio>/`.
4. Todas las rutas internas son **relativas** (`js/main.js`, `css/styles.css`, `assets/favicon.svg`), por eso funcionan bajo el subdirectorio `/<repositorio>/`. El archivo `.nojekyll` evita el procesamiento Jekyll.
5. Depuración: DevTools → *Console* (errores de módulos) y *Network* (404 = ruta incorrecta; fallos en `cdn.jsdelivr.net` = CDN/versión).

## Controles (dentro de VR)
| Acción | Gesto |
|---|---|
| Apuntar | Rayo azul que sale de la mano; la pieza apuntada se ilumina |
| Tomar | Pinza índice + pulgar |
| Arrastrar | Mantener la pinza y mover la mano (se conserva el offset de agarre) |
| Soltar / validar | Abrir la pinza |
| Reiniciar / Salir de VR | Apuntar al botón 3D bajo el panel y pellizcar |

No usar la pinza con la palma hacia la cara: es el gesto de menú del sistema Meta y la app no lo intercepta.

## Import map
Declarado en `index.html` **antes** del `<script type="module">`:
```json
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/" } }
```
El navegador no sabe qué es `import 'three'` (especificador "desnudo"). El import map le dice a qué URL corresponde. La entrada con `/` final mapea un **prefijo**: `three/addons/webxr/XRHandModelFactory.js` → `.../examples/jsm/webxr/XRHandModelFactory.js`. Núcleo y addons usan **la misma versión y el mismo CDN**; si se mezclaran versiones habría dos copias de Three.js con clases incompatibles (`instanceof` falla, errores de materiales, etc.). Los addons importan internamente `'three'`, que también se resuelve por el mismo mapa.

## Arquitectura
| Módulo | Responsabilidad |
|---|---|
| `js/main.js` | Inicialización: renderer, cámara, sesión WebXR (entrar/salir/fin por el sistema), ciclo `setAnimationLoop` |
| `js/config.js` | Datos: piezas, destinos, tolerancia, área de trabajo, posición del HUD |
| `js/state.js` | **Estado central único** (estados de piezas, fase, mensaje, cronómetro, sesión XR). El progreso se *deriva* contando piezas `colocada` → no puede duplicarse |
| `js/rules.js` | Regla de validación pura (identidad de destino + tolerancia) |
| `js/lab.js` | Máquina de estados: tomar, soltar, acierto/error, snap, bloqueo, reinicio, retroalimentación visual |
| `js/scene.js` | Ambiente, mesa, 5 piezas y 5 destinos con geometrías Three.js |
| `js/hud.js` | Panel 3D (canvas → textura) y botones 3D *Reiniciar* / *Salir de VR* |
| `js/xr-hands.js` | Manos XR: modelo de manos, rayo, raycasting, pinza (`selectstart/selectend`), arrastre, pérdida de tracking |
| `js/desktop-pointer.js` | Depuración con ratón en escritorio (no sustituye VR) |
| `js/page-ui.js` | Portada Bootstrap: estado de compatibilidad, errores, botón Entrar a VR |
| `js/audio.js` | Sonidos sintetizados con Web Audio (sin archivos, sin licencias) |
| `js/text.js` | Utilidades de texto sobre texturas |

Flujo: **portada → Entrar a VR → apuntar → pinza (seleccionada) → mover (en movimiento) → soltar → validar → colocada / error → progreso**.

### Reglas de negocio
- Estados de pieza: `disponible → seleccionada → en movimiento → colocada` (o vuelve a `disponible` en error).
- La validación ocurre **solo al soltar**. Distancia = distancia euclidiana 3D entre el centro de la pieza y el centro de referencia del destino más cercano.
- **Acierto**: destino correcto y distancia ≤ `LAB.snapTolerance` (0.07 m, editable en `config.js`). Snap de posición/orientación, verde, sonido, bloqueo, +1.
- **Error de destino** o **error de distancia**: rojo temporal (pieza y destino), sonido grave, mensaje; no suma, no bloquea, la pieza vuelve a su lugar.
- Una pieza `colocada` o sujeta por otra mano no es seleccionable (evita dos manos sobre la misma pieza).
- Prioridad del rayo: botones > piezas; piso, mesa y paredes nunca están en la lista de raycast.
- Cronómetro: inicia al tomar la primera pieza; se detiene en 5/5.
- Reiniciar: suelta selecciones activas y restaura posiciones, orientaciones, materiales, estados, contador y cronómetro (también tras completar).
- Pérdida de tracking durante arrastre / fin de sesión por el sistema: la pieza se libera con seguridad y regresa a su posición inicial.

## Compatibilidad y seguridad
- Detección por capacidades (`navigator.xr.isSessionSupported('immersive-vr')`), no por user-agent.
- Sesión: `immersive-vr`, `local-floor` requerido, `hand-tracking` opcional. **Sin AR, sin passthrough, sin cámaras.**
- Sin secretos, tokens, analítica, `eval` ni backend.

## Rendimiento (optimizaciones aplicadas)
Geometrías primitivas de bajo número de polígonos, sin texturas de imagen, sin sombras ni posprocesado, HUD redibujado solo cuando cambia el texto (~1 vez/s), raycast sobre una lista acotada. **No se afirman FPS**: medir en el visor con Meta Quest Developer Hub / OVR Metrics Tool.

## Créditos y licencias
- Desarrollo: **[Tu nombre]** — [Institución], 2026.
- [Three.js](https://threejs.org) r160 — MIT. Idea de interacción basada en el ejemplo `webxr_vr_handinput_pointerdrag` (no se copió su diseño).
- [Bootstrap](https://getbootstrap.com) 5.3.3 — MIT.
- Favicon, geometrías y sonidos: creación propia.
- Código asistido por un agente de IA (Claude), revisado por el autor.

## Limitaciones conocidas
- La arrastre en escritorio es solo en plano horizontal (depuración).
- El seguimiento de manos depende de la iluminación y de que las manos estén dentro del campo de visión.
- Ver `docs/matriz-pruebas.md`: las pruebas marcadas *Quest* solo pueden aprobarse con evidencia real en el visor.
