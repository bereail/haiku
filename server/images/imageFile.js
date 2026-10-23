// Validación real de imágenes subidas (sin dependencias nativas) y limpieza de metadatos.
//
// No se confía en la extensión ni en el Content-Type del cliente: el tipo sale de la firma
// binaria y las dimensiones del encabezado de cada formato. Antes de guardar se quitan los
// metadatos (EXIF/XMP/IPTC, comentarios, chunks de texto): las fotos de celular traen la
// ubicación GPS de donde se sacaron, y en el marketplace las ven otras personas.

const LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  maxSide: 6000,
  minSide: 50,
  // tope contra "bombas de descompresión" (no decodificamos, el navegador sí). Una foto
  // de celular de 12 MP (4032×3024) entra holgada.
  maxPixels: 25_000_000,
}

const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
const EXT = { jpeg: 'jpg', png: 'png', webp: 'webp' }

class ImageError extends Error {
  constructor(message) {
    super(message)
    this.status = 400
  }
}
const fail = (m) => { throw new ImageError(m) }

function detectType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg'
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  return null
}

// ── JPEG ───────────────────────────────────────────────────────────────────────
// Recorre los segmentos hasta SOS. Devuelve [{ marker, start, end }] (end exclusivo).
function jpegSegments(buf) {
  const segs = []
  let i = 2
  while (i < buf.length) {
    if (buf[i] !== 0xff) fail('Imagen JPEG corrupta')
    while (buf[i] === 0xff) i++ // bytes de relleno
    const marker = buf[i]
    const start = i - 1
    if (marker === 0xda) return { segs, sosStart: start } // SOS: empieza la imagen comprimida
    if (marker === 0xd9) fail('Imagen JPEG sin datos')
    if (i + 2 >= buf.length) fail('Imagen JPEG truncada')
    const len = buf.readUInt16BE(i + 1)
    if (len < 2 || i + 1 + len > buf.length) fail('Imagen JPEG truncada')
    segs.push({ marker, start, end: i + 1 + len })
    i += 1 + len
  }
  fail('Imagen JPEG truncada')
}

const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

function jpegInfo(buf) {
  const { segs, sosStart } = jpegSegments(buf)
  const sof = segs.find(s => SOF_MARKERS.has(s.marker))
  if (!sof) fail('Imagen JPEG sin dimensiones')
  const height = buf.readUInt16BE(sof.start + 5)
  const width = buf.readUInt16BE(sof.start + 7)
  return { width, height, segs, sosStart }
}

// APP1 (EXIF/XMP), APP13 (IPTC/Photoshop), COM: metadatos. Se conservan APP0 (JFIF),
// APP2 (perfil de color ICC) y APP14 (Adobe, necesario para decodificar ciertos JPEG).
const JPEG_DROP = new Set([0xe1, 0xed, 0xfe])

function jpegStrip(buf, segs, sosStart) {
  const parts = [buf.subarray(0, 2)]
  for (const s of segs) if (!JPEG_DROP.has(s.marker)) parts.push(buf.subarray(s.start, s.end))
  parts.push(buf.subarray(sosStart))
  return Buffer.concat(parts)
}

// ── PNG ────────────────────────────────────────────────────────────────────────
function pngChunks(buf) {
  const chunks = []
  let i = 8
  while (i < buf.length) {
    if (i + 12 > buf.length) fail('Imagen PNG truncada')
    const len = buf.readUInt32BE(i)
    const type = buf.toString('ascii', i + 4, i + 8)
    const end = i + 12 + len
    if (end > buf.length) fail('Imagen PNG truncada')
    chunks.push({ type, start: i, end })
    i = end
    if (type === 'IEND') break
  }
  if (!chunks.length || chunks[0].type !== 'IHDR') fail('Imagen PNG corrupta')
  if (chunks[chunks.length - 1].type !== 'IEND') fail('Imagen PNG truncada')
  return chunks
}

const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME'])

function pngInfo(buf) {
  const chunks = pngChunks(buf)
  const ihdr = chunks[0].start + 8
  return { width: buf.readUInt32BE(ihdr), height: buf.readUInt32BE(ihdr + 4), chunks }
}

function pngStrip(buf, chunks) {
  return Buffer.concat([buf.subarray(0, 8), ...chunks.filter(c => !PNG_DROP.has(c.type)).map(c => buf.subarray(c.start, c.end))])
}

// ── WebP ───────────────────────────────────────────────────────────────────────
function webpChunks(buf) {
  const riffSize = buf.readUInt32LE(4)
  if (riffSize + 8 > buf.length) fail('Imagen WebP truncada')
  const chunks = []
  let i = 12
  while (i + 8 <= riffSize + 8) {
    const type = buf.toString('ascii', i, i + 4)
    const size = buf.readUInt32LE(i + 4)
    const end = i + 8 + size + (size % 2) // padding a par
    if (end > buf.length) fail('Imagen WebP truncada')
    chunks.push({ type, start: i, end, data: i + 8 })
    i = end
  }
  if (!chunks.length) fail('Imagen WebP corrupta')
  return chunks
}

function webpInfo(buf) {
  const chunks = webpChunks(buf)
  const first = chunks[0]
  const d = first.data
  let width, height
  if (first.type === 'VP8X') {
    width = 1 + buf.readUIntLE(d + 4, 3)
    height = 1 + buf.readUIntLE(d + 7, 3)
  } else if (first.type === 'VP8 ') {
    if (buf[d + 3] !== 0x9d || buf[d + 4] !== 0x01 || buf[d + 5] !== 0x2a) fail('Imagen WebP corrupta')
    width = buf.readUInt16LE(d + 6) & 0x3fff
    height = buf.readUInt16LE(d + 8) & 0x3fff
  } else if (first.type === 'VP8L') {
    if (buf[d] !== 0x2f) fail('Imagen WebP corrupta')
    const bits = buf.readUInt32LE(d + 1)
    width = 1 + (bits & 0x3fff)
    height = 1 + ((bits >> 14) & 0x3fff)
  } else {
    fail('Imagen WebP corrupta')
  }
  return { width, height, chunks }
}

const WEBP_DROP = new Set(['EXIF', 'XMP '])

function webpStrip(buf, chunks) {
  const kept = chunks.filter(c => !WEBP_DROP.has(c.type)).map(c => Buffer.from(buf.subarray(c.start, c.end)))
  const vp8x = kept.find(k => k.toString('ascii', 0, 4) === 'VP8X')
  if (vp8x) vp8x[8] &= ~(0x08 | 0x04) // apagar flags EXIF y XMP
  const body = Buffer.concat(kept)
  const header = Buffer.alloc(12)
  header.write('RIFF', 0, 'ascii')
  header.writeUInt32LE(body.length + 4, 4)
  header.write('WEBP', 8, 'ascii')
  return Buffer.concat([header, body])
}

/**
 * Valida una imagen y devuelve la versión sin metadatos, lista para guardar.
 * Lanza ImageError (status 400) con un mensaje claro si no es aceptable.
 */
function processImage(input) {
  if (!Buffer.isBuffer(input) || input.length === 0) fail('No se recibió ninguna imagen')
  if (input.length > LIMITS.maxBytes) fail('La imagen supera los 5 MB')
  const type = detectType(input)
  if (!type) fail('El archivo no es una imagen JPEG, PNG o WebP')

  let info, clean
  try {
    if (type === 'jpeg') { info = jpegInfo(input); clean = jpegStrip(input, info.segs, info.sosStart) }
    else if (type === 'png') { info = pngInfo(input); clean = pngStrip(input, info.chunks) }
    else { info = webpInfo(input); clean = webpStrip(input, info.chunks) }
  } catch (err) {
    if (err instanceof ImageError) throw err
    fail('El archivo de imagen está dañado') // lecturas fuera de rango, etc.
  }

  const { width, height } = info
  if (width < LIMITS.minSide || height < LIMITS.minSide) fail(`La imagen es demasiado chica (mínimo ${LIMITS.minSide}×${LIMITS.minSide} px)`)
  if (width > LIMITS.maxSide || height > LIMITS.maxSide || width * height > LIMITS.maxPixels) {
    fail(`La imagen es demasiado grande (máximo ${LIMITS.maxSide} px por lado)`)
  }
  return { type, mime: MIME[type], ext: EXT[type], width, height, bytes: clean.length, buffer: clean }
}

module.exports = { processImage, detectType, ImageError, LIMITS, MIME }
