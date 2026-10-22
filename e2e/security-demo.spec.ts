import fs from 'node:fs'
import { test, expect, type APIRequestContext } from '@playwright/test'
import { API_URL, OUTBOX_FILE, bearer, storageStatePath } from './accounts'

// La cuenta demo es compartida por todos los visitantes: tiene que ser de
// solo lectura SIEMPRE, se entre como se entre.

const DEMO_EMAIL = 'demo@librook.app'
const READ_ONLY = /solo lectura/i

let demoBookId: string
let lectoraPostId: string
let lectoraBookId: string

async function demoBooks(request: APIRequestContext) {
  const res = await request.get(`${API_URL}/books`, { headers: bearer('demo') })
  expect(res.ok()).toBeTruthy()
  return res.json() as Promise<{ id: string; title: string }[]>
}

test.describe('Modo demo: solo lectura', () => {
  test.beforeAll(async ({ request }) => {
    const books = await demoBooks(request)
    expect(books.length).toBeGreaterThan(0)
    demoBookId = books[0].id

    // Una publicación ajena (de lectora1) sobre la que la demo intenta escribir.
    const book = await request.post(`${API_URL}/books`, {
      headers: bearer('lectora1'),
      data: { title: `Demo-target E2E ${Date.now()}`, author: 'X', notes: 'n' },
    })
    lectoraBookId = (await book.json()).id
    const post = await request.post(`${API_URL}/community/posts`, {
      headers: bearer('lectora1'),
      data: { bookId: lectoraBookId, reflection: 'Reflexión de lectora1 (E2E demo)' },
    })
    expect(post.ok()).toBeTruthy()
    lectoraPostId = (await post.json()).id
  })

  test.afterAll(async ({ request }) => {
    await request.delete(`${API_URL}/community/posts/${lectoraPostId}`, { headers: bearer('lectora1') })
    await request.delete(`${API_URL}/books/${lectoraBookId}`, { headers: bearer('lectora1') })
  })

  test('API: la demo puede leer su biblioteca', async ({ request }) => {
    expect((await demoBooks(request)).length).toBeGreaterThan(0)
  })

  test('API: todas las escrituras de la demo se rechazan con 403 y no cambian nada', async ({ request }) => {
    const before = JSON.stringify(await demoBooks(request))
    const h = bearer('demo')
    const attempts = [
      request.post(`${API_URL}/books`, { headers: h, data: { title: 'Intruso' } }),
      request.put(`${API_URL}/books/${demoBookId}`, { headers: h, data: { title: 'Pisado' } }),
      request.delete(`${API_URL}/books/${demoBookId}`, { headers: h }),
      request.put(`${API_URL}/settings/goal`, { headers: h, data: { count: 99 } }),
      request.put(`${API_URL}/settings/profile`, { headers: h, data: { displayName: 'Intruso' } }),
      request.post(`${API_URL}/community/posts`, { headers: h, data: { bookId: demoBookId, reflection: 'x' } }),
      request.post(`${API_URL}/community/posts/${lectoraPostId}/comments`, { headers: h, data: { body: 'spam' } }),
      request.post(`${API_URL}/community/posts/${lectoraPostId}/likes`, { headers: h }),
    ]
    for (const res of await Promise.all(attempts)) {
      expect(res.status(), res.url()).toBe(403)
      expect((await res.json()).error).toMatch(READ_ONLY)
    }
    expect(JSON.stringify(await demoBooks(request))).toBe(before)
  })

  test('API: pedir reset de contraseña de la cuenta demo no manda ningún mail', async ({ request }) => {
    const before = fs.existsSync(OUTBOX_FILE) ? fs.readFileSync(OUTBOX_FILE, 'utf8') : ''
    const res = await request.post(`${API_URL}/auth/forgot-password`, { data: { email: DEMO_EMAIL } })
    // Misma respuesta que para cualquier email (no revela nada)...
    expect(res.ok()).toBeTruthy()
    // ...pero sin mail: si no, quien controle ese buzón toma la cuenta compartida.
    const after = fs.existsSync(OUTBOX_FILE) ? fs.readFileSync(OUTBOX_FILE, 'utf8') : ''
    expect(after.slice(before.length)).not.toContain(DEMO_EMAIL)
  })

  test('API: aunque alguien conozca la contraseña de la demo, el login normal sigue siendo solo lectura', async ({ request }) => {
    // Simula que la contraseña de la demo se filtró o se cambió (acá lo hace
    // la admin local, que tiene ese permiso legítimo).
    const users = await (await request.get(`${API_URL}/admin/users`, { headers: bearer('admin') })).json()
    const demo = users.find((u: { email: string }) => u.email === DEMO_EMAIL)
    const known = 'demo-pass-e2e-123'
    expect((await request.put(`${API_URL}/admin/users/${demo.id}/password`, {
      headers: bearer('admin'), data: { password: known },
    })).ok()).toBeTruthy()

    const login = await request.post(`${API_URL}/auth/login`, { data: { email: DEMO_EMAIL, password: known } })
    expect(login.ok()).toBeTruthy()
    const { token, isDemo } = await login.json()
    expect(isDemo).toBe(true)

    const write = await request.post(`${API_URL}/books`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'Vandalismo en la demo compartida' },
    })
    expect(write.status()).toBe(403)
  })

  test('API: no se puede registrar una cuenta con el email de la demo', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/register`, { data: { email: DEMO_EMAIL.toUpperCase(), password: 'cualquiera123' } })
    expect(res.ok()).toBeFalsy()
  })

  test.describe('UI', () => {
    test.use({ storageState: storageStatePath('demo') })

    test('muestra el aviso de solo lectura y un intento de alta informa el rechazo', async ({ page }) => {
      await page.goto('')
      await expect(page.getByRole('status').filter({ hasText: READ_ONLY })).toBeVisible()
      await expect(page.getByRole('article').first()).toBeVisible()
      const countBefore = await page.getByRole('article').count()

      await page.getByRole('button', { name: 'Agregar', exact: true }).click()
      await page.locator('#title').fill('Intento desde la demo')
      await page.locator('#author').fill('Nadie')
      await page.getByRole('button', { name: 'Agregar libro' }).click()

      await expect(page.getByText(READ_ONLY).last()).toBeVisible()
      await page.reload()
      await expect(page.getByRole('article').first()).toBeVisible()
      expect(await page.getByRole('article').count()).toBe(countBefore)
      await expect(page.getByRole('article', { name: 'Intento desde la demo' })).toHaveCount(0)
    })
  })
})
