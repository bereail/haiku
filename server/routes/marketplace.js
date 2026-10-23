const router = require('express').Router()
const { rateLimit, ipKeyGenerator } = require('express-rate-limit')
const auth = require('../middleware/authMiddleware')
const blockDemoWrites = require('../middleware/blockDemoWrites')
const pool = require('../db')
const storage = require('../images/storage')
const { publicAliasSql } = require('../publicAlias')
const { validateListingInput, KINDS } = require('../validation/listingInput')

// Marketplace de venta / intercambio. Separado de las reseñas de Comunidad (otra tabla y
// otra ruta). Requiere sesión para mirar: ciudad y contacto no quedan expuestos a scraping
// anónimo. Nunca se devuelve email ni id de usuario: solo el alias público.

const PAGE = 24
const isAdmin = (req) => !!process.env.ADMIN_EMAIL && req.userEmail === process.env.ADMIN_EMAIL

const writeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || ipKeyGenerator(req.ip),
  message: { error: 'Demasiados cambios en poco tiempo. Probá de nuevo más tarde.' },
})

const LISTING_SELECT = `
  SELECT l.*, ${publicAliasSql('u.')} AS seller_alias,
         (l.user_id = $1) AS is_mine,
         COALESCE((
           SELECT json_agg(json_build_object('id', p.id, 'filename', p.filename, 'width', p.width, 'height', p.height) ORDER BY p.position)
           FROM uploads p WHERE p.listing_id = l.id
         ), '[]') AS photos
  FROM marketplace_listings l
  JOIN users u ON u.id = l.user_id`

function toListing(row, admin) {
  return {
    id: row.id,
    kind: row.kind,
    bookTitle: row.book_title,
    bookAuthor: row.book_author,
    condition: row.condition,
    price: row.price_cents === null ? null : row.price_cents / 100,
    currency: row.currency,
    description: row.description,
    city: row.city,
    contact: row.contact,
    status: row.status,
    sellerAlias: row.seller_alias,
    isMine: row.is_mine,
    canDelete: row.is_mine || admin,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photos: row.photos.map(p => ({ id: p.id, url: `/librook-api/uploads/${p.filename}`, width: p.width, height: p.height })),
  }
}

// Asigna las fotos (en orden) a la publicación dentro de la transacción. Solo fotos propias
// y libres (o ya de esta publicación). Las que dejan de estar se borran (registro + archivo).
async function syncPhotos(client, listingId, userId, photoIds) {
  const removed = await client.query(
    `DELETE FROM uploads WHERE listing_id = $1 AND NOT (id = ANY($2::uuid[])) RETURNING filename`,
    [listingId, photoIds]
  )
  for (let i = 0; i < photoIds.length; i++) {
    const r = await client.query(
      `UPDATE uploads SET listing_id = $1, position = $2
       WHERE id = $3 AND user_id = $4 AND (listing_id IS NULL OR listing_id = $1) RETURNING id`,
      [listingId, i, photoIds[i], userId]
    )
    if (r.rows.length === 0) {
      const err = new Error('Alguna foto no es tuya o ya está en otra publicación')
      err.status = 400
      throw err
    }
  }
  return removed.rows.map(r => r.filename)
}

async function inTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

function handleError(res, err, label) {
  if (err.status === 400) return res.status(400).json({ error: err.message })
  console.error(label, err)
  res.status(500).json({ error: 'Error en el marketplace' })
}

router.get('/listings', auth, async (req, res) => {
  const kind = KINDS.includes(req.query.kind) ? req.query.kind : null
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : ''
  const mine = req.query.mine === '1'
  const before = typeof req.query.before === 'string' && !Number.isNaN(Date.parse(req.query.before)) ? req.query.before : null
  try {
    const result = await pool.query(
      `${LISTING_SELECT}
       WHERE (CASE WHEN $2 THEN l.user_id = $1 ELSE l.status = 'activa' END)
         AND ($3::text IS NULL OR l.kind = $3)
         AND ($4 = '' OR l.book_title ILIKE '%' || $4 || '%' OR l.book_author ILIKE '%' || $4 || '%')
         AND ($5::timestamptz IS NULL OR l.created_at < $5)
       ORDER BY l.created_at DESC
       LIMIT ${PAGE}`,
      [req.userId, mine, kind, q, before]
    )
    const listings = result.rows.map(r => toListing(r, isAdmin(req)))
    res.json({ listings, nextCursor: listings.length === PAGE ? listings[listings.length - 1].createdAt : null })
  } catch (err) {
    handleError(res, err, 'marketplace list error')
  }
})

router.get('/listings/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(`${LISTING_SELECT} WHERE l.id = $2`, [req.userId, req.params.id])
    const row = result.rows[0]
    // Pausadas/cerradas solo las ve su dueña (y la admin)
    if (!row || (row.status !== 'activa' && !row.is_mine && !isAdmin(req))) {
      return res.status(404).json({ error: 'Publicación no encontrada' })
    }
    res.json(toListing(row, isAdmin(req)))
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Publicación no encontrada' }) // id no-uuid
    handleError(res, err, 'marketplace get error')
  }
})

router.post('/listings', auth, blockDemoWrites, writeLimiter, async (req, res) => {
  try {
    const v = validateListingInput(req.body)
    const id = await inTransaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO marketplace_listings
           (user_id, kind, book_title, book_author, condition, price_cents, description, city, contact)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [req.userId, v.kind, v.bookTitle, v.bookAuthor, v.condition, v.priceCents, v.description, v.city, v.contact]
      )
      await syncPhotos(client, ins.rows[0].id, req.userId, v.photoIds)
      return ins.rows[0].id
    })
    const created = await pool.query(`${LISTING_SELECT} WHERE l.id = $2`, [req.userId, id])
    res.status(201).json(toListing(created.rows[0], isAdmin(req)))
  } catch (err) {
    handleError(res, err, 'marketplace create error')
  }
})

router.put('/listings/:id', auth, blockDemoWrites, writeLimiter, async (req, res) => {
  try {
    const v = validateListingInput(req.body, { requireStatus: true })
    const result = await inTransaction(async (client) => {
      const upd = await client.query(
        `UPDATE marketplace_listings SET
           kind=$1, book_title=$2, book_author=$3, condition=$4, price_cents=$5,
           description=$6, city=$7, contact=$8, status=$9, updated_at=NOW()
         WHERE id=$10 AND user_id=$11 RETURNING id`,
        [v.kind, v.bookTitle, v.bookAuthor, v.condition, v.priceCents, v.description, v.city, v.contact, v.status, req.params.id, req.userId]
      )
      if (upd.rows.length === 0) return null
      return syncPhotos(client, req.params.id, req.userId, v.photoIds)
    })
    if (result === null) return res.status(404).json({ error: 'Publicación no encontrada' })
    for (const f of result) storage.remove(f) // después del COMMIT
    const updated = await pool.query(`${LISTING_SELECT} WHERE l.id = $2`, [req.userId, req.params.id])
    res.json(toListing(updated.rows[0], isAdmin(req)))
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Publicación no encontrada' })
    handleError(res, err, 'marketplace update error')
  }
})

router.delete('/listings/:id', auth, blockDemoWrites, async (req, res) => {
  try {
    const files = await inTransaction(async (client) => {
      const listing = await client.query(
        'SELECT id FROM marketplace_listings WHERE id = $1 AND (user_id = $2 OR $3::boolean) FOR UPDATE',
        [req.params.id, req.userId, isAdmin(req)]
      )
      if (listing.rows.length === 0) return null
      const photos = await client.query('DELETE FROM uploads WHERE listing_id = $1 RETURNING filename', [req.params.id])
      await client.query('DELETE FROM marketplace_listings WHERE id = $1', [req.params.id])
      return photos.rows.map(r => r.filename)
    })
    if (files === null) return res.status(404).json({ error: 'Publicación no encontrada' })
    for (const f of files) storage.remove(f)
    res.json({ ok: true })
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Publicación no encontrada' })
    handleError(res, err, 'marketplace delete error')
  }
})

module.exports = router
