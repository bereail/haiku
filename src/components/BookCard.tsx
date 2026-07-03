import { useState } from 'react'
import styles from './BookCard.module.css'
import StarRating from './StarRating'
import { formatDate, getInitials, getBookStatus, hasScore } from '../utils'
import type { Book } from '../types'

interface BookCardProps {
  book: Book
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}

export default function BookCard({ book, onEdit, onView, onDelete }: BookCardProps) {
  const [flipped, setFlipped] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-action]')) return
    if (flipped) {
      onView()
    } else {
      setFlipped(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('[data-action]')) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (flipped) onView()
      else setFlipped(true)
    }
    if (e.key === 'Escape' && flipped) {
      setFlipped(false)
      setConfirmando(false)
    }
  }

  const { isPending, isReading, isFinished, progress } = getBookStatus(book)

  const initials = getInitials(book.title)

  return (
    <div
      className={styles.wrapper}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="article"
      aria-label={book.title}
      aria-expanded={flipped}
      tabIndex={0}
    >
      <div className={`${styles.inner} ${flipped ? styles.flipped : ''}`}>

        {/* FRONT */}
        <div className={styles.front}>
          <div
            className={styles.cover}
            style={{
              backgroundImage: book.cover ? `url(${book.cover})` : undefined,
              backgroundColor: book.color || 'var(--color-accent)',
            }}
          >
            {!book.cover && (
              <div className={styles.initials}><span>{initials}</span></div>
            )}
            <div className={styles.spine} style={{ backgroundColor: darken(book.color) }} />

            {book.wouldReread && (
              <div className={`${styles.badge} ${styles.badgeFav}`} title="Volvería a leer">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
            )}
            {isFinished && (
              <div className={styles.badge} title="Leído">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
            {isReading && (
              <div className={`${styles.badge} ${styles.badgeReading}`} title="Leyendo">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="4" stroke="white" strokeWidth="1.6"/>
                  <path d="M6 4v2l1.5 1.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </div>
            )}
            {isPending && (
              <div className={`${styles.badge} ${styles.badgePending}`} title="Pendiente">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
            {progress !== null && (
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>

          <div className={styles.info}>
            <p className={styles.title}>{book.title}</p>
            <p className={styles.author}>{book.author}</p>
          </div>
        </div>

        {/* BACK */}
        <div className={styles.back}>
          <div className={styles.backHeader} style={{ backgroundColor: book.color || 'var(--color-accent)' }}>
            <button
              data-action="close"
              className={styles.backClose}
              onClick={(e) => { e.stopPropagation(); setConfirmando(false); setFlipped(false) }}
              aria-label="Volver"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className={styles.backHeaderText}>
              <p className={styles.backTitle}>{book.title}</p>
              <p className={styles.backAuthor}>{book.author}</p>
            </div>
          </div>

          <div className={styles.backBody}>
            {book.publisher && (
              <div className={styles.row}>
                <span className={styles.rowLabel}>Editorial</span>
                <span className={styles.rowValue}>{book.publisher}</span>
              </div>
            )}
            {book.genre && (
              <div className={styles.row}>
                <span className={styles.rowLabel}>Género</span>
                <span className={styles.rowValue}>{book.genre}</span>
              </div>
            )}
            {book.startDate && (
              <div className={styles.row}>
                <span className={styles.rowLabel}>Inicio</span>
                <span className={styles.rowValue}>{formatDate(book.startDate)}</span>
              </div>
            )}
            {book.endDate && (
              <div className={styles.row}>
                <span className={styles.rowLabel}>Fin</span>
                <span className={styles.rowValue}>{formatDate(book.endDate)}</span>
              </div>
            )}
            {progress !== null && (
              <div className={styles.row}>
                <span className={styles.rowLabel}>Progreso</span>
                <span className={styles.rowValue}>{progress}%</span>
              </div>
            )}
            {hasScore(book) && (
              <div className={styles.row}>
                <span className={styles.rowLabel}>Puntaje</span>
                <StarRating value={book.score!} readonly size={12} />
              </div>
            )}
            {book.notes && (
              <div className={styles.notes}>
                <span className={styles.rowLabel}>Notas</span>
                <p className={styles.notesText}>{book.notes}</p>
              </div>
            )}

            <div className={styles.tapHint}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Tocá para ver más
            </div>

            <div className={styles.actions}>
              {confirmando ? (
                <div data-action="confirm" className={styles.confirmRow}>
                  <span className={styles.confirmLabel}>¿Eliminar?</span>
                  <button
                    data-action="confirm-yes"
                    className={`${styles.actionBtn} ${styles.confirmYes}`}
                    onClick={(e) => { e.stopPropagation(); onDelete() }}
                  >Sí</button>
                  <button
                    data-action="confirm-no"
                    className={styles.actionBtn}
                    onClick={(e) => { e.stopPropagation(); setConfirmando(false) }}
                  >No</button>
                </div>
              ) : (
                <>
                  <button
                    data-action="edit"
                    className={styles.actionBtn}
                    onClick={(e) => { e.stopPropagation(); onEdit() }}
                  >
                    Editar
                  </button>
                  <button
                    data-action="delete"
                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                    onClick={(e) => { e.stopPropagation(); setConfirmando(true) }}
                  >
                    Eliminar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function darken(hex: string | undefined): string {
  if (!hex || !hex.startsWith('#')) return 'rgba(0,0,0,0.25)'
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, (n >> 16) - 40)
  const g = Math.max(0, ((n >> 8) & 0xff) - 40)
  const b = Math.max(0, (n & 0xff) - 40)
  return `rgb(${r},${g},${b})`
}
