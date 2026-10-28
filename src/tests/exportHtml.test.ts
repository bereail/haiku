import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { Book } from '../types'

vi.mock('../api', () => ({
  SESSION_EXPIRED_EVENT: 'haiku:session-expired',
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const XSS = '<img src=x onerror="alert(1)">'
const BOOKS: Partial<Book>[] = [
  { id: '1', title: `Leído ${XSS}`, author: 'A & B', startDate: '2026-01-01', endDate: '2026-02-01', score: 4 },
  { id: '2', title: 'En lectura', author: 'C', startDate: '2026-09-01' },
  { id: '3', title: 'Abandonado X', author: 'D', startDate: '2026-03-01', abandoned: true },
  { id: '4', title: 'Pendiente Y', author: '<script>alert(2)</script>' },
]

let exported = ''
let filename = ''

beforeEach(async () => {
  exported = ''
  vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('1')
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})
  URL.createObjectURL = vi.fn((blob: Blob) => {
    // jsdom no implementa Blob.text() en todas las versiones: leer con FileReader
    const reader = new FileReader()
    reader.onload = () => { exported = String(reader.result) }
    reader.readAsText(blob)
    return 'blob:x'
  }) as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { filename = this.download })
  const { api } = await import('../api')
  vi.mocked(api.get).mockResolvedValue(BOOKS)
})

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllEnvs() })

async function exportHtml() {
  const { useBooks } = await import('../hooks/useBooks')
  const { result } = renderHook(() => useBooks('lectora@test.dev'))
  await waitFor(() => expect(result.current.books).toHaveLength(BOOKS.length))
  result.current.exportBooksHtml()
  await waitFor(() => expect(exported).not.toBe(''))
  return exported
}

function section(html: string, name: string) {
  const start = html.indexOf(`<h2>${name}<`)
  if (start < 0) return ''
  const next = html.indexOf('<h2>', start + 4)
  return html.slice(start, next < 0 ? undefined : next)
}

describe('exportar biblioteca a HTML', () => {
  it('escapa los datos: un título o autor con HTML no se ejecuta al abrir el archivo', async () => {
    const html = await exportHtml()
    expect(html).not.toContain(XSS)
    expect(html).not.toContain('<script>alert(2)</script>')
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
    expect(html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;')
    expect(html).toContain('A &amp; B')
  })

  it('los abandonados tienen su sección y no figuran como "Leyendo"', async () => {
    const html = await exportHtml()
    expect(section(html, 'Leyendo')).toContain('En lectura')
    expect(section(html, 'Leyendo')).not.toContain('Abandonado X')
    expect(section(html, 'Abandonados')).toContain('Abandonado X')
  })

  it('el nombre del archivo usa la fecha local (no la UTC)', async () => {
    // 23:30 del 22/10 en Argentina = 02:30 del 23/10 en UTC
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-22T23:30:00-03:00'))
    vi.stubEnv('TZ', 'America/Argentina/Buenos_Aires')
    await exportHtml()
    expect(filename).toBe('haiku-2026-10-22.html')
  })
})
