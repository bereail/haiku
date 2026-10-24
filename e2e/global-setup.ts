import fs from 'node:fs'
import { request } from '@playwright/test'
import { ACCOUNTS, API_URL, AUTH_DIR, BASE_URL, storageStatePath, type AccountName } from './accounts'
import { tourKey } from '../src/tour/tourStorage'

/**
 * Prepara las cuentas de prueba y guarda una sesión por cuenta (storageState)
 * para que los tests no tengan que loguearse por la UI cada vez.
 *
 * Reusa la sesión guardada mientras el token siga siendo válido: /auth/login
 * tiene rate limit (20 cada 15 min por IP), así que loguear en cada corrida
 * agotaría el cupo enseguida.
 */
export default async function globalSetup() {
  // Defensa explícita: este setup crea cuentas. Nunca contra producción.
  if (!/^http:\/\/localhost[:/]/.test(API_URL)) {
    throw new Error(`global-setup: API_URL no es local (${API_URL}). Abortado.`)
  }

  const api = await request.newContext()
  const health = await api.get(`${API_URL}/health`).catch(() => null)
  const body = health && health.ok() ? await health.json() : null
  if (!body?.db) {
    throw new Error(
      'global-setup: el backend local no responde en /librook-api/health. ' +
      '¿Vite corre con VITE_LOCAL_API=1 y el backend local está levantado?'
    )
  }

  fs.mkdirSync(AUTH_DIR, { recursive: true })

  for (const name of Object.keys(ACCOUNTS) as (keyof typeof ACCOUNTS)[]) {
    if (await hasValidSession(api, name)) continue
    const { email, password } = ACCOUNTS[name]
    let res = await api.post(`${API_URL}/auth/login`, { data: { email, password } })
    if (res.status() === 400) {
      res = await api.post(`${API_URL}/auth/register`, { data: { email, password } })
    }
    if (!res.ok()) throw new Error(`global-setup: no se pudo preparar ${email}: ${res.status()} ${await res.text()}`)
    saveSession(name, await res.json())
  }

  if (!(await hasValidSession(api, 'demo'))) {
    const res = await api.post(`${API_URL}/auth/demo-login`)
    if (!res.ok()) throw new Error(`global-setup: demo-login falló: ${res.status()}`)
    saveSession('demo', await res.json())
  }

  // Las sesiones guardadas son de alguien que ya vio el tutorial: la invitación de la
  // primera vez se prueba en tour.spec y no tiene que tapar nada en el resto.
  for (const name of [...Object.keys(ACCOUNTS), 'demo'] as AccountName[]) markTourSeen(name)

  await api.dispose()
}

function markTourSeen(name: AccountName) {
  const file = storageStatePath(name)
  const state = JSON.parse(fs.readFileSync(file, 'utf8'))
  const ls = state.origins[0].localStorage as { name: string; value: string }[]
  const email = JSON.parse(ls.find(i => i.name === 'librook_auth')!.value).email as string
  if (ls.some(i => i.name === tourKey(email))) return
  ls.push({ name: tourKey(email), value: 'dismissed' })
  fs.writeFileSync(file, JSON.stringify(state, null, 2))
}

async function hasValidSession(api: Awaited<ReturnType<typeof request.newContext>>, name: AccountName) {
  const file = storageStatePath(name)
  if (!fs.existsSync(file)) return false
  try {
    const ls = JSON.parse(fs.readFileSync(file, 'utf8')).origins[0].localStorage
    const token = ls.find((i: { name: string }) => i.name === 'librook_token').value
    const res = await api.get(`${API_URL}/books`, { headers: { Authorization: `Bearer ${token}` } })
    return res.ok()
  } catch {
    return false
  }
}

function saveSession(name: AccountName, data: { token: string; email: string; isDemo?: boolean }) {
  const origin = new URL(BASE_URL).origin
  const state = {
    cookies: [],
    origins: [{
      origin,
      localStorage: [
        { name: 'librook_token', value: data.token },
        { name: 'librook_auth', value: JSON.stringify({ email: data.email, isDemo: !!data.isDemo }) },
      ],
    }],
  }
  fs.writeFileSync(storageStatePath(name), JSON.stringify(state, null, 2))
}
