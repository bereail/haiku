// Achica una foto en el navegador antes de subirla: lado mayor de hasta 1600 px, JPEG, y
// calidad descendente hasta quedar por debajo de TARGET_BYTES. Al redibujar en un canvas se
// descartan todos los metadatos (EXIF con GPS incluido); el servidor igual valida y limpia.
// El tope de ~900 KB mantiene las subidas por debajo del límite por defecto de nginx (1 MB).

export const MAX_SIDE = 1600
export const TARGET_BYTES = 900 * 1024
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', quality)
  })
}

export async function resizeForUpload(file: File): Promise<Blob> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Elegí una imagen JPEG, PNG o WebP')
  }
  let bitmap: ImageBitmap
  try {
    // Respeta la orientación de la foto (EXIF) al dibujarla
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('No se pudo leer la imagen. Probá con otra foto.')
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff' // PNG con transparencia → fondo blanco en JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  let quality = 0.85
  let blob = await toBlob(canvas, quality)
  while (blob.size > TARGET_BYTES && quality > 0.5) {
    quality -= 0.1
    blob = await toBlob(canvas, quality)
  }
  if (blob.size > TARGET_BYTES) throw new Error('La imagen es demasiado pesada incluso reducida. Probá con otra foto.')
  return blob
}
