# Matriz de pruebas de aceptación

Completar **Resultado observado** y **Evidencia** solo con pruebas reales. Dónde: *PC* = escritorio con Live Server / Pages; *Quest* = Meta Quest 3 obligatorio.

| # | Requisito | Dónde | Cómo probar | Resultado esperado | Resultado observado | Evidencia |
|---|---|---|---|---|---|---|
| 1 | Portada Bootstrap responsiva, favicon, créditos, compatibilidad | PC | Abrir página, modo responsive de DevTools | Diseño adaptable, favicon visible, mensaje WebXR | | |
| 2 | Live Server sin errores | PC | Console y Network | 0 errores, sin 404/CORS | | |
| 3 | Import map carga Three.js y addons | PC | Network: `three.module.js`, `OrbitControls.js`, `XRHandModelFactory.js` desde jsDelivr 0.160.0 | Status 200, una sola versión | | |
| 4 | Despliegue main /(root) HTTPS | PC + Quest | Abrir URL de Pages | Carga igual que local | | |
| 5 | Sesión immersive-vr real y salida segura | Quest | Botón Entrar a VR; luego Salir de VR | Entorno opaco (sin passthrough), regresa a portada | | |
| 6 | Seguimiento mano izq. y der. | Quest | Mostrar ambas manos; leer HUD | «Mano izq: detectada · Mano der: detectada» | | |
| 7 | Apuntar, resaltar, pinza, arrastrar, soltar | Quest | Sin controles físicos | Pieza se ilumina, se mueve con la mano | | |
| 8 | 5 objetos y 5 destinos distintos | PC + Quest | Observación | Forma, color y etiqueta únicas | | |
| 9a | Error de destino | PC + Quest | Soltar cubo sobre destino ESFERA | Rojo, mensaje, contador sin cambio | | |
| 9b | Error de distancia | PC + Quest | Soltar pieza lejos de cualquier destino | Rojo, «muy lejos», contador sin cambio | | |
| 10 | 5 aciertos con snap, verde, sonido, bloqueo | Quest | Colocar cada pieza; intentar volver a tomarla | Se ajusta, verde, sonido, no se puede mover | | |
| 11 | Progreso 0/5→5/5, cronómetro, mensaje final | Quest | Completar el reto | 5/5, tiempo detenido, «¡Completado!» | | |
| 12 | Reiniciar durante y después | Quest | Botón 3D Reiniciar | Todo vuelve a 0/5, 00:00, posiciones iniciales | | |
| 13 | Salir y reentrar VR sin estado corrupto | Quest | Salir (botón y menú Meta), volver a entrar | Sin piezas «pegadas», estado coherente | | |
| 14 | Botones e información 3D en el visor | Quest | Leer HUD, usar botones con pinza | Legible, botones responden con cambio visual | | |
| 15 | Modularidad, assets y créditos | PC | Revisar código y README | Módulos con responsabilidad única, rutas relativas, licencias | | |

**Probado solo en escritorio:** 1, 2, 3, 8, 9 y lógica de 10-12 con ratón.
**Requiere validación física en Meta Quest 3:** 4 (en visor), 5, 6, 7, 10-14.
