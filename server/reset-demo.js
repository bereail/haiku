require('dotenv').config()
const pool = require('./db')
const { DEMO_EMAIL, seedDemoBooks } = require('./demoData')

async function main() {
  console.log(`\n🔄 Reseteando datos de invitado (${DEMO_EMAIL})...\n`)

  try {
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [DEMO_EMAIL])
    if (!result.rows.length) {
      console.error('El usuario demo no existe todavía (se crea solo al usar "Ver sin cuenta" por primera vez).')
      process.exit(1)
    }
    const userId = result.rows[0].id

    await pool.query('DELETE FROM community_posts WHERE user_id = $1', [userId])
    await pool.query('DELETE FROM books WHERE user_id = $1', [userId])
    console.log('  ✓ Libros y publicaciones del invitado eliminados')

    await seedDemoBooks(userId)
    console.log('  ✓ Libros de muestra restaurados')

    console.log('\n✅ Reset completado.\n')
  } catch (err) {
    console.error('\n❌ Error en reset:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
