import { test, expect, type Page } from '@playwright/test'
import { BASE_URL, storageStatePath } from './accounts'

// Tema claro/oscuro: la elección explícita persiste entre recargas y páginas;
// sin elección, se sigue la preferencia del sistema (también si cambia); y el
// primer cuadro ya se dibuja con el tema correcto (sin destello claro).

const html = (page: Page) => page.locator('html')

test.describe('con sesión', () => {
  test.use({ storageState: storageStatePath('lectora3') })

  test('elegir oscuro persiste al recargar y en catálogo y obra', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('')
    await expect(html(page)).toHaveAttribute('data-theme', 'light')
    await page.getByRole('button', { name: 'Modo oscuro' }).click()
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')

    await page.reload()
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByRole('button', { name: 'Modo claro' })).toBeVisible()

    await page.goto('catalog')
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    // Cambiarlo desde el catálogo también vale para la biblioteca
    await page.getByRole('button', { name: 'Modo claro' }).click()
    await page.goto('')
    await expect(html(page)).toHaveAttribute('data-theme', 'light')
  })

  test('la elección explícita gana sobre la preferencia del sistema', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('')
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('button', { name: 'Modo claro' }).click()
    await page.reload()
    await expect(html(page)).toHaveAttribute('data-theme', 'light')
  })
})

test.describe('sin elección explícita', () => {
  test('sigue la preferencia del sistema, también si cambia después', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto(BASE_URL)
    await expect(html(page)).toHaveAttribute('data-theme', 'light')

    // La persona cambia su sistema a oscuro (nunca tocó el botón de la app)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.reload()
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    expect(await page.evaluate(() => localStorage.getItem('haiku_theme'))).toBeNull()
  })

  test('el primer cuadro ya tiene el tema guardado (sin destello claro)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('haiku_theme', 'dark')
      requestAnimationFrame(() => {
        (window as unknown as { __firstFrameTheme: string | null }).__firstFrameTheme =
          document.documentElement.getAttribute('data-theme')
      })
    })
    await page.goto(BASE_URL)
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    expect(await page.evaluate(() => (window as unknown as { __firstFrameTheme: string | null }).__firstFrameTheme)).toBe('dark')
  })
})
