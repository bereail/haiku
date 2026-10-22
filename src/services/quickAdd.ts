import type { Book, ReadingStatus } from '../types'
import { readingStatus } from '../utils'
import { findDuplicate } from './bookDuplicates'

// Guardado rápido desde los resultados de Open Library ("Leído" / "Pendiente"),
// sin pasar por el formulario. Usa los mismos estados que el resto de la app:
// Leído = con fecha de fin; Pendiente = sin fechas ni abandono.

export type QuickTarget = Extract<ReadingStatus, 'read' | 'pending'>

export interface QuickAddSource {
  title: string
  author: string
  publisher?: string
  year?: number | null
  cover?: string
  coverLarge?: string
}

export type QuickAddPlan =
  | { kind: 'create'; data: Omit<Book, 'id' | 'createdAt'> }
  | { kind: 'update'; book: Book; data: Book }
  | { kind: 'noop'; book: Book; status: ReadingStatus }

export const STATUS_LABEL: Record<ReadingStatus, string> = {
  pending: 'Pendiente', reading: 'Leyendo', read: 'Leído', abandoned: 'Abandonado',
}

/**
 * Decide qué hacer sin tocar la red.
 * - Si el libro no está en la biblioteca: se crea con el estado pedido.
 * - Si ya está: no se duplica.
 *   · "Leído" lo marca como leído si todavía no lo estaba (conserva su fecha de
 *     inicio, como el botón "Leído" del formulario).
 *   · "Pendiente" solo aplica si ya está pendiente (no hay nada que cambiar):
 *     no se degrada un libro leído, en lectura o abandonado, porque se
 *     perderían sus fechas. Se informa en qué estado está.
 */
export function planQuickAdd(books: Book[], source: QuickAddSource, target: QuickTarget, today: string): QuickAddPlan {
  const existing = findDuplicate(books, source.title, source.author)

  if (!existing) {
    const base = {
      title: source.title.trim(),
      author: source.author.trim(),
      publisher: source.publisher || '',
      year: source.year ?? undefined,
      cover: source.coverLarge || source.cover || '',
      score: 0,
      notes: '',
    }
    const dates = target === 'read'
      ? { startDate: today, endDate: today, abandoned: false }
      : { startDate: '', endDate: '', abandoned: false }
    return { kind: 'create', data: { ...base, ...dates } as Omit<Book, 'id' | 'createdAt'> }
  }

  const status = readingStatus(existing)
  if (target === 'read' && status !== 'read') {
    // PUT /books/:id reemplaza todas las columnas: se manda el libro completo.
    return {
      kind: 'update',
      book: existing,
      data: { ...existing, startDate: existing.startDate || today, endDate: today, abandoned: false },
    }
  }
  return { kind: 'noop', book: existing, status }
}

export function quickAddMessage(plan: QuickAddPlan, target: QuickTarget): string {
  if (plan.kind === 'create') return `Guardado como ${STATUS_LABEL[target]}`
  if (plan.kind === 'update') return `Ya estaba en tu biblioteca: ahora figura como ${STATUS_LABEL[target]}`
  return `Ya está en tu biblioteca como ${STATUS_LABEL[plan.status]}`
}
