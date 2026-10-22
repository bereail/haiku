import { test, expect } from '@playwright/test'
import { API_URL, bearer, storageStatePath } from './accounts'

// Un usuario nunca puede leer, modificar ni borrar libros de otro, ni usarlos
// para publicar en Comunidad — ni por la UI ni pegándole directo a la API.

const TITLE = `Aislamiento E2E ${Date.now()}`
const NOTE = 'Nota privada de lectora1 — lectora2 nunca debería verla.'
let bookId: string

test.describe('Aislamiento entre usuarios', () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${API_URL}/books`, {
      headers: bearer('lectora1'),
      data: { title: TITLE, author: 'Autora E2E', notes: NOTE },
    })
    expect(res.ok()).toBeTruthy()
    bookId = (await res.json()).id
  })

  test.afterAll(async ({ request }) => {
    await request.delete(`${API_URL}/books/${bookId}`, { headers: bearer('lectora1') })
  })

  async function lectora1Book(request: import('@playwright/test').APIRequestContext) {
    const res = await request.get(`${API_URL}/books`, { headers: bearer('lectora1') })
    return (await res.json()).find((b: { id: string }) => b.id === bookId)
  }

  test('API: lectora2 no ve el libro de lectora1 en su listado', async ({ request }) => {
    const res = await request.get(`${API_URL}/books`, { headers: bearer('lectora2') })
    expect(res.ok()).toBeTruthy()
    const text = await res.text()
    expect(text).not.toContain(bookId)
    expect(text).not.toContain(NOTE)
  })

  test('API: lectora2 no puede editar el libro de lectora1', async ({ request }) => {
    const res = await request.put(`${API_URL}/books/${bookId}`, {
      headers: bearer('lectora2'),
      data: { title: 'Pisado por lectora2', notes: 'hackeado' },
    })
    expect(res.status()).toBe(404)
    const book = await lectora1Book(request)
    expect(book.title).toBe(TITLE)
    expect(book.notes).toBe(NOTE)
  })

  test('API: lectora2 no puede borrar el libro de lectora1', async ({ request }) => {
    await request.delete(`${API_URL}/books/${bookId}`, { headers: bearer('lectora2') })
    expect(await lectora1Book(request)).toBeTruthy()
  })

  test('API: lectora2 no puede publicar en Comunidad usando un libro ajeno', async ({ request }) => {
    const res = await request.post(`${API_URL}/community/posts`, {
      headers: bearer('lectora2'),
      data: { bookId, reflection: 'Reflexión sobre un libro que no es mío' },
    })
    expect(res.status()).toBe(404)
  })

  test('API: sin token, con token basura o falsificado → 401', async ({ request }) => {
    expect((await request.get(`${API_URL}/books`)).status()).toBe(401)
    expect((await request.get(`${API_URL}/books`, {
      headers: { Authorization: 'Bearer basura' },
    })).status()).toBe(401)

    // Token "alg: none" (sin firma) que dice ser lectora1: jsonwebtoken
    // debe rechazarlo.
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const real = JSON.parse(Buffer.from(bearer('lectora1').Authorization.split('.')[1], 'base64url').toString())
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(real)}.`
    expect((await request.get(`${API_URL}/books`, {
      headers: { Authorization: `Bearer ${unsigned}` },
    })).status()).toBe(401)

    // Payload de lectora1 con la firma de un token de lectora2: firma inválida.
    const [h2, , s2] = bearer('lectora2').Authorization.slice(7).split('.')
    const tampered = `${h2}.${b64(real)}.${s2}`
    expect((await request.get(`${API_URL}/books`, {
      headers: { Authorization: `Bearer ${tampered}` },
    })).status()).toBe(401)
  })

  test.describe('UI', () => {
    test.use({ storageState: storageStatePath('lectora2') })

    test('lectora2 no ve el libro de lectora1 en su biblioteca', async ({ page }) => {
      await page.goto('')
      const search = page.getByPlaceholder('Buscar por título o autor...')
      await expect(search).toBeVisible()
      await search.fill(TITLE)
      await expect(page.getByRole('article', { name: TITLE })).toHaveCount(0)
      await expect(page.getByText(NOTE)).toHaveCount(0)
    })
  })
})
