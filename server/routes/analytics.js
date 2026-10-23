const router = require('express').Router()
const jwt = require('jsonwebtoken')
const pool = require('../db')
const { analyticsLimiter } = require('../middleware/rateLimiter')

// Topes de longitud: el body global admite hasta 10 MB (tapas en base64) y esta ruta es
// pública; sin recortar, una sola visita podía guardar megabytes.
const clip = (v, max) => (typeof v === 'string' && v ? v.slice(0, max) : null)

// El email sale del token (si hay sesión válida), nunca del body: antes cualquiera podía
// mandar user_email arbitrario y hacerlo aparecer en "activos" del Panel Admin.
function emailFromToken(req) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return null
  try {
    return jwt.verify(auth.slice(7), process.env.JWT_SECRET).email || null
  } catch {
    return null
  }
}

function parseUA(ua = '') {
  let device = 'Desktop'
  if (/Mobi|Android|iPhone/i.test(ua)) device = 'Móvil'
  else if (/iPad|Tablet/i.test(ua)) device = 'Tablet'

  let browser = 'Otro'
  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/OPR|Opera/i.test(ua)) browser = 'Opera'
  else if (/Chrome/i.test(ua)) browser = 'Chrome'
  else if (/Firefox/i.test(ua)) browser = 'Firefox'
  else if (/Safari/i.test(ua)) browser = 'Safari'

  let os = 'Otro'
  if (/Windows/i.test(ua)) os = 'Windows'
  else if (/iPhone/i.test(ua)) os = 'iOS'
  else if (/iPad/i.test(ua)) os = 'iPadOS'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/Mac OS X/i.test(ua)) os = 'Mac'
  else if (/Linux/i.test(ua)) os = 'Linux'

  return { device, browser, os }
}

router.post('/track', analyticsLimiter, async (req, res) => {
  // req.ip respeta 'trust proxy' (nginx); el x-forwarded-for crudo lo podía inventar el cliente
  const ip = req.ip || null
  const body = req.body ?? {}
  const sessionId = clip(body.session_id, 64)
  const path = clip(body.path, 200)
  const referrer = clip(body.referrer, 500)
  const userEmail = emailFromToken(req)

  res.json({ ok: true })

  if (!sessionId || !path) return

  const { device, browser, os } = parseUA(clip(body.user_agent, 500) || '')
  try {
    await pool.query(
      `INSERT INTO page_views
         (session_id, user_email, path, referrer, device_type, browser, os, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [sessionId, userEmail, path, referrer, device, browser, os, ip]
    )
  } catch (err) {
    console.error('analytics track error', err)
  }
})

module.exports = router
