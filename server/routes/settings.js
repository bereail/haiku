const router = require('express').Router()
const auth = require('../middleware/authMiddleware')
const blockDemoWrites = require('../middleware/blockDemoWrites')
const pool = require('../db')
const { publicAliasSql } = require('../publicAlias')

router.get('/goal', auth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT goal_count, goal_year FROM user_settings WHERE user_id = $1',
      [req.userId]
    )
    if (r.rows.length === 0) {
      return res.json({ count: 0, year: new Date().getFullYear() })
    }
    const row = r.rows[0]
    res.json({ count: row.goal_count, year: row.goal_year })
  } catch (err) {
    console.error('settings goal get error', err)
    res.status(500).json({ error: 'Error al obtener meta' })
  }
})

router.put('/goal', auth, blockDemoWrites, async (req, res) => {
  const { count, year } = req.body
  const c = Math.max(0, parseInt(count) || 0)
  const y = parseInt(year) || new Date().getFullYear()
  try {
    await pool.query(
      `INSERT INTO user_settings (user_id, goal_count, goal_year)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET goal_count = $2, goal_year = $3, updated_at = NOW()`,
      [req.userId, c, y]
    )
    res.json({ count: c, year: y })
  } catch (err) {
    console.error('settings goal put error', err)
    res.status(500).json({ error: 'Error al guardar meta' })
  }
})

router.get('/profile', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT display_name, ${publicAliasSql()} AS alias
       FROM users WHERE id = $1`,
      [req.userId]
    )
    if (r.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' })
    res.json({ displayName: r.rows[0].display_name, alias: r.rows[0].alias })
  } catch (err) {
    console.error('settings profile get error', err)
    res.status(500).json({ error: 'Error al obtener el perfil' })
  }
})

router.put('/profile', auth, blockDemoWrites, async (req, res) => {
  const trimmed = (req.body.displayName || '').trim()
  if (trimmed.length > 30)
    return res.status(400).json({ error: 'El alias no puede superar los 30 caracteres' })
  const displayName = trimmed || null
  try {
    const r = await pool.query(
      `UPDATE users SET display_name = $1 WHERE id = $2
       RETURNING display_name, ${publicAliasSql()} AS alias`,
      [displayName, req.userId]
    )
    res.json({ displayName: r.rows[0].display_name, alias: r.rows[0].alias })
  } catch (err) {
    console.error('settings profile put error', err)
    res.status(500).json({ error: 'Error al guardar el alias' })
  }
})

module.exports = router
