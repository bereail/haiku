import { useEffect, useState } from 'react'
import { api } from '../api'
import type { LocalWork } from './useCatalogSearch'
import type { CommunityPost } from '../types'

export interface DiscoverData {
  popular: LocalWork[]
  recent: LocalWork[]
  community: CommunityPost[]
}

const EMPTY: DiscoverData = { popular: [], recent: [], community: [] }

// Todo lo que se muestra en Descubrir sale de datos reales: lo más leído y lo más nuevo
// del catálogo propio (nunca Open Library, que no tiene "cuántas lectoras lo tienen"), y
// las últimas reflexiones de Comunidad. Una sola carga al abrir, sin reintentos agresivos —
// no es una pantalla que se refresque sola.
export function useDiscover(active: boolean) {
  const [data, setData] = useState<DiscoverData>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [popularRes, recentRes, communityRes] = await Promise.all([
          api.get('/catalog/works?sort=popular&limit=6').catch(() => ({ works: [] })),
          api.get('/catalog/works?sort=recent&limit=8').catch(() => ({ works: [] })),
          api.get('/community/posts?limit=4').catch(() => ({ posts: [] })),
        ])
        if (cancelled) return

        const popularIds = new Set((popularRes.works ?? []).map((w: LocalWork) => w.id))
        const recent = (recentRes.works ?? []).filter((w: LocalWork) => !popularIds.has(w.id)).slice(0, 6)

        setData({ popular: popularRes.works ?? [], recent, community: communityRes.posts ?? [] })
      } catch {
        if (!cancelled) setError('No se pudo cargar Descubrir. Probá de nuevo en un momento.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [active])

  return { ...data, loading, error }
}
