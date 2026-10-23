import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCatalogSearch } from '../hooks/useCatalogSearch'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function mockFetchSequence(responses: Array<{ url: RegExp; body: unknown }>) {
  globalThis.fetch = vi.fn((url: string) => {
    const match = responses.find((r) => r.url.test(url))
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(match ? match.body : {}),
    }) as unknown as Promise<Response>
  })
}

describe('useCatalogSearch', () => {
  it('no busca con menos de 2 caracteres', async () => {
    mockFetchSequence([])
    const { result } = renderHook(() => useCatalogSearch())

    act(() => result.current.search('a'))
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })

    expect(result.current.localResults).toEqual([])
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('con suficientes resultados locales, no consulta Open Library', async () => {
    const works = Array.from({ length: 5 }, (_, i) => ({
      id: `w${i}`, title: `Libro ${i}`, subjects: [], firstPublishYear: null, coverUrl: null, authors: [],
    }))
    mockFetchSequence([{ url: /catalog\/works/, body: { works, nextCursor: null } }])

    const { result } = renderHook(() => useCatalogSearch())
    act(() => result.current.search('rayuela'))
    await act(async () => { await vi.advanceTimersByTimeAsync(500) })

    await waitFor(() => expect(result.current.localResults).toHaveLength(5))
    expect(result.current.externalResults).toEqual([])
  })

  it('con pocos resultados locales, completa con Open Library', async () => {
    mockFetchSequence([
      { url: /catalog\/works/, body: { works: [{ id: 'w1', title: 'Rayuela', subjects: [], firstPublishYear: null, coverUrl: null, authors: [] }], nextCursor: null } },
      { url: /openlibrary\.org/, body: { docs: [{ key: '/works/OL1W', title: 'Otro libro', author_name: ['Autor'], cover_i: null, first_publish_year: 2000 }] } },
    ])

    const { result } = renderHook(() => useCatalogSearch())
    act(() => result.current.search('rayuela'))
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })

    await waitFor(() => expect(result.current.localResults).toHaveLength(1))
    await waitFor(() => expect(result.current.externalResults.length).toBeGreaterThan(0))
  })

  it('un error en el catálogo local no rompe la búsqueda — recurre a Open Library', async () => {
    globalThis.fetch = vi.fn((url: string) => {
      if (/catalog\/works/.test(url)) return Promise.resolve({ ok: false, json: () => Promise.resolve({}) }) as unknown as Promise<Response>
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ docs: [] }) }) as unknown as Promise<Response>
    })

    const { result } = renderHook(() => useCatalogSearch())
    act(() => result.current.search('rayuela'))
    await act(async () => { await vi.advanceTimersByTimeAsync(900) })

    await waitFor(() => expect(result.current.localError).toBeTruthy())
    expect(result.current.localResults).toEqual([])
  })
})
