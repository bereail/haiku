const router = require('express').Router()
const express = require('express')
const fs = require('fs')
const { rateLimit, ipKeyGenerator } = require('express-rate-limit')
const auth = require('../middleware/authMiddleware')
const blockDemoWrites = require('../middleware/blockDemoWrites')
const pool = require('../db')
const { processImage, LIMITS } = require('../images/imageFile')
const storage = require('../images/storage')

// Cupo por usuaria (incluye las huérfanas hasta que la limpieza las borre)
const QUOTA = { files: 60, bytes: 60 * 1024 * 1024 }

// Subidas por usuaria (o IP): escribir en disco es caro; frena abusos y loops del cliente
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || ipKeyGenerator(req.ip),
  message: { error: 'Demasiadas imágenes subidas en poco tiempo. Probá de nuevo en unos minutos.' },
})

// El cuerpo es la imagen cruda (sin multipart: sin dependencias). El tipo real lo decide
// processImage por la firma binaria; el Content-Type solo habilita el parser.
const rawImage = express.raw({
  type: ['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'],
  limit: LIMITS.maxBytes + 1024,
})

router.post('/', auth, blockDemoWrites, uploadLimiter, (req, res, next) => {
  rawImage(req, res, (err) => {
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'La imagen supera los 5 MB' })
    if (err) return next(err)
    next()
  })
}, async (req, res) => {
  let image
  try {
    image = processImage(Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0))
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message })
  }

  let filename
  try {
    const used = await pool.query(
      'SELECT COUNT(*)::int AS files, COALESCE(SUM(bytes), 0)::bigint AS bytes FROM uploads WHERE user_id = $1',
      [req.userId]
    )
    const { files, bytes } = used.rows[0]
    if (files >= QUOTA.files || Number(bytes) + image.bytes > QUOTA.bytes) {
      return res.status(413).json({ error: 'Llegaste al límite de imágenes guardadas. Borrá publicaciones o fotos que ya no uses.' })
    }

    filename = storage.save(image.buffer, image.ext)
    const result = await pool.query(
      `INSERT INTO uploads (user_id, filename, mime, bytes, width, height)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [req.userId, filename, image.mime, image.bytes, image.width, image.height]
    )
    res.status(201).json({
      id: result.rows[0].id,
      url: `/librook-api/uploads/${filename}`,
      width: image.width,
      height: image.height,
      bytes: image.bytes,
    })
  } catch (err) {
    // Si falló la base después de escribir el archivo, no dejar archivos sueltos
    if (filename) { try { storage.remove(filename) } catch { /* lo levanta la limpieza */ } }
    console.error('upload error', err)
    res.status(500).json({ error: 'No se pudo guardar la imagen' })
  }
})

// Público por necesidad: un <img> no manda el token. Los nombres son aleatorios de 128 bits
// (no se pueden adivinar ni listar) y solo se sirve lo registrado en la base.
router.get('/:filename', async (req, res) => {
  const { filename } = req.params
  if (!storage.isValidName(filename)) return res.status(404).end()
  try {
    const result = await pool.query('SELECT mime FROM uploads WHERE filename = $1', [filename])
    if (result.rows.length === 0) return res.status(404).end()
    const stream = fs.createReadStream(storage.filePath(filename))
    stream.on('error', () => { if (!res.headersSent) res.status(404).end() })
    res.set({
      'Content-Type': result.rows[0].mime,
      'X-Content-Type-Options': 'nosniff',
      // Si alguien abre la URL directamente, el contenido no puede ejecutar nada
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; sandbox",
      'Content-Disposition': 'inline',
      // El nombre nunca se reutiliza: se puede cachear para siempre
      'Cache-Control': 'public, max-age=31536000, immutable',
    })
    stream.pipe(res)
  } catch (err) {
    console.error('upload get error', err)
    res.status(500).end()
  }
})

// Borrar una imagen propia que todavía no está en una publicación
router.delete('/:id', auth, blockDemoWrites, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM uploads WHERE id = $1 AND user_id = $2 AND listing_id IS NULL RETURNING filename',
      [req.params.id, req.userId]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Imagen no encontrada' })
    storage.remove(result.rows[0].filename)
    res.json({ ok: true })
  } catch (err) {
    console.error('upload delete error', err)
    res.status(500).json({ error: 'No se pudo borrar la imagen' })
  }
})

module.exports = router
module.exports.QUOTA = QUOTA
