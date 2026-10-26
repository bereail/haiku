import crypto from 'node:crypto'
import fs from 'node:fs'
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { API_URL, BASE_URL, OUTBOX_FILE, bearer } from './accounts'
import { dbExec, dbValue } from './dbExec'

// Recuperación de contraseña de punta a punta. El "correo" es la bandeja
// local (MAIL_OUTBOX_FILE del backend local): nunca se manda un mail real.

const EMAIL = 'reset@test.dev'
const START_PASSWORD = 'inicial1234'

test.describe.configure({ mode: 'serial' })

function outboxLines(): { to: string; html: string }[] {
  if (!fs.existsSync(OUTBOX_FILE)) return []
  return fs.readFileSync(OUTBOX_FILE, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
}

function lastResetLinkFor(email: string, afterIndex: number) {
  const mail = outboxLines().slice(afterIndex).reverse().find(m => m.to === email)
  if (!mail) return null
  const href = mail.html.match(/href="([^"]+reset_token=[0-9a-f]+)"/)?.[1]
  return href ?? null
}

async function setKnownPassword(request: APIRequestContext) {
  // La cuenta de prueba de reset vuelve a una contraseña conocida antes de
  // cada corrida (lo hace la admin local, que tiene ese permiso).
  await request.post(`${API_URL}/auth/register`, { data: { email: EMAIL, password: START_PASSWORD } })
  const users = await (await request.get(`${API_URL}/admin/users`, { headers: bearer('admin') })).json()
  const id = users.find((u: { email: string }) => u.email === EMAIL).id
  const res = await request.put(`${API_URL}/admin/users/${id}/password`, {
    headers: bearer('admin'), data: { password: START_PASSWORD },
  })
  expect(res.ok()).toBeTruthy()
}

async function requestResetFromUI(page: Page, email: string) {
  await page.goto(BASE_URL)
  await page.getByRole('button', { name: 'Olvidé mi contraseña' }).click()
  await page.locator('#email').fill(email)
  await page.getByRole('button', { name: 'Enviar enlace' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Si el email está registrado' })).toBeVisible()
}

async function login(request: APIRequestContext, password: string) {
  return request.post(`${API_URL}/auth/login`, { data: { email: EMAIL, password } })
}

test.describe('Recuperar contraseña', () => {
  test.beforeEach(async ({ request }) => {
    await setKnownPassword(request)
  })

  test('flujo completo por la UI: pedir link, abrirlo, cambiar la contraseña y entrar', async ({ page, request }) => {
    const mark = outboxLines().length
    await requestResetFromUI(page, EMAIL)

    const link = lastResetLinkFor(EMAIL, mark)
    expect(link, 'llegó un mail con link de reset').toBeTruthy()
    expect(link!.startsWith(BASE_URL), 'el link apunta al entorno local').toBeTruthy()

    const newPassword = `nueva-${Date.now()}`
    await page.goto(link!)
    await expect(page.getByRole('heading', { name: 'Nueva contraseña' })).toBeVisible()
    await page.locator('#password').fill(newPassword)
    await page.locator('#confirm').fill(newPassword)
    await page.getByRole('button', { name: /guardar|cambiar|restablecer|actualizar/i }).click()
    // El formulario (y su botón con foco) desaparece: el foco pasa al mensaje
    // de éxito para que se anuncie, en vez de perderse en <body>.
    await expect(page.getByRole('status').filter({ hasText: '¡Contraseña actualizada!' })).toBeFocused()

    expect((await login(request, START_PASSWORD)).status()).toBe(400)
    expect((await login(request, newPassword)).ok()).toBeTruthy()

    // Login por la UI con la nueva contraseña
    await page.getByRole('button', { name: 'Ir al inicio de sesión' }).click()
    await page.locator('#email').fill(EMAIL)
    await page.locator('#password').fill(newPassword)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByPlaceholder('Buscar por título o autor...')).toBeVisible()
  })

  test('API: el link es de un solo uso', async ({ page, request }) => {
    const mark = outboxLines().length
    await requestResetFromUI(page, EMAIL)
    const token = new URL(lastResetLinkFor(EMAIL, mark)!).searchParams.get('reset_token')

    expect((await request.post(`${API_URL}/auth/reset-password`, { data: { token, password: 'primera123' } })).ok()).toBeTruthy()
    const reuse = await request.post(`${API_URL}/auth/reset-password`, { data: { token, password: 'segunda123' } })
    expect(reuse.status()).toBe(400)
    expect((await login(request, 'primera123')).ok()).toBeTruthy()
    expect((await login(request, 'segunda123')).status()).toBe(400)
  })

  test('API: un token inventado no sirve', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/reset-password`, {
      data: { token: 'f'.repeat(64), password: 'hackeada123' },
    })
    expect(res.status()).toBe(400)
    expect((await login(request, START_PASSWORD)).ok()).toBeTruthy()
  })

  test('UI: un link inválido muestra el error y no cambia nada', async ({ page, request }) => {
    await page.goto(`${BASE_URL}?reset_token=${'0'.repeat(64)}`)
    await page.locator('#password').fill('hackeada123')
    await page.locator('#confirm').fill('hackeada123')
    await page.getByRole('button', { name: /guardar|cambiar|restablecer|actualizar/i }).click()
    // role="alert": el lector de pantalla lo anuncia sin que haya que buscarlo
    await expect(page.getByRole('alert')).toHaveText('El enlace es inválido o ya expiró')
    expect((await login(request, START_PASSWORD)).ok()).toBeTruthy()
  })

  test('UI: los errores de validación se anuncian (role=alert)', async ({ page }) => {
    await page.goto(`${BASE_URL}?reset_token=${'0'.repeat(64)}`)
    await page.locator('#password').fill('abcdef12')
    await page.locator('#confirm').fill('distinta12')
    await page.getByRole('button', { name: /guardar|cambiar|restablecer|actualizar/i }).click()
    await expect(page.getByRole('alert')).toHaveText('Las contraseñas no coinciden')
  })

  test('API: un link vencido no sirve', async ({ page, request }) => {
    const mark = outboxLines().length
    await requestResetFromUI(page, EMAIL)
    const token = new URL(lastResetLinkFor(EMAIL, mark)!).searchParams.get('reset_token')!
    // Simula que pasó más de 1 hora: vence el token directamente en la base LOCAL.
    // El token es hex, sin inyección posible.
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    // La base guarda el hash del token, no el token
    dbExec(`UPDATE password_reset_tokens SET expires_at = NOW() - INTERVAL '1 minute' WHERE token = '${crypto.createHash('sha256').update(token).digest('hex')}'`)

    const res = await request.post(`${API_URL}/auth/reset-password`, { data: { token, password: 'tarde1234' } })
    expect(res.status()).toBe(400)
    expect((await login(request, START_PASSWORD)).ok()).toBeTruthy()
  })

  test('la base guarda el hash del token, no el token del mail', async ({ page }) => {
    const mark = outboxLines().length
    await requestResetFromUI(page, EMAIL)
    const token = new URL(lastResetLinkFor(EMAIL, mark)!).searchParams.get('reset_token')!
    const sha = crypto.createHash('sha256').update(token).digest('hex')
    const q = (v: string) => dbValue(`SELECT count(*) FROM password_reset_tokens WHERE token = '${v}'`)
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(q(token)).toBe('0')
    expect(q(sha)).toBe('1')
  })

  test('usar un link anula los demás links pendientes del mismo usuario', async ({ page, request }) => {
    const mark = outboxLines().length
    await requestResetFromUI(page, EMAIL)
    await requestResetFromUI(page, EMAIL)
    const links = outboxLines().slice(mark).filter(m => m.to === EMAIL)
      .map(m => new URL(m.html.match(/href="([^"]+reset_token=[0-9a-f]+)"/)![1]).searchParams.get('reset_token'))
    expect(links).toHaveLength(2)
    expect((await request.post(`${API_URL}/auth/reset-password`, { data: { token: links[1], password: 'segunda1234' } })).ok()).toBeTruthy()
    const old = await request.post(`${API_URL}/auth/reset-password`, { data: { token: links[0], password: 'primera1234' } })
    expect(old.status()).toBe(400)
    expect((await login(request, 'segunda1234')).ok()).toBeTruthy()
  })

  test('API: un email que no existe recibe la misma respuesta y no genera mail', async ({ request }) => {
    const mark = outboxLines().length
    const res = await request.post(`${API_URL}/auth/forgot-password`, { data: { email: 'nadie-existe@test.dev' } })
    expect(res.ok()).toBeTruthy()
    expect(await res.json()).toEqual({ ok: true })
    expect(outboxLines().slice(mark).some(m => m.to === 'nadie-existe@test.dev')).toBeFalsy()
  })

  test('API: cambiar la contraseña por reset cierra las sesiones abiertas antes', async ({ page, request }) => {
    // Escenario: alguien robó una sesión (token) y la dueña resetea la
    // contraseña para echarlo. Esa sesión vieja tiene que dejar de servir.
    const oldSession = (await (await login(request, START_PASSWORD)).json()).token
    const h = { Authorization: `Bearer ${oldSession}` }
    expect((await request.get(`${API_URL}/books`, { headers: h })).ok()).toBeTruthy()

    const mark = outboxLines().length
    await requestResetFromUI(page, EMAIL)
    const token = new URL(lastResetLinkFor(EMAIL, mark)!).searchParams.get('reset_token')
    expect((await request.post(`${API_URL}/auth/reset-password`, { data: { token, password: 'echado1234' } })).ok()).toBeTruthy()

    expect((await request.get(`${API_URL}/books`, { headers: h })).status()).toBe(401)
    // Y una sesión nueva con la contraseña nueva sí funciona
    const fresh = (await (await login(request, 'echado1234')).json()).token
    expect((await request.get(`${API_URL}/books`, { headers: { Authorization: `Bearer ${fresh}` } })).ok()).toBeTruthy()
  })
})
