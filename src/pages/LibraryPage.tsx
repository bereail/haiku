import { useState, useMemo, useRef, useEffect, ReactNode } from 'react'
import BookCard from '../components/BookCard'
import styles from './LibraryPage.module.css'
import type { Book, Goal } from '../types'

const ITEMS_PER_PAGE = 48

const STATUS_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'reading', label: 'Leyendo' },
  { key: 'finished', label: 'Leídos' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'abandoned', label: 'Abandonados' },
]

const SORT_OPTIONS = [
  { key: 'recent', label: 'Más recientes' },
  { key: 'oldest', label: 'Menos recientes' },
  { key: 'score', label: 'Mejor puntaje' },
  { key: 'az', label: 'A → Z' },
  { key: 'za', label: 'Z → A' },
]

function GoalBar({ books, goal }: { books: Book[]; goal: Goal }) {
  const currentYear = new Date().getFullYear()
  const done = books.filter(b => b.endDate && b.endDate.startsWith(String(currentYear))).length
  const pct = Math.min(100, Math.round((done / goal.count) * 100))
  return (
    <div className={styles.goalBar}>
      <div className={styles.goalInfo}>
        <span className={styles.goalLabel}>Meta {currentYear}</span>
        <span className={styles.goalCount}>{done} de {goal.count} leídos</span>
      </div>
      <div className={styles.goalTrack}>
        <div className={styles.goalFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.goalPct}>{pct}%</span>
    </div>
  )
}

function sortBooks(books: Book[], sort: string): Book[] {
  return [...books].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
    switch (sort) {
      case 'score':
        return (b.score || 0) - (a.score || 0) || bTime - aTime
      case 'oldest':
        return aTime - bTime
      case 'az':
        return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' })
      case 'za':
        return b.title.localeCompare(a.title, 'es', { sensitivity: 'base' })
      default:
        return bTime - aTime
    }
  })
}

function Pagination({ currentPage, totalPages, onChange }: {
  currentPage: number; totalPages: number; onChange: (p: number) => void
}) {
  if (totalPages <= 1) return null

  const pages: number[] = []
  const delta = 1
  const left = currentPage - delta
  const right = currentPage + delta

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= left && i <= right)) {
      pages.push(i)
    }
  }

  const withEllipsis: (number | string)[] = []
  let prev: number | null = null
  for (const page of pages) {
    if (prev !== null && page - prev > 1) {
      withEllipsis.push('...' + page)
    }
    withEllipsis.push(page)
    prev = page
  }

  return (
    <nav className={styles.pagination} aria-label="Paginación">
      <button
        className={styles.pageBtn}
        onClick={() => onChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Página anterior"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {withEllipsis.map((item, i) =>
        typeof item === 'string' ? (
          <span key={item + i} className={styles.pageEllipsis}>…</span>
        ) : (
          <button
            key={item}
            className={`${styles.pageBtn} ${item === currentPage ? styles.pageBtnActive : ''}`}
            onClick={() => onChange(item)}
            aria-label={`Página ${item}`}
            aria-current={item === currentPage ? 'page' : undefined}
          >
            {item}
          </button>
        )
      )}

      <button
        className={styles.pageBtn}
        onClick={() => onChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Página siguiente"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </nav>
  )
}

interface LibraryPageProps {
  books: Book[]
  loading: boolean
  error: string | null
  onRetry: () => void
  dark: boolean
  goal: Goal
  onToggleTheme: () => void
  onLogout: () => void
  onAddBook: () => void
  onSearchBooks: () => void
  onVoiceEntry: () => void
  onViewBook: (book: Book) => void
  onEditBook: (book: Book) => void
  onDeleteBook: (id: string) => void
  onShowStats: () => void
  onOpenCommunity: () => void
  isAdmin: boolean
  onExportHtml: () => void
  onExport?: () => void
  onImport?: (file: File) => void
  onOpenAdmin?: () => void
  modal?: ReactNode
}

export default function LibraryPage({
  books, loading, error, onRetry, dark, goal, onToggleTheme, onLogout,
  onAddBook, onSearchBooks, onVoiceEntry, onViewBook, onEditBook, onDeleteBook,
  onShowStats, onOpenCommunity, isAdmin, onExportHtml, onExport, onImport, onOpenAdmin, modal,
}: LibraryPageProps) {
  const importRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('recent')
  const [advOpen, setAdvOpen] = useState(false)
  const [filterEditorial, setFilterEditorial] = useState('')
  const [filterAutor, setFilterAutor] = useState('')
  const [filterGenero, setFilterGenero] = useState('')
  const [filterFav, setFilterFav] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const editorials = useMemo(() =>
    [...new Set(books.map(b => b.publisher).filter((v): v is string => Boolean(v)))].sort(), [books])
  const autores = useMemo(() =>
    [...new Set(books.map(b => b.author).filter((v): v is string => Boolean(v)))].sort(), [books])
  const generos = useMemo(() =>
    [...new Set(books.map(b => b.genre).filter((v): v is string => Boolean(v)))].sort(), [books])

  const activeAdvCount = [filterEditorial, filterAutor, filterGenero].filter(Boolean).length

  const filtered = useMemo(() => {
    const base = books.filter(b => {
      const q = search.toLowerCase()
      const matchSearch = !search ||
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q)
      const matchStatus =
        status === 'all' ||
        (status === 'finished' && b.endDate) ||
        (status === 'reading' && b.startDate && !b.endDate && !b.abandoned) ||
        (status === 'pending' && !b.startDate && !b.endDate) ||
        (status === 'abandoned' && !!b.abandoned && !b.endDate)
      const matchEditorial = !filterEditorial || b.publisher === filterEditorial
      const matchAutor = !filterAutor || b.author === filterAutor
      const matchGenero = !filterGenero || b.genre === filterGenero
      const matchFav = !filterFav || !!b.wouldReread
      return matchSearch && matchStatus && matchEditorial && matchAutor && matchGenero && matchFav
    })
    return sortBooks(base, sort)
  }, [books, search, status, sort, filterEditorial, filterAutor, filterGenero, filterFav])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, status, sort, filterEditorial, filterAutor, filterGenero, filterFav])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const clearAdv = () => {
    setFilterEditorial('')
    setFilterAutor('')
    setFilterGenero('')
    setFilterFav(false)
  }

  const handleImportClick = () => {
    importRef.current?.click()
    setMenuOpen(false)
  }

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.logo}>Librook</h1>

          <nav className={styles.nav}>
            {/* Primary actions — always visible */}
            <button
              className={styles.voiceBtn}
              onClick={onVoiceEntry}
              aria-label="Registrar lectura por voz"
              title="Registrar lectura por voz"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <span className={styles.btnText}>Contame qué leíste</span>
            </button>

            <button
              className={styles.searchBtn}
              onClick={onSearchBooks}
              aria-label="Buscar en Open Library"
              aria-keyshortcuts="b"
              title="Buscar en Open Library (tecla B)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span className={styles.btnText}>Buscar</span>
            </button>

            <button
              className={styles.searchBtn}
              onClick={onAddBook}
              aria-keyshortcuts="n"
              title="Agregar libro (tecla N)"
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span className={styles.btnText}>Agregar</span>
            </button>

            {/* Secondary actions — visible on desktop only */}
            <div className={styles.desktopActions}>
              <button
                className={styles.iconBtn}
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

              <button
                className={styles.iconBtn}
                onClick={onShowStats}
                title="Estadísticas (tecla E)"
                aria-label="Estadísticas"
                aria-keyshortcuts="e"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              <button
                className={styles.iconBtn}
                onClick={onOpenCommunity}
                title="Comunidad"
                aria-label="Comunidad"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="9" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M2.5 20a6.5 6.5 0 0113 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <circle cx="17.5" cy="8.5" r="2.6" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M15 14.2a5.2 5.2 0 016.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>

              <button
                className={styles.iconBtn}
                onClick={onExportHtml}
                title="Exportar biblioteca (HTML)"
                aria-label="Exportar biblioteca"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {isAdmin && onExport && (
                <button
                  className={styles.iconBtn}
                  onClick={onExport}
                  title="Exportar JSON (admin)"
                  aria-label="Exportar JSON"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <text x="12" y="8" textAnchor="middle" fontSize="7" fill="currentColor" fontFamily="monospace">{'{}'}</text>
                  </svg>
                </button>
              )}

              {isAdmin && onImport && (
                <button
                  className={styles.iconBtn}
                  onClick={() => importRef.current?.click()}
                  title="Importar JSON (admin)"
                  aria-label="Importar JSON"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}

              {onOpenAdmin && (
                <button
                  className={styles.iconBtn}
                  onClick={onOpenAdmin}
                  title="Panel admin"
                  aria-label="Panel admin"
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}

              <button
                className={styles.iconBtn}
                onClick={onLogout}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* More menu — visible on mobile only */}
            <div className={styles.moreWrap} ref={menuRef}>
              <button
                className={`${styles.iconBtn} ${menuOpen ? styles.iconBtnOpen : ''}`}
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Más opciones"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
                  <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                  <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
                </svg>
              </button>

              {menuOpen && (
                <div className={styles.menuDropdown} role="menu">
                  <button
                    className={styles.menuItem}
                    onClick={() => { onToggleTheme(); setMenuOpen(false) }}
                    role="menuitem"
                  >
                    {dark ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.8"/>
                        <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    <span>{dark ? 'Modo claro' : 'Modo oscuro'}</span>
                  </button>

                  <button
                    className={styles.menuItem}
                    onClick={() => { onShowStats(); setMenuOpen(false) }}
                    role="menuitem"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Estadísticas</span>
                  </button>

                  <button
                    className={styles.menuItem}
                    onClick={() => { onOpenCommunity(); setMenuOpen(false) }}
                    role="menuitem"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="9" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.8"/>
                      <path d="M2.5 20a6.5 6.5 0 0113 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      <circle cx="17.5" cy="8.5" r="2.6" stroke="currentColor" strokeWidth="1.8"/>
                      <path d="M15 14.2a5.2 5.2 0 016.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                    <span>Comunidad</span>
                  </button>

                  <button
                    className={styles.menuItem}
                    onClick={() => { onExportHtml(); setMenuOpen(false) }}
                    role="menuitem"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Exportar HTML</span>
                  </button>

                  {isAdmin && onExport && (
                    <button
                      className={styles.menuItem}
                      onClick={() => { onExport!(); setMenuOpen(false) }}
                      role="menuitem"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Exportar JSON</span>
                    </button>
                  )}

                  {isAdmin && onImport && (
                    <button
                      className={styles.menuItem}
                      onClick={handleImportClick}
                      role="menuitem"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Importar JSON</span>
                    </button>
                  )}

                  {onOpenAdmin && (
                    <button
                      className={styles.menuItem}
                      onClick={() => { onOpenAdmin!(); setMenuOpen(false) }}
                      role="menuitem"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8"/>
                        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Panel admin</span>
                    </button>
                  )}

                  <div className={styles.menuDivider} aria-hidden="true" />

                  <button
                    className={`${styles.menuItem} ${styles.menuItemLogout}`}
                    onClick={onLogout}
                    role="menuitem"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        {loading ? (
          <div className={styles.loadingState} role="status" aria-live="polite">
            <svg className={styles.spinner} width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2"/>
              <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p className={styles.loadingText}>Cargando tu biblioteca…</p>
          </div>
        ) : error ? (
          <div className={styles.errorState} role="alert">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" opacity="0.35" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <p className={styles.errorTitle}>No pudimos cargar tu biblioteca</p>
            <p className={styles.errorSub}>{error}</p>
            <button className={styles.emptyWelcomeBtn} onClick={onRetry}>
              Reintentar
            </button>
          </div>
        ) : (
        <>

        {goal.count > 0 && (
          <GoalBar books={books} goal={goal} />
        )}

        <div className={styles.searchRow}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <input
              className={styles.search}
              type="search"
              placeholder="Buscar por título o autor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Buscar en tu biblioteca"
            />
            {search && (
              <button
                className={styles.searchClear}
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
              >
                <svg width="13" height="13" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
          <select
            className={styles.sortSelect}
            value={sort}
            onChange={e => setSort(e.target.value)}
            aria-label="Ordenar"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.filtersRow}>
          <div className={styles.statusFilters}>
            {STATUS_FILTERS.map(f => (
              <button
                key={f.key}
                className={`${styles.filterBtn} ${status === f.key ? styles.active : ''}`}
                onClick={() => setStatus(f.key)}
                aria-pressed={status === f.key}
              >
                {f.label}
              </button>
            ))}
            <button
              className={`${styles.filterBtn} ${styles.filterFavBtn} ${filterFav ? styles.active : ''}`}
              onClick={() => setFilterFav(o => !o)}
              aria-pressed={filterFav}
              title="Mostrar solo los que volvería a leer"
            >
              ★ Favoritos
            </button>
          </div>

          <button
            className={`${styles.advBtn} ${advOpen ? styles.advBtnOpen : ''}`}
            onClick={() => setAdvOpen(o => !o)}
            aria-expanded={advOpen}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="7" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="10" y1="18" x2="14" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>Filtros</span>
            {activeAdvCount > 0 && (
              <span className={styles.advBadge}>{activeAdvCount}</span>
            )}
          </button>
        </div>

        {advOpen && (
          <div className={styles.advPanel}>
            <div className={styles.advSelects}>
              <div className={styles.advField}>
                <label className={styles.advLabel}>Editorial</label>
                <select
                  className={styles.advSelect}
                  value={filterEditorial}
                  onChange={e => setFilterEditorial(e.target.value)}
                >
                  <option value="">Todas</option>
                  {editorials.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className={styles.advField}>
                <label className={styles.advLabel}>Autor/a</label>
                <select
                  className={styles.advSelect}
                  value={filterAutor}
                  onChange={e => setFilterAutor(e.target.value)}
                >
                  <option value="">Todos</option>
                  {autores.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className={styles.advField}>
                <label className={styles.advLabel}>Género</label>
                <select
                  className={styles.advSelect}
                  value={filterGenero}
                  onChange={e => setFilterGenero(e.target.value)}
                >
                  <option value="">Todos</option>
                  {generos.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            {activeAdvCount > 0 && (
              <div className={styles.activeTags}>
                {filterEditorial && (
                  <span className={styles.tag}>
                    Editorial: {filterEditorial}
                    <button onClick={() => setFilterEditorial('')} aria-label="Quitar filtro editorial">×</button>
                  </span>
                )}
                {filterAutor && (
                  <span className={styles.tag}>
                    Autor/a: {filterAutor}
                    <button onClick={() => setFilterAutor('')} aria-label="Quitar filtro autor">×</button>
                  </span>
                )}
                {filterGenero && (
                  <span className={styles.tag}>
                    Género: {filterGenero}
                    <button onClick={() => setFilterGenero('')} aria-label="Quitar filtro género">×</button>
                  </span>
                )}
                <button className={styles.clearAll} onClick={clearAdv}>Limpiar todo</button>
              </div>
            )}
          </div>
        )}

        <div className={styles.stats}>
          <span className={styles.count}>
            {filtered.length} {filtered.length === 1 ? 'libro' : 'libros'}
            {totalPages > 1 && (
              <span className={styles.pageInfo}>
                {' '}· pág. {currentPage}/{totalPages}
              </span>
            )}
          </span>
        </div>

        {filtered.length === 0 ? (
          books.length === 0 ? (
            <div className={styles.emptyWelcome}>
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" opacity="0.15" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              <p className={styles.emptyWelcomeTitle}>Tu biblioteca está vacía</p>
              <p className={styles.emptyWelcomeSub}>Contame qué leíste, o buscalo vos mismo/a</p>
              <button className={styles.emptyWelcomeBtn} onClick={onVoiceEntry}>
                🎙️ Contame qué leíste
              </button>
              <button className={styles.emptyWelcomeLink} onClick={onSearchBooks}>
                Buscar un libro
              </button>
              <button className={styles.emptyWelcomeLink} onClick={onAddBook}>
                O agregalo manualmente
              </button>
            </div>
          ) : (
            <div className={styles.empty}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" opacity="0.18" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              <p>{search ? `Sin resultados para "${search}"` : 'No hay libros en esta categoría'}</p>
              {(search || activeAdvCount > 0 || status !== 'all' || filterFav) && (
                <button className={styles.clearSearch} onClick={() => { setSearch(''); clearAdv(); setStatus('all') }}>
                  Limpiar todos los filtros
                </button>
              )}
            </div>
          )
        ) : (
          <>
            <div className={styles.grid}>
              {paginated.map(book => (
                <BookCard
                  key={book.id}
                  book={book}
                  onView={() => onViewBook(book)}
                  onEdit={() => onEditBook(book)}
                  onDelete={() => onDeleteBook(book.id)}
                />
              ))}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onChange={setCurrentPage}
            />
          </>
        )}
        </>
        )}

        <button
          className={styles.fab}
          onClick={onAddBook}
          aria-label="Agregar libro"
        >
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </button>

        <button
          className={styles.voiceFab}
          onClick={onVoiceEntry}
          aria-label="Registrar lectura por voz"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.9"/>
            <path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
          </svg>
        </button>
      </main>

      {modal}

      {isAdmin && onImport && (
        <input
          ref={importRef}
          type="file"
          accept=".json"
          onChange={e => { if (e.target.files?.[0]) onImport(e.target.files[0]); e.target.value = '' }}
          hidden
          aria-hidden="true"
        />
      )}
    </div>
  )
}
