process.env.JWT_SECRET = 'test-secret-key'

jest.mock('../db', () => ({
  query: jest.fn(),
}))

const request = require('supertest')
const express = require('express')
const pool = require('../db')

const app = express()
app.get('/health', async (_, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true, db: true })
  } catch {
    res.status(503).json({ ok: false, db: false })
  }
})

describe('GET /health', () => {
  beforeEach(() => jest.clearAllMocks())

  it('responde ok cuando la base está disponible', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })

    const res = await request(app).get('/health')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true, db: true })
  })

  it('responde 503 cuando la base no responde', async () => {
    pool.query.mockRejectedValueOnce(new Error('connection refused'))

    const res = await request(app).get('/health')

    expect(res.status).toBe(503)
    expect(res.body).toEqual({ ok: false, db: false })
  })
})
