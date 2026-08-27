import type { Book, ReadingStatus } from './types'

export const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
]

export function formatDate(str: string | undefined): string {
  if (!str) return ''
  const match = str.match(/^(\d{4})-(\d{2})/)
  if (!match) return ''
  return `${MESES[parseInt(match[2]) - 1]} ${match[1]}`
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('es-AR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function getInitials(title: string): string {
  return title
    .split(' ')
    .slice(0, 2)
    .map(w => w?.[0] || '')
    .join('')
    .toUpperCase() || '?'
}

export function getBookStatus(book: Pick<Book, 'startDate' | 'endDate' | 'totalPages' | 'currentPage' | 'abandoned'>) {
  const isAbandoned = !!book.abandoned && !book.endDate
  const isPending = !isAbandoned && !book.startDate && !book.endDate
  const isReading = !isAbandoned && !!book.startDate && !book.endDate
  const isFinished = !isAbandoned && !!book.endDate
  const progress = isReading && (book.totalPages ?? 0) > 0 && (book.currentPage ?? 0) > 0
    ? Math.min(100, Math.round((Number(book.currentPage) / Number(book.totalPages)) * 100))
    : null
  return { isPending, isReading, isFinished, isAbandoned, progress }
}

export function readingStatus(book: Pick<Book, 'startDate' | 'endDate' | 'abandoned'>): ReadingStatus {
  if (book.abandoned && !book.endDate) return 'abandoned'
  if (book.endDate) return 'read'
  if (book.startDate) return 'reading'
  return 'pending'
}

export function hasScore(book: Pick<Book, 'score'>): boolean {
  return (book.score ?? 0) > 0
}
