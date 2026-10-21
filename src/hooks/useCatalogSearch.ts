import { useState, useCallback, useRef } from 'react'
import { useBookSearch } from './useBookSearch'

export interface LocalWork {
  id: string
  title: string
  subjects: string[]
  firstPublishYear: number | null
  coverUrl: string | null
  authors: string[]
}

const DEBOUNCE_MS = 400
const MIN_LOCAL_RESULTS = 3

// Búsqueda local-first: primero el catálogo propio (rápido, sin límites externos).
// Solo si da pocos resultados, se completa con una búsqueda en vivo a Open Library
// (reutilizando useBookSearch tal cual existe) — esos resultados externos todavía no
// tienen reseñas ni biblioteca asociada en Librook, así que se devuelven aparte para que
// la UI los distinga con claridad.
export function useCatalogSearch() {
  const [localResults, setLocalResults] = useState<LocalWork[]>([])
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const external = useBookSearch()

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    abortRef.current?.abort()
    setLocalError(null)

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setLocalResults([])
      external.clear()
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const res = await fetch(`/librook-api/catalog/works?q=${encodeURIComponent(trimmed)}&limit=10`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error('No se pudo buscar en el catálogo')
        const data = await res.json()
        const works: LocalWork[] = data.works || []
        setLocalResults(works)

        if (works.length < MIN_LOCAL_RESULTS) {
          external.search(trimmed)
        } else {
          external.clear()
        }
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setLocalResults([])
          setLocalError('No se pudo buscar en el catálogo local. Mostrando solo resultados externos.')
          external.search(trimmed)
        }
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)
  }, [external])

  const clear = useCallback(() => {
    setLocalResults([])
    setLocalError(null)
    setLoading(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    abortRef.current?.abort()
    external.clear()
  }, [external])

  return {
    localResults,
    externalResults: external.suggestions,
    loading: loading || external.loading,
    localError,
    search,
    clear,
  }
}
