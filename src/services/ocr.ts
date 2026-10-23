// Reconocimiento de texto de una foto de tapa, 100 % en el navegador: la imagen nunca se
// envía a ningún servidor. Tesseract.js se carga recién cuando alguien usa la función, y
// sus archivos (worker, núcleo WASM, modelo de español) se sirven desde /ocr/ del propio
// sitio (ver ocrAssets en vite.config.js), no desde un CDN.

const BASE = `${import.meta.env.BASE_URL}ocr/`
const MAX_SIDE = 1600

export interface OcrResult {
  text: string
  lines: string[]
  confidence: number
  timings: { loadMs: number; recognizeMs: number }
}

// SIMD de WebAssembly: si está, el núcleo es bastante más rápido
function supportsWasmSimd(): boolean {
  try {
    return WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
    ]))
  } catch {
    return false
  }
}

// Escala de grises y tamaño acotado: menos trabajo para el OCR, mismo texto
async function prepare(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.filter = 'grayscale(1) contrast(1.2)'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

export async function recognizeCover(file: Blob, onProgress?: (fraction: number, step: string) => void): Promise<OcrResult> {
  const t0 = performance.now()
  const [{ createWorker }, image] = await Promise.all([import('tesseract.js'), prepare(file)])
  const worker = await createWorker('spa', 1 /* LSTM */, {
    workerPath: `${BASE}worker.min.js`,
    corePath: `${BASE}${supportsWasmSimd() ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js'}`,
    langPath: BASE,
    workerBlobURL: false,
    logger: m => onProgress?.(m.progress ?? 0, m.status),
  })
  const t1 = performance.now()
  try {
    const { data } = await worker.recognize(image)
    const t2 = performance.now()
    const lines = data.text.split('\n').map(l => l.trim()).filter(l => /[\p{L}]{2,}/u.test(l))
    return { text: data.text, lines, confidence: data.confidence, timings: { loadMs: Math.round(t1 - t0), recognizeMs: Math.round(t2 - t1) } }
  } finally {
    await worker.terminate() // libera la memoria (importante en celulares)
  }
}

// Texto para buscar en Open Library a partir de lo reconocido: las primeras líneas con
// letras (en una tapa suelen ser título y autor), sin símbolos sueltos.
export function queryFromLines(lines: string[], max = 3): string {
  return lines
    .slice(0, max)
    .map(l => l.replace(/[^\p{L}\p{N}\s'’.-]/gu, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 120)
}
