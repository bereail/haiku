process.env.JWT_SECRET = 'test-secret-key'
process.env.EMAIL_USER = 'test@test.com'
process.env.EMAIL_PASS = 'test'

jest.mock('../db', () => ({
  query: jest.fn(),
}))

jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: jest.fn().mockResolvedValue(true),
  }),
}))

const request = require('supertest')
const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../db')

const app = express()
app.use(express.json())
app.use('/auth', require('../routes/auth'))

describe('POST /auth/register', () => {
  beforeEach(() => jest.clearAllMocks())

  it('registra un usuario nuevo', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'uuid-1', email: 'test@test.com' }] })

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@test.com', password: 'secret123' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body.email).toBe('test@test.com')
  })

  it('rechaza si el email ya existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'uuid-1' }] })

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'existing@test.com', password: 'secret123' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/ya existe/i)
  })

  it('rechaza contraseñas de menos de 6 caracteres', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@test.com', password: '123' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/6 caracteres/i)
  })

  it('rechaza si faltan campos', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@test.com' })

    expect(res.status).toBe(400)
  })
})

describe('POST /auth/login', () => {
  beforeEach(() => jest.clearAllMocks())

  it('loguea con credenciales correctas', async () => {
    const hash = await bcrypt.hash('secret123', 10)
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'uuid-1', email: 'user@test.com', password_hash: hash }],
    })

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'user@test.com', password: 'secret123' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')

    const payload = jwt.verify(res.body.token, 'test-secret-key')
    expect(payload.email).toBe('user@test.com')
  })

  it('rechaza contraseña incorrecta', async () => {
    const hash = await bcrypt.hash('secret123', 10)
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'uuid-1', email: 'user@test.com', password_hash: hash }],
    })

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'user@test.com', password: 'wrongpass' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/incorrectos/i)
  })

  it('rechaza email inexistente', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'noexiste@test.com', password: 'secret123' })

    expect(res.status).toBe(400)
  })
})

describe('Rate limiting', () => {
  beforeEach(() => jest.clearAllMocks())

  it('bloquea después de superar el límite de intentos de login', async () => {
    pool.query.mockResolvedValue({ rows: [] })

    let lastStatus
    for (let i = 0; i < 21; i++) {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'noexiste@test.com', password: 'secret123' })
      lastStatus = res.status
    }

    expect(lastStatus).toBe(429)
  })
})

describe('POST /auth/forgot-password', () => {
  beforeEach(() => jest.clearAllMocks())

  it('responde ok aunque el email no exista (seguridad)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'noexiste@test.com' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('envía el email cuando el usuario existe', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'uuid-1' }] })
      .mockResolvedValueOnce({ rows: [] })

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'real@test.com' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
