import AxeBuilder from '@axe-core/playwright'
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { API_URL, E2E_ORIGIN, bearer, storageStatePath, type AccountName } from './accounts'

// Interfaz del Mercado de libros: publicar con foto real, validaciones, permisos,
// descartar fotos al cancelar, pausar/eliminar, accesibilidad (axe, foco) y celular.

test.describe.configure({ mode: 'serial' })
const RUN = Date.now()
const TITLE = `Rayuela UI ${RUN}`

async function realJpeg(page: Page, w = 900, h = 700): Promise<Buffer> {
  const b64 = await page.evaluate(([w, h]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#5c3d1e'; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#fff'; ctx.font = '60px serif'; ctx.fillText('Tapa', 50, 140)
    return c.toDataURL('image/jpeg', 0.85).split(',')[1]
  }, [w, h])
  return Buffer.from(b64, 'base64')
}

async function openMarketplace(page: Page) {
  await page.goto('')
  await expect(page.getByText('Cargando tu biblioteca…')).toHaveCount(0)
  await page.getByRole('button', { name: 'Mercado de libros' }).click()
  const dialog = page.getByRole('dialog', { name: 'Mercado de libros' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Cargando…')).toHaveCount(0)
  return dialog
}

async function myListings(request: APIRequestContext, who: AccountName) {
  return (await (await request.get(`${API_URL}/marketplace/listings?mine=1`, { headers: bearer(who) })).json()).listings as { id: string; bookTitle: string; status: string; photos: { url: string }[] }[]
}

test.afterAll(async ({ request }) => {
  for (const who of ['lectora1', 'lectora2'] as AccountName[]) {
    for (const l of await myListings(request, who)) {
      if (l.bookTitle.includes(String(RUN))) await request.delete(`${API_URL}/marketplace/listings/${l.id}`, { headers: bearer(who) })
    }
  }
})

test.describe('lectora1', () => {
  test.use({ storageState: storageStatePath('lectora1') })

  test('validación: sin título no se publica, el error se anuncia y el foco va al campo', async ({ page }) => {
    const dialog = await openMarketplace(page)
    await dialog.getByRole('button', { name: 'Publicar un libro' }).click()
    await dialog.getByRole('button', { name: 'Publicar', exact: true }).click()
    await expect(dialog.getByRole('alert')).toHaveText('El título del libro es obligatorio')
    await expect(dialog.getByLabel('Título del libro *')).toBeFocused()
    await dialog.getByLabel('Título del libro *').fill('Algo')
    await dialog.getByRole('button', { name: 'Publicar', exact: true }).click()
    await expect(dialog.getByRole('alert')).toHaveText('Una venta necesita un precio')
    await expect(dialog.getByLabel('Precio (ARS) *')).toBeFocused()
  })

  test('una foto grande se reduce antes de subir; cancelar la descarta del servidor', async ({ page, request }) => {
    const dialog = await openMarketplace(page)
    await dialog.getByRole('button', { name: 'Publicar un libro' }).click()
    const uploaded = page.waitForResponse(r => r.url().endsWith('/librook-api/uploads') && r.request().method() === 'POST')
    // Foto grande: el navegador la reduce a 1600 px de lado mayor antes de subirla
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'tapa.jpg', mimeType: 'image/jpeg', buffer: await realJpeg(page, 3000, 2000) })
    const { url, width, height, bytes } = await (await uploaded).json()
    expect([width, height]).toEqual([1600, 1067])
    expect(bytes).toBeLessThan(900 * 1024)
    await expect(dialog.getByRole('img', { name: 'Foto 1' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect.poll(async () => (await request.get(`${E2E_ORIGIN}${url}`)).status()).toBe(404)
  })

  test('publicar una venta con foto: aparece en la lista con precio y foto', async ({ page, request }) => {
    const dialog = await openMarketplace(page)
    await dialog.getByRole('button', { name: 'Publicar un libro' }).click()
    await dialog.getByLabel('Título del libro *').fill(TITLE)
    await dialog.getByLabel('Autor/a').fill('Julio Cortázar')
    await dialog.getByLabel('Estado del libro').selectOption('muy_bueno')
    await dialog.getByLabel('Precio (ARS) *').fill('15000')
    await dialog.getByLabel('Ciudad o barrio').fill('Palermo')
    await dialog.getByLabel('Contacto').fill('Por mensaje privado')
    await expect(dialog.getByLabel('Contacto')).toHaveAccessibleDescription(/Lo ven todas las personas con cuenta/)

    await dialog.locator('input[type="file"]').setInputFiles({ name: 'tapa.jpg', mimeType: 'image/jpeg', buffer: await realJpeg(page) })
    await expect(dialog.getByRole('img', { name: 'Foto 1' })).toBeVisible()
    await expect(dialog.getByText('Fotos (1/4)')).toBeVisible()
    await dialog.getByRole('button', { name: 'Publicar', exact: true }).click()
    await expect(page.getByText('Publicación creada')).toBeVisible()

    const card = dialog.getByRole('article', { name: TITLE })
    await expect(card).toBeVisible()
    await expect(card).toContainText(/\$\s?15\.000/)
    await expect(card).toContainText('Muy bueno')
    await expect(card).toContainText('Vos')
    const img = card.getByRole('img', { name: `Foto 1 de ${TITLE}` })
    await expect(img).toBeVisible()
    expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)

    // La foto quedó reducida en el navegador (lado mayor ≤ 1600) y guardada en el servidor
    const [mine] = (await myListings(request, 'lectora1')).filter(l => l.bookTitle === TITLE)
    expect(mine.photos).toHaveLength(1)
  })

  test('axe: lista y formulario, en claro y en oscuro', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      const dialog = await openMarketplace(page)
      await expect(dialog.getByRole('article', { name: TITLE })).toBeVisible()
      for (const step of ['lista', 'formulario']) {
        if (step === 'formulario') await dialog.getByRole('button', { name: 'Publicar un libro' }).click()
        await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity))
        const { violations } = await new AxeBuilder({ page }).include('[role="dialog"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
        expect(violations.map(v => `${scheme}/${step} ${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([])
      }
    }
  })

  test('foco accesible: se abre con teclado, Escape cierra y vuelve al botón', async ({ page }) => {
    await page.goto('')
    await expect(page.getByText('Cargando tu biblioteca…')).toHaveCount(0)
    const trigger = page.getByRole('button', { name: 'Mercado de libros' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Mercado de libros' })
    await expect.poll(() => dialog.evaluate(d => d.contains(document.activeElement))).toBe(true)
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate(d => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })
})

test.describe('lectora2 (otra usuaria)', () => {
  test.use({ storageState: storageStatePath('lectora2') })

  test('ve la publicación con alias y contacto, sin botones de edición', async ({ page }) => {
    const dialog = await openMarketplace(page)
    await dialog.getByLabel('Buscar por título o autor').fill(String(RUN))
    const card = dialog.getByRole('article', { name: TITLE })
    await expect(card).toBeVisible()
    await expect(card).toContainText(/Lector\/a [0-9A-F]{4}/)
    await expect(card).toContainText('Por mensaje privado')
    await expect(card.getByRole('button')).toHaveCount(0)
  })
})

test.describe('lectora1 — pausar y eliminar', () => {
  test.use({ storageState: storageStatePath('lectora1') })

  test('pausar la oculta a los demás; eliminar pide confirmación y borra sus fotos', async ({ page, request, browser }) => {
    const dialog = await openMarketplace(page)
    const card = dialog.getByRole('article', { name: TITLE })
    await card.getByRole('button', { name: 'Pausar' }).click()
    await expect(page.getByText('Publicación pausada')).toBeVisible()

    const other = await browser.newContext({ storageState: storageStatePath('lectora2') })
    const otherPage = await other.newPage()
    const otherDialog = await openMarketplace(otherPage)
    await otherDialog.getByLabel('Buscar por título o autor').fill(String(RUN))
    await expect(otherDialog.getByText('No hay publicaciones con estos filtros.')).toBeVisible()
    await other.close()

    await dialog.getByRole('button', { name: 'Mis publicaciones' }).click()
    await expect(dialog.getByRole('button', { name: 'Mis publicaciones' })).toHaveAttribute('aria-pressed', 'true')
    const mine = dialog.getByRole('article', { name: TITLE })
    await expect(mine).toContainText('Pausada')
    const [listing] = (await myListings(request, 'lectora1')).filter(l => l.bookTitle === TITLE)
    const photoUrl = `${E2E_ORIGIN}${listing.photos[0].url}`

    await mine.getByRole('button', { name: 'Eliminar' }).click()
    await mine.getByRole('button', { name: 'Sí, eliminar' }).click()
    await expect(page.getByText('Publicación eliminada')).toBeVisible()
    await expect(dialog.getByRole('article', { name: TITLE })).toHaveCount(0)
    expect((await request.get(photoUrl)).status()).toBe(404)
  })
})

test.describe('celular', () => {
  test.use({ storageState: storageStatePath('lectora1'), viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true })

  test('se abre desde el menú "Más opciones" y no tiene scroll horizontal', async ({ page }) => {
    await page.goto('')
    await expect(page.getByText('Cargando tu biblioteca…')).toHaveCount(0)
    await page.getByRole('button', { name: 'Más opciones' }).tap()
    await page.getByRole('menuitem', { name: 'Mercado de libros' }).tap()
    const dialog = page.getByRole('dialog', { name: 'Mercado de libros' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Publicar un libro' }).tap()
    await page.evaluate(() => document.fonts.ready)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    const box = (await dialog.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(361)
  })
})
