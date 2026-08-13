const pool = require('./db')

const DEMO_EMAIL = 'demo@librook.app'

const DEMO_BOOKS = [
  {
    title: 'Cien años de soledad',
    author: 'Gabriel García Márquez',
    publisher: 'Sudamericana',
    genre: 'Realismo mágico',
    year: 1967,
    score: 5,
    notes: 'Una relectura después de años. La saga familiar sigue abrumando: cada generación repite los mismos nombres, como si el tiempo diera vueltas sobre sí mismo. El final me dejó pensando varios días.',
    start_date: '2026-07-02',
    end_date: '2026-07-28',
  },
  {
    title: '1984',
    author: 'George Orwell',
    publisher: 'Debolsillo',
    genre: 'Distopía',
    year: 1949,
    start_date: '2026-08-05',
    total_pages: 328,
    current_page: 140,
  },
  {
    title: 'El Principito',
    author: 'Antoine de Saint-Exupéry',
    publisher: 'Salamandra',
    genre: 'Fábula',
    year: 1943,
  },
]

async function seedDemoBooks(userId) {
  for (const b of DEMO_BOOKS) {
    await pool.query(
      `INSERT INTO books (user_id, title, author, publisher, genre, year, score, notes, start_date, end_date, total_pages, current_page)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        userId, b.title, b.author, b.publisher, b.genre, b.year,
        b.score || null, b.notes || null, b.start_date || null, b.end_date || null,
        b.total_pages || null, b.current_page || null,
      ]
    )
  }
}

module.exports = { DEMO_EMAIL, DEMO_BOOKS, seedDemoBooks }
