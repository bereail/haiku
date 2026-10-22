import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type Page } from '@playwright/test'
import { ACCOUNTS, BASE_URL, tokenOf } from './accounts'

// Con un token vencido o inválido la app tiene que volver al login y limpiar
// la sesión, no quedarse "logueada" con una biblioteca rota o en blanco.

// JWT_SECRET del backend LOCAL (server/.env), para firmar un token vencido
// pero auténtico. Nunca es el secreto de producción.
function localJwtSecret() {
  const envFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', '.env')
  const line = fs.readFileSync(envFile, 'utf8').split(/\r?\n/).find(l => l.startsWith('JWT_SECRET='))
  return line!.slice('JWT_SECRET='.length).trim()
}

function signHS256(payload: object, secret: string) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const data = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`
  return `${data}.${crypto.createHmac('sha256', secret).update(data).digest('base64url')}`
}

function expiredTokenForLectora1() {
  const real = JSON.parse(Buffer.from(tokenOf('lectora1').split('.')[1], 'base64url').toString())
  const now = Math.floor(Date.now() / 1000)
  return signHS256({ ...real, iat: now - 8 * 86400, exp: now - 86400 }, localJwtSecret())
}

async function openWithToken(page: Page, token: string) {
  await page.addInitScript(([t, email]) => {
    // Solo la primera carga: si la app limpia la sesión, no reinyectarla.
    if (sessionStorage.getItem('e2e-injected')) return
    sessionStorage.setItem('e2e-injected', '1')
    localStorage.setItem('librook_token', t)
    localStorage.setItem('librook_auth', JSON.stringify({ email, isDemo: false }))
  }, [token, ACCOUNTS.lectora1.email])
  await page.goto(BASE_URL)
}

async function expectBackAtLogin(page: Page) {
  await expect(page.locator('#email')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible()
  await expect(page.getByPlaceholder('Buscar por título o autor...')).toHaveCount(0)
  // Un aviso que explique por qué volvió al login
  await expect(page.getByText(/sesión (expiró|venció|no es válida)/i)).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('librook_token'))).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('librook_auth'))).toBeNull()
}

test.describe('Sesión vencida o inválida', () => {
  test('el token firmado y vencido es rechazado por la API', async ({ request }) => {
    const res = await request.get('http://localhost:5173/librook-api/books', {
      headers: { Authorization: `Bearer ${expiredTokenForLectora1()}` },
    })
    expect(res.status()).toBe(401)
  })

  test('con un token vencido la app vuelve al login y limpia la sesión', async ({ page }) => {
    await openWithToken(page, expiredTokenForLectora1())
    await expectBackAtLogin(page)
  })

  test('con un token inválido la app vuelve al login y limpia la sesión', async ({ page }) => {
    await openWithToken(page, 'no.es.un-token')
    await expectBackAtLogin(page)
  })

  test('después de volver al login se puede entrar de nuevo normalmente', async ({ page }) => {
    await openWithToken(page, 'no.es.un-token')
    await expect(page.locator('#email')).toBeVisible()
    await page.locator('#email').fill(ACCOUNTS.lectora1.email)
    await page.locator('#password').fill(ACCOUNTS.lectora1.password)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByPlaceholder('Buscar por título o autor...')).toBeVisible()
  })
})
