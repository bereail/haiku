const fs = require('fs')
const path = require('path')
const storage = require('./storage')

// Limpieza de imágenes:
// 1) huérfanas: subidas que nunca se asociaron a una publicación (o cuya publicación se
//    borró) y tienen más de `orphanHours` → se borra el registro y el archivo;
// 2) sueltas: archivos en UPLOADS_DIR con nombre generado por nosotros que ya no están en la
//    base (p. ej. una cuenta borrada en cascada) y tienen más de `strayMinutes` (para no
//    tocar una subida en curso) → se borra el archivo.
// Nunca toca archivos con otro nombre (no son nuestros).
async function cleanupUploads(pool, { orphanHours = 24, strayMinutes = 60, dryRun = false, now = Date.now() } = {}) {
  const report = { orphans: [], strays: [], dryRun }

  const orphanSql = dryRun
    ? `SELECT filename FROM uploads WHERE listing_id IS NULL AND created_at < NOW() - make_interval(hours => $1)`
    : `DELETE FROM uploads WHERE listing_id IS NULL AND created_at < NOW() - make_interval(hours => $1) RETURNING filename`
  const orphans = await pool.query(orphanSql, [orphanHours])
  for (const { filename } of orphans.rows) {
    report.orphans.push(filename)
    if (!dryRun) storage.remove(filename)
  }

  const dir = storage.uploadsDir()
  if (fs.existsSync(dir)) {
    const known = new Set((await pool.query('SELECT filename FROM uploads')).rows.map(r => r.filename))
    for (const name of fs.readdirSync(dir)) {
      if (!storage.isValidName(name) || known.has(name) || report.orphans.includes(name)) continue
      const ageMs = now - fs.statSync(path.join(dir, name)).mtimeMs
      if (ageMs < strayMinutes * 60 * 1000) continue
      report.strays.push(name)
      if (!dryRun) storage.remove(name)
    }
  }
  return report
}

module.exports = { cleanupUploads }
