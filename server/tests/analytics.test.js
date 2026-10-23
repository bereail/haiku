process.env.JWT_SECRET = 'test-secret-key'

jest.mock('../db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
}))

const request = require('supertest')
const express = require('express')
const jwt = require('jsonwebtoken')
const pool = require('../db')

// /analytics/track es público (cuenta visitas sin sesión): no puede aceptar datos
// arbitrarios del cliente ni insertar sin límite.

function makeApp() {
  let app
  jest.isolateModules(() => {
    app = express()
    app.use(express.json({ limit: '10mb' }))
    app.use('/analytics', require('../routes/analytics'))
  })
  return app
}

const flush = () => new Promise(r => setImmediate(r)) // el INSERT ocurre después de responder
const inserted = () => pool.query.mock.calls.map(c => c[1])

describe('POST /analytics/track', () => {
  beforeEach(() => pool.query.mockClear())

  it('ignora el user_email que manda el cliente (no se puede falsificar)', async () => {
    const app = makeApp()
    await request(app).post('/analytics/track').send({ session_id: 's1', path: '/x', user_email: 'falso@victima.com' })
    await flush()
    expect(inserted()).toHaveLength(1)
    expect(inserted()[0]).not.toContain('falso@victima.com')
    expect(inserted()[0][1]).toBeNull()
  })

  it('toma el email del token válido, si lo hay', async () => {
    const app = makeApp()
    const token = jwt.sign({ userId: 'u1', email: 'lectora@test.dev' }, process.env.JWT_SECRET)
    await request(app).post('/analytics/track').set('Authorization', `Bearer ${token}`).send({ session_id: 's1', path: '/x' })
    await flush()
    expect(inserted()[0][1]).toBe('lectora@test.dev')
  })

  it('un token inválido no aporta email (y no rompe el registro)', async () => {
    const app = makeApp()
    await request(app).post('/analytics/track').set('Authorization', 'Bearer basura').send({ session_id: 's1', path: '/x' })
    await flush()
    expect(inserted()[0][1]).toBeNull()
  })

  it('recorta campos largos (no se pueden guardar megabytes por visita)', async () => {
    const app = makeApp()
    const huge = 'a'.repeat(100_000)
    await request(app).post('/analytics/track').send({ session_id: huge, path: '/' + huge, referrer: huge, user_agent: huge })
    await flush()
    const [sessionId, , path, referrer] = inserted()[0]
    expect(sessionId.length).toBeLessThanOrEqual(64)
    expect(path.length).toBeLessThanOrEqual(200)
    expect(referrer.length).toBeLessThanOrEqual(500)
  })

  it('tiene rate limit por IP', async () => {
    const app = makeApp()
    let last
    for (let i = 0; i < 61; i++) {
      last = (await request(app).post('/analytics/track').send({ session_id: 's', path: '/x' })).status
    }
    expect(last).toBe(429)
  })
})
