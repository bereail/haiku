const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const fs = require('fs')
const nodemailer = require('nodemailer')
const pool = require('../db')
const { DEMO_EMAIL, seedDemoBooks } = require('../demoData')
const { isDemoEmail } = require('../demoAccount')
const { authLimiter } = require('../middleware/rateLimiter')

// MAIL_OUTBOX_FILE (solo desarrollo/E2E): en vez de mandar por Gmail, cada mail se agrega
// como una línea JSON a ese archivo, para poder leer el link de reset sin un correo real.
// En producción no se define y el comportamiento es el de siempre.
const MAIL_OUTBOX_FILE = process.env.MAIL_OUTBOX_FILE
const transporter = MAIL_OUTBOX_FILE
  ? {
      sendMail: async (msg) => {
        fs.appendFileSync(MAIL_OUTBOX_FILE, JSON.stringify({ ...msg, sentAt: new Date().toISOString() }) + '\n')
      },
    }
  : nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })

// Base de los links que van en los mails. Configurable para que en local apunten al
// entorno local y no a producción.
const APP_URL = process.env.APP_URL || 'https://ailonline.com.ar/librook/'

// En la base se guarda solo el hash del token de reset: el token en claro viaja únicamente
// en el mail. Si la tabla se filtrara, los links pendientes no servirían.
const hashResetToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex')

function makeJwt(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, isDemo: isDemoEmail(user.email) },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
}

// Loguea con una cuenta demo compartida y funcional, sin exponer ninguna contraseña.
router.post('/demo-login', authLimiter, async (req, res) => {
  try {
    let result = await pool.query('SELECT id, email FROM users WHERE email = $1', [DEMO_EMAIL])
    let user = result.rows[0]

    if (!user) {
      const randomPassword = crypto.randomBytes(24).toString('hex')
      const hash = await bcrypt.hash(randomPassword, 12)
      const inserted = await pool.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
        [DEMO_EMAIL, hash]
      )
      user = inserted.rows[0]
      await seedDemoBooks(user.id)
    }

    res.json({ token: makeJwt(user), email: user.email, isDemo: true })
  } catch (err) {
    console.error('demo-login error', err)
    res.status(500).json({ error: 'Error al ingresar como invitado' })
  }
})

router.post('/register', authLimiter, async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()])
    // El email de la demo está reservado aunque la cuenta todavía no exista.
    if (exists.rows.length > 0 || isDemoEmail(email)) return res.status(400).json({ error: 'Ya existe una cuenta con ese email' })

    const hash = await bcrypt.hash(password, 12)
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email.toLowerCase().trim(), hash]
    )
    const user = result.rows[0]
    res.json({ token: makeJwt(user), email: user.email })
  } catch (err) {
    console.error('register error', err)
    res.status(500).json({ error: 'Error al registrar' })
  }
})

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    )
    const user = result.rows[0]
    if (!user) return res.status(400).json({ error: 'Email o contraseña incorrectos' })

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(400).json({ error: 'Email o contraseña incorrectos' })

    res.json({ token: makeJwt(user), email: user.email, isDemo: isDemoEmail(user.email) })
  } catch (err) {
    console.error('login error', err)
    res.status(500).json({ error: 'Error al iniciar sesión' })
  }
})

// Solicitar reset — envía email con link
router.post('/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'Email requerido' })

  try {
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()])
    // Siempre respondemos ok para no revelar si el email existe. La demo nunca recibe
    // link de reset: quien controle ese buzón tomaría la cuenta compartida.
    if (result.rows.length === 0 || isDemoEmail(email)) return res.json({ ok: true })

    const userId = result.rows[0].id
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, hashResetToken(token), expiresAt]
    )

    const resetUrl = `${APP_URL}?reset_token=${token}`

    // Si el envío falla, la respuesta es la misma que para un email inexistente: un 500 solo
    // para cuentas reales permitía averiguar qué emails están registrados.
    await transporter.sendMail({
      from: `"Librook" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Recuperar contraseña — Librook',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #2d4a3e;">Recuperar contraseña</h2>
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en Librook.</p>
          <p>
            <a href="${resetUrl}"
               style="display:inline-block;padding:12px 24px;background:#2d4a3e;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
              Establecer nueva contraseña
            </a>
          </p>
          <p style="color:#666;font-size:14px;">Este enlace expira en 1 hora. Si no solicitaste esto, ignorá este email.</p>
        </div>
      `,
    }).catch(err => console.error('forgot-password: no se pudo enviar el mail', err))

    res.json({ ok: true })
  } catch (err) {
    console.error('forgot-password error', err)
    res.status(500).json({ error: 'Error al enviar el email' })
  }
})

// Restablecer con token del link
router.post('/reset-password', authLimiter, async (req, res) => {
  const { token, password } = req.body
  if (!token || !password) return res.status(400).json({ error: 'Token y contraseña requeridos' })
  if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })

  try {
    // Verificar y marcar usado en una sola sentencia: dos pedidos simultáneos con el mismo
    // link no pueden usarlo los dos (antes era SELECT y después UPDATE).
    const claimed = await pool.query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE token = $1 AND used = FALSE AND expires_at > NOW() RETURNING user_id',
      [hashResetToken(token)]
    )
    if (claimed.rows.length === 0) return res.status(400).json({ error: 'El enlace es inválido o ya expiró' })

    const { user_id: userId } = claimed.rows[0]
    const hash = await bcrypt.hash(password, 12)

    // password_changed_at invalida las sesiones abiertas antes (ver sessionRevocation.js).
    // La fecha la pone Node (no NOW() de Postgres) para que coincida con el reloj del iat.
    await pool.query('UPDATE users SET password_hash = $1, password_changed_at = $2 WHERE id = $3', [hash, new Date(), userId])
    // Cualquier otro link pendiente del mismo usuario deja de servir
    await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE', [userId])

    res.json({ ok: true })
  } catch (err) {
    console.error('reset-password error', err)
    res.status(500).json({ error: 'Error al restablecer la contraseña' })
  }
})

module.exports = router
