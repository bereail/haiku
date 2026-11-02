// Crea (o actualiza la contraseña de) la cuenta admin y una cuenta de prueba, para poder
// chequear el sitio recién desplegado sin usar una cuenta real. Idempotente: correrlo de
// nuevo no duplica nada, solo re-hashea la contraseña si ya existían.
//
// Uso: node scripts/seed-cuentas.js   (desde server/, con .env ya configurado)
require('dotenv').config()
const bcrypt = require('bcryptjs')
const pool = require('../db')
const { seedDemoBooks } = require('../demoData')

const ADMIN_EMAIL = 'bereail'
const ADMIN_PASSWORD = 'newton508'
const PRUEBA_EMAIL = 'prueba@haiku.app'
const PRUEBA_PASSWORD = 'prueba1234'

async function upsertUser(email, password) {
  const hash = await bcrypt.hash(password, 12)
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email])
  if (existing.rows.length > 0) {
    const id = existing.rows[0].id
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id])
    return { id, created: false }
  }
  const inserted = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
    [email, hash]
  )
  return { id: inserted.rows[0].id, created: true }
}

async function main() {
  const admin = await upsertUser(ADMIN_EMAIL, ADMIN_PASSWORD)
  console.log(`✓ Admin "${ADMIN_EMAIL}" ${admin.created ? 'creado' : 'ya existía (contraseña actualizada)'}`)

  const prueba = await upsertUser(PRUEBA_EMAIL, PRUEBA_PASSWORD)
  if (prueba.created) {
    await seedDemoBooks(prueba.id)
    console.log(`✓ Usuario de prueba "${PRUEBA_EMAIL}" creado con libros de muestra`)
  } else {
    console.log(`✓ Usuario de prueba "${PRUEBA_EMAIL}" ya existía (contraseña actualizada, libros intactos)`)
  }

  console.log('\nRecordá que ADMIN_EMAIL en el .env del servidor tiene que ser exactamente:')
  console.log(`  ADMIN_EMAIL=${ADMIN_EMAIL}`)
  console.log('para que esta cuenta tenga acceso al Panel admin.')
}

main()
  .catch(err => { console.error('Error en seed-cuentas:', err.message); process.exitCode = 1 })
  .finally(() => pool.end())
