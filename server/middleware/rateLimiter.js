const { rateLimit, ipKeyGenerator } = require('express-rate-limit')

const DEFAULT_AUTH_LIMIT = 20

// AUTH_RATE_LIMIT_MAX es SOLO para desarrollo/E2E local (la suite completa hace más
// de 20 logins en 15 minutos). En producción no se define, y aunque se definiera, con
// NODE_ENV=production se ignora: el cupo real queda siempre en 20.
function authLimit() {
  const override = parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10)
  if (process.env.NODE_ENV === 'production' || !(override > 0)) return DEFAULT_AUTH_LIMIT
  return override
}

// Protege contra fuerza bruta y spam en los endpoints de autenticación.
// En memoria del proceso — sin servicio externo ni costo.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: authLimit(),
  standardHeaders: true,
  legacyHeaders: false,
  // Cada endpoint tiene su propio cupo: muchos intentos de "olvidé mi contraseña"
  // no deben bloquear también el login desde la misma IP. Usa ipKeyGenerator en vez de
  // req.ip crudo para normalizar IPv6 correctamente (si no, distintas representaciones
  // de la misma IPv6 — o del mismo /64 — podrían esquivar el límite).
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${req.path}`,
  message: { error: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
})

// Rutas públicas del catálogo: sin auth, más tráfico esperado (autocompletado), pero
// igual necesitan un techo — son las más expuestas a scraping/abuso al no requerir cuenta.
const catalogLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Probá de nuevo en un minuto.' },
})

// /analytics/track es público y escribe en la base en cada llamada: sin techo, cualquiera
// podía insertar filas sin límite (y llenar el disco).
const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes.' },
})

module.exports = { authLimiter, catalogLimiter, analyticsLimiter, authLimit, DEFAULT_AUTH_LIMIT }
