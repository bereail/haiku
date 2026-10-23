process.env.JWT_SECRET = 'test-secret-key'
process.env.EMAIL_USER = 'test@test.com'
process.env.EMAIL_PASS = 'test'

jest.mock('../db', () => ({
  query: jest.fn(),
}))

const mockSendMail = jest.fn()
jest.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: mockSendMail }),
}))

const crypto = require('crypto')
const request = require('supertest')
const express = require('express')
const pool = require('../db')

const app = express()
app.use(express.json())
app.use('/auth', require('../routes/auth'))

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')
const sqlCalls = () => pool.query.mock.calls.map(([sql, params]) => ({ sql: sql.replace(/\s+/g, ' '), params }))

beforeEach(() => {
  pool.query.mockReset()
  mockSendMail.mockReset().mockResolvedValue(true)
})

describe('forgot-password', () => {
  it('guarda en la base el hash del token, nunca el token que va en el mail', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'u1' }] }) // SELECT usuario
      .mockResolvedValueOnce({ rows: [] })              // INSERT token

    const res = await request(app).post('/auth/forgot-password').send({ email: 'lectora@test.dev' })
    expect(res.status).toBe(200)

    const mailedToken = mockSendMail.mock.calls[0][0].html.match(/reset_token=([0-9a-f]+)/)[1]
    const insert = sqlCalls().find(c => c.sql.includes('INSERT INTO password_reset_tokens'))
    expect(insert.params).not.toContain(mailedToken)
    expect(insert.params).toContain(sha256(mailedToken))
  })

  it('si falla el envío del mail responde igual que para un email inexistente (no revela cuentas)', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'u1' }] })
      .mockResolvedValueOnce({ rows: [] })
    mockSendMail.mockRejectedValueOnce(new Error('SMTP caído'))

    const existing = await request(app).post('/auth/forgot-password').send({ email: 'lectora@test.dev' })

    pool.query.mockResolvedValueOnce({ rows: [] })
    const missing = await request(app).post('/auth/forgot-password').send({ email: 'nadie@test.dev' })

    expect(existing.status).toBe(missing.status)
    expect(existing.body).toEqual(missing.body)
    expect(existing.body).toEqual({ ok: true })
  })
})

describe('reset-password', () => {
  const TOKEN = 'a'.repeat(64)

  it('reclama el token por su hash de forma atómica y anula los demás links del usuario', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }] }) // reclamo atómico
      .mockResolvedValueOnce({ rows: [] })                  // UPDATE users
      .mockResolvedValueOnce({ rows: [] })                  // anular otros tokens

    const res = await request(app).post('/auth/reset-password').send({ token: TOKEN, password: 'nueva1234' })
    expect(res.status).toBe(200)

    const calls = sqlCalls()
    // Un solo UPDATE ... RETURNING que verifica y marca usado a la vez (sin carrera entre
    // dos pedidos con el mismo link), buscando por hash
    expect(calls[0].sql).toMatch(/^UPDATE password_reset_tokens SET used = TRUE WHERE token = \$1 AND used = FALSE AND expires_at > NOW\(\) RETURNING user_id$/)
    expect(calls[0].params).toEqual([sha256(TOKEN)])
    expect(calls.some(c => /UPDATE password_reset_tokens SET used = TRUE WHERE user_id = \$1 AND used = FALSE/.test(c.sql) && c.params[0] === 'u1')).toBe(true)
  })

  it('un token inválido, vencido o ya usado → 400 sin tocar la contraseña', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).post('/auth/reset-password').send({ token: TOKEN, password: 'nueva1234' })
    expect(res.status).toBe(400)
    expect(sqlCalls().some(c => c.sql.startsWith('UPDATE users'))).toBe(false)
  })
})
