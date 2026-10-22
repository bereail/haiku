const pool = require('../db')

// Un token emitido antes del último cambio de contraseña ya no vale: si alguien robó una
// sesión, resetear la contraseña tiene que echarlo (antes seguía entrando hasta 7 días).
// También invalida tokens de usuarios que ya no existen.
async function isRevoked(userId, iat) {
  const result = await pool.query('SELECT password_changed_at FROM users WHERE id = $1', [userId])
  if (result.rows.length === 0) return true
  const changedAt = result.rows[0].password_changed_at
  if (!changedAt) return false
  // iat está en segundos; un token emitido en el mismo segundo del cambio (el login
  // inmediato con la contraseña nueva) sigue siendo válido.
  return typeof iat !== 'number' || iat < Math.floor(new Date(changedAt).getTime() / 1000)
}

module.exports = { isRevoked }
