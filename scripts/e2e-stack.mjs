#!/usr/bin/env node
// Stack local aislado para E2E: backend en :3002 y Vite en :5174 (misma base LOCAL),
// sin tocar el servidor de desarrollo (:5173/:3001) que puede estar usándose.
//
//   node scripts/e2e-stack.mjs                 → levanta el stack y corre toda la suite
//   node scripts/e2e-stack.mjs e2e/theme.spec.ts --repeat-each=3
//                                              → argumentos extra van a `playwright test`
//   node scripts/e2e-stack.mjs --serve         → solo levanta el stack (Ctrl+C para cerrar)
//
// El backend usa server/.env (base local) más variables propias del stack. Nunca apunta a
// producción: la API se sirve en localhost y global-setup aborta si no es local.

import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API_PORT = 3002
const WEB_PORT = 5174
const ORIGIN = `http://localhost:${WEB_PORT}`
const args = process.argv.slice(2)
const serveOnly = args.includes('--serve')
const pwArgs = args.filter(a => a !== '--serve')
const isWin = process.platform === 'win32'

const children = []
function start(name, cmd, cmdArgs, opts) {
  const child = spawn(cmd, cmdArgs, { ...opts, shell: isWin, stdio: ['ignore', 'pipe', 'pipe'] })
  const prefix = `[${name}] `
  child.stdout.on('data', d => process.env.E2E_STACK_VERBOSE && process.stdout.write(prefix + d))
  child.stderr.on('data', d => process.stderr.write(prefix + d))
  children.push(child)
  return child
}

function stopAll() {
  for (const c of children) {
    if (c.exitCode !== null) continue
    // Con shell en Windows hay que matar el árbol entero (cmd → node). Sincrónico:
    // si no, el script terminaba antes y los servidores quedaban corriendo.
    if (isWin) spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' })
    else c.kill('SIGTERM')
  }
}
process.on('SIGINT', () => { stopAll(); process.exit(130) })

async function waitFor(url, label, ms = 60000) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch { /* todavía no levantó */ }
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error(`${label} no respondió en ${ms / 1000}s (${url})`)
}

start('api', 'node', ['index.js'], {
  cwd: path.join(ROOT, 'server'),
  env: {
    ...process.env,
    PORT: String(API_PORT),
    APP_URL: `${ORIGIN}/librook/`,
    // Solo local: la suite completa hace más de 20 logins en 15 minutos
    AUTH_RATE_LIMIT_MAX: '1000',
  },
})
start('web', 'npx', ['vite', '--port', String(WEB_PORT), '--strictPort'], {
  cwd: ROOT,
  env: { ...process.env, VITE_LOCAL_API: '1', LOCAL_API_PORT: String(API_PORT), VITE_CACHE_DIR: 'node_modules/.vite-e2e' },
})

let code = 1
try {
  await waitFor(`http://localhost:${API_PORT}/health`, 'Backend E2E')
  await waitFor(`${ORIGIN}/librook-api/health`, 'Vite E2E (proxy a la API)')
  console.log(`Stack E2E listo en ${ORIGIN} (API :${API_PORT})`)
  if (serveOnly) {
    await new Promise(() => {}) // hasta Ctrl+C
  }
  const pw = spawn('npx', ['playwright', 'test', ...pwArgs], {
    cwd: ROOT, shell: isWin, stdio: 'inherit',
    env: { ...process.env, E2E_ORIGIN: ORIGIN },
  })
  code = await new Promise(r => pw.on('exit', c => r(c ?? 1)))
} catch (err) {
  console.error(err.message)
} finally {
  stopAll()
}
process.exit(code)
