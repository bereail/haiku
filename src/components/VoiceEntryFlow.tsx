import { useCallback, useEffect, useRef } from 'react'
import { useDialogA11y } from '../hooks/useDialogA11y'
import { useVoiceEntry, type VoiceDraft } from '../hooks/useVoiceEntry'
import StarRating from './StarRating'
import styles from './VoiceEntryFlow.module.css'
import type { Book } from '../types'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  reading: 'Leyendo',
  read: 'Terminado',
  abandoned: 'Abandonado',
}

const ERROR_COPY: Record<string, { title: string; sub?: string }> = {
  'not-allowed': { title: 'Necesitamos permiso para usar el micrófono.' },
  'no-support': { title: 'La entrada por voz no está disponible en este navegador.' },
  'no-speech': { title: 'No te escuché. ¿Probamos de nuevo?' },
  'no-match': { title: 'No pude entenderte.', sub: 'No logré identificar qué libro es.' },
  network: { title: 'Hubo un problema de conexión.' },
  aborted: { title: 'Se canceló la grabación.' },
  unknown: { title: 'Algo salió mal. Intentemos de nuevo.' },
}

function CoverImg({ src, alt }: { src: string; alt: string }) {
  if (!src) return null
  return <img src={src} alt={alt} className={styles.cover} />
}

interface VoiceEntryFlowProps {
  books: Book[]
  onSave: (data: Omit<Book, 'id' | 'createdAt'>) => Promise<void>
  onClose: () => void
  onEditDraft: (draft: VoiceDraft) => void
  onSearchManually: () => void
  onViewDuplicate: (book: Book) => void
  onUpdateDuplicate: (book: Book, draft: VoiceDraft) => void
}

export default function VoiceEntryFlow({
  books, onSave, onClose, onEditDraft, onSearchManually, onViewDuplicate, onUpdateDuplicate,
}: VoiceEntryFlowProps) {
  const voice = useVoiceEntry({ books, onSave })
  const startedRef = useRef(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    voice.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (voice.phase !== 'saved') return
    const t = setTimeout(onClose, 1400)
    return () => clearTimeout(t)
  }, [voice.phase, onClose])

  const canDismiss = voice.phase !== 'saving'
  // Mismo patrón de diálogo accesible que el resto de los modales (foco
  // adentro, Tab atrapado, foco de vuelta al botón). Escape no cierra mientras
  // se está guardando, igual que antes.
  const closeIfAllowed = useCallback(() => { if (canDismiss) onClose() }, [canDismiss, onClose])
  const dialogRef = useDialogA11y(closeIfAllowed)

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={e => canDismiss && e.target === overlayRef.current && onClose()}
    >
      <div ref={dialogRef} className={styles.modal} role="dialog" aria-modal="true" aria-label="Registrar lectura por voz" tabIndex={-1}>
        {canDismiss && (
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        )}

        {voice.phase === 'listening' && (
          <div className={styles.stage}>
            <div className={styles.micPulse} aria-hidden="true">
              <span className={styles.micDot} />
            </div>
            <p className={styles.stageTitle}>Te escucho...</p>
            <p className={styles.transcript}>{voice.transcript || 'Contame qué libro terminaste'}</p>
            <div className={styles.actions}>
              <button className={styles.primaryBtn} onClick={voice.stopListening}>Listo</button>
              <button className={styles.linkBtn} onClick={onClose}>Cancelar</button>
            </div>
          </div>
        )}

        {voice.phase === 'processing' && (
          <div className={styles.stage}>
            <Spinner />
            <p className={styles.stageTitle}>Entendiendo tu lectura...</p>
          </div>
        )}

        {voice.phase === 'searching' && (
          <div className={styles.stage}>
            <Spinner />
            <p className={styles.stageTitle}>Buscando el libro...</p>
          </div>
        )}

        {voice.phase === 'picking' && (
          <div className={styles.stage}>
            <p className={styles.stageTitle}>¿Cuál es tu libro?</p>
            <ul className={styles.candidateList}>
              {voice.candidates.map(c => (
                <li key={c.key} className={styles.candidateItem} onClick={() => voice.pickCandidate(c)}>
                  <div className={styles.candidateCover}>
                    {c.cover ? <CoverImg src={c.cover} alt="" /> : <BookIcon />}
                  </div>
                  <div className={styles.candidateInfo}>
                    <span className={styles.candidateTitle}>{c.title}</span>
                    <span className={styles.candidateAuthor}>{c.author}{c.year ? ` · ${c.year}` : ''}</span>
                  </div>
                </li>
              ))}
            </ul>
            <button className={styles.linkBtn} onClick={onSearchManually}>Buscar manualmente</button>
          </div>
        )}

        {voice.phase === 'duplicate' && voice.duplicateBook && voice.draft && (
          <div className={styles.stage}>
            <p className={styles.stageTitle}>Ya tenés este libro en tu biblioteca</p>
            <p className={styles.stageSub}>{voice.duplicateBook.title} — {voice.duplicateBook.author}</p>
            <div className={styles.actionsCol}>
              <button className={styles.primaryBtn} onClick={() => onViewDuplicate(voice.duplicateBook!)}>Ver libro</button>
              <button className={styles.secondaryBtn} onClick={() => onUpdateDuplicate(voice.duplicateBook!, voice.draft!)}>
                Actualizar lectura
              </button>
              <button className={styles.linkBtn} onClick={onClose}>Cancelar</button>
            </div>
          </div>
        )}

        {voice.phase === 'confirm' && voice.draft && (
          <div className={styles.confirmStage}>
            <div className={styles.confirmCover}>
              {voice.draft.cover ? <CoverImg src={voice.draft.cover} alt="" /> : <BookIcon large />}
            </div>
            <p className={styles.confirmTitle}>{voice.draft.title}</p>
            {voice.draft.author && <p className={styles.confirmAuthor}>{voice.draft.author}</p>}

            <div className={styles.confirmStars}>
              <StarRating value={voice.draft.rating || 0} onChange={n => voice.updateDraft({ rating: n || null })} size={22} />
            </div>

            <span className={styles.statusChip}>{STATUS_LABEL[voice.draft.status]}</span>
            {voice.draft.progress !== null && voice.draft.status === 'reading' && (
              <span className={styles.progressNote}>Progreso: ~{voice.draft.progress}%</span>
            )}

            <textarea
              className={styles.reviewInput}
              value={voice.draft.review}
              onChange={e => voice.updateDraft({ review: e.target.value })}
              placeholder="Sin reseña"
              rows={3}
            />

            <div className={styles.actions}>
              <button className={styles.linkBtn} onClick={() => onEditDraft(voice.draft!)}>Editar</button>
              <button className={styles.primaryBtn} onClick={voice.confirmSave}>Guardar lectura</button>
            </div>
          </div>
        )}

        {voice.phase === 'saving' && (
          <div className={styles.stage}>
            <Spinner />
            <p className={styles.stageTitle}>Guardando...</p>
          </div>
        )}

        {voice.phase === 'saved' && (
          <div className={styles.stage}>
            <div className={styles.checkmark} aria-hidden="true">✓</div>
            <p className={styles.stageTitle}>Lectura registrada</p>
          </div>
        )}

        {voice.phase === 'error' && (
          <div className={styles.stage}>
            <p className={styles.stageTitle}>{ERROR_COPY[voice.errorKind || 'unknown'].title}</p>
            {ERROR_COPY[voice.errorKind || 'unknown'].sub && (
              <p className={styles.stageSub}>{ERROR_COPY[voice.errorKind || 'unknown'].sub}</p>
            )}
            <div className={styles.actionsCol}>
              {voice.errorKind !== 'not-allowed' && voice.errorKind !== 'no-support' && (
                <button className={styles.primaryBtn} onClick={() => { voice.retry(); voice.start() }}>
                  Intentar nuevamente
                </button>
              )}
              <button className={styles.secondaryBtn} onClick={onSearchManually}>Buscar manualmente</button>
              <button className={styles.linkBtn} onClick={onClose}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg className={styles.spinner} width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2"/>
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function BookIcon({ large }: { large?: boolean }) {
  const size = large ? 28 : 16
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" opacity="0.35" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )
}
