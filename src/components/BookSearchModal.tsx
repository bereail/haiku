import { useState, useEffect, useRef } from 'react'
import { useBookSearch } from '../hooks/useBookSearch'
import { useDialogA11y } from '../hooks/useDialogA11y'
import styles from './BookSearchModal.module.css'

function CoverImg({ src, alt }) {
  const [hasError, setHasError] = useState(false)
  if (hasError) return null
  return <img src={src} alt={alt} onError={() => setHasError(true)} />
}

export default function BookSearchModal({ onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const [soloEspanol, setSoloEspanol] = useState(true)
  const { suggestions, loading, search } = useBookSearch()
  const inputRef = useRef(null)
  const overlayRef = useRef(null)
  const dialogRef = useDialogA11y(onClose)

  // Foco inicial en el input de búsqueda (no el primer elemento enfocable
  // del diálogo, que sería el botón de cerrar) — declarado después del
  // hook para ganar el foco sobre su fallback.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    search(query, soloEspanol ? { lang: 'spa' } : {})
  }, [soloEspanol, query, search])

  const handleChange = (e) => {
    setQuery(e.target.value)
  }

  const handleSelect = (book, tipo) => {
    onSelect({ ...book, tipo })
  }

  const showEmpty = query.length >= 2 && !loading && suggestions.length === 0
  const showHint = query.length < 2

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={e => e.target === overlayRef.current && onClose()}>
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-modal-title"
        tabIndex={-1}
      >
        <div className={styles.header}>
          <div>
            <h2 className={styles.title} id="search-modal-title">Buscar en Open Library</h2>
            <p className={styles.subtitle}>Encontrá un libro y agregalo a tu biblioteca</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            className={styles.searchInput}
            value={query}
            onChange={handleChange}
            placeholder="Título, autor..."
            autoComplete="off"
            spellCheck={false}
            aria-label="Buscar libros"
          />
          {loading && (
            <span className={styles.spinner} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"
                  strokeDasharray="31.4" strokeDashoffset="10"/>
              </svg>
            </span>
          )}
          {query && !loading && (
            <button className={styles.clearBtn} onClick={() => setQuery('')} aria-label="Limpiar búsqueda">
              <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* Toggle español */}
        <div className={styles.langRow}>
          <label className={styles.langToggle}>
            <div
              className={`${styles.toggle} ${soloEspanol ? styles.toggleOn : ''}`}
              onClick={() => setSoloEspanol(v => !v)}
              role="switch"
              aria-checked={soloEspanol}
              aria-label="Priorizar resultados en español"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  setSoloEspanol(v => !v)
                }
              }}
            >
              <div className={styles.toggleThumb} />
            </div>
            <span>Priorizar resultados en español</span>
          </label>
        </div>

        <div className={styles.results} role="region" aria-label="Resultados de búsqueda">
          {showHint && (
            <div className={styles.hint}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" opacity="0.2" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              <p>Escribí al menos 2 caracteres para buscar</p>
            </div>
          )}

          {showEmpty && (
            <div className={styles.hint}>
              <p>Sin resultados para <strong>"{query}"</strong></p>
              {soloEspanol && (
                <button className={styles.tryAll} onClick={() => setSoloEspanol(false)}>
                  Buscar en todos los idiomas
                </button>
              )}
            </div>
          )}

          {suggestions.map(book => (
            <div key={book.key} className={styles.result}>
              <div className={styles.cover}>
                {book.cover ? (
                  <CoverImg src={book.cover} alt={`Portada de ${book.title}`} />
                ) : (
                  <div className={styles.noCover}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" opacity="0.35" aria-hidden="true">
                      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>

              <div className={styles.info}>
                <p className={styles.bookTitle}>{book.title}</p>
                {book.author && (
                  <p className={styles.bookMeta}>
                    {book.author}
                    {book.year && <span className={styles.year}> · {book.year}</span>}
                  </p>
                )}
                {book.publisher && (
                  <p className={styles.bookPublisher}>{book.publisher}</p>
                )}
              </div>

              <div className={styles.actions}>
                <button
                  className={styles.readBtn}
                  onClick={() => handleSelect(book, 'leido')}
                  title="Abrir formulario completo"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Leído</span>
                </button>
                <button
                  className={styles.pendingBtn}
                  onClick={() => handleSelect(book, 'pendiente')}
                  title="Guardar para leer después"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Pendiente</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
