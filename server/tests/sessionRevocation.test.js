process.env.JWT_SECRET = 'test-secret-key'

jest.mock('../db', () => ({
  query: jest.fn(),
}))

const request = require('supertest')
const express = require('express')
const jwt = require('jsonwebtoken')
const pool = require('../db')
const { isRevoked } = require('../middleware/sessionRevocation')
const auth = require('../middleware/authMiddleware')

const app = express()
app.get('/private', auth, (req, res) => res.json({ userId: req.userId }))

const now = Math.floor(Date.now() / 1000)
const tokenAt = (iat) => jwt.sign({ userId: 'u1', email: 'u@test.dev', iat }, process.env.JWT_SECRET)

describe('isRevoked', () => {
  beforeEach(() => jest.clearAllMocks())

  it('no revoca si la contraseña nunca cambió', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ password_changed_at: null }] })
    expect(await isRevoked('u1', now)).toBe(false)
  })

  it('revoca un token emitido antes del cambio de contraseña', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ password_changed_at: new Date((now + 60) * 1000) }] })
    expect(await isRevoked('u1', now)).toBe(true)
  })

  it('acepta un token emitido en el mismo segundo o después del cambio', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ password_changed_at: new Date(now * 1000 + 900) }] })
    expect(await isRevoked('u1', now)).toBe(false)
  })

  it('revoca si el usuario ya no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })
    expect(await isRevoked('borrado', now)).toBe(true)
  })
})

describe('authMiddleware + revocación', () => {
  beforeEach(() => jest.clearAllMocks())

  it('401 para una sesión anterior al reset', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ password_changed_at: new Date() }] })
    const res = await request(app).get('/private').set('Authorization', `Bearer ${tokenAt(now - 3600)}`)
    expect(res.status).toBe(401)
  })

  it('200 para una sesión posterior al reset', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ password_changed_at: new Date((now - 3600) * 1000) }] })
    const res = await request(app).get('/private').set('Authorization', `Bearer ${tokenAt(now)}`)
    expect(res.status).toBe(200)
    expect(res.body.userId).toBe('u1')
  })

  it('falla cerrado (500, sin dejar pasar) si la base no responde', async () => {
    pool.query.mockRejectedValueOnce(new Error('db down'))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const res = await request(app).get('/private').set('Authorization', `Bearer ${tokenAt(now)}`)
    expect(res.status).toBe(500)
  })
})
