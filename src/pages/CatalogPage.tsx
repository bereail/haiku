import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalogSearch } from '../hooks/useCatalogSearch'
import styles from './CatalogPage.module.css'

export default function CatalogPage() {
  const [query, setQuery] = useState('')
  const { localResults, externalResults, loading, localError, search, clear } = useCatalogSearch()

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

        <div className={styles.searchBox}>
          <input
            type="text"
            className={styles.search}
            placeholder="Buscar por título..."
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            autoFocus
          />
        </div>

        {loading && <p className={styles.status}>Buscando…</p>}
        {localError && <p className={styles.statusError}>{localError}</p>}

        {!loading && query.trim().length >= 2 && localResults.length === 0 && externalResults.length === 0 && (
          <p className={styles.status}>No encontramos nada con ese título.</p>
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
