// Rate limiter simple en memoria, sin dependencias externas.
// Pensado para una app de escala personal en un único proceso Node.
const buckets = new Map()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of buckets) {
    if (now - entry.start > entry.windowMs) buckets.delete(key)
  }
}, 5 * 60 * 1000).unref()

function rateLimit({ windowMs, max, message }) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl}${req.path}`
    const now = Date.now()
    const entry = buckets.get(key)

    if (!entry || now - entry.start > windowMs) {
      buckets.set(key, { start: now, count: 1, windowMs })
      return next()
    }

    entry.count++
    if (entry.count > max) {
      return res.status(429).json({ error: message || 'Demasiados intentos. Probá de nuevo en unos minutos.' })
    }
    next()
  }
}

module.exports = { rateLimit }
