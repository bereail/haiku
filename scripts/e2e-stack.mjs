#!/usr/bin/env node
// Stack local aislado para E2E: backend en :3002 y Vite en :5174 (misma base LOCAL),
// sin tocar el servidor de desarrollo (:5173/:3001) que puede estar usándose.
//
//   node scripts/e2e-stack.mjs                 → levanta el stack y corre toda la suite
//   node scripts/e2e-stack.mjs e2e/theme.spec.ts --repeat-each=3
//                                              → argumentos extra van a `playwright test`
//   node scripts/e2e-stack.mjs --serve         → solo levanta el stack (Ctrl+C para cerrar)
//   node scripts/e2e-stack.mjs --dev           → Vite en modo desarrollo en vez del build
//
// Por defecto sirve un BUILD DE PRODUCCIÓN (vite build + vite preview): prueba el bundle que
// se publica y es mucho más liviano que un segundo dev server (que compila cada módulo a
// pedido; con poca RAM libre eso hacía que algunos diálogos tardaran más de 5 s en abrir y
// la suite fallara de forma intermitente).
//
// El backend usa server/.env (base local) más variables propias del stack. Nunca apunta a
// producción: la API se sirve en localhost y global-setup aborta si no es local.

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API_PORT = 3002
const WEB_PORT = 5174
const ORIGIN = `http://localhost:${WEB_PORT}`
const args = process.argv.slice(2)
const serveOnly = args.includes('--serve')
const devMode = args.includes('--dev')
const pwArgs = args.filter(a => a !== '--serve' && a !== '--dev')
const DIST = path.join(ROOT, 'node_modules', '.e2e-dist')
// La cuenta admin local (en dev sale de .env.development.local, que el build no carga)
const WEB_ENV = { ...process.env, VITE_LOCAL_API: '1', LOCAL_API_PORT: String(API_PORT), VITE_CACHE_DIR: 'node_modules/.vite-e2e', VITE_ADMIN_EMAIL: 'admin@test.dev' }
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
    // Tiene que coincidir con VITE_ADMIN_EMAIL de abajo: ese solo decide si el
    // frontend MUESTRA el menú de admin, la autorización real la hace la API con
    // esta variable. Si no coinciden, la cuenta de prueba ve el menú pero el
    // backend le devuelve 403 en todo (seguiría usando el ADMIN_EMAIL real de
    // server/.env, que no es ninguna cuenta de prueba).
    ADMIN_EMAIL: 'admin@test.dev',
    // Sin esto, auth.js manda los mails de recuperación por Gmail de verdad (con
    // las credenciales de server/.env) en vez de escribirlos acá: password-reset.spec
    // y security-demo.spec leen este archivo, nunca una casilla real.
    MAIL_OUTBOX_FILE: path.join(ROOT, 'e2e', '.outbox.jsonl'),
  },
})
if (devMode) {
  start('web', 'npx', ['vite', '--port', String(WEB_PORT), '--strictPort'], { cwd: ROOT, env: WEB_ENV })
} else {
  console.log('Construyendo el frontend para E2E…')
  const build = spawnSync('npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir', '--logLevel', 'warn'], {
    cwd: ROOT, env: WEB_ENV, shell: isWin, stdio: 'inherit',
  })
  if (build.status !== 0) { stopAll(); console.error('Falló el build del frontend'); process.exit(1) }
  start('web', 'npx', ['vite', 'preview', '--outDir', DIST, '--port', String(WEB_PORT), '--strictPort'], { cwd: ROOT, env: WEB_ENV })
}

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
  if (code !== 0) keepFailureEvidence()
} catch (err) {
  console.error(err.message)
} finally {
  stopAll()
}
process.exit(code)

// Playwright guarda trazas de lo que falla en test-results/, pero la corrida siguiente lo
// borra: una falla intermitente se perdía al volver a correr el test suelto. Se copia a
// e2e/.failures/<fecha> (ignorado por git) y se conservan las últimas 10.
function keepFailureEvidence() {
  const src = path.join(ROOT, 'test-results')
  if (!fs.existsSync(src) || fs.readdirSync(src).length === 0) return
  const base = path.join(ROOT, 'e2e', '.failures')
  const dest = path.join(base, new Date().toISOString().replace(/[:.]/g, '-'))
  fs.cpSync(src, dest, { recursive: true })
  const runs = fs.readdirSync(base).sort()
  for (const old of runs.slice(0, Math.max(0, runs.length - 10))) {
    fs.rmSync(path.join(base, old), { recursive: true, force: true })
  }
  console.error(`
Evidencia de las fallas guardada en ${path.relative(ROOT, dest)} (trazas: npx playwright show-trace <archivo>.zip)`)
}
