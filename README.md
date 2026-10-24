# Demo AR

Animación AR anclada a un suelo de baldosas de mármol impreso (pensado para el suelo de una iglesia).
Stack: A-Frame 1.5 + MindAR 1.2.5 (image tracking) + aframe-extras + Vite. APK Android con Capacitor 6.

Las librerías están en `public/vendor/` para que el APK funcione sin conexión.

## Créditos

- Modelo `public/models/fox/fox.glb`: *Fox*, de [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox).
  Modelo de PixelMannen (CC0), rigging y animación de tomkranis (CC-BY 4.0), conversión a glTF de @AsoboStudio y @scurest (CC-BY 4.0).
- Imagen de referencia `public/targets/floor.*`: generada con `tools/generate-floor.py` (propia).
- Narración `public/audio/zorra-y-uvas.mp3`: "La zorra y las uvas", *Las Fábulas de Esopo, vol. 1*, leída por
  paulino para [LibriVox](https://librivox.org/las-fabulas-de-esopo-vol-01) (dominio público en EE. UU.;
  también en [Project Gutenberg #21143](https://www.gutenberg.org/ebooks/21143)). Recortada del segundo 16 al 43
  (sin la presentación de LibriVox) y recodificada a mono 64 kbps.

## Desarrollo

```bash
npm install
npm run dev   # HTTPS en la LAN (certificado autofirmado): abrir https://<ip>:5173 en Chrome Android
```

Prueba rápida: apunta el móvil a `public/targets/floor.png` (en pantalla o impreso, mejor en horizontal sobre la mesa).

## Narración

Al detectar el suelo aparece el botón *Reproducir narración*. Al pulsarlo aparece el zorro corriendo y suena
`public/audio/zorra-y-uvas.mp3`. Mientras suena hay dos botones: *Pausa/Continuar* (también congela al zorro)
y *Detener* (vuelve al principio y oculta al zorro). Si se pierde el suelo, el audio y los botones siguen.
Al acabar, el zorro pasa a la animación `Survey` y el botón ofrece repetir. El botón es necesario: los navegadores móviles solo reproducen audio tras
un toque del usuario. Para cambiar la narración basta con sustituir el MP3 (o el `src` de `<audio id="narration">`).

Subtítulos: `public/audio/zorra-y-uvas.vtt` (WebVTT, texto plano). Cada bloque es `inicio --> fin` en
`minutos:segundos.milésimas` y debajo el texto (un salto de línea dentro del bloque se respeta en pantalla).
Se muestran en blanco sobre negro encima de los botones, siguen visibles en pausa y desaparecen al detener.
Para ajustar un desfase basta con editar los tiempos; para localizar las pausas de la voz:

```bash
ffmpeg -i public/audio/zorra-y-uvas.mp3 -af silencedetect=noise=-35dB:d=0.25 -f null - 2>&1 | grep silence_
```

## Modo gafas (Cardboard)

El botón **Gafas** (arriba a la derecha) pone la página a pantalla completa, la gira a horizontal y divide
la pantalla en dos mitades con la misma imagen (cámara + zorro), para meter el móvil en unas gafas tipo
Cardboard. Dentro de las gafas:

- No hay control táctil (solo la X para salir). Al entrar se olvida la detección anterior y, en cuanto
  MindAR (ya reiniciado para el horizontal) vuelve a reconocer el suelo, empieza una cuenta atrás de
  10 segundos ("Coloca el móvil en las gafas / Empieza en N") para meter el móvil en el visor; sigue aunque
  se pierda el suelo un momento. Al llegar a 0 aparecen el zorro y la narración; al acabar se ve "Fin".
  Para repetir, salir con la X y volver a entrar con *Gafas*.
- Si el navegador no deja empezar el audio solo (pasa si se abre con `?cardboard` sin haber tocado la
  página), aparece "Toca la pantalla para empezar": es el único caso en que se usa un toque.
- Subtítulos y avisos ("Apunta al suelo", cuenta atrás, "Fin") se dibujan en los dos ojos.
- Para salir: el botón X de la esquina superior derecha, o salir de pantalla completa (gesto o botón atrás).

`?cardboard` en la URL activa la pantalla dividida sin pantalla completa (útil para probar).

### Calibrar las gafas (si se ve doble)

Cada mitad tiene que estar centrada en su lente; si no, los ojos no pueden fundir las dos imágenes y se ve
todo dos veces. Las lentes de un Cardboard están a 63,9 mm y su centro a 35 mm del borde inferior de la
pantalla ([perfil de Google](https://support.google.com/cardboard/manufacturers/answer/6324808)), pero los
píxeles por milímetro cambian entre móviles, así que se calibra en cada móvil:

1. Abrir `calibrate.html` (enlace *Calibrar gafas*, debajo del botón *Gafas*) y pulsar *Pantalla completa*.
2. Meter el móvil en las gafas. Debe verse **una sola cruz con un punto rojo a la izquierda y uno azul a la
   derecha** (el rojo solo lo ve el ojo izquierdo y el azul solo el derecho).
3. Valor por defecto: 303 px de separación, el que funciona en el móvil y las gafas de la demo.
   Si se ven dos cruces, sacar el móvil y ajustar *Separación* (− si las cruces se separan hacia fuera) hasta
   que se fundan cómodamente; después *Altura* hasta que la cruz quede en el centro de la vista, y *Zoom* si
   la imagen se corta. Un toque en la imagen oculta los controles.
4. *Probar en la demo* abre el modo gafas con esos valores.

Los valores se guardan en el navegador del móvil (`localStorage`) y los usan tanto `calibrate.html` como el
modo gafas, con el mismo cálculo (`public/cardboard-calibration.js`). No se corrige la distorsión de las
lentes (bordes curvados); se puede añadir más adelante.

Cómo funciona: el componente `cardboard` (en `index.html`) copia en cada fotograma, después del render, la
franja central de la vista normal (vídeo de la cámara + lienzo de A-Frame) en las dos mitades de `#stereo`.
MindAR y la escena no cambian.

Giro del móvil: MindAR prepara su análisis para el tamaño de los fotogramas de la cámara al arrancar y no lo
actualiza; al girar (por ejemplo al entrar en modo gafas, que pone horizontal) dejaba de reconocer el suelo.
`index.html` reinicia MindAR cuando cambia el tamaño del vídeo (sin volver a pedir permiso); tarda un
segundo en volver a detectar el suelo. Antes de reiniciar marca el suelo como perdido: MindAR solo avisa de
`targetFound` si estaba oculto, y sin esto no volvería a avisar tras el reinicio. Limitaciones: ambos ojos ven lo mismo (sin profundidad), no hay corrección
de la distorsión de las lentes y, pegado a los ojos, el retraso del seguimiento se nota más.

## Suelo de referencia

`print/floor-print.png` (4096 px) es la imagen que se imprime; `public/targets/floor.png` (1024 px) y
`floor.mind` son la misma imagen reducida y compilada. Es un damero diagonal de mármol con cada baldosa
distinta (veta, tono, desgaste, grietas): un damero regular confunde al seguimiento porque todas las
esquinas son iguales.

En el centro, una losa en rombo (ocupa las 4 baldosas centrales) lleva un **código QR** a
`https://omnia-makers.github.io/demo-ar/`, hecho con teselas de mármol oscuro y crema y enmarcado en mármol
rojo, para que la cámara del móvil abra la demo. Es nivel H (admite un 30 % dañado o tapado). Comprobado con
OpenCV en vistas simuladas: se lee igual que un QR liso del mismo tamaño, y el seguimiento AR no empeora.
Si el escenario impreso en 3D va a ir en el centro, tapará el QR: en ese caso hay que mover el escenario
(el `position` de `#anchor`) o la losa.

Impresión:
- Tamaño: cuanto más grande, mejor se detecta de lejos y en ángulo. Recomendado 1 × 1 m (4 baldosas de
  unos 25 cm de diagonal por lado); con 4096 px da unos 100 ppp, suficiente para verlo de pie.
- Material: vinilo de suelo **mate** (laminado antideslizante). El brillo refleja las lámparas y rompe el seguimiento.
- Con el escenario encima tapando el centro el seguimiento sigue funcionando (los bordes tienen detalle
  de sobra), pero el QR quedaría tapado.
- Con 1 m, la losa del QR mide unos 36 cm de lado (módulos de ~7 mm): se lee de pie, a 1–2 m.
- Escala del modelo: 1 unidad = ancho impreso. Con 1 m, el zorro (`scale 0.004`) mide unos 60 cm.

Límites medidos con `tools/target-check.html` (simulación con poca luz y el centro tapado):
detecta y sigue bien hasta unos 55° de inclinación respecto a la vertical; por encima de 65° no
funciona ninguna imagen con MindAR. Con el móvil a la altura del pecho, conviene estar a menos de
1–1,5 m del borde del suelo impreso.

Regenerar (otros colores, tamaño, número de baldosas u otra URL en el QR; dependencias en
`tools/requirements.txt`):

```bash
python3 tools/generate-floor.py tools/out/nuevo --size 4096 --tiles 4 --vein-power 1.2 3 --cloud 0.5 --grout-contrast 0.15 --seed 21 \
  --qr https://omnia-makers.github.io/demo-ar/ --qr-texture 3
python3 -m http.server 8099   # y abrir http://localhost:8099/tools/target-check.html?img=out/nuevo/floor.png
```

`target-check.html` compila la imagen, la prueba con varias inclinaciones, distancias, poca luz y el
centro tapado, y da el porcentaje de detección y seguimiento (referencia: el suelo actual con QR da
~60 %, la imagen de ejemplo de MindAR ~56 %). `--qr-texture` controla cuánto mármol lleva el QR: más alto
lo disimula mejor; si algún móvil no lo lee, bajarlo. Para obtener el `.mind`, usar el compilador web de MindAR
(https://hiukim.github.io/mind-ar-js-doc/tools/compile) con `floor.png`.

## Usar nuestro escenario

1. Con otra imagen de referencia: mucho detalle, alto contraste y sin patrones repetidos.
2. Compilarla en https://hiukim.github.io/mind-ar-js-doc/tools/compile y guardar el `.mind` en `public/targets/`.
3. En `index.html`: cambiar `imageTargetSrc`, el modelo en `<a-assets>` y el transform de `#anchor`
   (el ancho de la imagen equivale a 1 unidad; Y hacia arriba en la imagen, Z hacia fuera de ella).
4. Si tiembla, ajustar `filterMinCF` / `filterBeta` en `mindar-image`.

## Ajuste de estabilidad (desde la URL)

Sin volver a desplegar, se pueden probar valores añadiendo parámetros a la URL, por ejemplo
`https://<url>/?beta=10&fov=60`. Si hay alguno de estos parámetros, arriba a la izquierda se muestran
los valores activos.

| Parámetro | Qué hace | Por defecto |
|---|---|---|
| `mincf` | Suavizado en reposo: más bajo = tiembla menos, pero más retraso | 0.0001 (MindAR: 0.001) |
| `beta` | Reacción al movimiento: más alto = menos retraso (menos "patineo") | 0.001 (MindAR: 1000) |
| `fov` | Campo de visión vertical (grados) que MindAR supone para la cámara | 45 |
| `debug` | Sustituye el modelo por un cubo de alambre de lado `cube` (en anchos de imagen) | |
| `cube` | Lado del cubo en modo `debug` | 0.2 |

Calibrar `fov`: coloca en el centro de la imagen una caja real que mida 0.2 veces el ancho de la imagen
(p. ej. 4 cm si la imagen mide 20 cm), abre `?debug` y cambia `fov` (50, 55, 60, 65...) hasta que el cubo
coincida con la caja real desde todos los ángulos. Después fija los valores en `index.html`
(`mindar-image` en `<a-scene>` y el valor por defecto de `fov` en el script).

`public/vendor/mindar-image-aframe.prod.js` lleva un parche: MindAR fija el campo de visión a 45°
y se ha cambiado por `window.MINDAR_FOVY || 45`. Si se actualiza la librería, hay que volver a aplicarlo.

## Publicación en GitHub Pages

`.github/workflows/deploy.yml` compila y publica `dist/` en cada push a `main`.
En el repositorio: *Settings → Pages → Source: GitHub Actions*. La demo queda en
`https://<usuario>.github.io/<repo>/` y desde Chrome Android se puede instalar con *Menú → Instalar app*.

## APK

Requiere un JDK 17+ completo (con `jlink`) y el Android SDK (`~/Android/Sdk`, API 34).

```bash
npm run build && npx cap sync android
cd android && JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ANDROID_HOME=$HOME/Android/Sdk ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```
