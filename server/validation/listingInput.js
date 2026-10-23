// Validación de publicaciones del marketplace (venta / intercambio). Separadas de las
// reseñas literarias de Comunidad: otra tabla, otra ruta, otros campos.

const KINDS = ['venta', 'intercambio']
const CONDITIONS = ['nuevo', 'muy_bueno', 'bueno', 'aceptable']
const STATUSES = ['activa', 'pausada', 'cerrada']
const MAX = { bookTitle: 200, bookAuthor: 150, description: 2000, city: 80, contact: 200 }
const MAX_PHOTOS = 4
const MAX_PRICE = 100_000_000 // en pesos
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

class ListingInputError extends Error {
  constructor(message) {
    super(message)
    this.status = 400
  }
}
const fail = (m) => { throw new ListingInputError(m) }
const blank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')

function text(b, field, label, required = false) {
  if (blank(b[field])) {
    if (required) fail(`${label} es obligatorio`)
    return null
  }
  if (typeof b[field] !== 'string') fail(`${label} tiene un formato inválido`)
  const t = b[field].trim()
  if (t.length > MAX[field]) fail(`${label} no puede superar los ${MAX[field]} caracteres`)
  return t
}

/**
 * Normaliza y valida. `price` llega en pesos (puede tener centavos) y se guarda en
 * centavos. Lanza ListingInputError (400) con un mensaje claro.
 */
function validateListingInput(b, { requireStatus = false } = {}) {
  if (!b || typeof b !== 'object') fail('Datos de la publicación inválidos')

  if (!KINDS.includes(b.kind)) fail('Elegí si es una venta o un intercambio')
  if (!CONDITIONS.includes(b.condition)) fail('Elegí el estado del libro')

  let priceCents = null
  if (b.kind === 'venta') {
    if (blank(b.price)) fail('Una venta necesita un precio')
    const n = Number(b.price)
    if (!Number.isFinite(n) || n < 0 || n > MAX_PRICE) fail(`El precio tiene que ser un número entre 0 y ${MAX_PRICE.toLocaleString('es-AR')}`)
    priceCents = Math.round(n * 100)
  } else if (!blank(b.price)) {
    fail('Un intercambio no lleva precio')
  }

  let status = null
  if (requireStatus || !blank(b.status)) {
    if (!STATUSES.includes(b.status)) fail('Estado de publicación inválido')
    status = b.status
  }

  const photoIds = b.photoIds === undefined ? [] : b.photoIds
  if (!Array.isArray(photoIds)) fail('Las fotos tienen un formato inválido')
  if (photoIds.length > MAX_PHOTOS) fail(`Una publicación puede tener hasta ${MAX_PHOTOS} fotos`)
  if (photoIds.some(id => typeof id !== 'string' || !UUID_RE.test(id))) fail('Las fotos tienen un formato inválido')
  if (new Set(photoIds).size !== photoIds.length) fail('Hay fotos repetidas')

  return {
    kind: b.kind,
    condition: b.condition,
    bookTitle: text(b, 'bookTitle', 'El título del libro', true),
    bookAuthor: text(b, 'bookAuthor', 'El autor'),
    description: text(b, 'description', 'La descripción'),
    city: text(b, 'city', 'La ciudad'),
    contact: text(b, 'contact', 'El contacto'),
    priceCents,
    status,
    photoIds,
  }
}

module.exports = { validateListingInput, ListingInputError, KINDS, CONDITIONS, STATUSES, MAX_PHOTOS }
