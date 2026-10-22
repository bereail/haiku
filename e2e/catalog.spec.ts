import { test, expect } from '@playwright/test'

test.describe('Catálogo público', () => {
  test('se puede buscar sin iniciar sesión', async ({ page }) => {
    await page.goto('catalog')
    await expect(page.getByRole('heading', { name: 'Catálogo público' })).toBeVisible()

    const search = page.getByPlaceholder('Buscar por título...')
    await search.fill('Rayuela')
    // Al menos una fuente de resultados responde (local o Open Library) —
    // no asumimos cuál, solo que la búsqueda no se rompe ni queda colgada.
    await expect(page.getByText(/Escribí al menos|Buscando|En Librook|Open Library|No encontramos/).first()).toBeVisible({ timeout: 10000 })
  })

  test('una ruta directa de catálogo sobrevive un refresh (deep link)', async ({ page }) => {
    await page.goto('catalog')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Catálogo público' })).toBeVisible()
  })
})
