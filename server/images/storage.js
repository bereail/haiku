const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

// Almacenamiento de imágenes subidas en el disco del propio servidor (sin servicios
// externos). La carpeta va FUERA del webroot: nginx no la sirve directo; las imágenes salen
// solo por la API, que controla nombre, tipo y cabeceras.
//
// UPLOADS_DIR: en producción algo como /var/lib/haiku/uploads (configurarlo en el .env del
// VPS; ver docs/marketplace-imagenes.md). Reglas:
// - tiene que ser una ruta absoluta (una relativa dependería del directorio del servicio);
// - no puede estar dentro de /var/www (lo sirve nginx) ni dentro del código del servidor
//   (cada deploy lo reemplaza);
// - si falta, el valor por defecto <repo>/.uploads se usa SOLO en una copia de desarrollo
//   (con .git). En el servidor no hay default: la subida de fotos queda deshabilitada
//   (503) y el arranque lo avisa, en vez de escribir en un lugar inesperado. El resto de la
//   API sigue funcionando.
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const SERVER_DIR = path.resolve(__dirname, '..')
const DEFAULT_DIR = path.join(REPO_ROOT, '.uploads')
const FORBIDDEN = [path.resolve('/var/www'), SERVER_DIR]
const NAME_RE = /^[0-9a-f]{32}\.(jpg|png|webp)$/

function isInside(child, parent) {
  const rel = path.relative(parent, child)
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel))
}

// { dir } o { error }. Exportada para los tests y el chequeo de arranque.
function resolveUploadsDir(env = process.env, { isDevCheckout = fs.existsSync(path.join(REPO_ROOT, '.git')) } = {}) {
  const raw = (env.UPLOADS_DIR || '').trim()
  if (!raw) {
    return isDevCheckout
      ? { dir: DEFAULT_DIR, isDefault: true }
      : { error: 'UPLOADS_DIR no está configurada (ver docs/marketplace-imagenes.md)' }
  }
  if (!path.isAbsolute(raw)) return { error: `UPLOADS_DIR tiene que ser una ruta absoluta (es "${raw}")` }
  const dir = path.resolve(raw)
  const bad = FORBIDDEN.find(f => isInside(dir, f))
  if (bad) return { error: `UPLOADS_DIR no puede estar dentro de ${bad} (es "${dir}")` }
  return { dir }
}

class UploadsNotConfiguredError extends Error {
  constructor(message) {
    super(message)
    this.code = 'UPLOADS_NOT_CONFIGURED'
  }
}

function uploadsDir() {
  const r = resolveUploadsDir()
  if (r.error) throw new UploadsNotConfiguredError(r.error)
  return r.dir
}

function ensureDir() {
  const dir = uploadsDir()
  // 0700: solo el usuario del servicio puede listar/leer/escribir (en Windows se ignora)
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  return dir
}

// Nombre aleatorio de 128 bits: no se puede adivinar ni enumerar
function randomName(ext) {
  return `${crypto.randomBytes(16).toString('hex')}.${ext}`
}

function isValidName(name) {
  return typeof name === 'string' && NAME_RE.test(name)
}

function filePath(name) {
  if (!isValidName(name)) throw new Error('Nombre de archivo inválido')
  return path.join(uploadsDir(), name)
}

// 'wx': falla si existiera (nunca pisa otro archivo); 0600: solo el usuario del servicio
function save(buffer, ext) {
  ensureDir()
  const name = randomName(ext)
  fs.writeFileSync(filePath(name), buffer, { flag: 'wx', mode: 0o600 })
  return name
}

function remove(name) {
  // Sin carpeta configurada no se pudo guardar nada: no hay archivo que borrar
  if (resolveUploadsDir().error) return false
  try {
    fs.unlinkSync(filePath(name))
    return true
  } catch (err) {
    if (err.code === 'ENOENT') return false
    throw err
  }
}

// Chequeo de arranque: nunca tira abajo el servidor, pero deja claro en el log si las fotos
// no van a funcionar (y por qué). Devuelve el resultado para los tests.
function checkUploadsConfig(log = console) {
  const r = resolveUploadsDir()
  if (r.error) {
    log.error(`[uploads] ${r.error}. La subida de fotos del Mercado queda DESHABILITADA.`)
    return { ok: false, error: r.error }
  }
  try {
    ensureDir()
    fs.accessSync(r.dir, fs.constants.R_OK | fs.constants.W_OK)
  } catch (err) {
    log.error(`[uploads] No se puede escribir en ${r.dir} (${err.code || err.message}). Revisar dueño y permisos.`)
    return { ok: false, error: err.message }
  }
  // En Windows los permisos POSIX no aplican
  const mode = fs.statSync(r.dir).mode & 0o777
  if (process.platform !== 'win32' && (mode & 0o077)) {
    log.warn(`[uploads] ${r.dir} tiene permisos ${mode.toString(8)}; se recomienda 700 (solo el usuario del servicio).`)
  }
  if (r.isDefault) log.warn(`[uploads] UPLOADS_DIR no está configurada: se usa ${r.dir} (solo desarrollo).`)
  return { ok: true, dir: r.dir }
}

module.exports = {
  uploadsDir, ensureDir, save, remove, filePath, isValidName,
  resolveUploadsDir, checkUploadsConfig, UploadsNotConfiguredError,
}
