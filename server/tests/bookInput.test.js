const { validateBookInput, COVER_DATA_MAX } = require('../validation/bookInput')

const ok = (b, opts) => validateBookInput({ title: 'Rayuela', ...b }, opts)
const err = (b, opts) => { try { ok(b, opts); return null } catch (e) { return e } }

describe('validateBookInput', () => {
  it('acepta un libro válido y normaliza (trim, 0 = sin dato, números desde strings)', () => {
    const v = ok({ title: '  Rayuela ', author: ' Cortázar ', score: '4', pages: 0, year: '1963', startDate: '2026-01-05', endDate: '2026-02-10' })
    expect(v).toMatchObject({ title: 'Rayuela', author: 'Cortázar', score: 4, pages: null, year: 1963, startDate: '2026-01-05', endDate: '2026-02-10' })
  })

  it('título obligatorio y topes de longitud', () => {
    expect(err({ title: '   ' }).message).toBe('El título es obligatorio')
    expect(err({ title: 'x'.repeat(201) }).status).toBe(400)
    expect(err({ author: 'x'.repeat(151) }).message).toMatch(/150/)
    expect(err({ notes: 'x'.repeat(10001) }).message).toMatch(/10000/)
    expect(err({ title: { $gt: '' } }).message).toMatch(/formato/)
  })

  it('tapa: solo imagen subida (JPEG/PNG/WebP) o de Open Library — nada de URLs propias', () => {
    expect(ok({ cover: 'https://covers.openlibrary.org/b/id/123-L.jpg' }).cover).toMatch(/^https:\/\/covers/)
    expect(ok({ cover: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' }).cover).toMatch(/^data:image\/jpeg/)
    expect(err({ cover: 'https://rastreo.example/pixel.gif?u=1' }).message).toMatch(/Open Library/)
    expect(err({ cover: 'http://covers.openlibrary.org/b/id/1.jpg' }).status).toBe(400) // sin https
    expect(err({ cover: 'javascript:alert(1)' }).status).toBe(400)
    expect(err({ cover: 'data:image/svg+xml;base64,PHN2Zz4=' }).message).toMatch(/JPEG, PNG o WebP/)
    expect(err({ cover: 'data:image/jpeg;base64,' + 'A'.repeat(COVER_DATA_MAX) }).message).toMatch(/demasiado grande/)
  })

  it('en una edición, la tapa que el libro ya tenía se acepta aunque sea de otro origen', () => {
    const legacy = 'https://books.google.com/cover.jpg'
    expect(ok({ cover: legacy }, { existingCover: legacy }).cover).toBe(legacy)
    expect(err({ cover: 'https://otro.example/x.jpg' }, { existingCover: legacy }).status).toBe(400)
  })

  it('puntaje 0-5, enteros en rango, color y fechas reales', () => {
    expect(err({ score: 9 }).message).toMatch(/puntaje/)
    expect(err({ score: 2.5 }).status).toBe(400)
    expect(err({ pages: -10 }).status).toBe(400)
    expect(err({ year: 99999 }).status).toBe(400)
    expect(err({ color: 'red; background:url(x)' }).message).toMatch(/color/)
    expect(err({ startDate: '2026-02-30' }).message).toMatch(/fecha de inicio/)
    expect(err({ endDate: 'mañana' }).message).toMatch(/fecha de fin/)
    expect(err({ isbn: '978<script>' }).status).toBe(400)
  })

  it('acepta fechas con hora (backups de versiones anteriores) y las recorta', () => {
    expect(ok({ startDate: '2026-01-01T03:00:00.000Z' }).startDate).toBe('2026-01-01')
  })
})
