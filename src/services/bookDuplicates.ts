import type { Book } from '../types'

// Detección de un libro que ya está en la biblioteca, compartida entre la carga
// por voz y el guardado rápido desde Open Library.

const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')

export function normalizeForCompare(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '').trim()
}

// Mismo título (sin tildes ni mayúsculas) y, si se conoce, mismo autor.
export function findDuplicate(books: Book[], title: string, author: string): Book | null {
  const t = normalizeForCompare(title)
  if (!t) return null
  const a = normalizeForCompare(author)
  return books.find(b => {
    if (normalizeForCompare(b.title) !== t) return false
    if (!a) return true
    return normalizeForCompare(b.author || '') === a
  }) || null
}
