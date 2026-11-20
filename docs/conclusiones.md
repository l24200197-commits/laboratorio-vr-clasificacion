# Conclusiones (plantilla — completar con tu experiencia real y copiarlas a la plataforma)

## Entregables
- URL del repositorio en GitHub:
- URL de GitHub Pages (HTTPS):

## 16.1 Geometría visual, cuerpo rígido, colisionador, gravedad y estados
- **Geometría visual (malla):** triángulos que se dibujan; no participa en la física.
- **Cuerpo rígido:** masa, posición, orientación y velocidades que integra cannon-es en cada paso.
- **Colisionador:** forma simple asociada al cuerpo (Sphere, Box, ConvexPolyhedron) con la que se detectan los contactos.
- **Gravedad:** aceleración de −9.81 m/s² que solo afecta a los cuerpos dinámicos.
- **Tipos:** estático (mesas, botes, piso), dinámico (piezas libres y también la pieza sujeta, guiada por una fuerza de resorte-amortiguador) y cinemático (pieza clasificada y congelada).

## 16.2 Dos problemas concretos y cómo se resolvieron con el agente de IA
1. Problema: … · Diagnóstico: … · Solución:
   *(ejemplo real del desarrollo: un cuerpo cinemático atravesaba mesas y paredes porque cannon-es no resuelve contactos cinemático–estático; primero se añadió un raycast desde el centro, pero las esquinas seguían entrando hasta 3 cm; la solución final fue mantener la pieza sujeta como cuerpo dinámico y moverla con una fuerza limitada, para que el solver de contactos resuelva toda su forma)*
2. Problema: … · Diagnóstico: … · Solución:
   *(ejemplo: evitar el doble conteo por rebotes; se exige reposo continuo de 0.7 s y una bandera `judged` por intento)*

## 16.3 Interpretación de mis métricas
| Métrica | Valor |
|---|---|
| Precisión | |
| Errores | |
| Tiempo global | |
| Llenado ESFERA / CUBO / PIRÁMIDE / PRISMA HEX | |

Interpretación:

## 16.4 Comprobado personalmente en Meta Quest 3
- [ ] Sesión immersive-vr desde GitHub Pages
- [ ] Ambas manos detectadas; pinza sin controles
- [ ] 20 clasificaciones correctas y ≥ 3 erróneas, sin doble conteo
- [ ] Pieza caída al suelo y recuperada
- [ ] Salir y volver a entrar a VR, reiniciar
