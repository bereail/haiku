import { test, expect } from '@playwright/test'
import { ACCOUNTS, API_URL, bearer, storageStatePath } from './accounts'

// El panel Admin y sus endpoints son solo para ADMIN_EMAIL. La admin ve
// usuarios y métricas, pero nunca las notas privadas de los libros.

const NOTE = `Nota privada E2E admin ${Date.now()}`
let bookId: string
let lectora1Id: string

const ADMIN_GETS = ['/admin/users', '/admin/analytics']

test.describe('Panel Admin', () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${API_URL}/books`, {
      headers: bearer('lectora1'),
      data: { title: `Admin-target E2E ${Date.now()}`, author: 'X', notes: NOTE },
    })
    bookId = (await res.json()).id
    const users = await (await request.get(`${API_URL}/admin/users`, { headers: bearer('admin') })).json()
    lectora1Id = users.find((u: { email: string }) => u.email === ACCOUNTS.lectora1.email).id
  })

  test.afterAll(async ({ request }) => {
    await request.delete(`${API_URL}/books/${bookId}`, { headers: bearer('lectora1') })
  })

  test('API: sin token → 401 en todos los endpoints de admin', async ({ request }) => {
    for (const path of [...ADMIN_GETS, `/admin/users/${lectora1Id}/books`]) {
      expect((await request.get(`${API_URL}${path}`)).status(), path).toBe(401)
    }
    expect((await request.put(`${API_URL}/admin/users/${lectora1Id}/password`, {
      data: { password: 'nueva123' },
    })).status()).toBe(401)
  })

  for (const who of ['lectora1', 'lectora2', 'demo'] as const) {
    test(`API: ${who} recibe 403 en todos los endpoints de admin`, async ({ request }) => {
      const headers = bearer(who)
      for (const path of [...ADMIN_GETS, `/admin/users/${lectora1Id}/books`]) {
        expect((await request.get(`${API_URL}${path}`, { headers })).status(), path).toBe(403)
      }
      // Lo más grave: cambiar la contraseña de otra cuenta (la de la admin).
      const users = await (await request.get(`${API_URL}/admin/users`, { headers: bearer('admin') })).json()
      const adminId = users.find((u: { email: string }) => u.email === ACCOUNTS.admin.email).id
      expect((await request.put(`${API_URL}/admin/users/${adminId}/password`, {
        headers, data: { password: 'tomada123' },
      })).status()).toBe(403)
    })
  }

  test('API: la contraseña de la admin sigue intacta después de los intentos', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/login`, {
      data: { email: ACCOUNTS.admin.email, password: 'tomada123' },
    })
    expect(res.status()).toBe(400)
  })

  test('API: la admin ve usuarios y libros, pero nunca hashes ni notas privadas', async ({ request }) => {
    const users = await request.get(`${API_URL}/admin/users`, { headers: bearer('admin') })
    expect(users.ok()).toBeTruthy()
    expect(await users.text()).not.toMatch(/password|hash/i)

    const books = await request.get(`${API_URL}/admin/users/${lectora1Id}/books`, { headers: bearer('admin') })
    expect(books.ok()).toBeTruthy()
    const text = await books.text()
    expect(text).toContain('Admin-target E2E')
    expect(text).not.toContain(NOTE)
    expect(text).not.toMatch(/"notes"/)
  })

  test.describe('UI: usuaria común', () => {
    test.use({ storageState: storageStatePath('lectora1') })

    test('no ve el acceso al Panel admin', async ({ page }) => {
      await page.goto('')
      await expect(page.getByPlaceholder('Buscar por título o autor...')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Panel admin' })).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Panel Admin' })).toHaveCount(0)
    })
  })

  test.describe('UI: admin', () => {
    test.use({ storageState: storageStatePath('admin') })

    test('abre el panel y ve a lectora1 sin ver sus notas', async ({ page }) => {
      await page.goto('')
      await page.getByRole('button', { name: 'Panel admin' }).first().click()
      await expect(page.getByRole('heading', { name: 'Panel Admin' })).toBeVisible()
      await page.getByRole('button', { name: /^Usuarios/ }).click()
      const row = page.getByRole('button', { name: new RegExp(ACCOUNTS.lectora1.email) })
      await row.click()
      await expect(row).toHaveAttribute('aria-expanded', 'true')
      await expect(page.getByText('Admin-target E2E').first()).toBeVisible()
      await expect(page.getByText(NOTE)).toHaveCount(0)
    })
  })
})
