import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockLocalStorage: Record<string, string> = {}
beforeEach(() => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(k => mockLocalStorage[k] ?? null)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => { mockLocalStorage[k] = v })
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(k => { delete mockLocalStorage[k] })
  Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k])
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAuth', () => {
  it('inicia sin usuario autenticado', async () => {
    const { useAuth } = await import('../hooks/useAuth')
    const { result } = renderHook(() => useAuth())
    expect(result.current.user).toBeNull()
  })

  it('login exitoso guarda el usuario en el estado', async () => {
    const { api } = await import('../api')
    vi.mocked(api.post).mockResolvedValueOnce({ token: 'jwt-123', email: 'user@test.com' })

    const { useAuth } = await import('../hooks/useAuth')
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      const res = await result.current.login('user@test.com', 'pass123')
      expect(res.ok).toBe(true)
    })

    expect(result.current.user).toEqual({ email: 'user@test.com', isDemo: false })
    expect(mockLocalStorage['librook_token']).toBe('jwt-123')
  })

  it('login fallido devuelve error', async () => {
    const { api } = await import('../api')
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Email o contraseña incorrectos'))

    const { useAuth } = await import('../hooks/useAuth')
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      const res = await result.current.login('user@test.com', 'wrongpass')
      expect(res.ok).toBe(false)
      expect(res.error).toContain('incorrectos')
    })

    expect(result.current.user).toBeNull()
  })

  it('logout limpia el estado y el localStorage', async () => {
    mockLocalStorage['librook_token'] = 'jwt-123'
    mockLocalStorage['librook_auth'] = JSON.stringify({ email: 'user@test.com' })

    const { api } = await import('../api')
    vi.mocked(api.post).mockResolvedValueOnce({ token: 'jwt-123', email: 'user@test.com' })

    const { useAuth } = await import('../hooks/useAuth')
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.login('user@test.com', 'pass123')
    })

    act(() => {
      result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(mockLocalStorage['librook_token']).toBeUndefined()
  })

  it('register devuelve error de la API', async () => {
    const { api } = await import('../api')
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Ya existe una cuenta con ese email'))

    const { useAuth } = await import('../hooks/useAuth')
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      const res = await result.current.register('existing@test.com', 'pass123')
      expect(res.ok).toBe(false)
      expect(res.error?.toLowerCase()).toContain('ya existe')
    })
  })
})
