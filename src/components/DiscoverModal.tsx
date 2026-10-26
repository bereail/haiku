import { useDialogA11y } from '../hooks/useDialogA11y'
import { useDiscover } from '../hooks/useDiscover'
import WorkCard from './WorkCard'
import { formatDateTime, getInitials } from '../utils'
import styles from './DiscoverModal.module.css'

interface DiscoverModalProps {
  onClose: () => void
  onOpenCommunity: () => void
}

function libraryBadge(count: number): string {
  if (count <= 0) return ''
  return count === 1 ? '1 lectora la tiene' : `${count} lectoras la tienen`
}

export default function DiscoverModal({ onClose, onOpenCommunity }: DiscoverModalProps) {
  const dialogRef = useDialogA11y(onClose)
  const { popular, recent, community, loading, error } = useDiscover(true)

  const catalogEmpty = !loading && !error && popular.length === 0 && recent.length === 0

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="discover-title" tabIndex={-1}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title} id="discover-title">Descubrir</h2>
            <p className={styles.subtitle}>Lo que está leyendo la comunidad de Librook.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {loading && <p className={styles.status} role="status">Cargando…</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}

          {catalogEmpty && (
            <section className={styles.section}>
              <div className={styles.emptyBig}>
                <p className={styles.emptyTitle}>El catálogo todavía no tiene fichas propias acá.</p>
                <p className={styles.emptyHint}>
                  A medida que se agreguen libros con ISBN, Librook va a armar fichas de obra
                  compartidas — y esta sección va a mostrar las más leídas entre todas las lectoras.
                </p>
              </div>
            </section>
          )}

          {popular.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Lo más leído del Catálogo</h3>
              <div className={styles.grid}>
                {popular.map(w => <WorkCard key={w.id} work={w} badge={libraryBadge(w.libraryCount ?? 0)} />)}
              </div>
            </section>
          )}

          {recent.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Para descubrir</h3>
              <div className={styles.grid}>
                {recent.map(w => <WorkCard key={w.id} work={w} />)}
              </div>
            </section>
          )}

          <section className={styles.section}>
            <div className={styles.sectionHeadRow}>
              <h3 className={styles.sectionTitle}>De la Comunidad</h3>
              <button type="button" className={styles.linkBtn} onClick={onOpenCommunity}>Ver todo</button>
            </div>
            {!loading && community.length === 0 ? (
              <div className={styles.emptyBig}>
                <p className={styles.emptyTitle}>Todavía no hay reflexiones compartidas.</p>
                <p className={styles.emptyHint}>Cuando alguien comparta una, en Comunidad, va a aparecer acá.</p>
              </div>
            ) : (
              <ul className={styles.feed}>
                {community.map(post => (
                  <li key={post.id} className={styles.post}>
                    {post.bookCover ? (
                      <img src={post.bookCover} alt="" className={styles.postCover} />
                    ) : (
                      <div className={styles.postCoverFallback}>{getInitials(post.bookTitle)}</div>
                    )}
                    <div className={styles.postBody}>
                      <p className={styles.postBook}>{post.bookTitle}{post.bookAuthor ? ` — ${post.bookAuthor}` : ''}</p>
                      <p className={styles.postReflection}>{post.reflection}</p>
                      <p className={styles.postMeta}>
                        <span>{post.authorAlias}</span>
                        <span className={styles.dot}>·</span>
                        <span>{formatDateTime(post.createdAt)}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Premios literarios</h3>
            <div className={styles.emptyBig}>
              <p className={styles.emptyTitle}>Todavía no mostramos premios literarios acá.</p>
              <p className={styles.emptyHint}>
                No queremos inventar datos de premios: hace falta sumar una fuente confiable
                antes de mostrar esta sección de verdad.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
