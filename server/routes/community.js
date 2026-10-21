const router = require('express').Router()
const auth = require('../middleware/authMiddleware')
const blockDemoWrites = require('../middleware/blockDemoWrites')
const pool = require('../db')

const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const MAX_REFLECTION_LEN = 2000
const MAX_COMMENT_LEN = 500
const DEFAULT_LIMIT = 20

function dbToPost(row) {
  return {
    id: row.id,
    bookId: row.book_id,
    bookTitle: row.book_title,
    bookAuthor: row.book_author,
    bookCover: row.book_cover,
    bookScore: row.book_score,
    reflection: row.reflection,
    createdAt: row.created_at,
    authorAlias: row.author_alias,
    canDelete: row.can_delete,
    likeCount: Number(row.like_count),
    likedByMe: row.liked_by_me,
    commentCount: Number(row.comment_count),
  }
}

function dbToComment(row) {
  return {
    id: row.id,
    postId: row.post_id,
    body: row.body,
    createdAt: row.created_at,
    authorAlias: row.author_alias,
    canDelete: row.can_delete,
  }
}

function isAdmin(req) {
  return req.userEmail === ADMIN_EMAIL
}

async function getPostById(id, userId, admin) {
  const result = await pool.query(
    `SELECT
      p.*,
      COALESCE(u.display_name, split_part(u.email, '@', 1)) AS author_alias,
      (p.user_id = $2 OR $3::boolean) AS can_delete,
      (SELECT COUNT(*) FROM community_likes l WHERE l.post_id = p.id) AS like_count,
      EXISTS(SELECT 1 FROM community_likes l WHERE l.post_id = p.id AND l.user_id = $2) AS liked_by_me,
      (SELECT COUNT(*) FROM community_comments c WHERE c.post_id = p.id) AS comment_count
     FROM community_posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = $1`,
    [id, userId, admin]
  )
  return result.rows[0]
}

router.get('/posts', auth, async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || DEFAULT_LIMIT))
  const before = req.query.before || null
  try {
    const result = await pool.query(
      `SELECT
        p.*,
        COALESCE(u.display_name, split_part(u.email, '@', 1)) AS author_alias,
        (p.user_id = $1 OR $2::boolean) AS can_delete,
        (SELECT COUNT(*) FROM community_likes l WHERE l.post_id = p.id) AS like_count,
        EXISTS(SELECT 1 FROM community_likes l WHERE l.post_id = p.id AND l.user_id = $1) AS liked_by_me,
        (SELECT COUNT(*) FROM community_comments c WHERE c.post_id = p.id) AS comment_count
       FROM community_posts p
       JOIN users u ON u.id = p.user_id
       WHERE ($3::timestamptz IS NULL OR p.created_at < $3)
       ORDER BY p.created_at DESC
       LIMIT $4`,
      [req.userId, isAdmin(req), before, limit]
    )
    const posts = result.rows.map(dbToPost)
    const nextCursor = posts.length === limit ? posts[posts.length - 1].createdAt : null
    res.json({ posts, nextCursor })
  } catch (err) {
    console.error('community get posts error', err)
    res.status(500).json({ error: 'Error al obtener las publicaciones' })
  }
})

router.post('/posts', auth, blockDemoWrites, async (req, res) => {
  const bookId = req.body.bookId
  const reflection = (req.body.reflection || '').trim()
  if (!reflection) return res.status(400).json({ error: 'La reflexión no puede estar vacía' })
  if (reflection.length > MAX_REFLECTION_LEN)
    return res.status(400).json({ error: `La reflexión no puede superar los ${MAX_REFLECTION_LEN} caracteres` })

  try {
    const book = await pool.query(
      `SELECT b.title, b.author, b.cover, b.score, e.obra_id
       FROM books b LEFT JOIN ediciones e ON e.id = b.edition_id
       WHERE b.id = $1 AND b.user_id = $2`,
      [bookId, req.userId]
    )
    if (book.rows.length === 0) return res.status(404).json({ error: 'Libro no encontrado' })
    const b = book.rows[0]

    const result = await pool.query(
      `INSERT INTO community_posts (user_id, book_id, book_title, book_author, book_cover, book_score, reflection, obra_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id, book_id) DO UPDATE SET
         reflection = EXCLUDED.reflection,
         book_title = EXCLUDED.book_title,
         book_author = EXCLUDED.book_author,
         book_cover = EXCLUDED.book_cover,
         book_score = EXCLUDED.book_score,
         obra_id = EXCLUDED.obra_id,
         updated_at = NOW()
       RETURNING id`,
      [req.userId, bookId, b.title, b.author, b.cover, b.score, reflection, b.obra_id]
    )
    const row = await getPostById(result.rows[0].id, req.userId, isAdmin(req))
    res.json(dbToPost(row))
  } catch (err) {
    console.error('community create post error', err)
    res.status(500).json({ error: 'Error al compartir la reflexión' })
  }
})

router.delete('/posts/:id', auth, blockDemoWrites, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM community_posts WHERE id = $1 AND (user_id = $2 OR $3::boolean) RETURNING id',
      [req.params.id, req.userId, isAdmin(req)]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Publicación no encontrada' })
    res.json({ ok: true })
  } catch (err) {
    console.error('community delete post error', err)
    res.status(500).json({ error: 'Error al eliminar la publicación' })
  }
})

router.get('/posts/:id/comments', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        c.*,
        COALESCE(u.display_name, split_part(u.email, '@', 1)) AS author_alias,
        (c.user_id = $2 OR $3::boolean) AS can_delete
       FROM community_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [req.params.id, req.userId, isAdmin(req)]
    )
    res.json({ comments: result.rows.map(dbToComment) })
  } catch (err) {
    console.error('community get comments error', err)
    res.status(500).json({ error: 'Error al obtener los comentarios' })
  }
})

router.post('/posts/:id/comments', auth, blockDemoWrites, async (req, res) => {
  const body = (req.body.body || '').trim()
  if (!body) return res.status(400).json({ error: 'El comentario no puede estar vacío' })
  if (body.length > MAX_COMMENT_LEN)
    return res.status(400).json({ error: `El comentario no puede superar los ${MAX_COMMENT_LEN} caracteres` })

  try {
    const post = await pool.query('SELECT id FROM community_posts WHERE id = $1', [req.params.id])
    if (post.rows.length === 0) return res.status(404).json({ error: 'Publicación no encontrada' })

    const result = await pool.query(
      `INSERT INTO community_comments (post_id, user_id, body) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.id, req.userId, body]
    )
    const alias = await pool.query(
      `SELECT COALESCE(display_name, split_part(email, '@', 1)) AS author_alias FROM users WHERE id = $1`,
      [req.userId]
    )
    const row = result.rows[0]
    res.json(dbToComment({ ...row, author_alias: alias.rows[0].author_alias, can_delete: true }))
  } catch (err) {
    console.error('community create comment error', err)
    res.status(500).json({ error: 'Error al publicar el comentario' })
  }
})

router.delete('/comments/:id', auth, blockDemoWrites, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM community_comments WHERE id = $1 AND (user_id = $2 OR $3::boolean) RETURNING id',
      [req.params.id, req.userId, isAdmin(req)]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Comentario no encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error('community delete comment error', err)
    res.status(500).json({ error: 'Error al eliminar el comentario' })
  }
})

router.post('/posts/:id/likes', auth, blockDemoWrites, async (req, res) => {
  try {
    const post = await pool.query('SELECT id FROM community_posts WHERE id = $1', [req.params.id])
    if (post.rows.length === 0) return res.status(404).json({ error: 'Publicación no encontrada' })

    await pool.query(
      'INSERT INTO community_likes (post_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.params.id, req.userId]
    )
    const count = await pool.query('SELECT COUNT(*) FROM community_likes WHERE post_id = $1', [req.params.id])
    res.json({ liked: true, likeCount: Number(count.rows[0].count) })
  } catch (err) {
    console.error('community like error', err)
    res.status(500).json({ error: 'Error al dar me gusta' })
  }
})

router.delete('/posts/:id/likes', auth, blockDemoWrites, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM community_likes WHERE post_id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    )
    const count = await pool.query('SELECT COUNT(*) FROM community_likes WHERE post_id = $1', [req.params.id])
    res.json({ liked: false, likeCount: Number(count.rows[0].count) })
  } catch (err) {
    console.error('community unlike error', err)
    res.status(500).json({ error: 'Error al quitar el me gusta' })
  }
})

module.exports = router
