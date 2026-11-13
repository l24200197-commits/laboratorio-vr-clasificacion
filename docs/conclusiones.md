# Conclusiones (plantilla — completar con tu experiencia real)

## Entregables
- URL repositorio GitHub: 
- URL GitHub Pages (HTTPS): 
- URL video en Meta Quest 3: 

## 16.1 Lo aprendido
- **Three.js:** escena, cámara, renderer, materiales y el ciclo `setAnimationLoop`, necesario porque en WebXR el visor controla el ritmo de los frames.
- **WebXR:** la sesión `immersive-vr` se pide con un gesto del usuario y desde HTTPS; la compatibilidad se detecta con `navigator.xr.isSessionSupported`.
- **Seguimiento de manos:** cada mano es un `XRInputSource` con articulaciones; su *target-ray space* da el rayo y la pinza produce `selectstart/selectend`.
- **Raycasting:** se lanza un rayo desde la mano y se calcula la intersección solo contra piezas disponibles y botones.
- **Import maps:** permiten usar `import 'three'` en el navegador sin npm, apuntando a un CDN con versión fija.

## 16.2 Dos problemas y su solución
1. Problema: … · Diagnóstico (Console/Network/visor): … · Cómo ayudó la IA: …
2. Problema: … · Diagnóstico: … · Cómo ayudó la IA: …

## 16.3 Bootstrap vs. controles 3D
Bootstrap y el DOM solo existen en la portada web (fuera de VR). Dentro de la sesión inmersiva el navegador muestra únicamente lo que renderiza WebGL, así que el contador, el cronómetro, los mensajes y los botones Reiniciar/Salir se construyeron como mallas 3D con texturas de canvas, seleccionables con rayo y pinza.

## 16.4 Comprobado personalmente en Meta Quest 3
- [ ] …
