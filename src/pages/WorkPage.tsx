import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
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

function Header({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link to="/" className={styles.logo}>Librook</Link>
        <nav className={styles.nav}>
          <button
            type="button"
            className={styles.themeBtn}
            onClick={onToggleTheme}
            aria-label={dark ? 'Modo claro' : 'Modo oscuro'}
            title={dark ? 'Modo claro' : 'Modo oscuro'}
          >
            {dark ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
          <Link to="/" className={styles.loginLink}>Iniciar sesión</Link>
        </nav>
      </div>
    </header>
  )
}

export default function WorkPage() {
  const { id } = useParams<{ id: string }>()
  const [work, setWork] = useState<WorkDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Página pública, fuera de AuthenticatedApp: sin esto nunca se fijaba data-theme.
  const { dark, toggle: toggleTheme } = useTheme()

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
        <Header dark={dark} onToggleTheme={toggleTheme} />
        <div className={styles.main}>
          <p className={styles.status} role="status">Cargando…</p>
        </div>
      </div>
    )
  }

  if (error || !work) {
    return (
      <div className={styles.layout}>
        <Header dark={dark} onToggleTheme={toggleTheme} />
        <div className={styles.main}>
          <p className={styles.statusError} role="alert">{error || 'No encontramos esta obra.'}</p>
          <Link to="/catalog" className={styles.backLink}>&larr; Volver al catálogo</Link>
        </div>
      </div>
    )
  }

  const cover = work.editions.find((e) => e.coverUrl)?.coverUrl

  return (
    <div className={styles.layout}>
      <Header dark={dark} onToggleTheme={toggleTheme} />
      <div className={styles.main}>
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
              <span className={styles.metaPill}>
                {work.libraryCount} {work.libraryCount === 1 ? 'persona tiene' : 'personas tienen'} este libro
              </span>
              {work.firstPublishYear && <span className={styles.metaPillSlate}>{work.firstPublishYear}</span>}
              {work.subjects.slice(0, 5).map((s) => <span key={s} className={styles.metaPillSlate}>{s}</span>)}
            </div>
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
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Todavía nadie compartió una reseña de este libro.</p>
              <p className={styles.emptyHint}>Registrate y agregalo a tu biblioteca para ser la primera persona en comentarlo.</p>
            </div>
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
    </div>
  )
}
