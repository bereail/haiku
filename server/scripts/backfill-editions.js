// Vincula libros existentes (books.isbn) con el catálogo compartido (obras/ediciones)
// usando Open Library como fuente de verdad. Script de línea de comandos, NO un endpoint HTTP.
//
// Uso:
//   node server/scripts/backfill-editions.js --dry-run [--limit=20]   (solo reporta, no escribe)
//   node server/scripts/backfill-editions.js [--limit=20]             (escribe de verdad)
//
// Reglas de seguridad:
// - Solo toca `books.edition_id` (un campo nuevo y nullable). Nunca modifica notas, fechas,
//   puntaje ni ningún otro dato personal del usuario.
// - Nunca fusiona por similitud de texto. Si Open Library no da un identificador de obra
//   confiable para una edición, el libro se deja sin vincular (edition_id sigue NULL) en vez
//   de adivinar.
// - Es repetible: antes de crear una obra/autor/edición, busca si ya existe por su identificador
//   de Open Library o por ISBN. Correrlo dos veces no duplica nada.
// - Se autolimita (DELAY_MS entre pedidos) para ser respetuoso con la API gratuita de Open Library.

require('dotenv').config()
const pool = require('../db')

const DELAY_MS = 1100
const DRY_RUN = process.argv.includes('--dry-run')
const limitArg = process.argv.find(a => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const normalizeIsbn = (raw) => (raw || '').replace(/[-\s]/g, '')

async function fetchJson(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Un dry-run no debe escribir NADA, ni siquiera obras/autores/ediciones "de paso" — cuando
// DRY_RUN está activo estas funciones devuelven un id simulado en vez de insertar.
async function resolveAuthor(authorKey) {
  const existing = await pool.query('SELECT id FROM autores WHERE ol_author_key = $1', [authorKey])
  if (existing.rows.length) return existing.rows[0].id
  if (DRY_RUN) return `(nuevo autor simulado: ${authorKey})`

  const data = await fetchJson(`https://openlibrary.org${authorKey}.json`)
  await sleep(DELAY_MS)
  const name = data?.name || authorKey

  const inserted = await pool.query(
    `INSERT INTO autores (name, ol_author_key) VALUES ($1, $2)
     ON CONFLICT (ol_author_key) WHERE ol_author_key IS NOT NULL
     DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name, authorKey]
  )
  return inserted.rows[0].id
}

async function resolveWork(workKey) {
  const existing = await pool.query('SELECT id FROM obras WHERE ol_work_key = $1', [workKey])
  if (existing.rows.length) return existing.rows[0].id
  if (DRY_RUN) return `(nueva obra simulada: ${workKey})`

  const data = await fetchJson(`https://openlibrary.org${workKey}.json`)
  await sleep(DELAY_MS)
  const title = data?.title || workKey
  const subjects = Array.isArray(data?.subjects) ? data.subjects.slice(0, 10) : null

  const inserted = await pool.query(
    `INSERT INTO obras (canonical_title, subjects, ol_work_key, source)
     VALUES ($1, $2, $3, 'openlibrary')
     ON CONFLICT (ol_work_key) WHERE ol_work_key IS NOT NULL
     DO UPDATE SET canonical_title = EXCLUDED.canonical_title
     RETURNING id`,
    [title, subjects, workKey]
  )
  const obraId = inserted.rows[0].id

  const authorKeys = (data?.authors || [])
    .map((a) => a.author?.key || a.key)
    .filter(Boolean)
  for (const authorKey of authorKeys) {
    const autorId = await resolveAuthor(authorKey)
    await pool.query(
      'INSERT INTO obra_autores (obra_id, autor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [obraId, autorId]
    )
  }

  return obraId
}

const RESULT = {
  YA_VINCULADO: 'ya_vinculado',
  SIN_ISBN: 'sin_isbn',
  ISBN_NO_ENCONTRADO: 'isbn_no_encontrado',
  INCOMPLETO_SIN_OBRA: 'incompleto_sin_obra',
  COINCIDENCIA_SEGURA: 'coincidencia_segura',
  ERROR: 'error',
}

async function resolveEditionForBook(book) {
  const isbn = normalizeIsbn(book.isbn)
  if (!isbn) return { status: RESULT.SIN_ISBN }

  const byIsbn = await pool.query(
    'SELECT id FROM ediciones WHERE isbn_13 = $1 OR isbn_10 = $1',
    [isbn]
  )
  if (byIsbn.rows.length) return { status: RESULT.COINCIDENCIA_SEGURA, editionId: byIsbn.rows[0].id, cached: true }

  const data = await fetchJson(`https://openlibrary.org/isbn/${isbn}.json`)
  await sleep(DELAY_MS)
  if (!data) return { status: RESULT.ISBN_NO_ENCONTRADO }

  const workKey = data.works?.[0]?.key
  if (!workKey) {
    // Open Library tiene la edición pero no la liga a ninguna obra: no hay forma confiable
    // de ubicarla sin adivinar. Se deja sin vincular a propósito.
    return { status: RESULT.INCOMPLETO_SIN_OBRA }
  }

  const obraId = await resolveWork(workKey)
  const isbn13 = data.isbn_13?.[0] || (isbn.length === 13 ? isbn : null)
  const isbn10 = data.isbn_10?.[0] || (isbn.length === 10 ? isbn : null)

  if (DRY_RUN) {
    return { status: RESULT.COINCIDENCIA_SEGURA, editionId: `(nueva edición simulada: ${data.key})`, obraId }
  }

  const inserted = await pool.query(
    `INSERT INTO ediciones
       (obra_id, title, isbn_13, isbn_10, publisher, publish_year, language, pages, ol_edition_key, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'openlibrary')
     ON CONFLICT (ol_edition_key) WHERE ol_edition_key IS NOT NULL
     DO UPDATE SET title = EXCLUDED.title
     RETURNING id`,
    [
      obraId,
      data.title || null,
      isbn13,
      isbn10,
      data.publishers?.[0] || null,
      data.publish_date ? parseInt(String(data.publish_date).match(/\d{4}/)?.[0]) || null : null,
      data.languages?.[0]?.key?.replace('/languages/', '') || null,
      data.number_of_pages || null,
      data.key || null,
    ]
  )

  return { status: RESULT.COINCIDENCIA_SEGURA, editionId: inserted.rows[0].id }
}

async function main() {
  const counts = {}
  const incompleteSamples = []
  const errorSamples = []

  const booksResult = await pool.query(
    `SELECT id, title, isbn FROM books
     WHERE isbn IS NOT NULL AND TRIM(isbn) <> '' AND edition_id IS NULL
     ORDER BY created_at
     ${LIMIT ? 'LIMIT $1' : ''}`,
    LIMIT ? [LIMIT] : []
  )

  console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Procesando ${booksResult.rows.length} libro(s) con ISBN sin vincular...\n`)

  for (const book of booksResult.rows) {
    let result
    try {
      result = await resolveEditionForBook(book)
    } catch (err) {
      result = { status: RESULT.ERROR }
      errorSamples.push({ book: book.title, error: err.message })
    }

    counts[result.status] = (counts[result.status] || 0) + 1

    if (result.status === RESULT.INCOMPLETO_SIN_OBRA || result.status === RESULT.ISBN_NO_ENCONTRADO) {
      incompleteSamples.push({ title: book.title, isbn: book.isbn, status: result.status })
    }

    if (result.status === RESULT.COINCIDENCIA_SEGURA && !DRY_RUN) {
      await pool.query('UPDATE books SET edition_id = $1 WHERE id = $2', [result.editionId, book.id])
    }

    console.log(`  ${result.status.padEnd(20)} ${book.title} (${book.isbn})`)
  }

  console.log('\n── Resumen ──────────────────────────────')
  for (const [status, count] of Object.entries(counts)) {
    console.log(`  ${status.padEnd(20)} ${count}`)
  }
  if (incompleteSamples.length) {
    console.log('\n── Casos que necesitan revisión manual ──')
    incompleteSamples.forEach((s) => console.log(`  - "${s.title}" (ISBN ${s.isbn}) → ${s.status}`))
  }
  if (errorSamples.length) {
    console.log('\n── Errores ──')
    errorSamples.forEach((s) => console.log(`  - "${s.book}": ${s.error}`))
  }
  console.log(`\n${DRY_RUN ? 'Nada se escribió en la base (--dry-run).' : 'edition_id actualizado para los casos de coincidencia segura.'}\n`)

  await pool.end()
}

main().catch((err) => {
  console.error('Error fatal en el backfill:', err)
  process.exit(1)
})
