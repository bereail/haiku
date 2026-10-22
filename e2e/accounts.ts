import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const E2E_DIR = path.dirname(fileURLToPath(import.meta.url))

// Cuentas de prueba: existen solo en la base LOCAL (se crean en global-setup).
// Ninguna es una cuenta real ni comparte contraseña con producción.
export const ACCOUNTS = {
  lectora1: { email: 'lectora1@test.dev', password: 'test1234' },
  lectora2: { email: 'lectora2@test.dev', password: 'test1234' },
  // Tiene que coincidir con ADMIN_EMAIL (server/.env) y VITE_ADMIN_EMAIL
  // (.env.development.local) del entorno local.
  admin: { email: 'admin@test.dev', password: 'admintest1234' },
} as const

export type AccountName = keyof typeof ACCOUNTS | 'demo'

export const BASE_URL = 'http://localhost:5173/librook/'
export const API_URL = 'http://localhost:5173/librook-api'
export const AUTH_DIR = path.join(E2E_DIR, '.auth')
export const OUTBOX_FILE = path.join(E2E_DIR, '.outbox.jsonl')

export function storageStatePath(name: AccountName) {
  return path.join(AUTH_DIR, `${name}.json`)
}

// Token de la sesión guardada por global-setup, para pegarle directo a la API.
export function tokenOf(name: AccountName): string {
  const state = JSON.parse(fs.readFileSync(storageStatePath(name), 'utf8'))
  const ls = state.origins[0].localStorage as { name: string; value: string }[]
  return ls.find(i => i.name === 'librook_token')!.value
}

export function bearer(name: AccountName) {
  return { Authorization: `Bearer ${tokenOf(name)}` }
}
