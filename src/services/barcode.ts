// Lector de códigos de barras para el escáner de ISBN.
// - Si el navegador trae BarcodeDetector con EAN-13 (Chrome en Android, macOS, ChromeOS),
//   se usa ese.
// - Si no (Chrome en Windows/Linux, Firefox, Safari), se carga de forma diferida un lector
//   ZXing en WebAssembly (barcode-detector/zxing-wasm, MIT), servido desde el propio sitio:
//   por defecto bajaría el .wasm de un CDN externo, y no queremos depender de terceros.

export interface IsbnDetector {
  engine: 'nativo' | 'zxing'
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}

interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}
interface NativeBarcodeDetectorCtor {
  new (opts: { formats: string[] }): NativeBarcodeDetector
  getSupportedFormats(): Promise<string[]>
}

export async function createIsbnDetector(): Promise<IsbnDetector> {
  const Native = (window as unknown as { BarcodeDetector?: NativeBarcodeDetectorCtor }).BarcodeDetector
  if (Native) {
    try {
      if ((await Native.getSupportedFormats()).includes('ean_13')) {
        return { engine: 'nativo', detect: s => new Native({ formats: ['ean_13'] }).detect(s) }
      }
    } catch { /* sin soporte real: se usa ZXing */ }
  }
  const [{ BarcodeDetector, prepareZXingModule, purgeZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  // El .wasm se carga YA (no en el primer detect): si falla (sin conexión), el escáner lo
  // muestra y ofrece reintentar. Antes la falla aparecía en cada detect, el bucle la tomaba
  // por "fotograma ilegible" y quedaba escaneando para siempre sin avisar.
  try {
    await prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
      fireImmediately: true,
    })
  } catch (err) {
    purgeZXingModule() // que «Reintentar» vuelva a pedirlo en vez de reusar la falla
    throw err
  }
  const detector = new BarcodeDetector({ formats: ['ean_13'] })
  return { engine: 'zxing', detect: s => detector.detect(s as ImageBitmapSource) }
}
