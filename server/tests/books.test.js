process.env.JWT_SECRET = 'test-secret-key'

jest.mock('../db', () => ({
  query: jest.fn(),
}))

const request = require('supertest')
const express = require('express')
const jwt = require('jsonwebtoken')
const pool = require('../db')

const app = express()
app.use(express.json())
app.use('/books', require('../routes/books'))

function authToken(userId = 'user-1', email = 'user@test.com', isDemo = false) {
  return jwt.sign({ userId, email, isDemo }, 'test-secret-key', { expiresIn: '1h' })
}

const SAMPLE_ROW = {
  id: 'book-1', user_id: 'user-1', title: 'El Principito', author: 'Saint-Exupéry',
  cover: null, publisher: null, genre: null, isbn: null, pages: 96, year: 1943,
  score: 5, notes: null, start_date: '2024-01-01', end_date: '2024-01-10',
  color: null, total_pages: null, current_page: null, created_at: '2024-01-10T10:00:00Z',
  updated_at: '2024-01-10T10:00:00Z', would_reread: true,
}

describe('GET /books', () => {
  beforeEach(() => jest.clearAllMocks())

  it('devuelve la lista de libros del usuario', async () => {
    pool.query.mockResolvedValueOnce({ rows: [SAMPLE_ROW] })

    const res = await request(app)
      .get('/books')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body[0].title).toBe('El Principito')
    expect(res.body[0].startDate).toBe('2024-01-01')
  })

  it('requiere autenticación', async () => {
    const res = await request(app).get('/books')
    expect(res.status).toBe(401)
  })
})

describe('POST /books', () => {
  beforeEach(() => jest.clearAllMocks())

  it('crea un libro y lo devuelve', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ ...SAMPLE_ROW, id: 'book-new' }] })

    const res = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ title: 'El Principito', author: 'Saint-Exupéry', score: 5 })

    expect(res.status).toBe(200)
    expect(res.body.title).toBe('El Principito')
  })

  it('requiere autenticación', async () => {
    const res = await request(app).post('/books').send({ title: 'Libro' })
    expect(res.status).toBe(401)
  })
})

describe('PUT /books/:id', () => {
  beforeEach(() => jest.clearAllMocks())

  it('actualiza un libro existente', async () => {
    const updated = { ...SAMPLE_ROW, score: 4 }
    pool.query.mockResolvedValueOnce({ rows: [updated] })

    const res = await request(app)
      .put('/books/book-1')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ title: 'El Principito', author: 'Saint-Exupéry', score: 4 })

    expect(res.status).toBe(200)
    expect(res.body.score).toBe(4)
  })

  it('devuelve 404 si el libro no pertenece al usuario', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .put('/books/libro-ajeno')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ title: 'Libro' })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /books/:id', () => {
  beforeEach(() => jest.clearAllMocks())

  it('elimina un libro', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .delete('/books/book-1')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('requiere autenticación', async () => {
    const res = await request(app).delete('/books/book-1')
    expect(res.status).toBe(401)
  })
})

describe('POST /books — vínculo con el catálogo (editionId)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rechaza un editionId que no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }) // resolveEditionId: no existe

    const res = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ title: 'Rayuela', editionId: 'edicion-inexistente' })

    expect(res.status).toBe(400)
  })

  it('guarda el libro con editionId cuando la edición existe', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'edicion-1' }] }) // resolveEditionId: existe
      .mockResolvedValueOnce({ rows: [{ ...SAMPLE_ROW, id: 'book-new', edition_id: 'edicion-1' }] })

    const res = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ title: 'Rayuela', editionId: 'edicion-1' })

    expect(res.status).toBe(200)
    expect(res.body.editionId).toBe('edicion-1')
  })
})

describe('Modo invitado (demo) — solo lectura', () => {
  beforeEach(() => jest.clearAllMocks())

  it('permite leer con la cuenta demo', async () => {
    pool.query.mockResolvedValueOnce({ rows: [SAMPLE_ROW] })

    const res = await request(app)
      .get('/books')
      .set('Authorization', `Bearer ${authToken('demo-1', 'demo@librook.app', true)}`)

    expect(res.status).toBe(200)
  })

  it('bloquea crear libros con la cuenta demo', async () => {
    const res = await request(app)
      .post('/books')
      .set('Authorization', `Bearer ${authToken('demo-1', 'demo@librook.app', true)}`)
      .send({ title: 'Libro' })

    expect(res.status).toBe(403)
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('bloquea editar libros con la cuenta demo', async () => {
    const res = await request(app)
      .put('/books/book-1')
      .set('Authorization', `Bearer ${authToken('demo-1', 'demo@librook.app', true)}`)
      .send({ title: 'Libro' })

    expect(res.status).toBe(403)
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('bloquea borrar libros con la cuenta demo', async () => {
    const res = await request(app)
      .delete('/books/book-1')
      .set('Authorization', `Bearer ${authToken('demo-1', 'demo@librook.app', true)}`)

    expect(res.status).toBe(403)
    expect(pool.query).not.toHaveBeenCalled()
  })
})
