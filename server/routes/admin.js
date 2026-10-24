const router = require('express').Router()
const bcrypt = require('bcryptjs')
const auth = require('../middleware/authMiddleware')
const pool = require('../db')

const ADMIN_EMAIL = process.env.ADMIN_EMAIL

function adminOnly(req, res, next) {
  if (req.userEmail !== ADMIN_EMAIL) return res.status(403).json({ error: 'Acceso denegado' })
  next()
}

// ── Users ────────────────────────────────────────────────────────────────────

router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, u.created_at, COUNT(b.id)::int AS book_count
      FROM users u LEFT JOIN books b ON b.user_id = u.id
      GROUP BY u.id ORDER BY u.created_at DESC
    `)
    res.json(result.rows)
  } catch (err) {
    console.error('admin users error', err)
    res.status(500).json({ error: 'Error al obtener usuarios' })
  }
})

router.get('/users/:id/books', auth, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT title, author, start_date, end_date, score, created_at
       FROM books WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    )
    res.json(result.rows)
  } catch (err) {
    console.error('admin books error', err)
    res.status(500).json({ error: 'Error al obtener libros' })
  }
})

// ── Analytics ─────────────────────────────────────────────────────────────────

// Zona horaria del panel: "hoy", las horas y los días se cuentan en la zona de quien mira,
// no en la de la base ni en UTC. El navegador manda su zona IANA y su desfase actual
// (minutos, como getTimezoneOffset). Se usa el nombre solo si Postgres lo conoce: los
// navegadores suelen dar alias viejos (America/Buenos_Aires) que una tzdata sin los
// enlaces "legacy" rechaza; en ese caso, el desfase fijo.
async function analyticsZone(rawTz, rawOffset) {
  if (typeof rawTz === 'string' && rawTz.length <= 64 && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(rawTz)) {
    const { rows } = await pool.query(
      'SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = $1) AS ok', [rawTz])
    if (rows[0]?.ok) return { expr: '$1', param: rawTz }
  }
  const offset = Number(rawOffset)
  if (Number.isInteger(offset) && Math.abs(offset) <= 14 * 60)
    return { expr: '$1::interval', param: `${-offset} minutes` }
  return { expr: '$1', param: 'UTC' }
}

router.get('/analytics', auth, adminOnly, async (req, res) => {
  try {
    const { expr: Z, param: tz } = await analyticsZone(req.query.tz, req.query.offset)
    // Comienzo del día local de hoy, como instante absoluto.
    const TODAY = `(date_trunc('day', NOW() AT TIME ZONE ${Z}) AT TIME ZONE ${Z})`
    const [overview, hourly, daily, pages, browsers, devices, active] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int                                                              AS total,
          COUNT(*) FILTER (WHERE created_at >= ${TODAY})::int                      AS today,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int     AS week,
          COUNT(DISTINCT session_id)::int                                           AS unique_sessions,
          COUNT(DISTINCT session_id) FILTER (WHERE created_at >= ${TODAY})::int     AS unique_today
        FROM page_views
      `, [tz]),
      pool.query(`
        SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE ${Z})::int AS hour, COUNT(*)::int AS count
        FROM page_views
        WHERE created_at >= ${TODAY}
        GROUP BY hour ORDER BY hour
      `, [tz]),
      pool.query(`
        SELECT to_char(created_at AT TIME ZONE ${Z}, 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
        FROM page_views
        WHERE created_at >= ${TODAY} - INTERVAL '6 days'
        GROUP BY 1 ORDER BY 1
      `, [tz]),
      pool.query(`
        SELECT path, COUNT(*)::int AS count
        FROM page_views GROUP BY path ORDER BY count DESC LIMIT 10
      `),
      pool.query(`
        SELECT browser, COUNT(*)::int AS count
        FROM page_views GROUP BY browser ORDER BY count DESC
      `),
      pool.query(`
        SELECT device_type, COUNT(*)::int AS count
        FROM page_views GROUP BY device_type ORDER BY count DESC
      `),
      pool.query(`
        SELECT created_at, ip_address, user_email, path, device_type, browser, session_id
        FROM page_views
        WHERE created_at >= NOW() - INTERVAL '5 minutes'
        ORDER BY created_at DESC LIMIT 30
      `),
    ])

    res.json({
      overview: overview.rows[0],
      hourly:   hourly.rows,
      daily:    daily.rows,
      pages:    pages.rows,
      browsers: browsers.rows,
      devices:  devices.rows,
      active:   active.rows,
    })
  } catch (err) {
    console.error('admin analytics error', err)
    res.status(500).json({ error: 'Error al obtener analíticas' })
  }
})

router.put('/users/:id/password', auth, adminOnly, async (req, res) => {
  const { password } = req.body
  if (!password || password.length < 6)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
  try {
    const hash = await bcrypt.hash(password, 12)
    const result = await pool.query(
      'UPDATE users SET password_hash = $1, password_changed_at = $2 WHERE id = $3 RETURNING id',
      [hash, new Date(), req.params.id]
    )
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json({ ok: true })
  } catch (err) {
    console.error('admin reset password error', err)
    res.status(500).json({ error: 'Error al resetear la contraseña' })
  }
})

module.exports = router
