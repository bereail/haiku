import { useState, useEffect } from 'react'
import { api } from '../api'
import { escapeHtml, formatDate, readingStatus, todayLocal } from '../utils'
import type { Book } from '../types'

const LEGACY_KEYS = ['librook_books', 'books']
const MIGRATED_KEY = 'librook_migrated_v3'

export function useBooks(userEmail: string) {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!userEmail) return
    let cancelled = false
    setLoading(true)
    setError(null)

    api.get('/books')
      .then(async (serverBooks: Book[]) => {
        // Si el servidor ya tiene libros, listo — no hay nada que migrar
        if (serverBooks.length > 0) {
          localStorage.setItem(MIGRATED_KEY, '1')
          return serverBooks
        }

        // Servidor vacío y ya se intentó migrar antes → no duplicar
        if (localStorage.getItem(MIGRATED_KEY)) return serverBooks

        // Servidor vacío + primera vez → intentar migrar desde localStorage
        for (const key of LEGACY_KEYS) {
          try {
            const raw = localStorage.getItem(key)
            if (!raw) continue
            const parsed = JSON.parse(raw)
            const local: Book[] = Array.isArray(parsed) ? parsed : (parsed?.books ?? [])
            if (local.length === 0) continue
            await Promise.all(local.map(b => api.post('/books', b).catch(() => {})))
            localStorage.setItem(MIGRATED_KEY, '1')
            return api.get('/books')
          } catch { continue }
        }

        localStorage.setItem(MIGRATED_KEY, '1')
        return serverBooks
      })
      .then((data: Book[]) => { if (!cancelled) setBooks(data) })
      .catch((err) => { if (!cancelled) setError((err as Error).message || 'No se pudo cargar tu biblioteca') })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [userEmail, reloadToken])

  const reload = () => setReloadToken(t => t + 1)

  const addBook = async (book: Omit<Book, 'id' | 'createdAt'>) => {
    const newBook = await api.post('/books', book)
    setBooks(prev => [newBook, ...prev])
    return newBook
  }

  const updateBook = async (id: string, data: Partial<Book>) => {
    const updated = await api.put(`/books/${id}`, data)
    setBooks(prev => prev.map(b => b.id === id ? updated : b))
  }

  const deleteBook = async (id: string) => {
    await api.delete(`/books/${id}`)
    setBooks(prev => prev.filter(b => b.id !== id))
  }

  const setBookCommunityPost = (id: string, communityPostId: string | null) => {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, communityPostId } : b))
  }

  const exportBooks = () => {
    const payload = JSON.stringify({ version: 1, exportDate: new Date().toISOString(), books }, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `librook-backup-${todayLocal()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportBooksHtml = () => {
    const stars = (n?: number) => n && n > 0 ? '★'.repeat(n) + '☆'.repeat(5 - n) : ''

    // Mismos estados que el resto de la app: antes los abandonados figuraban como "Leyendo"
    const finished  = [...books].filter(b => readingStatus(b) === 'read').sort((a, b) => (b.endDate || '') > (a.endDate || '') ? 1 : -1)
    const reading   = books.filter(b => readingStatus(b) === 'reading')
    const pending   = books.filter(b => readingStatus(b) === 'pending')
    const abandoned = books.filter(b => readingStatus(b) === 'abandoned')

    // Todo dato del usuario se escapa: el archivo se abre como una página HTML y un título
    // con <img onerror=…> o <script> se ejecutaba.
    const row = (b: Book) => `<tr>
      <td>${escapeHtml(b.title)}</td>
      <td>${escapeHtml(b.author)}</td>
      <td>${escapeHtml(b.genre)}</td>
      <td>${escapeHtml(b.year)}</td>
      <td class="stars">${stars(b.score)}</td>
      <td>${formatDate(b.endDate || b.startDate)}</td>
      <td class="fav">${b.wouldReread ? '★' : ''}</td>
    </tr>`

    const table = (rows: Book[], cols: string[]) => `<table>
      <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row).join('')}</tbody>
    </table>`

    const finishedCols = ['Título','Autor/a','Género','Año','Puntaje','Terminado','Fav']
    const readingCols  = ['Título','Autor/a','Género','Año','Puntaje','Desde','']
    const pendingCols  = ['Título','Autor/a','Género','Año','','','']
    const abandonedCols = ['Título','Autor/a','Género','Año','Puntaje','Desde','']

    const avgScore = finished.filter(b => b.score && b.score > 0)
    const avg = avgScore.length ? (avgScore.reduce((s, b) => s + (b.score || 0), 0) / avgScore.length).toFixed(1) : '—'

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mi biblioteca — Librook</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Georgia,serif;color:#1a1a18;background:#faf9f6;padding:2rem 1rem}
    .wrap{max-width:960px;margin:0 auto}
    h1{font-size:2rem;color:#2d4a3e;margin-bottom:.2rem}
    .sub{color:#888;font-style:italic;margin-bottom:2rem;font-size:.9rem}
    .stats{display:flex;gap:1.5rem;flex-wrap:wrap;margin-bottom:2.5rem;padding:1rem 1.25rem;background:#fff;border:1px solid #e8e6e0;border-radius:8px}
    .stat{display:flex;flex-direction:column;gap:.15rem}
    .stat-n{font-size:1.6rem;font-weight:700;color:#2d4a3e;font-family:Georgia,serif}
    .stat-l{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:#888}
    h2{font-size:1rem;text-transform:uppercase;letter-spacing:.06em;color:#2d4a3e;border-bottom:2px solid #2d4a3e;padding-bottom:.4rem;margin:2.5rem 0 1rem}
    .count{font-size:.8rem;color:#aaa;font-weight:400;margin-left:.4rem;text-transform:none;letter-spacing:0}
    table{width:100%;border-collapse:collapse;font-size:.85rem}
    th{text-align:left;padding:.5rem .75rem;background:#2d4a3e;color:#fff;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;font-family:Arial,sans-serif}
    td{padding:.5rem .75rem;border-bottom:1px solid #ede}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:#f5f3ee}
    .stars{color:#8a6419;white-space:nowrap}
    .fav{color:#8a6419;text-align:center}
    footer{margin-top:3rem;font-size:.75rem;color:#bbb;text-align:center;font-family:Arial,sans-serif}
    @media(max-width:600px){table{font-size:.78rem}td,th{padding:.4rem .5rem}.stats{gap:1rem}}
  </style>
</head>
<body>
<div class="wrap">
  <h1>Mi biblioteca</h1>
  <p class="sub">Exportado el ${new Date().toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric'})} · ${books.length} libros en total</p>
  <div class="stats">
    <div class="stat"><span class="stat-n">${books.length}</span><span class="stat-l">Total</span></div>
    <div class="stat"><span class="stat-n">${finished.length}</span><span class="stat-l">Leídos</span></div>
    <div class="stat"><span class="stat-n">${reading.length}</span><span class="stat-l">Leyendo</span></div>
    <div class="stat"><span class="stat-n">${pending.length}</span><span class="stat-l">Pendientes</span></div>
    <div class="stat"><span class="stat-n">${avg}</span><span class="stat-l">Puntaje prom.</span></div>
    <div class="stat"><span class="stat-n">${finished.filter(b=>b.wouldReread).length}</span><span class="stat-l">Volvería a leer</span></div>
  </div>
  ${finished.length > 0 ? `<h2>Leídos<span class="count">${finished.length}</span></h2>${table(finished, finishedCols)}` : ''}
  ${reading.length > 0 ? `<h2>Leyendo<span class="count">${reading.length}</span></h2>${table(reading, readingCols)}` : ''}
  ${pending.length > 0 ? `<h2>Pendientes<span class="count">${pending.length}</span></h2>${table(pending, pendingCols)}` : ''}
  ${abandoned.length > 0 ? `<h2>Abandonados<span class="count">${abandoned.length}</span></h2>${table(abandoned, abandonedCols)}` : ''}
  <footer>Generado por Librook</footer>
</div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `librook-${todayLocal()}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importBooks = (file: File): Promise<number> => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target!.result as string)
        const imported: Book[] = Array.isArray(data) ? data : (data.books || [])
        if (!Array.isArray(imported) || imported.length === 0) {
          reject(new Error('El archivo está vacío o tiene un formato inválido'))
          return
        }
        const results = await Promise.all(imported.map(b => api.post('/books', b)))
        setBooks(prev => [...results, ...prev])
        resolve(results.length)
      } catch {
        reject(new Error('No se pudo leer el archivo. Verificá que sea un backup válido de Librook.'))
      }
    }
    reader.onerror = () => reject(new Error('Error al leer el archivo'))
    reader.readAsText(file)
  })

  return { books, loading, error, reload, addBook, updateBook, deleteBook, setBookCommunityPost, exportBooks, exportBooksHtml, importBooks }
}
