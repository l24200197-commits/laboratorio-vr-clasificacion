# Matriz de pruebas de aceptación — 3.2 Interacción virtual

**Dónde:** *PC* = escritorio (Live Server / Pages); *Auto* = `index.html?autoprueba` (física y reglas reales con entradas simuladas); *Quest* = obligatorio en Meta Quest 3.
Las filas *Quest* quedan como **NO PROBADO** hasta tener evidencia real en el visor. La columna *Resultado observado* registra solo lo que se ejecutó.

| # | Requisito | Dónde | Procedimiento | Resultado esperado | Resultado observado | Evidencia |
|---|---|---|---|---|---|---|
| 1 | Aplicación 3.1 ampliada; portada responsiva, favicon, créditos | PC | Abrir la página; DevTools en modo responsive | Portada «3.2», favicon, créditos y enlace a 3.1 | Portada correcta en Chrome de escritorio (agente) | captura de la portada |
| 2 | immersive-vr desde GitHub Pages HTTPS | Quest | Abrir la URL de Pages en Quest Browser → Entrar a VR | Entorno inmersivo opaco | NO PROBADO | |
| 3 | Ambas manos detectadas; pinza toma y suelta sin controles | Quest | Mostrar las manos; leer la línea de manos del panel; tomar y soltar | «Mano izq: detectada · Mano der: detectada» | NO PROBADO | |
| 4 | 4 mesas físicas, 5 piezas por mesa | Auto + PC | Autoprueba; observar la vista previa | 4 mesas, 5,5,5,5 | PASA (Auto) | salida de la autoprueba |
| 5 | 20 piezas, 5 de cada una de las 4 figuras | Auto | Autoprueba | 20 = 4 × 5 | PASA (Auto) | |
| 6 | Reinicio aleatorio distinto; sin solapes ni flotantes | Auto + Quest | Autoprueba (firma distinta, separación ≥ 0.14 m, 20/20 en reposo sobre las mesas) | Configuración nueva y válida | PASA (Auto); visor NO PROBADO | |
| 7 | 4 botes abiertos y rotulados con base y paredes sólidas | Auto + PC | Autoprueba (la pieza no atraviesa la pared); inspección visual | Boca abierta, paredes sólidas | PASA (Auto) | |
| 8 | Caída por gravedad, rebote y reposo | Auto + Quest | Autoprueba: caída al suelo (vy > 0 tras el impacto) y asentamiento en las mesas | Cae, rebota y se estabiliza | PASA (Auto) | |
| 9 | Las piezas chocan entre sí y no atraviesan los botes | Auto + Quest | Autoprueba (pared, tablero, 5 piezas por bote) + observación en el visor | Sin interpenetración visible | PASA (Auto); visor NO PROBADO | |
| 10 | Al soltar se recupera la física dinámica | Auto + Quest | Autoprueba: tipo de cuerpo = DYNAMIC tras soltar | Cae y rebota | PASA (Auto); manos NO PROBADO | |
| 11 | Solo una pieza en reposo dentro del bote correcto suma, una sola vez | Auto + Quest | Autoprueba: +1 y sin cambio tras 3 s más | 1/20, sin dobles | PASA (Auto) | |
| 12 | ≥ 3 depósitos erróneos: aviso y error sin sumar aciertos | Auto + Quest | Autoprueba: 3 errores, aciertos sin cambio, sin repetición | errores = 3 | PASA (Auto); visor NO PROBADO | |
| 13 | Pieza en el suelo recuperable | Auto + Quest | Autoprueba: «recuperable» → vuelve a una mesa | Recuperada | PASA (Auto); visor NO PROBADO | |
| 14 | Panel 0/20→20/20 y 4 × 0/5→5/5 | Auto + Quest | Completar la partida | 20/20 y 5/5 en cada bote | PASA (Auto); visor NO PROBADO | |
| 15 | 4 tiempos de llenado, tiempo global, intentos, precisión y errores | Auto | Autoprueba: tiempos ≤ global; precisión = 20/23 | Fórmulas correctas | PASA (Auto) | |
| 16 | El cronómetro se detiene en 20/20 | Auto | Autoprueba | Tiempo congelado | PASA (Auto) | |
| 17 | Reiniciar restablece la puntuación y genera otro escenario | Auto + Quest | Autoprueba + botón Reiniciar en VR | 0/20, 00:00, nuevas posiciones | PASA (Auto); visor NO PROBADO | |
| 18 | VR y carga web sin errores críticos | PC + Quest | Console/Network; sesión en el visor | Sin 404/CORS ni excepciones | PC: sin errores (Chrome headless); visor NO PROBADO | |
| 19 | URL de GitHub y de Pages públicas | PC + Quest | Abrir en ventana privada y en el visor | Accesibles sin sesión | NO PROBADO (pendiente de publicar) | |
| 20 | Dos problemas reales y conclusiones | Alumno | Redactar en la plataforma | — | Pendiente (alumno) | `docs/conclusiones.md` |

**Probado por el agente en escritorio:** 1, 4–17 (lógica y física con entradas simuladas), 18 (parte PC).
**Requiere Meta Quest 3:** 2, 3, la parte visual y de manos de 6–14 y 17, la parte de visor de 18, y 19.
