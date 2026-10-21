const router = require('express').Router()
const pool = require('../db')
const { catalogLimiter } = require('../middleware/rateLimiter')

router.use(catalogLimiter)

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

function dbToWorkSummary(row) {
  return {
    id: row.id,
    title: row.canonical_title,
    subjects: row.subjects || [],
    firstPublishYear: row.first_publish_year,
    coverUrl: row.cover_url || null,
    authors: row.authors || [],
  }
}

// Catálogo local — sin autenticación. Nunca expone `books` (el ejemplar personal de nadie).
router.get('/works', async (req, res) => {
  const q = (req.query.q || '').trim()
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit) || DEFAULT_LIMIT))
  const cursor = req.query.cursor || null

  try {
    const result = await pool.query(
      `SELECT
        o.id, o.canonical_title, o.subjects, o.first_publish_year,
        (SELECT e.cover_url FROM ediciones e WHERE e.obra_id = o.id AND e.cover_url IS NOT NULL ORDER BY e.created_at LIMIT 1) AS cover_url,
        COALESCE(
          (SELECT array_agg(a.name ORDER BY a.name) FROM obra_autores oa JOIN autores a ON a.id = oa.autor_id WHERE oa.obra_id = o.id),
          '{}'
        ) AS authors
       FROM obras o
       WHERE ($1 = '' OR o.canonical_title ILIKE '%' || $1 || '%')
         AND ($2::timestamptz IS NULL OR o.created_at < $2)
       ORDER BY o.created_at DESC
       LIMIT $3`,
      [q, cursor, limit]
    )
    const works = result.rows.map(dbToWorkSummary)
    const nextCursor = works.length === limit ? result.rows[result.rows.length - 1].created_at : null
    res.json({ works, nextCursor })
  } catch (err) {
    console.error('catalog search error', err)
    res.status(500).json({ error: 'Error al buscar en el catálogo' })
  }
})

router.get('/works/:id', async (req, res) => {
  try {
    const work = await pool.query(
      `SELECT o.id, o.canonical_title, o.subjects, o.first_publish_year, o.ol_work_key, o.source
       FROM obras o WHERE o.id = $1`,
      [req.params.id]
    )
    if (work.rows.length === 0) return res.status(404).json({ error: 'Obra no encontrada' })

    const [authors, editions, reviews, libraryCount] = await Promise.all([
      pool.query(
        `SELECT a.id, a.name FROM obra_autores oa JOIN autores a ON a.id = oa.autor_id
         WHERE oa.obra_id = $1 ORDER BY a.name`,
        [req.params.id]
      ),
      pool.query(
        `SELECT id, title, isbn_13, isbn_10, publisher, publish_year, language, pages, cover_url
         FROM ediciones WHERE obra_id = $1 ORDER BY publish_year DESC NULLS LAST`,
        [req.params.id]
      ),
      pool.query(
        `SELECT p.id, p.reflection, p.book_score, p.created_at,
                COALESCE(u.display_name, split_part(u.email, '@', 1)) AS author_alias
         FROM community_posts p JOIN users u ON u.id = p.user_id
         WHERE p.obra_id = $1 ORDER BY p.created_at DESC LIMIT 20`,
        [req.params.id]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT b.user_id)::int AS count
         FROM books b JOIN ediciones e ON e.id = b.edition_id
         WHERE e.obra_id = $1`,
        [req.params.id]
      ),
    ])

    res.json({
      id: work.rows[0].id,
      title: work.rows[0].canonical_title,
      subjects: work.rows[0].subjects || [],
      firstPublishYear: work.rows[0].first_publish_year,
      olWorkKey: work.rows[0].ol_work_key,
      authors: authors.rows,
      editions: editions.rows.map(e => ({
        id: e.id, title: e.title, isbn13: e.isbn_13, isbn10: e.isbn_10,
        publisher: e.publisher, publishYear: e.publish_year, language: e.language,
        pages: e.pages, coverUrl: e.cover_url,
      })),
      reviews: reviews.rows.map(r => ({
        id: r.id, reflection: r.reflection, score: r.book_score,
        createdAt: r.created_at, authorAlias: r.author_alias,
      })),
      libraryCount: libraryCount.rows[0].count,
    })
  } catch (err) {
    console.error('catalog work detail error', err)
    res.status(500).json({ error: 'Error al obtener la obra' })
  }
})

router.get('/editions/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.title, e.isbn_13, e.isbn_10, e.publisher, e.publish_year, e.language,
              e.pages, e.cover_url, e.obra_id, o.canonical_title AS work_title
       FROM ediciones e JOIN obras o ON o.id = e.obra_id
       WHERE e.id = $1`,
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Edición no encontrada' })
    const e = result.rows[0]
    res.json({
      id: e.id, title: e.title, isbn13: e.isbn_13, isbn10: e.isbn_10,
      publisher: e.publisher, publishYear: e.publish_year, language: e.language,
      pages: e.pages, coverUrl: e.cover_url,
      workId: e.obra_id, workTitle: e.work_title,
    })
  } catch (err) {
    console.error('catalog edition detail error', err)
    res.status(500).json({ error: 'Error al obtener la edición' })
  }
})

module.exports = router
