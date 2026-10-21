const { rateLimit, ipKeyGenerator } = require('express-rate-limit')

// Protege contra fuerza bruta y spam en los endpoints de autenticación.
// En memoria del proceso — sin servicio externo ni costo.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
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

module.exports = { authLimiter, catalogLimiter }
