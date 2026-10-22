// Identidad de la cuenta invitado (demo-login). Separado de demoData.js para que el
// middleware de auth pueda usarlo sin depender de la base.
const DEMO_EMAIL = 'demo@librook.app'

// La demo es de solo lectura por QUIÉN es, no por cómo se entró: si alguien llegara a
// conocer su contraseña (reset, filtración) y entrara por /auth/login, igual tiene que
// quedar bloqueada.
function isDemoEmail(email) {
  return typeof email === 'string' && email.toLowerCase().trim() === DEMO_EMAIL
}

module.exports = { DEMO_EMAIL, isDemoEmail }
