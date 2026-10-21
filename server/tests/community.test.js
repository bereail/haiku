process.env.JWT_SECRET = 'test-secret-key'
process.env.ADMIN_EMAIL = 'berenicesolohaga@gmail.com'

jest.mock('../db', () => ({
  query: jest.fn(),
}))

const request = require('supertest')
const express = require('express')
const jwt = require('jsonwebtoken')
const pool = require('../db')

const app = express()
app.use(express.json())
app.use('/community', require('../routes/community'))

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

function authToken(userId = 'user-1', email = 'user@test.com') {
  return jwt.sign({ userId, email }, 'test-secret-key', { expiresIn: '1h' })
}

function adminToken() {
  return authToken('admin-1', ADMIN_EMAIL)
}

const SAMPLE_POST_ROW = {
  id: 'post-1', user_id: 'user-1', book_id: 'book-1',
  book_title: 'El Principito', book_author: 'Saint-Exupéry', book_cover: null, book_score: 5,
  reflection: 'Una relectura hermosa.', created_at: '2024-01-10T10:00:00Z', updated_at: '2024-01-10T10:00:00Z',
  author_alias: 'user', can_delete: true, like_count: '2', liked_by_me: true, comment_count: '1',
}

const SAMPLE_COMMENT_ROW = {
  id: 'comment-1', post_id: 'post-1', user_id: 'user-1', body: 'Totalmente de acuerdo',
  created_at: '2024-01-10T11:00:00Z', author_alias: 'user', can_delete: true,
}

describe('GET /community/posts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('devuelve el feed de publicaciones', async () => {
    pool.query.mockResolvedValueOnce({ rows: [SAMPLE_POST_ROW] })

    const res = await request(app)
      .get('/community/posts')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.posts[0].bookTitle).toBe('El Principito')
    expect(res.body.posts[0].likeCount).toBe(2)
    expect(res.body.posts[0].likedByMe).toBe(true)
  })

  it('requiere autenticación', async () => {
    const res = await request(app).get('/community/posts')
    expect(res.status).toBe(401)
  })
})

describe('POST /community/posts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('comparte una reflexión y la devuelve', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ title: 'El Principito', author: 'Saint-Exupéry', cover: null, score: 5 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'post-1' }] })
      .mockResolvedValueOnce({ rows: [SAMPLE_POST_ROW] })

    const res = await request(app)
      .post('/community/posts')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ bookId: 'book-1', reflection: 'Una relectura hermosa.' })

    expect(res.status).toBe(200)
    expect(res.body.reflection).toBe('Una relectura hermosa.')
  })

  it('devuelve 404 si el libro no pertenece al usuario', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .post('/community/posts')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ bookId: 'libro-ajeno', reflection: 'Texto' })

    expect(res.status).toBe(404)
  })

  it('devuelve 400 si la reflexión está vacía', async () => {
    const res = await request(app)
      .post('/community/posts')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ bookId: 'book-1', reflection: '   ' })

    expect(res.status).toBe(400)
  })

  it('requiere autenticación', async () => {
    const res = await request(app).post('/community/posts').send({ bookId: 'book-1', reflection: 'Texto' })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /community/posts/:id', () => {
  beforeEach(() => jest.clearAllMocks())

  it('elimina la publicación propia', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'post-1' }] })

    const res = await request(app)
      .delete('/community/posts/post-1')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('devuelve 404 si no es el dueño ni admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .delete('/community/posts/post-ajeno')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(404)
  })

  it('permite al admin eliminar contenido ajeno', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'post-1' }] })

    const res = await request(app)
      .delete('/community/posts/post-1')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

describe('GET /community/posts/:id/comments', () => {
  beforeEach(() => jest.clearAllMocks())

  it('devuelve los comentarios de una publicación', async () => {
    pool.query.mockResolvedValueOnce({ rows: [SAMPLE_COMMENT_ROW] })

    const res = await request(app)
      .get('/community/posts/post-1/comments')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.comments[0].body).toBe('Totalmente de acuerdo')
  })
})

describe('POST /community/posts/:id/comments', () => {
  beforeEach(() => jest.clearAllMocks())

  it('publica un comentario', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'post-1' }] })
      .mockResolvedValueOnce({ rows: [SAMPLE_COMMENT_ROW] })
      .mockResolvedValueOnce({ rows: [{ author_alias: 'user' }] })

    const res = await request(app)
      .post('/community/posts/post-1/comments')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ body: 'Totalmente de acuerdo' })

    expect(res.status).toBe(200)
    expect(res.body.body).toBe('Totalmente de acuerdo')
  })

  it('devuelve 404 si la publicación no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .post('/community/posts/post-ajeno/comments')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ body: 'Comentario' })

    expect(res.status).toBe(404)
  })

  it('requiere autenticación', async () => {
    const res = await request(app).post('/community/posts/post-1/comments').send({ body: 'Comentario' })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /community/comments/:id', () => {
  beforeEach(() => jest.clearAllMocks())

  it('elimina el comentario propio', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'comment-1' }] })

    const res = await request(app)
      .delete('/community/comments/comment-1')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('permite al admin eliminar comentarios ajenos', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'comment-1' }] })

    const res = await request(app)
      .delete('/community/comments/comment-1')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('devuelve 404 si no es el dueño ni admin', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .delete('/community/comments/comment-ajeno')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(404)
  })
})

describe('POST /community/posts/:id/likes', () => {
  beforeEach(() => jest.clearAllMocks())

  it('da me gusta a una publicación', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'post-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })

    const res = await request(app)
      .post('/community/posts/post-1/likes')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.liked).toBe(true)
    expect(res.body.likeCount).toBe(3)
  })

  it('devuelve 404 si la publicación no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .post('/community/posts/post-ajeno/likes')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(404)
  })
})

describe('DELETE /community/posts/:id/likes', () => {
  beforeEach(() => jest.clearAllMocks())

  it('quita el me gusta de una publicación', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })

    const res = await request(app)
      .delete('/community/posts/post-1/likes')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.liked).toBe(false)
    expect(res.body.likeCount).toBe(1)
  })
})
