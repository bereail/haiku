const { Pool, types } = require('pg')
require('dotenv').config()

// Las columnas DATE (fechas de lectura, agrupaciones por día) se devuelven tal cual,
// como 'YYYY-MM-DD'. Por defecto pg las convertía a un Date de JS a medianoche en la
// zona horaria del servidor, que al serializarse salía como timestamp
// ('2026-09-01T03:00:00.000Z'): un <input type="date"> no lo acepta (las fechas
// aparecían vacías al editar), las claves por día no coincidían (gráfico de 7 días del
// Admin siempre en cero) y en un servidor al este de UTC la fecha se corría un día.
const DATE_OID = 1082
types.setTypeParser(DATE_OID, value => value)

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

module.exports = pool
