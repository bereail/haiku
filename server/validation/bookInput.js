// Validación del alta/edición de libros. Antes el backend aceptaba cualquier cosa:
// - cover con cualquier URL: al compartir en Comunidad la tapa se muestra con <img> a TODOS
//   los usuarios, así que una URL propia funcionaba como píxel de rastreo (IP de cada lector);
// - data-URLs de megabytes por libro (el body admite 10 MB);
// - puntajes fuera de 0-5, números negativos, fechas inválidas (terminaban en un 500).
// Los topes de texto coinciden (o son más amplios) que los del formulario.

const TEXT_MAX = { title: 200, author: 150, publisher: 150, genre: 100, notes: 10000, isbn: 20 }

// Tapas permitidas: subida desde el formulario (JPEG reducido a 500px → decenas de KB) o
// Open Library. El tope deja margen sobre lo que produce el formulario.
const COVER_DATA_MAX = 600_000
const COVER_DATA_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/
const COVER_URL_RE = /^https:\/\/covers\.openlibrary\.org\/[A-Za-z0-9\-_./]+$/
const COLOR_RE = /^#[0-9a-fA-F]{6}$/
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const ISBN_RE = /^[0-9Xx\- ]*$/

class BookInputError extends Error {
  constructor(message) {
    super(message)
    this.status = 400
  }
}

const fail = (msg) => { throw new BookInputError(msg) }
const isBlank = (v) => v === undefined || v === null || v === ''

function text(b, field, label, { required = false } = {}) {
  const v = b[field]
  if (isBlank(v) || (typeof v === 'string' && v.trim() === '')) {
    if (required) fail(`${label} es obligatorio`)
    return null
  }
  if (typeof v !== 'string') fail(`${label} tiene un formato inválido`)
  const t = v.trim()
  if (t.length > TEXT_MAX[field]) fail(`${label} no puede superar los ${TEXT_MAX[field]} caracteres`)
  return field === 'notes' ? v : t
}

function int(b, field, label, min, max) {
  const v = b[field]
  // 0 = sin dato (mismo criterio que antes: p. ej. puntaje 0 es "sin puntaje")
  if (isBlank(v) || v === 0 || v === '0') return null
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) fail(`${label} tiene que ser un número entero entre ${min} y ${max}`)
  return n
}

function date(b, field, label) {
  const v = b[field]
  if (isBlank(v)) return null
  // Se aceptan también timestamps ISO (backups exportados con versiones anteriores)
  const m = typeof v === 'string' && v.slice(0, 10).match(DATE_RE)
  if (!m) fail(`${label} no es una fecha válida`)
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) {
    fail(`${label} no es una fecha válida`)
  }
  return v.slice(0, 10)
}

/**
 * Normaliza y valida. Lanza BookInputError (status 400) con un mensaje claro.
 * `existingCover`: en una edición, la tapa que el libro ya tenía se acepta tal cual aunque
 * no cumpla las reglas nuevas, para no impedir editar libros cargados antes.
 */
function validateBookInput(b, { existingCover } = {}) {
  if (!b || typeof b !== 'object') fail('Datos del libro inválidos')

  const cover = isBlank(b.cover) ? null : b.cover
  if (cover !== null && cover !== existingCover) {
    if (typeof cover !== 'string') fail('La tapa tiene un formato inválido')
    if (cover.startsWith('data:')) {
      if (cover.length > COVER_DATA_MAX) fail('La imagen de tapa es demasiado grande')
      if (!COVER_DATA_RE.test(cover)) fail('La tapa tiene que ser una imagen JPEG, PNG o WebP')
    } else if (!COVER_URL_RE.test(cover)) {
      fail('La tapa tiene que ser una imagen subida o de Open Library')
    }
  }

  const isbn = text(b, 'isbn', 'El ISBN')
  if (isbn && !ISBN_RE.test(isbn)) fail('El ISBN solo puede tener números, guiones y X')

  const color = isBlank(b.color) ? null : b.color
  if (color !== null && (typeof color !== 'string' || !COLOR_RE.test(color))) fail('El color tiene un formato inválido')

  const maxYear = new Date().getFullYear() + 5
  const value = {
    title: text(b, 'title', 'El título', { required: true }),
    author: text(b, 'author', 'El autor'),
    publisher: text(b, 'publisher', 'La editorial'),
    genre: text(b, 'genre', 'El género'),
    notes: text(b, 'notes', 'Las anotaciones'),
    isbn,
    cover,
    color,
    score: int(b, 'score', 'El puntaje', 0, 5),
    pages: int(b, 'pages', 'Las páginas', 1, 100000),
    year: int(b, 'year', 'El año', -3000, maxYear),
    totalPages: int(b, 'totalPages', 'El total de páginas', 1, 100000),
    currentPage: int(b, 'currentPage', 'La página actual', 0, 100000),
    startDate: date(b, 'startDate', 'La fecha de inicio'),
    endDate: date(b, 'endDate', 'La fecha de fin'),
    wouldReread: !!b.wouldReread,
    abandoned: !!b.abandoned,
    editionId: isBlank(b.editionId) ? null : b.editionId,
  }
  return value
}

module.exports = { validateBookInput, BookInputError, COVER_DATA_MAX, TEXT_MAX }
