const router = require('express').Router()
const auth = require('../middleware/authMiddleware')
const pool = require('../db')

function dbToBook(row) {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    cover: row.cover,
    publisher: row.publisher,
    genre: row.genre,
    isbn: row.isbn,
    pages: row.pages,
    year: row.year,
    score: row.score,
    notes: row.notes,
    startDate: row.start_date,
    endDate: row.end_date,
    color: row.color,
    totalPages: row.total_pages,
    currentPage: row.current_page,
    createdAt: row.created_at,
    wouldReread: row.would_reread || false,
    communityPostId: row.community_post_id || null,
  }
}

router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.*, cp.id AS community_post_id
       FROM books b
       LEFT JOIN community_posts cp ON cp.book_id = b.id AND cp.user_id = b.user_id
       WHERE b.user_id = $1 ORDER BY b.created_at DESC`,
      [req.userId]
    )
    res.json(result.rows.map(dbToBook))
  } catch (err) {
    console.error('get books error', err)
    res.status(500).json({ error: 'Error al obtener libros' })
  }
})

router.post('/', auth, async (req, res) => {
  const b = req.body
  try {
    const result = await pool.query(
      `INSERT INTO books
        (user_id, title, author, cover, publisher, genre, isbn, pages, year, score, notes,
         start_date, end_date, color, total_pages, current_page, would_reread)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        req.userId, b.title, b.author || null, b.cover || null,
        b.publisher || null, b.genre || null, b.isbn || null,
        b.pages ? Number(b.pages) : null,
        b.year ? Number(b.year) : null,
        b.score ? Number(b.score) : null,
        b.notes || null,
        b.startDate || null, b.endDate || null,
        b.color || null,
        b.totalPages ? Number(b.totalPages) : null,
        b.currentPage ? Number(b.currentPage) : null,
        b.wouldReread ? true : false,
      ]
    )
    res.json(dbToBook(result.rows[0]))
  } catch (err) {
    console.error('add book error', err)
    res.status(500).json({ error: 'Error al guardar el libro' })
  }
})

router.put('/:id', auth, async (req, res) => {
  const b = req.body
  try {
    const result = await pool.query(
      `UPDATE books SET
        title=$1, author=$2, cover=$3, publisher=$4, genre=$5, isbn=$6,
        pages=$7, year=$8, score=$9, notes=$10, start_date=$11, end_date=$12,
        color=$13, total_pages=$14, current_page=$15, would_reread=$16, updated_at=NOW()
       WHERE id=$17 AND user_id=$18
       RETURNING *`,
      [
        b.title, b.author || null, b.cover || null,
        b.publisher || null, b.genre || null, b.isbn || null,
        b.pages ? Number(b.pages) : null,
        b.year ? Number(b.year) : null,
        b.score ? Number(b.score) : null,
        b.notes || null,
        b.startDate || null, b.endDate || null,
        b.color || null,
        b.totalPages ? Number(b.totalPages) : null,
        b.currentPage ? Number(b.currentPage) : null,
        b.wouldReread ? true : false,
        req.params.id, req.userId,
      ]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Libro no encontrado' })
    res.json(dbToBook(result.rows[0]))
  } catch (err) {
    console.error('update book error', err)
    res.status(500).json({ error: 'Error al actualizar el libro' })
  }
})

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM books WHERE id = $1 AND user_id = $2', [req.params.id, req.userId])
    res.json({ ok: true })
  } catch (err) {
    console.error('delete book error', err)
    res.status(500).json({ error: 'Error al eliminar el libro' })
  }
})

module.exports = router
