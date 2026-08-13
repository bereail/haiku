import { useState, useEffect } from 'react'
import StarRating from './StarRating'
import styles from './BookDetailModal.module.css'
import { formatDate, getInitials, getBookStatus, hasScore } from '../utils'
import type { Book } from '../types'

interface BookDetailModalProps {
  book: Book
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
  onMarkRead: () => void
  onToggleCommunity: (share: boolean) => void
  sharingToCommunity?: boolean
}

export default function BookDetailModal({ book, onEdit, onDelete, onClose, onMarkRead, onToggleCommunity, sharingToCommunity }: BookDetailModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const { isReading, isFinished, progress } = getBookStatus(book)

  const statusLabel = isFinished ? 'Leído' : isReading ? 'Leyendo' : 'Pendiente'
  const statusClass = isFinished
    ? styles.statusFinished
    : isReading
    ? styles.statusReading
    : styles.statusPending

  return (
    <div
      className={styles.overlay}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title} id="detail-title">{book.title}</h2>
            {book.author && <p className={styles.author}>{book.author}</p>}
          </div>
          <div className={styles.headerActions}>
            <button className={styles.editBtn} onClick={onEdit}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Editar
            </button>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.top}>
            {book.cover ? (
              <div className={styles.coverWrap}>
                <img
                  src={book.cover}
                  alt={`Tapa de ${book.title}`}
                  className={styles.cover}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            ) : (
              <div
                className={styles.coverPlaceholder}
                style={{ backgroundColor: book.color || 'var(--color-accent)' }}
              >
                <span className={styles.placeholderInitials}>
                  {getInitials(book.title)}
                </span>
              </div>
            )}

            <div className={styles.meta}>
              <span className={`${styles.statusBadge} ${statusClass}`}>{statusLabel}</span>

              {book.publisher && (
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Editorial</span>
                  <span className={styles.metaValue}>{book.publisher}</span>
                </div>
              )}
              {book.genre && (
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Género</span>
                  <span className={styles.metaValue}>{book.genre}</span>
                </div>
              )}
              {book.year && (
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Año</span>
                  <span className={styles.metaValue}>{book.year}</span>
                </div>
              )}
              {book.startDate && (
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Inicio</span>
                  <span className={styles.metaValue}>{formatDate(book.startDate)}</span>
                </div>
              )}
              {book.endDate && (
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Fin</span>
                  <span className={styles.metaValue}>{formatDate(book.endDate)}</span>
                </div>
              )}
              {(book.totalPages ?? 0) > 0 && (
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Páginas</span>
                  <span className={styles.metaValue}>
                    {progress !== null ? `${book.currentPage} / ${book.totalPages}` : book.totalPages}
                  </span>
                </div>
              )}
              {hasScore(book) && (
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Puntaje</span>
                  <StarRating value={book.score!} readonly size={15} />
                </div>
              )}
              {book.wouldReread && (
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Favorito</span>
                  <span className={styles.metaValue} style={{ color: '#c8922a' }}>★ Volvería a leer</span>
                </div>
              )}
            </div>
          </div>

          {progress !== null && (
            <div className={styles.progressWrap}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
              <span className={styles.progressLabel}>{progress}%</span>
            </div>
          )}

          {book.notes && (
            <div className={styles.notesBox}>
              <span className={styles.notesLabel}>Anotaciones</span>
              <p className={styles.notes}>{book.notes}</p>
            </div>
          )}
        </div>

        {isReading && !confirmDelete && (
          <div className={styles.markReadBanner}>
            <button className={styles.markReadBtn} onClick={onMarkRead}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Terminé de leerlo hoy
            </button>
          </div>
        )}

        <div className={styles.footer}>
          {confirmDelete ? (
            <>
              <span className={styles.confirmMsg}>¿Eliminar este libro?</span>
              <button className={styles.confirmNo} onClick={() => setConfirmDelete(false)}>No</button>
              <button className={styles.confirmYes} onClick={onDelete}>Sí, eliminar</button>
            </>
          ) : (
            <>
              <button className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>
                Eliminar
              </button>
              <label className={styles.shareCheck} title={!book.notes ? 'Agregá una anotación para poder compartir' : undefined}>
                <input
                  type="checkbox"
                  checked={!!book.communityPostId}
                  disabled={sharingToCommunity || (!book.communityPostId && !book.notes)}
                  onChange={e => onToggleCommunity(e.target.checked)}
                />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.8"/>
                  <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                  <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M8.6 10.6l6.8-3.7M8.6 13.4l6.8 3.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                {book.communityPostId ? 'Compartido en Comunidad' : 'Compartir en Comunidad'}
              </label>
              <button className={styles.editBtnLg} onClick={onEdit}>
                Editar libro
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
