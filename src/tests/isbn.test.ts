import { describe, it, expect } from 'vitest'
import { isValidIsbn, isBookEan, normalizeIsbn } from '../services/isbn'

describe('ISBN', () => {
  it('ISBN-13 válidos (con o sin guiones) y su dígito verificador', () => {
    expect(isValidIsbn('978-84-376-0494-7')).toBe(true)  // Cien años de soledad (Cátedra)
    expect(isValidIsbn('9780307474728')).toBe(true)
    expect(isValidIsbn('9780307474729')).toBe(false)     // un dígito mal leído
  })

  it('ISBN-10, incluida la X final', () => {
    expect(isValidIsbn('0-306-40615-2')).toBe(true)
    expect(isValidIsbn('080442957X')).toBe(true)
    expect(isValidIsbn('0306406153')).toBe(false)
  })

  it('un EAN-13 que no es de libro (no empieza con 978/979) no es ISBN', () => {
    expect(isBookEan('7790001001234')).toBe(false)
    expect(isValidIsbn('4006381333931')).toBe(false) // EAN válido de un producto, no un libro
  })

  it('normaliza guiones, espacios y la x minúscula', () => {
    expect(normalizeIsbn(' 080-442957x ')).toBe('080442957X')
  })
})
