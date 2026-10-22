import { test, expect } from '@playwright/test'
import { storageStatePath } from './accounts'

// Pestañas del Panel Admin con el patrón WAI-ARIA Tabs: el lector de pantalla
// tiene que saber que son pestañas, cuál está activa y qué panel controla cada
// una; con teclado se cambia con flechas/Inicio/Fin y Tab entra al panel.

test.describe('Panel Admin: pestañas accesibles', () => {
  test.use({ storageState: storageStatePath('admin') })

  test.beforeEach(async ({ page }) => {
    await page.goto('')
    await page.getByRole('button', { name: 'Panel admin' }).first().click()
    await expect(page.getByRole('heading', { name: 'Panel Admin' })).toBeVisible()
  })

  test('semántica: tablist, tab con aria-selected y tabpanel etiquetado', async ({ page }) => {
    const tablist = page.getByRole('tablist')
    await expect(tablist).toBeVisible()
    const analytics = tablist.getByRole('tab', { name: /^Analíticas/ })
    const users = tablist.getByRole('tab', { name: /^Usuarios/ })
    await expect(analytics).toHaveAttribute('aria-selected', 'true')
    await expect(users).toHaveAttribute('aria-selected', 'false')

    const panel = page.getByRole('tabpanel')
    await expect(panel).toHaveCount(1)
    await expect(panel).toHaveAccessibleName(/^Analíticas/)
    const controls = await analytics.getAttribute('aria-controls')
    expect(controls).toBeTruthy()
    await expect(panel).toHaveAttribute('id', controls!)

    // El landmark principal sigue existiendo
    await expect(page.getByRole('main')).toHaveCount(1)
  })

  test('teclado: flechas, Inicio y Fin cambian de pestaña; Tab entra al panel', async ({ page }) => {
    const analytics = page.getByRole('tab', { name: /^Analíticas/ })
    const users = page.getByRole('tab', { name: /^Usuarios/ })

    // Solo la pestaña activa está en el orden de tabulación (roving tabindex)
    await expect(analytics).toHaveAttribute('tabindex', '0')
    await expect(users).toHaveAttribute('tabindex', '-1')

    await analytics.focus()
    await page.keyboard.press('ArrowRight')
    await expect(users).toBeFocused()
    await expect(users).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tabpanel')).toHaveAccessibleName(/^Usuarios/)

    await page.keyboard.press('ArrowRight') // da la vuelta
    await expect(analytics).toBeFocused()
    await expect(analytics).toHaveAttribute('aria-selected', 'true')

    await page.keyboard.press('End')
    await expect(users).toBeFocused()
    await page.keyboard.press('Home')
    await expect(analytics).toBeFocused()
    await page.keyboard.press('ArrowLeft') // da la vuelta hacia atrás
    await expect(users).toBeFocused()

    await page.keyboard.press('Tab')
    await expect.poll(() => page.getByRole('tabpanel').evaluate(p => p === document.activeElement || p.contains(document.activeElement))).toBe(true)
  })
})
