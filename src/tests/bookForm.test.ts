import { describe, it, expect } from 'vitest'
import { toBookPayload } from '../services/bookForm'

describe('toBookPayload', () => {
  it('convierte los números del formulario ("" → sin dato, "1963" → 1963)', () => {
    const p = toBookPayload({ title: 'Rayuela', author: 'Cortázar', year: '1963', totalPages: '', currentPage: '0' })
    expect(p.year).toBe(1963)
    expect(p.totalPages).toBeUndefined()
    expect(p.currentPage).toBe(0)
  })

  it('en una edición conserva los campos que el formulario no muestra (el PUT reemplaza todo)', () => {
    const p = toBookPayload({ title: 'Rayuela', author: 'Cortázar', year: 1963, isbn: '9788437604572', pages: 736, communityPostId: 'post-1' })
    expect(p).toMatchObject({ isbn: '9788437604572', pages: 736, communityPostId: 'post-1', year: 1963 })
  })

  it('un valor no numérico no llega como NaN', () => {
    expect(toBookPayload({ title: 'x', author: 'y', year: 'abc' }).year).toBeUndefined()
  })
})
