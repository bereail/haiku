import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalogSearch } from '../hooks/useCatalogSearch'
import { useTheme } from '../hooks/useTheme'
import styles from './CatalogPage.module.css'

export default function CatalogPage() {
  const [query, setQuery] = useState('')
  const { localResults, externalResults, loading, localError, search, clear } = useCatalogSearch()
  // Página pública, fuera de AuthenticatedApp: sin esto nunca se fijaba data-theme
  // en <html> y una visita directa quedaba siempre en modo claro.
  const { dark, toggle: toggleTheme } = useTheme()

  useEffect(() => {
    document.title = 'Catálogo — Librook'
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', 'Explorá libros, reseñas y ediciones en el catálogo público de Librook, sin necesidad de registrarte.')
    return () => clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    search(value)
  }

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.logo}>Librook</Link>
          <nav className={styles.nav}>
            <button
              type="button"
              className={styles.themeBtn}
              onClick={toggleTheme}
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

      <main className={styles.main}>
        <div className={styles.intro}>
          <h1 className={styles.title}>Catálogo público</h1>
          <p className={styles.subtitle}>
            Explorá los libros que ya forman parte de la comunidad de Librook — con reseñas
            reales de otros lectores. No hace falta una cuenta para buscar.
          </p>
        </div>

        <label className={styles.searchBox}>
          <svg className={styles.searchIcon} width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            className={styles.search}
            placeholder="Buscar por título..."
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            autoFocus
          />
        </label>

        {loading && <p className={styles.status} role="status">Buscando…</p>}
        {localError && <p className={styles.statusError} role="alert">{localError}</p>}

        {!loading && query.trim().length >= 2 && localResults.length === 0 && externalResults.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No encontramos «{query.trim()}» en el catálogo.</p>
            <p className={styles.emptyHint}>Probá con otro título, o revisá que esté bien escrito — buscamos primero en Librook y después en Open Library.</p>
          </div>
        )}

        {localResults.length > 0 && (
          <section>
            <h2 className={styles.sectionTitle}>En Librook</h2>
            <div className={styles.grid}>
              {localResults.map((w) => (
                <Link key={w.id} to={`/catalog/obra/${w.id}`} className={styles.card}>
                  <div className={styles.cover} style={w.coverUrl ? { backgroundImage: `url(${w.coverUrl})` } : undefined}>
                    {!w.coverUrl && <span className={styles.coverFallback}>{w.title.slice(0, 2).toUpperCase()}</span>}
                  </div>
                  <div className={styles.cardBody}>
                    <strong className={styles.cardTitle}>{w.title}</strong>
                    <span className={styles.cardMeta}>{w.authors.join(', ') || 'Autor desconocido'}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {externalResults.length > 0 && (
          <section>
            <h2 className={styles.sectionTitle}>
              También en Open Library
              <span className={styles.sectionHint}>— todavía sin reseñas en Librook</span>
            </h2>
            <div className={styles.grid}>
              {externalResults.map((b) => (
                <div key={b.key} className={styles.cardExternal}>
                  <div className={styles.cover} style={b.cover ? { backgroundImage: `url(${b.cover})` } : undefined}>
                    {!b.cover && <span className={styles.coverFallback}>{b.title.slice(0, 2).toUpperCase()}</span>}
                    <span className={styles.externalBadge}>Open Library</span>
                  </div>
                  <div className={styles.cardBody}>
                    <strong className={styles.cardTitle}>{b.title}</strong>
                    <span className={styles.cardMeta}>{b.author || 'Autor desconocido'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {query.trim().length < 2 && (
          <p className={styles.hint}>Escribí al menos 2 caracteres para buscar.</p>
        )}
      </main>
    </div>
  )
}
