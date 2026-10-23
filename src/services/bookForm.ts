import type { Book } from '../types'

// Del estado del formulario de libro a lo que se guarda: los campos numéricos llegan como
// '' o '1963' y pasan a number/undefined. Se conserva todo el resto del estado (en una
// edición incluye isbn, pages, editionId…, que el formulario no muestra: el PUT reemplaza
// todas las columnas y si faltaran se borrarían).

export type BookPayload = Omit<Book, 'id' | 'createdAt'>
type NumLike = string | number | undefined | null
type BookForm = Omit<BookPayload, 'year' | 'totalPages' | 'currentPage'> & {
  year?: NumLike
  totalPages?: NumLike
  currentPage?: NumLike
}

const toNumber = (v: NumLike): number | undefined =>
  v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? undefined : Number(v)

export function toBookPayload(form: BookForm): BookPayload {
  return {
    ...form,
    year: toNumber(form.year),
    totalPages: toNumber(form.totalPages),
    currentPage: toNumber(form.currentPage),
  }
}
