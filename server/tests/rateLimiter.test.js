// El cupo de /auth es configurable SOLO fuera de producción (AUTH_RATE_LIMIT_MAX, para
// poder correr la suite E2E local varias veces). En producción tiene que quedar en 20.

const ORIGINAL_ENV = { ...process.env }

function loadLimiter(env) {
  process.env = { ...ORIGINAL_ENV, ...env }
  let mod
  jest.isolateModules(() => { mod = require('../middleware/rateLimiter') })
  return mod
}

afterEach(() => { process.env = { ...ORIGINAL_ENV } })

describe('authLimit', () => {
  it('sin variable: 20 intentos', () => {
    const { authLimit } = loadLimiter({ AUTH_RATE_LIMIT_MAX: '', NODE_ENV: 'development' })
    expect(authLimit()).toBe(20)
  })

  it('en desarrollo, la variable sube el cupo', () => {
    const { authLimit } = loadLimiter({ AUTH_RATE_LIMIT_MAX: '500', NODE_ENV: 'development' })
    expect(authLimit()).toBe(500)
  })

  it('con NODE_ENV=production se ignora aunque esté definida', () => {
    const { authLimit } = loadLimiter({ AUTH_RATE_LIMIT_MAX: '500', NODE_ENV: 'production' })
    expect(authLimit()).toBe(20)
  })

  it('valores inválidos o no positivos no cambian nada', () => {
    for (const v of ['abc', '0', '-5']) {
      const { authLimit } = loadLimiter({ AUTH_RATE_LIMIT_MAX: v, NODE_ENV: 'development' })
      expect(authLimit()).toBe(20)
    }
  })

  it('en producción el intento 21 recibe 429 aunque la variable esté definida', async () => {
    const { authLimiter } = loadLimiter({ AUTH_RATE_LIMIT_MAX: '500', NODE_ENV: 'production' })
    const express = require('express')
    const request = require('supertest')
    const app = express()
    app.post('/auth/login', authLimiter, (req, res) => res.json({ ok: true }))
    let last
    for (let i = 0; i < 21; i++) last = (await request(app).post('/auth/login')).status
    expect(last).toBe(429)
  })
})
