import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import styles from './WorkPage.module.css'

interface WorkDetail {
  id: string
  title: string
  subjects: string[]
  firstPublishYear: number | null
  authors: { id: string; name: string }[]
  editions: {
    id: string; title: string | null; isbn13: string | null; isbn10: string | null
    publisher: string | null; publishYear: number | null; language: string | null
    pages: number | null; coverUrl: string | null
  }[]
  reviews: { id: string; reflection: string; score: number | null; createdAt: string; authorAlias: string }[]
  libraryCount: number
}

export default function WorkPage() {
  const { id } = useParams<{ id: string }>()
  const [work, setWork] = useState<WorkDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/librook-api/catalog/works/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'No encontramos esta obra.' : 'Error al cargar la obra')
        return res.json()
      })
      .then((data: WorkDetail) => { if (!cancelled) setWork(data) })
      .catch((err) => { if (!cancelled) setError((err as Error).message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!work) return
    document.title = `${work.title} — Librook`
    const meta = document.querySelector('meta[name="description"]')
    const authorNames = work.authors.map((a) => a.name).join(', ')
    if (meta) meta.setAttribute('content', `${work.title}${authorNames ? ` de ${authorNames}` : ''} — ficha, ediciones y reseñas de la comunidad en Librook.`)
  }, [work])

  if (loading) {
    return (
      <div className={styles.layout}>
        <p className={styles.status} role="status">Cargando…</p>
      </div>
    )
  }

  if (error || !work) {
    return (
      <div className={styles.layout}>
        <p className={styles.statusError} role="alert">{error || 'No encontramos esta obra.'}</p>
        <Link to="/catalog" className={styles.backLink}>Volver al catálogo</Link>
      </div>
    )
  }

  const cover = work.editions.find((e) => e.coverUrl)?.coverUrl

  return (
    <div className={styles.layout}>
      <Link to="/catalog" className={styles.backLink}>&larr; Catálogo</Link>

      <div className={styles.hero}>
        <div className={styles.cover} style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
          {!cover && <span className={styles.coverFallback}>{work.title.slice(0, 2).toUpperCase()}</span>}
        </div>
        <div className={styles.heroInfo}>
          <h1 className={styles.title}>{work.title}</h1>
          {work.authors.length > 0 && (
            <p className={styles.authors}>{work.authors.map((a) => a.name).join(', ')}</p>
          )}
          <div className={styles.metaRow}>
            {work.firstPublishYear && <span>Primera publicación: {work.firstPublishYear}</span>}
            <span>{work.libraryCount} {work.libraryCount === 1 ? 'persona tiene' : 'personas tienen'} este libro en Librook</span>
          </div>
          {work.subjects.length > 0 && (
            <div className={styles.tags}>
              {work.subjects.slice(0, 6).map((s) => <span key={s} className={styles.tag}>{s}</span>)}
            </div>
          )}
        </div>
      </div>

      {work.editions.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Ediciones</h2>
          <ul className={styles.editionsList}>
            {work.editions.map((e) => (
              <li key={e.id} className={styles.editionItem}>
                <strong>{e.title || work.title}</strong>
                <span className={styles.editionMeta}>
                  {[e.publisher, e.publishYear, e.language, e.pages ? `${e.pages} páginas` : null, e.isbn13 || e.isbn10]
                    .filter(Boolean).join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Reseñas de la comunidad ({work.reviews.length})</h2>
        {work.reviews.length === 0 ? (
          <p className={styles.status}>Todavía nadie compartió una reseña de este libro.</p>
        ) : (
          <ul className={styles.reviewsList}>
            {work.reviews.map((r) => (
              <li key={r.id} className={styles.reviewItem}>
                <div className={styles.reviewHeader}>
                  <strong>{r.authorAlias}</strong>
                  {r.score ? <span className={styles.reviewScore}>{'★'.repeat(r.score)}{'☆'.repeat(5 - r.score)}</span> : null}
                </div>
                <p className={styles.reviewText}>{r.reflection}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
