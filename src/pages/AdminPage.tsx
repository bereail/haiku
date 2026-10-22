import { useState, useEffect } from 'react'
import { api } from '../api'
import styles from './AdminPage.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserRow {
  id: string; email: string; created_at: string; book_count: number
}
interface BookRow {
  title: string; author: string | null; start_date: string | null
  end_date: string | null; score: number | null; created_at: string
}
interface Analytics {
  overview: { total: number; today: number; week: number; unique_sessions: number; unique_today: number }
  hourly:   { hour: number; count: number }[]
  daily:    { date: string; count: number }[]
  pages:    { path: string; count: number }[]
  browsers: { browser: string; count: number }[]
  devices:  { device_type: string; count: number }[]
  active:   { created_at: string; ip_address: string; user_email: string | null; path: string; device_type: string; browser: string; session_id: string }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fillHours(data: { hour: number; count: number }[]) {
  const map = new Map(data.map(d => [d.hour, d.count]))
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, count: map.get(h) ?? 0 }))
}

function fillDays(data: { date: string; count: number }[]) {
  const map = new Map(data.map(d => [d.date, d.count]))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const key = d.toISOString().slice(0, 10)
    return { date: key, count: map.get(key) ?? 0 }
  })
}

function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtDay(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

function pathLabel(p: string) {
  return { login: '/login', biblioteca: '/biblioteca', admin: '/admin' }[p] ?? `/${p}`
}

function bookStatus(b: BookRow) {
  if (b.end_date) return 'Leído'
  if (b.start_date) return 'Leyendo'
  return 'Pendiente'
}

// ── Chart colors ──────────────────────────────────────────────────────────────

const DONUT_COLORS = ['#4a90d9', '#c9a84c', '#4ac9c0', '#e05252', '#9b59b6']

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className={styles.metricCard}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value.toLocaleString('es-AR')}</span>
      {sub && <span className={styles.metricSub}>{sub}</span>}
    </div>
  )
}

function HourlyChart({ data }: { data: { hour: number; count: number }[] }) {
  const [hov, setHov] = useState<number | null>(null)
  const max = Math.max(...data.map(d => d.count), 1)
  const W = 580; const H = 160; const pad = { t: 20, b: 28, l: 36, r: 8 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const barW = innerW / 24 - 2
  const gridLines = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className={styles.chartWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg}>
        {/* Grid lines */}
        {gridLines.map(p => {
          const y = pad.t + innerH * (1 - p)
          return (
            <g key={p}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} className={styles.gridLine} />
              {p > 0 && (
                <text x={pad.l - 4} y={y + 4} className={styles.axisLabel} textAnchor="end">
                  {Math.round(max * p)}
                </text>
              )}
            </g>
          )
        })}
        {/* Bars */}
        {data.map((d, i) => {
          const x = pad.l + (innerW / 24) * i + 1
          const h = d.count === 0 ? 1 : (d.count / max) * innerH
          const y = pad.t + innerH - h
          const isHov = hov === i
          return (
            <g key={d.hour}
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}
            >
              <rect x={x} y={y} width={barW} height={h}
                className={`${styles.bar} ${isHov ? styles.barHov : ''}`}
                rx="2"
              />
              {/* Hour label every 2 hours */}
              {d.hour % 2 === 0 && (
                <text x={x + barW / 2} y={H - 4} className={styles.axisLabel} textAnchor="middle">
                  {d.hour}h
                </text>
              )}
              {/* Tooltip */}
              {isHov && d.count > 0 && (
                <g>
                  <rect x={x - 10} y={y - 26} width={barW + 20} height={20} rx="4"
                    className={styles.tooltipBg} />
                  <text x={x + barW / 2} y={y - 12} className={styles.tooltipText} textAnchor="middle">
                    {d.count}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function DailyChart({ data }: { data: { date: string; count: number }[] }) {
  const [hov, setHov] = useState<number | null>(null)
  const max = Math.max(...data.map(d => d.count), 1)
  const W = 580; const H = 160; const pad = { t: 20, b: 28, l: 36, r: 8 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const pts = data.map((d, i) => ({
    x: pad.l + (innerW / (data.length - 1)) * i,
    y: pad.t + innerH - (d.count / max) * innerH,
    ...d,
  }))
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')
  const area = [
    `${pts[0].x},${pad.t + innerH}`,
    ...pts.map(p => `${p.x},${p.y}`),
    `${pts[pts.length - 1].x},${pad.t + innerH}`,
  ].join(' ')

  return (
    <div className={styles.chartWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-line)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--chart-line)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid */}
        {[0, 0.5, 1].map(p => {
          const y = pad.t + innerH * (1 - p)
          return (
            <g key={p}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} className={styles.gridLine} />
              {p > 0 && (
                <text x={pad.l - 4} y={y + 4} className={styles.axisLabel} textAnchor="end">
                  {Math.round(max * p)}
                </text>
              )}
            </g>
          )
        })}
        {/* Area fill */}
        <polygon points={area} className={styles.chartArea} />
        {/* Line */}
        <polyline points={polyline} className={styles.chartLine} />
        {/* Points + labels */}
        {pts.map((p, i) => (
          <g key={p.date}
            onMouseEnter={() => setHov(i)}
            onMouseLeave={() => setHov(null)}
          >
            <circle cx={p.x} cy={p.y} r={5} className={styles.chartDot} />
            <text x={p.x} y={H - 4} className={styles.axisLabel} textAnchor="middle">
              {fmtDay(p.date)}
            </text>
            {hov === i && (
              <g>
                <rect x={p.x - 18} y={p.y - 28} width={36} height={20} rx="4"
                  className={styles.tooltipBg} />
                <text x={p.x} y={p.y - 14} className={styles.tooltipText} textAnchor="middle">
                  {p.count}
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

function DonutChart({ data, colors }: { data: { label: string; count: number }[]; colors: string[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  const r = 42; const cx = 60; const cy = 60
  const C = 2 * Math.PI * r
  let cum = 0
  const segs = data.map((d, i) => {
    const dash = total > 0 ? (d.count / total) * C : 0
    const seg = { ...d, dash, offset: C / 4 - cum, color: colors[i % colors.length] }
    cum += dash
    return seg
  })

  return (
    <div className={styles.donutWrap}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth="18" className={styles.donutTrack} />
        {segs.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            strokeWidth="18"
            stroke={s.color}
            strokeDasharray={`${s.dash} ${C - s.dash}`}
            strokeDashoffset={s.offset}
          />
        ))}
      </svg>
      <div className={styles.donutLegend}>
        {segs.map((s, i) => (
          <div key={i} className={styles.legendRow}>
            <span className={styles.legendDot} style={{ background: s.color }} />
            <span className={styles.legendLabel}>{s.label}</span>
            <span className={styles.legendPct}>
              {total > 0 ? Math.round((s.count / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HorizBars({ data }: { data: { label: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <div className={styles.horizBars}>
      {data.length === 0
        ? <p className={styles.msgSm}>Sin datos</p>
        : data.map(d => {
            const pct = total > 0 ? Math.round((d.count / total) * 100) : 0
            return (
              <div key={d.label} className={styles.horizRow}>
                <span className={styles.horizLabel}>{pathLabel(d.label)}</span>
                <div className={styles.horizTrack}>
                  <div className={styles.horizFill} style={{ width: `${pct}%` }} />
                </div>
                <span className={styles.horizCount}>{d.count}</span>
              </div>
            )
          })}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminPage({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'analytics' | 'users'>('analytics')

  const [data, setData] = useState<Analytics | null>(null)
  const [aErr, setAErr] = useState('')
  const [aLoad, setALoad] = useState(true)

  const [users, setUsers] = useState<UserRow[]>([])
  const [books, setBooks] = useState<Record<string, BookRow[]>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [uErr, setUErr] = useState('')
  const [uLoad, setULoad] = useState(true)

  const [resetTarget, setResetTarget] = useState<UserRow | null>(null)
  const [resetPwd, setResetPwd] = useState('')
  const [resetErr, setResetErr] = useState('')
  const [resetLoad, setResetLoad] = useState(false)
  const [resetOk, setResetOk] = useState(false)

  useEffect(() => {
    api.get('/admin/analytics')
      .then(setData)
      .catch((e: Error) => setAErr(e.message))
      .finally(() => setALoad(false))
  }, [])

  useEffect(() => {
    api.get('/admin/users')
      .then(setUsers)
      .catch((e: Error) => setUErr(e.message))
      .finally(() => setULoad(false))
  }, [])

  const toggleUser = async (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!books[id]) {
      try {
        const d = await api.get(`/admin/users/${id}/books`)
        setBooks(prev => ({ ...prev, [id]: d }))
      } catch { /* ignore */ }
    }
  }

  const openReset = (u: UserRow) => {
    setResetTarget(u); setResetPwd(''); setResetErr(''); setResetOk(false)
  }

  const closeReset = () => setResetTarget(null)

  const submitReset = async () => {
    if (resetPwd.length < 6) { setResetErr('Mínimo 6 caracteres'); return }
    setResetLoad(true); setResetErr('')
    try {
      await api.put(`/admin/users/${resetTarget!.id}/password`, { password: resetPwd })
      setResetOk(true); setResetPwd('')
    } catch (e: unknown) {
      setResetErr(e instanceof Error ? e.message : 'Error al resetear')
    } finally {
      setResetLoad(false)
    }
  }

  const hourly = data ? fillHours(data.hourly) : []
  const daily  = data ? fillDays(data.daily) : []
  const browsers = data?.browsers.map(d => ({ label: d.browser, count: d.count })) ?? []
  const devices  = data?.devices.map(d => ({ label: d.device_type, count: d.count })) ?? []

  return (
    <div className={styles.page}>

      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Volver
        </button>
        <h1 className={styles.title}>Panel Admin</h1>
        <nav className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'analytics' ? styles.tabOn : ''}`}
            onClick={() => setTab('analytics')}>
            Analíticas
          </button>
          <button className={`${styles.tab} ${tab === 'users' ? styles.tabOn : ''}`}
            onClick={() => setTab('users')}>
            Usuarios {!uLoad && <span className={styles.tabBadge}>{users.length}</span>}
          </button>
        </nav>
      </header>

      {/* ── ANALYTICS ───────────────────────────────────────────────────────── */}
      {tab === 'analytics' && (
        <main className={styles.main}>
          {aLoad && <p className={styles.msg} role="status" aria-live="polite">Cargando analíticas…</p>}
          {aErr  && <p className={styles.err} role="alert">{aErr}</p>}

          {data && (<>

            {/* Metric cards */}
            <div className={styles.metricGrid}>
              <MetricCard label="Visitas hoy"     value={data.overview.today}
                sub={`${data.overview.unique_today} sesiones únicas`} />
              <MetricCard label="Esta semana"      value={data.overview.week} />
              <MetricCard label="Total"            value={data.overview.total} />
              <MetricCard label="Sesiones únicas"  value={data.overview.unique_sessions} />
            </div>

            {/* Charts row: hourly + daily */}
            <div className={styles.chartRow}>
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Visitas por hora — hoy</h2>
                <HourlyChart data={hourly} />
              </section>
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Últimos 7 días</h2>
                <DailyChart data={daily} />
              </section>
            </div>

            {/* Pages + Browsers + Devices */}
            <div className={styles.triRow}>
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Páginas más visitadas</h2>
                <HorizBars data={data.pages.map(p => ({ label: p.path, count: p.count }))} />
              </section>
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Navegadores</h2>
                <DonutChart data={browsers} colors={DONUT_COLORS} />
              </section>
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Dispositivos</h2>
                <DonutChart data={devices} colors={['#4a90d9', '#c9a84c', '#4ac9c0']} />
              </section>
            </div>

            {/* Active now */}
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>
                <span className={styles.activeDot} />
                Activos en los últimos 5 minutos
              </h2>
              {data.active.length === 0
                ? <p className={styles.msgSm}>Sin actividad reciente</p>
                : (
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Hora</th>
                        <th>IP</th>
                        <th>Usuario</th>
                        <th>Página</th>
                        <th>Dispositivo</th>
                        <th>Navegador</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.active.map((r, i) => (
                        <tr key={i}>
                          <td className={styles.mono}>{fmtTime(r.created_at)}</td>
                          <td className={styles.mono}>{r.ip_address || '—'}</td>
                          <td>
                            {r.user_email
                              ? <span className={styles.userChip}>{r.user_email.split('@')[0]}</span>
                              : <span className={styles.anonChip}>anónimo</span>}
                          </td>
                          <td className={styles.mono}>{pathLabel(r.path)}</td>
                          <td>{r.device_type}</td>
                          <td>{r.browser}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

          </>)}
        </main>
      )}

      {/* ── USERS ───────────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <main className={styles.main}>
          {uLoad && <p className={styles.msg} role="status" aria-live="polite">Cargando…</p>}
          {uErr  && <p className={styles.err} role="alert">{uErr}</p>}
          {!uLoad && !uErr && users.length === 0 && (
            <p className={styles.msg}>No hay usuarios registrados.</p>
          )}
          {users.map(u => (
            <div key={u.id} className={styles.userCard}>
              <div className={styles.userCardHeader}>
                <button
                  className={styles.userToggle}
                  onClick={() => toggleUser(u.id)}
                  aria-expanded={expanded === u.id}
                >
                  <div className={styles.userInfo}>
                    <span className={styles.userEmail}>{u.email}</span>
                    <span className={styles.userMeta}>
                      Registrado el {new Date(u.created_at).toLocaleDateString('es-AR',
                        { year: 'numeric', month: 'short', day: 'numeric' })}
                      {' · '}{u.book_count} {u.book_count === 1 ? 'libro' : 'libros'}
                    </span>
                  </div>
                  <svg className={`${styles.chevron} ${expanded === u.id ? styles.chevronOpen : ''}`}
                    width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button className={styles.resetBtn} onClick={() => openReset(u)} title="Resetear contraseña">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Resetear contraseña
                </button>
              </div>
              {expanded === u.id && (
                <div className={styles.bookList}>
                  {!books[u.id]
                    ? <p className={styles.msgSm}>Cargando libros…</p>
                    : books[u.id].length === 0
                      ? <p className={styles.msgSm}>Sin libros cargados.</p>
                      : (
                        <table className={styles.table}>
                          <thead>
                            <tr><th>Título</th><th>Autor/a</th><th>Estado</th><th>Puntaje</th></tr>
                          </thead>
                          <tbody>
                            {books[u.id].map((b, i) => (
                              <tr key={i}>
                                <td>{b.title}</td>
                                <td>{b.author || '—'}</td>
                                <td>{bookStatus(b)}</td>
                                <td>{b.score != null ? `${b.score}/10` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                </div>
              )}
            </div>
          ))}
        </main>
      )}

      {/* ── MODAL RESET CONTRASEÑA ──────────────────────────────────────────── */}
      {resetTarget && (
        <div className={styles.modalOverlay} onClick={closeReset}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div>
              <p className={styles.modalTitle}>Resetear contraseña</p>
              <p className={styles.modalSub}>{resetTarget.email}</p>
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel} htmlFor="reset-pwd">Nueva contraseña</label>
              <input
                id="reset-pwd"
                type="password"
                className={styles.modalInput}
                value={resetPwd}
                onChange={e => setResetPwd(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !resetLoad && submitReset()}
                placeholder="Mínimo 6 caracteres"
                autoFocus
                disabled={resetLoad || resetOk}
              />
            </div>
            {resetErr && <p className={styles.err} style={{ padding: 0 }} role="alert">{resetErr}</p>}
            {resetOk  && <p className={styles.modalOk} role="status">✓ Contraseña actualizada</p>}
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={closeReset}>Cerrar</button>
              {!resetOk && (
                <button
                  className={styles.modalSave}
                  onClick={submitReset}
                  disabled={resetLoad || resetPwd.length < 6}
                >
                  {resetLoad ? 'Guardando…' : 'Guardar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
