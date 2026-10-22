import { test, expect, type Locator, type Page } from '@playwright/test'
import { API_URL, bearer, storageStatePath } from './accounts'

// Regresión del patrón de diálogo accesible (WAI-ARIA Dialog) en todos los
// modales: al abrir con teclado el foco entra, Tab y Shift+Tab no se escapan,
// Escape cierra y el foco vuelve al control que lo abrió.

const TITLE = `Foco E2E ${Date.now()}`
let bookId: string

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

async function focusIsInside(dialog: Locator) {
  return dialog.evaluate(d => d.contains(document.activeElement))
}

async function expectAccessibleDialog(page: Page, trigger: Locator, dialog: Locator) {
  // Abrir con teclado, como lo haría alguien que no usa mouse
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(dialog).toBeVisible()

  // 1. El foco entra al diálogo
  await expect.poll(() => focusIsInside(dialog), { message: 'el foco entra al diálogo' }).toBe(true)

  // 2. Tab / Shift+Tab dan la vuelta completa sin escaparse
  const n = await dialog.evaluate((d, sel) => d.querySelectorAll(sel).length, FOCUSABLE)
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let i = 0; i < n + 2; i++) {
      await page.keyboard.press(key)
      expect(await focusIsInside(dialog), `${key} #${i + 1} se escapó del diálogo`).toBe(true)
    }
  }

  // 3. Escape cierra y 4. el foco vuelve al disparador
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
}

test.describe('Accesibilidad de modales y atajos', () => {
  test.use({ storageState: storageStatePath('lectora1') })

  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${API_URL}/books`, {
      headers: bearer('lectora1'),
      data: { title: TITLE, author: 'Autora Foco', notes: 'nota' },
    })
    bookId = (await res.json()).id
  })

  test.afterAll(async ({ request }) => {
    await request.delete(`${API_URL}/books/${bookId}`, { headers: bearer('lectora1') })
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('')
    await expect(page.getByRole('article', { name: TITLE })).toBeVisible()
  })

  const dialog = (page: Page) => page.getByRole('dialog')

  test('alta de libro', async ({ page }) => {
    await expectAccessibleDialog(page, page.getByRole('button', { name: 'Agregar', exact: true }), dialog(page))
  })

  test('búsqueda en Open Library', async ({ page }) => {
    await expectAccessibleDialog(page, page.getByRole('button', { name: 'Buscar en Open Library' }), dialog(page))
  })

  test('estadísticas', async ({ page }) => {
    await expectAccessibleDialog(page, page.getByRole('button', { name: 'Estadísticas' }), dialog(page))
  })

  test('comunidad', async ({ page }) => {
    await expectAccessibleDialog(page, page.getByRole('button', { name: 'Comunidad' }), dialog(page))
  })

  test('registro por voz', async ({ page }) => {
    await expectAccessibleDialog(page, page.getByRole('button', { name: 'Registrar lectura por voz' }), dialog(page))
  })

  test('detalle del libro (desde la tarjeta, con teclado)', async ({ page }) => {
    const card = page.getByRole('article', { name: TITLE })
    await card.focus()
    await page.keyboard.press('Enter') // da vuelta la tarjeta
    await expect(card).toHaveAttribute('aria-expanded', 'true')
    await expectAccessibleDialog(page, card, dialog(page))
  })

  test('edición (desde el dorso de la tarjeta)', async ({ page }) => {
    const card = page.getByRole('article', { name: TITLE })
    await card.click()
    await expectAccessibleDialog(page, card.getByRole('button', { name: 'Editar' }), dialog(page))
  })

  test('escáner de ISBN dentro del alta: foco contenido, Escape y vuelta al botón', async ({ page }) => {
    await page.getByRole('button', { name: 'Agregar', exact: true }).click()
    const bookDialog = dialog(page).first()
    await expect(bookDialog).toBeVisible()
    const scanBtn = bookDialog.getByRole('button', { name: /Escanear ISBN/ })
    await scanBtn.focus()
    await page.keyboard.press('Enter')

    const scanner = page.getByRole('dialog', { name: /escanear|isbn|código/i })
    await expect(scanner).toBeVisible()
    await expect.poll(() => focusIsInside(scanner)).toBe(true)
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      expect(await focusIsInside(scanner), `Tab #${i + 1} se escapó del escáner`).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(scanner).toBeHidden()
    // Escape cierra solo el escáner, no el alta que está debajo
    await expect(bookDialog).toBeVisible()
    await expect(scanBtn).toBeFocused()
  })

  test.describe('atajos de teclado', () => {
    for (const [key, name] of [['n', /agregar|nuevo libro/i], ['b', /buscar/i], ['e', /estad/i]] as const) {
      test(`"${key}" abre su diálogo y Escape lo cierra`, async ({ page }) => {
        await page.locator('body').focus()
        await page.keyboard.press(key)
        await expect(dialog(page)).toBeVisible()
        await expect(dialog(page)).toHaveAccessibleName(name)
        await page.keyboard.press('Escape')
        await expect(dialog(page)).toHaveCount(0)
      })
    }

    test('escribir en el buscador no dispara atajos', async ({ page }) => {
      await page.getByPlaceholder('Buscar por título o autor...').fill('')
      await page.getByPlaceholder('Buscar por título o autor...').pressSequentially('nbev')
      await expect(dialog(page)).toHaveCount(0)
      await expect(page.getByPlaceholder('Buscar por título o autor...')).toHaveValue('nbev')
    })

    test('con un diálogo abierto, los atajos no abren otro encima', async ({ page }) => {
      await page.getByRole('button', { name: 'Estadísticas' }).click()
      await expect(dialog(page)).toHaveCount(1)
      // Foco en un botón del diálogo (no en un campo de texto)
      await expect.poll(() => focusIsInside(dialog(page))).toBe(true)
      for (const key of ['n', 'b', 'v']) await page.keyboard.press(key)
      await expect(dialog(page)).toHaveCount(1)
      await expect(dialog(page)).toHaveAccessibleName(/estad/i)
    })
  })
})
