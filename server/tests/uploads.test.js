const fs = require('fs')
const os = require('os')
const path = require('path')

process.env.JWT_SECRET = 'test-secret-key'
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'librook-uploads-'))
process.env.UPLOADS_DIR = TMP

jest.mock('../db', () => ({ query: jest.fn() }))
jest.mock('../middleware/sessionRevocation', () => ({ isRevoked: jest.fn().mockResolvedValue(false) }))

const request = require('supertest')
const express = require('express')
const jwt = require('jsonwebtoken')
const pool = require('../db')
const { jpeg } = require('./fixtures/images')

const app = express()
app.use(express.json({ limit: '10mb' }))
app.use('/uploads', require('../routes/uploads'))

const token = (over = {}) => jwt.sign({ userId: 'u1', email: 'lectora@test.dev', ...over }, process.env.JWT_SECRET)
const files = () => fs.readdirSync(TMP)
const upload = (buf, type = 'image/jpeg', tk = token()) =>
  request(app).post('/uploads').set('Authorization', `Bearer ${tk}`).set('Content-Type', type).send(buf)

beforeEach(() => {
  pool.query.mockReset()
  for (const f of files()) fs.unlinkSync(path.join(TMP, f))
})
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }))

describe('POST /uploads', () => {
  it('sin sesión → 401; cuenta demo → 403; nada en disco', async () => {
    expect((await request(app).post('/uploads').set('Content-Type', 'image/jpeg').send(jpeg())).status).toBe(401)
    expect((await upload(jpeg(), 'image/jpeg', token({ email: 'demo@librook.app' }))).status).toBe(403)
    expect(files()).toHaveLength(0)
  })

  it('guarda una imagen válida con nombre aleatorio, sin metadatos, y la registra', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ files: 0, bytes: 0 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'up-1' }] })
    const res = await upload(jpeg({ width: 1200, height: 900 }))
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ id: 'up-1', width: 1200, height: 900 })
    expect(res.body.url).toMatch(/^\/librook-api\/uploads\/[0-9a-f]{32}\.jpg$/)

    const [name] = files()
    expect(res.body.url.endsWith(name)).toBe(true)
    const saved = fs.readFileSync(path.join(TMP, name))
    expect(saved.toString('binary')).not.toMatch(/GPSLatitude|Exif/)
    if (process.platform !== 'win32') expect(fs.statSync(path.join(TMP, name)).mode & 0o777).toBe(0o600)
    const insert = pool.query.mock.calls[1][1]
    expect(insert).toEqual(['u1', name, 'image/jpeg', saved.length, 1200, 900])
  })

  it('el tipo lo decide el contenido: un HTML con Content-Type image/jpeg se rechaza', async () => {
    const res = await upload(Buffer.from('<html><script>alert(1)</script></html>'))
    expect(res.status).toBe(400)
    expect(files()).toHaveLength(0)
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('más de 5 MB → 413 sin escribir nada', async () => {
    const res = await upload(Buffer.concat([jpeg(), Buffer.alloc(6 * 1024 * 1024)]))
    expect(res.status).toBe(413)
    expect(files()).toHaveLength(0)
  })

  it('cupo agotado → 413 sin escribir nada', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ files: 60, bytes: 1000 }] })
    const res = await upload(jpeg())
    expect(res.status).toBe(413)
    expect(res.body.error).toMatch(/límite/)
    expect(files()).toHaveLength(0)
  })

  it('si falla la base después de escribir, el archivo se borra (no quedan sueltos)', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    pool.query
      .mockResolvedValueOnce({ rows: [{ files: 0, bytes: 0 }] })
      .mockRejectedValueOnce(new Error('db caída'))
    const res = await upload(jpeg())
    expect(res.status).toBe(500)
    expect(files()).toHaveLength(0)
  })
})

describe('GET /uploads/:filename', () => {
  it('rechaza nombres que no son de la forma generada (sin path traversal) sin tocar la base', async () => {
    for (const bad of ['..%2F..%2Fetc%2Fpasswd', 'a.jpg', `${'a'.repeat(32)}.svg`, `${'g'.repeat(32)}.jpg`]) {
      expect((await request(app).get(`/uploads/${bad}`)).status).toBe(404)
    }
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('un nombre válido pero no registrado → 404', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })
    expect((await request(app).get(`/uploads/${'a'.repeat(32)}.jpg`)).status).toBe(404)
  })

  it('sirve la imagen registrada con tipo correcto, nosniff, CSP sandbox y caché inmutable', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ files: 0, bytes: 0 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'up-1' }] })
    const up = await upload(jpeg())
    const name = up.body.url.split('/').pop()
    pool.query.mockResolvedValueOnce({ rows: [{ mime: 'image/jpeg' }] })
    const res = await request(app).get(`/uploads/${name}`).buffer(true)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('image/jpeg')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['content-security-policy']).toMatch(/sandbox/)
    expect(res.headers['cache-control']).toMatch(/immutable/)
    expect(Buffer.compare(res.body, fs.readFileSync(path.join(TMP, name)))).toBe(0)
  })
})

describe('DELETE /uploads/:id', () => {
  it('solo borra imágenes propias que no están en una publicación', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).delete('/uploads/up-ajena').set('Authorization', `Bearer ${token()}`)
    expect(res.status).toBe(404)
    expect(pool.query.mock.calls[0][0]).toMatch(/user_id = \$2 AND listing_id IS NULL/)
  })
})
