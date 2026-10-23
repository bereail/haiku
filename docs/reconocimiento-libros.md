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
