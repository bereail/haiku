import { test, expect } from '@playwright/test'

const TEST_EMAIL = 'lectora1@test.dev'
const TEST_PASSWORD = 'test1234'

// Título único por corrida para no chocar con libros ya existentes de la
// cuenta de prueba y para poder buscarlo sin falsos positivos.
const UNIQUE_TITLE = `Libro E2E ${Date.now()}`
const PRIVATE_NOTE = 'Nota privada de prueba E2E — no debería salir de mi biblioteca.'

test.describe('Biblioteca: alta, persistencia y privacidad de notas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.locator('#email').fill(TEST_EMAIL)
    await page.locator('#password').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByPlaceholder('Buscar por título o autor...')).toBeVisible()
  })

  test('agregar un libro con nota privada persiste y no se filtra al Catálogo público', async ({ page, browser }) => {
    const search = page.getByPlaceholder('Buscar por título o autor...')
    // La tarjeta repite el título en frente y dorso (flip): se apunta al
    // <article> por su nombre accesible para no tener dos coincidencias.
    const card = page.getByRole('article', { name: UNIQUE_TITLE })

    // 1. Agregar manualmente (botón del header, no el FAB mobile)
    await page.getByRole('button', { name: 'Agregar', exact: true }).click()
    await page.locator('#title').fill(UNIQUE_TITLE)
    await page.locator('#author').fill('Autor E2E')
    await page.locator('#notes').fill(PRIVATE_NOTE)
    await page.getByRole('button', { name: 'Agregar libro' }).click()

    // 2. Aparece en la biblioteca
    await expect(card).toBeVisible()

    // 3. Persiste tras recargar (confirma que quedó en la base, no solo en
    //    memoria), con la nota guardada en el dorso de la tarjeta
    await page.reload()
    await search.fill(UNIQUE_TITLE)
    await expect(card).toBeVisible()
    await card.click() // flip de la tarjeta
    await expect(card.getByRole('region', { name: `Notas de ${UNIQUE_TITLE}` })).toHaveText(PRIVATE_NOTE)

    // 4. La nota privada no aparece en el catálogo público. Contexto nuevo:
    //    sin el token de sesión de lectora1 en localStorage.
    const publicContext = await browser.newContext()
    const publicPage = await publicContext.newPage()
    await publicPage.goto('catalog')
    await publicPage.getByPlaceholder('Buscar por título...').fill(UNIQUE_TITLE)
    await publicPage.waitForLoadState('networkidle')
    await expect(publicPage.getByText(PRIVATE_NOTE)).toHaveCount(0)
    await publicContext.close()

    // 5. Limpieza: borrar el libro de prueba para no acumular basura en
    //    la cuenta de prueba entre corridas. La tarjeta ya está dada vuelta.
    await card.getByRole('button', { name: 'Eliminar' }).click()
    await card.getByRole('button', { name: 'Sí' }).click()
    await expect(card).toHaveCount(0)
    await page.reload()
    await search.fill(UNIQUE_TITLE)
    await expect(card).toHaveCount(0)
  })
})
