// Busca en Open Library el libro que mejor matchea un título (y opcionalmente autor)
// extraídos por voz, y decide si hay un candidato suficientemente claro para
// seleccionarlo automáticamente o si hace falta preguntarle a la persona cuál es.
//
// Nota de costos: se usa únicamente Open Library (gratuita, sin API key). Google Books
// también es gratuita para este volumen de uso, pero Open Library ya es la fuente que
// usa el resto de la app (useBookSearch, ISBNScanner) — sumar una segunda fuente y
// comparar resultados agrega complejidad sin necesidad real a esta escala; queda
// documentado como posible mejora futura si la tasa de "no encontrado" resulta alta.
import type { BookSuggestion } from '../hooks/useBookSearch'

const API = 'https://openlibrary.org/search.json'
const COVERS = 'https://covers.openlibrary.org/b/id'
const FIELDS = 'key,title,author_name,publisher,cover_i,first_publish_year,language'

interface OpenLibraryDoc {
  key: string
  title?: string
  author_name?: string[]
  publisher?: string[]
  cover_i?: number
  first_publish_year?: number
}

function mapDoc(doc: OpenLibraryDoc): BookSuggestion {
  return {
    key: doc.key,
    title: doc.title || '',
    author: doc.author_name?.[0] || '',
    publisher: doc.publisher?.[0] || '',
    cover: doc.cover_i ? `${COVERS}/${doc.cover_i}-M.jpg` : '',
    coverLarge: doc.cover_i ? `${COVERS}/${doc.cover_i}-L.jpg` : '',
    year: doc.first_publish_year || null,
  }
}

const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(COMBINING_MARKS, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(normalize(a).split(' ').filter(Boolean))
  const tb = new Set(normalize(b).split(' ').filter(Boolean))
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / Math.max(ta.size, tb.size)
}

export interface ScoredMatch {
  suggestion: BookSuggestion
  score: number
}

export function scoreMatches(title: string, author: string | null, candidates: BookSuggestion[]): ScoredMatch[] {
  return candidates
    .map(suggestion => {
      let score = tokenOverlap(title, suggestion.title) * 0.75
      if (author && suggestion.author) {
        score += tokenOverlap(author, suggestion.author) * 0.25
      } else if (!author) {
        score += 0.25 // no hay autor para comparar: no penalizar
      }
      return { suggestion, score }
    })
    .sort((a, b) => b.score - a.score)
}

export interface BookMatchResult {
  /** Un único candidato claro, listo para pre-seleccionar. */
  best: BookSuggestion | null
  /** Varios candidatos plausibles — hay que preguntarle a la persona cuál es. */
  candidates: BookSuggestion[]
}

const AUTO_SELECT_THRESHOLD = 0.6
const AUTO_SELECT_MARGIN = 0.22

export async function findBookMatches(title: string, author: string | null): Promise<BookMatchResult> {
  const query = author ? `${title} ${author}` : title
  const params = new URLSearchParams({ q: query, limit: '5', fields: FIELDS })
  const res = await fetch(`${API}?${params}`)
  if (!res.ok) throw new Error('No se pudo conectar con Open Library')
  const data = await res.json()
  const docs: OpenLibraryDoc[] = (data.docs || []).slice(0, 5)
  if (docs.length === 0) return { best: null, candidates: [] }

  const scored = scoreMatches(title, author, docs.map(mapDoc))
  const [top, second] = scored

  if (top && top.score >= AUTO_SELECT_THRESHOLD && (!second || top.score - second.score >= AUTO_SELECT_MARGIN)) {
    return { best: top.suggestion, candidates: [] }
  }
  return { best: null, candidates: scored.slice(0, 4).map(s => s.suggestion) }
}
