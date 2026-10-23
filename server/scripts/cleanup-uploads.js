#!/usr/bin/env node
// Limpieza de imágenes huérfanas y archivos sueltos (ver images/cleanup.js).
//   node scripts/cleanup-uploads.js            → limpia
//   node scripts/cleanup-uploads.js --dry-run  → solo lista lo que borraría
// Pensado para correr una vez por día (cron) en el servidor; no se instala solo.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const pool = require('../db')
const { cleanupUploads } = require('../images/cleanup')

;(async () => {
  const dryRun = process.argv.includes('--dry-run')
  try {
    const r = await cleanupUploads(pool, { dryRun })
    console.log(`${dryRun ? '[simulación] ' : ''}huérfanas: ${r.orphans.length}, archivos sueltos: ${r.strays.length}`)
    for (const f of [...r.orphans, ...r.strays]) console.log('  ' + f)
  } catch (err) {
    console.error('cleanup-uploads error', err)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
})()
