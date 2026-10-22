import { useState, useEffect, useRef } from 'react'
import StarRating from './StarRating'
import ISBNScanner from './ISBNScanner'
import { useBookSearch } from '../hooks/useBookSearch'
import { useDialogA11y } from '../hooks/useDialogA11y'
import styles from './BookModal.module.css'
import type { Book } from '../types'
import { todayLocal } from '../utils'

const COVER_MAX_PX = 500
const COVER_QUALITY = 0.82
const MAX_FILE_MB = 5

type FormData = {
  title: string
  author: string
  publisher: string
  genre: string
  year: string | number
  startDate: string
  endDate: string
  notes: string
  score: number
  cover: string
  color: string
  totalPages: string | number
  currentPage: string | number
  wouldReread: boolean
  abandoned: boolean
}

const EMPTY: FormData = {
  title: '', author: '', publisher: '', genre: '',
  year: '', startDate: '', endDate: '', notes: '',
  score: 0, cover: '', color: '',
  totalPages: '', currentPage: '',
  wouldReread: false,
  abandoned: false,
}

const COLORS = [
  '#2d4a3e', '#1a3a5c', '#4a2040', '#5c3d1e', '#1c3d5a',
  '#3d2b1f', '#2a4858', '#4d3319', '#1e3a2f', '#6b3737',
  '#344055', '#3d4a2d',
]

interface BookModalProps {
  mode: 'add' | 'edit'
  book?: Partial<Book>
  onSave: (data: FormData) => Promise<void>
  onClose: () => void
}

function CoverImg({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [hasError, setHasError] = useState(false)
  if (hasError) return null
  return <img src={src} alt={alt} className={className} onError={() => setHasError(true)} />
}

export default function BookModal({ mode, book, onSave, onClose }: BookModalProps) {
  const [form, setForm] = useState<FormData>({ ...EMPTY, ...book })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [coverError, setCoverError] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [isbn, setIsbn] = useState('')
  const [isbnLoading, setIsbnLoading] = useState(false)
  const [isbnError, setIsbnError] = useState('')

  const overlayRef = useRef<HTMLDivElement>(null)
  const suggestionsRef = useRef<HTMLUListElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { suggestions, loading, search, searchByISBN, clear } = useBookSearch()
  const dialogRef = useDialogA11y(onClose, !scannerOpen)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        !titleRef.current?.contains(e.target as Node)
      ) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const set = (key: keyof FormData, val: unknown) => {
    setForm(f => ({ ...f, [key]: val }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: '' }))
  }

  const fillFromResult = (result: { title?: string; author?: string; publisher?: string; year?: number | null; coverLarge?: string; cover?: string }) => {
    setForm(f => ({
      ...f,
      title: result.title || f.title,
      author: result.author || f.author,
      publisher: result.publisher || f.publisher,
      year: result.year || f.year,
      cover: result.coverLarge || result.cover || f.cover,
    }))
    setErrors({})
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    set('title', val)
    search(val)
    setShowSuggestions(true)
  }

  const handleSelectSuggestion = (s: Parameters<typeof fillFromResult>[0]) => {
    fillFromResult(s)
    setShowSuggestions(false)
    clear()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverError('')
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setCoverError(`La imagen supera el límite de ${MAX_FILE_MB} MB`)
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const ratio = Math.min(COVER_MAX_PX / img.width, (COVER_MAX_PX * 1.5) / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * ratio)
        canvas.height = Math.round(img.height * ratio)
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        set('cover', canvas.toDataURL('image/jpeg', COVER_QUALITY))
      }
      img.src = ev.target!.result as string
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleIsbnSearch = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.preventDefault()
    const q = isbn.trim()
    if (!q) return
    setIsbnLoading(true)
    setIsbnError('')
    try {
      const result = await searchByISBN(q)
      if (!result) {
        setIsbnError('ISBN no encontrado en Open Library')
        return
      }
      fillFromResult(result)
      setIsbn('')
    } catch {
      setIsbnError('Error al buscar. Intentá de nuevo.')
    } finally {
      setIsbnLoading(false)
    }
  }

  const handleScan = async (code: string) => {
    setScannerOpen(false)
    setIsbn(code)
    setIsbnLoading(true)
    setIsbnError('')
    try {
      const result = await searchByISBN(code)
      if (!result) setIsbnError(`ISBN ${code} no encontrado`)
      else fillFromResult(result)
    } catch {
      setIsbnError('Error al buscar el ISBN escaneado.')
    } finally {
      setIsbnLoading(false)
    }
  }

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = 'El título es obligatorio'
    if (!form.author.trim()) e.author = 'El autor es obligatorio'
    return e
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isbnLoading) return
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    onSave(form)
  }

  const isReading = !!form.startDate && !form.endDate && !form.abandoned
  const hasSuggestions = showSuggestions && (loading || suggestions.length > 0)

  return (
    <>
      <div className={styles.overlay} ref={overlayRef} onClick={e => e.target === overlayRef.current && onClose()}>
        <div
          ref={dialogRef}
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="book-modal-title"
          tabIndex={-1}
        >
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle} id="book-modal-title">
              {mode === 'add' ? 'Agregar libro' : 'Editar libro'}
            </h2>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.scroll}>

              {/* Título */}
              <div className={styles.section}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="title">Título *</label>
                  <div className={styles.searchField} ref={titleRef}>
                    <input
                      id="title"
                      className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
                      value={form.title}
                      onChange={handleTitleChange}
                      onFocus={() => String(form.title).length >= 2 && setShowSuggestions(true)}
                      placeholder="Escribí el título para buscar..."
                      autoFocus
                      autoComplete="off"
                      maxLength={200}
                    />
                    {loading && (
                      <span className={styles.searchSpinner} aria-hidden="true">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"
                            strokeDasharray="31.4" strokeDashoffset="10"/>
                        </svg>
                      </span>
                    )}
                    {hasSuggestions && (
                      <ul className={styles.suggestions} ref={suggestionsRef} role="listbox" aria-label="Sugerencias de libros">
                        {loading && suggestions.length === 0 && (
                          <li className={styles.suggestionLoading}>Buscando en Open Library...</li>
                        )}
                        {suggestions.map(s => (
                          <li
                            key={s.key}
                            className={styles.suggestionItem}
                            role="option"
                            aria-selected="false"
                            onMouseDown={() => handleSelectSuggestion(s)}
                          >
                            <div className={styles.suggestionCover}>
                              {s.cover ? (
                                <CoverImg src={s.cover} alt={`Portada de ${s.title}`} className={styles.suggestionCoverImg} />
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" opacity="0.4">
                                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            <div className={styles.suggestionInfo}>
                              <span className={styles.suggestionTitle}>{s.title}</span>
                              {s.author && (
                                <span className={styles.suggestionAuthor}>
                                  {s.author}{s.year ? ` · ${s.year}` : ''}
                                </span>
                              )}
                              {s.publisher && (
                                <span className={styles.suggestionPublisher}>{s.publisher}</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {errors.title && <span className={styles.error} role="alert">{errors.title}</span>}
                </div>

                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="author">Autor *</label>
                    <input
                      id="author"
                      className={`${styles.input} ${errors.author ? styles.inputError : ''}`}
                      value={form.author}
                      onChange={e => set('author', e.target.value)}
                      placeholder="Nombre del autor"
                      maxLength={150}
                    />
                    {errors.author && <span className={styles.error} role="alert">{errors.author}</span>}
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="publisher">Editorial</label>
                    <input
                      id="publisher"
                      className={styles.input}
                      value={form.publisher}
                      onChange={e => set('publisher', e.target.value)}
                      placeholder="Ej: Alfaguara"
                      maxLength={150}
                    />
                  </div>
                </div>

                <datalist id="generos-lista">
                  {['Novela','Cuento','Ensayo','Crónica','Poesía','Thriller','Ciencia ficción','Fantasía','Terror','Romance','Histórico','Autobiografía','Biografía','No ficción','Humor','Infantil','Juvenil','Policial','Drama'].map(g => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="genre">Género</label>
                    <input
                      id="genre"
                      className={styles.input}
                      list="generos-lista"
                      value={form.genre || ''}
                      onChange={e => set('genre', e.target.value)}
                      placeholder="Ej: Fantasía, Terror..."
                      maxLength={100}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="year">Año de edición</label>
                    <input
                      id="year"
                      className={styles.input}
                      type="number"
                      min="1000"
                      max={new Date().getFullYear() + 5}
                      value={form.year || ''}
                      onChange={e => set('year', e.target.value)}
                      placeholder={`Ej: ${new Date().getFullYear()}`}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.divider} />

              {/* Estado y fechas */}
              <div className={styles.section}>
                <div className={styles.field}>
                  <span className={styles.label}>Estado</span>
                  <div className={styles.statusPills}>
                    {([
                      { key: 'pending',   label: 'Pendiente' },
                      { key: 'reading',   label: 'Leyendo' },
                      { key: 'done',      label: 'Leído' },
                      { key: 'abandoned', label: 'Abandonado' },
                    ] as { key: string; label: string }[]).map(({ key, label }) => {
                      const current = form.abandoned ? 'abandoned'
                        : !form.startDate && !form.endDate ? 'pending'
                        : !form.endDate ? 'reading' : 'done'
                      return (
                        <button
                          key={key}
                          type="button"
                          className={[
                            styles.statusPill,
                            current === key ? styles.statusPillActive : '',
                            key === 'pending'   ? styles.statusPillPending   : '',
                            key === 'reading'   ? styles.statusPillReading   : '',
                            key === 'done'      ? styles.statusPillDone      : '',
                            key === 'abandoned' ? styles.statusPillAbandoned : '',
                          ].filter(Boolean).join(' ')}
                          onClick={() => {
                            const today = todayLocal()
                            if (key === 'pending') setForm(f => ({ ...f, startDate: '', endDate: '', abandoned: false }))
                            else if (key === 'reading') setForm(f => ({ ...f, startDate: f.startDate || today, endDate: '', abandoned: false }))
                            else if (key === 'done') setForm(f => ({ ...f, startDate: f.startDate || today, endDate: f.endDate || today, abandoned: false }))
                            else setForm(f => ({ ...f, startDate: f.startDate || today, endDate: '', abandoned: true }))
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className={styles.row2}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="startDate">Inicio de lectura</label>
                    <div className={styles.dateRow}>
                      <input
                        id="startDate"
                        className={styles.input}
                        type="date"
                        value={form.startDate}
                        onChange={e => set('startDate', e.target.value)}
                      />
                      {!form.startDate && (
                        <button
                          type="button"
                          className={styles.todayBtn}
                          onClick={() => set('startDate', todayLocal())}
                        >
                          Hoy
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="endDate">Fin de lectura</label>
                    <div className={styles.dateRow}>
                      <input
                        id="endDate"
                        className={styles.input}
                        type="date"
                        value={form.endDate}
                        onChange={e => set('endDate', e.target.value)}
                        min={form.startDate || undefined}
                      />
                      {!form.endDate && (
                        <button
                          type="button"
                          className={styles.todayBtn}
                          onClick={() => set('endDate', todayLocal())}
                        >
                          Hoy
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progreso de lectura — solo visible cuando está leyendo */}
                {isReading && (
                  <div className={styles.row2}>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="totalPages">Total de páginas</label>
                      <input
                        id="totalPages"
                        className={styles.input}
                        type="number"
                        min="1"
                        max="9999"
                        value={form.totalPages || ''}
                        onChange={e => set('totalPages', e.target.value)}
                        placeholder="Ej: 320"
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="currentPage">Página actual</label>
                      <input
                        id="currentPage"
                        className={styles.input}
                        type="number"
                        min="0"
                        max={Number(form.totalPages) || 9999}
                        value={form.currentPage || ''}
                        onChange={e => set('currentPage', e.target.value)}
                        placeholder="Ej: 150"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.divider} />

              {/* Puntaje y notas */}
              <div className={styles.section}>
                <div className={styles.field}>
                  <label className={styles.label}>Puntaje</label>
                  <StarRating value={Number(form.score) || 0} onChange={v => set('score', v)} size={22} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="notes">Anotaciones</label>
                  <textarea
                    id="notes"
                    className={styles.textarea}
                    value={form.notes}
                    onChange={e => set('notes', e.target.value)}
                    placeholder="Observaciones, reflexiones, citas..."
                    rows={3}
                  />
                </div>
                {form.endDate && (
                  <div className={styles.rereedRow}>
                    <span className={styles.label}>¿Lo volvería a leer?</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!form.wouldReread}
                      className={`${styles.toggle} ${form.wouldReread ? styles.toggleOn : ''}`}
                      onClick={() => set('wouldReread', !form.wouldReread)}
                      aria-label="¿Lo volvería a leer?"
                    >
                      <span className={styles.toggleThumb} />
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.divider} />

              {/* Tapa */}
              <div className={styles.section}>
                <span className={styles.label}>Tapa</span>

                <div className={styles.coverSection}>
                  <div className={styles.coverPreviewBox}>
                    {form.cover ? (
                      <>
                        <img
                          src={form.cover}
                          alt="Tapa del libro"
                          className={styles.coverImg}
                          onError={() => set('cover', '')}
                        />
                        <button
                          type="button"
                          className={styles.removeCoverBtn}
                          onClick={() => set('cover', '')}
                          aria-label="Quitar tapa"
                        >
                          <svg width="12" height="12" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                            <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </>
                    ) : (
                      <div className={styles.coverVacio}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" opacity="0.3" aria-hidden="true">
                          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className={styles.coverOpciones}>
                    <label className={styles.coverOpcionBtn}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Subir foto</span>
                      <input ref={fileRef} type="file" accept="image/*" onChange={handleFileUpload} hidden aria-label="Subir foto de tapa" />
                    </label>

                    <button
                      type="button"
                      className={styles.coverOpcionBtn}
                      onClick={() => setScannerOpen(true)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.8"/>
                      </svg>
                      <span>Escanear ISBN</span>
                    </button>
                  </div>
                </div>

                {coverError && <span className={styles.error} role="alert">{coverError}</span>}

                {/* ISBN manual */}
                <div className={styles.isbnRow}>
                  <input
                    className={styles.isbnInput}
                    value={isbn}
                    onChange={e => { setIsbn(e.target.value); setIsbnError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleIsbnSearch(e)}
                    placeholder="Buscar por ISBN..."
                    maxLength={17}
                    type="text"
                    inputMode="numeric"
                    aria-label="ISBN"
                  />
                  <button
                    type="button"
                    className={styles.isbnBtn}
                    onClick={handleIsbnSearch}
                    disabled={isbnLoading || !isbn.trim()}
                  >
                    {isbnLoading ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ animation: 'spin 0.8s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"
                          strokeDasharray="31.4" strokeDashoffset="10"/>
                      </svg>
                    ) : 'Buscar'}
                  </button>
                </div>
                {isbnError && <span className={styles.error} role="alert">{isbnError}</span>}

                {/* Color */}
                <div className={styles.field}>
                  <label className={styles.label}>Color de fondo</label>
                  <div className={styles.colorPicker} role="group" aria-label="Seleccionar color de fondo">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        className={`${styles.colorDot} ${form.color === c ? styles.colorSelected : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => set('color', c)}
                        aria-label={`Color ${c}`}
                        aria-pressed={form.color === c}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.footer}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancelar</button>
              <button type="submit" className={styles.saveBtn} disabled={isbnLoading}>
                {mode === 'add' ? 'Agregar libro' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {scannerOpen && (
        <ISBNScanner onScan={handleScan} onClose={() => setScannerOpen(false)} />
      )}
    </>
  )
}
