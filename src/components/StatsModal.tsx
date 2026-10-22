import { useMemo, useState } from 'react'
import { useDialogA11y } from '../hooks/useDialogA11y'
import styles from './StatsModal.module.css'
import type { Book, Goal } from '../types'
import { hasScore } from '../utils'

const MS_PER_DAY = 86400000

function CoverImg({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [hasError, setHasError] = useState(false)
  if (hasError) return null
  return <img src={src} alt={alt} className={className} onError={() => setHasError(true)} />
}

function calcularStats(books: Book[]) {
  const currentYear = new Date().getFullYear()
  const leidos = books.filter(b => b.endDate)
  // Mismo criterio que el filtro "Leyendo" de la biblioteca: un abandonado no se está leyendo.
  const leyendo = books.filter(b => b.startDate && !b.endDate && !b.abandoned)
  const pendientes = books.filter(b => !b.startDate && !b.endDate)

  const scored = leidos.filter(hasScore)
  const avgScore = scored.length
    ? scored.reduce((s, b) => s + (b.score ?? 0), 0) / scored.length
    : null

  const byYear: Record<string, number> = {}
  leidos.forEach(b => {
    const y = b.endDate.slice(0, 4)
    byYear[y] = (byYear[y] || 0) + 1
  })
  const years: [string, number][] = Object.entries(byYear)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .slice(0, 5) as [string, number][]
  const maxInYear = Math.max(...years.map(([, n]) => n), 1)

  const authorCount: Record<string, number> = {}
  books.forEach(b => { if (b.author) authorCount[b.author] = (authorCount[b.author] || 0) + 1 })
  const topAuthors: [string, number][] = Object.entries(authorCount).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 3) as [string, number][]

  const genreCount: Record<string, number> = {}
  books.forEach(b => { if (b.genre) genreCount[b.genre] = (genreCount[b.genre] || 0) + 1 })
  const topGenres: [string, number][] = Object.entries(genreCount).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 3) as [string, number][]

  const reads = leidos
    .filter(b => b.startDate)
    .map(b => ({
      ...b,
      days: Math.max(1, Math.ceil((new Date(b.endDate).getTime() - new Date(b.startDate).getTime()) / MS_PER_DAY)),
    }))
    .sort((a, b) => a.days - b.days)

  const totalPages = books.reduce((s, b) => s + (Number(b.totalPages) || 0), 0)
  const bestRated = [...leidos].filter(hasScore).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3)
  const thisYear = leidos.filter(b => b.endDate?.startsWith(String(currentYear))).length

  return {
    total: books.length,
    leidos: leidos.length,
    leyendo: leyendo.length,
    pendientes: pendientes.length,
    avgScore,
    years,
    maxInYear,
    topAuthors,
    topGenres,
    fastest: reads[0] || null,
    slowest: reads[reads.length - 1] || null,
    totalPages,
    bestRated,
    thisYear,
  }
}

function Stars({ value }: { value: number }) {
  return (
    <span className={styles.stars}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ opacity: i <= Math.round(value) ? 1 : 0.2 }}>★</span>
      ))}
    </span>
  )
}

function IconFastest() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconSlowest() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

function IconPages() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

interface StatsModalProps {
  books: Book[]
  goal: Goal
  onUpdateGoal: (n: number | string) => void
  onClose: () => void
}

export default function StatsModal({ books, goal, onUpdateGoal, onClose }: StatsModalProps) {
  const s = useMemo(() => calcularStats(books), [books])
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState(String(goal?.count || 0))
  const currentYear = new Date().getFullYear()
  const dialogRef = useDialogA11y(onClose)

  const formatDays = (d: number) => d === 1 ? '1 día' : `${d} días`

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stats-modal-title"
        tabIndex={-1}
      >
        <div className={styles.header}>
          <h2 className={styles.title} id="stats-modal-title">Estadísticas</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar estadísticas">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className={styles.scroll}>

          {/* Resumen */}
          <section className={styles.section} aria-labelledby="stats-resumen">
            <h3 className={styles.sectionTitle} id="stats-resumen">Resumen</h3>
            <div className={styles.bigNumbers}>
              <div className={styles.bigNum}>
                <span className={styles.numValue}>{s.total}</span>
                <span className={styles.numLabel}>Total</span>
              </div>
              <div className={`${styles.bigNum} ${styles.numFinished}`}>
                <span className={styles.numValue}>{s.leidos}</span>
                <span className={styles.numLabel}>Leídos</span>
              </div>
              <div className={`${styles.bigNum} ${styles.numReading}`}>
                <span className={styles.numValue}>{s.leyendo}</span>
                <span className={styles.numLabel}>Leyendo</span>
              </div>
              <div className={styles.bigNum}>
                <span className={styles.numValue}>{s.pendientes}</span>
                <span className={styles.numLabel}>Pendientes</span>
              </div>
            </div>
          </section>

          {/* Meta anual */}
          <section className={styles.section} aria-labelledby="stats-meta">
            <h3 className={styles.sectionTitle} id="stats-meta">Meta {currentYear}</h3>
            {editingGoal ? (
              <div className={styles.goalEdit}>
                <input
                  className={styles.goalInput}
                  type="number"
                  min="0"
                  max="365"
                  value={goalInput}
                  onChange={e => setGoalInput(e.target.value)}
                  autoFocus
                  aria-label="Cantidad de libros como meta anual"
                />
                <span className={styles.goalInputLabel}>libros</span>
                <button
                  type="button"
                  className={styles.goalSave}
                  onClick={() => { onUpdateGoal(goalInput); setEditingGoal(false) }}
                >Guardar</button>
                <button
                  type="button"
                  className={styles.goalCancel}
                  onClick={() => setEditingGoal(false)}
                >Cancelar</button>
              </div>
            ) : (
              <div className={styles.goalDisplay}>
                {goal?.count > 0 ? (
                  <>
                    <div
                      className={styles.goalTrack}
                      role="progressbar"
                      aria-valuenow={Math.min(100, Math.round((s.thisYear / goal.count) * 100))}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="Progreso de meta anual"
                    >
                      <div
                        className={styles.goalFill}
                        style={{ width: `${Math.min(100, Math.round((s.thisYear / goal.count) * 100))}%` }}
                      />
                    </div>
                    <span className={styles.goalText}>
                      {s.thisYear} de {goal.count} libros leídos este año
                    </span>
                  </>
                ) : (
                  <span className={styles.goalEmpty}>Sin meta definida</span>
                )}
                <button type="button" className={styles.goalEditBtn} onClick={() => { setGoalInput(String(goal?.count || '')); setEditingGoal(true) }}>
                  {goal?.count > 0 ? 'Cambiar meta' : 'Definir meta'}
                </button>
              </div>
            )}
          </section>

          {/* Por año */}
          {s.years.length > 0 && (
            <section className={styles.section} aria-labelledby="stats-por-ano">
              <h3 className={styles.sectionTitle} id="stats-por-ano">Libros por año</h3>
              <div className={styles.chartWrap}>
                {s.years.map(([year, count]) => (
                  <div key={year} className={styles.chartRow}>
                    <span className={styles.chartYear}>{year}</span>
                    <div
                      className={styles.chartBar}
                      role="meter"
                      aria-valuenow={count}
                      aria-valuemax={s.maxInYear}
                      aria-label={`${year}: ${count} libros`}
                    >
                      <div
                        className={styles.chartFill}
                        style={{ width: `${(count / s.maxInYear) * 100}%` }}
                      />
                    </div>
                    <span className={styles.chartCount}>{count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Puntajes */}
          {s.avgScore !== null && (
            <section className={styles.section} aria-labelledby="stats-puntajes">
              <h3 className={styles.sectionTitle} id="stats-puntajes">Puntajes</h3>
              <div className={styles.avgScore}>
                <span className={styles.avgNum}>{s.avgScore.toFixed(1)}</span>
                <Stars value={s.avgScore} />
                <span className={styles.avgLabel}>promedio</span>
              </div>
              {s.bestRated.length > 0 && (
                <div className={styles.topBooks}>
                  {s.bestRated.map(b => (
                    <div key={b.id} className={styles.topBook}>
                      {b.cover && (
                        <CoverImg
                          src={b.cover}
                          alt={`Portada de ${b.title}`}
                          className={styles.topBookCover}
                        />
                      )}
                      <div className={styles.topBookInfo}>
                        <p className={styles.topBookTitle}>{b.title}</p>
                        <Stars value={b.score} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Favoritos */}
          {(s.topAuthors.length > 0 || s.topGenres.length > 0) && (
            <section className={styles.section} aria-labelledby="stats-favoritos">
              <h3 className={styles.sectionTitle} id="stats-favoritos">Favoritos</h3>
              <div className={styles.favGrid}>
                {s.topAuthors.length > 0 && (
                  <div className={styles.favGroup}>
                    <span className={styles.favGroupTitle}>Autores/as</span>
                    {s.topAuthors.map(([name, count]) => (
                      <div key={name} className={styles.favItem}>
                        <span className={styles.favName}>{name}</span>
                        <span className={styles.favCount}>{count} {count === 1 ? 'libro' : 'libros'}</span>
                      </div>
                    ))}
                  </div>
                )}
                {s.topGenres.length > 0 && (
                  <div className={styles.favGroup}>
                    <span className={styles.favGroupTitle}>Géneros</span>
                    {s.topGenres.map(([name, count]) => (
                      <div key={name} className={styles.favItem}>
                        <span className={styles.favName}>{name}</span>
                        <span className={styles.favCount}>{count} {count === 1 ? 'libro' : 'libros'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Récords */}
          {(s.fastest || s.totalPages > 0) && (
            <section className={styles.section} aria-labelledby="stats-records">
              <h3 className={styles.sectionTitle} id="stats-records">Récords</h3>
              <div className={styles.records}>
                {s.fastest && (
                  <div className={styles.record}>
                    <div className={styles.recordIcon}><IconFastest /></div>
                    <div>
                      <p className={styles.recordLabel}>Más rápido</p>
                      <p className={styles.recordValue}>{s.fastest.title}</p>
                      <p className={styles.recordSub}>{formatDays(s.fastest.days)}</p>
                    </div>
                  </div>
                )}
                {s.slowest && s.slowest.id !== s.fastest?.id && (
                  <div className={styles.record}>
                    <div className={styles.recordIcon}><IconSlowest /></div>
                    <div>
                      <p className={styles.recordLabel}>Más lento</p>
                      <p className={styles.recordValue}>{s.slowest.title}</p>
                      <p className={styles.recordSub}>{formatDays(s.slowest.days)}</p>
                    </div>
                  </div>
                )}
                {s.totalPages > 0 && (
                  <div className={styles.record}>
                    <div className={styles.recordIcon}><IconPages /></div>
                    <div>
                      <p className={styles.recordLabel}>Páginas en biblioteca</p>
                      <p className={styles.recordValue}>{s.totalPages.toLocaleString(navigator.language || 'es-AR')}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {books.length === 0 && (
            <div className={styles.empty}>
              <p>Aún no hay libros en tu biblioteca.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
