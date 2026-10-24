# Reconocimiento de libros: ISBN y foto de tapa

Todo corre **en el navegador**: ni la imagen de la cámara ni la foto de la tapa se envían a
ningún servidor. Solo el ISBN o el texto reconocido se usan para buscar en Open Library.

## Escaneo de ISBN (cámara)

| Navegador | Lector usado |
|---|---|
| Chrome en Android, macOS, ChromeOS | `BarcodeDetector` nativo |
| Chrome/Edge en Windows y Linux, Firefox, Safari | ZXing en WebAssembly (`barcode-detector` → `zxing-wasm`), cargado solo al abrir el escáner |
| Sin cámara o sin permiso | Mensaje + entrada manual de ISBN |

- El `.wasm` de ZXing (947 kB, 414 kB gzip) se sirve desde el propio sitio
  (`assets/zxing_reader-*.wasm`), no desde jsDelivr. No se precachea en la PWA.
- Solo se aceptan ISBN de libros (EAN-13 978/979) con dígito verificador correcto; la entrada
  manual valida ISBN-10 (con X) e ISBN-13 antes de consultar Open Library.
- Verificado con Playwright: cámara falsa de Chromium con un video del EAN-13 →
  decodificado con ZXing en ~1 s (`e2e/isbn-scanner.spec.ts`).

## Foto de la tapa (OCR)

- Tesseract.js (`tesseract.js` 7, modelo de español `best_int`), cargado solo al usar
  "Identificar por foto".
- Archivos servidos por el sitio en `/librook/ocr/` (plugin `ocrAssets` de `vite.config.js`,
  copiados de `node_modules` al build): `worker.min.js` (111 kB), núcleo LSTM con y sin SIMD
  (3,9 MB c/u; se baja uno), `spa.traineddata.gz` (2,1 MB). **~10 MB más en el webroot.**
  Excluidos del precache de la PWA: solo los baja quien usa el OCR (~6 MB la primera vez).
- La persona siempre confirma: el texto reconocido es editable, se muestran candidatos de Open
  Library y elegir uno solo completa el formulario. Hay "Volver a fotografiar" y "Buscar a
  mano". El reconocimiento **no es infalible**.

### Rendimiento medido (stack local, Chromium de escritorio)

| Medición | Resultado |
|---|---|
| Primera lectura (bajar ~6 MB de localhost + iniciar el motor + leer) | 1,5–1,7 s |
| Reconocimiento propiamente dicho | 0,4–0,7 s |
| Lecturas siguientes (archivos en caché) | 1,1–1,7 s |
| Precisión en tapas sintéticas (texto negro/blanco, fondo de color, rotada 4° y desenfocada, itálica con poco contraste) | texto exacto en los 4 casos |

En un celular con red móvil, la primera vez suma la descarga de ~6 MB. No se midió todavía
con fotos reales de tapas (perspectiva, reflejos, tipografías decorativas, ilustraciones
detrás del texto): ahí la precisión va a ser menor, y por eso el flujo siempre pide
confirmación.

## Manejo de errores y cámara (oct 2026)

- **La cámara nunca queda encendida**: se apaga al leer un ISBN, al cerrar (aunque el lector
  todavía esté cargando) y ante cualquier falla (lector que no carga, `video.play()` que falla).
  Antes, si fallaba la carga del lector, el stream quedaba abierto.
- **El lector ZXing carga su `.wasm` al abrir el escáner**, no en el primer fotograma: si no
  hay conexión, se avisa "No se pudo cargar el lector de códigos" con **Reintentar**. Antes
  el escáner quedaba "escaneando" para siempre sin decir nada.
- **Mensajes según la causa**: permiso denegado (sin Reintentar: hay que habilitarlo en el
  navegador), cámara ocupada por otra app, sin cámara, error genérico. Siempre se ofrece el
  ISBN manual.
- **OCR cancelable**: cerrar el diálogo o elegir otra foto termina el worker de Tesseract
  aunque esté bajando el modelo o leyendo (antes seguía gastando CPU hasta terminar).
- Pruebas: `src/tests/recognition.test.tsx` (cámara y Tesseract simulados) y
  `e2e/isbn-scanner.spec.ts` (cámara falsa de Chromium: se verifica que las pistas de video
  terminen en `ended`, el `.wasm` caído y Reintentar).

## Pruebas manuales pendientes en un celular físico

Nada de esto se probó en un teléfono real (solo cámara simulada de Chromium y fotos de tapa
generadas). Para hacer en Android (Chrome) y iPhone (Safari), con el sitio en HTTPS:

1. **Permiso**: primera vez → el navegador pide la cámara. Negarlo → mensaje "No diste
   permiso…". Habilitarlo en la configuración del sitio y volver a abrir el escáner.
2. **Escaneo**: 3–4 libros reales (978…/979…), con buena luz y con poca luz; código curvo
   en un lomo; anotar cuánto tarda. En Android debería usar el lector nativo (BarcodeDetector);
   en iPhone, ZXing.
3. **Código que no es ISBN** (un producto del súper): tiene que avisar "Ese código no es el
   ISBN de un libro".
4. **Cámara liberada**: abrir el escáner y cerrarlo con la X → la luz/indicador de cámara del
   sistema se apaga enseguida. Lo mismo después de un escaneo exitoso.
5. **Cámara ocupada**: con una videollamada abierta en otra app → mensaje "La cámara está
   ocupada…" y Reintentar después de cerrarla.
6. **Sin conexión** (modo avión) la primera vez que se abre el escáner en iPhone → "No se pudo
   cargar el lector" y Reintentar al volver la red.
7. **Foto de tapa (OCR)**: 5 tapas reales variadas (tipografía simple, decorativa, con
   ilustración, con reflejo, foto torcida). Anotar si propone el libro correcto y el tiempo de
   la primera lectura con datos móviles (~6 MB).
8. **Cancelar el OCR**: tomar una foto y cerrar el diálogo mientras dice "Leyendo…" → el
   teléfono no debería quedar caliente ni lento.
9. **Pantalla chica**: en un teléfono de ~360 px de ancho, el escáner y el diálogo de la tapa
   entran sin scroll horizontal y los botones se pueden tocar con el pulgar.
10. **Tutorial**: entrar por primera vez y recorrerlo entero con el dedo; probar «Probalo» en
    Buscar y Agregar.
