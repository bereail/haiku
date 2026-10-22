const jwt = require('jsonwebtoken')
const { isDemoEmail } = require('../demoAccount')
const { isRevoked } = require('./sessionRevocation')

module.exports = async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' })
  let payload
  try {
    payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }
  try {
    if (await isRevoked(payload.userId, payload.iat)) {
      return res.status(401).json({ error: 'Token inválido o expirado' })
    }
  } catch (err) {
    console.error('auth revocation check error', err)
    return res.status(500).json({ error: 'Error al verificar la sesión' })
  }
  req.userId = payload.userId
  req.userEmail = payload.email
  req.isDemo = !!payload.isDemo || isDemoEmail(payload.email)
  next()
}
