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

describe('GET /admin/analytics — zona horaria', () => {
  beforeEach(() => jest.clearAllMocks())

  // La primera consulta pregunta a Postgres si conoce la zona; el resto son las métricas.
  function mockZoneKnown(ok) {
    pool.query.mockImplementation(sql =>
      Promise.resolve({ rows: [/pg_timezone_names/.test(sql) ? { ok } : {}] }))
  }
  const metricCalls = () => pool.query.mock.calls.filter(c => c[1] && !/pg_timezone_names/.test(c[0]))
  const get = q => request(app).get(`/admin/analytics${q}`).set('Authorization', `Bearer ${adminToken()}`)

  it('usa la zona del panel si Postgres la conoce', async () => {
    mockZoneKnown(true)
    const res = await get('?tz=America/Argentina/Buenos_Aires&offset=180')

    expect(res.status).toBe(200)
    expect(metricCalls().map(c => c[1][0])).toEqual(Array(3).fill('America/Argentina/Buenos_Aires'))
    const sql = pool.query.mock.calls.map(c => c[0]).join('\n')
    expect(sql).not.toMatch(/CURRENT_DATE|DATE\(created_at\)/)
  })

  it('con un alias que Postgres no conoce, usa el desfase del navegador', async () => {
    mockZoneKnown(false)
    const res = await get('?tz=America/Buenos_Aires&offset=180')

    expect(res.status).toBe(200)
    for (const [sql, params] of metricCalls()) {
      expect(params).toEqual(['-180 minutes'])
      expect(sql).toMatch(/AT TIME ZONE \$1::interval/)
    }
  })

  it.each([
    ['', 'sin parámetros'],
    ["?tz=UTC'; DROP TABLE users; --&offset=1e9", 'zona con inyección y desfase fuera de rango'],
    [`?tz=${'x'.repeat(100)}&offset=abc`, 'zona larguísima y desfase no numérico'],
  ])('usa UTC si no hay datos válidos (%s → %s)', async q => {
    mockZoneKnown(false)
    const res = await get(q)

    expect(res.status).toBe(200)
    expect(metricCalls().map(c => c[1][0])).toEqual(Array(3).fill('UTC'))
  })

  it('no le pregunta a Postgres por una zona con caracteres raros', async () => {
    mockZoneKnown(true)
    await get(`?tz=${encodeURIComponent("UTC'; --")}`)
    expect(pool.query.mock.calls.some(c => /pg_timezone_names/.test(c[0]))).toBe(false)
  })
})
