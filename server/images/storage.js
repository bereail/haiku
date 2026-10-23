const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

// Almacenamiento de imágenes subidas en el disco del propio servidor (sin servicios
// externos). La carpeta va FUERA del webroot: nginx no la sirve directo; las imágenes salen
// solo por la API, que controla nombre, tipo y cabeceras.
//
// UPLOADS_DIR: en producción algo como /var/lib/librook/uploads (configurarlo en el .env del
// VPS). En local, por defecto <repo>/.uploads (ignorado por git).
const DEFAULT_DIR = path.resolve(__dirname, '..', '..', '.uploads')
const NAME_RE = /^[0-9a-f]{32}\.(jpg|png|webp)$/

function uploadsDir() {
  return path.resolve(process.env.UPLOADS_DIR || DEFAULT_DIR)
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
  try {
    fs.unlinkSync(filePath(name))
    return true
  } catch (err) {
    if (err.code === 'ENOENT') return false
    throw err
  }
}

module.exports = { uploadsDir, ensureDir, save, remove, filePath, isValidName }
