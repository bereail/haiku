import fs from 'node:fs'
import { test, expect, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test'
import { API_URL, BASE_URL, bearer, storageStatePath, type AccountName } from './accounts'
import { mockOpenLibrary } from './openlibrary-mock'
import { expectNoViolations } from './axe'
import { tourKey } from '../src/tour/tourStorage'

// Tutorial de la primera vez, de punta a punta sobre la interfaz real: invitación,
// avanzar/retroceder, omitir, finalizar, preferencia recordada, volver a abrirlo,
// modo práctica sin crear datos, roles, celular y cambio de tamaño de pantalla.

const DESKTOP = { width: 1280, height: 800 }
const MOBILE = { width: 390, height: 844 }

// Sesión guardada de la cuenta, pero como si nunca hubiera visto el tutorial
// (global-setup la marca como vista para el resto de las specs).
function firstTimeState(name: AccountName) {
  const state = JSON.parse(fs.readFileSync(storageStatePath(name), 'utf8'))
  const ls = state.origins[0].localStorage as { name: string; value: string }[]
  state.origins[0].localStorage = ls.filter(i => !i.name.startsWith('haiku_tour_v1:'))
  return state
}

// La sesión demo guardada no sirve acá: security-demo.spec cambia a propósito la
// contraseña de la demo (y eso revoca sus sesiones). Se pide una nueva, como global-setup.
async function freshDemoState(request: APIRequestContext) {
  const res = await request.post(`${API_URL}/auth/demo-login`)
  expect(res.ok()).toBe(true)
  const { token, email } = await res.json()
  return {
    cookies: [],
    origins: [{
      origin: new URL(BASE_URL).origin,
      localStorage: [
        { name: 'haiku_token', value: token },
        { name: 'haiku_auth', value: JSON.stringify({ email, isDemo: true }) },
      ],
    }],
  }
}

type State = ReturnType<typeof firstTimeState>

async function openAs(browser: Browser, who: AccountName | State, viewport = DESKTOP) {
  const storageState = typeof who === 'string' ? firstTimeState(who) : who
  const context = await browser.newContext({ storageState, viewport })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', e => errors.push(e.message))
  await mockOpenLibrary(page)
  await page.goto('')
  await expect(page.getByRole('heading', { name: 'Haiku', exact: true })).toBeVisible()
  return { page, context, errors }
}

const tour = (page: Page) => page.getByRole('dialog').filter({ has: page.getByText(/^Paso \d+ de \d+$/) })
const invite = (page: Page) => page.getByRole('region', { name: '¿Primera vez en Haiku?' })

async function stepInfo(page: Page) {
  const dlg = tour(page)
  await expect(dlg).toBeVisible()
  const [, n, total] = (await dlg.getByText(/^Paso \d+ de \d+$/).textContent())!.match(/Paso (\d+) de (\d+)/)!
  return { title: (await dlg.getByRole('heading').textContent())!, n: Number(n), total: Number(total) }
}

// El resaltado rodea al elemento real y el globo queda entero dentro de la pantalla.
async function expectHighlights(page: Page, target: Locator) {
  const ring = page.getByTestId('tour-highlight')
  await expect(ring).toBeVisible()
  await expect(async () => {
    const [r, t] = [await ring.boundingBox(), await target.boundingBox()]
    expect(r && t).toBeTruthy()
    expect(r!.x).toBeLessThanOrEqual(t!.x + 1)
    expect(r!.y).toBeLessThanOrEqual(t!.y + 1)
    expect(r!.x + r!.width).toBeGreaterThanOrEqual(t!.x + t!.width - 1)
    expect(r!.y + r!.height).toBeGreaterThanOrEqual(t!.y + t!.height - 1)
  }).toPass()
  await expectBubbleOnScreen(page)
}

async function expectBubbleOnScreen(page: Page) {
  const vp = page.viewportSize()!
  await expect(async () => {
    const b = (await tour(page).boundingBox())!
    expect(b.x).toBeGreaterThanOrEqual(0)
    expect(b.y).toBeGreaterThanOrEqual(0)
    expect(b.x + b.width).toBeLessThanOrEqual(vp.width)
    expect(b.y + b.height).toBeLessThanOrEqual(vp.height)
  }).toPass()
}

const next = (page: Page) => tour(page).getByRole('button', { name: /^(Empezar|Siguiente)$/ }).click()

test.describe('Tutorial', () => {
  test('primera vez: invitación → recorrido completo sobre la interfaz real → no vuelve a invitar', async ({ browser, request }) => {
    // Un libro propio del test, para que existan tarjeta y filtros (se borra al final)
    const res = await request.post(`${API_URL}/books`, {
      headers: bearer('lectora1'), data: { title: `Tutorial E2E ${Date.now()}`, author: 'Prueba' },
    })
    expect(res.ok()).toBe(true)
    const bookId = (await res.json()).id
    try {
      const { page, context, errors } = await openAs(browser, 'lectora1')

      // La invitación no bloquea: la app se sigue usando con ella abierta
      await expect(invite(page)).toBeVisible()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await page.getByRole('button', { name: 'Leídos', exact: true }).click()
      await page.getByRole('button', { name: 'Todos', exact: true }).click()

      await invite(page).getByRole('button', { name: 'Ver el tutorial' }).click()
      await expect(invite(page)).toHaveCount(0)

      let s = await stepInfo(page)
      expect(s).toMatchObject({ n: 1, title: 'Te damos la bienvenida a Haiku' })
      await expect(tour(page).getByRole('button', { name: 'Empezar' })).toBeFocused()
      // Mientras el tutorial está abierto los atajos de teclado no abren nada encima
      await page.keyboard.press('n')
      await expect(page.getByRole('dialog')).toHaveCount(1)

      const header = page.getByRole('banner')
      const expected: [string, Locator][] = [
        ['Contame qué leíste', header.getByRole('button', { name: /^Contame qué leíste/ })],
        ['Buscá cualquier libro', header.getByRole('button', { name: 'Buscar en Open Library' })],
        ['O cargalo a mano', header.getByRole('button', { name: 'Agregar' })],
        ['Encontrá tus libros', page.getByRole('button', { name: 'Leyendo', exact: true }).locator('..')],
        ['Cada libro es una tarjeta', page.getByRole('article').first()],
        ['Todo lo demás', header.getByRole('button', { name: 'Estadísticas' }).locator('..')],
        ['¡Listo!', header.getByRole('button', { name: 'Ver tutorial' })],
      ]
      for (const [title, target] of expected) {
        await next(page)
        s = await stepInfo(page)
        expect(s.title).toBe(title)
        await expectHighlights(page, target)
      }
      expect(s.n).toBe(s.total)
      expect(s.total).toBe(expected.length + 1)

      // Retroceder y volver
      await tour(page).getByRole('button', { name: 'Anterior' }).click()
      expect((await stepInfo(page)).title).toBe('Todo lo demás')
      await page.keyboard.press('ArrowRight')
      expect((await stepInfo(page)).title).toBe('¡Listo!')

      await tour(page).getByRole('button', { name: 'Finalizar' }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.getByTestId('tour')).toHaveCount(0)

      // La app queda usable (nada bloqueado) y la preferencia se recuerda al recargar
      await page.getByRole('button', { name: 'Leídos', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Leídos', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await page.reload()
      await expect(page.getByRole('heading', { name: 'Haiku', exact: true })).toBeVisible()
      await expect(page.getByRole('article').first().or(page.getByText('Tu biblioteca está vacía'))).toBeVisible()
      await expect(invite(page)).toHaveCount(0)
      expect(await page.evaluate(k => localStorage.getItem(k), tourKey('lectora1@test.dev'))).toBe('done')

      // Se puede volver a abrir desde «Ver tutorial»
      await page.getByRole('banner').getByRole('button', { name: 'Ver tutorial' }).click()
      expect(await stepInfo(page)).toMatchObject({ n: 1 })
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      // El foco vuelve al botón que lo abrió
      await expect(page.getByRole('banner').getByRole('button', { name: 'Ver tutorial' })).toBeFocused()

      expect(errors).toEqual([])
      await context.close()
    } finally {
      await request.delete(`${API_URL}/books/${bookId}`, { headers: bearer('lectora1') })
    }
  })

  test('«Omitir» y «No, gracias» se recuerdan; «Más tarde» solo por esta sesión', async ({ browser }) => {
    let { page, context } = await openAs(browser, 'lectora2')
    await invite(page).getByRole('button', { name: 'Ver el tutorial' }).click()
    await next(page)
    await tour(page).getByRole('button', { name: 'Omitir' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Haiku', exact: true })).toBeVisible()
    await expect(page.getByRole('article').first().or(page.getByText('Tu biblioteca está vacía'))).toBeVisible()
    await expect(invite(page)).toHaveCount(0)
    await context.close()

    ;({ page, context } = await openAs(browser, 'lectora2'))
    await invite(page).getByRole('button', { name: 'No, gracias' }).click()
    await expect(invite(page)).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Haiku', exact: true })).toBeVisible()
    await expect(page.getByRole('article').first().or(page.getByText('Tu biblioteca está vacía'))).toBeVisible()
    await expect(invite(page)).toHaveCount(0)
    await context.close()

    ;({ page, context } = await openAs(browser, 'lectora2'))
    await invite(page).getByRole('button', { name: 'Más tarde' }).click()
    await page.reload()
    await expect(page.getByRole('article').first().or(page.getByText('Tu biblioteca está vacía'))).toBeVisible()
    await expect(invite(page)).toHaveCount(0)
    // Otra pestaña/visita (sessionStorage nuevo): vuelve a invitar
    const other = await context.newPage()
    await other.goto('')
    await expect(invite(other)).toBeVisible()
    await context.close()
  })

  test('modo práctica: usar el botón real pausa el tutorial y sigue al cerrar, sin crear datos', async ({ browser, request }) => {
    const before = (await (await request.get(`${API_URL}/books`, { headers: bearer('lectora1') })).json()).length
    const { page, context, errors } = await openAs(browser, 'lectora1')
    await invite(page).getByRole('button', { name: 'Ver el tutorial' }).click()
    await next(page)
    await next(page)
    expect((await stepInfo(page)).title).toBe('Buscá cualquier libro')

    // Toca el botón real resaltado (a través del hueco de la capa)
    await page.getByRole('banner').getByRole('button', { name: 'Buscar en Open Library' }).click()
    const search = page.getByRole('dialog', { name: /Buscar/ })
    await expect(search).toBeVisible()
    await expect(tour(page)).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Tutorial en pausa' })).toBeAttached()
    await page.keyboard.press('Escape')
    await expect(search).toHaveCount(0)

    expect((await stepInfo(page)).title).toBe('O cargalo a mano')
    // Con el botón «Probalo» (teclado): abre el formulario real
    await tour(page).getByRole('button', { name: 'Probalo' }).click()
    const form = page.getByRole('dialog', { name: /Agregar libro|Nuevo libro/ })
    await expect(form).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(form).toHaveCount(0)
    // Sigue en el paso siguiente que exista: con la biblioteca vacía, el de bienvenida vacía
    expect((await stepInfo(page)).title).toBe(before === 0 ? 'Tu biblioteca, todavía vacía' : 'Encontrá tus libros')
    if (before === 0) {
      await expectHighlights(page, page.getByText('Tu biblioteca está vacía').locator('..'))
      await next(page)
      expect((await stepInfo(page)).title).toBe('Encontrá tus libros')
    }

    // En un paso que solo explica, el elemento resaltado no recibe clics (lo tapa la capa)
    await expectHighlights(page, page.getByRole('button', { name: 'Leyendo', exact: true }).locator('..'))
    const box = (await page.getByRole('button', { name: 'Leyendo', exact: true }).boundingBox())!
    const topmost = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('[data-testid="tour"]') !== null,
      [box.x + box.width / 2, box.y + box.height / 2])
    expect(topmost).toBe(true)

    const after = (await (await request.get(`${API_URL}/books`, { headers: bearer('lectora1') })).json()).length
    expect(after).toBe(before)
    expect(errors).toEqual([])
    await context.close()
  })

  test('roles: el admin ve el paso del Panel admin; la demo no tiene modo práctica', async ({ browser, request }) => {
    let { page, context } = await openAs(browser, 'admin')
    await invite(page).getByRole('button', { name: 'Ver el tutorial' }).click()
    const titles: string[] = []
    for (;;) {
      const s = await stepInfo(page)
      titles.push(s.title)
      if (s.title === 'Panel admin') await expectHighlights(page, page.getByRole('banner').getByRole('button', { name: 'Panel admin' }))
      if (s.n === s.total) break
      await next(page)
    }
    expect(titles).toContain('Panel admin')
    await context.close()

    ;({ page, context } = await openAs(browser, 'lectora1'))
    await invite(page).getByRole('button', { name: 'Ver el tutorial' }).click()
    await expect(tour(page)).toBeVisible()
    for (let s = await stepInfo(page); s.n < s.total; s = await stepInfo(page)) {
      expect(s.title).not.toBe('Panel admin')
      await next(page)
    }
    await context.close()

    ;({ page, context } = await openAs(browser, await freshDemoState(request)))
    await invite(page).getByRole('button', { name: 'Ver el tutorial' }).click()
    await expect(tour(page)).toContainText('biblioteca de ejemplo')
    await next(page)
    expect((await stepInfo(page)).title).toBe('Contame qué leíste')
    await expect(tour(page).getByRole('button', { name: 'Probalo' })).toHaveCount(0)
    await context.close()
  })

  test('celular: se abre desde «Más opciones», señala lo visible y no desborda la pantalla', async ({ browser }) => {
    const { page, context, errors } = await openAs(browser, 'lectora1', MOBILE)
    await expect(invite(page)).toBeVisible()
    await page.getByRole('button', { name: 'Más opciones' }).click()
    await page.getByRole('menuitem', { name: 'Ver tutorial' }).click()
    await expect(invite(page)).toHaveCount(0)

    for (let s = await stepInfo(page); ; s = await stepInfo(page)) {
      await expectBubbleOnScreen(page)
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(scroll, `scroll horizontal en "${s.title}"`).toBeLessThanOrEqual(0)
      if (s.title === 'Todo lo demás' || s.title === '¡Listo!') {
        await expect(tour(page)).toContainText('Más opciones')
        await expectHighlights(page, page.getByRole('button', { name: 'Más opciones' }))
      }
      if (s.n === s.total) break
      await next(page)
    }
    await tour(page).getByRole('button', { name: 'Finalizar' }).click()
    await expect(page.getByTestId('tour')).toHaveCount(0)
    expect(errors).toEqual([])
    await context.close()
  })

  test('cambiar el tamaño de la pantalla en medio de un paso mueve el resaltado al elemento visible', async ({ browser }) => {
    const { page, context } = await openAs(browser, 'lectora1')
    await invite(page).getByRole('button', { name: 'Ver el tutorial' }).click()
    while ((await stepInfo(page)).title !== 'Todo lo demás') await next(page)
    await expectHighlights(page, page.getByRole('banner').getByRole('button', { name: 'Estadísticas' }).locator('..'))
    await expect(tour(page)).not.toContainText('tres puntos')

    await page.setViewportSize(MOBILE)
    await expect(tour(page)).toContainText('tres puntos')
    await expectHighlights(page, page.getByRole('button', { name: 'Más opciones' }))

    await page.setViewportSize(DESKTOP)
    await expect(tour(page)).not.toContainText('tres puntos')
    await context.close()
  })

  test('accesibilidad: invitación y globo sin violaciones de axe', async ({ browser }) => {
    const { page, context } = await openAs(browser, 'lectora1')
    // expectNoViolations espera a que terminen las animaciones de entrada: la invitación
    // aparece con un fundido cuando termina de cargar la biblioteca, y medir en ese
    // momento daba un falso color-contrast intermitente.
    await expect(invite(page)).toBeVisible()
    await expectNoViolations(page, 'invitación', 'section[aria-labelledby="tour-invite-title"]')

    await invite(page).getByRole('button', { name: 'Ver el tutorial' }).click()
    await next(page)
    await expect(page.getByTestId('tour-highlight')).toBeVisible()
    await expectNoViolations(page, 'globo del tutorial', '[data-testid="tour"]')
    await context.close()
  })

  test('con movimiento reducido no hay animaciones', async ({ browser }) => {
    const context = await browser.newContext({ storageState: firstTimeState('lectora1'), viewport: DESKTOP, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await mockOpenLibrary(page)
    await page.goto('')
    await invite(page).getByRole('button', { name: 'Ver el tutorial' }).click()
    await next(page)
    const names = await page.getByTestId('tour').evaluate(root =>
      [...root.querySelectorAll('*')].map(el => getComputedStyle(el).animationName).filter(n => n !== 'none'))
    expect(names).toEqual([])
    await context.close()
  })
})
