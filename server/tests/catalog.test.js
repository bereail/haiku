process.env.JWT_SECRET = 'test-secret-key'

jest.mock('../db', () => ({
  query: jest.fn(),
}))

const request = require('supertest')
const express = require('express')
const pool = require('../db')

const app = express()
app.use(express.json())
app.use('/catalog', require('../routes/catalog'))

const SAMPLE_WORK = {
  id: 'work-1', canonical_title: 'Cien años de soledad', subjects: ['Realismo mágico'],
  first_publish_year: 1967, cover_url: null, authors: ['Gabriel García Márquez'],
  created_at: '2026-01-01T00:00:00Z',
}

describe('GET /catalog/works', () => {
  beforeEach(() => jest.clearAllMocks())

  it('permite buscar sin autenticación', async () => {
    pool.query.mockResolvedValueOnce({ rows: [SAMPLE_WORK] })

    const res = await request(app).get('/catalog/works?q=cien')

    expect(res.status).toBe(200)
    expect(res.body.works).toHaveLength(1)
    expect(res.body.works[0].title).toBe('Cien años de soledad')
  })

  it('no requiere token (visitante anónimo)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).get('/catalog/works')
    expect(res.status).toBe(200)
  })

  it('devuelve libraryCount (0 si no viene la columna)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [SAMPLE_WORK] })
    const res = await request(app).get('/catalog/works')
    expect(res.body.works[0].libraryCount).toBe(0)
  })

  it('sort=popular pasa "popular" a la consulta; cualquier otro valor cae al orden de siempre', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ ...SAMPLE_WORK, library_count: '7' }] })
    const res = await request(app).get('/catalog/works?sort=popular')
    expect(pool.query.mock.calls[0][1]).toEqual(['', null, 20, 'popular'])
    expect(res.body.works[0].libraryCount).toBe(7)

    pool.query.mockResolvedValueOnce({ rows: [] })
    await request(app).get('/catalog/works?sort=lo-que-sea')
    expect(pool.query.mock.calls[1][1]).toEqual(['', null, 20, 'recent'])
  })
})

describe('GET /catalog/works/:id', () => {
  beforeEach(() => jest.clearAllMocks())

  it('devuelve 404 si la obra no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).get('/catalog/works/no-existe')
    expect(res.status).toBe(404)
  })

  it('devuelve la ficha pública con ediciones, autores y reseñas, sin exponer datos personales', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'work-1', canonical_title: 'Rayuela', subjects: [], first_publish_year: 1963, ol_work_key: '/works/OL1W', source: 'openlibrary' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'autor-1', name: 'Julio Cortázar' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'ed-1', title: 'Rayuela', isbn_13: '9780307474728', isbn_10: null, publisher: 'Sudamericana', publish_year: 1963, language: 'es', pages: 600, cover_url: null }] })
      .mockResolvedValueOnce({ rows: [{ id: 'post-1', reflection: 'Una relectura imprescindible', book_score: 5, created_at: '2026-01-01', author_alias: 'lectora1' }] })
      .mockResolvedValueOnce({ rows: [{ count: 3 }] })

    const res = await request(app).get('/catalog/works/work-1')

    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Rayuela')
    expect(res.body.authors).toEqual([{ id: 'autor-1', name: 'Julio Cortázar' }])
    expect(res.body.editions).toHaveLength(1)
    expect(res.body.reviews[0].authorAlias).toBe('lectora1')
    expect(res.body.libraryCount).toBe(3)
    // Nunca debe aparecer nada propio de `books` (notas, fechas de lectura, email, etc.)
    expect(JSON.stringify(res.body)).not.toMatch(/notes|start_date|end_date|email/i)
  })
})

describe('GET /catalog/editions/:id', () => {
  beforeEach(() => jest.clearAllMocks())

  it('devuelve 404 si la edición no existe', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })
    const res = await request(app).get('/catalog/editions/no-existe')
    expect(res.status).toBe(404)
  })

  it('devuelve el detalle de una edición', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'ed-1', title: 'Rayuela', isbn_13: '9780307474728', isbn_10: null, publisher: 'Sudamericana', publish_year: 1963, language: 'es', pages: 600, cover_url: null, obra_id: 'work-1', work_title: 'Rayuela' }],
    })
    const res = await request(app).get('/catalog/editions/ed-1')
    expect(res.status).toBe(200)
    expect(res.body.workId).toBe('work-1')
  })
})
