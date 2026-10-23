import { useState, useCallback, useRef } from 'react'

const API = 'https://openlibrary.org/search.json'
const COVERS = 'https://covers.openlibrary.org/b/id'
const FIELDS = 'key,title,author_name,publisher,cover_i,first_publish_year,language'
const DEBOUNCE_MS = 400
const MAX_CACHE_SIZE = 50

export interface BookSuggestion {
  key: string
  title: string
  author: string
  publisher: string
  cover: string
  coverLarge: string
  year: number | null
}

interface OpenLibraryDoc {
  key: string
  title?: string
  author_name?: string[]
  publisher?: string[]
  cover_i?: number
  first_publish_year?: number
}

const searchCache = new Map<string, BookSuggestion[]>()

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

// Búsqueda puntual (sin debounce ni estado), p. ej. con el texto reconocido de una tapa
export async function searchBooksOnce(query: string, limit = 5): Promise<BookSuggestion[]> {
  const params = new URLSearchParams({ q: query.trim(), limit: String(limit), fields: FIELDS })
  const res = await fetch(`${API}?${params}`)
  if (!res.ok) throw new Error('No se pudo buscar en Open Library')
  const data = await res.json()
  return (data.docs || []).slice(0, limit).map(mapDoc)
}

export function useBookSearch() {
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const search = useCallback((query: string, { lang }: { lang?: string } = {}) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    abortRef.current?.abort()

    if (!query || query.trim().length < 2) {
      setSuggestions([])
      setLoading(false)
      return
    }

    const cacheKey = `${query.trim()}|${lang || ''}`
    if (searchCache.has(cacheKey)) {
      setSuggestions(searchCache.get(cacheKey)!)
      setLoading(false)
      return
    }

    setLoading(true)

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const params = new URLSearchParams({ q: query.trim(), limit: '8', fields: FIELDS })
        if (lang) params.set('lang', lang)

        const res = await fetch(`${API}?${params}`, { signal: controller.signal })
        if (!res.ok) throw new Error('respuesta inválida')
        const data = await res.json()
        const results: BookSuggestion[] = (data.docs || []).slice(0, 8).map(mapDoc)

        if (searchCache.size >= MAX_CACHE_SIZE) {
          searchCache.delete(searchCache.keys().next().value!)
        }
        searchCache.set(cacheKey, results)
        setSuggestions(results)
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)
  }, [])

  const searchByISBN = useCallback(async (isbn: string): Promise<BookSuggestion | null> => {
    const clean = isbn.replace(/[-\s]/g, '')
    const params = new URLSearchParams({ isbn: clean, limit: '1', fields: FIELDS })
    const res = await fetch(`${API}?${params}`)
    if (!res.ok) throw new Error('Sin respuesta')
    const data = await res.json()
    const doc: OpenLibraryDoc | undefined = data.docs?.[0]
    if (!doc) return null
    return mapDoc(doc)
  }, [])

  const clear = useCallback(() => {
    setSuggestions([])
    setLoading(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    abortRef.current?.abort()
  }, [])

  return { suggestions, loading, search, searchByISBN, clear }
}
