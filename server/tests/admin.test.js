process.env.JWT_SECRET = 'test-secret-key'
process.env.ADMIN_EMAIL = 'berenicesolohaga@gmail.com'

jest.mock('../db', () => ({
  query: jest.fn(),
}))

// La revocación de sesiones tiene sus propios tests (sessionRevocation.test.js); acá
// se neutraliza para no alterar el orden de las respuestas mockeadas de la base.
jest.mock('../middleware/sessionRevocation', () => ({
  isRevoked: jest.fn().mockResolvedValue(false),
}))

const request = require('supertest')
const express = require('express')
const jwt = require('jsonwebtoken')
const pool = require('../db')

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

const app = express()
app.use(express.json())
app.use('/admin', require('../routes/admin'))

function adminToken() {
  return jwt.sign({ userId: 'admin-1', email: ADMIN_EMAIL }, 'test-secret-key', { expiresIn: '1h' })
}

function userToken() {
  return jwt.sign({ userId: 'user-1', email: 'user@test.com' }, 'test-secret-key', { expiresIn: '1h' })
}

describe('GET /admin/users', () => {
  beforeEach(() => jest.clearAllMocks())

  it('devuelve la lista de usuarios para el admin', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: 'u1', email: 'user1@test.com', created_at: '2024-01-01', book_count: 3 },
        { id: 'u2', email: 'user2@test.com', created_at: '2024-01-02', book_count: 0 },
      ],
    })

    const res = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].email).toBe('user1@test.com')
    expect(res.body[0].book_count).toBe(3)
  })

  it('devuelve 403 para usuarios no-admin', async () => {
    const res = await request(app)
      .get('/admin/users')
      .set('Authorization', `Bearer ${userToken()}`)

    expect(res.status).toBe(403)
  })

  it('devuelve 401 sin autenticación', async () => {
    const res = await request(app).get('/admin/users')
    expect(res.status).toBe(401)
  })
})

describe('GET /admin/users/:id/books', () => {
  beforeEach(() => jest.clearAllMocks())

  it('devuelve los libros de un usuario', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { title: 'El Principito', author: 'Saint-Exupéry', start_date: null, end_date: null, score: null, created_at: '2024-01-01' },
      ],
    })

    const res = await request(app)
      .get('/admin/users/user-1/books')
      .set('Authorization', `Bearer ${adminToken()}`)

    expect(res.status).toBe(200)
    expect(res.body[0].title).toBe('El Principito')
  })
})

describe('PUT /admin/users/:id/password', () => {
  beforeEach(() => jest.clearAllMocks())

  it('resetea la contraseña de un usuario', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'user-1' }] })

    const res = await request(app)
      .put('/admin/users/user-1/password')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ password: 'nuevapass123' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('rechaza contraseñas cortas', async () => {
    const res = await request(app)
      .put('/admin/users/user-1/password')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ password: '123' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/6 caracteres/i)
  })

  it('devuelve 404 si el usuario no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .put('/admin/users/no-existe/password')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ password: 'nuevapass123' })

    expect(res.status).toBe(404)
  })

  it('bloquea a no-admins', async () => {
    const res = await request(app)
      .put('/admin/users/user-1/password')
      .set('Authorization', `Bearer ${userToken()}`)
      .send({ password: 'nuevapass123' })

    expect(res.status).toBe(403)
  })
})
