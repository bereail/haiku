import type { Book } from './types'

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

export function getInitials(title: string): string {
  return title
    .split(' ')
    .slice(0, 2)
    .map(w => w?.[0] || '')
    .join('')
    .toUpperCase() || '?'
}

export function getBookStatus(book: Pick<Book, 'startDate' | 'endDate' | 'totalPages' | 'currentPage'>) {
  const isPending = !book.startDate && !book.endDate
  const isReading = !!book.startDate && !book.endDate
  const isFinished = !!book.endDate
  const progress = isReading && (book.totalPages ?? 0) > 0 && (book.currentPage ?? 0) > 0
    ? Math.min(100, Math.round((Number(book.currentPage) / Number(book.totalPages)) * 100))
    : null
  return { isPending, isReading, isFinished, progress }
}

export function hasScore(book: Pick<Book, 'score'>): boolean {
  return (book.score ?? 0) > 0
}
