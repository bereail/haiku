import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { Book } from '../types'

vi.mock('../api', () => ({
  SESSION_EXPIRED_EVENT: 'librook:session-expired',
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const EXISTING: Partial<Book>[] = [{ id: 'e1', title: 'Rayuela', author: 'Julio Cortázar' }]

function backup(books: Partial<Book>[]) {
  return new File([JSON.stringify({ version: 1, books })], 'backup.json', { type: 'application/json' })
}

async function setup() {
  const { api } = await import('../api')
  vi.mocked(api.get).mockResolvedValue(EXISTING)
  vi.mocked(api.post).mockReset()
  let n = 0
  vi.mocked(api.post).mockImplementation(async (_path: string, body: Partial<Book>) => {
    if (body.title === 'Falla') throw new Error('Error al guardar el libro')
    if (body.cover && !String(body.cover).startsWith('https://covers.openlibrary.org')) {
      throw new Error('La tapa tiene que ser una imagen subida o de Open Library')
    }
    n++
    return { ...body, id: `new-${n}` }
  })
  const { useBooks } = await import('../hooks/useBooks')
  const hook = renderHook(() => useBooks('lectora@test.dev'))
  await waitFor(() => expect(hook.result.current.books).toHaveLength(1))
  return { hook, api }
}

beforeEach(() => {
  vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('1')
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('importar backup', () => {
  it('si un libro falla, los demás se importan, quedan en pantalla y el resumen dice qué pasó', async () => {
    const { hook } = await setup()
    let result: Awaited<ReturnType<typeof hook.result.current.importBooks>> | undefined
    await act(async () => {
      result = await hook.result.current.importBooks(backup([
        { title: 'Ficciones', author: 'Borges' },
        { title: 'Falla', author: 'X' },
        { title: 'El Aleph', author: 'Borges' },
      ]))
    })
    expect(result).toMatchObject({ total: 3, imported: 2, failed: [{ title: 'Falla', reason: 'Error al guardar el libro' }] })
    const titles = hook.result.current.books.map(b => b.title)
    expect(titles).toEqual(expect.arrayContaining(['Ficciones', 'El Aleph', 'Rayuela']))
  })

  it('una tapa de formato no admitido no impide importar el libro: se importa sin tapa y se avisa', async () => {
    const { hook, api } = await setup()
    let result: Awaited<ReturnType<typeof hook.result.current.importBooks>> | undefined
    await act(async () => {
      result = await hook.result.current.importBooks(backup([
        { title: 'Zama', author: 'Di Benedetto', cover: 'https://books.google.com/x.jpg' },
      ]))
    })
    expect(result).toMatchObject({ imported: 1, withoutCover: ['Zama'], failed: [] })
    const calls = vi.mocked(api.post).mock.calls
    const lastBody = calls[calls.length - 1][1] as Partial<Book>
    expect(lastBody.cover).toBe('')
  })

  it('no duplica libros que ya están en la biblioteca (ni repetidos dentro del mismo archivo)', async () => {
    const { hook, api } = await setup()
    let result: Awaited<ReturnType<typeof hook.result.current.importBooks>> | undefined
    await act(async () => {
      result = await hook.result.current.importBooks(backup([
        { title: 'RAYUELA', author: 'julio cortazar' },
        { title: 'Ficciones', author: 'Borges' },
        { title: 'Ficciones', author: 'Borges' },
      ]))
    })
    expect(result).toMatchObject({ total: 3, imported: 1, skippedDuplicates: 2 })
    expect(vi.mocked(api.post)).toHaveBeenCalledTimes(1)
  })

  it('un archivo inválido se rechaza con un mensaje claro', async () => {
    const { hook } = await setup()
    await expect(hook.result.current.importBooks(new File(['no es json'], 'x.json'))).rejects.toThrow(/backup válido/)
  })
})
