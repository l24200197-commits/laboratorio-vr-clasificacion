# 3.2 Interacción virtual — Laboratorio inmersivo de clasificación geométrica

Meta Quest 3 · Three.js r160 + WebXR · **cannon-es 0.20.0** (física real) · Bootstrap 5.3.3 · sitio 100 % estático

Evolución de la práctica **3.1** ([`laboratorio-vr-ensamblaje` @ v3.1](https://github.com/l24200197-commits/laboratorio-vr-ensamblaje/tree/v3.1)). Se conservan la sesión `immersive-vr`, el seguimiento de manos, el rayo y la pinza, el HUD 3D, la portada y la publicación estática. La validación por distancia con *snap-to-target* de la 3.1 se sustituyó por **cuerpos rígidos con gravedad y colisiones**.

El usuario toma con las manos **20 figuras** (5 esferas, 5 cubos, 5 pirámides y 5 prismas hexagonales), repartidas al azar en **4 mesas** (5 por mesa), y las deja caer en **4 botes abiertos**. Un panel 3D registra aciertos 0/20, progreso 0/5 por bote, errores, intentos, precisión, tiempo global y tiempo de llenado de cada bote.

- Repositorio: https://github.com/l24200197-commits/laboratorio-vr-clasificacion
- GitHub Pages: https://l24200197-commits.github.io/laboratorio-vr-clasificacion/
- Autoprueba en línea: https://l24200197-commits.github.io/laboratorio-vr-clasificacion/?autoprueba

## Ejecución local (sin compilación)
1. Abrir la carpeta en VS Code → clic derecho en `index.html` → **Open with Live Server**. No usar `file://`: los módulos ES fallan.
2. En escritorio aparece la portada y una **vista previa NO inmersiva**: pulsa *Comenzar* en el panel 3D y arrastra figuras con el ratón (rueda = altura). Sirve para inspeccionar la física, **no** para probar las manos.
3. **Autoprueba:** `index.html?autoprueba` ejecuta el motor físico y las reglas reales con entradas simuladas (34 comprobaciones: distribución, asentamiento, anti-atravesamiento, acierto, 3 errores, suelo, 20/20, cronómetro, reinicio) y muestra el resultado en la página.

## Publicación en GitHub Pages
*Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/(root)` → Save*. Todas las rutas internas son relativas y `.nojekyll` evita el procesamiento de Jekyll. Abrir la URL HTTPS **en Meta Quest Browser** (el `localhost` de la PC no existe en el visor).

## Tecnologías y versiones (import map en `index.html`)
| Biblioteca | Versión | URL | Licencia |
|---|---|---|---|
| Three.js (núcleo + addons) | 0.160.0 | `cdn.jsdelivr.net/npm/three@0.160.0/…` | MIT |
| cannon-es | 0.20.0 | `cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js` | MIT |
| Bootstrap (solo portada) | 5.3.3 | `cdn.jsdelivr.net/npm/bootstrap@5.3.3/…` | MIT |

**¿Por qué cannon-es?** Es un ES module puro y sin dependencias, así que se carga desde el import map sin npm ni bundler. Incluye cuerpos dinámicos, estáticos y cinemáticos, esferas, cajas y poliedros convexos, fricción, restitución, sueño de cuerpos y raycast físico. Ammo.js/Rapier usan WebAssembly y una inicialización asíncrona más compleja; para 20 cuerpos no hacía falta.

## Arquitectura
| Módulo | Responsabilidad |
|---|---|
| `js/main.js` | Inicialización, sesión WebXR (entrar/salir/fin por el sistema/visibilidad/recentrado), ciclo por frame |
| `js/config.js` | **Datos**: categorías, tamaños, mesas, botes, física, reglas, panel |
| `js/physics-world.js` | Mundo cannon-es, materiales de contacto, **paso fijo + subpasos + interpolación** |
| `js/colliders.js` | Geometría visual y colisionador de cada figura, generados con las mismas medidas |
| `js/environment.js` · `js/tables.js` · `js/bins.js` | Piso, 4 mesas y 4 botes (malla + cuerpo estático) |
| `js/pieces.js` | 20 registros de pieza (**fuente única de verdad**) y estados |
| `js/spawner.js` | Distribución aleatoria pura (5 por mesa, máx. 2 iguales por mesa, sin solapes) |
| `js/grab.js` | Sujeción **cinemática**, barrido anti-atravesamiento, velocidad de liberación |
| `js/rules.js` | Reglas puras: volumen útil del bote, reposo, acierto/error, precisión |
| `js/state.js` | Fase de la partida, errores, tiempos por bote, cronómetro con pausa |
| `js/game.js` | Máquina de estados, validación, conteo sin duplicados, recuperación, resaltado |
| `js/hud.js` | Panel score 3D y botones Comenzar/Reiniciar/Recuperar/Salir |
| `js/xr-hands.js` | Manos XR, rayo, pinza y pérdida de tracking (reutilizado de 3.1) |
| `js/desktop-pointer.js` | Ratón en la vista previa (misma vía física que las manos) |
| `js/page-ui.js` · `js/audio.js` · `js/text.js` | Portada y marcador espejo, sonidos sintetizados, texto en texturas |
| `js/selftest.js` | Autoprueba automática (`?autoprueba`) |

Cada frame: **entrada (pose objetivo) → física de paso fijo → reglas y marcador → render**.

## Decisiones de física
- **Malla ≠ cuerpo rígido ≠ colisionador.** La malla es lo que se dibuja; el cuerpo tiene masa, posición y velocidades; el colisionador es la forma simple con la que se calculan los contactos. `physics-world.js` copia cada frame la pose del cuerpo a la malla, nunca al revés.
- **Colisionadores:** esfera → `Sphere` y cubo → `Box` (ambos exactos); pirámide (5 vértices) y prisma hexagonal (12 vértices) → `ConvexPolyhedron` con los mismos vértices que la malla, exactos porque las figuras ya son convexas. El origen de la pirámide está en su centroide (¼ de la altura) porque cannon-es asume que el centro de masa está en el origen.
- **Estáticos:** piso (caja gruesa), cada mesa (tablero + 4 patas) y cada bote (pedestal + fondo + 4 paredes separadas, **boca abierta** y sin colisionador invisible). Tableros y fondos son más gruesos hacia abajo que su malla para evitar "túneles".
- **Paso fijo:** acumulador con pasos de 1/60 s, cada uno con 2 subpasos de 1/120 s, máximo 4 pasos por frame y delta limitado a 0.1 s. La malla se interpola entre los dos últimos estados (el visor dibuja a 72/90 Hz).
- **Parámetros:** g = −9.81 m/s²; masas 0.12–0.18 kg; fricción 0.5 / restitución 0.25 (pieza–estático) y 0.4 / 0.2 (pieza–pieza); 12 iteraciones del solver; amortiguación angular 0.3 (cannon-es no modela la fricción de rodadura); los cuerpos en reposo se duermen.
- **Sujeción (aproximación técnica):** al pellizcar, el cuerpo pasa a **cinemático**. La mano solo fija una pose objetivo y, antes de cada paso, se calcula la velocidad necesaria para alcanzarla (máx. 4 m/s y 20 rad/s). El cuerpo cinemático empuja a las demás piezas. cannon-es **no** resuelve contactos cinemático–estático, así que un raycast físico desde la posición actual hasta el objetivo detiene la pieza antes de mesas, paredes o piso, y una sonda vertical impide hundirla. Al soltar vuelve a **dinámico**, con la velocidad media de los últimos 0.1 s (máx. 3 m/s y 10 rad/s).

## Reglas de clasificación
- Estados: `disponible → sujeta → en vuelo → estabilizándose → clasificada`, o `→ error → recuperable`; las piezas en el suelo pasan a `recuperable`.
- **Acierto:** el centro de la pieza está dentro del **volumen interior útil** del bote correcto (dentro de las paredes con 5 mm de margen, sobre el fondo y al menos 1 cm por debajo del borde) **y** se mantiene quieto (v < 0.06 m/s, ω < 0.9 rad/s, o dormido) durante **0.7 s continuos**. No hay snap ni teletransporte.
- **Sin doble conteo:** `clasificada` es un estado terminal (la pieza deja de validarse y de ser seleccionable, y su cuerpo se congela en reposo dentro del bote, aunque sigue siendo sólido). Los aciertos se **cuentan** a partir de las piezas clasificadas, no con un contador aparte. Cada intento lleva la bandera `judged`, que solo se reinicia al volver a tomar la pieza o al regresarla a una mesa. Los rebotes y contactos repetidos solo reinician el temporizador de reposo.
- **Error:** reposo dentro de un bote equivocado → +1 error (una sola vez por intento), borde rojo, sonido grave y mensaje. La pieza se puede volver a tomar; si no, a los 5 s vuelve sola a un hueco libre de una mesa.
- **Suelo o fuera de límites:** la pieza se puede tomar del suelo; si sigue ahí 4 s en reposo, vuelve a una mesa. Si sale de los límites o su posición es inválida, vuelve de inmediato. El botón *Recuperar* devuelve todas las piezas en error o en el suelo.
- **Métricas:** intentos = aciertos + errores confirmados; precisión = aciertos / intentos × 100 (0 % sin intentos). El **tiempo de cada bote** son los segundos desde que se pulsa *Comenzar* hasta que su 5.ª pieza queda validada; antes se muestra «pendiente».
- **Cronómetro:** empieza con *Comenzar* (no al cargar la página) y se detiene en 20/20. Se **pausa** al salir de VR, cuando el visor pasa a segundo plano o se oculta la pestaña; se reanuda con *Continuar*. Al pausar se sueltan las piezas sujetas.
- **Reinicio:** nueva distribución aleatoria distinta, todos los contadores a cero y cronómetro a cero. Se reutilizan cuerpos, mallas y materiales, sin crear recursos nuevos.

## Cómo cambiar las figuras o las cantidades
Editar `CATEGORIES` y `SHAPE_SIZES` en `js/config.js`. Las formas disponibles están en `js/colliders.js` (`sphere`, `box`, `pyramid`, `hexPrism`); para añadir otra, crea un kit nuevo con su geometría y su colisionador. También en `config.js`: `PIECES_PER_CATEGORY`, `PIECES_PER_TABLE` y `MAX_SAME_CATEGORY_PER_TABLE` (piezas por mesa × 4 mesas debe dar el total), además de los umbrales de `RULES`.

## Controles en VR
| Acción | Gesto |
|---|---|
| Apuntar | Rayo azul desde la mano; la figura apuntada se ilumina |
| Tomar | Pinza índice + pulgar (una pieza por mano; no se puede tomar una ya clasificada o sujeta por la otra mano) |
| Mover / soltar | Mantener la pinza y mover; abrir la pinza para soltar (la figura conserva el impulso) |
| Botones | Apuntar al botón bajo el panel y pellizcar |

## Esquema del laboratorio (vista superior, metros; el usuario en el origen mira hacia −Z)
```
 z=-1.72                 [ PANEL SCORE  y=1.2–2.1 ]
                    [Comenzar][Reiniciar][Recuperar][Salir]  y=1.1
 z=-1.25      [ MESA 2  x=-0.55 ]      [ MESA 3  x=0.55 ]    tablero y=0.75
 z=-0.55   ┌─────┐ [ESF] [CUBO] [PIR] [HEX] ┌─────┐           botes: fondo 0.55, borde 0.75
           │MESA1│  x=-0.54 … 0.54          │MESA4│           (26×26 cm interior)
 z=-0.35   │x=-1.1│                         │x=1.1│
           └─────┘          ◯ usuario       └─────┘
 z= 0
```
Todo queda a menos de ~1.5 m del usuario, así que basta con girar el cuerpo. Las piezas lejanas se alcanzan con el rayo. Borde de los botes y tableros a 0.75 m; panel a la altura de los ojos.

## Rendimiento
20 cuerpos dinámicos y 9 estáticos con broadphase SAP; los cuerpos en reposo se duermen. Hay 4 geometrías compartidas, mallas de pocos polígonos, sin sombras, sin texturas de imagen y sin posprocesado. El panel solo se redibuja cuando cambia su contenido (≈1 vez/s). **No se afirman FPS**: hay que medirlos en el visor con OVR Metrics Tool o Meta Quest Developer Hub.

## Limitaciones conocidas
- El agarre es a distancia, con rayo y pinza (como en la 3.1). La pieza mantiene el desfase del momento del agarre; no hay agarre por contacto de los dedos y las manos no tienen colisionador.
- Mientras se sujeta, la pieza es cinemática: atraviesa otras piezas cinemáticas (clasificadas o en la otra mano) y el anti-atravesamiento se calcula desde su centro, así que puede rozar superficies unos milímetros.
- Una pieza clasificada se congela; si otra cae encima, la de arriba sí sigue la física.
- Si se deja una pieza errónea en un bote y se desactiva el retorno automático (`autoReturnWrongMs = 0`), hay que sacarla a mano.
- La vista previa de escritorio no prueba el seguimiento de manos. Ver `docs/matriz-pruebas.md`.

## Créditos y licencias
- Desarrollo: **[Tu nombre]** — [Institución], 2026. Código asistido por un agente de IA (Claude) y revisado por el autor.
- Three.js r160, cannon-es 0.20.0 y Bootstrap 5.3.3: licencia MIT. Interacción inspirada en el ejemplo `webxr_vr_handinput_pointerdrag` de Three.js.
- Favicon, geometrías y sonidos (sintetizados con Web Audio): creación propia. No se usan assets de terceros.
