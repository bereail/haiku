import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const TOKEN = 'test-jwt-token'

beforeEach(() => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) =>
    key === 'haiku_token' ? TOKEN : null
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('api module', () => {
  it('adjunta el token de autorización en las requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: 'ok' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { api } = await import('../api')
    await api.get('/books')

    expect(mockFetch).toHaveBeenCalledWith(
      '/haiku-api/books',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${TOKEN}`,
        }),
      })
    )

    vi.unstubAllGlobals()
  })

  it('lanza un error cuando la respuesta no es ok', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'No autorizado' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { api } = await import('../api')
    await expect(api.get('/books')).rejects.toThrow('No autorizado')

    vi.unstubAllGlobals()
  })
})
