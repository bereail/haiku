#!/usr/bin/env node
// Chequeo previo de deploy.sh (corre en la máquina local, antes de tocar el VPS):
// deploy.sh copia los archivos del backend uno por uno, así que un archivo nuevo que no se
// agregue a la lista deja la API rota en producción (MODULE_NOT_FOUND). Esto compara todos
// los .js de server/ (sin tests ni node_modules) con los que deploy.sh copia.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SERVER = path.join(ROOT, 'server')
const SKIP_DIRS = new Set(['node_modules', 'tests'])

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : walk(path.join(dir, e.name))
    return e.name.endsWith('.js') ? [path.join(dir, e.name)] : []
  })
}

const deploy = fs.readFileSync(path.join(ROOT, 'deploy.sh'), 'utf8')
const files = walk(SERVER).map(f => 'server/' + path.relative(SERVER, f).split(path.sep).join('/'))
const missing = files.filter(f => !new RegExp(`\\$SCP\\s+${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s`).test(deploy))

if (missing.length) {
  console.error('deploy.sh no copia estos archivos del backend (la API fallaría en el VPS):')
  for (const f of missing) console.error('  - ' + f)
  process.exit(1)
}
console.log(`check-deploy-files: OK (${files.length} archivos del backend incluidos en deploy.sh)`)
