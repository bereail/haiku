import { execFileSync } from 'node:child_process'
import { test, expect, type Page } from '@playwright/test'
import { API_URL, BASE_URL, bearer, storageStatePath } from './accounts'
import { mockOpenLibrary } from './openlibrary-mock'
import { expectNoViolations } from './axe'

// Escaneo automático con axe-core (WCAG 2.0/2.1/2.2, niveles A y AA) de las
// pantallas principales y de los modales abiertos. Evita que reaparezcan los
// hallazgos ya corregidos (contraste, landmarks, nombres accesibles).
// axe no reemplaza una revisión manual: detecta ~30-50% de los problemas.

const TITLE = `Axe E2E ${Date.now()}`
let bookId: string


function localObraId(): string {
  // Una obra en el catálogo de la base LOCAL (contenedor librook-pg) para poder
  // escanear la página de obra. Idempotente.
  const sql = `
    INSERT INTO obras (canonical_title, first_publish_year, source)
    SELECT 'Obra E2E accesibilidad', 1963, 'manual'
    WHERE NOT EXISTS (SELECT 1 FROM obras WHERE canonical_title = 'Obra E2E accesibilidad');
    SELECT id FROM obras WHERE canonical_title = 'Obra E2E accesibilidad';`
  const out = execFileSync('docker', ['exec', 'librook-pg', 'psql', '-U', 'librook_user', '-d', 'librook_db', '-tAc', sql])
  return out.toString().trim().split('\n').pop()!.trim()
}

test.describe('axe-core: sin sesión', () => {
  test('login', async ({ page }) => {
    await page.goto(BASE_URL)
    await expect(page.locator('#email')).toBeVisible()
    await expectNoViolations(page, 'Login')
  })

  test('registro y recuperar contraseña', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.getByRole('button', { name: 'Olvidé mi contraseña' }).click()
    await expect(page.getByRole('button', { name: 'Enviar enlace' })).toBeVisible()
    await expectNoViolations(page, 'Recuperar contraseña')
  })

  test('página de nueva contraseña (link de reset)', async ({ page }) => {
    await page.goto(`${BASE_URL}?reset_token=${'0'.repeat(64)}`)
    await expect(page.getByRole('heading', { name: 'Nueva contraseña' })).toBeVisible()
    await expectNoViolations(page, 'Nueva contraseña')
  })

  test('catálogo público con búsqueda', async ({ page }) => {
    // Resultados deterministas en las dos secciones: una obra local (base
    // local) y, como hay menos de 3 locales, los de Open Library simulados.
    localObraId()
    await mockOpenLibrary(page)
    await page.goto('catalog')
    await expect(page.getByRole('heading', { name: 'Catálogo público' })).toBeVisible()
    await page.getByPlaceholder('Buscar por título...').fill('Obra E2E')
    await expect(page.getByRole('heading', { name: 'En Librook', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /Obra E2E accesibilidad/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /También en Open Library/ })).toBeVisible()
    await expect(page.getByText('Rayuela (simulado)')).toBeVisible()
    await expect(page.getByText('Ficciones (simulado)')).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Buscando…' })).toHaveCount(0)
    await expectNoViolations(page, 'Catálogo')
  })

  test('página de obra', async ({ page }) => {
    await page.goto(`catalog/obra/${localObraId()}`)
    await expect(page.getByRole('heading', { name: 'Obra E2E accesibilidad' })).toBeVisible()
    await expectNoViolations(page, 'Obra')
  })
})

test.describe('axe-core: biblioteca', () => {
  test.use({ storageState: storageStatePath('lectora1') })

  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${API_URL}/books`, {
      headers: bearer('lectora1'),
      data: { title: TITLE, author: 'Autora Axe', notes: 'nota', score: 4, startDate: '2026-01-01', endDate: '2026-02-01' },
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

  test('biblioteca (tema claro)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await expectNoViolations(page, 'Biblioteca clara')
  })

  test('biblioteca (tema oscuro)', async ({ page }) => {
    await page.getByRole('button', { name: /modo oscuro/i }).click()
    await expect(page.getByRole('button', { name: /modo claro/i })).toBeVisible()
    await expectNoViolations(page, 'Biblioteca oscura')
    await page.getByRole('button', { name: /modo claro/i }).click()
  })

  test('biblioteca en celular (390×844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('button', { name: 'Agregar libro', exact: true })).toBeVisible()
    await expectNoViolations(page, 'Biblioteca mobile')
  })

  test('tema oscuro: modal de alta con hover en el botón principal', async ({ page }) => {
    // Los botones primarios cambian a --color-accent-light en hover: en oscuro
    // el texto blanco quedaba en 2.7:1 (ahora --color-on-accent-light).
    await page.getByRole('button', { name: /modo oscuro/i }).click()
    await page.getByRole('button', { name: 'Agregar', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Agregar libro' }).hover()
    await expectNoViolations(page, 'Alta oscura con hover', '[role="dialog"]')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /modo claro/i }).click()
  })

  test('tarjeta dada vuelta', async ({ page }) => {
    await page.getByRole('article', { name: TITLE }).click()
    await expectNoViolations(page, 'Tarjeta (dorso)')
  })

  for (const [label, open] of [
    ['modal de alta', (p: Page) => p.getByRole('button', { name: 'Agregar', exact: true }).click()],
    ['modal de búsqueda', (p: Page) => p.getByRole('button', { name: 'Buscar en Open Library' }).click()],
    ['modal de estadísticas', (p: Page) => p.getByRole('button', { name: 'Estadísticas' }).click()],
    ['modal de comunidad', (p: Page) => p.getByRole('button', { name: 'Comunidad' }).click()],
  ] as const) {
    test(label, async ({ page }) => {
      await open(page)
      await expect(page.getByRole('dialog')).toBeVisible()
      // Contenido cargado (comunidad trae publicaciones del servidor)
      await expect(page.getByRole('dialog').getByRole('status').filter({ hasText: /Cargando/ })).toHaveCount(0)
      await expectNoViolations(page, label, '[role="dialog"]')
    })
  }

  test('modal de detalle', async ({ page }) => {
    const card = page.getByRole('article', { name: TITLE })
    await card.click()
    await card.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectNoViolations(page, 'Detalle', '[role="dialog"]')
  })
})

test.describe('axe-core: admin', () => {
  test.use({ storageState: storageStatePath('admin') })

  test('panel admin: analíticas y usuarios', async ({ page }) => {
    await page.goto('')
    await page.getByRole('button', { name: 'Panel admin' }).first().click()
    await expect(page.getByRole('heading', { name: 'Panel Admin' })).toBeVisible()
    await expect(page.getByText('Cargando analíticas…')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Visitas por hora — hoy' })).toBeVisible()
    await expectNoViolations(page, 'Admin – analíticas')
    await page.getByRole('tab', { name: /^Usuarios/ }).click()
    const panel = page.getByRole('tabpanel', { name: /^Usuarios/ })
    await expect(panel.getByRole('status')).toHaveCount(0)
    await expect(panel.getByRole('button', { name: /admin@test\.dev/ })).toBeVisible()
    await expectNoViolations(page, 'Admin – usuarios')
  })
})
