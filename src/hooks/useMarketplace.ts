import { useCallback, useState } from 'react'
import { api } from '../api'
import { resizeForUpload } from '../services/imageResize'
import type { Listing, ListingInput, ListingKind, ListingPhoto } from '../types'

export interface MarketplaceFilters {
  kind: ListingKind | ''
  q: string
  mine: boolean
}

export function useMarketplace() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (f: MarketplaceFilters) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (f.kind) params.set('kind', f.kind)
      if (f.q.trim()) params.set('q', f.q.trim())
      if (f.mine) params.set('mine', '1')
      const data = await api.get(`/marketplace/listings?${params}`)
      setListings(data.listings)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const create = async (input: ListingInput): Promise<Listing> => {
    const listing: Listing = await api.post('/marketplace/listings', input)
    setListings(prev => [listing, ...prev])
    return listing
  }

  const update = async (id: string, input: ListingInput): Promise<Listing> => {
    const listing: Listing = await api.put(`/marketplace/listings/${id}`, input)
    setListings(prev => prev.map(l => (l.id === id ? listing : l)))
    return listing
  }

  const remove = async (id: string) => {
    await api.delete(`/marketplace/listings/${id}`)
    setListings(prev => prev.filter(l => l.id !== id))
  }

  // Achica en el navegador (sin metadatos) y sube; devuelve la foto lista para asociar
  const uploadPhoto = async (file: File): Promise<ListingPhoto> => {
    const blob = await resizeForUpload(file)
    return api.upload('/uploads', blob)
  }

  // Foto subida pero todavía no asociada (p. ej. se quitó del formulario antes de guardar)
  const discardPhoto = (id: string) => api.delete(`/uploads/${id}`).catch(() => {})

  return { listings, loading, error, load, create, update, remove, uploadPhoto, discardPhoto }
}
