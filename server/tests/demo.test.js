process.env.JWT_SECRET = 'test-secret-key'
process.env.EMAIL_USER = 'test@test.com'
process.env.EMAIL_PASS = 'test'

jest.mock('../db', () => ({
  query: jest.fn(),
}))

const mockSendMail = jest.fn().mockResolvedValue(true)
jest.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: mockSendMail }),
}))

const request = require('supertest')
const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../db')
const auth = require('../middleware/authMiddleware')
const blockDemoWrites = require('../middleware/blockDemoWrites')
const { DEMO_EMAIL } = require('../demoAccount')

// La cuenta demo es compartida: tiene que ser de solo lectura por identidad,
// no solo cuando se entra por /auth/demo-login.

const app = express()
app.use(express.json())
app.use('/auth', require('../routes/auth'))
app.post('/write', auth, blockDemoWrites, (req, res) => res.json({ ok: true }))

const sign = (payload) => jwt.sign(payload, process.env.JWT_SECRET)

describe('blockDemoWrites por identidad', () => {
  it('bloquea un token de la demo aunque no traiga isDemo', async () => {
    const token = sign({ userId: 'demo-id', email: DEMO_EMAIL })
    const res = await request(app).post('/write').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('bloquea un token de la demo con isDemo: false explícito', async () => {
    const token = sign({ userId: 'demo-id', email: DEMO_EMAIL, isDemo: false })
    const res = await request(app).post('/write').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('no bloquea a un usuario común', async () => {
    const token = sign({ userId: 'u1', email: 'lectora@test.dev', isDemo: false })
    const res = await request(app).post('/write').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})

describe('Cuenta demo en /auth', () => {
  beforeEach(() => jest.clearAllMocks())

  it('login normal con la contraseña de la demo devuelve un token de solo lectura', async () => {
    const hash = await bcrypt.hash('conocida123', 4)
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'demo-id', email: DEMO_EMAIL, password_hash: hash }] })

    const res = await request(app).post('/auth/login').send({ email: DEMO_EMAIL, password: 'conocida123' })

    expect(res.status).toBe(200)
    expect(res.body.isDemo).toBe(true)
    expect(jwt.decode(res.body.token).isDemo).toBe(true)
  })

  it('forgot-password para la demo responde ok pero no crea token ni manda mail', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'demo-id' }] })

    const res = await request(app).post('/auth/forgot-password').send({ email: 'Demo@Librook.app' })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
    expect(mockSendMail).not.toHaveBeenCalled()
    expect(pool.query).toHaveBeenCalledTimes(1) // solo el SELECT, ningún INSERT de token
  })

  it('no permite registrar el email de la demo aunque la cuenta todavía no exista', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const res = await request(app).post('/auth/register').send({ email: DEMO_EMAIL, password: 'secret123' })

    expect(res.status).toBe(400)
    expect(pool.query).toHaveBeenCalledTimes(1) // ningún INSERT
  })
})
