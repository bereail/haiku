const fs = require('fs')
const os = require('os')
const path = require('path')

process.env.JWT_SECRET = 'test-secret-key'
jest.mock('../db', () => ({ query: jest.fn() }))
jest.mock('../middleware/sessionRevocation', () => ({ isRevoked: jest.fn().mockResolvedValue(false) }))

const request = require('supertest')
const express = require('express')
const jwt = require('jsonwebtoken')
const pool = require('../db')
const storage = require('../images/storage')
const { jpeg } = require('./fixtures/images')

const SERVER_DIR = path.resolve(__dirname, '..')
const ORIGINAL = process.env.UPLOADS_DIR
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.UPLOADS_DIR
  else process.env.UPLOADS_DIR = ORIGINAL
  pool.query.mockReset()
})

describe('resolveUploadsDir', () => {
  const prod = { isDevCheckout: false }

  it('sin UPLOADS_DIR en el servidor no hay default: error', () => {
    expect(storage.resolveUploadsDir({}, prod).error).toMatch(/no está configurada/)
    expect(storage.resolveUploadsDir({ UPLOADS_DIR: '   ' }, prod).error).toMatch(/no está configurada/)
  })

  it('sin UPLOADS_DIR en una copia de desarrollo usa <repo>/.uploads', () => {
    const r = storage.resolveUploadsDir({}, { isDevCheckout: true })
    expect(r).toEqual({ dir: path.resolve(SERVER_DIR, '..', '.uploads'), isDefault: true })
  })

  it('rechaza rutas relativas', () => {
    expect(storage.resolveUploadsDir({ UPLOADS_DIR: 'uploads' }, prod).error).toMatch(/absoluta/)
    expect(storage.resolveUploadsDir({ UPLOADS_DIR: './x' }, prod).error).toMatch(/absoluta/)
  })

  it('rechaza carpetas que nginx sirve o que el deploy reemplaza', () => {
    for (const dir of ['/var/www', '/var/www/html/haiku/uploads', '/var/www/.uploads', path.join(SERVER_DIR, 'uploads'), SERVER_DIR]) {
      expect(storage.resolveUploadsDir({ UPLOADS_DIR: dir }, prod).error).toMatch(/no puede estar dentro/)
    }
  })

  it('acepta una ruta absoluta fuera de esas carpetas (sin confundir prefijos)', () => {
    expect(storage.resolveUploadsDir({ UPLOADS_DIR: '/var/lib/haiku/uploads' }, prod))
      .toEqual({ dir: path.resolve('/var/lib/haiku/uploads') })
    expect(storage.resolveUploadsDir({ UPLOADS_DIR: '/var/www-uploads' }, prod).error).toBeUndefined()
  })
})

describe('con UPLOADS_DIR inválida', () => {
  const app = express()
  app.use('/uploads', require('../routes/uploads'))
  const token = jwt.sign({ userId: 'u1', email: 'lectora@test.dev' }, process.env.JWT_SECRET)

  it('la subida responde 503 sin leer el cuerpo ni tocar la base', async () => {
    process.env.UPLOADS_DIR = 'relativa/no-vale'
    const res = await request(app).post('/uploads').set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'image/jpeg').send(jpeg(10, 10))
    expect(res.status).toBe(503)
    expect(res.body.error).toMatch(/no está disponible/)
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('servir una imagen responde 503 (no 500)', async () => {
    process.env.UPLOADS_DIR = 'relativa/no-vale'
    pool.query.mockResolvedValueOnce({ rows: [{ mime: 'image/jpeg' }] })
    const res = await request(app).get(`/uploads/${'a'.repeat(32)}.jpg`)
    expect(res.status).toBe(503)
  })

  it('borrar no falla: sin carpeta no hay archivos', () => {
    process.env.UPLOADS_DIR = 'relativa/no-vale'
    expect(storage.remove(`${'a'.repeat(32)}.jpg`)).toBe(false)
  })

  it('uploadsDir lanza un error identificable', () => {
    process.env.UPLOADS_DIR = 'relativa/no-vale'
    expect(() => storage.uploadsDir()).toThrow(expect.objectContaining({ code: 'UPLOADS_NOT_CONFIGURED' }))
  })
})

describe('checkUploadsConfig (arranque)', () => {
  const log = () => ({ error: jest.fn(), warn: jest.fn() })

  it('con configuración inválida avisa y NO tira abajo el servidor', () => {
    process.env.UPLOADS_DIR = 'relativa'
    const l = log()
    expect(storage.checkUploadsConfig(l)).toEqual({ ok: false, error: expect.stringMatching(/absoluta/) })
    expect(l.error).toHaveBeenCalledWith(expect.stringMatching(/DESHABILITADA/))
  })

  it('con una carpeta válida la crea (700) y confirma que se puede escribir', () => {
    const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'haiku-cfg-')), 'uploads')
    process.env.UPLOADS_DIR = dir
    const l = log()
    expect(storage.checkUploadsConfig(l)).toEqual({ ok: true, dir })
    expect(fs.statSync(dir).isDirectory()).toBe(true)
    expect(l.error).not.toHaveBeenCalled()
    if (process.platform !== 'win32') expect(fs.statSync(dir).mode & 0o777).toBe(0o700)
  })

  ;(process.platform === 'win32' ? it.skip : it)('avisa si la carpeta existente tiene permisos abiertos', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'haiku-cfg-'))
    fs.chmodSync(dir, 0o755)
    process.env.UPLOADS_DIR = dir
    const l = log()
    expect(storage.checkUploadsConfig(l).ok).toBe(true)
    expect(l.warn).toHaveBeenCalledWith(expect.stringMatching(/permisos 755/))
  })
})
