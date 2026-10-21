import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Book } from '../types'

vi.mock('../services/speechService', () => ({
  isSpeechRecognitionSupported: vi.fn(() => true),
  SpeechService: vi.fn().mockImplementation(() => ({
    start: vi.fn((callbacks: { onResult: (t: string, f: boolean) => void; onEnd?: () => void }) => {
      callbacks.onResult('Terminé Dune y le doy cinco estrellas.', true)
      callbacks.onEnd?.()
      return true
    }),
    stop: vi.fn(),
    abort: vi.fn(),
  })),
}))

vi.mock('../services/bookMatchService', () => ({
  findBookMatches: vi.fn(),
}))

const SUGGESTION = {
  key: '/works/OL1', title: 'Dune', author: 'Frank Herbert',
  publisher: 'Ace', cover: 'cover.jpg', coverLarge: 'cover-l.jpg', year: 1965,
}

const EXISTING_BOOK: Book = {
  id: 'book-1', title: 'Dune', author: 'Frank Herbert', score: 5,
  startDate: '2024-01-01', endDate: '2024-01-20',
}

describe('useVoiceEntry', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    const { isSpeechRecognitionSupported, SpeechService } = await import('../services/speechService')
    vi.mocked(isSpeechRecognitionSupported).mockReturnValue(true)
    vi.mocked(SpeechService).mockImplementation(function (this: unknown) {
      return {
        start: vi.fn((callbacks: { onResult: (t: string, f: boolean) => void; onEnd?: () => void }) => {
          callbacks.onResult('Terminé Dune y le doy cinco estrellas.', true)
          callbacks.onEnd?.()
          return true
        }),
        stop: vi.fn(),
        abort: vi.fn(),
      } as unknown as InstanceType<typeof SpeechService>
    })
  })

  it('pasa a error "no-support" si el navegador no soporta reconocimiento de voz', async () => {
    const { isSpeechRecognitionSupported } = await import('../services/speechService')
    vi.mocked(isSpeechRecognitionSupported).mockReturnValue(false)

    const { useVoiceEntry } = await import('../hooks/useVoiceEntry')
    const { result } = renderHook(() => useVoiceEntry({ books: [], onSave: vi.fn() }))

    act(() => { result.current.start() })

    expect(result.current.phase).toBe('error')
    expect(result.current.errorKind).toBe('no-support')
  })

  it('llega a confirmación con un match claro y sin duplicados', async () => {
    const { findBookMatches } = await import('../services/bookMatchService')
    vi.mocked(findBookMatches).mockResolvedValue({ best: SUGGESTION, candidates: [] })

    const { useVoiceEntry } = await import('../hooks/useVoiceEntry')
    const { result } = renderHook(() => useVoiceEntry({ books: [], onSave: vi.fn() }))

    act(() => { result.current.start() })

    await waitFor(() => expect(result.current.phase).toBe('confirm'))
    expect(result.current.draft?.title).toBe('Dune')
    expect(result.current.draft?.author).toBe('Frank Herbert')
    expect(result.current.draft?.rating).toBe(5)
    expect(result.current.draft?.status).toBe('read')
  })

  it('detecta duplicado por título y autor antes de confirmar', async () => {
    const { findBookMatches } = await import('../services/bookMatchService')
    vi.mocked(findBookMatches).mockResolvedValue({ best: SUGGESTION, candidates: [] })

    const { useVoiceEntry } = await import('../hooks/useVoiceEntry')
    const { result } = renderHook(() => useVoiceEntry({ books: [EXISTING_BOOK], onSave: vi.fn() }))

    act(() => { result.current.start() })

    await waitFor(() => expect(result.current.phase).toBe('duplicate'))
    expect(result.current.duplicateBook?.id).toBe('book-1')
  })

  it('guarda el libro y pasa a "saved" cuando onSave resuelve', async () => {
    const { findBookMatches } = await import('../services/bookMatchService')
    vi.mocked(findBookMatches).mockResolvedValue({ best: SUGGESTION, candidates: [] })
    const onSave = vi.fn().mockResolvedValue(undefined)

    const { useVoiceEntry } = await import('../hooks/useVoiceEntry')
    const { result } = renderHook(() => useVoiceEntry({ books: [], onSave }))

    act(() => { result.current.start() })
    await waitFor(() => expect(result.current.phase).toBe('confirm'))

    await act(async () => { await result.current.confirmSave() })

    expect(onSave).toHaveBeenCalledOnce()
    expect(result.current.phase).toBe('saved')
  })

  it('pasa a error si onSave falla', async () => {
    const { findBookMatches } = await import('../services/bookMatchService')
    vi.mocked(findBookMatches).mockResolvedValue({ best: SUGGESTION, candidates: [] })
    const onSave = vi.fn().mockRejectedValue(new Error('falló'))

    const { useVoiceEntry } = await import('../hooks/useVoiceEntry')
    const { result } = renderHook(() => useVoiceEntry({ books: [], onSave }))

    act(() => { result.current.start() })
    await waitFor(() => expect(result.current.phase).toBe('confirm'))

    await act(async () => { await result.current.confirmSave() })

    expect(result.current.phase).toBe('error')
  })

  it('presenta candidatos para elegir cuando no hay un match claro', async () => {
    const { findBookMatches } = await import('../services/bookMatchService')
    vi.mocked(findBookMatches).mockResolvedValue({ best: null, candidates: [SUGGESTION] })

    const { useVoiceEntry } = await import('../hooks/useVoiceEntry')
    const { result } = renderHook(() => useVoiceEntry({ books: [], onSave: vi.fn() }))

    act(() => { result.current.start() })

    await waitFor(() => expect(result.current.phase).toBe('picking'))
    expect(result.current.candidates).toHaveLength(1)

    act(() => { result.current.pickCandidate(SUGGESTION) })
    expect(result.current.phase).toBe('confirm')
  })
})
