import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { API_URL, bearer, storageStatePath } from './accounts'

// Flujos principales de la biblioteca sobre un conjunto de datos controlado
// (cuenta lectora3, que se vacía y se vuelve a cargar en cada corrida).
// Open Library se reemplaza por respuestas fijas: los tests no dependen de la red.

test.describe.configure({ mode: 'serial' })
test.use({ storageState: storageStatePath('lectora3') })

const YEAR = new Date().getFullYear()
const H = () => bearer('lectora3')

type Seed = Record<string, unknown> & { title: string }
const NAMED: Seed[] = [
  { title: 'Boquitas pintadas', author: 'Manuel Puig', publisher: 'Seix Barral', genre: 'Novela', startDate: `${YEAR - 1}-05-01`, endDate: `${YEAR - 1}-06-10`, score: 3 },
  { title: 'Zama', author: 'Antonio Di Benedetto', publisher: 'Adriana Hidalgo', genre: 'Novela', startDate: `${YEAR}-04-01`, abandoned: true },
  { title: 'El Aleph', author: 'Jorge Luis Borges', publisher: 'Emecé', genre: 'Cuentos' },
  { title: 'Ficciones', author: 'Jorge Luis Borges', publisher: 'Emecé', genre: 'Cuentos', startDate: `${YEAR}-09-01`, totalPages: 200 },
  { title: 'Rayuela', author: 'Julio Cortázar', publisher: 'Sudamericana', genre: 'Novela', startDate: `${YEAR}-02-01`, endDate: `${YEAR}-03-01`, score: 5, wouldReread: true },
]
const FILLERS = 46 // 46 + 5 = 51 libros → 2 páginas (48 + 3)
const TOTAL = FILLERS + NAMED.length

async function books(request: APIRequestContext) {
  const res = await request.get(`${API_URL}/books`, { headers: H() })
  expect(res.ok()).toBeTruthy()
  return res.json() as Promise<Record<string, unknown>[]>
}

async function bookByTitle(request: APIRequestContext, title: string) {
  return (await books(request)).find(b => b.title === title)!
}

const cards = (page: Page) => page.getByRole('article')
const search = (page: Page) => page.getByPlaceholder('Buscar por título o autor...')

async function openLibrary(page: Page) {
  await page.goto('')
  await expect(cards(page).first()).toBeVisible()
}

test.beforeAll(async ({ request }) => {
  // Vaciar y volver a cargar (en orden: los rellenos primero, así los libros
  // con nombre son los más recientes y quedan arriba en la página 1).
  for (const b of await books(request)) {
    await request.delete(`${API_URL}/books/${b.id}`, { headers: H() })
  }
  for (let i = 1; i <= FILLERS; i++) {
    const n = String(i).padStart(2, '0')
    await request.post(`${API_URL}/books`, { headers: H(), data: { title: `Relleno ${n}`, author: 'Autor Relleno' } })
  }
  for (const b of NAMED) {
    expect((await request.post(`${API_URL}/books`, { headers: H(), data: b })).ok()).toBeTruthy()
  }
  await request.put(`${API_URL}/settings/goal`, { headers: H(), data: { count: 0, year: YEAR } })
  expect((await books(request)).length).toBe(TOTAL)
})

test.describe('búsqueda, filtros, orden y paginación', () => {
  test('paginación: 48 por página, segunda página con el resto y aria-current', async ({ page }) => {
    await openLibrary(page)
    await expect(cards(page)).toHaveCount(48)
    const nav = page.getByRole('navigation', { name: 'Paginación' })
    await expect(nav.getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
    await nav.getByRole('button', { name: 'Página 2' }).click()
    await expect(cards(page)).toHaveCount(TOTAL - 48)
    await expect(nav.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    // Buscar vuelve a la página 1
    await search(page).fill('Relleno')
    await expect(cards(page)).toHaveCount(FILLERS)
  })

  test('búsqueda por título y autor, sin distinguir mayúsculas', async ({ page }) => {
    await openLibrary(page)
    await search(page).fill('borges')
    await expect(cards(page)).toHaveCount(2)
    await search(page).fill('RAYUELA')
    await expect(cards(page)).toHaveCount(1)
    await expect(page.getByRole('article', { name: 'Rayuela' })).toBeVisible()
    await search(page).fill('cortá')
    await expect(cards(page)).toHaveCount(1)
    await search(page).fill('no existe ningún libro así')
    await expect(cards(page)).toHaveCount(0)
  })

  test('filtros por estado y favoritos (con aria-pressed)', async ({ page }) => {
    await openLibrary(page)
    const expectOnly = async (titles: string[]) => {
      await expect(cards(page)).toHaveCount(titles.length)
      for (const t of titles) await expect(page.getByRole('article', { name: t })).toBeVisible()
    }
    const filter = (name: string) => page.getByRole('button', { name, exact: true })

    await filter('Leyendo').click()
    await expect(filter('Leyendo')).toHaveAttribute('aria-pressed', 'true')
    await expectOnly(['Ficciones'])
    await filter('Leídos').click()
    await expectOnly(['Rayuela', 'Boquitas pintadas'])
    await filter('Abandonados').click()
    await expectOnly(['Zama'])
    await filter('Pendientes').click()
    await expect(cards(page)).toHaveCount(FILLERS + 1) // + El Aleph
    await filter('Todos').click()
    await page.getByRole('button', { name: '★ Favoritos' }).click()
    await expect(page.getByRole('button', { name: '★ Favoritos' })).toHaveAttribute('aria-pressed', 'true')
    await expectOnly(['Rayuela'])
  })

  test('filtros avanzados: selects con nombre accesible, combinables y removibles', async ({ page }) => {
    await openLibrary(page)
    await page.getByRole('button', { name: /^Filtros/ }).click()
    // Los selects tienen que ser alcanzables por su etiqueta visible
    const editorial = page.getByLabel('Editorial', { exact: true })
    await editorial.selectOption('Emecé')
    await expect(cards(page)).toHaveCount(2)
    await page.getByRole('button', { name: 'Pendientes', exact: true }).click()
    await expect(cards(page)).toHaveCount(1)
    await expect(page.getByRole('article', { name: 'El Aleph' })).toBeVisible()
    await page.getByRole('button', { name: 'Quitar filtro editorial' }).click()
    await expect(cards(page)).toHaveCount(FILLERS + 1)
    await page.getByLabel('Género', { exact: true }).selectOption('Novela')
    await expect(cards(page)).toHaveCount(0) // ninguna novela pendiente
    await page.getByRole('button', { name: 'Todos', exact: true }).click()
    await expect(cards(page)).toHaveCount(3)
    await expect(page.getByLabel('Autor/a', { exact: true })).toBeVisible()
  })

  test('orden: A→Z, Z→A y mejor puntaje', async ({ page }) => {
    await openLibrary(page)
    const sort = page.getByRole('combobox', { name: 'Ordenar' })
    await sort.selectOption({ label: 'A → Z' })
    await expect(cards(page).first()).toHaveAccessibleName('Boquitas pintadas')
    await sort.selectOption({ label: 'Z → A' })
    await expect(cards(page).first()).toHaveAccessibleName('Zama')
    await sort.selectOption({ label: 'Mejor puntaje' })
    await expect(cards(page).first()).toHaveAccessibleName('Rayuela')
  })
})

test.describe('estadísticas y meta anual', () => {
  test('los números coinciden con los libros cargados y la meta persiste', async ({ page, request }) => {
    await openLibrary(page)
    await page.getByRole('button', { name: 'Estadísticas' }).click()
    const dialog = page.getByRole('dialog', { name: 'Estadísticas' })
    const resumen = dialog.getByRole('region', { name: 'Resumen' })
    const num = (label: string) => resumen.getByText(label, { exact: true }).locator('xpath=preceding-sibling::*[1]')

    await expect(num('Total')).toHaveText(String(TOTAL))
    await expect(num('Leídos')).toHaveText('2')
    // Zama está abandonado: no cuenta como "leyendo" (igual que el filtro Leyendo)
    await expect(num('Leyendo')).toHaveText('1')
    await expect(num('Pendientes')).toHaveText(String(FILLERS + 1))

    // Meta: 12 libros, 1 leído este año (Rayuela; Boquitas es del año pasado)
    await dialog.getByRole('button', { name: 'Definir meta' }).click()
    await dialog.getByLabel('Cantidad de libros como meta anual').fill('12')
    await dialog.getByRole('button', { name: 'Guardar' }).click()
    await expect(dialog.getByText(`1 de 12 libros leídos este año`)).toBeVisible()
    await expect(dialog.getByRole('progressbar', { name: 'Progreso de meta anual' })).toHaveAttribute('aria-valuenow', '8')

    // Se guarda en el servidor (con debounce) y sobrevive a recargar
    await expect.poll(async () => (await (await request.get(`${API_URL}/settings/goal`, { headers: H() })).json()).count).toBe(12)
    await page.reload()
    await page.getByRole('button', { name: 'Estadísticas' }).click()
    await expect(page.getByRole('dialog', { name: 'Estadísticas' }).getByText('1 de 12 libros leídos este año')).toBeVisible()
  })
})

test.describe('alta y edición', () => {
  test('editar estado, fechas, puntaje, nota y "lo volvería a leer" persiste tras recargar', async ({ page, request }) => {
    await openLibrary(page)
    const card = page.getByRole('article', { name: 'Ficciones' })
    await card.click()
    await card.getByRole('button', { name: 'Editar' }).click()
    const dialog = page.getByRole('dialog')

    // Las fechas guardadas se ven en los campos al editar
    await expect(dialog.locator('#startDate')).toHaveValue(`${YEAR}-09-01`)
    await expect(dialog.getByRole('button', { name: 'Leyendo', exact: true })).toHaveAttribute('aria-pressed', 'true')

    await dialog.locator('#endDate').fill(`${YEAR}-10-01`)
    await expect(dialog.getByRole('button', { name: 'Leído', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await dialog.getByRole('button', { name: '4 estrellas' }).click()
    await dialog.locator('#notes').fill('Releer "Tlön, Uqbar, Orbis Tertius".')
    await dialog.getByRole('switch', { name: '¿Lo volvería a leer?' }).click()
    await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(dialog).toBeHidden()

    const saved = await bookByTitle(request, 'Ficciones')
    expect(saved.startDate).toBe(`${YEAR}-09-01`)
    expect(saved.endDate).toBe(`${YEAR}-10-01`)
    expect(saved.score).toBe(4)
    expect(saved.notes).toBe('Releer "Tlön, Uqbar, Orbis Tertius".')
    expect(saved.wouldReread).toBe(true)

    await page.reload()
    await page.getByRole('button', { name: 'Leídos', exact: true }).click()
    await expect(page.getByRole('article', { name: 'Ficciones' })).toBeVisible()
    await page.getByRole('article', { name: 'Ficciones' }).click()
    await page.getByRole('article', { name: 'Ficciones' }).getByRole('button', { name: 'Editar' }).click()
    await expect(page.getByRole('dialog').locator('#endDate')).toHaveValue(`${YEAR}-10-01`)
  })

  test('validación: sin título ni autor no se guarda, el error se anuncia y el foco va al campo', async ({ page, request }) => {
    await openLibrary(page)
    await page.getByRole('button', { name: 'Agregar', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Agregar libro' }).click()

    await expect(dialog.getByRole('alert').filter({ hasText: 'El título es obligatorio' })).toBeVisible()
    await expect(dialog.getByRole('alert').filter({ hasText: 'El autor es obligatorio' })).toBeVisible()
    const title = dialog.locator('#title')
    await expect(title).toHaveAttribute('aria-invalid', 'true')
    await expect(title).toHaveAccessibleDescription('El título es obligatorio')
    await expect(title).toBeFocused()

    await title.fill('Solo título')
    await dialog.getByRole('button', { name: 'Agregar libro' }).click()
    const author = dialog.locator('#author')
    await expect(author).toHaveAttribute('aria-invalid', 'true')
    await expect(author).toBeFocused()
    await expect(title).not.toHaveAttribute('aria-invalid', 'true')

    await expect(dialog).toBeVisible()
    expect((await books(request)).length).toBe(TOTAL)
  })

  test.describe('"Hoy" usa la fecha local, no la UTC', () => {
    test.use({ timezoneId: 'America/Argentina/Buenos_Aires' })

    test('a las 23:30 en Argentina, "Hoy" es el mismo día', async ({ page }) => {
      // 23:30 del 22/10 en Argentina = 02:30 del 23/10 en UTC
      await page.clock.setFixedTime(new Date('2026-10-22T23:30:00-03:00'))
      await openLibrary(page)
      await page.getByRole('button', { name: 'Agregar', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('button', { name: /Hoy.*inicio/i }).click()
      await expect(dialog.locator('#startDate')).toHaveValue('2026-10-22')
      await dialog.getByRole('button', { name: 'Leído', exact: true }).click()
      await expect(dialog.locator('#endDate')).toHaveValue('2026-10-22')
    })
  })

  // El alta desde los resultados de Open Library ("Leído" / "Pendiente") está en
  // search-quick-add.spec.ts.

  test('ISBN ingresado a mano: completa los datos; si no existe, lo avisa', async ({ page }) => {
    await page.route('https://openlibrary.org/search.json**', route => {
      const isbn = new URL(route.request().url()).searchParams.get('isbn')
      return route.fulfill({ json: { docs: isbn === '9788437604947' ? [
        { key: '/works/OL3W', title: 'Cien años de soledad', author_name: ['Gabriel García Márquez'], publisher: ['Cátedra'], first_publish_year: 1967 },
      ] : [] } })
    })
    await openLibrary(page)
    await page.getByRole('button', { name: 'Agregar', exact: true }).click()
    const dialog = page.getByRole('dialog')
    const isbn = dialog.getByRole('textbox', { name: 'ISBN' })

    await isbn.fill('978-84-376-0494-7') // con guiones, como viene impreso
    await isbn.press('Enter')
    await expect(dialog.locator('#title')).toHaveValue('Cien años de soledad')
    await expect(dialog.locator('#author')).toHaveValue('Gabriel García Márquez')

    await isbn.fill('9780000000000')
    await dialog.getByRole('button', { name: 'Buscar', exact: true }).click()
    await expect(dialog.getByRole('alert').filter({ hasText: 'ISBN no encontrado' })).toBeVisible()
  })
})
