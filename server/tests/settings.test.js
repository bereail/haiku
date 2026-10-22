process.env.JWT_SECRET = 'test-secret-key'

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

const app = express()
app.use(express.json())
app.use('/settings', require('../routes/settings'))

function authToken(userId = 'user-1') {
  return jwt.sign({ userId, email: 'user@test.com' }, 'test-secret-key', { expiresIn: '1h' })
}

const CURRENT_YEAR = new Date().getFullYear()

describe('GET /settings/goal', () => {
  beforeEach(() => jest.clearAllMocks())

  it('devuelve la meta guardada del usuario', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ goal_count: 24, goal_year: CURRENT_YEAR }],
    })

    const res = await request(app)
      .get('/settings/goal')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.count).toBe(24)
    expect(res.body.year).toBe(CURRENT_YEAR)
  })

  it('devuelve 0 si no hay meta guardada', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .get('/settings/goal')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.count).toBe(0)
  })

  it('requiere autenticación', async () => {
    const res = await request(app).get('/settings/goal')
    expect(res.status).toBe(401)
  })
})

describe('PUT /settings/goal', () => {
  beforeEach(() => jest.clearAllMocks())

  it('guarda la meta del usuario', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .put('/settings/goal')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ count: 12, year: CURRENT_YEAR })

    expect(res.status).toBe(200)
    expect(res.body.count).toBe(12)
    expect(res.body.year).toBe(CURRENT_YEAR)
  })

  it('normaliza valores negativos a 0', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .put('/settings/goal')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ count: -5, year: CURRENT_YEAR })

    expect(res.status).toBe(200)
    expect(res.body.count).toBe(0)
  })

  it('requiere autenticación', async () => {
    const res = await request(app)
      .put('/settings/goal')
      .send({ count: 10, year: CURRENT_YEAR })

    expect(res.status).toBe(401)
  })
})

describe('GET /settings/profile', () => {
  beforeEach(() => jest.clearAllMocks())

  it('devuelve el alias del usuario', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ display_name: 'Bere', alias: 'Bere' }] })

    const res = await request(app)
      .get('/settings/profile')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.alias).toBe('Bere')
  })

  it('requiere autenticación', async () => {
    const res = await request(app).get('/settings/profile')
    expect(res.status).toBe(401)
  })
})

describe('PUT /settings/profile', () => {
  beforeEach(() => jest.clearAllMocks())

  it('guarda el alias del usuario', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ display_name: 'Bere', alias: 'Bere' }] })

    const res = await request(app)
      .put('/settings/profile')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ displayName: 'Bere' })

    expect(res.status).toBe(200)
    expect(res.body.alias).toBe('Bere')
  })

  it('devuelve 400 si el alias supera los 30 caracteres', async () => {
    const res = await request(app)
      .put('/settings/profile')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ displayName: 'a'.repeat(31) })

    expect(res.status).toBe(400)
  })

  it('requiere autenticación', async () => {
    const res = await request(app).put('/settings/profile').send({ displayName: 'Bere' })
    expect(res.status).toBe(401)
  })
})
