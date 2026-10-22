import AxeBuilder from '@axe-core/playwright'
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { API_URL, bearer, storageStatePath, type AccountName } from './accounts'

// "Leído" / "Pendiente" en los resultados de Open Library guardan directo en la
// biblioteca, sin duplicar, con feedback y reintento ante errores, respetando
// sesión, aislamiento entre usuarios y modo demo. Open Library está simulado.

const TZ = 'America/Argentina/Buenos_Aires'
test.use({ timezoneId: TZ })

const RUN = Date.now()
const PARAMO = `Pedro Páramo ${RUN}`
const LLANO = `El llano en llamas ${RUN}`
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ }) // YYYY-MM-DD

async function mockOpenLibrary(page: Page, { delayMs = 0 } = {}) {
  await page.route('https://openlibrary.org/search.json**', async route => {
    if (delayMs) await new Promise(r => setTimeout(r, delayMs))
    await route.fulfill({ json: { docs: [
      { key: `/works/A${RUN}`, title: PARAMO, author_name: ['Juan Rulfo'], publisher: ['FCE'], first_publish_year: 1955 },
      { key: `/works/B${RUN}`, title: LLANO, author_name: ['Juan Rulfo'], publisher: ['FCE'], first_publish_year: 1953 },
    ] } })
  })
}

async function openSearch(page: Page) {
  await page.goto('')
  await page.getByRole('button', { name: 'Buscar en Open Library' }).click()
  await page.getByRole('textbox', { name: 'Buscar libros' }).fill('Rulfo')
  const results = page.getByRole('region', { name: 'Resultados de búsqueda' })
  await expect(results.getByRole('button', { name: `Leído: ${PARAMO}` })).toBeVisible()
  return results
}

async function booksOf(request: APIRequestContext, who: AccountName, title: string) {
  const res = await request.get(`${API_URL}/books`, { headers: bearer(who) })
  expect(res.ok()).toBeTruthy()
  return ((await res.json()) as Record<string, unknown>[]).filter(b => b.title === title)
}

async function cleanup(request: APIRequestContext, who: AccountName) {
  for (const t of [PARAMO, LLANO]) {
    for (const b of await booksOf(request, who, t)) {
      await request.delete(`${API_URL}/books/${b.id}`, { headers: bearer(who) })
    }
  }
}

test.describe('Guardado rápido desde Open Library', () => {
  test.use({ storageState: storageStatePath('lectora2') })
  test.afterEach(async ({ request }) => { await cleanup(request, 'lectora2') })

  test('"Leído" guarda un libro nuevo como leído, con feedback mientras guarda', async ({ page, request }) => {
    await mockOpenLibrary(page)
    const results = await openSearch(page)
    // Demorar la respuesta del backend para poder ver el estado intermedio
    await page.route('**/librook-api/books', async route => {
      if (route.request().method() === 'POST') await new Promise(r => setTimeout(r, 600))
      await route.continue()
    })
    const leido = results.getByRole('button', { name: `Leído: ${PARAMO}` })
    await leido.click()
    await expect(results.getByRole('status').filter({ hasText: 'Guardando…' })).toBeVisible()
    await expect(leido).toBeDisabled()
    await expect(results.getByRole('button', { name: `Pendiente: ${PARAMO}` })).toBeDisabled()
    await expect(results.getByRole('status').filter({ hasText: 'Guardado como Leído' })).toBeVisible()

    const [saved] = await booksOf(request, 'lectora2', PARAMO)
    expect(saved).toMatchObject({ author: 'Juan Rulfo', publisher: 'FCE', year: 1955, startDate: today(), endDate: today(), abandoned: false })

    // Aparece en la biblioteca con el filtro Leídos
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Leídos', exact: true }).click()
    await expect(page.getByRole('article', { name: PARAMO })).toBeVisible()
  })

  test('"Pendiente" guarda un libro nuevo como pendiente (sin fechas)', async ({ page, request }) => {
    await mockOpenLibrary(page)
    const results = await openSearch(page)
    await results.getByRole('button', { name: `Pendiente: ${LLANO}` }).click()
    await expect(results.getByRole('status').filter({ hasText: 'Guardado como Pendiente' })).toBeVisible()
    const [saved] = await booksOf(request, 'lectora2', LLANO)
    expect(saved).toMatchObject({ startDate: null, endDate: null, abandoned: false })
  })

  test('libro existente pendiente + "Leído": no se duplica, pasa a leído y conserva sus datos', async ({ page, request }) => {
    await request.post(`${API_URL}/books`, { headers: bearer('lectora2'), data: { title: PARAMO, author: 'Juan Rulfo', notes: 'nota previa', score: 4 } })
    await mockOpenLibrary(page)
    const results = await openSearch(page)
    await results.getByRole('button', { name: `Leído: ${PARAMO}` }).click()
    await expect(results.getByRole('status').filter({ hasText: 'Ya estaba en tu biblioteca: ahora figura como Leído' })).toBeVisible()

    const copies = await booksOf(request, 'lectora2', PARAMO)
    expect(copies).toHaveLength(1)
    expect(copies[0]).toMatchObject({ notes: 'nota previa', score: 4, endDate: today() })
  })

  test('libro ya leído + "Pendiente": no se duplica ni pierde sus fechas', async ({ page, request }) => {
    await request.post(`${API_URL}/books`, { headers: bearer('lectora2'), data: { title: PARAMO, author: 'Juan Rulfo', startDate: '2025-01-10', endDate: '2025-02-20' } })
    await mockOpenLibrary(page)
    const results = await openSearch(page)
    await results.getByRole('button', { name: `Pendiente: ${PARAMO}` }).click()
    await expect(results.getByRole('status').filter({ hasText: 'Ya está en tu biblioteca como Leído' })).toBeVisible()

    const copies = await booksOf(request, 'lectora2', PARAMO)
    expect(copies).toHaveLength(1)
    expect(copies[0]).toMatchObject({ startDate: '2025-01-10', endDate: '2025-02-20' })
  })

  test('si el guardado falla, muestra un error claro y se puede reintentar sin duplicar', async ({ page, request }) => {
    // Tema oscuro desde la carga (useTheme lo decide al iniciar): sirve para
    // verificar el contraste de los mensajes más abajo.
    await page.emulateMedia({ colorScheme: 'dark' })
    await mockOpenLibrary(page)
    const results = await openSearch(page)
    let failNext = true
    await page.route('**/librook-api/books', async route => {
      if (route.request().method() === 'POST' && failNext) {
        failNext = false
        return route.fulfill({ status: 500, json: { error: 'Error al guardar el libro' } })
      }
      return route.continue()
    })
    const leido = results.getByRole('button', { name: `Leído: ${PARAMO}` })
    await leido.click()
    const alert = results.getByRole('alert')
    await expect(alert).toHaveText(/No se pudo guardar: Error al guardar el libro\. Podés volver a intentarlo\.$/)
    await expect(leido).toBeEnabled()
    expect(await booksOf(request, 'lectora2', PARAMO)).toHaveLength(0)

    // Contraste de los mensajes en tema oscuro (éxito y error visibles a la vez)
    await results.getByRole('button', { name: `Pendiente: ${LLANO}` }).click()
    await expect(results.getByRole('status').filter({ hasText: 'Guardado como Pendiente' })).toBeVisible()
    await results.getByRole('button', { name: `Leído: ${LLANO}` }).hover()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    const { violations } = await new AxeBuilder({ page }).include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(violations.map(v => `${v.id}: ${v.nodes.map(n => n.failureSummary).join(' | ')}`)).toEqual([])

    await leido.click() // reintento
    await expect(results.getByRole('status').filter({ hasText: 'Guardado como Leído' })).toBeVisible()
    await expect(alert).toHaveCount(0)
    expect(await booksOf(request, 'lectora2', PARAMO)).toHaveLength(1)
  })
})

test.describe('Aislamiento entre usuarios', () => {
  test.use({ storageState: storageStatePath('lectora2') })

  test.afterAll(async ({ request }) => {
    await cleanup(request, 'lectora1')
    await cleanup(request, 'lectora2')
  })

  test('que lectora1 ya tenga el libro no cuenta como duplicado para lectora2, ni se toca su copia', async ({ page, request }) => {
    await request.post(`${API_URL}/books`, { headers: bearer('lectora1'), data: { title: PARAMO, author: 'Juan Rulfo', notes: 'nota de lectora1' } })
    await mockOpenLibrary(page)
    const results = await openSearch(page)
    await results.getByRole('button', { name: `Leído: ${PARAMO}` }).click()
    await expect(results.getByRole('status').filter({ hasText: 'Guardado como Leído' })).toBeVisible()

    expect(await booksOf(request, 'lectora2', PARAMO)).toHaveLength(1)
    const [l1] = await booksOf(request, 'lectora1', PARAMO)
    expect(l1).toMatchObject({ notes: 'nota de lectora1', startDate: null, endDate: null })
  })
})

test.describe('Modo demo', () => {
  test.use({ storageState: storageStatePath('demo') })

  test('el guardado se rechaza con un error claro y no cambia la biblioteca demo', async ({ page, request }) => {
    const before = await (await request.get(`${API_URL}/books`, { headers: bearer('demo') })).json()
    await mockOpenLibrary(page)
    const results = await openSearch(page)
    await results.getByRole('button', { name: `Leído: ${PARAMO}` }).click()
    await expect(results.getByRole('alert')).toContainText('solo lectura')
    await expect(results.getByRole('button', { name: `Leído: ${PARAMO}` })).toBeEnabled()
    const after = await (await request.get(`${API_URL}/books`, { headers: bearer('demo') })).json()
    expect(after).toHaveLength(before.length)
  })
})
