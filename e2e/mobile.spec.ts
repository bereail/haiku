import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { API_URL, BASE_URL, bearer, storageStatePath } from './accounts'
import { mockOpenLibrary } from './openlibrary-mock'

// Celular: sin scroll horizontal en las páginas principales ni con los modales
// abiertos, modales dentro de la pantalla, y botones flotantes funcionales.

const VIEWPORTS = [
  { name: '390×844', width: 390, height: 844 },
  { name: '360×640', width: 360, height: 640 },
]

async function expectNoHorizontalScroll(page: Page, label: string) {
  // El ancho depende del contenido cargado y de las fuentes: se espera eso
  // explícitamente (sin networkidle, que dependía de cualquier pedido externo).
  await expect(page.getByRole('status').filter({ hasText: /Cargando|Buscando/ })).toHaveCount(0)
  await page.evaluate(() => document.fonts.ready)
  const { scroll, client, culprits } = await page.evaluate(() => {
    const root = document.documentElement
    const vw = root.clientWidth
    // Para el mensaje de error: elementos que se salen por la derecha
    const culprits = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter(el => el.getBoundingClientRect().right > vw + 1 && getComputedStyle(el).position !== 'fixed')
      .slice(0, 5)
      .map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} (${Math.round(el.getBoundingClientRect().right)}px)`)
    return { scroll: root.scrollWidth, client: vw, culprits }
  })
  expect(scroll, `${label}: scroll horizontal (${scroll} > ${client}). Se salen: ${culprits.join(', ')}`).toBeLessThanOrEqual(client)
}

async function expectDialogInsideViewport(page: Page, label: string) {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const box = (await dialog.boundingBox())!
  const vw = page.viewportSize()!.width
  expect(box.x, `${label}: el modal empieza fuera de la pantalla`).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width, `${label}: el modal se sale por la derecha`).toBeLessThanOrEqual(vw + 1)
}

function localObraId(): string {
  const sql = `
    INSERT INTO obras (canonical_title, first_publish_year, source)
    SELECT 'Obra E2E accesibilidad', 1963, 'manual'
    WHERE NOT EXISTS (SELECT 1 FROM obras WHERE canonical_title = 'Obra E2E accesibilidad');
    SELECT id FROM obras WHERE canonical_title = 'Obra E2E accesibilidad';`
  const out = execFileSync('docker', ['exec', 'librook-pg', 'psql', '-U', 'librook_user', '-d', 'librook_db', '-tAc', sql])
  return out.toString().trim().split('\n').pop()!.trim()
}

for (const vp of VIEWPORTS) {
  test.describe(`celular ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true })

    test('login, catálogo y obra sin scroll horizontal', async ({ page }) => {
      await mockOpenLibrary(page)
      await page.goto(BASE_URL)
      await expect(page.locator('#email')).toBeVisible()
      await expectNoHorizontalScroll(page, 'Login')
      await page.goto('catalog')
      const obraId = localObraId()
      await page.getByPlaceholder('Buscar por título...').fill('Obra E2E')
      // Con resultados en las dos secciones (local + Open Library simulado)
      await expect(page.getByRole('heading', { name: 'En Librook', exact: true })).toBeVisible()
      await expect(page.getByText('Rayuela (simulado)')).toBeVisible()
      await expectNoHorizontalScroll(page, 'Catálogo')
      await page.goto(`catalog/obra/${obraId}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expectNoHorizontalScroll(page, 'Obra')
    })

    test.describe('con sesión', () => {
      test.use({ storageState: storageStatePath('lectora3') })

      test('biblioteca y filtros avanzados sin scroll horizontal', async ({ page }) => {
        await page.goto('')
        await expect(page.getByRole('article').first()).toBeVisible()
        await expectNoHorizontalScroll(page, 'Biblioteca')
        await page.getByRole('button', { name: /^Filtros/ }).click()
        await expectNoHorizontalScroll(page, 'Biblioteca con filtros')
        await page.getByRole('navigation', { name: 'Paginación' }).scrollIntoViewIfNeeded()
        await expectNoHorizontalScroll(page, 'Paginación')
      })

      test('el botón flotante "Agregar libro" abre el alta, que entra en pantalla', async ({ page }) => {
        await page.goto('')
        const fab = page.getByRole('button', { name: 'Agregar libro', exact: true })
        await expect(fab).toBeVisible()
        await fab.tap()
        await expectDialogInsideViewport(page, 'Alta')
        await expectNoHorizontalScroll(page, 'Alta abierta')
        await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).tap()
        await expect(page.getByRole('dialog')).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Registrar lectura por voz', exact: true })).toBeVisible()
      })

      for (const [label, name] of [['Estadísticas', 'Estadísticas'], ['Comunidad', 'Comunidad'], ['Búsqueda', 'Buscar en Open Library']] as const) {
        test(`modal de ${label} dentro de la pantalla`, async ({ page }) => {
          await page.goto('')
          // En celular algunas acciones del encabezado pasan al menú "Más opciones"
          const direct = page.getByRole('button', { name, exact: true })
          if (await direct.isVisible()) {
            await direct.tap()
          } else {
            await page.getByRole('button', { name: 'Más opciones' }).tap()
            await page.getByRole('menuitem', { name, exact: true }).tap()
          }
          await expectDialogInsideViewport(page, label)
          await expectNoHorizontalScroll(page, `${label} abierto`)
        })
      }

      test('menú "Más opciones" accesible con teclado (patrón WAI-ARIA de menú)', async ({ page }) => {
        await page.goto('')
        const trigger = page.getByRole('button', { name: 'Más opciones' })
        await expect(trigger).toBeVisible()
        await trigger.focus()
        await page.keyboard.press('Enter')
        await expect(trigger).toHaveAttribute('aria-expanded', 'true')
        const items = page.getByRole('menu').getByRole('menuitem')
        // Al abrir, el foco va al primer ítem; las flechas recorren y dan la vuelta
        await expect(items.first()).toBeFocused()
        await page.keyboard.press('ArrowDown')
        await expect(items.nth(1)).toBeFocused()
        await page.keyboard.press('End')
        await expect(items.last()).toBeFocused()
        await page.keyboard.press('ArrowDown')
        await expect(items.first()).toBeFocused()
        await page.keyboard.press('ArrowUp')
        await expect(items.last()).toBeFocused()
        await page.keyboard.press('Home')
        await expect(items.first()).toBeFocused()
        // Escape cierra y devuelve el foco al botón
        await page.keyboard.press('Escape')
        await expect(page.getByRole('menu')).toHaveCount(0)
        await expect(trigger).toBeFocused()
        await expect(trigger).toHaveAttribute('aria-expanded', 'false')
        // Activar un ítem con Enter
        await page.keyboard.press('Enter')
        await page.getByRole('menuitem', { name: 'Estadísticas' }).focus()
        await page.keyboard.press('Enter')
        await expect(page.getByRole('dialog', { name: 'Estadísticas' })).toBeVisible()
        // Al cerrar el modal, el foco vuelve al botón del menú (no se pierde)
        await page.keyboard.press('Escape')
        await expect(trigger).toBeFocused()
      })

      test('detalle de un libro dentro de la pantalla', async ({ page }) => {
        await page.goto('')
        const card = page.getByRole('article', { name: 'Rayuela' })
        await card.tap()
        await card.tap()
        await expectDialogInsideViewport(page, 'Detalle')
        await expectNoHorizontalScroll(page, 'Detalle abierto')
      })
    })
  })
}

// Menú "Más opciones" con la cuenta admin (tiene los ítems Exportar/Importar
// JSON). El menú se muestra por debajo de 900px: se prueba en celular y tablet.
const MENU_VIEWPORTS = [...VIEWPORTS, { name: '768×1024', width: 768, height: 1024 }]

async function openLoadedLibrary(page: Page) {
  await page.goto('')
  // Esperar a que termine la carga inicial: antes de eso el orden de foco y la
  // lista de libros todavía cambian.
  await expect(page.getByPlaceholder('Buscar por título o autor...')).toBeVisible()
  await expect(page.getByText('Cargando tu biblioteca…')).toHaveCount(0)
}

for (const vp of MENU_VIEWPORTS) {
  test.describe(`menú ${vp.name} — admin`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true, storageState: storageStatePath('admin') })
    // Título único por corrida y tamaño; la limpieza borra solo estos libros.
    const TITLE = `Menú E2E ${vp.name} ${Date.now()}`

    test.afterEach(async ({ request }) => {
      const list = await (await request.get(`${API_URL}/books`, { headers: bearer('admin') })).json()
      for (const b of list.filter((x: { title: string }) => x.title === TITLE)) {
        await request.delete(`${API_URL}/books/${b.id}`, { headers: bearer('admin') })
      }
    })

    test('Tab desde el menú cierra y sigue el orden normal (no se saltea elementos)', async ({ page }) => {
      await openLoadedLibrary(page)
      const trigger = page.getByRole('button', { name: 'Más opciones' })
      // Destino natural: el elemento que sigue al botón con el menú cerrado. Se
      // marca para comparar identidad (no solo el HTML).
      await trigger.focus()
      await page.keyboard.press('Tab')
      const natural = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return null
        el.setAttribute('data-e2e-natural', '1')
        return el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.textContent?.trim()
      })
      expect(natural, 'después del botón tiene que haber un elemento enfocable').toBeTruthy()

      await trigger.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('menuitem').first()).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(page.getByRole('menu')).toHaveCount(0)
      await expect(page.locator('[data-e2e-natural="1"]')).toBeFocused()
    })

    test('"Exportar JSON" desde el menú descarga el backup con los libros', async ({ page, request }) => {
      await request.post(`${API_URL}/books`, { headers: bearer('admin'), data: { title: TITLE, author: 'Autora Export' } })
      await openLoadedLibrary(page)
      const trigger = page.getByRole('button', { name: 'Más opciones' })
      await trigger.focus()
      await page.keyboard.press('Enter')
      await page.getByRole('menuitem', { name: 'Exportar JSON' }).focus()
      const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')])
      expect(download.suggestedFilename()).toMatch(/^librook-backup-\d{4}-\d{2}-\d{2}\.json$/)
      const backup = JSON.parse(fs.readFileSync((await download.path())!, 'utf8'))
      expect(backup.version).toBe(1)
      expect(backup.books.some((b: { title: string }) => b.title === TITLE)).toBe(true)
      await expect(page.getByRole('menu')).toHaveCount(0)
      await expect(trigger).toBeFocused()
    })

    test('"Importar JSON" desde el menú: importa, cierra el menú y el foco vuelve al botón', async ({ page, request }) => {
      await openLoadedLibrary(page)
      const trigger = page.getByRole('button', { name: 'Más opciones' })
      await trigger.focus()
      await page.keyboard.press('Enter')
      await page.getByRole('menuitem', { name: 'Importar JSON' }).focus()
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')])
      await expect(page.getByRole('menu')).toHaveCount(0)
      await expect(trigger).toBeFocused()

      await chooser.setFiles({
        name: 'backup.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ books: [{ title: TITLE, author: 'Autora Import' }] })),
      })
      await expect(page.getByText('Se importaron 1 libros correctamente.')).toBeVisible()
      await expect(page.getByRole('article', { name: TITLE })).toBeVisible()
      const list = await (await request.get(`${API_URL}/books`, { headers: bearer('admin') })).json()
      expect(list.filter((x: { title: string }) => x.title === TITLE)).toHaveLength(1)
      await expect(trigger).toBeFocused()
    })
  })
}
